/**
 * UserService.gs
 *
 * Domain service untuk data pengguna sistem (sheet 01_users). Modul ini
 * HANYA mengelola data pengguna — TIDAK ADA autentikasi, TIDAK ADA
 * password/credential apa pun di sini.
 *
 * Pola implementasi (lihat docs/ARCHITECTURE.md):
 *   VALIDATION → BUSINESS LOGIC → DATABASE SERVICE → GOOGLE SPREADSHEET
 *
 * Domain ini TIDAK memanggil SpreadsheetApp secara langsung — seluruh
 * akses data melalui core/DatabaseService.gs (lihat docs/ARCHITECTURE.md
 * bagian 4, Aturan Akses Database).
 *
 * Soft delete: penonaktifan pengguna menggunakan kolom is_active, TIDAK
 * PERNAH menghapus baris (hard delete).
 *
 * Kesiapan Audit: createUser/updateUser/deactivateUser mengembalikan
 * objek baris lengkap (state akhir) agar mudah diteruskan ke Audit
 * Service pada tahap berikutnya (belum diimplementasikan pada fase ini).
 *
 * Dependency:
 * - core/Config.gs (CONFIG.SHEETS.USERS, CONFIG.SEQUENCES.USER,
 *   CONFIG.ID_PREFIXES.USER, CONFIG.ROLES)
 * - core/DatabaseService.gs (getAllRows, getRowById, findRows, insertRow,
 *   updateRowById)
 * - core/SequenceService.gs (generateEntityId)
 * - core/UtilityService.gs (isEmpty, isValidEmail, normalizeText, nowTimestamp)
 *
 * Referensi: docs/DATABASE_SCHEMA.md (01_users)
 */

/**
 * Membuat pengguna baru.
 *
 * Validasi:
 * - email wajib diisi, format valid, dan unik (tidak boleh sama dengan
 *   email pengguna lain, baik aktif maupun tidak aktif).
 * - full_name wajib diisi.
 * - role wajib diisi dan harus salah satu nilai kanonik pada CONFIG.ROLES.
 *
 * @param {Object} userData Data pengguna baru.
 * @param {string} userData.email Alamat email (identitas login), wajib.
 * @param {string} userData.full_name Nama lengkap, wajib.
 * @param {string} userData.role Peran pengguna, wajib salah satu CONFIG.ROLES.
 * @param {string} [userData.student_id] Nomor induk siswa (opsional).
 * @param {string} [userData.class_name] Nama kelas (opsional).
 * @param {string} [userData.owner_id] Referensi ke 05_owners (opsional).
 * @return {Object} Baris pengguna yang berhasil dibuat.
 * @throws {Error} Jika validasi gagal.
 */
function createUser(userData) {
  if (!userData || typeof userData !== 'object') {
    throw new Error('UserService.createUser: "userData" wajib diisi dan bertipe object.');
  }
  if (isEmpty(userData.email)) {
    throw new Error('UserService.createUser: "email" wajib diisi.');
  }
  if (!isValidEmail(userData.email)) {
    throw new Error('UserService.createUser: "email" tidak valid: "' + userData.email + '".');
  }
  if (userIsEmailTaken_(userData.email, null)) {
    throw new Error('UserService.createUser: "email" sudah digunakan pengguna lain: "' + userData.email + '".');
  }
  if (isEmpty(userData.full_name)) {
    throw new Error('UserService.createUser: "full_name" wajib diisi.');
  }
  userValidateRole_(userData.role);

  var timestamp = nowTimestamp();
  var newUser = {
    user_id: generateEntityId(CONFIG.ID_PREFIXES.USER, CONFIG.SEQUENCES.USER),
    email: userData.email.trim(),
    full_name: userData.full_name.trim(),
    role: userData.role,
    student_id: userData.student_id || '',
    class_name: userData.class_name || '',
    owner_id: userData.owner_id || '',
    is_active: true,
    created_at: timestamp,
    updated_at: timestamp
  };

  return insertRow(CONFIG.SHEETS.USERS, newUser);
}

/**
 * Mengambil satu pengguna berdasarkan user_id.
 *
 * @param {string} userId ID pengguna.
 * @return {Object|null} Baris pengguna, atau null jika tidak ditemukan.
 * @throws {Error} Jika userId kosong.
 */
function getUserById(userId) {
  if (isEmpty(userId)) {
    throw new Error('UserService.getUserById: "userId" wajib diisi.');
  }
  return getRowById(CONFIG.SHEETS.USERS, 'user_id', userId);
}

/**
 * Mengambil satu pengguna berdasarkan email (tanpa mempermasalahkan huruf
 * besar/kecil atau spasi — sama seperti pemeriksaan duplikasi email pada
 * createUser()/updateUser()). Dipakai oleh apps-script/api/ untuk
 * mengidentifikasi pengguna dari sesi Google aktif (lihat
 * apps-script/api/AuthContext.gs) — BUKAN autentikasi, hanya pencocokan
 * data pengguna yang sudah terdaftar.
 *
 * @param {string} email Alamat email yang dicari.
 * @return {Object|null} Baris pengguna (aktif maupun tidak aktif), atau
 *   null jika tidak ada pengguna dengan email tersebut.
 * @throws {Error} Jika email kosong.
 */
function getUserByEmail(email) {
  if (isEmpty(email)) {
    throw new Error('UserService.getUserByEmail: "email" wajib diisi.');
  }
  var normalizedEmail = normalizeText(email);
  var matches = findRows(CONFIG.SHEETS.USERS, function (row) {
    return normalizeText(row.email) === normalizedEmail;
  });
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Mengambil seluruh pengguna yang berstatus aktif.
 *
 * @return {Array<Object>} Daftar pengguna aktif.
 */
function listActiveUsers() {
  return findRows(CONFIG.SHEETS.USERS, function (row) {
    return row.is_active === true;
  });
}

/**
 * Memperbarui data pengguna. is_active TIDAK dapat diubah lewat fungsi
 * ini — gunakan deactivateUser() untuk menonaktifkan pengguna.
 *
 * @param {string} userId ID pengguna yang diperbarui.
 * @param {Object} updates Kolom yang ingin diperbarui.
 * @return {Object} Baris pengguna setelah diperbarui.
 * @throws {Error} Jika validasi gagal atau pengguna tidak ditemukan.
 */
function updateUser(userId, updates) {
  if (isEmpty(userId)) {
    throw new Error('UserService.updateUser: "userId" wajib diisi.');
  }
  if (!updates || typeof updates !== 'object') {
    throw new Error('UserService.updateUser: "updates" wajib diisi dan bertipe object.');
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'is_active')) {
    throw new Error('UserService.updateUser: "is_active" tidak dapat diubah lewat updateUser(). Gunakan deactivateUser().');
  }

  var patch = {};

  if (Object.prototype.hasOwnProperty.call(updates, 'email')) {
    if (isEmpty(updates.email)) {
      throw new Error('UserService.updateUser: "email" tidak boleh dikosongkan.');
    }
    if (!isValidEmail(updates.email)) {
      throw new Error('UserService.updateUser: "email" tidak valid: "' + updates.email + '".');
    }
    if (userIsEmailTaken_(updates.email, userId)) {
      throw new Error('UserService.updateUser: "email" sudah digunakan pengguna lain: "' + updates.email + '".');
    }
    patch.email = updates.email.trim();
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'full_name')) {
    if (isEmpty(updates.full_name)) {
      throw new Error('UserService.updateUser: "full_name" tidak boleh dikosongkan.');
    }
    patch.full_name = updates.full_name.trim();
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'role')) {
    userValidateRole_(updates.role);
    patch.role = updates.role;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'student_id')) {
    patch.student_id = updates.student_id || '';
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'class_name')) {
    patch.class_name = updates.class_name || '';
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'owner_id')) {
    patch.owner_id = updates.owner_id || '';
  }

  patch.updated_at = nowTimestamp();

  return updateRowById(CONFIG.SHEETS.USERS, 'user_id', userId, patch);
}

/**
 * Menonaktifkan pengguna (soft delete). Tidak menghapus baris data.
 *
 * @param {string} userId ID pengguna yang dinonaktifkan.
 * @return {Object} Baris pengguna setelah dinonaktifkan.
 * @throws {Error} Jika userId kosong atau pengguna tidak ditemukan.
 */
function deactivateUser(userId) {
  if (isEmpty(userId)) {
    throw new Error('UserService.deactivateUser: "userId" wajib diisi.');
  }
  return updateRowById(CONFIG.SHEETS.USERS, 'user_id', userId, {
    is_active: false,
    updated_at: nowTimestamp()
  });
}

/**
 * Memvalidasi bahwa role berada pada daftar kanonik CONFIG.ROLES.
 * @param {string} role Nilai role yang diperiksa.
 * @throws {Error} Jika role kosong atau tidak dikenal sistem.
 * @private
 */
function userValidateRole_(role) {
  if (isEmpty(role)) {
    throw new Error('UserService: "role" wajib diisi.');
  }
  var validRoles = Object.keys(CONFIG.ROLES).map(function (key) { return CONFIG.ROLES[key]; });
  if (validRoles.indexOf(role) === -1) {
    throw new Error(
      'UserService: "role" tidak dikenal sistem: "' + role + '". Role yang valid: ' + validRoles.join(', ') + '.'
    );
  }
}

/**
 * Memeriksa apakah suatu email sudah dipakai pengguna lain (aktif maupun
 * tidak aktif), dengan perbandingan tanpa mempermasalahkan huruf
 * besar/kecil atau spasi.
 *
 * @param {string} email Email yang diperiksa.
 * @param {?string} excludeUserId user_id yang dikecualikan dari
 *   pemeriksaan (dipakai saat update agar user tidak dianggap bentrok
 *   dengan emailnya sendiri). Null saat pemeriksaan untuk user baru.
 * @return {boolean} true jika email sudah dipakai pengguna lain.
 * @private
 */
function userIsEmailTaken_(email, excludeUserId) {
  var normalizedEmail = normalizeText(email);
  var matches = findRows(CONFIG.SHEETS.USERS, function (row) {
    if (excludeUserId && row.user_id === excludeUserId) {
      return false;
    }
    return normalizeText(row.email) === normalizedEmail;
  });
  return matches.length > 0;
}
