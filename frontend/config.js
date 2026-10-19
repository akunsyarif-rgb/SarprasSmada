/**
 * config.js
 *
 * Titik konfigurasi tunggal frontend SIGAP SARPRAS. Backend: Appwrite Cloud
 * (project PRESENSI, region Singapura) — lihat docs/APPWRITE_SCHEMA.md.
 *
 * Nilai di bawah BUKAN rahasia (endpoint & ID project memang publik di setiap
 * aplikasi Appwrite). Keamanan ada di izin tabel/baris Appwrite dan di
 * Function `sarpras-api`, bukan di sini. Domain tempat frontend ini di-hosting
 * WAJIB didaftarkan sebagai platform Web di project Appwrite, kalau tidak
 * browser akan memblokir request (CORS).
 */

var CONFIG = {
  APPWRITE: {
    ENDPOINT: 'https://sgp.cloud.appwrite.io/v1',
    PROJECT_ID: '6ace48710006ad3f6b31',
    DATABASE_ID: 'presensi',
    FUNCTION_ID: 'sarpras-api',
    TABLES: {
      USERS: 'sarpras_users_profile',
      LOCATIONS: 'sarpras_locations',
      CATEGORIES: 'sarpras_categories',
      FACILITIES: 'sarpras_facilities',
      OWNERS: 'sarpras_owners',
      REPORTS: 'sarpras_reports',
      HISTORY: 'sarpras_report_history'
    }
  },

  /** Label Appwrite -> role. WAJIB sinkron dengan ROLE_LABELS di functions/sarpras-api/src/lib/config.js. */
  LABEL_TO_ROLE: {
    sarprassiswa: 'SISWA',
    sarprasguru: 'GURU',
    sarprasstaf: 'STAF',
    sarprasverifikator: 'VERIFIKATOR',
    sarprasowner: 'OWNER',
    sarprasadmin: 'ADMIN'
  },

  /** Batas baris per daftar (belum ada paginasi). */
  LIST_LIMIT: 500,

  /** Nilai kanonik role — WAJIB sinkron dengan CONFIG.ROLES di functions/sarpras-api/src/lib/config.js. */
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

  /** Nilai kanonik status laporan — WAJIB sinkron dengan CONFIG.REPORT_STATUS di functions/sarpras-api/src/lib/config.js. */
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

  /** Peran yang boleh mengubah status/menonaktifkan laporan — WAJIB sinkron dengan STAFF_ROLES di functions/sarpras-api/src/lib/config.js. */
  WORKFLOW_ROLES: ['VERIFIKATOR', 'OWNER', 'ADMIN']
};
