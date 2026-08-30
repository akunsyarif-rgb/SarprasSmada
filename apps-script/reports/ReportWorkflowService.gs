/**
 * ReportWorkflowService.gs
 *
 * Domain service untuk transisi status laporan (Workflow), sesuai
 * docs/WORKFLOW.md. Modul ini TERPISAH dari ReportService.gs karena
 * perubahan status bukan "update data biasa" — setiap transisi WAJIB
 * melalui validasi urutan yang eksplisit dan tidak boleh melompat
 * (lihat docs/WORKFLOW.md bagian "Transisi yang Valid").
 *
 * Otorisasi (siapa yang berhak memicu transisi tertentu, mis. hanya
 * VERIFIKATOR yang dapat mengubah status ke VERIFIED) BELUM
 * diimplementasikan di sini — dijadwalkan PHASE 5 sesuai docs/WORKFLOW.md
 * bagian "Catatan Implementasi" dan docs/DEVELOPMENT_ROADMAP.md.
 * changeReportStatus() hanya memvalidasi legalitas URUTAN transisi, bukan
 * hak akses pemanggil.
 *
 * Pola implementasi (lihat docs/ARCHITECTURE.md):
 *   VALIDATION → BUSINESS LOGIC → DATABASE SERVICE → GOOGLE SPREADSHEET
 *
 * Domain ini TIDAK memanggil SpreadsheetApp secara langsung — seluruh
 * akses data melalui core/DatabaseService.gs (lihat docs/ARCHITECTURE.md
 * bagian 4, Aturan Akses Database).
 *
 * Dependency:
 * - core/Config.gs (CONFIG.SHEETS.REPORTS, CONFIG.REPORT_STATUS)
 * - core/DatabaseService.gs (updateRowById)
 * - core/UtilityService.gs (isEmpty, nowTimestamp)
 * - apps-script/reports/ReportService.gs (getReportById, reportValidateActiveUser_,
 *   reportValidateStatusValue_)
 * - apps-script/reports/ReportHistoryService.gs (reportHistoryRecord_)
 *
 * Referensi: docs/WORKFLOW.md, docs/DATABASE_SCHEMA.md (10_reports, 12_report_history)
 */

/**
 * Daftar transisi status yang SAH, sesuai docs/WORKFLOW.md bagian
 * "Transisi yang Valid". Linear dan berurutan — tidak ada status yang
 * dapat dilompati, tidak ada transisi mundur, tidak ada transisi ke status
 * yang sama (kecuali didefinisikan eksplisit sebagai kasus khusus pada
 * tahap pengembangan berikutnya, mis. pembatalan laporan — BELUM ada pada
 * PHASE 4, lihat docs/WORKFLOW.md).
 * @private
 */
var REPORT_WORKFLOW_TRANSITIONS_ = {
  SUBMITTED: ['VERIFIED'],
  VERIFIED: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: ['CLOSED'],
  CLOSED: []
};

/**
 * Pemetaan status baru -> nama kolom timestamp pada 10_reports yang harus
 * diisi saat transisi ke status tersebut terjadi, sesuai
 * docs/DATABASE_SCHEMA.md (10_reports: verified_at, assigned_at,
 * started_at, completed_at, closed_at).
 * @private
 */
var REPORT_STATUS_TIMESTAMP_COLUMN_ = {
  VERIFIED: 'verified_at',
  ASSIGNED: 'assigned_at',
  IN_PROGRESS: 'started_at',
  COMPLETED: 'completed_at',
  CLOSED: 'closed_at'
};

/**
 * Mengubah status laporan, memvalidasi legalitas transisi terlebih dahulu.
 * Mengisi kolom timestamp terkait status baru (lihat
 * REPORT_STATUS_TIMESTAMP_COLUMN_) dan mencatat satu entri riwayat
 * STATUS_CHANGE pada 12_report_history.
 *
 * @param {string} reportId ID laporan yang diubah statusnya.
 * @param {string} newStatus Status tujuan, wajib salah satu CONFIG.REPORT_STATUS.
 * @param {Object} options Opsi tambahan.
 * @param {string} options.performed_by Referensi ke 01_users — pengguna
 *   yang melakukan transisi, wajib dan divalidasi aktif.
 * @param {string} [options.notes] Catatan tambahan atas transisi ini (opsional).
 * @return {Object} Baris laporan setelah statusnya diubah.
 * @throws {Error} Jika argumen tidak valid, laporan tidak ditemukan/tidak
 *   aktif, atau transisi status ilegal (melompat/mundur/status sama).
 */
function changeReportStatus(reportId, newStatus, options) {
  if (isEmpty(reportId)) {
    throw new Error('ReportWorkflowService.changeReportStatus: "reportId" wajib diisi.');
  }
  reportValidateStatusValue_(newStatus);
  if (!options || typeof options !== 'object') {
    throw new Error('ReportWorkflowService.changeReportStatus: "options" wajib diisi dan bertipe object.');
  }
  if (isEmpty(options.performed_by)) {
    throw new Error('ReportWorkflowService.changeReportStatus: "options.performed_by" wajib diisi.');
  }
  reportValidateActiveUser_(options.performed_by, 'performed_by');

  var report = getReportById(reportId);
  if (!report) {
    throw new Error('ReportWorkflowService.changeReportStatus: Laporan tidak ditemukan: "' + reportId + '".');
  }
  if (report.is_active !== true) {
    throw new Error('ReportWorkflowService.changeReportStatus: Laporan tidak aktif, transisi status ditolak: "' + reportId + '".');
  }

  var currentStatus = report.status;
  var allowedNextStatuses = REPORT_WORKFLOW_TRANSITIONS_[currentStatus];

  if (!allowedNextStatuses) {
    throw new Error(
      'ReportWorkflowService.changeReportStatus: Status laporan saat ini tidak dikenal sistem: "' +
      currentStatus + '".'
    );
  }
  if (allowedNextStatuses.indexOf(newStatus) === -1) {
    throw new Error(
      'ReportWorkflowService.changeReportStatus: Transisi status ilegal: "' + currentStatus +
      '" -> "' + newStatus + '". Transisi yang diperbolehkan dari "' + currentStatus + '": ' +
      (allowedNextStatuses.length > 0 ? allowedNextStatuses.join(', ') : '(tidak ada, status akhir)') + '.'
    );
  }

  var patch = {
    status: newStatus,
    updated_at: nowTimestamp()
  };
  var timestampColumn = REPORT_STATUS_TIMESTAMP_COLUMN_[newStatus];
  if (timestampColumn) {
    patch[timestampColumn] = patch.updated_at;
  }

  var updatedReport = updateRowById(CONFIG.SHEETS.REPORTS, 'report_id', reportId, patch);

  reportHistoryRecord_({
    report_id: reportId,
    previous_status: currentStatus,
    new_status: newStatus,
    action: 'STATUS_CHANGE',
    notes: options.notes || '',
    performed_by: options.performed_by
  });

  return updatedReport;
}
