// Logika murni (tanpa I/O) — diuji di test/rules.test.js.
import {
  ROLE_LABELS, LABEL_PREFIX, STAFF_ROLES, TRANSITIONS, IMPACT_LEVELS, SAFETY_RISKS,
  MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, TZ_OFFSET_HOURS
} from './config.js';
import { badRequest } from './errors.js';

/** Role dari label user; null bila tidak persis satu label sarpras*. */
export function roleFromLabels(labels) {
  const found = Object.keys(ROLE_LABELS).filter((role) => (labels || []).includes(ROLE_LABELS[role]));
  return found.length === 1 ? found[0] : null;
}

/** Ganti label sarpras* dengan label role baru, label lain (mis. "guru" presensi) dipertahankan. */
export function labelsWithRole(existingLabels, role) {
  const kept = (existingLabels || []).filter((l) => !l.startsWith(LABEL_PREFIX));
  return [...kept, ROLE_LABELS[role]];
}

export const isStaff = (caller) => STAFF_ROLES.includes(caller.role);

export function canAccessReport(caller, report) {
  return isStaff(caller) || report.reporter_id === caller.id;
}

export function str(value, label, { max, required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`"${label}" wajib diisi.`);
    return '';
  }
  if (typeof value !== 'string') throw badRequest(`"${label}" harus berupa teks.`);
  const trimmed = value.trim();
  if (required && trimmed === '') throw badRequest(`"${label}" wajib diisi.`);
  if (max && trimmed.length > max) throw badRequest(`"${label}" maksimal ${max} karakter.`);
  return trimmed;
}

function oneOf(value, allowed, label) {
  if (value === '' || value === undefined || value === null) return '';
  if (!allowed.includes(value)) throw badRequest(`"${label}" harus salah satu dari: ${allowed.join(', ')}.`);
  return value;
}

/** Validasi input pembuatan laporan → data bersih (tanpa field sistem). */
export function validateNewReport(input) {
  const i = input || {};
  return {
    location_id: str(i.location_id, 'location_id', { max: 36, required: true }),
    category_id: str(i.category_id, 'category_id', { max: 36, required: true }),
    facility_id: str(i.facility_id, 'facility_id', { max: 36 }),
    owner_id: str(i.owner_id, 'owner_id', { max: 36 }),
    condition: str(i.condition, 'condition', { max: 200 }),
    description: str(i.description, 'description', { max: 2000, required: true }),
    impact_level: oneOf(i.impact_level, IMPACT_LEVELS, 'impact_level'),
    safety_risk: oneOf(i.safety_risk, SAFETY_RISKS, 'safety_risk')
  };
}

const COMMON_UPDATABLE = [
  'location_id', 'category_id', 'facility_id', 'condition', 'description', 'impact_level', 'safety_risk'
];
const STAFF_ONLY_UPDATABLE = ['owner_id', 'duplicate_of_report_id', 'priority', 'priority_override_reason'];

/**
 * Validasi patch updateReport. Pelapor biasa hanya boleh kolom umum dan hanya
 * saat status SUBMITTED; staf boleh kolom tambahan kapan pun.
 */
export function validateReportUpdate(caller, report, updates) {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw badRequest('"updates" wajib berupa object.');
  }
  const staff = isStaff(caller);
  if (!staff && report.status !== 'SUBMITTED') {
    throw badRequest('Laporan yang sudah diproses tidak dapat diubah oleh pelapor.');
  }
  const allowed = staff ? [...COMMON_UPDATABLE, ...STAFF_ONLY_UPDATABLE] : COMMON_UPDATABLE;
  const patch = {};
  for (const key of Object.keys(updates)) {
    if (!allowed.includes(key)) throw badRequest(`Kolom "${key}" tidak dapat diubah lewat updateReport.`);
  }
  const lengths = {
    location_id: 36, category_id: 36, facility_id: 36, owner_id: 36, duplicate_of_report_id: 36,
    condition: 200, description: 2000, priority: 20, priority_override_reason: 300
  };
  for (const key of Object.keys(updates)) {
    if (key === 'impact_level') patch[key] = oneOf(updates[key], IMPACT_LEVELS, key);
    else if (key === 'safety_risk') patch[key] = oneOf(updates[key], SAFETY_RISKS, key);
    else patch[key] = str(updates[key], key, { max: lengths[key], required: key === 'description' || key === 'location_id' || key === 'category_id' });
  }
  return patch;
}

/** Validasi transisi status; mengembalikan nama kolom timestamp yang harus diisi. */
export function validateTransition(currentStatus, newStatus) {
  const allowed = TRANSITIONS[currentStatus];
  if (!allowed) throw badRequest(`Status laporan saat ini tidak dikenal: "${currentStatus}".`);
  if (!allowed.includes(newStatus)) {
    throw badRequest(
      `Transisi status ilegal: "${currentStatus}" -> "${newStatus}". Yang diperbolehkan dari "${currentStatus}": ` +
      `${allowed.length ? allowed.join(', ') : '(tidak ada, status akhir)'}.`
    );
  }
}

/** Nomor laporan "SRP-YYYY-000001"; tahun menurut zona waktu sekolah. */
export function formatReportNumber(sequenceValue, now) {
  const year = new Date(now.getTime() + TZ_OFFSET_HOURS * 3600 * 1000).getUTCFullYear();
  return `SRP-${year}-${String(sequenceValue).padStart(6, '0')}`;
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password === '') throw badRequest('Password wajib diisi.');
  if (password.length < MIN_PASSWORD_LENGTH) throw badRequest(`Password minimal ${MIN_PASSWORD_LENGTH} karakter.`);
  if (password.length > MAX_PASSWORD_LENGTH) throw badRequest(`Password maksimal ${MAX_PASSWORD_LENGTH} karakter.`);
  return password;
}

export function validateRole(role) {
  if (!Object.keys(ROLE_LABELS).includes(role)) {
    throw badRequest(`"role" tidak dikenal. Role valid: ${Object.keys(ROLE_LABELS).join(', ')}.`);
  }
  return role;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validateEmail(email) {
  const e = str(email, 'email', { max: 254, required: true }).toLowerCase();
  if (!EMAIL_RE.test(e)) throw badRequest(`"email" tidak valid: "${e}".`);
  return e;
}

/** Validasi data profil pengguna (create & update). Hanya key yang ada yang diproses. */
export function validateProfileFields(input, { partial }) {
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(input, k);
  if (!partial || has('email')) out.email = validateEmail(input.email);
  if (!partial || has('full_name')) out.full_name = str(input.full_name, 'full_name', { max: 100, required: true });
  if (!partial || has('role')) out.role = validateRole(input.role);
  for (const [k, max] of [['student_id', 50], ['class_name', 50], ['owner_id', 36]]) {
    if (has(k)) out[k] = str(input[k], k, { max });
  }
  if (!partial) for (const k of ['student_id', 'class_name', 'owner_id']) out[k] = out[k] || '';
  return out;
}

/** Potong metadata audit agar muat kolom (2000 karakter). */
export function auditMetadata(obj) {
  const json = JSON.stringify(obj || {});
  return json.length > 2000 ? json.slice(0, 1997) + '...' : json;
}
