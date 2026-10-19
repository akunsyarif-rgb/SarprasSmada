// Konstanta bersama — WAJIB sinkron dengan docs/APPWRITE_SCHEMA.md dan frontend/config.js.

export const DATABASE_ID = 'presensi';

export const TABLES = {
  USERS: 'sarpras_users_profile',
  LOCATIONS: 'sarpras_locations',
  CATEGORIES: 'sarpras_categories',
  FACILITIES: 'sarpras_facilities',
  OWNERS: 'sarpras_owners',
  REPORTS: 'sarpras_reports',
  HISTORY: 'sarpras_report_history',
  SEQUENCES: 'sarpras_sequences',
  AUDIT: 'sarpras_audit_logs'
};

/** Role kanonik → label Appwrite (alfanumerik saja). */
export const ROLE_LABELS = {
  SISWA: 'sarprassiswa',
  GURU: 'sarprasguru',
  STAF: 'sarprasstaf',
  VERIFIKATOR: 'sarprasverifikator',
  OWNER: 'sarprasowner',
  ADMIN: 'sarprasadmin'
};

export const LABEL_PREFIX = 'sarpras';

/** Peran yang boleh melihat semua laporan dan mengubah status (sama dengan getWorkflowAllowedRoles_ lama). */
export const STAFF_ROLES = ['VERIFIKATOR', 'OWNER', 'ADMIN'];

export const REPORT_STATUS = ['SUBMITTED', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'];

export const TRANSITIONS = {
  SUBMITTED: ['VERIFIED'],
  VERIFIED: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: ['CLOSED'],
  CLOSED: []
};

export const STATUS_TIMESTAMP_COLUMN = {
  VERIFIED: 'verified_at',
  ASSIGNED: 'assigned_at',
  IN_PROGRESS: 'started_at',
  COMPLETED: 'completed_at',
  CLOSED: 'closed_at'
};

export const IMPACT_LEVELS = ['RENDAH', 'SEDANG', 'TINGGI'];
export const SAFETY_RISKS = ['YA', 'TIDAK'];

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

/** Zona waktu sekolah (Asia/Makassar, UTC+8) untuk tahun pada nomor laporan. */
export const TZ_OFFSET_HOURS = 8;
