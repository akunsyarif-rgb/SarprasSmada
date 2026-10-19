import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/router.js';
import { createFakes, seedMaster } from './helpers.js';

const baseReport = { location_id: 'LOC1', category_id: 'CAT1', description: 'AC bocor' };

function setup() {
  const f = createFakes();
  seedMaster(f);
  f.addUser('siswa1', 'SISWA');
  f.addUser('siswa2', 'SISWA');
  f.addUser('ver1', 'VERIFIKATOR');
  f.addUser('adm1', 'ADMIN', { labels: ['guru', 'sarprasadmin'] });
  f.addUser('presensi1', 'SISWA', { labels: ['guru'] });
  const call = (uid, body) => dispatch(f.ctxBase, uid, body);
  return { f, call };
}

test('akses: tanpa login, tanpa label sarpras, akun nonaktif ditolak', async () => {
  const { f, call } = setup();
  await assert.rejects(call('', { action: 'createReport', ...baseReport }), /login/i);
  await assert.rejects(call('presensi1', { action: 'createReport', ...baseReport }), /tidak memiliki akses/);
  f.authUsers.siswa1.status = false;
  await assert.rejects(call('siswa1', { action: 'createReport', ...baseReport }), /dinonaktifkan/);
  await assert.rejects(call('adm1', { action: 'hapusSemua' }), /tidak dikenal/);
  await assert.rejects(call('adm1', { action: '__proto__' }), /tidak dikenal/);
});

test('createReport: nomor, reporter dari server, izin baris, riwayat & audit', async () => {
  const { f, call } = setup();
  const r = await call('siswa1', { action: 'createReport', ...baseReport, reporter_id: 'penyusup', status: 'CLOSED' });
  assert.equal(r.reporter_id, 'siswa1');
  assert.equal(r.status, 'SUBMITTED');
  assert.equal(r.report_number, 'SRP-2026-000001');
  assert.deepEqual(r.$permissions, ['read("user:siswa1")']);
  const hist = Object.values(f.tables.sarpras_report_history);
  assert.equal(hist.length, 1);
  assert.deepEqual(hist[0].$permissions, ['read("user:siswa1")']);
  assert.equal(Object.keys(f.tables.sarpras_audit_logs).length, 1);
  const r2 = await call('siswa2', { action: 'createReport', ...baseReport });
  assert.equal(r2.report_number, 'SRP-2026-000002');
});

test('createReport: lokasi nonaktif / tak ada ditolak', async () => {
  const { f, call } = setup();
  f.tables.sarpras_locations.LOC1.is_active = false;
  await assert.rejects(call('siswa1', { action: 'createReport', ...baseReport }), /Lokasi/);
  await assert.rejects(call('siswa1', { action: 'createReport', ...baseReport, location_id: 'NOPE' }), /Lokasi/);
});

test('updateReport: pelapor lain tidak bisa; pelapor sendiri boleh saat SUBMITTED', async () => {
  const { call } = setup();
  const r = await call('siswa1', { action: 'createReport', ...baseReport });
  await assert.rejects(call('siswa2', { action: 'updateReport', report_id: r.$id, updates: { condition: 'x' } }), /tidak ditemukan/);
  const u = await call('siswa1', { action: 'updateReport', report_id: r.$id, updates: { condition: 'parah' } });
  assert.equal(u.condition, 'parah');
  await assert.rejects(call('siswa1', { action: 'updateReport', report_id: r.$id, updates: { status: 'CLOSED' } }), /tidak dapat diubah/);
  await call('ver1', { action: 'changeReportStatus', report_id: r.$id, new_status: 'VERIFIED' });
  await assert.rejects(call('siswa1', { action: 'updateReport', report_id: r.$id, updates: { condition: 'lagi' } }), /sudah diproses/);
});

test('changeReportStatus: hanya staf, transisi linear, timestamp & riwayat', async () => {
  const { f, call } = setup();
  const r = await call('siswa1', { action: 'createReport', ...baseReport });
  await assert.rejects(call('siswa1', { action: 'changeReportStatus', report_id: r.$id, new_status: 'VERIFIED' }), /tidak diizinkan/);
  await assert.rejects(call('ver1', { action: 'changeReportStatus', report_id: r.$id, new_status: 'CLOSED' }), /ilegal/);
  const v = await call('ver1', { action: 'changeReportStatus', report_id: r.$id, new_status: 'VERIFIED', notes: 'ok' });
  assert.equal(v.status, 'VERIFIED');
  assert.equal(v.verified_at, '2026-10-19T10:00:00.000Z');
  const hist = Object.values(f.tables.sarpras_report_history).filter((h) => h.action === 'STATUS_CHANGE');
  assert.equal(hist.length, 1);
  assert.equal(hist[0].performed_by, 'ver1');
  assert.equal(hist[0].notes, 'ok');
});

test('deactivateReport: hanya staf', async () => {
  const { call } = setup();
  const r = await call('siswa1', { action: 'createReport', ...baseReport });
  await assert.rejects(call('siswa1', { action: 'deactivateReport', report_id: r.$id }), /tidak diizinkan/);
  const d = await call('ver1', { action: 'deactivateReport', report_id: r.$id });
  assert.equal(d.is_active, false);
  await assert.rejects(call('ver1', { action: 'changeReportStatus', report_id: r.$id, new_status: 'VERIFIED' }), /tidak aktif/);
});

test('manajemen user: hanya admin; buat, ubah role, nonaktifkan, reset password', async () => {
  const { f, call } = setup();
  const body = { action: 'createUser', email: 'Guru@Smada.id', full_name: 'Bu Guru', role: 'GURU', password: 'rahasia123' };
  await assert.rejects(call('ver1', body), /tidak diizinkan/);
  const p = await call('adm1', body);
  assert.equal(p.email, 'guru@smada.id');
  assert.deepEqual(f.authUsers[p.$id].labels, ['sarprasguru']);
  assert.deepEqual(p.$permissions, [`read("user:${p.$id}")`]);

  await call('adm1', { action: 'updateUser', user_id: p.$id, updates: { role: 'VERIFIKATOR' } });
  assert.deepEqual(f.authUsers[p.$id].labels, ['sarprasverifikator']);

  await call('adm1', { action: 'setPassword', user_id: p.$id, new_password: 'barulagi99' });
  assert.equal(f.authUsers[p.$id].password, 'barulagi99');
  await assert.rejects(call('adm1', { action: 'setPassword', user_id: p.$id, new_password: 'pendek' }), /minimal/);

  await call('adm1', { action: 'deactivateUser', user_id: p.$id });
  assert.equal(f.authUsers[p.$id].status, false);
  await assert.rejects(call(p.$id, { action: 'createReport', ...baseReport }), /dinonaktifkan/);
});

test('manajemen user: label non-sarpras dipertahankan, admin tak bisa kunci diri sendiri', async () => {
  const { f, call } = setup();
  await assert.rejects(call('adm1', { action: 'updateUser', user_id: 'adm1', updates: { role: 'SISWA' } }), /perannya sendiri/);
  await assert.rejects(call('adm1', { action: 'deactivateUser', user_id: 'adm1' }), /akun sendiri/);
  f.addUser('s9', 'SISWA', { labels: ['guru', 'sarprassiswa'] });
  await call('adm1', { action: 'updateUser', user_id: 's9', updates: { role: 'STAF' } });
  assert.deepEqual(f.authUsers.s9.labels, ['guru', 'sarprasstaf']);
});

test('createUser: kompensasi bila pembuatan profil gagal', async () => {
  const { f, call } = setup();
  f.store.createRow = async () => { throw new Error('db down'); };
  await assert.rejects(
    call('adm1', { action: 'createUser', email: 'x@y.id', full_name: 'X', role: 'SISWA', password: 'rahasia123' }),
    /db down/
  );
  assert.equal(Object.keys(f.authUsers).filter((k) => f.authUsers[k].email === 'x@y.id').length, 0);
});

test('syncMyProfile: admin berlabel tanpa profil mendapat profil', async () => {
  const { f, call } = setup();
  const p = await call('adm1', { action: 'syncMyProfile' });
  assert.equal(p.role, 'ADMIN');
  assert.equal(p.$id, 'adm1');
  assert.equal((await call('adm1', { action: 'syncMyProfile' })).$id, 'adm1');
  assert.equal(Object.keys(f.tables.sarpras_users_profile).length, 1);
});
