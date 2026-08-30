/**
 * InspectDatabase.gs
 *
 * ============================================================
 * READ-ONLY DISCOVERY UTILITY — BUKAN DOMAIN SERVICE, TIDAK MENULIS APA PUN
 * ============================================================
 *
 * File ini adalah alat bantu infrastruktur untuk MENGINSPEKSI Google
 * Spreadsheet database SIGAP SARPRAS yang SUDAH ADA (kemungkinan berisi
 * hasil pekerjaan sebelum repository ini dibuat) — TANPA mengubahnya
 * sedikit pun. Dijalankan MANUAL oleh pengelola sistem dari editor Apps
 * Script, sama seperti `SetupDatabase.gs`, tetapi tujuannya murni
 * DISCOVERY: mencari tahu struktur nyata yang ada, membandingkannya
 * dengan `docs/DATABASE_SCHEMA.md`, dan melaporkan hasilnya — BUKAN
 * membuat/memperbaiki apa pun.
 *
 * ATURAN MUTLAK: READ-ONLY ONLY. File ini TIDAK PERNAH memanggil method
 * penulisan Spreadsheet/Sheet apa pun — tidak ada setValue, setValues,
 * appendRow, insertSheet, deleteSheet, deleteRow, clear, clearContents,
 * clearFormat, copyTo, moveTo, atau operasi write lainnya. Hanya method
 * BACA yang dipakai: getSheets(), getSheetByName(), getName(), getId(),
 * getLastRow(), getLastColumn(), getRange(...).getValues().
 *
 * Kepatuhan pada aturan di atas divalidasi melalui AUDIT STATIS (grep)
 * terhadap teks source code file ini, dijalankan sebelum setiap commit —
 * lihat perintah pada docs/DATABASE_SETUP.md bagian "Audit Read-Only
 * InspectDatabase.gs". Sengaja TIDAK diimplementasikan sebagai runtime
 * self-inspection (membaca source code sendiri lewat Apps Script API)
 * karena itu membutuhkan scope OAuth tambahan (Apps Script API harus
 * diaktifkan terpisah) yang tidak semestinya dibutuhkan oleh utility
 * read-only sederhana seperti ini — audit statis di sisi repository jauh
 * lebih sederhana, sama efektifnya, dan tidak menambah permission apa pun
 * yang diminta ke pengguna.
 *
 * TIDAK PERNAH membaca/menampilkan isi baris data (data user, data
 * laporan, dsb.) — hanya metadata struktural: nama sheet, jumlah baris,
 * jumlah kolom, dan header. Untuk 91_sequences, hanya `sequence_key` dan
 * `last_value` yang dibaca (bukan data sensitif — sekadar angka counter).
 *
 * Dependency (reuse, tidak menduplikasi):
 * - getSpreadsheet() dari core/Config.gs.
 * - getHeaderRow_() dan rowArrayToObject_() dari core/DatabaseService.gs
 *   (keduanya murni baca, tanpa side effect — aman dipakai di sini).
 * - SETUP_DATABASE_SCHEMA_ dari apps-script/tools/SetupDatabase.gs —
 *   SATU-SATUNYA sumber kebenaran daftar 12 sheet + header resmi, supaya
 *   Inspector dan Setup selalu membandingkan terhadap schema yang identik
 *   (tidak ada risiko dua daftar schema yang diam-diam berbeda).
 * - setupDatabaseIsHeaderEmpty_() dari SetupDatabase.gs — deteksi header
 *   kosong, dipakai identik oleh kedua file.
 * - CONFIG.SEQUENCES dari core/Config.gs — daftar sequence key resmi.
 *
 * Referensi: docs/DATABASE_SCHEMA.md, docs/DATABASE_SETUP.md
 */

/**
 * Melakukan inspeksi lengkap database SIGAP SARPRAS yang sudah ada dan
 * mengembalikan hasilnya sebagai objek terstruktur — TIDAK mengubah
 * apa pun pada spreadsheet. Cocok dipakai saat hasil inspeksi perlu
 * disalin (JSON) untuk dianalisis lebih lanjut.
 *
 * @return {Object} Hasil inspeksi, struktur:
 *   {
 *     status: 'READY'|'PARTIAL'|'MISMATCH_FOUND',
 *     generated_at: string,
 *     spreadsheet: {id, name},
 *     expected_schema: {sheets: [{sheet_name, expected_headers}], sequences: [string]},
 *     actual_database: {
 *       sheets_found: [{sheet_name, total_row_count, data_row_count, column_count, header}],
 *       sheets_missing: [string],
 *       unknown_sheets: [{sheet_name, total_row_count, data_row_count, column_count, header}]
 *     },
 *     compatibility: [{sheet_name, exists, header_status, missing_columns, unexpected_columns}],
 *     sequences: {
 *       sheet_status: 'MATCH'|'MISMATCH'|'EMPTY'|'NOT_FOUND',
 *       found: [{sequence_name, current_value}],
 *       expected_but_missing: [string]
 *     }
 *   }
 * @throws {Error} Hanya jika SPREADSHEET_ID belum diset atau spreadsheet
 *   tidak dapat dibuka (kegagalan pre-condition, bukan hasil inspeksi) —
 *   lihat getSpreadsheetId()/getSpreadsheet() pada core/Config.gs.
 */
function inspectDatabaseAsJson() {
  var spreadsheet = getSpreadsheet(); // read-only: hanya membuka, tidak menulis

  var expectedSheets = SETUP_DATABASE_SCHEMA_; // reuse dari SetupDatabase.gs — satu sumber kebenaran
  var expectedSequenceKeys = Object.keys(CONFIG.SEQUENCES).map(function (key) { return CONFIG.SEQUENCES[key]; });
  var expectedSheetNames = expectedSheets.map(function (entry) { return entry.sheetName; });

  var actualSheets = spreadsheet.getSheets(); // read-only: daftar seluruh sheet yang benar-benar ada
  var actualSheetNames = actualSheets.map(function (sheet) { return sheet.getName(); });

  var sheetsFound = [];
  var sheetsMissing = [];
  var unknownSheets = [];
  var compatibility = [];
  var hasMismatch = false;
  var hasMissing = false;

  for (var i = 0; i < expectedSheets.length; i++) {
    var schemaEntry = expectedSheets[i];
    var sheet = spreadsheet.getSheetByName(schemaEntry.sheetName); // read-only

    if (!sheet) {
      sheetsMissing.push(schemaEntry.sheetName);
      hasMissing = true;
      compatibility.push({
        sheet_name: schemaEntry.sheetName,
        exists: false,
        header_status: 'NOT_FOUND',
        missing_columns: schemaEntry.headers.slice(),
        unexpected_columns: []
      });
      continue;
    }

    var meta = inspectDatabaseReadSheetMeta_(sheet);
    sheetsFound.push(Object.assign({ sheet_name: schemaEntry.sheetName }, meta));

    if (setupDatabaseIsHeaderEmpty_(meta.header)) {
      hasMissing = true;
      compatibility.push({
        sheet_name: schemaEntry.sheetName,
        exists: true,
        header_status: 'EMPTY',
        missing_columns: schemaEntry.headers.slice(),
        unexpected_columns: []
      });
      continue;
    }

    var diff = inspectDatabaseDiffHeaders_(schemaEntry.headers, meta.header);
    var isMatch = diff.missing.length === 0 && diff.unexpected.length === 0;
    if (!isMatch) {
      hasMismatch = true;
    }
    compatibility.push({
      sheet_name: schemaEntry.sheetName,
      exists: true,
      header_status: isMatch ? 'MATCH' : 'MISMATCH',
      missing_columns: diff.missing,
      unexpected_columns: diff.unexpected
    });
  }

  for (var j = 0; j < actualSheetNames.length; j++) {
    var name = actualSheetNames[j];
    if (expectedSheetNames.indexOf(name) === -1) {
      var unknownMeta = inspectDatabaseReadSheetMeta_(actualSheets[j]);
      unknownSheets.push(Object.assign({ sheet_name: name }, unknownMeta));
    }
  }

  // --- Sequences (91_sequences) — hanya sequence_key/last_value, tanpa data lain ---
  var sequenceCompat = compatibility.filter(function (c) { return c.sheet_name === CONFIG.SHEETS.SEQUENCES; })[0];
  var sequenceReport = { sheet_status: sequenceCompat.header_status, found: [], expected_but_missing: expectedSequenceKeys.slice() };

  if (sequenceCompat.header_status === 'MATCH') {
    var sequenceSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.SEQUENCES);
    var headers = getHeaderRow_(sequenceSheet); // reuse DatabaseService.gs, read-only
    var lastRow = sequenceSheet.getLastRow();

    if (lastRow >= 2) {
      var rows = sequenceSheet.getRange(2, 1, lastRow - 1, headers.length).getValues(); // read-only
      for (var k = 0; k < rows.length; k++) {
        var rowObj = rowArrayToObject_(headers, rows[k]); // reuse DatabaseService.gs, read-only pure transform
        sequenceReport.found.push({ sequence_name: rowObj.sequence_key, current_value: rowObj.last_value });
      }
    }

    var foundKeys = sequenceReport.found.map(function (s) { return s.sequence_name; });
    sequenceReport.expected_but_missing = expectedSequenceKeys.filter(function (key) { return foundKeys.indexOf(key) === -1; });
  }

  // --- Status keseluruhan ---
  // MISMATCH_FOUND selalu prioritas tertinggi (perlu keputusan manual).
  // PARTIAL berarti tidak ada konflik, hanya belum lengkap (aman dilanjutkan
  // dengan setupDatabase() setelah direview). Sequence yang belum lengkap
  // TIDAK memengaruhi status ini karena SequenceService membuat baris
  // sequence otomatis & aman saat pertama kali dipakai (lihat SequenceService.gs).
  var status = hasMismatch ? 'MISMATCH_FOUND' : (hasMissing ? 'PARTIAL' : 'READY');

  return {
    status: status,
    generated_at: nowTimestamp(),
    spreadsheet: { id: getSpreadsheetId(), name: spreadsheet.getName() },
    expected_schema: {
      sheets: expectedSheets.map(function (entry) { return { sheet_name: entry.sheetName, expected_headers: entry.headers }; }),
      sequences: expectedSequenceKeys
    },
    actual_database: {
      sheets_found: sheetsFound,
      sheets_missing: sheetsMissing,
      unknown_sheets: unknownSheets
    },
    compatibility: compatibility,
    sequences: sequenceReport
  };
}

/**
 * Membaca metadata satu sheet (read-only): jumlah baris total, jumlah
 * baris data (di luar header), jumlah kolom, dan header. TIDAK PERNAH
 * membaca isi baris data.
 * @param {Sheet} sheet Objek Sheet.
 * @return {{total_row_count:number, data_row_count:number, column_count:number, header:Array<string>}}
 * @private
 */
function inspectDatabaseReadSheetMeta_(sheet) {
  var totalRowCount = sheet.getLastRow(); // read-only
  var columnCount = sheet.getLastColumn(); // read-only
  var header = getHeaderRow_(sheet); // read-only, reuse DatabaseService.gs
  return {
    total_row_count: totalRowCount,
    data_row_count: Math.max(totalRowCount - 1, 0),
    column_count: columnCount,
    header: header
  };
}

/**
 * Membandingkan header aktual terhadap header yang diharapkan BERBASIS
 * SET nama kolom (bukan urutan) — mengikuti aturan yang sama persis
 * dengan setupDatabaseHeadersMatch_() pada SetupDatabase.gs (lihat
 * catatan "PERBANDINGAN HEADER" di sana). Berbeda dari fungsi tersebut,
 * fungsi ini mengembalikan RINCIAN perbedaan (bukan hanya boolean),
 * karena Inspector perlu melaporkan kolom mana yang hilang/asing secara
 * eksplisit untuk keperluan DISCOVERY.
 *
 * CATATAN PEMELIHARAAN: jika aturan perbandingan header berubah, ubah
 * fungsi ini DAN setupDatabaseHeadersMatch_() secara bersamaan agar
 * Inspector dan Setup tetap konsisten.
 *
 * @param {Array<string>} expectedHeaders Header sesuai schema resmi.
 * @param {Array<string>} actualHeaders Header yang sebenarnya ada di sheet.
 * @return {{missing: Array<string>, unexpected: Array<string>}}
 * @private
 */
function inspectDatabaseDiffHeaders_(expectedHeaders, actualHeaders) {
  var normalizedExpected = expectedHeaders.filter(function (h) { return h !== '' && h !== null && h !== undefined; });
  var normalizedActual = actualHeaders.filter(function (h) { return h !== '' && h !== null && h !== undefined; });

  var missing = normalizedExpected.filter(function (h) { return normalizedActual.indexOf(h) === -1; });
  var unexpected = normalizedActual.filter(function (h) { return normalizedExpected.indexOf(h) === -1; });

  return { missing: missing, unexpected: unexpected };
}

/**
 * Melakukan inspeksi lengkap database SIGAP SARPRAS yang sudah ada dan
 * mencetak hasilnya ke Logger dalam format human-readable — TIDAK
 * mengubah apa pun pada spreadsheet. Ini adalah pembungkus tampilan di
 * atas inspectDatabaseAsJson(); logika inspeksi sesungguhnya hanya ada
 * SATU tempat (menghindari dua sumber kebenaran yang bisa berbeda hasil).
 *
 * @return {Object} Objek hasil yang sama persis dengan inspectDatabaseAsJson(),
 *   supaya juga bisa dipakai secara terprogram jika dipanggil dari fungsi lain.
 */
function inspectExistingDatabase() {
  var result = inspectDatabaseAsJson();
  inspectDatabaseLogResult_(result);
  return result;
}

/**
 * Mencetak hasil inspeksi ke Logger dengan pemisahan jelas: EXPECTED
 * SCHEMA, ACTUAL DATABASE, COMPATIBILITY RESULT.
 * @param {Object} result Hasil dari inspectDatabaseAsJson().
 * @private
 */
function inspectDatabaseLogResult_(result) {
  var NAME_WIDTH = 22;
  function pad(text) { return (String(text) + '                        ').substring(0, NAME_WIDTH); }

  Logger.log('==============================================');
  Logger.log('DATABASE_INSPECTION_RESULT');
  Logger.log('==============================================');
  Logger.log('STATUS: ' + result.status);
  Logger.log('Waktu inspeksi   : ' + result.generated_at);
  Logger.log('Spreadsheet ID   : ' + result.spreadsheet.id);
  Logger.log('Spreadsheet Name : ' + result.spreadsheet.name);

  Logger.log('');
  Logger.log('---------------- EXPECTED SCHEMA ----------------');
  for (var i = 0; i < result.expected_schema.sheets.length; i++) {
    var exp = result.expected_schema.sheets[i];
    Logger.log(pad(exp.sheet_name) + '[' + exp.expected_headers.join(', ') + ']');
  }
  Logger.log('Expected sequences: ' + result.expected_schema.sequences.join(', '));

  Logger.log('');
  Logger.log('---------------- ACTUAL DATABASE ----------------');
  Logger.log('Sheets ditemukan (' + result.actual_database.sheets_found.length + '):');
  for (var j = 0; j < result.actual_database.sheets_found.length; j++) {
    var found = result.actual_database.sheets_found[j];
    Logger.log(
      '  ' + pad(found.sheet_name) + 'rows=' + found.data_row_count +
      ', cols=' + found.column_count + ', header=[' + found.header.join(', ') + ']'
    );
  }
  Logger.log('Sheets HILANG (' + result.actual_database.sheets_missing.length + '): ' + result.actual_database.sheets_missing.join(', '));
  Logger.log('Sheets ASING di luar schema (' + result.actual_database.unknown_sheets.length + '):');
  for (var k = 0; k < result.actual_database.unknown_sheets.length; k++) {
    var unk = result.actual_database.unknown_sheets[k];
    Logger.log(
      '  ' + pad(unk.sheet_name) + 'rows=' + unk.data_row_count +
      ', cols=' + unk.column_count + ', header=[' + unk.header.join(', ') + ']'
    );
  }

  Logger.log('');
  Logger.log('Sequences (91_sequences) — sheet_status: ' + result.sequences.sheet_status);
  for (var m = 0; m < result.sequences.found.length; m++) {
    var seq = result.sequences.found[m];
    Logger.log('  ' + pad(seq.sequence_name) + 'current_value=' + seq.current_value);
  }
  if (result.sequences.expected_but_missing.length > 0) {
    Logger.log('  Sequence belum ada (akan dibuat otomatis saat pertama dipakai): ' + result.sequences.expected_but_missing.join(', '));
  }

  Logger.log('');
  Logger.log('---------------- COMPATIBILITY RESULT ----------------');
  for (var n = 0; n < result.compatibility.length; n++) {
    var c = result.compatibility[n];
    var line = pad(c.sheet_name) + c.header_status;
    if (c.missing_columns.length > 0) line += ' | missing: [' + c.missing_columns.join(', ') + ']';
    if (c.unexpected_columns.length > 0) line += ' | unexpected: [' + c.unexpected_columns.join(', ') + ']';
    Logger.log(line);
  }

  Logger.log('==============================================');
  Logger.log('STATUS AKHIR: ' + result.status);
  Logger.log('==============================================');
}
