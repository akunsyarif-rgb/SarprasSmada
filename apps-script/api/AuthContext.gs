/**
 * AuthContext.gs
 *
 * Identifikasi pengguna pemanggil Web App berdasarkan TOKEN SESI (lihat
 * apps-script/auth/AuthService.gs) dan pemeriksaan peran (role).
 *
 * ================================================================
 * PERUBAHAN ARSITEKTUR — dari Google SSO ke token sesi
 * ================================================================
 * Versi sebelumnya modul ini (PHASE 4.5 — MVP Usability) mengidentifikasi
 * pemanggil lewat `Session.getActiveUser()` (sesi Google Workspace aktif),
 * yang HANYA bekerja ketika HTML disajikan langsung oleh Apps Script sendiri
 * (`HtmlService`, `google.script.run`). Sejak frontend dipindah ke hosting
 * terpisah (`frontend/`) yang memanggil Web App lewat `fetch()` cross-origin
 * (lihat `apps-script/api/App.gs`), pengguna diidentifikasi dari TOKEN SESI
 * yang dikirim client (hasil `AuthService.login()`), bukan lagi dari sesi
 * Google — lihat `apps-script/auth/AuthService.gs` dan
 * `apps-script/appsscript.json` (`webapp.executeAs`/`webapp.access`).
 *
 * ================================================================
 * OPEN DESIGN DECISION — Authorization MINIMAL, BUKAN RBAC penuh
 * ================================================================
 * Sama seperti versi sebelumnya: perubahan status laporan (changeReportStatus)
 * dan penonaktifan laporan (deactivateReport) HANYA dapat dipicu oleh
 * pengguna berperan VERIFIKATOR, OWNER, atau ADMIN — TIDAK dibedakan lebih
 * lanjut per jenis transisi. RBAC penuh per transisi/per peran tetap
 * dijadwalkan PHASE 5 sesuai docs/WORKFLOW.md dan docs/DEVELOPMENT_ROADMAP.md.
 *
 * Dependency:
 * - core/UtilityService.gs (isEmpty)
 * - apps-script/auth/AuthService.gs (getSessionUser)
 *
 * Referensi: docs/ARCHITECTURE.md (bagian 2, REPORT MANAGEMENT — Authorization)
 */

/**
 * Peran yang diperbolehkan memicu perubahan status/penonaktifan laporan
 * (lihat catatan OPEN DESIGN DECISION di header file ini).
 *
 * Sengaja berupa FUNGSI (bukan top-level var) agar tidak bergantung pada
 * urutan file dimuat Google Apps Script.
 *
 * @return {Array<string>} Daftar CONFIG.ROLES yang diizinkan.
 */
function getWorkflowAllowedRoles_() {
  return [CONFIG.ROLES.VERIFIKATOR, CONFIG.ROLES.OWNER, CONFIG.ROLES.ADMIN];
}

/**
 * Mengidentifikasi pengguna SIGAP SARPRAS pemilik suatu token sesi.
 *
 * @param {string} token Token sesi (hasil AuthService.login()).
 * @return {Object} Data pengguna (tersanitasi, tanpa password_hash/password_salt).
 * @throws {Error} Jika token kosong, tidak valid, atau sudah kedaluwarsa.
 */
function requireSession_(token) {
  if (isEmpty(token)) {
    throw new Error('AuthContext.requireSession_: Token sesi wajib disertakan. Silakan login.');
  }
  var user = getSessionUser(token);
  if (!user) {
    throw new Error('AuthContext.requireSession_: Sesi tidak valid atau sudah berakhir. Silakan login kembali.');
  }
  return user;
}

/**
 * Memastikan userContext memiliki salah satu peran yang diizinkan.
 *
 * @param {Object} userContext Baris pengguna (hasil requireSession_()).
 * @param {Array<string>} allowedRoles Daftar CONFIG.ROLES yang diizinkan.
 * @throws {Error} Jika peran pengguna tidak termasuk allowedRoles.
 */
function requireRole_(userContext, allowedRoles) {
  if (allowedRoles.indexOf(userContext.role) === -1) {
    throw new Error(
      'AuthContext.requireRole_: Peran "' + userContext.role + '" tidak diizinkan melakukan aksi ini. ' +
      'Peran yang diizinkan: ' + allowedRoles.join(', ') + '.'
    );
  }
}
