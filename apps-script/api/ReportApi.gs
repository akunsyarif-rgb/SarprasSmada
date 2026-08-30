/**
 * ReportApi.gs
 *
 * Fungsi PUBLIK yang dipanggil dari client (Index.html) lewat
 * google.script.run — lapisan entry point sesuai docs/ARCHITECTURE.md
 * ("Google Apps Script — lapisan entry point ... yang menerima permintaan
 * dan meneruskannya ke Service Layer"). Modul ini TIDAK berisi logika
 * bisnis apa pun — hanya: (1) mengidentifikasi pemanggil lewat
 * AuthContext.gs, (2) meneruskan ke apps-script/reports/*.gs, (3)
 * membungkus hasil/errornya lewat ApiUtil.gs.
 *
 * Setiap fungsi di sini TETAP mematuhi docs/ARCHITECTURE.md bagian 4 —
 * TIDAK memanggil SpreadsheetApp/getSpreadsheet() maupun DatabaseService
 * langsung; seluruh akses data selalu lewat fungsi Service Layer domain
 * reports/ yang sudah ada.
 *
 * Dependency:
 * - core/Config.gs (CONFIG.REPORT_STATUS)
 * - apps-script/api/AuthContext.gs (getCurrentUserContext_, requireRole_,
 *   API_WORKFLOW_ALLOWED_ROLES_)
 * - apps-script/api/ApiUtil.gs (apiRun_)
 * - apps-script/reports/ReportService.gs (createReport, getReportById,
 *   listActiveReports, listReportsByStatus, updateReport, deactivateReport)
 * - apps-script/reports/ReportWorkflowService.gs (changeReportStatus)
 * - apps-script/reports/ReportHistoryService.gs (listReportHistory)
 *
 * Referensi: docs/ARCHITECTURE.md, docs/WORKFLOW.md
 */

/**
 * Mengembalikan data pengguna yang sedang login (untuk ditampilkan di UI
 * dan menentukan kontrol mana yang ditampilkan, mis. tombol ubah status).
 * @return {{success: boolean, data: *, error: ?Object}}
 */
function apiGetCurrentUser() {
  return apiRun_(function () {
    var user = getCurrentUserContext_();
    return {
      user_id: user.user_id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      can_manage_workflow: API_WORKFLOW_ALLOWED_ROLES_.indexOf(user.role) !== -1
    };
  });
}

/**
 * Membuat laporan baru. reporter_id SELALU diambil dari sesi Google aktif
 * (TIDAK bisa dikirim/dipalsukan dari client).
 * @param {Object} payload Field laporan (lihat ReportService.createReport),
 *   TANPA reporter_id.
 * @return {{success: boolean, data: *, error: ?Object}}
 */
function apiCreateReport(payload) {
  return apiRun_(function () {
    var user = getCurrentUserContext_();
    payload = payload || {};
    return createReport({
      reporter_id: user.user_id,
      location_id: payload.location_id,
      category_id: payload.category_id,
      facility_id: payload.facility_id,
      owner_id: payload.owner_id,
      condition: payload.condition,
      description: payload.description,
      impact_level: payload.impact_level,
      safety_risk: payload.safety_risk
    });
  });
}

/**
 * Mengambil daftar laporan aktif. Jika status diisi, hanya laporan dengan
 * status tersebut yang dikembalikan.
 * @param {string} [status] Salah satu CONFIG.REPORT_STATUS (opsional).
 * @return {{success: boolean, data: *, error: ?Object}}
 */
function apiListReports(status) {
  return apiRun_(function () {
    getCurrentUserContext_();
    if (!status) {
      return listActiveReports();
    }
    return listReportsByStatus(status);
  });
}

/**
 * Mengambil satu laporan berdasarkan report_id.
 * @param {string} reportId ID laporan.
 * @return {{success: boolean, data: *, error: ?Object}}
 */
function apiGetReport(reportId) {
  return apiRun_(function () {
    getCurrentUserContext_();
    var report = getReportById(reportId);
    if (!report) {
      throw new Error('Laporan tidak ditemukan: "' + reportId + '".');
    }
    return report;
  });
}

/**
 * Mengambil riwayat perubahan suatu laporan.
 * @param {string} reportId ID laporan.
 * @return {{success: boolean, data: *, error: ?Object}}
 */
function apiListReportHistory(reportId) {
  return apiRun_(function () {
    getCurrentUserContext_();
    return listReportHistory(reportId);
  });
}

/**
 * Memperbarui data laporan (bukan status). performed_by SELALU diambil
 * dari sesi Google aktif.
 * @param {string} reportId ID laporan.
 * @param {Object} updates Kolom yang diperbarui (lihat ReportService.updateReport).
 * @return {{success: boolean, data: *, error: ?Object}}
 */
function apiUpdateReport(reportId, updates) {
  return apiRun_(function () {
    var user = getCurrentUserContext_();
    updates = updates || {};
    updates.performed_by = user.user_id;
    return updateReport(reportId, updates);
  });
}

/**
 * Mengubah status laporan. HANYA dapat dipanggil oleh peran
 * VERIFIKATOR/OWNER/ADMIN (lihat catatan OPEN DESIGN DECISION pada
 * AuthContext.gs). performed_by SELALU diambil dari sesi Google aktif.
 * @param {string} reportId ID laporan.
 * @param {string} newStatus Status tujuan, salah satu CONFIG.REPORT_STATUS.
 * @param {string} [notes] Catatan tambahan (opsional).
 * @return {{success: boolean, data: *, error: ?Object}}
 */
function apiChangeReportStatus(reportId, newStatus, notes) {
  return apiRun_(function () {
    var user = getCurrentUserContext_();
    requireRole_(user, API_WORKFLOW_ALLOWED_ROLES_);
    return changeReportStatus(reportId, newStatus, { performed_by: user.user_id, notes: notes });
  });
}

/**
 * Menonaktifkan laporan (soft delete). HANYA dapat dipanggil oleh peran
 * VERIFIKATOR/OWNER/ADMIN.
 * @param {string} reportId ID laporan.
 * @return {{success: boolean, data: *, error: ?Object}}
 */
function apiDeactivateReport(reportId) {
  return apiRun_(function () {
    var user = getCurrentUserContext_();
    requireRole_(user, API_WORKFLOW_ALLOWED_ROLES_);
    return deactivateReport(reportId, user.user_id);
  });
}

/**
 * Mengembalikan urutan status workflow kanonik (untuk UI, mis. dropdown
 * status tujuan) — HANYA untuk kebutuhan tampilan. Legalitas transisi
 * TETAP divalidasi ulang di server oleh ReportWorkflowService.changeReportStatus(),
 * client tidak boleh dipercaya untuk memutuskan transisi mana yang sah.
 * @return {{success: boolean, data: *, error: ?Object}}
 */
function apiGetReportStatusOptions() {
  return apiRun_(function () {
    return [
      CONFIG.REPORT_STATUS.SUBMITTED,
      CONFIG.REPORT_STATUS.VERIFIED,
      CONFIG.REPORT_STATUS.ASSIGNED,
      CONFIG.REPORT_STATUS.IN_PROGRESS,
      CONFIG.REPORT_STATUS.COMPLETED,
      CONFIG.REPORT_STATUS.CLOSED
    ];
  });
}
