/**
 * SequenceCompatibilitySmokeTest.gs
 *
 * Manual smoke test untuk PHASE 3.75 — Legacy-Compatible Repository
 * Reconciliation, khusus memverifikasi SEQUENCE COMPATIBILITY LAYER pada
 * core/SequenceService.gs: bahwa deteksi alias kolom (`sequence_name`/
 * `sequence_key`, `current_value`/`last_value`) benar-benar berfungsi
 * terhadap sheet 91_sequences yang SUNGGUHAN — apa pun varian nama kolom
 * yang dipakainya — bukan cuma terhadap mock.
 *
 * Dijalankan MANUAL dari editor Apps Script (pilih fungsi
 * runSequenceCompatibilitySmokeTest pada dropdown fungsi, lalu Run).
 *
 * Aman dijalankan berulang kali terhadap spreadsheet produksi:
 * - HANYA memakai CONFIG.SEQUENCES.CORE_TEST (sequence khusus testing,
 *   terpisah dari sequence produksi REPORT/HISTORY/AUDIT/USER/dst.).
 * - Tidak menghapus/menimpa baris apa pun.
 * - Test 1 murni read-only (membaca header sheet 91_sequences).
 * - Test 2 & 3 menambah nilai CORE_TEST sebanyak 1 setiap dijalankan
 *   (bukan operasi destruktif — hanya increment counter khusus testing).
 *
 * Berbeda dari coreSmokeTestSequenceIncrement_() pada CoreSmokeTest.gs
 * (yang menguji monotonicity secara umum), test ini fokus SPESIFIK pada
 * mekanisme compatibility layer: kolom alias mana yang benar-benar
 * terdeteksi pada sheet nyata, dan memastikan read-modify-write tetap
 * konsisten lewat kolom yang terdeteksi tersebut.
 *
 * Dependency: core/Config.gs, core/DatabaseService.gs, core/SequenceService.gs
 *
 * Referensi: docs/DATABASE_SCHEMA.md (91_sequences), docs/DATABASE_SETUP.md
 */

/**
 * Menjalankan seluruh smoke test compatibility sequence secara berurutan
 * dan mencetak ringkasan hasil ke Logger.
 * @return {Array<Object>} Daftar hasil tiap test ({label, passed, detail}).
 */
function runSequenceCompatibilitySmokeTest() {
  var results = [];

  sequenceCompatSmokeTestRun_(results, '1. Header 91_sequences terbaca, alias kolom kunci/nilai terdeteksi', sequenceCompatSmokeTestDetectAliases_);
  sequenceCompatSmokeTestRun_(results, '2. getNextSequence(CORE_TEST) baca-tulis konsisten melalui kolom yang terdeteksi', sequenceCompatSmokeTestReadModifyWrite_);
  sequenceCompatSmokeTestRun_(results, '3. generateEntityId(CORE_TEST) tetap berfungsi lewat compatibility layer', sequenceCompatSmokeTestGenerateEntityId_);

  sequenceCompatSmokeTestPrintSummary_(results);
  return results;
}

/** @private */
function sequenceCompatSmokeTestRun_(results, label, testFn) {
  try {
    var detail = testFn();
    results.push({ label: label, passed: true, detail: detail || '' });
    Logger.log('[PASS] ' + label + (detail ? ' -> ' + detail : ''));
  } catch (e) {
    results.push({ label: label, passed: false, detail: e.message });
    Logger.log('[FAIL] ' + label + ' -> ' + e.message);
  }
}

/** @private */
function sequenceCompatSmokeTestPrintSummary_(results) {
  var passCount = results.filter(function (r) { return r.passed; }).length;
  var failCount = results.length - passCount;
  Logger.log('==============================================');
  Logger.log('SEQUENCE COMPATIBILITY SMOKE TEST SUMMARY: ' + passCount + ' PASS, ' + failCount + ' FAIL (total ' + results.length + ')');
  Logger.log('==============================================');
}

/**
 * TEST 1 (read-only): membaca header sheet 91_sequences secara langsung
 * dan memastikan salah satu alias kolom kunci ("sequence_name" atau
 * "sequence_key") DAN salah satu alias kolom nilai ("current_value" atau
 * "last_value") ditemukan — melaporkan alias mana yang sebenarnya dipakai
 * sheet ini.
 * @return {string} Detail hasil test.
 * @private
 */
function sequenceCompatSmokeTestDetectAliases_() {
  var sheet = getSheetByName(CONFIG.SHEETS.SEQUENCES);
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  var keyAlias = sequenceFindColumnIndex_(headers, SEQUENCE_SHEET_COLUMNS_.KEY_ALIASES) !== -1
    ? headers[sequenceFindColumnIndex_(headers, SEQUENCE_SHEET_COLUMNS_.KEY_ALIASES)]
    : null;
  var valueAlias = sequenceFindColumnIndex_(headers, SEQUENCE_SHEET_COLUMNS_.VALUE_ALIASES) !== -1
    ? headers[sequenceFindColumnIndex_(headers, SEQUENCE_SHEET_COLUMNS_.VALUE_ALIASES)]
    : null;

  if (!keyAlias || !valueAlias) {
    throw new Error(
      'Tidak ada alias kolom kunci/nilai yang cocok pada header sheet "' + CONFIG.SHEETS.SEQUENCES +
      '": [' + headers.join(', ') + ']. Diharapkan salah satu dari KEY_ALIASES=[' +
      SEQUENCE_SHEET_COLUMNS_.KEY_ALIASES.join(', ') + '] dan VALUE_ALIASES=[' +
      SEQUENCE_SHEET_COLUMNS_.VALUE_ALIASES.join(', ') + '].'
    );
  }

  return 'kolom kunci terdeteksi = "' + keyAlias + '", kolom nilai terdeteksi = "' + valueAlias + '"';
}

/**
 * TEST 2: memanggil getNextSequence(CORE_TEST) sekali, lalu membaca ULANG
 * baris sequence tersebut secara langsung dari sheet (bypass
 * SequenceService) untuk memastikan nilai yang dikembalikan getNextSequence()
 * benar-benar tersimpan pada kolom yang terdeteksi Test 1 — bukti bahwa
 * proses baca-ubah-tulis konsisten lewat alias yang dipakai sheet nyata.
 * @return {string} Detail hasil test.
 * @private
 */
function sequenceCompatSmokeTestReadModifyWrite_() {
  var before = getNextSequence(CONFIG.SEQUENCES.CORE_TEST);
  var after = getNextSequence(CONFIG.SEQUENCES.CORE_TEST);

  if (after !== before + 1) {
    throw new Error('CORE_TEST tidak monoton: sebelum=' + before + ', sesudah=' + after + ' (seharusnya ' + (before + 1) + ').');
  }

  // Verifikasi independen: baca langsung dari sheet, bypass SequenceService,
  // untuk memastikan nilai yang dilaporkan getNextSequence() benar-benar
  // persisten di sheet (bukan cuma nilai in-memory).
  var sheet = getSheetByName(CONFIG.SHEETS.SEQUENCES);
  var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  var keyColIndex = sequenceFindColumnIndex_(headers, SEQUENCE_SHEET_COLUMNS_.KEY_ALIASES);
  var valueColIndex = sequenceFindColumnIndex_(headers, SEQUENCE_SHEET_COLUMNS_.VALUE_ALIASES);
  var lastRow = sheet.getLastRow();
  var rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var persistedValue = null;

  for (var i = 0; i < rows.length; i++) {
    if (rows[i][keyColIndex] === CONFIG.SEQUENCES.CORE_TEST) {
      persistedValue = Number(rows[i][valueColIndex]);
      break;
    }
  }

  if (persistedValue !== after) {
    throw new Error(
      'Nilai yang dipersist di sheet (' + persistedValue + ') tidak cocok dengan hasil getNextSequence() (' + after + ').'
    );
  }

  return 'CORE_TEST naik dari ' + before + ' ke ' + after + ', tervalidasi tersimpan langsung di kolom "' + headers[valueColIndex] + '".';
}

/**
 * TEST 3: memastikan generateEntityId() dengan sequence CORE_TEST tetap
 * menghasilkan format "PREFIX-000001" yang benar melalui compatibility
 * layer (fungsi tingkat-tinggi tidak terpengaruh oleh varian nama kolom
 * di bawahnya).
 * @return {string} Detail hasil test.
 * @private
 */
function sequenceCompatSmokeTestGenerateEntityId_() {
  var id = generateEntityId(CONFIG.ID_PREFIXES.CORE_TEST, CONFIG.SEQUENCES.CORE_TEST);
  var pattern = new RegExp('^' + CONFIG.ID_PREFIXES.CORE_TEST + '-\\d{6}$');

  if (!pattern.test(id)) {
    throw new Error('Format ID tidak sesuai "PREFIX-000001": didapat "' + id + '".');
  }

  return 'ID dihasilkan lewat compatibility layer: ' + id;
}
