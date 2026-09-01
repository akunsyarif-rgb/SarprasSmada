/**
 * AuthService.gs
 *
 * Autentikasi berbasis username(email)/password + sesi bertoken untuk
 * SIGAP SARPRAS — MENGGANTIKAN model lama (`apps-script/api/AuthContext.gs`
 * versi PHASE 4.5, `Session.getActiveUser()`/SSO Google Workspace). Alasan
 * penggantian: PHASE 4.5 hanya bisa jalan ketika HTML disajikan LANGSUNG
 * oleh Apps Script sendiri (HtmlService + google.script.run) — begitu
 * frontend dipindah ke hosting terpisah (lihat `frontend/`, dipanggil lewat
 * `fetch()` cross-origin ke Web App JSON API di `apps-script/api/App.gs`),
 * `Session.getActiveUser()` tidak lagi bisa diandalkan untuk mengidentifikasi
 * pemanggil. Pola ini sengaja meniru arsitektur SIGAP (aplikasi sekolah
 * lain, lihat repo `Sigap-app`, TIDAK diubah oleh perubahan ini): login
 * password + sesi bertoken tersimpan di `CacheService`, bukan SSO.
 *
 * KONSEKUENSI PENTING: karena akses Web App tidak lagi bergantung pada sesi
 * Google, `apps-script/appsscript.json` diubah mengikuti (`webapp.executeAs:
 * "USER_DEPLOYING"`, `webapp.access: "ANYONE_ANONYMOUS"`) — siapa pun dapat
 * mencapai URL Web App, dan SATU-SATUNYA gerbang keamanan sesungguhnya
 * adalah token API (`api/App.gs` checkToken_()) + login/sesi pada modul
 * ini. Lihat catatan pada `apps-script/appsscript.json` dan
 * `docs/ARCHITECTURE.md`.
 *
 * SCHEMA CHANGE (additive, tidak menyentuh data lama): `01_users` mendapat
 * dua kolom baru, `password_hash` dan `password_salt` — lihat
 * `docs/DATABASE_SCHEMA.md`. Baris pengguna LAMA (dibuat sebelum perubahan
 * ini) memiliki kedua kolom tersebut KOSONG — pengguna itu TIDAK BISA login
 * sampai seorang ADMIN menetapkan password awal lewat setPassword(). Ini
 * disengaja (tidak ada migrasi password otomatis yang aman dilakukan dari
 * kode) — lihat docs/DATABASE_SETUP.md untuk langkah bootstrap admin
 * pertama.
 *
 * Modul ini TETAP mematuhi docs/ARCHITECTURE.md bagian 4 (Aturan Akses
 * Database) — seluruh akses ke sheet 01_users lewat core/DatabaseService.gs,
 * tidak ada pemanggilan SpreadsheetApp langsung. Modul ini sengaja TERPISAH
 * dari apps-script/users/UserService.gs (yang secara eksplisit menyatakan
 * "TIDAK ADA autentikasi, TIDAK ADA password/credential apa pun di sini")
 * agar tanggung jawab data-pengguna dan tanggung jawab autentikasi tidak
 * bercampur dalam satu modul.
 *
 * SESSION: disimpan di CacheService.getScriptCache(), BUKAN sheet baru —
 * sesi bersifat sementara (habis dalam hitungan jam) dan tidak perlu
 * riwayat permanen, sama seperti pertimbangan yang sama di aplikasi SIGAP.
 * CacheService.put() punya batas keras 21600 detik (6 jam) per pemanggilan
 * — SESSION_TTL_SECONDS_ mengikuti batas itu. Agar entri cache yang sering
 * dipakai tidak ter-evict lebih awal dari batas itu (Apps Script tidak
 * menjamin retensi penuh hingga TTL), getSessionUser() MENULIS ULANG
 * (re-put) entri pada setiap pemanggilan yang berhasil — TAPI sisa umur
 * sesi selalu dihitung ulang dari loginAt yang tersimpan DI DALAM record,
 * bukan dari TTL cache itu sendiri, sehingga sesi TIDAK PERNAH diperpanjang
 * melebihi 6 jam sejak login walau dipakai terus-menerus.
 *
 * RATE LIMITING: login gagal dibatasi secara GLOBAL (bukan per akun) dalam
 * jendela tetap 5 menit, mengikuti pola yang sama dengan yang dipakai
 * aplikasi SIGAP untuk alasan yang sama — pada titik percobaan login,
 * sistem belum tahu apakah percobaan itu benar-benar milik satu akun
 * tertentu (email bisa saja salah/tidak terdaftar).
 *
 * Dependency:
 * - core/Config.gs (CONFIG.SHEETS.USERS)
 * - core/DatabaseService.gs (getRowById, updateRowById)
 * - core/UtilityService.gs (isEmpty, isValidEmail, nowTimestamp)
 * - apps-script/users/UserService.gs (getUserByEmail)
 * - Google Apps Script bawaan: CacheService, Utilities, LockService
 *
 * Referensi: docs/DATABASE_SCHEMA.md (01_users), docs/DATABASE_SETUP.md
 */

/** Masa berlaku sesi, dalam detik — batas keras CacheService.put(). @private */
var AUTH_SESSION_TTL_SECONDS_ = 21600; // 6 jam
/** Panjang minimum password yang diterima. @private */
var AUTH_MIN_PASSWORD_LENGTH_ = 8;
/** Jendela rate limit percobaan login gagal, dalam detik. @private */
var AUTH_LOGIN_RATE_WINDOW_SECONDS_ = 300; // 5 menit
/** Batas jumlah percobaan login gagal dalam satu jendela. @private */
var AUTH_LOGIN_RATE_MAX_FAILURES_ = 15;
/** Key CacheService untuk counter rate limit login. @private */
var AUTH_LOGIN_RATE_CACHE_KEY_ = 'auth_login_failures';
/** Prefix key CacheService untuk record sesi. @private */
var AUTH_SESSION_CACHE_PREFIX_ = 'auth_session_';

/**
 * Menghasilkan salt acak untuk satu password.
 * @return {string} Salt (UUID v4).
 * @private
 */
function authGenerateSalt_() {
  return Utilities.getUuid();
}

/**
 * Melakukan hashing satu password dengan salt tertentu (SHA-256).
 * @param {string} password Password polos.
 * @param {string} salt Salt milik pengguna.
 * @return {string} Hash dalam bentuk heksadesimal.
 * @private
 */
function authHashPassword_(password, salt) {
  var digestBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + ':' + password,
    Utilities.Charset.UTF_8
  );
  return digestBytes.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

/**
 * Memvalidasi kekuatan minimum password baru.
 * @param {string} password Password yang diperiksa.
 * @throws {Error} Jika password kosong atau lebih pendek dari
 *   AUTH_MIN_PASSWORD_LENGTH_.
 * @private
 */
function authValidatePasswordStrength_(password) {
  if (isEmpty(password)) {
    throw new Error('AuthService: password wajib diisi.');
  }
  if (password.length < AUTH_MIN_PASSWORD_LENGTH_) {
    throw new Error(
      'AuthService: password minimal ' + AUTH_MIN_PASSWORD_LENGTH_ + ' karakter.'
    );
  }
}

/**
 * Menetapkan (membuat atau mengganti) password seorang pengguna. Dipanggil
 * oleh admin untuk bootstrap awal / reset password, ATAU oleh pengguna itu
 * sendiri lewat changePassword() setelah password lama diverifikasi lebih
 * dulu — fungsi ini sendiri TIDAK memeriksa password lama, pemanggil
 * bertanggung jawab atas otorisasi (lihat apps-script/api/AuthApi.gs).
 *
 * @param {string} userId user_id target (01_users).
 * @param {string} newPassword Password baru (plain text, akan di-hash).
 * @return {Object} Baris pengguna setelah password diperbarui (tanpa
 *   password_hash/password_salt pada objek kembalian — lihat authSanitizeUser_).
 * @throws {Error} Jika userId kosong, pengguna tidak ditemukan, atau
 *   password baru tidak memenuhi kekuatan minimum.
 */
function setPassword(userId, newPassword) {
  if (isEmpty(userId)) {
    throw new Error('AuthService.setPassword: "userId" wajib diisi.');
  }
  authValidatePasswordStrength_(newPassword);

  var user = getRowById(CONFIG.SHEETS.USERS, 'user_id', userId);
  if (!user) {
    throw new Error('AuthService.setPassword: Pengguna tidak ditemukan: "' + userId + '".');
  }

  var salt = authGenerateSalt_();
  var hash = authHashPassword_(newPassword, salt);

  var updated = updateRowById(CONFIG.SHEETS.USERS, 'user_id', userId, {
    password_hash: hash,
    password_salt: salt,
    updated_at: nowTimestamp()
  });

  return authSanitizeUser_(updated);
}

/**
 * Melakukan login: memverifikasi email+password, membuat sesi baru bila
 * berhasil. Dibatasi rate limit global (lihat header file).
 *
 * @param {string} email Email pengguna (identitas login, sama seperti 01_users.email).
 * @param {string} password Password polos.
 * @return {{token: string, expiresAt: string, user: Object}} Sesi baru + data pengguna (tanpa hash/salt).
 * @throws {Error} Jika rate limit tercapai, email/password kosong, akun
 *   tidak ditemukan/tidak aktif, akun belum punya password (butuh admin
 *   men-set lebih dulu), atau password salah.
 */
function login(email, password) {
  if (authIsLoginRateLimited_()) {
    throw new Error(
      'AuthService.login: Terlalu banyak percobaan login gagal. Coba lagi setelah beberapa menit.'
    );
  }
  if (isEmpty(email) || isEmpty(password)) {
    authRecordLoginFailure_();
    throw new Error('AuthService.login: Email dan password wajib diisi.');
  }

  var user = getUserByEmail(email);
  if (!user || user.is_active !== true) {
    authRecordLoginFailure_();
    throw new Error('AuthService.login: Email atau password salah.');
  }
  if (isEmpty(user.password_hash) || isEmpty(user.password_salt)) {
    authRecordLoginFailure_();
    throw new Error(
      'AuthService.login: Akun ini belum memiliki password. Hubungi admin untuk menetapkan password awal.'
    );
  }

  var computedHash = authHashPassword_(password, user.password_salt);
  if (computedHash !== user.password_hash) {
    authRecordLoginFailure_();
    throw new Error('AuthService.login: Email atau password salah.');
  }

  return authCreateSession_(user);
}

/**
 * Mengakhiri satu sesi (menghapusnya dari cache). Idempotent — memanggil
 * dengan token yang sudah tidak valid/tidak ada bukan error.
 *
 * @param {string} token Token sesi yang diakhiri.
 */
function logout(token) {
  if (isEmpty(token)) {
    return;
  }
  CacheService.getScriptCache().remove(AUTH_SESSION_CACHE_PREFIX_ + token);
}

/**
 * Mengganti password milik pengguna yang sedang login sendiri (self-service)
 * — memverifikasi password lama lebih dulu, BEDA dari setPassword() yang
 * dipakai admin untuk reset tanpa perlu tahu password lama.
 *
 * @param {string} userId user_id pengguna yang mengganti password (dari sesi aktif).
 * @param {string} oldPassword Password lama, wajib cocok.
 * @param {string} newPassword Password baru.
 * @return {Object} Baris pengguna setelah password diperbarui (tersanitasi).
 * @throws {Error} Jika pengguna tidak ditemukan, password lama salah/akun
 *   belum punya password, atau password baru tidak memenuhi kekuatan minimum.
 */
function changePassword(userId, oldPassword, newPassword) {
  if (isEmpty(userId)) {
    throw new Error('AuthService.changePassword: "userId" wajib diisi.');
  }
  var user = getRowById(CONFIG.SHEETS.USERS, 'user_id', userId);
  if (!user) {
    throw new Error('AuthService.changePassword: Pengguna tidak ditemukan: "' + userId + '".');
  }
  if (isEmpty(user.password_hash) || isEmpty(user.password_salt)) {
    throw new Error('AuthService.changePassword: Akun ini belum memiliki password. Hubungi admin.');
  }
  if (isEmpty(oldPassword) || authHashPassword_(oldPassword, user.password_salt) !== user.password_hash) {
    throw new Error('AuthService.changePassword: Password lama salah.');
  }

  return setPassword(userId, newPassword);
}

/**
 * Mengambil data pengguna pemilik suatu token sesi yang masih berlaku.
 * Memperbarui (re-put) entri cache agar tidak ter-evict lebih awal, TANPA
 * memperpanjang umur sesi melebihi 6 jam sejak login — lihat catatan
 * SESSION pada header file.
 *
 * @param {string} token Token sesi.
 * @return {Object|null} Data pengguna (tersanitasi) pemilik sesi, atau null
 *   jika token kosong/tidak ditemukan/sudah kedaluwarsa.
 */
function getSessionUser(token) {
  if (isEmpty(token)) {
    return null;
  }

  var cache = CacheService.getScriptCache();
  var cacheKey = AUTH_SESSION_CACHE_PREFIX_ + token;
  var raw = cache.get(cacheKey);
  if (!raw) {
    return null;
  }

  var record;
  try {
    record = JSON.parse(raw);
  } catch (e) {
    cache.remove(cacheKey);
    return null;
  }

  var elapsedSeconds = (Date.now() - record.loginAtMs) / 1000;
  var remainingSeconds = AUTH_SESSION_TTL_SECONDS_ - elapsedSeconds;
  if (remainingSeconds <= 0) {
    cache.remove(cacheKey);
    return null;
  }

  cache.put(cacheKey, raw, Math.ceil(remainingSeconds));
  return record.user;
}

/**
 * Membuat sesi baru untuk satu pengguna yang sudah berhasil diverifikasi
 * (dipanggil hanya oleh login()).
 *
 * @param {Object} user Baris pengguna (01_users) lengkap.
 * @return {{token: string, expiresAt: string, user: Object}}
 * @private
 */
function authCreateSession_(user) {
  var token = Utilities.getUuid();
  var loginAtMs = Date.now();
  var sanitized = authSanitizeUser_(user);

  var record = {
    user: sanitized,
    loginAtMs: loginAtMs
  };

  CacheService.getScriptCache().put(
    AUTH_SESSION_CACHE_PREFIX_ + token,
    JSON.stringify(record),
    AUTH_SESSION_TTL_SECONDS_
  );

  return {
    token: token,
    expiresAt: formatTimestamp(new Date(loginAtMs + AUTH_SESSION_TTL_SECONDS_ * 1000)),
    user: sanitized
  };
}

/**
 * Menghapus field kredensial (password_hash/password_salt) dari objek
 * pengguna sebelum dikirim ke client mana pun — TIDAK PERNAH mengirim hash
 * atau salt password ke frontend, walau formatnya sudah bukan plain text.
 *
 * @param {Object} user Baris pengguna (01_users) lengkap.
 * @return {Object} Salinan objek pengguna tanpa password_hash/password_salt.
 * @private
 */
function authSanitizeUser_(user) {
  var sanitized = {};
  Object.keys(user).forEach(function (key) {
    if (key !== 'password_hash' && key !== 'password_salt') {
      sanitized[key] = user[key];
    }
  });
  return sanitized;
}

/**
 * Memeriksa apakah jumlah percobaan login gagal global dalam jendela
 * waktu berjalan sudah mencapai batas.
 * @return {boolean} true jika rate limit tercapai.
 * @private
 */
function authIsLoginRateLimited_() {
  var cache = CacheService.getScriptCache();
  var raw = cache.get(AUTH_LOGIN_RATE_CACHE_KEY_);
  var count = raw ? Number(raw) || 0 : 0;
  return count >= AUTH_LOGIN_RATE_MAX_FAILURES_;
}

/**
 * Menambah counter percobaan login gagal global. Menggunakan LockService
 * agar counter tidak salah hitung akibat request paralel.
 * @private
 */
function authRecordLoginFailure_() {
  var lock = LockService.getScriptLock();
  var lockAcquired = lock.tryLock(5000);
  if (!lockAcquired) {
    return;
  }
  try {
    var cache = CacheService.getScriptCache();
    var raw = cache.get(AUTH_LOGIN_RATE_CACHE_KEY_);
    var count = raw ? Number(raw) || 0 : 0;
    cache.put(AUTH_LOGIN_RATE_CACHE_KEY_, String(count + 1), AUTH_LOGIN_RATE_WINDOW_SECONDS_);
  } finally {
    lock.releaseLock();
  }
}
