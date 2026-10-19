import test from 'node:test';
import assert from 'node:assert/strict';
import {
  roleFromLabels, labelsWithRole, validateNewReport, validateReportUpdate, validateTransition,
  formatReportNumber, validatePassword, validateProfileFields, canAccessReport
} from '../src/lib/rules.js';

test('roleFromLabels: tepat satu label sarpras*', () => {
  assert.equal(roleFromLabels(['guru', 'sarprasadmin']), 'ADMIN');
  assert.equal(roleFromLabels(['guru']), null);
  assert.equal(roleFromLabels([]), null);
  assert.equal(roleFromLabels(['sarprasadmin', 'sarprassiswa']), null);
});

test('labelsWithRole: pertahankan label non-sarpras', () => {
  assert.deepEqual(labelsWithRole(['guru', 'sarprassiswa'], 'ADMIN'), ['guru', 'sarprasadmin']);
});

test('canAccessReport', () => {
  const r = { reporter_id: 'a' };
  assert.equal(canAccessReport({ id: 'a', role: 'SISWA' }, r), true);
  assert.equal(canAccessReport({ id: 'b', role: 'SISWA' }, r), false);
  assert.equal(canAccessReport({ id: 'b', role: 'VERIFIKATOR' }, r), true);
});

test('validateNewReport: wajib & batas', () => {
  assert.throws(() => validateNewReport({}), /location_id/);
  assert.throws(() => validateNewReport({ location_id: 'L', category_id: 'C' }), /description/);
  assert.throws(() => validateNewReport({ location_id: 'L', category_id: 'C', description: 'x'.repeat(2001) }), /2000/);
  assert.throws(() => validateNewReport({ location_id: 'L', category_id: 'C', description: 'x', impact_level: 'AMAT' }), /impact_level/);
  assert.equal(validateNewReport({ location_id: 'L', category_id: 'C', description: ' ok ' }).description, 'ok');
});

test('validateReportUpdate: pelapor dibatasi', () => {
  const pelapor = { id: 'a', role: 'SISWA' };
  assert.throws(() => validateReportUpdate(pelapor, { status: 'SUBMITTED' }, { status: 'CLOSED' }), /tidak dapat diubah/);
  assert.throws(() => validateReportUpdate(pelapor, { status: 'SUBMITTED' }, { owner_id: 'X' }), /tidak dapat diubah/);
  assert.throws(() => validateReportUpdate(pelapor, { status: 'VERIFIED' }, { condition: 'x' }), /sudah diproses/);
  assert.deepEqual(validateReportUpdate(pelapor, { status: 'SUBMITTED' }, { condition: 'rusak' }), { condition: 'rusak' });
  const staf = { id: 'v', role: 'VERIFIKATOR' };
  assert.deepEqual(validateReportUpdate(staf, { status: 'VERIFIED' }, { owner_id: 'OWN1' }), { owner_id: 'OWN1' });
  for (const bad of ['status', 'reporter_id', 'is_active', 'report_number', 'verified_at']) {
    assert.throws(() => validateReportUpdate(staf, { status: 'SUBMITTED' }, { [bad]: 'x' }), /tidak dapat diubah/);
  }
});

test('validateTransition: hanya maju satu langkah', () => {
  assert.doesNotThrow(() => validateTransition('SUBMITTED', 'VERIFIED'));
  assert.throws(() => validateTransition('SUBMITTED', 'CLOSED'), /ilegal/);
  assert.throws(() => validateTransition('VERIFIED', 'SUBMITTED'), /ilegal/);
  assert.throws(() => validateTransition('CLOSED', 'CLOSED'), /ilegal/);
});

test('formatReportNumber memakai tahun zona Makassar', () => {
  assert.equal(formatReportNumber(12, new Date('2026-06-01T00:00:00Z')), 'SRP-2026-000012');
  assert.equal(formatReportNumber(1, new Date('2026-12-31T17:00:00Z')), 'SRP-2027-000001'); // 01:00 WITA
});

test('validatePassword & profil', () => {
  assert.throws(() => validatePassword('pendek'), /minimal/);
  assert.throws(() => validatePassword('x'.repeat(201)), /maksimal/);
  assert.equal(validatePassword('panjang123'), 'panjang123');
  assert.throws(() => validateProfileFields({ email: 'bukan', full_name: 'A', role: 'ADMIN' }, { partial: false }), /email/);
  assert.throws(() => validateProfileFields({ email: 'a@b.id', full_name: 'A', role: 'DEWA' }, { partial: false }), /role/);
  assert.equal(validateProfileFields({ email: 'A@B.ID', full_name: 'A', role: 'SISWA' }, { partial: false }).email, 'a@b.id');
});
