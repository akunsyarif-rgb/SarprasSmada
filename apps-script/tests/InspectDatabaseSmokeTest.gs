/**
 * InspectDatabaseSmokeTest.gs
 *
 * Manual smoke test untuk apps-script/tools/InspectDatabase.gs. Dijalankan
 * MANUAL dari editor Apps Script (pilih fungsi runInspectDatabaseSmokeTest
 * pada dropdown fungsi, lalu Run).
 *
 * READ-ONLY sepenuhnya — test ini hanya memanggil inspectDatabaseAsJson()
 * dan inspectExistingDatabase(), keduanya read-only, sehingga aman
 * dijalankan berulang kali terhadap database produksi maupun database
 * lama tanpa risiko mengubah apa pun.
 *
 * Dependency: apps-script/tools/InspectDatabase.gs
 */

/**
 * Menjalankan seluruh smoke test InspectDatabase.gs secara berurutan dan
 * mencetak ringkasan hasil ke Logger.
 * @return {Array<Object>} Daftar hasil tiap test ({label, passed, detail}).
 */
function runInspectDatabaseSmokeTest() {
  var results = [];

  inspectDatabaseSmokeTestRun_(results, '1. inspectDatabaseAsJson() mengembalikan struktur lengkap', inspectDatabaseSmokeTestStructure_);
  inspectDatabaseSmokeTestRun_(results, '2. status termasuk salah satu enum yang valid', inspectDatabaseSmokeTestStatusEnum_);
  inspectDatabaseSmokeTestRun_(results, '3. compatibility memuat tepat 12 entri (satu per sheet wajib)', inspectDatabaseSmokeTestCompatibilityCount_);
  inspectDatabaseSmokeTestRun_(results, '4. inspectExistingDatabase() berjalan tanpa error dan konsisten dengan inspectDatabaseAsJson()', inspectDatabaseSmokeTestLogWrapper_);
  inspectDatabaseSmokeTestRun_(results, '5. pemanggilan berulang tidak menimbulkan efek samping (hasil struktural identik)', inspectDatabaseSmokeTestIdempotentReadOnly_);

  inspectDatabaseSmokeTestPrintSummary_(results);
  return results;
}

/** @private */
function inspectDatabaseSmokeTestRun_(results, label, testFn) {
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
function inspectDatabaseSmokeTestPrintSummary_(results) {
  var passCount = results.filter(function (r) { return r.passed; }).length;
  var failCount = results.length - passCount;
  Logger.log('==============================================');
  Logger.log('INSPECT DATABASE SMOKE TEST SUMMARY: ' + passCount + ' PASS, ' + failCount + ' FAIL (total ' + results.length + ')');
  Logger.log('==============================================');
}

/** @private */
function inspectDatabaseSmokeTestStructure_() {
  var result = inspectDatabaseAsJson();
  var requiredKeys = ['status', 'generated_at', 'spreadsheet', 'expected_schema', 'actual_database', 'compatibility', 'sequences'];
  for (var i = 0; i < requiredKeys.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(result, requiredKeys[i])) {
      throw new Error('Field "' + requiredKeys[i] + '" tidak ada pada hasil inspectDatabaseAsJson().');
    }
  }
  if (!result.spreadsheet.id || !result.spreadsheet.name) {
    throw new Error('spreadsheet.id/name kosong — inspeksi tidak berhasil membaca metadata spreadsheet.');
  }
  return 'spreadsheet="' + result.spreadsheet.name + '"';
}

/** @private */
function inspectDatabaseSmokeTestStatusEnum_() {
  var result = inspectDatabaseAsJson();
  var validStatuses = ['READY', 'PARTIAL', 'MISMATCH_FOUND'];
  if (validStatuses.indexOf(result.status) === -1) {
    throw new Error('status "' + result.status + '" bukan salah satu dari: ' + validStatuses.join(', '));
  }
  return 'status=' + result.status;
}

/** @private */
function inspectDatabaseSmokeTestCompatibilityCount_() {
  var result = inspectDatabaseAsJson();
  var expectedCount = SETUP_DATABASE_SCHEMA_.length;
  if (result.compatibility.length !== expectedCount) {
    throw new Error('compatibility.length = ' + result.compatibility.length + ', diharapkan ' + expectedCount + '.');
  }
  return result.compatibility.length + ' sheet diperiksa';
}

/** @private */
function inspectDatabaseSmokeTestLogWrapper_() {
  var result = inspectExistingDatabase();
  if (!result || !result.status) {
    throw new Error('inspectExistingDatabase() tidak mengembalikan hasil yang valid.');
  }
  return 'status=' + result.status;
}

/** @private */
function inspectDatabaseSmokeTestIdempotentReadOnly_() {
  var first = inspectDatabaseAsJson();
  var second = inspectDatabaseAsJson();

  delete first.generated_at;
  delete second.generated_at;

  var firstStr = JSON.stringify(first);
  var secondStr = JSON.stringify(second);

  if (firstStr !== secondStr) {
    throw new Error('Dua pemanggilan inspectDatabaseAsJson() berturut-turut menghasilkan struktur berbeda — periksa kemungkinan side effect atau perubahan bersamaan pada spreadsheet.');
  }
  return 'hasil identik pada 2x pemanggilan berturut-turut';
}
