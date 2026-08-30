/**
 * ReportService.gs
 *
 * Domain service inti untuk laporan sarana-prasarana (sheet 10_reports):
 * Create Report, Report Retrieval, Report Listing, Report Update, dan
 * Referential Validation. Transisi status (Workflow) ADA DI FILE TERPISAH —
 * lihat ReportWorkflowService.gs — karena merupakan aturan bisnis yang
 * berbeda sifatnya (linear, terkunci urutannya) dari update data biasa.
 *
 * Pola implementasi (lihat docs/ARCHITECTURE.md):
 *   VALIDATION → BUSINESS LOGIC → DATABASE SERVICE → GOOGLE SPREADSHEET
 *
 * Domain ini TIDAK memanggil SpreadsheetApp secara langsung — seluruh
 * akses data melalui core/DatabaseService.gs (lihat docs/ARCHITECTURE.md
 * bagian 4, Aturan Akses Database).
 *
 * ================================================================
 * LEGACY COMPATIBILITY — PHASE 4 (lihat laporan PHASE 4, bagian E)
 * ================================================================
 * Database produksi SIGAP SARPRAS memiliki laporan lama yang referensinya
 * (reporter_id, location_id, category_id, facility_id, owner_id) sudah
 * ORPHAN (tidak ditemukan lagi pada sheet master data terkait) — temuan
 * PHASE 3.5/3.75. Karena itu modul ini memisahkan TIGA tingkat validasi:
 *
 * 1. CREATE (createReport) — STRICT. Seluruh referensi wajib (reporter_id,
 *    location_id, category_id) dan referensi opsional yang DIISI
 *    (facility_id, owner_id, duplicate_of_report_id) WAJIB merujuk data
 *    yang benar-benar ada DAN aktif (kecuali duplicate_of_report_id, yang
 *    hanya perlu ADA — laporan duplikat boleh merujuk laporan lama apa pun,
 *    termasuk yang sudah CLOSED).
 * 2. READ (getReportById) — TIDAK ADA validasi referensi sama sekali.
 *    Laporan lama WAJIB tetap bisa dibaca walau referensinya sudah orphan.
 * 3. UPDATE (updateReport) — CONTEXTUAL. Hanya kolom referensi yang BENAR-
 *    BENAR ada di parameter "updates" yang divalidasi ulang (strict, sama
 *    seperti CREATE). Kolom referensi lain pada laporan tersebut yang TIDAK
 *    sedang diubah TIDAK dipaksa untuk valid kembali — laporan lama dengan
 *    reporter_id orphan tetap bisa di-update mis. "description"-nya tanpa
 *    perlu memperbaiki reporter_id lebih dulu.
 *
 * Prinsip: DATA BARU HARUS VALID. DATA LAMA HARUS TETAP DAPAT DIAKSES.
 *
 * ================================================================
 * OPEN DESIGN DECISIONS (lihat laporan PHASE 4 untuk detail lengkap)
 * ================================================================
 * - system_priority: TIDAK dihitung otomatis pada fase ini — belum ada
 *   algoritma kanonik yang ditemukan di dokumentasi/source legacy. Kolom
 *   ini disimpan kosong saat createReport() dan TIDAK dapat diisi lewat
 *   updateReport(). Perhitungan otomatis didokumentasikan sebagai pekerjaan
 *   PHASE berikutnya begitu aturan bisnisnya dikonfirmasi.
 * - impact_level / safety_risk: TIDAK divalidasi terhadap whitelist nilai
 *   tertentu (mis. RENDAH/SEDANG/TINGGI) karena docs/DATABASE_SCHEMA.md
 *   hanya memberi CONTOH nilai ("mis. ..."), bukan daftar kanonik seperti
 *   CONFIG.ROLES/CONFIG.REPORT_STATUS. Diterima sebagai teks bebas untuk
 *   saat ini.
 * - Konsistensi facility_id terhadap category_id (mis. facility yang
 *   dipilih harus berada di bawah category yang sama) TIDAK diberlakukan —
 *   tidak ditemukan dasar aturan ini di dokumentasi/source legacy.
 * - "condition" bersifat opsional, "description" wajib — tidak ditemukan
 *   dokumentasi yang menyatakan sebaliknya.
 *
 * Dependency:
 * - core/Config.gs (CONFIG.SHEETS.REPORTS/USERS/LOCATIONS/CATEGORIES/
 *   FACILITIES/OWNERS, CONFIG.SEQUENCES.REPORT, CONFIG.ID_PREFIXES.REPORT,
 *   CONFIG.REPORT_STATUS)
 * - core/DatabaseService.gs (getRowById, findRows, insertRow, updateRowById)
 * - core/SequenceService.gs (generateEntityId, generateReportNumber)
 * - core/UtilityService.gs (isEmpty, nowTimestamp)
 * - apps-script/reports/ReportHistoryService.gs (reportHistoryRecord_)
 *
 * Referensi: docs/DATABASE_SCHEMA.md (10_reports), docs/WORKFLOW.md
 */

/**
 * Membuat laporan baru. Selalu diawali status CONFIG.REPORT_STATUS.SUBMITTED
 * (lihat docs/WORKFLOW.md) dan mencatat satu entri riwayat CREATE pada
 * 12_report_history.
 *
 * Validasi (STRICT — lihat catatan LEGACY COMPATIBILITY di header file ini):
 * - reporter_id, location_id, category_id wajib diisi dan merujuk data
 *   yang ada serta berstatus aktif.
 * - description wajib diisi.
 * - facility_id, owner_id — jika diisi, wajib merujuk data yang ada serta
 *   berstatus aktif.
 * - duplicate_of_report_id — jika diisi, wajib merujuk laporan yang ada
 *   (tidak harus aktif/berstatus tertentu).
 *
 * @param {Object} reportData Data laporan baru.
 * @param {string} reportData.reporter_id Referensi ke 01_users, wajib.
 * @param {string} reportData.location_id Referensi ke 02_locations, wajib.
 * @param {string} reportData.category_id Referensi ke 03_categories, wajib.
 * @param {string} reportData.description Deskripsi lengkap laporan, wajib.
 * @param {string} [reportData.facility_id] Referensi ke 04_facilities (opsional).
 * @param {string} [reportData.condition] Deskripsi singkat kondisi (opsional).
 * @param {string} [reportData.impact_level] Tingkat dampak (opsional, teks bebas).
 * @param {string} [reportData.safety_risk] Penanda risiko keselamatan (opsional, teks bebas).
 * @param {string} [reportData.priority] Prioritas awal (opsional; lihat catatan
 *   OPEN DESIGN DECISIONS soal system_priority).
 * @param {string} [reportData.priority_override_reason] Alasan override prioritas (opsional).
 * @param {string} [reportData.owner_id] Referensi ke 05_owners (opsional).
 * @param {string} [reportData.duplicate_of_report_id] Referensi ke 10_reports lain (opsional).
 * @return {Object} Baris laporan yang berhasil dibuat.
 * @throws {Error} Jika validasi gagal.
 */
function createReport(reportData) {
  if (!reportData || typeof reportData !== 'object') {
    throw new Error('ReportService.createReport: "reportData" wajib diisi dan bertipe object.');
  }
  if (isEmpty(reportData.description)) {
    throw new Error('ReportService.createReport: "description" wajib diisi.');
  }

  reportValidateActiveUser_(reportData.reporter_id, 'reporter_id');
  reportValidateActiveLocation_(reportData.location_id);
  reportValidateActiveCategory_(reportData.category_id);

  if (!isEmpty(reportData.facility_id)) {
    reportValidateActiveFacility_(reportData.facility_id);
  }
  if (!isEmpty(reportData.owner_id)) {
    reportValidateActiveOwner_(reportData.owner_id);
  }
  if (!isEmpty(reportData.duplicate_of_report_id)) {
    reportValidateExistingReport_(reportData.duplicate_of_report_id);
  }

  var timestamp = nowTimestamp();
  var newReport = {
    report_id: generateEntityId(CONFIG.ID_PREFIXES.REPORT, CONFIG.SEQUENCES.REPORT),
    report_number: generateReportNumber(),
    reporter_id: reportData.reporter_id,
    location_id: reportData.location_id,
    category_id: reportData.category_id,
    facility_id: reportData.facility_id || '',
    condition: reportData.condition || '',
    description: reportData.description.trim(),
    impact_level: reportData.impact_level || '',
    safety_risk: reportData.safety_risk || '',
    system_priority: '',
    priority: reportData.priority || '',
    priority_override_reason: reportData.priority_override_reason || '',
    status: CONFIG.REPORT_STATUS.SUBMITTED,
    owner_id: reportData.owner_id || '',
    duplicate_of_report_id: reportData.duplicate_of_report_id || '',
    created_at: timestamp,
    updated_at: timestamp,
    verified_at: '',
    assigned_at: '',
    started_at: '',
    completed_at: '',
    closed_at: '',
    is_active: true
  };

  var savedReport = insertRow(CONFIG.SHEETS.REPORTS, newReport);

  reportHistoryRecord_({
    report_id: savedReport.report_id,
    previous_status: '',
    new_status: CONFIG.REPORT_STATUS.SUBMITTED,
    action: 'CREATE',
    notes: 'Laporan dibuat.',
    performed_by: savedReport.reporter_id
  });

  return savedReport;
}

/**
 * Mengambil satu laporan berdasarkan report_id. TIDAK ADA validasi
 * referensi — READ COMPATIBILITY penuh terhadap laporan legacy yang
 * referensinya mungkin sudah orphan (lihat catatan LEGACY COMPATIBILITY
 * di header file ini).
 *
 * @param {string} reportId ID laporan.
 * @return {Object|null} Baris laporan, atau null jika tidak ditemukan.
 * @throws {Error} Jika reportId kosong.
 */
function getReportById(reportId) {
  if (isEmpty(reportId)) {
    throw new Error('ReportService.getReportById: "reportId" wajib diisi.');
  }
  return getRowById(CONFIG.SHEETS.REPORTS, 'report_id', reportId);
}

/**
 * Mengambil seluruh laporan yang berstatus aktif (is_active = true),
 * tanpa memandang status workflow-nya.
 *
 * @return {Array<Object>} Daftar laporan aktif.
 */
function listActiveReports() {
  return findRows(CONFIG.SHEETS.REPORTS, function (row) {
    return row.is_active === true;
  });
}

/**
 * Mengambil seluruh laporan aktif dengan status workflow tertentu, mis.
 * untuk menampilkan daftar laporan yang menunggu verifikasi (SUBMITTED).
 *
 * @param {string} status Salah satu nilai CONFIG.REPORT_STATUS.
 * @return {Array<Object>} Daftar laporan aktif dengan status tersebut.
 * @throws {Error} Jika status kosong atau bukan nilai kanonik CONFIG.REPORT_STATUS.
 */
function listReportsByStatus(status) {
  reportValidateStatusValue_(status);
  return findRows(CONFIG.SHEETS.REPORTS, function (row) {
    return row.is_active === true && row.status === status;
  });
}

/**
 * Memperbarui data laporan (BUKAN status/workflow — gunakan
 * ReportWorkflowService.changeReportStatus() untuk itu; BUKAN is_active —
 * gunakan deactivateReport()). Validasi CONTEXTUAL: hanya kolom yang
 * benar-benar ada pada "updates" yang divalidasi ulang (lihat catatan
 * LEGACY COMPATIBILITY di header file ini). Mencatat satu entri riwayat
 * UPDATE pada 12_report_history.
 *
 * @param {string} reportId ID laporan yang diperbarui.
 * @param {Object} updates Kolom yang ingin diperbarui, ditambah
 *   "performed_by" (WAJIB, bukan kolom 10_reports — hanya dipakai untuk
 *   mencatat siapa yang melakukan perubahan pada riwayat).
 * @param {string} updates.performed_by Referensi ke 01_users — pengguna
 *   yang melakukan perubahan, wajib dan divalidasi aktif (lihat catatan
 *   LEGACY COMPATIBILITY — ini data BARU, bukan data lama, sehingga tetap
 *   divalidasi strict).
 * @return {Object} Baris laporan setelah diperbarui.
 * @throws {Error} Jika validasi gagal atau laporan tidak ditemukan.
 */
function updateReport(reportId, updates) {
  if (isEmpty(reportId)) {
    throw new Error('ReportService.updateReport: "reportId" wajib diisi.');
  }
  if (!updates || typeof updates !== 'object') {
    throw new Error('ReportService.updateReport: "updates" wajib diisi dan bertipe object.');
  }

  var blockedFields = [
    'report_id', 'report_number', 'reporter_id', 'status', 'is_active',
    'created_at', 'verified_at', 'assigned_at', 'started_at', 'completed_at',
    'closed_at', 'system_priority'
  ];
  for (var b = 0; b < blockedFields.length; b++) {
    if (Object.prototype.hasOwnProperty.call(updates, blockedFields[b])) {
      throw new Error(
        'ReportService.updateReport: "' + blockedFields[b] + '" tidak dapat diubah lewat updateReport(). ' +
        'Kolom ini dikelola oleh createReport()/ReportWorkflowService/deactivateReport().'
      );
    }
  }
  if (isEmpty(updates.performed_by)) {
    throw new Error('ReportService.updateReport: "performed_by" wajib diisi.');
  }
  reportValidateActiveUser_(updates.performed_by, 'performed_by');

  var existingReport = getReportById(reportId);
  if (!existingReport) {
    throw new Error('ReportService.updateReport: Laporan tidak ditemukan: "' + reportId + '".');
  }

  var patch = {};
  var changedFields = [];

  if (Object.prototype.hasOwnProperty.call(updates, 'location_id')) {
    reportValidateActiveLocation_(updates.location_id);
    patch.location_id = updates.location_id;
    changedFields.push('location_id');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'category_id')) {
    reportValidateActiveCategory_(updates.category_id);
    patch.category_id = updates.category_id;
    changedFields.push('category_id');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'facility_id')) {
    if (!isEmpty(updates.facility_id)) {
      reportValidateActiveFacility_(updates.facility_id);
    }
    patch.facility_id = updates.facility_id || '';
    changedFields.push('facility_id');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'owner_id')) {
    if (!isEmpty(updates.owner_id)) {
      reportValidateActiveOwner_(updates.owner_id);
    }
    patch.owner_id = updates.owner_id || '';
    changedFields.push('owner_id');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'duplicate_of_report_id')) {
    if (!isEmpty(updates.duplicate_of_report_id)) {
      reportValidateExistingReport_(updates.duplicate_of_report_id);
    }
    patch.duplicate_of_report_id = updates.duplicate_of_report_id || '';
    changedFields.push('duplicate_of_report_id');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'condition')) {
    patch.condition = updates.condition || '';
    changedFields.push('condition');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
    if (isEmpty(updates.description)) {
      throw new Error('ReportService.updateReport: "description" tidak boleh dikosongkan.');
    }
    patch.description = updates.description.trim();
    changedFields.push('description');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'impact_level')) {
    patch.impact_level = updates.impact_level || '';
    changedFields.push('impact_level');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'safety_risk')) {
    patch.safety_risk = updates.safety_risk || '';
    changedFields.push('safety_risk');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'priority')) {
    patch.priority = updates.priority || '';
    changedFields.push('priority');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'priority_override_reason')) {
    patch.priority_override_reason = updates.priority_override_reason || '';
    changedFields.push('priority_override_reason');
  }

  patch.updated_at = nowTimestamp();

  var updatedReport = updateRowById(CONFIG.SHEETS.REPORTS, 'report_id', reportId, patch);

  reportHistoryRecord_({
    report_id: reportId,
    previous_status: existingReport.status,
    new_status: existingReport.status,
    action: 'UPDATE',
    notes: changedFields.length > 0 ? 'Kolom diperbarui: ' + changedFields.join(', ') + '.' : 'Tidak ada kolom yang diubah.',
    performed_by: updates.performed_by
  });

  return updatedReport;
}

/**
 * Menonaktifkan laporan (soft delete). Tidak menghapus baris data, tidak
 * mengubah status workflow. Mencatat satu entri riwayat DEACTIVATE.
 *
 * @param {string} reportId ID laporan yang dinonaktifkan.
 * @param {string} performedBy Referensi ke 01_users — pengguna yang
 *   melakukan penonaktifan, wajib dan divalidasi aktif.
 * @return {Object} Baris laporan setelah dinonaktifkan.
 * @throws {Error} Jika argumen kosong atau laporan tidak ditemukan.
 */
function deactivateReport(reportId, performedBy) {
  if (isEmpty(reportId)) {
    throw new Error('ReportService.deactivateReport: "reportId" wajib diisi.');
  }
  if (isEmpty(performedBy)) {
    throw new Error('ReportService.deactivateReport: "performedBy" wajib diisi.');
  }
  reportValidateActiveUser_(performedBy, 'performedBy');

  var existingReport = getReportById(reportId);
  if (!existingReport) {
    throw new Error('ReportService.deactivateReport: Laporan tidak ditemukan: "' + reportId + '".');
  }

  var deactivatedReport = updateRowById(CONFIG.SHEETS.REPORTS, 'report_id', reportId, {
    is_active: false,
    updated_at: nowTimestamp()
  });

  reportHistoryRecord_({
    report_id: reportId,
    previous_status: existingReport.status,
    new_status: existingReport.status,
    action: 'DEACTIVATE',
    notes: 'Laporan dinonaktifkan.',
    performed_by: performedBy
  });

  return deactivatedReport;
}

/**
 * Memvalidasi bahwa suatu nilai status merupakan nilai kanonik
 * CONFIG.REPORT_STATUS.
 * @param {string} status Nilai status yang diperiksa.
 * @throws {Error} Jika status kosong atau tidak dikenal sistem.
 * @private
 */
function reportValidateStatusValue_(status) {
  if (isEmpty(status)) {
    throw new Error('ReportService: "status" wajib diisi.');
  }
  var validStatuses = Object.keys(CONFIG.REPORT_STATUS).map(function (key) { return CONFIG.REPORT_STATUS[key]; });
  if (validStatuses.indexOf(status) === -1) {
    throw new Error(
      'ReportService: "status" tidak dikenal sistem: "' + status + '". Status yang valid: ' + validStatuses.join(', ') + '.'
    );
  }
}

/**
 * Memvalidasi bahwa suatu user_id diisi dan merujuk pengguna yang ada
 * serta berstatus aktif. Dipakai untuk field yang merepresentasikan
 * AKSI BARU (reporter_id saat create, performed_by saat update/deactivate/
 * transisi status) — bukan untuk memvalidasi ulang referensi lama yang
 * tidak sedang diubah (lihat catatan LEGACY COMPATIBILITY di header file).
 *
 * @param {string} userId ID pengguna yang diperiksa.
 * @param {string} fieldLabel Nama field untuk pesan error, mis. "reporter_id".
 * @throws {Error} Jika userId kosong, tidak ditemukan, atau tidak aktif.
 * @private
 */
function reportValidateActiveUser_(userId, fieldLabel) {
  if (isEmpty(userId)) {
    throw new Error('ReportService: "' + fieldLabel + '" wajib diisi.');
  }
  var user = getRowById(CONFIG.SHEETS.USERS, 'user_id', userId);
  if (!user) {
    throw new Error('ReportService: "' + fieldLabel + '" tidak ditemukan: "' + userId + '".');
  }
  if (user.is_active !== true) {
    throw new Error('ReportService: "' + fieldLabel + '" tidak aktif: "' + userId + '".');
  }
}

/**
 * Memvalidasi bahwa location_id diisi dan merujuk lokasi yang ada serta
 * berstatus aktif.
 * @param {string} locationId ID lokasi yang diperiksa.
 * @throws {Error} Jika locationId kosong, tidak ditemukan, atau tidak aktif.
 * @private
 */
function reportValidateActiveLocation_(locationId) {
  if (isEmpty(locationId)) {
    throw new Error('ReportService: "location_id" wajib diisi.');
  }
  var location = getRowById(CONFIG.SHEETS.LOCATIONS, 'location_id', locationId);
  if (!location) {
    throw new Error('ReportService: "location_id" tidak ditemukan: "' + locationId + '".');
  }
  if (location.is_active !== true) {
    throw new Error('ReportService: "location_id" tidak aktif: "' + locationId + '".');
  }
}

/**
 * Memvalidasi bahwa category_id diisi dan merujuk kategori yang ada serta
 * berstatus aktif.
 * @param {string} categoryId ID kategori yang diperiksa.
 * @throws {Error} Jika categoryId kosong, tidak ditemukan, atau tidak aktif.
 * @private
 */
function reportValidateActiveCategory_(categoryId) {
  if (isEmpty(categoryId)) {
    throw new Error('ReportService: "category_id" wajib diisi.');
  }
  var category = getRowById(CONFIG.SHEETS.CATEGORIES, 'category_id', categoryId);
  if (!category) {
    throw new Error('ReportService: "category_id" tidak ditemukan: "' + categoryId + '".');
  }
  if (category.is_active !== true) {
    throw new Error('ReportService: "category_id" tidak aktif: "' + categoryId + '".');
  }
}

/**
 * Memvalidasi bahwa facility_id (jika diisi) merujuk facility yang ada
 * serta berstatus aktif. Pemanggil bertanggung jawab memeriksa
 * isEmpty(facilityId) lebih dulu jika facility_id memang opsional pada
 * konteks tersebut (lihat createReport/updateReport).
 * @param {string} facilityId ID facility yang diperiksa.
 * @throws {Error} Jika facility tidak ditemukan atau tidak aktif.
 * @private
 */
function reportValidateActiveFacility_(facilityId) {
  var facility = getRowById(CONFIG.SHEETS.FACILITIES, 'facility_id', facilityId);
  if (!facility) {
    throw new Error('ReportService: "facility_id" tidak ditemukan: "' + facilityId + '".');
  }
  if (facility.is_active !== true) {
    throw new Error('ReportService: "facility_id" tidak aktif: "' + facilityId + '".');
  }
}

/**
 * Memvalidasi bahwa owner_id (jika diisi) merujuk owner yang ada serta
 * berstatus aktif.
 * @param {string} ownerId ID owner yang diperiksa.
 * @throws {Error} Jika owner tidak ditemukan atau tidak aktif.
 * @private
 */
function reportValidateActiveOwner_(ownerId) {
  var owner = getRowById(CONFIG.SHEETS.OWNERS, 'owner_id', ownerId);
  if (!owner) {
    throw new Error('ReportService: "owner_id" tidak ditemukan: "' + ownerId + '".');
  }
  if (owner.is_active !== true) {
    throw new Error('ReportService: "owner_id" tidak aktif: "' + ownerId + '".');
  }
}

/**
 * Memvalidasi bahwa duplicate_of_report_id (jika diisi) merujuk laporan
 * yang benar-benar ADA — TIDAK mensyaratkan is_active/status tertentu,
 * karena laporan duplikat boleh merujuk laporan lama yang sudah CLOSED
 * atau bahkan dinonaktifkan.
 * @param {string} reportId ID laporan yang diperiksa.
 * @throws {Error} Jika laporan tidak ditemukan.
 * @private
 */
function reportValidateExistingReport_(reportId) {
  var report = getRowById(CONFIG.SHEETS.REPORTS, 'report_id', reportId);
  if (!report) {
    throw new Error('ReportService: "duplicate_of_report_id" tidak ditemukan: "' + reportId + '".');
  }
}
