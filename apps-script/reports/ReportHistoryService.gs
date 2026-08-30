/**
 * ReportHistoryService.gs
 *
 * Domain service untuk riwayat perubahan laporan (sheet 12_report_history).
 * Modul ini murni pencatat riwayat — tidak melakukan validasi bisnis
 * laporan itu sendiri (itu tanggung jawab ReportService.gs dan
 * ReportWorkflowService.gs, yang keduanya memanggil reportHistoryRecord_()
 * di sini setelah perubahan pada 10_reports berhasil disimpan).
 *
 * Pola implementasi (lihat docs/ARCHITECTURE.md):
 *   VALIDATION → BUSINESS LOGIC → DATABASE SERVICE → GOOGLE SPREADSHEET
 *
 * Domain ini TIDAK memanggil SpreadsheetApp secara langsung — seluruh
 * akses data melalui core/DatabaseService.gs (lihat docs/ARCHITECTURE.md
 * bagian 4, Aturan Akses Database).
 *
 * Schema (PHASE 3.75 canonical, lihat docs/DATABASE_SCHEMA.md
 * 12_report_history): history_id, report_id, previous_status, new_status,
 * action, notes, performed_by, created_at. Tidak ada is_active — entri
 * riwayat bersifat append-only, tidak pernah diubah/dihapus.
 *
 * Kategori "action" yang dipakai PHASE 4 (BUKAN enum final terkunci — lihat
 * laporan PHASE 4, bagian OPEN DESIGN DECISIONS):
 * - CREATE — dicatat oleh ReportService.createReport().
 * - STATUS_CHANGE — dicatat oleh ReportWorkflowService.changeReportStatus().
 * - UPDATE — dicatat oleh ReportService.updateReport() saat kolom non-status
 *   berubah.
 *
 * ATOMICITY: reportHistoryRecord_() memanggil DatabaseService.insertRow(),
 * yang memperoleh LockService-nya SENDIRI, terpisah dari lock yang dipakai
 * saat menyimpan perubahan pada 10_reports. Artinya penulisan baris laporan
 * dan penulisan baris riwayat BUKAN satu transaksi atomik — lihat analisis
 * lengkap pada docs/DATABASE_SCHEMA.md / laporan PHASE 4 (bagian ATOMICITY
 * ANALYSIS) untuk risiko partial-write yang mungkin terjadi.
 *
 * Dependency:
 * - core/Config.gs (CONFIG.SHEETS.REPORT_HISTORY, CONFIG.SEQUENCES.HISTORY,
 *   CONFIG.ID_PREFIXES.HISTORY)
 * - core/DatabaseService.gs (findRows, insertRow)
 * - core/SequenceService.gs (generateEntityId)
 * - core/UtilityService.gs (isEmpty, nowTimestamp)
 *
 * Referensi: docs/DATABASE_SCHEMA.md (12_report_history), docs/WORKFLOW.md
 */

/**
 * Mencatat satu entri riwayat perubahan laporan. Dipanggil INTERNAL oleh
 * ReportService.gs dan ReportWorkflowService.gs setelah perubahan pada
 * 10_reports berhasil disimpan — bukan dipanggil langsung sebagai API
 * publik oleh caller di luar domain reports.
 *
 * @param {Object} entry Data entri riwayat.
 * @param {string} entry.report_id Referensi ke 10_reports, wajib.
 * @param {string} entry.previous_status Status sebelum perubahan (string
 *   kosong untuk entri pertama/CREATE).
 * @param {string} entry.new_status Status setelah perubahan.
 * @param {string} entry.action Jenis aksi, mis. "CREATE", "STATUS_CHANGE",
 *   "UPDATE" — wajib diisi.
 * @param {string} [entry.notes] Catatan tambahan (opsional).
 * @param {string} entry.performed_by Referensi ke 01_users — pengguna yang
 *   melakukan perubahan, wajib.
 * @return {Object} Baris riwayat yang berhasil dibuat.
 * @throws {Error} Jika report_id, action, atau performed_by kosong.
 * @private
 */
function reportHistoryRecord_(entry) {
  if (!entry || typeof entry !== 'object') {
    throw new Error('ReportHistoryService.reportHistoryRecord_: "entry" wajib diisi dan bertipe object.');
  }
  if (isEmpty(entry.report_id)) {
    throw new Error('ReportHistoryService.reportHistoryRecord_: "report_id" wajib diisi.');
  }
  if (isEmpty(entry.action)) {
    throw new Error('ReportHistoryService.reportHistoryRecord_: "action" wajib diisi.');
  }
  if (isEmpty(entry.performed_by)) {
    throw new Error('ReportHistoryService.reportHistoryRecord_: "performed_by" wajib diisi.');
  }

  var newHistoryEntry = {
    history_id: generateEntityId(CONFIG.ID_PREFIXES.HISTORY, CONFIG.SEQUENCES.HISTORY),
    report_id: entry.report_id,
    previous_status: entry.previous_status || '',
    new_status: entry.new_status || '',
    action: entry.action,
    notes: entry.notes || '',
    performed_by: entry.performed_by,
    created_at: nowTimestamp()
  };

  return insertRow(CONFIG.SHEETS.REPORT_HISTORY, newHistoryEntry);
}

/**
 * Mengambil seluruh riwayat perubahan suatu laporan, diurutkan dari yang
 * paling lama ke paling baru (urutan alami penulisan baris). Tidak ada
 * validasi keberadaan/status laporan di sini — READ COMPATIBILITY penuh,
 * termasuk untuk laporan legacy yang referensinya mungkin sudah orphan
 * (lihat docs/DATABASE_SCHEMA.md dan laporan PHASE 3.75).
 *
 * @param {string} reportId ID laporan.
 * @return {Array<Object>} Daftar entri riwayat, array kosong jika tidak ada.
 * @throws {Error} Jika reportId kosong.
 */
function listReportHistory(reportId) {
  if (isEmpty(reportId)) {
    throw new Error('ReportHistoryService.listReportHistory: "reportId" wajib diisi.');
  }
  return findRows(CONFIG.SHEETS.REPORT_HISTORY, function (row) {
    return row.report_id === reportId;
  });
}
