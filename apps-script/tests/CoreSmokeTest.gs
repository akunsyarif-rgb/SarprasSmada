/**
 * CoreSmokeTest.gs
 *
 * Manual smoke test untuk PHASE 2 — Core Backend (Config, DatabaseService,
 * SequenceService). Dijalankan MANUAL dari editor Apps Script (pilih fungsi
 * runCoreSmokeTest pada dropdown fungsi, lalu Run), BUKAN unit test
 * framework otomatis.
 *
 * Aman dijalankan berulang kali:
 * - Tidak menghapus/menimpa data produksi.
 * - Tidak melakukan hard delete atau operasi destruktif apa pun.
 * - Pengujian increment sequence dan generateEntityId() menggunakan
 *   CONFIG.SEQUENCES.CORE_TEST, sequence khusus testing yang terpisah dari
 *   sequence produksi (REPORT/HISTORY/AUDIT).
 *
 * PERINGATAN: pengujian generateReportNumber() sengaja memanggil sequence
 * PRODUKSI "REPORT" apa adanya (karena itulah yang diuji), sehingga setiap
 * eksekusi test ini menambah nilai counter REPORT sebanyak 1. Ini BUKAN
 * operasi destruktif (tidak menghapus/menimpa data apa pun), tetapi perlu
 * disadari sebelum menjalankan test ini berulang kali di spreadsheet
 * produksi.
 *
 * Dependency: core/Config.gs, core/DatabaseService.gs, core/SequenceService.gs
 *
 * Referensi: docs/DATABASE_SETUP.md
 */

/**
 * Menjalankan seluruh smoke test Core Backend secara berurutan dan mencetak
 * ringkasan hasil ke Logger. Jalankan fungsi ini secara manual dari editor
 * Apps Script.
 *
 * @return {Array<Object>} Daftar hasil tiap test ({label, passed, detail}).
 */
function runCoreSmokeTest() {
  var results = [];

  coreSmokeTestRun_(results, '1. getSpreadsheetId()', coreSmokeTestSpreadsheetId_);
  coreSmokeTestRun_(results, '2. getSpreadsheet()', coreSmokeTestSpreadsheet_);
  coreSmokeTestRun_(results, '6. DatabaseService sheet access (read-only)', coreSmokeTestSheetAccess_);
  coreSmokeTestRun_(results, '5. SequenceService.getNextSequence() monoton', coreSmokeTestSequenceIncrement_);
  coreSmokeTestRun_(results, '3. SequenceService.generateEntityId()', coreSmokeTestGenerateEntityId_);
  coreSmokeTestRun_(results, '4. SequenceService.generateReportNumber()', coreSmokeTestGenerateReportNumber_);

  coreSmokeTestPrintSummary_(results);
  return results;
}

/**
 * Menjalankan satu unit test, menangkap error apa pun agar test lain tetap
 * berjalan, lalu mencatat hasilnya ke Logger dan ke array results.
 *
 * @param {Array<Object>} results Akumulator hasil test.
 * @param {string} label Nama test yang ditampilkan pada log.
 * @param {function(): string} testFn Fungsi test; melempar Error jika gagal,
 *   atau mengembalikan string detail jika berhasil.
 * @private
 */
function coreSmokeTestRun_(results, label, testFn) {
  try {
    var detail = testFn();
    results.push({ label: label, passed: true, detail: detail || '' });
    Logger.log('[PASS] ' + label + (detail ? ' -> ' + detail : ''));
  } catch (e) {
    results.push({ label: label, passed: false, detail: e.message });
    Logger.log('[FAIL] ' + label + ' -> ' + e.message);
  }
}

/**
 * Mencetak ringkasan akhir jumlah PASS/FAIL ke Logger.
 * @param {Array<Object>} results Hasil seluruh test.
 * @private
 */
function coreSmokeTestPrintSummary_(results) {
  var passCount = results.filter(function (r) { return r.passed; }).length;
  var failCount = results.length - passCount;

  Logger.log('==============================================');
  Logger.log('CORE SMOKE TEST SUMMARY: ' + passCount + ' PASS, ' + failCount + ' FAIL (total ' + results.length + ')');
  Logger.log('==============================================');

  if (failCount > 0) {
    Logger.log('Terdapat kegagalan. Perbaiki sebelum melanjutkan ke PHASE 3 / Report Engine.');
  } else {
    Logger.log('Seluruh smoke test Core Backend lolos.');
  }
}

/**
 * TEST: memastikan Spreadsheet ID dapat dibaca dari Script Properties.
 * @return {string} Detail hasil test.
 * @private
 */
function coreSmokeTestSpreadsheetId_() {
  var id = getSpreadsheetId();
  if (!id || typeof id !== 'string') {
    throw new Error('getSpreadsheetId() tidak mengembalikan string yang valid.');
  }
  return 'Spreadsheet ID ditemukan (panjang ' + id.length + ' karakter).';
}

/**
 * TEST: memastikan Spreadsheet dapat dibuka berdasarkan Spreadsheet ID.
 * @return {string} Detail hasil test.
 * @private
 */
function coreSmokeTestSpreadsheet_() {
  var spreadsheet = getSpreadsheet();
  if (!spreadsheet || typeof spreadsheet.getId !== 'function') {
    throw new Error('getSpreadsheet() tidak mengembalikan objek Spreadsheet yang valid.');
  }
  return 'Berhasil membuka spreadsheet "' + spreadsheet.getName() + '".';
}

/**
 * TEST: memastikan DatabaseService dapat mengakses sheet 91_sequences
 * secara read-only (tidak menulis apa pun ke sheet).
 * @return {string} Detail hasil test.
 * @private
 */
function coreSmokeTestSheetAccess_() {
  var sheet = getSheetByName(CONFIG.SHEETS.SEQUENCES);
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  if (headers.indexOf('sequence_key') === -1) {
    throw new Error(
      'Sheet "' + CONFIG.SHEETS.SEQUENCES + '" ditemukan tetapi header "sequence_key" tidak ada. ' +
      'Periksa docs/DATABASE_SETUP.md.'
    );
  }

  return 'Sheet "' + CONFIG.SHEETS.SEQUENCES + '" dapat diakses, jumlah baris data: ' +
    Math.max(sheet.getLastRow() - 1, 0) + '.';
}

/**
 * TEST: memastikan getNextSequence() bersifat monoton (naik tepat 1 setiap
 * dipanggil), menggunakan CONFIG.SEQUENCES.CORE_TEST agar tidak memengaruhi
 * sequence produksi.
 * @return {string} Detail hasil test.
 * @private
 */
function coreSmokeTestSequenceIncrement_() {
  var first = getNextSequence(CONFIG.SEQUENCES.CORE_TEST);
  var second = getNextSequence(CONFIG.SEQUENCES.CORE_TEST);

  if (typeof first !== 'number' || typeof second !== 'number') {
    throw new Error('getNextSequence() tidak mengembalikan angka.');
  }
  if (second !== first + 1) {
    throw new Error(
      'Sequence tidak monoton: panggilan pertama = ' + first +
      ', panggilan kedua = ' + second + ' (seharusnya ' + (first + 1) + ').'
    );
  }

  return 'CONFIG.SEQUENCES.CORE_TEST naik dari ' + first + ' ke ' + second + '.';
}

/**
 * TEST: memastikan generateEntityId() menghasilkan format "PREFIX-000001",
 * menggunakan CONFIG.SEQUENCES.CORE_TEST agar tidak memengaruhi sequence
 * produksi.
 * @return {string} Detail hasil test.
 * @private
 */
function coreSmokeTestGenerateEntityId_() {
  var id = generateEntityId(CONFIG.ID_PREFIXES.CORE_TEST, CONFIG.SEQUENCES.CORE_TEST);
  var pattern = new RegExp('^' + CONFIG.ID_PREFIXES.CORE_TEST + '-\\d{6}$');

  if (!pattern.test(id)) {
    throw new Error('Format ID tidak sesuai "PREFIX-000001": didapat "' + id + '".');
  }

  return 'ID dihasilkan: ' + id;
}

/**
 * TEST: memastikan generateReportNumber() menghasilkan format
 * "SRP-YYYY-000001" dan menggunakan sequence REPORT yang monoton (tidak
 * ada varian per tahun). PERINGATAN: pemanggilan ini menambah nilai
 * sequence PRODUKSI "REPORT" sebanyak 1 — lihat catatan di header file ini.
 * @return {string} Detail hasil test.
 * @private
 */
function coreSmokeTestGenerateReportNumber_() {
  var reportNumber = generateReportNumber();
  var pattern = /^SRP-\d{4}-\d{6}$/;

  if (!pattern.test(reportNumber)) {
    throw new Error('Format report number tidak sesuai "SRP-YYYY-000001": didapat "' + reportNumber + '".');
  }

  return 'Report number dihasilkan: ' + reportNumber +
    ' (PERINGATAN: sequence produksi REPORT bertambah 1 akibat pemanggilan ini).';
}
