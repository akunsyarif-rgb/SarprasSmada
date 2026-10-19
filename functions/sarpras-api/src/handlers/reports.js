import { TABLES, STAFF_ROLES } from '../lib/config.js';
import { badRequest, notFound } from '../lib/errors.js';
import { requireRole } from '../lib/auth.js';
import {
  validateNewReport, validateReportUpdate, validateTransition, formatReportNumber,
  canAccessReport, str
} from '../lib/rules.js';
import { writeAudit, writeHistory } from '../lib/audit.js';
import { REPORT_STATUS, STATUS_TIMESTAMP_COLUMN } from '../lib/config.js';

async function requireActive(ctx, table, id, label) {
  if (!id) return;
  const row = await ctx.store.getRow(table, id);
  if (!row || row.is_active !== true) throw badRequest(`${label} tidak ditemukan atau tidak aktif: "${id}".`);
}

/** Laporan yang boleh diakses pemanggil; selain itu "tidak ditemukan" (ID tidak bisa dienumerasi). */
async function loadAccessible(ctx, reportId) {
  const id = str(reportId, 'report_id', { max: 36, required: true });
  const report = await ctx.store.getRow(TABLES.REPORTS, id);
  if (!report || !canAccessReport(ctx.caller, report)) throw notFound(`Laporan tidak ditemukan: "${id}".`);
  return report;
}

export async function createReport(ctx, input) {
  const data = validateNewReport(input);
  await requireActive(ctx, TABLES.LOCATIONS, data.location_id, 'Lokasi');
  await requireActive(ctx, TABLES.CATEGORIES, data.category_id, 'Kategori');
  await requireActive(ctx, TABLES.FACILITIES, data.facility_id, 'Fasilitas');
  await requireActive(ctx, TABLES.OWNERS, data.owner_id, 'Penanggung jawab');

  const seq = await ctx.store.incrementRowColumn(TABLES.SEQUENCES, 'REPORT', 'current_value', 1);
  const reportNumber = formatReportNumber(seq.current_value, ctx.now);
  const reportId = ctx.newId();

  const report = await ctx.store.createRow(TABLES.REPORTS, reportId, {
    ...data,
    report_number: reportNumber,
    reporter_id: ctx.caller.id,
    system_priority: '',
    priority: '',
    priority_override_reason: '',
    status: 'SUBMITTED',
    duplicate_of_report_id: '',
    is_active: true
  }, [`read("user:${ctx.caller.id}")`]);

  await writeHistory(ctx, report, { new_status: 'SUBMITTED', action: 'CREATE', notes: 'Laporan dibuat.' });
  await writeAudit(ctx, 'CREATE_REPORT', 'report', reportId, { report_number: reportNumber });
  return report;
}

export async function updateReport(ctx, input) {
  const report = await loadAccessible(ctx, input.report_id);
  if (report.is_active !== true) throw badRequest('Laporan tidak aktif.');
  const patch = validateReportUpdate(ctx.caller, report, input.updates);
  const keys = Object.keys(patch);
  if (keys.length === 0) throw badRequest('Tidak ada kolom yang diubah.');

  if (patch.location_id) await requireActive(ctx, TABLES.LOCATIONS, patch.location_id, 'Lokasi');
  if (patch.category_id) await requireActive(ctx, TABLES.CATEGORIES, patch.category_id, 'Kategori');
  if (patch.facility_id) await requireActive(ctx, TABLES.FACILITIES, patch.facility_id, 'Fasilitas');
  if (patch.owner_id) await requireActive(ctx, TABLES.OWNERS, patch.owner_id, 'Penanggung jawab');
  if (patch.duplicate_of_report_id) {
    const dup = await ctx.store.getRow(TABLES.REPORTS, patch.duplicate_of_report_id);
    if (!dup) throw badRequest(`Laporan duplikat tidak ditemukan: "${patch.duplicate_of_report_id}".`);
  }

  const updated = await ctx.store.updateRow(TABLES.REPORTS, report.$id, patch);
  await writeHistory(ctx, report, {
    previous_status: report.status, new_status: report.status, action: 'UPDATE',
    notes: `Kolom diperbarui: ${keys.join(', ')}.`
  });
  await writeAudit(ctx, 'UPDATE_REPORT', 'report', report.$id, { fields: keys });
  return updated;
}

export async function changeReportStatus(ctx, input) {
  requireRole(ctx.caller, STAFF_ROLES);
  const newStatus = input.new_status;
  if (!REPORT_STATUS.includes(newStatus)) {
    throw badRequest(`Status tidak dikenal: "${newStatus}". Status valid: ${REPORT_STATUS.join(', ')}.`);
  }
  const notes = str(input.notes, 'notes', { max: 1000 });
  const report = await loadAccessible(ctx, input.report_id);
  if (report.is_active !== true) throw badRequest('Laporan tidak aktif, transisi status ditolak.');
  validateTransition(report.status, newStatus);

  const patch = { status: newStatus };
  const tsColumn = STATUS_TIMESTAMP_COLUMN[newStatus];
  if (tsColumn) patch[tsColumn] = ctx.now.toISOString();

  const updated = await ctx.store.updateRow(TABLES.REPORTS, report.$id, patch);
  await writeHistory(ctx, report, {
    previous_status: report.status, new_status: newStatus, action: 'STATUS_CHANGE', notes
  });
  await writeAudit(ctx, 'STATUS_CHANGE', 'report', report.$id, { from: report.status, to: newStatus });
  return updated;
}

export async function deactivateReport(ctx, input) {
  requireRole(ctx.caller, STAFF_ROLES);
  const report = await loadAccessible(ctx, input.report_id);
  if (report.is_active !== true) throw badRequest('Laporan sudah tidak aktif.');
  const updated = await ctx.store.updateRow(TABLES.REPORTS, report.$id, { is_active: false });
  await writeHistory(ctx, report, {
    previous_status: report.status, new_status: report.status, action: 'DEACTIVATE', notes: 'Laporan dinonaktifkan.'
  });
  await writeAudit(ctx, 'DEACTIVATE_REPORT', 'report', report.$id, {});
  return updated;
}
