/**
 * DatabaseInspectorStandalone.gs
 *
 * ============================================================
 * STANDALONE READ-ONLY DISCOVERY UTILITY — NOL DEPENDENCY
 * ============================================================
 *
 * File TUNGGAL yang bisa di-copy-paste sendirian ke Google Apps Script
 * project BARU/kosong dan langsung dijalankan, TANPA perlu file lain dari
 * repository ini (tidak butuh core/Config.gs, core/DatabaseService.gs,
 * apps-script/tools/SetupDatabase.gs, atau apa pun). Dirancang khusus
 * untuk PHASE A — konfirmasi struktur database SIGAP SARPRAS yang sudah
 * ada (lama), dijalankan dari project Apps Script terisolasi bernama
 * "SIGAP SARPRAS – Database Inspector".
 *
 * Berbeda dari apps-script/tools/InspectDatabase.gs (yang reuse
 * core/Config.gs, core/DatabaseService.gs, dan
 * apps-script/tools/SetupDatabase.gs untuk mengikuti prinsip DRY di
 * dalam repository), file ini SENGAJA mendefinisikan ulang seluruh
 * konstanta schema dan helper secara mandiri — trade-off yang disengaja:
 * duplikasi kecil demi independensi total, karena tujuannya memang
 * ditempel ke project terpisah yang tidak memiliki file lain repository
 * ini sama sekali.
 *
 * ATURAN MUTLAK: READ-ONLY MURNI. TIDAK ADA operasi tulis apa pun —
 * tidak ada setValue, setValues, appendRow, insertSheet, deleteSheet,
 * deleteRow, clear, clearContents, clearFormat, copyTo, moveTo, create,
 * update, atau operasi tulis lainnya. Hanya method BACA yang dipakai:
 * getSheets(), getSheetByName(), getName(), getId(), getLastRow(),
 * getLastColumn(), getRange(...).getValues().
 *
 * Kepatuhan read-only diverifikasi lewat audit statis (grep) terhadap
 * source code file ini, dijalankan sebelum setiap commit:
 *
 *   grep -nE "setValue|setValues|appendRow|insertSheet|deleteSheet| \
 *     deleteRow|\.clear\(|clearContents|clearFormat|copyTo|moveTo" \
 *     apps-script/tools/DatabaseInspectorStandalone.gs
 *
 * Hasil yang benar: tidak ada baris KODE yang cocok (hanya boleh muncul
 * di komentar yang menjelaskan larangan ini, bukan pemanggilan sungguhan).
 *
 * TIDAK PERNAH membaca/menampilkan isi baris data pengguna/laporan.
 * Untuk setiap sheet hanya: nama sheet, jumlah baris data, jumlah kolom,
 * dan header. Untuk 91_sequences: HANYA nama sequence dan nilainya saat
 * ini (bukan data sensitif — sekadar angka counter internal sistem).
 *
 * Schema pembanding ("expected schema") pada file ini mengambil baseline
 * dari schema REPOSITORY SAAT INI (docs/DATABASE_SCHEMA.md /
 * apps-script/tools/SetupDatabase.gs) — file ini TIDAK mengubah schema
 * atau kode existing mana pun, murni membaca dan membandingkan.
 *
 * CATATAN KOMPATIBILITAS 91_sequences: database lama SIGAP SARPRAS
 * diketahui memakai nama kolom "sequence_name"/"current_value", BUKAN
 * "sequence_key"/"last_value" seperti schema resmi repository saat ini.
 * Untuk tetap bisa MELAPORKAN nilai sequence yang sebenarnya (sesuai
 * permintaan: "sequence name/key dan current value/last value JIKA
 * TERSEDIA"), pembacaan NILAI sequence di bawah mengenali KEDUA varian
 * nama kolom tersebut. Ini HANYA memengaruhi pelaporan nilai — status
 * kecocokan header 91_sequences terhadap schema kanonik repository tetap
 * dievaluasi apa adanya (akan tetap terlaporkan MISMATCH jika memang
 * berbeda), sesuai instruksi untuk tidak mengubah definisi schema.
 *
 * Cara pakai: copy-paste seluruh isi file ini ke satu file .gs pada
 * project Apps Script standalone yang SPREADSHEET_ID-nya sudah diset di
 * Script Properties, lalu jalankan inspectExistingDatabase().
 */

/**
 * Schema sheet yang diharapkan, diambil dari baseline schema repository
 * saat ini (docs/DATABASE_SCHEMA.md / apps-script/tools/SetupDatabase.gs).
 * Urutan array menentukan urutan pemrosesan & pelaporan.
 * @private
 */
var DBI_EXPECTED_SHEETS_ = [
  { sheetName: '01_users', headers: ['user_id', 'email', 'full_name', 'role', 'student_id', 'class_name', 'owner_id', 'is_active', 'created_at', 'updated_at'] },
  { sheetName: '02_locations', headers: ['location_id', 'parent_id', 'location_name', 'location_type', 'location_path', 'is_active', 'created_at', 'updated_at'] },
  { sheetName: '03_categories', headers: ['category_id', 'category_name', 'description', 'is_active', 'created_at', 'updated_at'] },
  { sheetName: '04_facilities', headers: ['facility_id', 'category_id', 'facility_name', 'is_active', 'created_at', 'updated_at'] },
  { sheetName: '05_owners', headers: ['owner_id', 'owner_name', 'description', 'is_active', 'created_at', 'updated_at'] },
  { sheetName: '10_reports', headers: ['report_id', 'report_number', 'reporter_id', 'location_id', 'category_id', 'facility_id', 'condition', 'description', 'impact_level', 'safety_risk', 'system_priority', 'priority', 'priority_override_reason', 'status', 'owner_id', 'duplicate_of_report_id', 'created_at', 'updated_at', 'verified_at', 'assigned_at', 'started_at', 'completed_at', 'closed_at', 'is_active'] },
  { sheetName: '11_report_photos', headers: ['photo_id', 'report_id', 'file_url', 'uploaded_by', 'caption', 'created_at'] },
  { sheetName: '12_report_history', headers: ['history_id', 'report_id', 'previous_status', 'new_status', 'changed_by', 'notes', 'created_at'] },
  { sheetName: '13_report_comments', headers: ['comment_id', 'report_id', 'author_id', 'comment_text', 'is_internal', 'created_at'] },
  { sheetName: '20_audit_logs', headers: ['log_id', 'actor_id', 'action', 'entity_type', 'entity_id', 'details', 'created_at'] },
  { sheetName: '90_settings', headers: ['setting_key', 'setting_value', 'description', 'updated_at'] },
  { sheetName: '91_sequences', headers: ['sequence_key', 'last_value', 'updated_at'] }
];

/** Nama sequence yang diharapkan sistem (baseline repository saat ini). @private */
var DBI_EXPECTED_SEQUENCES_ = ['REPORT', 'HISTORY', 'AUDIT', 'USER', 'LOCATION', 'CATEGORY', 'FACILITY', 'OWNER', 'CORE_TEST'];

/** Nama sheet sequence. @private */
var DBI_SEQUENCES_SHEET_NAME_ = '91_sequences';

/**
 * Alias nama kolom kunci/nilai sequence yang dikenali saat MEMBACA data
 * (bukan saat menilai kecocokan header terhadap schema kanonik) — lihat
 * catatan "KOMPATIBILITAS 91_sequences" pada header file ini.
 * @private
 */
var DBI_SEQUENCE_KEY_COLUMN_ALIASES_ = ['sequence_key', 'sequence_name'];
var DBI_SEQUENCE_VALUE_COLUMN_ALIASES_ = ['last_value', 'current_value'];

/** Key Script Property tempat Spreadsheet ID disimpan. @private */
var DBI_SPREADSHEET_ID_PROPERTY_KEY_ = 'SPREADSHEET_ID';

/**
 * Melakukan inspeksi lengkap database SIGAP SARPRAS dan mencetak hasilnya
 * ke Logger dalam format human-readable — TIDAK mengubah apa pun.
 *
 * @return {Object} Objek hasil yang sama persis dengan inspectDatabaseAsJson().
 */
function inspectExistingDatabase() {
  var result = inspectDatabaseAsJson();
  dbiLogResult_(result);
  return result;
}

/**
 * Melakukan inspeksi lengkap database SIGAP SARPRAS dan mengembalikan
 * hasilnya sebagai objek terstruktur — TIDAK mengubah apa pun.
 *
 * @return {Object} Hasil inspeksi:
 *   {
 *     status: 'DATABASE_READY'|'MISMATCH_FOUND'|'DATABASE_INCOMPLETE',
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
 *       key_column_used: (string|null), value_column_used: (string|null),
 *       found: [{sequence_name, current_value}],
 *       expected_but_missing: [string]
 *     }
 *   }
 * @throws {Error} Jika SPREADSHEET_ID belum diset atau spreadsheet tidak
 *   dapat dibuka.
 */
function inspectDatabaseAsJson() {
  var spreadsheetId = dbiGetSpreadsheetId_();
  var spreadsheet = dbiOpenSpreadsheet_(spreadsheetId);

  var actualSheets = spreadsheet.getSheets(); // read-only
  var actualSheetNames = actualSheets.map(function (sheet) { return sheet.getName(); });
  var expectedSheetNames = DBI_EXPECTED_SHEETS_.map(function (entry) { return entry.sheetName; });

  var sheetsFound = [];
  var sheetsMissing = [];
  var unknownSheets = [];
  var compatibility = [];
  var hasMismatch = false;
  var hasMissing = false;

  for (var i = 0; i < DBI_EXPECTED_SHEETS_.length; i++) {
    var schemaEntry = DBI_EXPECTED_SHEETS_[i];
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

    var meta = dbiReadSheetMeta_(sheet);
    sheetsFound.push(Object.assign({ sheet_name: schemaEntry.sheetName }, meta));

    if (dbiIsHeaderEmpty_(meta.header)) {
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

    var diff = dbiDiffHeaders_(schemaEntry.headers, meta.header);
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
      var unknownMeta = dbiReadSheetMeta_(actualSheets[j]);
      unknownSheets.push(Object.assign({ sheet_name: name }, unknownMeta));
    }
  }

  // --- Sequences (91_sequences): status header vs schema kanonik, TAPI
  // pembacaan NILAI mengenali alias nama kolom legacy (lihat catatan di
  // header file ini). ---
  var sequenceCompat = compatibility.filter(function (c) { return c.sheet_name === DBI_SEQUENCES_SHEET_NAME_; })[0];
  var sequenceReport = {
    sheet_status: sequenceCompat.header_status,
    key_column_used: null,
    value_column_used: null,
    found: [],
    expected_but_missing: DBI_EXPECTED_SEQUENCES_.slice()
  };

  if (sequenceCompat.exists) {
    var sequenceSheet = spreadsheet.getSheetByName(DBI_SEQUENCES_SHEET_NAME_);
    var seqHeaders = dbiGetHeaderRow_(sequenceSheet);

    if (!dbiIsHeaderEmpty_(seqHeaders)) {
      var keyColIndex = dbiFindColumnIndex_(seqHeaders, DBI_SEQUENCE_KEY_COLUMN_ALIASES_);
      var valueColIndex = dbiFindColumnIndex_(seqHeaders, DBI_SEQUENCE_VALUE_COLUMN_ALIASES_);

      if (keyColIndex !== -1 && valueColIndex !== -1) {
        sequenceReport.key_column_used = seqHeaders[keyColIndex];
        sequenceReport.value_column_used = seqHeaders[valueColIndex];

        var lastRow = sequenceSheet.getLastRow();
        if (lastRow >= 2) {
          var rows = sequenceSheet.getRange(2, 1, lastRow - 1, seqHeaders.length).getValues(); // read-only
          for (var k = 0; k < rows.length; k++) {
            sequenceReport.found.push({
              sequence_name: rows[k][keyColIndex],
              current_value: rows[k][valueColIndex]
            });
          }
        }

        var foundKeys = sequenceReport.found.map(function (s) { return s.sequence_name; });
        sequenceReport.expected_but_missing = DBI_EXPECTED_SEQUENCES_.filter(function (key) { return foundKeys.indexOf(key) === -1; });
      }
    }
  }

  // --- Status akhir ---
  // MISMATCH_FOUND: ada sheet yang SUDAH ada headernya tapi tidak sesuai schema.
  // DATABASE_INCOMPLETE: tidak ada konflik, tapi ada yang belum lengkap (sheet hilang/kosong).
  // DATABASE_READY: seluruh 12 sheet ada dan headernya sesuai schema kanonik repository.
  var status = hasMismatch ? 'MISMATCH_FOUND' : (hasMissing ? 'DATABASE_INCOMPLETE' : 'DATABASE_READY');

  return {
    status: status,
    generated_at: dbiNowTimestamp_(),
    spreadsheet: { id: spreadsheetId, name: spreadsheet.getName() },
    expected_schema: {
      sheets: DBI_EXPECTED_SHEETS_.map(function (entry) { return { sheet_name: entry.sheetName, expected_headers: entry.headers }; }),
      sequences: DBI_EXPECTED_SEQUENCES_.slice()
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
 * Mengambil Spreadsheet ID dari Script Properties.
 * @return {string} Spreadsheet ID.
 * @throws {Error} Jika Script Property SPREADSHEET_ID belum diset.
 * @private
 */
function dbiGetSpreadsheetId_() {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty(DBI_SPREADSHEET_ID_PROPERTY_KEY_);
  if (!spreadsheetId) {
    throw new Error(
      'DatabaseInspectorStandalone: Script Property "' + DBI_SPREADSHEET_ID_PROPERTY_KEY_ +
      '" belum diset. Set melalui Project Settings > Script Properties.'
    );
  }
  return spreadsheetId;
}

/**
 * Membuka Spreadsheet database berdasarkan ID (read-only — hanya membuka,
 * tidak menulis apa pun).
 * @param {string} spreadsheetId Spreadsheet ID.
 * @return {Spreadsheet} Objek Spreadsheet.
 * @throws {Error} Jika spreadsheet tidak dapat dibuka.
 * @private
 */
function dbiOpenSpreadsheet_(spreadsheetId) {
  try {
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (e) {
    throw new Error(
      'DatabaseInspectorStandalone: Gagal membuka spreadsheet dengan ID "' +
      spreadsheetId + '". Detail: ' + e.message
    );
  }
}

/**
 * Membaca metadata satu sheet (read-only): jumlah baris total, jumlah
 * baris data (di luar header), jumlah kolom, dan header. TIDAK PERNAH
 * membaca isi baris data.
 * @param {Sheet} sheet Objek Sheet.
 * @return {{total_row_count:number, data_row_count:number, column_count:number, header:Array<string>}}
 * @private
 */
function dbiReadSheetMeta_(sheet) {
  var totalRowCount = sheet.getLastRow(); // read-only
  var columnCount = sheet.getLastColumn(); // read-only
  var header = dbiGetHeaderRow_(sheet); // read-only
  return {
    total_row_count: totalRowCount,
    data_row_count: Math.max(totalRowCount - 1, 0),
    column_count: columnCount,
    header: header
  };
}

/**
 * Mengambil baris header (baris pertama) suatu sheet (read-only).
 * @param {Sheet} sheet Objek Sheet.
 * @return {Array<string>} Header, array kosong jika sheet tidak punya kolom.
 * @private
 */
function dbiGetHeaderRow_(sheet) {
  var lastColumn = sheet.getLastColumn(); // read-only
  if (lastColumn === 0) {
    return [];
  }
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0]; // read-only
}

/**
 * Memeriksa apakah header dianggap kosong (array kosong, atau seluruh
 * selnya string kosong).
 * @param {Array} headers Header row.
 * @return {boolean}
 * @private
 */
function dbiIsHeaderEmpty_(headers) {
  if (!headers || headers.length === 0) {
    return true;
  }
  return headers.every(function (h) { return h === '' || h === null || h === undefined; });
}

/**
 * Membandingkan header aktual terhadap header yang diharapkan BERBASIS
 * SET nama kolom (bukan urutan) — konsisten dengan prinsip
 * DatabaseService (memetakan berdasarkan nama kolom, bukan posisi).
 * @param {Array<string>} expectedHeaders Header sesuai schema resmi.
 * @param {Array<string>} actualHeaders Header yang sebenarnya ada di sheet.
 * @return {{missing: Array<string>, unexpected: Array<string>}}
 * @private
 */
function dbiDiffHeaders_(expectedHeaders, actualHeaders) {
  var normalizedExpected = expectedHeaders.filter(function (h) { return h !== '' && h !== null && h !== undefined; });
  var normalizedActual = actualHeaders.filter(function (h) { return h !== '' && h !== null && h !== undefined; });

  var missing = normalizedExpected.filter(function (h) { return normalizedActual.indexOf(h) === -1; });
  var unexpected = normalizedActual.filter(function (h) { return normalizedExpected.indexOf(h) === -1; });

  return { missing: missing, unexpected: unexpected };
}

/**
 * Mencari index kolom pertama dalam header yang cocok dengan salah satu
 * alias yang diberikan (case-sensitive exact match terhadap nama kolom).
 * @param {Array<string>} headers Header row.
 * @param {Array<string>} aliases Daftar nama kolom yang dianggap sama.
 * @return {number} Index kolom (0-based), atau -1 jika tidak ditemukan.
 * @private
 */
function dbiFindColumnIndex_(headers, aliases) {
  for (var i = 0; i < aliases.length; i++) {
    var idx = headers.indexOf(aliases[i]);
    if (idx !== -1) {
      return idx;
    }
  }
  return -1;
}

/**
 * Timestamp saat ini dalam format ISO 8601, timezone Asia/Makassar
 * (mengikuti konvensi timezone resmi SIGAP SARPRAS). Diimplementasikan
 * mandiri di sini (tidak reuse core/UtilityService.gs) demi independensi
 * file ini.
 * @return {string}
 * @private
 */
function dbiNowTimestamp_() {
  return Utilities.formatDate(new Date(), 'Asia/Makassar', "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * Mencetak hasil inspeksi ke Logger dengan pemisahan jelas: EXPECTED
 * SCHEMA, ACTUAL DATABASE, COMPATIBILITY RESULT.
 * @param {Object} result Hasil dari inspectDatabaseAsJson().
 * @private
 */
function dbiLogResult_(result) {
  var NAME_WIDTH = 22;
  function pad(text) { return (String(text) + '                        ').substring(0, NAME_WIDTH); }

  Logger.log('==============================================');
  Logger.log('DATABASE_INSPECTION_RESULT (standalone)');
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
  Logger.log(
    'Sequences (' + DBI_SEQUENCES_SHEET_NAME_ + ') — sheet_status: ' + result.sequences.sheet_status +
    (result.sequences.key_column_used ? ' (kolom terbaca: "' + result.sequences.key_column_used + '"/"' + result.sequences.value_column_used + '")' : '')
  );
  for (var m = 0; m < result.sequences.found.length; m++) {
    var seq = result.sequences.found[m];
    Logger.log('  ' + pad(seq.sequence_name) + 'current_value=' + seq.current_value);
  }
  if (result.sequences.expected_but_missing.length > 0) {
    Logger.log('  Sequence belum ditemukan: ' + result.sequences.expected_but_missing.join(', '));
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
