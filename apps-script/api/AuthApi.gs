/**
 * AuthApi.gs
 *
 * Fungsi PUBLIK lapisan API untuk login/logout/manajemen password, dipanggil
 * dari apps-script/api/App.gs (doGet/doPost JSON router). Sama seperti
 * ReportApi.gs/MasterDataApi.gs — tidak ada logika bisnis di sini, hanya:
 * (1) identifikasi/otorisasi pemanggil lewat AuthContext.gs (untuk fungsi
 * yang butuh sesi), (2) meneruskan ke apps-script/auth/AuthService.gs, (3)
 * membungkus hasil/error lewat ApiUtil.gs.
 *
 * apiLogin TIDAK memerlukan token sesi (memang belum ada sesi) — hanya
 * token API statis yang sudah diperiksa lebih dulu oleh App.gs checkToken_()
 * sebelum fungsi ini dipanggil.
 *
 * Dependency:
 * - apps-script/api/AuthContext.gs (requireSession_, requireRole_)
 * - apps-script/api/ApiUtil.gs (apiRun_)
 * - apps-script/auth/AuthService.gs (login, logout, changePassword, setPassword)
 * - core/Config.gs (CONFIG.ROLES)
 */

/**
 * Login dengan email + password.
 * @param {string} email
 * @param {string} password
 * @return {{success: boolean, data: *, error: ?Object}} data berisi {token, expiresAt, user}.
 */
function apiLogin(email, password) {
  return apiRun_(function () {
    return login(email, password);
  });
}

/**
 * Logout — mengakhiri sesi milik token yang dikirim.
 * @param {string} token Token sesi yang diakhiri.
 * @return {{success: boolean, data: *, error: ?Object}}
 */
function apiLogout(token) {
  return apiRun_(function () {
    logout(token);
    return null;
  });
}

/**
 * Mengembalikan data pengguna yang sedang login (untuk ditampilkan di UI
 * dan menentukan kontrol mana yang ditampilkan).
 * @param {string} token Token sesi.
 * @return {{success: boolean, data: *, error: ?Object}}
 */
function apiGetCurrentUser(token) {
  return apiRun_(function () {
    var user = requireSession_(token);
    return {
      user_id: user.user_id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      owner_id: user.owner_id || '',
      can_manage_workflow: getWorkflowAllowedRoles_().indexOf(user.role) !== -1,
      is_admin: user.role === CONFIG.ROLES.ADMIN
    };
  });
}

/**
 * Mengganti password milik pengguna yang sedang login sendiri.
 * @param {string} token Token sesi.
 * @param {string} oldPassword Password lama.
 * @param {string} newPassword Password baru.
 * @return {{success: boolean, data: *, error: ?Object}}
 */
function apiChangePassword(token, oldPassword, newPassword) {
  return apiRun_(function () {
    var user = requireSession_(token);
    return changePassword(user.user_id, oldPassword, newPassword);
  });
}

/**
 * Menetapkan/mereset password milik pengguna lain. HANYA dapat dipanggil
 * oleh ADMIN — tidak memerlukan password lama (dipakai untuk bootstrap
 * akun baru maupun reset ketika pengguna lupa password).
 * @param {string} token Token sesi (milik admin yang melakukan aksi).
 * @param {string} userId user_id target.
 * @param {string} newPassword Password baru.
 * @return {{success: boolean, data: *, error: ?Object}}
 */
function apiSetPassword(token, userId, newPassword) {
  return apiRun_(function () {
    var user = requireSession_(token);
    requireRole_(user, [CONFIG.ROLES.ADMIN]);
    return setPassword(userId, newPassword);
  });
}
