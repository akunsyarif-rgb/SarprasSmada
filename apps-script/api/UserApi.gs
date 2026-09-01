/**
 * UserApi.gs
 *
 * Fungsi PUBLIK lapisan API untuk manajemen data pengguna (01_users),
 * dipanggil dari apps-script/api/App.gs. Tidak ada logika bisnis di sini —
 * hanya identifikasi/otorisasi pemanggil + pass-through ke
 * apps-script/users/UserService.gs + pembungkusan response.
 *
 * SELURUH fungsi di sini HANYA dapat dipanggil oleh ADMIN — data pengguna
 * (termasuk email/role setiap warga sekolah) tidak ditampilkan ke peran
 * lain. Pengecualian: apiGetCurrentUser (AuthApi.gs) yang hanya
 * mengembalikan data pengguna itu sendiri, bukan daftar seluruh pengguna.
 *
 * setPassword (AuthApi.gs) TIDAK ada di sini secara sengaja — tetap satu
 * pintu di apps-script/auth/AuthService.gs supaya password tidak pernah
 * lewat jalur lain.
 *
 * Dependency:
 * - core/Config.gs (CONFIG.ROLES)
 * - apps-script/api/AuthContext.gs (requireSession_, requireRole_)
 * - apps-script/api/ApiUtil.gs (apiRun_)
 * - apps-script/users/UserService.gs (createUser, updateUser, deactivateUser, listActiveUsers)
 */

/**
 * Mengambil daftar seluruh pengguna aktif. ADMIN saja.
 * @param {string} token Token sesi.
 * @return {{success: boolean, data: *, error: ?Object}}
 */
function apiListUsers(token) {
  return apiRun_(function () {
    var user = requireSession_(token);
    requireRole_(user, [CONFIG.ROLES.ADMIN]);
    return listActiveUsers();
  });
}

/**
 * Membuat pengguna baru. ADMIN saja. Pengguna baru TIDAK memiliki password
 * — panggil apiSetPassword (AuthApi.gs) secara terpisah setelah ini untuk
 * menetapkan password awal.
 * @param {string} token Token sesi.
 * @param {Object} payload Lihat UserService.createUser.
 * @return {{success: boolean, data: *, error: ?Object}}
 */
function apiCreateUser(token, payload) {
  return apiRun_(function () {
    var user = requireSession_(token);
    requireRole_(user, [CONFIG.ROLES.ADMIN]);
    return createUser(payload || {});
  });
}

/**
 * Memperbarui data pengguna (bukan password/is_active). ADMIN saja.
 * @param {string} token Token sesi.
 * @param {string} userId user_id target.
 * @param {Object} updates Lihat UserService.updateUser.
 * @return {{success: boolean, data: *, error: ?Object}}
 */
function apiUpdateUser(token, userId, updates) {
  return apiRun_(function () {
    var user = requireSession_(token);
    requireRole_(user, [CONFIG.ROLES.ADMIN]);
    return updateUser(userId, updates || {});
  });
}

/**
 * Menonaktifkan pengguna (soft delete). ADMIN saja.
 * @param {string} token Token sesi.
 * @param {string} userId user_id target.
 * @return {{success: boolean, data: *, error: ?Object}}
 */
function apiDeactivateUser(token, userId) {
  return apiRun_(function () {
    var user = requireSession_(token);
    requireRole_(user, [CONFIG.ROLES.ADMIN]);
    return deactivateUser(userId);
  });
}
