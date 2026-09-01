/**
 * config.js
 *
 * Titik konfigurasi tunggal untuk frontend SIGAP SARPRAS — meniru pola yang
 * sama persis dengan aplikasi SIGAP (`Sigap-app`, TIDAK diubah oleh
 * perubahan ini): `API_URL`/`API_TOKEN` dikirim dari SETIAP client, tidak
 * ada cara menyembunyikannya sungguh-sungguh pada aplikasi statis tanpa
 * bundler seperti ini — keamanan sesungguhnya ada di sisi server
 * (apps-script/api/AuthContext.gs + apps-script/auth/AuthService.gs), bukan
 * di token ini. Lihat catatan di apps-script/core/Config.gs getApiToken().
 *
 * WAJIB diisi sebelum aplikasi bisa dipakai:
 * - API_URL: URL Web App hasil deploy (`clasp deploy` / Deploy > Manage
 *   deployments di editor Apps Script), lihat docs/GAS_CLASP_DEPLOY.md.
 * - API_TOKEN: SAMA PERSIS dengan Script Property `API_TOKEN` pada project
 *   Apps Script (lihat docs/DATABASE_SETUP.md bagian 10).
 */

var CONFIG = {
  API_URL: 'PASTE_WEB_APP_URL_DI_SINI',
  API_TOKEN: 'PASTE_API_TOKEN_DI_SINI',

  /** Nilai kanonik role — WAJIB sinkron dengan CONFIG.ROLES di apps-script/core/Config.gs. */
  ROLES: {
    SISWA: 'SISWA',
    GURU: 'GURU',
    STAF: 'STAF',
    VERIFIKATOR: 'VERIFIKATOR',
    OWNER: 'OWNER',
    ADMIN: 'ADMIN'
  },

  /** Label tampilan per role, untuk UI. */
  ROLE_LABELS: {
    SISWA: 'Siswa',
    GURU: 'Guru',
    STAF: 'Staf',
    VERIFIKATOR: 'Verifikator',
    OWNER: 'Penanggung Jawab (Owner)',
    ADMIN: 'Admin'
  },

  /** Nilai kanonik status laporan — WAJIB sinkron dengan CONFIG.REPORT_STATUS di apps-script/core/Config.gs. */
  REPORT_STATUS: {
    SUBMITTED: 'SUBMITTED',
    VERIFIED: 'VERIFIED',
    ASSIGNED: 'ASSIGNED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CLOSED: 'CLOSED'
  },

  /** Label tampilan per status laporan, urut sesuai alur docs/WORKFLOW.md. */
  REPORT_STATUS_LABELS: {
    SUBMITTED: 'Baru Dilaporkan',
    VERIFIED: 'Terverifikasi',
    ASSIGNED: 'Ditugaskan',
    IN_PROGRESS: 'Dalam Penanganan',
    COMPLETED: 'Selesai Dikerjakan',
    CLOSED: 'Ditutup'
  },

  /** Peran yang boleh mengubah status/menonaktifkan laporan — WAJIB sinkron dengan getWorkflowAllowedRoles_() di apps-script/api/AuthContext.gs. */
  WORKFLOW_ROLES: ['VERIFIKATOR', 'OWNER', 'ADMIN'],

  /** Key localStorage penyimpan sesi. */
  SESSION_STORAGE_KEY: 'sarpras_session'
};
