/**
 * ReportEngineSmokeTest.gs
 *
 * Manual smoke test untuk PHASE 4 — Legacy-Compatible Report Engine
 * (ReportService, ReportWorkflowService, ReportHistoryService). Dijalankan
 * MANUAL dari editor Apps Script (pilih fungsi runReportEngineSmokeTest
 * pada dropdown fungsi, lalu Run).
 *
 * PENTING — VALIDASI YANG SUDAH DILAKUKAN vs. YANG MASIH DIPERLUKAN:
 * File ini divalidasi pengembang HANYA melalui MOCK GAS environment
 * (Node.js, lihat laporan PHASE 4 bagian H — TEST RESULTS) — BUKAN
 * dijalankan terhadap Apps Script/Spreadsheet nyata. REAL ENVIRONMENT
 * VALIDATION (menjalankan runReportEngineSmokeTest() ini sesungguhnya dari
 * editor Apps Script, terhadap database produksi) MASIH DIPERLUKAN sebelum
 * Report Engine dianggap tervalidasi penuh di lingkungan nyata.
 *
 * Aman dijalankan berulang kali, TETAPI perlu disadari:
 * - Membuat entitas Master Data (TEST_ user/location/category/facility/
 *   owner) sungguhan pada sheet produksi, seluruhnya diberi awalan "TEST_"
 *   dan DINONAKTIFKAN (soft delete via is_active) di akhir pengujian —
 *   sama seperti pola MasterDataSmokeTest.gs.
 * - Membuat laporan (10_reports) sungguhan diberi awalan "TEST_" pada
 *   kolom description, dan DINONAKTIFKAN di akhir pengujian.
 * - Membuat entri riwayat (12_report_history) sungguhan yang TIDAK dapat
 *   dinonaktifkan/dihapus — schema 12_report_history TIDAK memiliki kolom
 *   is_active (bersifat append-only sesuai desain, lihat
 *   docs/DATABASE_SCHEMA.md). Entri ini tetap ada permanen, tetapi dapat
 *   dikenali dari catatan (notes) yang memuat awalan "TEST_" dan dari
 *   report_id yang bersangkutan. Lihat laporan PHASE 4 bagian TECHNICAL
 *   DEBT untuk catatan ini.
 * - Menambah nilai sequence PRODUKSI "REPORT" dan "HISTORY" sebanyak
 *   beberapa kali (bukan sequence khusus testing — Report Engine memang
 *   tidak punya sequence terpisah untuk testing, sama seperti
 *   generateReportNumber() pada CoreSmokeTest.gs). Ini BUKAN operasi
 *   destruktif, tetapi menambah counter produksi secara permanen setiap
 *   eksekusi.
 * - Tidak melakukan hard delete atau operasi destruktif apa pun terhadap
 *   data lain.
 *
 * Test ini TIDAK menguji Audit (belum diimplementasikan, lihat
 * docs/DEVELOPMENT_ROADMAP.md PHASE 5) maupun Photo/Comment Engine (di
 * luar scope PHASE 4, lihat laporan PHASE 4 bagian N).
 *
 * Regresi terhadap Core/Master Data/Inspector/Sequence Compatibility
 * SENGAJA TIDAK dipanggil dari dalam file ini (untuk menghindari efek
 * samping berganda yang tidak perlu terhadap data pengujian domain lain
 * setiap kali Report Engine diuji) — jalankan runCoreSmokeTest(),
 * runMasterDataSmokeTest(), runInspectDatabaseSmokeTest(), dan
 * runSequenceCompatibilitySmokeTest() secara terpisah sebagai regresi.
 *
 * Dependency: seluruh modul core/, apps-script/users/UserService.gs,
 * apps-script/master-data/*.gs, apps-script/reports/*.gs
 */

/**
 * Menjalankan seluruh smoke test Report Engine secara berurutan dan
 * mencetak ringkasan hasil ke Logger.
 *
 * @return {Array<Object>} Daftar hasil tiap test ({label, passed, detail}).
 */
function runReportEngineSmokeTest() {
  var results = [];
  var ctx = { runId: String(new Date().getTime()) };

  reportEngineSmokeTestSetupFixtures_(results, ctx);
  reportEngineSmokeTestCreateAndValidation_(results, ctx);
  reportEngineSmokeTestRetrievalListing_(results, ctx);
  reportEngineSmokeTestUpdate_(results, ctx);
  reportEngineSmokeTestWorkflow_(results, ctx);
  reportEngineSmokeTestLegacyOrphan_(results, ctx);
  reportEngineSmokeTestCleanup_(results, ctx);

  reportEngineSmokeTestPrintSummary_(results);
  return results;
}

/** @private */
function reportEngineSmokeTestCheck_(results, label, fn) {
  try {
    fn();
    results.push({ label: label, passed: true });
    Logger.log('[PASS] ' + label);
  } catch (e) {
    results.push({ label: label, passed: false, detail: e.message });
    Logger.log('[FAIL] ' + label + ' -> ' + e.message);
  }
}

/** @private */
function reportEngineSmokeTestExpectThrow_(results, label, fn) {
  try {
    fn();
    results.push({ label: label, passed: false, detail: 'Seharusnya melempar Error, tetapi tidak.' });
    Logger.log('[FAIL] ' + label + ' -> seharusnya melempar Error, tetapi tidak.');
  } catch (e) {
    results.push({ label: label, passed: true, detail: e.message });
    Logger.log('[PASS] ' + label + ' -> ditolak dengan benar: ' + e.message);
  }
}

/** @private */
function reportEngineSmokeTestAssertEqual_(actual, expected, label) {
  var actualStr = JSON.stringify(actual);
  var expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(label + ': didapat ' + actualStr + ', diharapkan ' + expectedStr);
  }
}

/** @private */
function reportEngineSmokeTestPrintSummary_(results) {
  var passCount = results.filter(function (r) { return r.passed; }).length;
  var failCount = results.length - passCount;

  Logger.log('==============================================');
  Logger.log('REPORT ENGINE SMOKE TEST SUMMARY: ' + passCount + ' PASS, ' + failCount + ' FAIL (total ' + results.length + ')');
  Logger.log('==============================================');

  if (failCount > 0) {
    Logger.log('Terdapat kegagalan pada Report Engine. Perbaiki sebelum menyatakan validation gate PHASE 4 PASS.');
  } else {
    Logger.log('Seluruh smoke test Report Engine lolos.');
  }
}

// ---------------------------------------------------------------------
// FIXTURES — Master Data pendukung (dibuat via service resmi, bukan
// insertRow langsung, agar konsisten dengan validasi domain Master Data)
// ---------------------------------------------------------------------

/** @private */
function reportEngineSmokeTestSetupFixtures_(results, ctx) {
  reportEngineSmokeTestCheck_(results, 'Fixture. Membuat TEST_ user (reporter/performer)', function () {
    ctx.user = createUser({
      email: 'test_report_' + ctx.runId + '@example.com',
      full_name: 'TEST_Reporter ' + ctx.runId,
      role: CONFIG.ROLES.GURU
    });
  });

  reportEngineSmokeTestCheck_(results, 'Fixture. Membuat TEST_ location', function () {
    ctx.location = createLocation({ location_name: 'TEST_Ruang ' + ctx.runId, location_type: 'RUANG_KELAS' });
  });

  reportEngineSmokeTestCheck_(results, 'Fixture. Membuat TEST_ location tidak aktif (untuk negative test)', function () {
    var inactiveLocation = createLocation({ location_name: 'TEST_Ruang Nonaktif ' + ctx.runId, location_type: 'RUANG_KELAS' });
    ctx.inactiveLocation = deactivateLocation(inactiveLocation.location_id);
  });

  reportEngineSmokeTestCheck_(results, 'Fixture. Membuat TEST_ category', function () {
    ctx.category = createCategory({ category_name: 'TEST_Kategori ' + ctx.runId });
  });

  reportEngineSmokeTestCheck_(results, 'Fixture. Membuat TEST_ facility', function () {
    ctx.facility = createFacility({ category_id: ctx.category.category_id, facility_name: 'TEST_Facility ' + ctx.runId });
  });

  reportEngineSmokeTestCheck_(results, 'Fixture. Membuat TEST_ owner', function () {
    ctx.owner = createOwner({ owner_name: 'TEST_Owner ' + ctx.runId });
  });
}

// ---------------------------------------------------------------------
// CREATE + VALIDATION (strict referential validation, lihat section E/M
// laporan PHASE 4)
// ---------------------------------------------------------------------

/** @private */
function reportEngineSmokeTestCreateAndValidation_(results, ctx) {
  reportEngineSmokeTestCheck_(results, 'Create 1. createReport() dengan data valid', function () {
    ctx.report = createReport({
      reporter_id: ctx.user.user_id,
      location_id: ctx.location.location_id,
      category_id: ctx.category.category_id,
      facility_id: ctx.facility.facility_id,
      owner_id: ctx.owner.owner_id,
      condition: 'TEST_Kondisi ' + ctx.runId,
      description: 'TEST_Deskripsi laporan ' + ctx.runId
    });
    reportEngineSmokeTestAssertEqual_(ctx.report.status, CONFIG.REPORT_STATUS.SUBMITTED, 'status awal SUBMITTED');
    reportEngineSmokeTestAssertEqual_(ctx.report.is_active, true, 'is_active default true');
  });

  reportEngineSmokeTestCheck_(results, 'Create 2. report_id berformat "RPT-000001"', function () {
    var pattern = new RegExp('^' + CONFIG.ID_PREFIXES.REPORT + '-\\d{6}$');
    if (!pattern.test(ctx.report.report_id)) {
      throw new Error('Format report_id tidak sesuai: "' + ctx.report.report_id + '".');
    }
  });

  reportEngineSmokeTestCheck_(results, 'Create 3. report_number berformat "SRP-YYYY-000001"', function () {
    var pattern = /^SRP-\d{4}-\d{6}$/;
    if (!pattern.test(ctx.report.report_number)) {
      throw new Error('Format report_number tidak sesuai: "' + ctx.report.report_number + '".');
    }
  });

  reportEngineSmokeTestCheck_(results, 'Create 4. Sequence REPORT monoton — laporan kedua bernomor lebih besar', function () {
    var secondReport = createReport({
      reporter_id: ctx.user.user_id,
      location_id: ctx.location.location_id,
      category_id: ctx.category.category_id,
      description: 'TEST_Deskripsi laporan kedua ' + ctx.runId
    });
    var firstIdNumber = Number(ctx.report.report_id.split('-')[1]);
    var secondIdNumber = Number(secondReport.report_id.split('-')[1]);
    if (!(secondIdNumber > firstIdNumber)) {
      throw new Error('Sequence report_id tidak naik: pertama=' + firstIdNumber + ', kedua=' + secondIdNumber + '.');
    }
    ctx.secondReport = secondReport;
  });

  reportEngineSmokeTestExpectThrow_(results, 'Create 5. Validation failure — description kosong ditolak', function () {
    createReport({
      reporter_id: ctx.user.user_id,
      location_id: ctx.location.location_id,
      category_id: ctx.category.category_id
    });
  });

  reportEngineSmokeTestExpectThrow_(results, 'Create 5. Validation failure — category_id kosong ditolak', function () {
    createReport({
      reporter_id: ctx.user.user_id,
      location_id: ctx.location.location_id,
      description: 'TEST_X'
    });
  });

  reportEngineSmokeTestExpectThrow_(results, 'Create 6. Invalid reference — reporter_id tidak ditemukan ditolak', function () {
    createReport({
      reporter_id: 'USR-TIDAK-ADA-' + ctx.runId,
      location_id: ctx.location.location_id,
      category_id: ctx.category.category_id,
      description: 'TEST_X'
    });
  });

  reportEngineSmokeTestExpectThrow_(results, 'Create 6. Invalid reference — location_id tidak aktif ditolak', function () {
    createReport({
      reporter_id: ctx.user.user_id,
      location_id: ctx.inactiveLocation.location_id,
      category_id: ctx.category.category_id,
      description: 'TEST_X'
    });
  });

  reportEngineSmokeTestExpectThrow_(results, 'Create 6. Invalid reference — facility_id tidak ditemukan ditolak', function () {
    createReport({
      reporter_id: ctx.user.user_id,
      location_id: ctx.location.location_id,
      category_id: ctx.category.category_id,
      facility_id: 'FAC-TIDAK-ADA-' + ctx.runId,
      description: 'TEST_X'
    });
  });
}

// ---------------------------------------------------------------------
// RETRIEVAL + LISTING + HISTORY
// ---------------------------------------------------------------------

/** @private */
function reportEngineSmokeTestRetrievalListing_(results, ctx) {
  reportEngineSmokeTestCheck_(results, 'Read 1. getReportById() menemukan laporan yang dibuat', function () {
    var found = getReportById(ctx.report.report_id);
    reportEngineSmokeTestAssertEqual_(found.report_id, ctx.report.report_id, 'report_id cocok');
  });

  reportEngineSmokeTestCheck_(results, 'List 1. listActiveReports() memuat laporan yang dibuat', function () {
    var active = listActiveReports();
    var found = active.some(function (r) { return r.report_id === ctx.report.report_id; });
    reportEngineSmokeTestAssertEqual_(found, true, 'laporan ditemukan di daftar aktif');
  });

  reportEngineSmokeTestCheck_(results, 'List 2. listReportsByStatus(SUBMITTED) memuat laporan yang dibuat', function () {
    var submitted = listReportsByStatus(CONFIG.REPORT_STATUS.SUBMITTED);
    var found = submitted.some(function (r) { return r.report_id === ctx.report.report_id; });
    reportEngineSmokeTestAssertEqual_(found, true, 'laporan ditemukan di daftar SUBMITTED');
  });

  reportEngineSmokeTestExpectThrow_(results, 'List 3. listReportsByStatus() menolak status tidak dikenal', function () {
    listReportsByStatus('TIDAK_DIKENAL');
  });

  reportEngineSmokeTestCheck_(results, 'History 1. listReportHistory() memuat entri CREATE', function () {
    var history = listReportHistory(ctx.report.report_id);
    var createEntry = history.filter(function (h) { return h.action === 'CREATE'; });
    reportEngineSmokeTestAssertEqual_(createEntry.length, 1, 'tepat satu entri CREATE');
    reportEngineSmokeTestAssertEqual_(createEntry[0].previous_status, '', 'previous_status kosong untuk CREATE');
    reportEngineSmokeTestAssertEqual_(createEntry[0].new_status, CONFIG.REPORT_STATUS.SUBMITTED, 'new_status SUBMITTED untuk CREATE');
  });
}

// ---------------------------------------------------------------------
// UPDATE (contextual validation)
// ---------------------------------------------------------------------

/** @private */
function reportEngineSmokeTestUpdate_(results, ctx) {
  reportEngineSmokeTestCheck_(results, 'Update 1. updateReport() memperbarui description', function () {
    var updated = updateReport(ctx.report.report_id, {
      description: 'TEST_Deskripsi diperbarui ' + ctx.runId,
      performed_by: ctx.user.user_id
    });
    reportEngineSmokeTestAssertEqual_(updated.description, 'TEST_Deskripsi diperbarui ' + ctx.runId, 'description terupdate');
  });

  reportEngineSmokeTestCheck_(results, 'Update 2. updateReport() mencatat entri riwayat UPDATE', function () {
    var history = listReportHistory(ctx.report.report_id);
    var updateEntry = history.filter(function (h) { return h.action === 'UPDATE'; });
    reportEngineSmokeTestAssertEqual_(updateEntry.length, 1, 'tepat satu entri UPDATE');
  });

  reportEngineSmokeTestExpectThrow_(results, 'Update 3. updateReport() menolak perubahan status langsung', function () {
    updateReport(ctx.report.report_id, { status: CONFIG.REPORT_STATUS.VERIFIED, performed_by: ctx.user.user_id });
  });

  reportEngineSmokeTestExpectThrow_(results, 'Update 4. updateReport() menolak category_id tidak aktif', function () {
    updateReport(ctx.report.report_id, { category_id: 'CAT-TIDAK-ADA-' + ctx.runId, performed_by: ctx.user.user_id });
  });

  reportEngineSmokeTestExpectThrow_(results, 'Update 5. updateReport() menolak tanpa performed_by', function () {
    updateReport(ctx.report.report_id, { description: 'TEST_X' });
  });
}

// ---------------------------------------------------------------------
// WORKFLOW (status transition)
// ---------------------------------------------------------------------

/** @private */
function reportEngineSmokeTestWorkflow_(results, ctx) {
  reportEngineSmokeTestCheck_(results, 'Workflow 1. Transisi legal SUBMITTED -> VERIFIED diterima', function () {
    var updated = changeReportStatus(ctx.report.report_id, CONFIG.REPORT_STATUS.VERIFIED, { performed_by: ctx.user.user_id });
    reportEngineSmokeTestAssertEqual_(updated.status, CONFIG.REPORT_STATUS.VERIFIED, 'status menjadi VERIFIED');
    if (!updated.verified_at) {
      throw new Error('verified_at tidak terisi setelah transisi ke VERIFIED.');
    }
  });

  reportEngineSmokeTestCheck_(results, 'Workflow 2. Transisi mencatat entri riwayat STATUS_CHANGE', function () {
    var history = listReportHistory(ctx.report.report_id);
    var statusChangeEntry = history.filter(function (h) { return h.action === 'STATUS_CHANGE'; });
    reportEngineSmokeTestAssertEqual_(statusChangeEntry.length, 1, 'tepat satu entri STATUS_CHANGE');
    reportEngineSmokeTestAssertEqual_(statusChangeEntry[0].previous_status, CONFIG.REPORT_STATUS.SUBMITTED, 'previous_status SUBMITTED');
    reportEngineSmokeTestAssertEqual_(statusChangeEntry[0].new_status, CONFIG.REPORT_STATUS.VERIFIED, 'new_status VERIFIED');
  });

  reportEngineSmokeTestExpectThrow_(results, 'Workflow 3. Transisi ilegal VERIFIED -> COMPLETED ditolak (melompati ASSIGNED/IN_PROGRESS)', function () {
    changeReportStatus(ctx.report.report_id, CONFIG.REPORT_STATUS.COMPLETED, { performed_by: ctx.user.user_id });
  });

  reportEngineSmokeTestExpectThrow_(results, 'Workflow 4. Transisi ilegal VERIFIED -> SUBMITTED (mundur) ditolak', function () {
    changeReportStatus(ctx.report.report_id, CONFIG.REPORT_STATUS.SUBMITTED, { performed_by: ctx.user.user_id });
  });

  reportEngineSmokeTestExpectThrow_(results, 'Workflow 5. Transisi ilegal pada laporan lain: SUBMITTED -> CLOSED ditolak (melompati seluruh tahap)', function () {
    changeReportStatus(ctx.secondReport.report_id, CONFIG.REPORT_STATUS.CLOSED, { performed_by: ctx.user.user_id });
  });

  reportEngineSmokeTestExpectThrow_(results, 'Workflow 6. changeReportStatus() menolak status tidak dikenal', function () {
    changeReportStatus(ctx.report.report_id, 'TIDAK_DIKENAL', { performed_by: ctx.user.user_id });
  });
}

// ---------------------------------------------------------------------
// LEGACY ORPHAN COMPATIBILITY
// ---------------------------------------------------------------------

/**
 * Mensimulasikan laporan LEGACY yang referensinya sudah orphan — dibuat
 * dengan insertRow() langsung (BUKAN createReport(), yang sengaja strict),
 * merepresentasikan kondisi nyata yang ditemukan pada database produksi
 * (lihat laporan PHASE 3.5/3.75: mis. RPT-000002 mereferensikan
 * USR-TEST-001/LOC-TEST-001/CAT-TEST-001/FAC-TEST-001 yang tidak ada).
 * @private
 */
function reportEngineSmokeTestLegacyOrphan_(results, ctx) {
  reportEngineSmokeTestCheck_(results, 'Legacy 1. Simulasi baris laporan legacy dengan referensi orphan', function () {
    var timestamp = nowTimestamp();
    ctx.legacyOrphanReportId = generateEntityId(CONFIG.ID_PREFIXES.REPORT, CONFIG.SEQUENCES.REPORT);
    ctx.legacyOrphanReport = insertRow(CONFIG.SHEETS.REPORTS, {
      report_id: ctx.legacyOrphanReportId,
      report_number: generateReportNumber(),
      reporter_id: 'USR-ORPHAN-LEGACY-' + ctx.runId,
      location_id: 'LOC-ORPHAN-LEGACY-' + ctx.runId,
      category_id: 'CAT-ORPHAN-LEGACY-' + ctx.runId,
      facility_id: 'FAC-ORPHAN-LEGACY-' + ctx.runId,
      condition: 'TEST_Legacy orphan condition',
      description: 'TEST_Legacy orphan report ' + ctx.runId,
      impact_level: '',
      safety_risk: '',
      system_priority: '',
      priority: '',
      priority_override_reason: '',
      status: CONFIG.REPORT_STATUS.SUBMITTED,
      owner_id: '',
      duplicate_of_report_id: '',
      created_at: timestamp,
      updated_at: timestamp,
      verified_at: '',
      assigned_at: '',
      started_at: '',
      completed_at: '',
      closed_at: '',
      is_active: true
    });
  });

  reportEngineSmokeTestCheck_(results, 'Legacy 2. getReportById() tetap berhasil membaca laporan orphan (READ COMPATIBILITY)', function () {
    var found = getReportById(ctx.legacyOrphanReportId);
    if (!found) {
      throw new Error('Laporan orphan tidak dapat dibaca kembali.');
    }
    reportEngineSmokeTestAssertEqual_(found.reporter_id, 'USR-ORPHAN-LEGACY-' + ctx.runId, 'reporter_id orphan tetap terbaca apa adanya');
  });

  reportEngineSmokeTestCheck_(results, 'Legacy 3. updateReport() pada laporan orphan berhasil untuk kolom yang TIDAK sedang diubah referensinya', function () {
    var updated = updateReport(ctx.legacyOrphanReportId, {
      description: 'TEST_Legacy orphan report diperbarui ' + ctx.runId,
      performed_by: ctx.user.user_id
    });
    reportEngineSmokeTestAssertEqual_(updated.reporter_id, 'USR-ORPHAN-LEGACY-' + ctx.runId, 'reporter_id orphan TIDAK tersentuh/tidak dipaksa valid');
    reportEngineSmokeTestAssertEqual_(updated.description, 'TEST_Legacy orphan report diperbarui ' + ctx.runId, 'description berhasil diperbarui walau reporter_id orphan');
  });

  reportEngineSmokeTestExpectThrow_(results, 'Legacy 4. updateReport() TETAP menolak jika field orphan itu sendiri yang diubah dengan nilai tidak valid', function () {
    updateReport(ctx.legacyOrphanReportId, {
      category_id: 'CAT-MASIH-TIDAK-ADA-' + ctx.runId,
      performed_by: ctx.user.user_id
    });
  });

  reportEngineSmokeTestCheck_(results, 'Legacy 5. changeReportStatus() tetap berfungsi pada laporan orphan (validasi status, bukan validasi referensi lama)', function () {
    var updated = changeReportStatus(ctx.legacyOrphanReportId, CONFIG.REPORT_STATUS.VERIFIED, { performed_by: ctx.user.user_id });
    reportEngineSmokeTestAssertEqual_(updated.status, CONFIG.REPORT_STATUS.VERIFIED, 'status laporan orphan berhasil bertransisi');
  });
}

// ---------------------------------------------------------------------
// CLEANUP — soft delete seluruh fixture (report + master data). Entri
// 12_report_history TIDAK dapat dibersihkan (tidak ada is_active pada
// schema tersebut) — lihat catatan di header file ini.
// ---------------------------------------------------------------------

/** @private */
function reportEngineSmokeTestCleanup_(results, ctx) {
  reportEngineSmokeTestCheck_(results, 'Cleanup 1. deactivateReport() pada seluruh laporan TEST_', function () {
    deactivateReport(ctx.report.report_id, ctx.user.user_id);
    deactivateReport(ctx.secondReport.report_id, ctx.user.user_id);
    deactivateReport(ctx.legacyOrphanReportId, ctx.user.user_id);
  });

  reportEngineSmokeTestCheck_(results, 'Cleanup 2. Menonaktifkan fixture Master Data TEST_', function () {
    deactivateFacility(ctx.facility.facility_id);
    deactivateCategory(ctx.category.category_id);
    deactivateLocation(ctx.location.location_id);
    deactivateOwner(ctx.owner.owner_id);
    deactivateUser(ctx.user.user_id);
  });
}
