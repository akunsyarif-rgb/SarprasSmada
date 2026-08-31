/**
 * AuthContext.gs
 *
 * Identifikasi pengguna pemanggil Web App berdasarkan sesi Google aktif,
 * dan pemeriksaan peran (role) MINIMAL untuk aksi yang sensitif. Ini
 * BUKAN sistem autentikasi (tidak ada password/credential apa pun di
 * sini — SIGAP SARPRAS mengandalkan sesi Google Workspace yang sudah ada,
 * lihat apps-script/appsscript.json "webapp.executeAs": "USER_ACCESSING").
 *
 * ================================================================
 * OPEN DESIGN DECISION — Authorization MINIMAL, BUKAN RBAC penuh
 * ================================================================
 * MVP ini hanya menerapkan SATU aturan kasar (coarse-grained), diambil
 * langsung dari contoh yang SUDAH ADA di docs/ARCHITECTURE.md bagian 2
 * REPORT MANAGEMENT ("mis. hanya verifikator yang dapat mengubah status
 * ke VERIFIED"): perubahan status laporan (changeReportStatus) dan
 * penonaktifan laporan (deactivateReport) HANYA dapat dipicu oleh
 * pengguna berperan VERIFIKATOR, OWNER, atau ADMIN — TIDAK dibedakan
 * lebih lanjut per jenis transisi (mis. tidak ada aturan "hanya OWNER
 * terkait yang dapat mengubah ke IN_PROGRESS"), karena aturan sedetail
 * itu belum ditemukan didokumentasikan di mana pun. RBAC penuh per
 * transisi/per peran tetap dijadwalkan PHASE 5 sesuai
 * docs/WORKFLOW.md dan docs/DEVELOPMENT_ROADMAP.md.
 *
 * Dependency:
 * - core/UtilityService.gs (isEmpty)
 * - apps-script/users/UserService.gs (getUserByEmail)
 * - Google Apps Script bawaan: Session
 *
 * Referensi: docs/ARCHITECTURE.md (bagian 2, REPORT MANAGEMENT — Authorization)
 */

/**
 * Peran yang diperbolehkan memicu perubahan status/penonaktifan laporan
 * (lihat catatan OPEN DESIGN DECISION di header file ini).
 *
 * Sengaja berupa FUNGSI (bukan top-level var) agar tidak bergantung pada
 * urutan file dimuat Google Apps Script (semua file digabung dan kode
 * top-level dijalankan sesuai urutan pada project — jika ini top-level var
 * dan file ini dimuat sebelum core/Config.gs, CONFIG belum terdefinisi).
 *
 * @return {Array<string>} Daftar CONFIG.ROLES yang diizinkan.
 * @private
 */
function getWorkflowAllowedRoles_() {
  return [CONFIG.ROLES.VERIFIKATOR, CONFIG.ROLES.OWNER, CONFIG.ROLES.ADMIN];
}

/**
 * Mengidentifikasi pengguna SIGAP SARPRAS yang sedang memanggil Web App,
 * berdasarkan email sesi Google aktif (Session.getActiveUser().getEmail()).
 * Pengguna WAJIB sudah terdaftar (01_users) dan berstatus aktif — tidak
 * ada pendaftaran otomatis/self-service di sini.
 *
 * @return {Object} Baris pengguna (01_users) milik pemanggil.
 * @throws {Error} Jika sesi Google tidak dapat diidentifikasi (mis. akses
 *   anonim/di luar domain yang diizinkan — lihat appsscript.json
 *   "webapp.access"), atau email tersebut belum terdaftar/tidak aktif
 *   pada 01_users.
 */
function getCurrentUserContext_() {
  var email = Session.getActiveUser().getEmail();
  if (isEmpty(email)) {
    throw new Error(
      'AuthContext.getCurrentUserContext_: Tidak dapat mengidentifikasi email pengguna dari sesi Google aktif. ' +
      'Pastikan Web App diakses dalam keadaan login Google Workspace yang sesuai (lihat appsscript.json "webapp.access").'
    );
  }

  var user = getUserByEmail(email);
  if (!user) {
    throw new Error(
      'AuthContext.getCurrentUserContext_: Email "' + email + '" belum terdaftar sebagai pengguna SIGAP SARPRAS. ' +
      'Hubungi admin untuk didaftarkan terlebih dahulu.'
    );
  }
  if (user.is_active !== true) {
    throw new Error('AuthContext.getCurrentUserContext_: Akun pengguna "' + email + '" tidak aktif.');
  }

  return user;
}

/**
 * Memastikan userContext memiliki salah satu peran yang diizinkan.
 *
 * @param {Object} userContext Baris pengguna (hasil getCurrentUserContext_()).
 * @param {Array<string>} allowedRoles Daftar CONFIG.ROLES yang diizinkan.
 * @throws {Error} Jika peran pengguna tidak termasuk allowedRoles.
 * @private
 */
function requireRole_(userContext, allowedRoles) {
  if (allowedRoles.indexOf(userContext.role) === -1) {
    throw new Error(
      'AuthContext.requireRole_: Peran "' + userContext.role + '" tidak diizinkan melakukan aksi ini. ' +
      'Peran yang diizinkan: ' + allowedRoles.join(', ') + '.'
    );
  }
}
