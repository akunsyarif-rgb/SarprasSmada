/**
 * SetupDatabase.gs
 *
 * ============================================================
 * ONE-TIME MANUAL SETUP UTILITY — BUKAN DOMAIN SERVICE
 * ============================================================
 *
 * File ini adalah alat bantu infrastruktur untuk menyiapkan Google
 * Spreadsheet database SIGAP SARPRAS (membuat sheet + header + baris
 * sequence awal). File ini dijalankan MANUAL, SEKALI (dan aman diulang),
 * oleh pengelola sistem langsung dari editor Apps Script — BUKAN dipanggil
 * oleh frontend, BUKAN bagian dari alur bisnis produksi, dan BUKAN
 * anggota domain manapun (users/, master-data/, reports/, audit/).
 *
 * KARENA ITU, file ini DIKECUALIKAN dari aturan "domain service dilarang
 * memanggil SpreadsheetApp langsung" (docs/ARCHITECTURE.md bagian 4).
 * Aturan tersebut berlaku untuk domain BISNIS yang membaca/menulis DATA;
 * file ini melakukan operasi STRUKTUR (membuat sheet, menulis header) yang
 * memang tidak disediakan oleh DatabaseService — DatabaseService sengaja
 * generik dan mengasumsikan sheet SUDAH ADA dengan header yang valid
 * (lihat DatabaseService.gs).
 *
 * Catatan teknis: file ini bahkan TIDAK PERNAH memanggil layanan global
 * `SpreadsheetApp` secara langsung sama sekali — persis seperti
 * DatabaseService.gs, satu-satunya pemanggil `SpreadsheetApp` langsung
 * tetap `Config.getSpreadsheet()`. Yang membedakan file ini dari domain
 * service adalah CAKUPAN method yang dipanggil pada objek Spreadsheet/Sheet
 * hasil `getSpreadsheet()`: DatabaseService.gs hanya memanggil method DATA
 * (getRange/getValues/setValues/appendRow pada baris yang sudah ada),
 * sedangkan file ini juga memanggil method STRUKTUR (`insertSheet()`,
 * menulis header pertama kali) yang tidak diekspos DatabaseService.
 * Operasi struktural semacam ini hanya masuk akal dilakukan oleh utility
 * setup, sekali di awal, sehingga dianggap infrastruktur, bukan
 * pelanggaran arsitektur.
 *
 * Meski begitu, file ini TETAP memakai abstraksi yang sudah ada sebisa
 * mungkin:
 * - getSpreadsheet() dari core/Config.gs — satu-satunya titik yang
 *   memanggil SpreadsheetApp, untuk membuka spreadsheet.
 * - getHeaderRow_() dari core/DatabaseService.gs — untuk membaca header
 *   (fungsi ini bertanda "private" via underscore, tetapi karena seluruh
 *   file .gs dalam satu project Apps Script berbagi satu global scope,
 *   fungsi ini memang dirancang untuk dipakai lintas file dalam project
 *   yang sama — SequenceService.gs sudah memakai pola yang sama persis).
 * - getRowById() dan insertRow() dari core/DatabaseService.gs — untuk
 *   membaca/menulis baris pada sheet 91_sequences (operasi DATA, bukan
 *   struktur, sehingga di sini WAJIB lewat DatabaseService seperti biasa).
 *
 * Konstanta schema header (SETUP_DATABASE_SCHEMA_) sengaja didefinisikan
 * LOKAL di file ini, bukan di core/Config.gs, karena:
 * 1. Tidak ada domain service produksi yang membutuhkan daftar header
 *    per-kolom secara eksplisit — DatabaseService bekerja generik
 *    berdasarkan header apa pun yang benar-benar ada di sheet saat
 *    runtime (lihat DatabaseService.gs), dan domain service membangun
 *    row object berdasarkan nama properti, bukan array header.
 *    Menambahkan daftar ini ke Config.gs berarti menambah beban
 *    pemeliharaan ke modul yang dipakai seluruh sistem, padahal hanya
 *    dipakai SEKALI oleh utility ini.
 * 2. Nama sheet (CONFIG.SHEETS) dan nama sequence (CONFIG.SEQUENCES)
 *    TETAP diambil dari core/Config.gs, TIDAK diduplikasi — hanya daftar
 *    kolom per sheet yang baru (karena memang belum ada representasi
 *    machine-readable-nya di mana pun pada repository ini; sumber
 *    kebenarannya adalah docs/DATABASE_SCHEMA.md dan
 *    docs/DATABASE_SETUP.md, disalin persis ke sini).
 *
 * PERBANDINGAN HEADER: dilakukan berbasis SET nama kolom (bukan urutan),
 * karena DatabaseService sendiri memetakan data berdasarkan NAMA kolom,
 * bukan posisi (lihat DatabaseService.gs) — sehingga validator ini tidak
 * boleh lebih ketat dari perilaku runtime sistem yang sesungguhnya.
 * Kolom yang hilang ATAU kolom asing yang tidak dikenal sama-sama dianggap
 * SCHEMA_MISMATCH, agar penyimpangan skema tetap terlihat jelas.
 *
 * KEAMANAN (tidak ada satu pun operasi berikut di file ini):
 * - Tidak ada deleteSheet(), clear(), clearContents().
 * - Tidak pernah menimpa header yang sudah ada dan berbeda dari schema
 *   (hanya menulis header pada sheet yang benar-benar baru dibuat atau
 *   masih sepenuhnya kosong).
 * - Tidak pernah mengubah current_value pada sequence yang sudah ada.
 * - Tidak ada migrasi skema otomatis maupun penghapusan baris.
 *
 * Dependency: core/Config.gs, core/DatabaseService.gs, core/UtilityService.gs
 * Referensi: docs/DATABASE_SCHEMA.md, docs/DATABASE_SETUP.md
 */

/**
 * Schema header resmi per sheet, disalin persis dari
 * docs/DATABASE_SCHEMA.md / docs/DATABASE_SETUP.md (bagian 5). Urutan
 * array ini juga menentukan URUTAN PEMROSESAN sheet oleh setupDatabase()
 * dan verifyDatabaseSetup() (01_users → 91_sequences), agar log mudah
 * dibaca dan konsisten dengan urutan pada dokumentasi.
 *
 * Nama sheet diambil dari CONFIG.SHEETS (core/Config.gs) — TIDAK
 * di-hardcode ulang di sini — hanya daftar kolomnya yang baru.
 *
 * PHASE 3.75 — Legacy-Compatible Reconciliation: header untuk
 * `11_report_photos`, `12_report_history`, `13_report_comments`,
 * `20_audit_logs`, dan `91_sequences` mengikuti struktur database
 * produksi SIGAP SARPRAS yang sudah berjalan nyata (dikonfirmasi via
 * inspeksi read-only), BUKAN rancangan awal repository yang tidak pernah
 * dipakai di deployment mana pun. Lihat docs/DATABASE_SCHEMA.md bagian
 * "Reconciliation Notes" pada masing-masing sheet untuk rincian
 * legacy-only vs. repo-only columns.
 * @private
 */
var SETUP_DATABASE_SCHEMA_ = [
  { sheetName: CONFIG.SHEETS.USERS, headers: ['user_id', 'email', 'full_name', 'role', 'student_id', 'class_name', 'owner_id', 'is_active', 'created_at', 'updated_at'] },
  { sheetName: CONFIG.SHEETS.LOCATIONS, headers: ['location_id', 'parent_id', 'location_name', 'location_type', 'location_path', 'is_active', 'created_at', 'updated_at'] },
  { sheetName: CONFIG.SHEETS.CATEGORIES, headers: ['category_id', 'category_name', 'description', 'is_active', 'created_at', 'updated_at'] },
  { sheetName: CONFIG.SHEETS.FACILITIES, headers: ['facility_id', 'category_id', 'facility_name', 'is_active', 'created_at', 'updated_at'] },
  { sheetName: CONFIG.SHEETS.OWNERS, headers: ['owner_id', 'owner_name', 'description', 'is_active', 'created_at', 'updated_at'] },
  { sheetName: CONFIG.SHEETS.REPORTS, headers: ['report_id', 'report_number', 'reporter_id', 'location_id', 'category_id', 'facility_id', 'condition', 'description', 'impact_level', 'safety_risk', 'system_priority', 'priority', 'priority_override_reason', 'status', 'owner_id', 'duplicate_of_report_id', 'created_at', 'updated_at', 'verified_at', 'assigned_at', 'started_at', 'completed_at', 'closed_at', 'is_active'] },
  { sheetName: CONFIG.SHEETS.REPORT_PHOTOS, headers: ['photo_id', 'report_id', 'photo_type', 'drive_file_id', 'drive_url', 'file_name', 'mime_type', 'file_size', 'uploaded_by', 'uploaded_at', 'is_active'] },
  { sheetName: CONFIG.SHEETS.REPORT_HISTORY, headers: ['history_id', 'report_id', 'previous_status', 'new_status', 'action', 'notes', 'performed_by', 'created_at'] },
  { sheetName: CONFIG.SHEETS.REPORT_COMMENTS, headers: ['comment_id', 'report_id', 'comment_type', 'message', 'created_by', 'is_internal', 'created_at', 'is_active'] },
  { sheetName: CONFIG.SHEETS.AUDIT_LOGS, headers: ['audit_id', 'user_id', 'action', 'entity_type', 'entity_id', 'metadata', 'created_at'] },
  { sheetName: CONFIG.SHEETS.SETTINGS, headers: ['setting_key', 'setting_value', 'description', 'updated_at'] },
  { sheetName: CONFIG.SHEETS.SEQUENCES, headers: ['sequence_name', 'current_value', 'updated_at'] }
];

/**
 * Membuat/memverifikasi seluruh sheet database SIGAP SARPRAS beserta
 * header-nya, dan menginisialisasi baris sequence awal pada 91_sequences
 * (current_value = 0) untuk sequence yang belum ada.
 *
 * IDEMPOTENT — aman dijalankan berulang kali:
 * - Sheet yang sudah ada dan header-nya sudah sesuai TIDAK disentuh.
 * - Sequence yang sudah ada nilainya TIDAK PERNAH direset/diubah.
 * - Tidak pernah ada duplikasi sheet maupun baris sequence.
 *
 * TIDAK PERNAH melakukan operasi destruktif (tidak ada delete/clear/
 * overwrite data yang sudah ada). Jika suatu sheet SUDAH memiliki header
 * yang TIDAK SESUAI schema resmi, fungsi ini TIDAK memperbaikinya secara
 * otomatis — melainkan melempar Error "SCHEMA_MISMATCH" yang menyebutkan
 * sheet, header yang diharapkan, dan header yang sebenarnya ditemukan,
 * agar pengelola sistem memperbaikinya secara sadar dan manual.
 *
 * Pre-flight check (dilakukan SEBELUM ada perubahan apa pun): memastikan
 * SPREADSHEET_ID tersedia, spreadsheet dapat dibuka, dan schema lokal
 * (SETUP_DATABASE_SCHEMA_) tersedia dan tidak kosong. Jika salah satu
 * gagal, fungsi berhenti dengan Error yang jelas SEBELUM sheet apa pun
 * dibuat/diubah.
 *
 * @return {Object} Ringkasan hasil setup:
 *   {
 *     success: true,
 *     status: 'DATABASE_ALREADY_READY' | 'DATABASE_SETUP_COMPLETED',
 *     spreadsheet_id: string,
 *     sheets_created: Array<string>,
 *     sheets_verified: Array<string>,
 *     sequences_created: Array<string>,
 *     sequences_verified: Array<string>
 *   }
 * @throws {Error} Jika pre-flight check gagal, atau jika ditemukan satu
 *   atau lebih SCHEMA_MISMATCH pada sheet yang sudah ada. Pemeriksaan
 *   SCHEMA_MISMATCH dilakukan pada TAHAP VALIDASI read-only SEBELUM ada
 *   satu sheet/sequence pun dibuat atau diubah (lihat TAHAP 1 di bawah) —
 *   sehingga bila ada mismatch, fungsi ini berhenti TANPA melakukan
 *   perubahan apa pun sama sekali pada run tersebut (bukan hanya
 *   sebagian), konsisten dengan aturan PRE-FLIGHT CHECK.
 */
function setupDatabase() {
  // --- PRE-FLIGHT CHECK (belum ada perubahan apa pun sampai titik ini) ---
  var spreadsheetId = getSpreadsheetId(); // throws jika SPREADSHEET_ID belum diset
  var spreadsheet = getSpreadsheet(); // throws jika spreadsheet tidak bisa dibuka
  if (!SETUP_DATABASE_SCHEMA_ || SETUP_DATABASE_SCHEMA_.length === 0) {
    throw new Error('SetupDatabase.setupDatabase: SETUP_DATABASE_SCHEMA_ kosong/tidak tersedia — tidak ada perubahan yang dilakukan.');
  }

  // --- TAHAP 1: VALIDASI read-only seluruh sheet, TIDAK ada tulis apa pun.
  // Sheet yang belum ada atau masih kosong BUKAN mismatch (akan dibuat
  // pada TAHAP 2) — hanya sheet yang SUDAH memiliki header namun berbeda
  // dari schema resmi yang dihitung sebagai mismatch. Seluruh 12 sheet
  // tetap diperiksa agar SEMUA mismatch (bila lebih dari satu) dilaporkan
  // sekaligus dalam satu error, bukan satu per satu lewat coba-coba ulang.
  var mismatches = [];
  for (var i = 0; i < SETUP_DATABASE_SCHEMA_.length; i++) {
    var mismatch = setupDatabaseValidateSheet_(spreadsheet, SETUP_DATABASE_SCHEMA_[i]);
    if (mismatch) {
      mismatches.push(mismatch);
    }
  }

  if (mismatches.length > 0) {
    throw new Error(
      'SCHEMA_MISMATCH: Ditemukan ' + mismatches.length + ' sheet dengan header tidak sesuai schema resmi ' +
      '(docs/DATABASE_SCHEMA.md). BELUM ADA satu pun perubahan yang dilakukan pada run ini — perbaiki header ' +
      'sheet berikut secara manual, lalu jalankan ulang setupDatabase():\n\n' + mismatches.join('\n\n')
    );
  }

  // --- TAHAP 2: seluruh sheet TERVALIDASI konsisten — baru sekarang
  // sheet yang belum ada dibuat, dan sheet yang kosong ditulis headernya.
  var summary = {
    success: true,
    status: 'DATABASE_SETUP_COMPLETED',
    spreadsheet_id: spreadsheetId,
    sheets_created: [],
    sheets_verified: [],
    sequences_created: [],
    sequences_verified: []
  };

  for (var j = 0; j < SETUP_DATABASE_SCHEMA_.length; j++) {
    setupDatabaseEnsureSheet_(spreadsheet, SETUP_DATABASE_SCHEMA_[j], summary);
  }

  // --- TAHAP 3: inisialisasi sequence (sheet 91_sequences dijamin valid) ---
  var sequenceKeys = Object.keys(CONFIG.SEQUENCES).map(function (key) { return CONFIG.SEQUENCES[key]; });
  for (var k = 0; k < sequenceKeys.length; k++) {
    setupDatabaseEnsureSequence_(sequenceKeys[k], summary);
  }

  if (summary.sheets_created.length === 0 && summary.sequences_created.length === 0) {
    summary.status = 'DATABASE_ALREADY_READY';
  }

  setupDatabaseLogSummary_(summary);
  return summary;
}

/**
 * TAHAP VALIDASI (read-only, tidak menulis apa pun): memeriksa apakah
 * satu sheet, JIKA sudah ada dan sudah memiliki header, sesuai schema
 * resmi. Sheet yang belum ada atau headernya masih kosong dianggap valid
 * pada tahap ini (bukan mismatch) — keduanya akan ditangani pada tahap
 * penulisan oleh setupDatabaseEnsureSheet_().
 *
 * @param {Spreadsheet} spreadsheet Spreadsheet database aktif.
 * @param {{sheetName: string, headers: Array<string>}} schemaEntry Entri schema satu sheet.
 * @return {?string} Pesan deskriptif mismatch, atau null jika valid/belum ada/masih kosong.
 * @private
 */
function setupDatabaseValidateSheet_(spreadsheet, schemaEntry) {
  var sheetName = schemaEntry.sheetName;
  var sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    return null; // belum ada — akan dibuat pada tahap penulisan, bukan mismatch
  }

  var actualHeaders = getHeaderRow_(sheet); // reuse DatabaseService.gs — lihat catatan dependency di header file ini

  if (setupDatabaseIsHeaderEmpty_(actualHeaders)) {
    return null; // ada tapi kosong — akan ditulis pada tahap penulisan, bukan mismatch
  }

  if (!setupDatabaseHeadersMatch_(schemaEntry.headers, actualHeaders)) {
    return (
      'Sheet "' + sheetName + '":\n' +
      '  Expected: [' + schemaEntry.headers.join(', ') + ']\n' +
      '  Actual:   [' + actualHeaders.join(', ') + ']'
    );
  }

  return null;
}

/**
 * TAHAP PENULISAN: memastikan satu sheet ada dan header-nya sesuai
 * schema. HANYA dipanggil setelah setupDatabaseValidateSheet_() atas
 * SELURUH sheet dipastikan tidak ada mismatch — sehingga fungsi ini
 * hanya akan menemui dua kemungkinan: sheet belum ada (dibuat), atau
 * sheet ada dan kosong (ditulis headernya), atau sheet ada dan sudah
 * sesuai (diverifikasi). TIDAK PERNAH menimpa header yang sudah ada.
 *
 * @param {Spreadsheet} spreadsheet Spreadsheet database aktif.
 * @param {{sheetName: string, headers: Array<string>}} schemaEntry Entri schema satu sheet.
 * @param {Object} summary Akumulator ringkasan (dimutasi langsung).
 * @private
 */
function setupDatabaseEnsureSheet_(spreadsheet, schemaEntry, summary) {
  var sheetName = schemaEntry.sheetName;
  var expectedHeaders = schemaEntry.headers;
  var sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    summary.sheets_created.push(sheetName);
    Logger.log('[CREATED] Sheet "' + sheetName + '" dibuat beserta header.');
    return;
  }

  var actualHeaders = getHeaderRow_(sheet);

  if (setupDatabaseIsHeaderEmpty_(actualHeaders)) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    summary.sheets_created.push(sheetName);
    Logger.log('[CREATED] Sheet "' + sheetName + '" sudah ada tapi kosong — header ditulis.');
    return;
  }

  // Sudah dijamin cocok oleh setupDatabaseValidateSheet_() pada TAHAP 1.
  summary.sheets_verified.push(sheetName);
  Logger.log('[VERIFIED] Sheet "' + sheetName + '" sudah sesuai schema.');
}

/**
 * Memastikan satu baris sequence ada pada 91_sequences dengan
 * current_value awal 0. TIDAK PERNAH mengubah nilai sequence yang sudah
 * ada.
 *
 * Menggunakan nama kolom canonical (`sequence_name`/`current_value`) —
 * setupDatabase() sendiri hanya boleh berjalan pada sheet yang headernya
 * sudah tervalidasi cocok dengan SETUP_DATABASE_SCHEMA_ (lihat TAHAP 1
 * pada setupDatabase()), sehingga di titik ini nama kolom pasti sudah
 * canonical. SequenceService.gs (dipakai domain service produksi)
 * tetap punya alias resolution sendiri untuk sheet yang mungkin belum
 * melalui setupDatabase() — lihat catatan "SEQUENCE COMPATIBILITY LAYER"
 * pada SequenceService.gs.
 *
 * @param {string} sequenceKey Nama sequence, mis. CONFIG.SEQUENCES.REPORT.
 * @param {Object} summary Akumulator ringkasan (dimutasi langsung).
 * @private
 */
function setupDatabaseEnsureSequence_(sequenceKey, summary) {
  var existing = getRowById(CONFIG.SHEETS.SEQUENCES, 'sequence_name', sequenceKey);

  if (existing) {
    summary.sequences_verified.push(sequenceKey);
    Logger.log('[VERIFIED] Sequence "' + sequenceKey + '" sudah ada (current_value=' + existing.current_value + '), tidak diubah.');
    return;
  }

  insertRow(CONFIG.SHEETS.SEQUENCES, {
    sequence_name: sequenceKey,
    current_value: 0,
    updated_at: nowTimestamp()
  });
  summary.sequences_created.push(sequenceKey);
  Logger.log('[CREATED] Sequence "' + sequenceKey + '" diinisialisasi dengan current_value=0.');
}

/**
 * Memeriksa apakah baris header dianggap kosong (belum pernah diisi sama
 * sekali): array kosong, atau seluruh sel header berupa string kosong.
 *
 * @param {Array} headers Header row hasil getHeaderRow_().
 * @return {boolean} true jika dianggap kosong.
 * @private
 */
function setupDatabaseIsHeaderEmpty_(headers) {
  if (!headers || headers.length === 0) {
    return true;
  }
  return headers.every(function (h) { return h === '' || h === null || h === undefined; });
}

/**
 * Membandingkan header aktual dengan header yang diharapkan BERBASIS SET
 * nama kolom (bukan urutan) — lihat catatan "PERBANDINGAN HEADER" pada
 * header file ini untuk alasan desainnya. Kolom hilang maupun kolom asing
 * yang tidak dikenal sama-sama dianggap tidak cocok.
 *
 * @param {Array<string>} expectedHeaders Header sesuai schema resmi.
 * @param {Array<string>} actualHeaders Header yang sebenarnya ada di sheet.
 * @return {boolean} true jika set kolom cocok persis.
 * @private
 */
function setupDatabaseHeadersMatch_(expectedHeaders, actualHeaders) {
  var normalizedExpected = expectedHeaders.filter(function (h) { return h !== '' && h !== null && h !== undefined; });
  var normalizedActual = actualHeaders.filter(function (h) { return h !== '' && h !== null && h !== undefined; });

  if (normalizedExpected.length !== normalizedActual.length) {
    return false;
  }

  var expectedSorted = normalizedExpected.slice().sort();
  var actualSorted = normalizedActual.slice().sort();

  for (var i = 0; i < expectedSorted.length; i++) {
    if (expectedSorted[i] !== actualSorted[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Mencetak ringkasan hasil setupDatabase() ke Logger dalam format yang
 * mudah dibaca dari execution log Apps Script.
 * @param {Object} summary Hasil dari setupDatabase().
 * @private
 */
function setupDatabaseLogSummary_(summary) {
  Logger.log('==============================================');
  Logger.log('SIGAP SARPRAS — DATABASE SETUP SUMMARY');
  Logger.log('==============================================');
  Logger.log('Status           : ' + summary.status);
  Logger.log('Spreadsheet ID   : ' + summary.spreadsheet_id);
  Logger.log('Sheets dibuat    : ' + summary.sheets_created.length + (summary.sheets_created.length ? ' (' + summary.sheets_created.join(', ') + ')' : ''));
  Logger.log('Sheets terverifikasi : ' + summary.sheets_verified.length);
  Logger.log('Sequence dibuat  : ' + summary.sequences_created.length + (summary.sequences_created.length ? ' (' + summary.sequences_created.join(', ') + ')' : ''));
  Logger.log('Sequence terverifikasi : ' + summary.sequences_verified.length);
  Logger.log('==============================================');
}

/**
 * Memverifikasi setup database TANPA mengubah apa pun (read-only).
 * Memeriksa keberadaan dan kesesuaian header seluruh sheet, serta
 * keberadaan seluruh baris sequence yang dibutuhkan sistem. Selalu
 * mengembalikan laporan terstruktur — tidak pernah melempar Error, agar
 * dapat dipakai sebagai pemeriksaan rutin yang aman.
 *
 * @return {{success: boolean, sheets: Array<Object>, sequences: Array<Object>}}
 *   Laporan PASS/FAIL per sheet dan per sequence.
 */
function verifyDatabaseSetup() {
  var sheetResults = [];
  var sequenceResults = [];
  var spreadsheet;

  try {
    spreadsheet = getSpreadsheet();
  } catch (e) {
    Logger.log('[FAIL] Tidak dapat membuka spreadsheet: ' + e.message);
    var failureReport = { success: false, sheets: [], sequences: [], detail: e.message };
    verifyDatabaseLogReport_(failureReport);
    return failureReport;
  }

  var sequencesSheetOk = true;

  for (var i = 0; i < SETUP_DATABASE_SCHEMA_.length; i++) {
    var result = verifyDatabaseCheckSheet_(spreadsheet, SETUP_DATABASE_SCHEMA_[i]);
    sheetResults.push(result);
    if (SETUP_DATABASE_SCHEMA_[i].sheetName === CONFIG.SHEETS.SEQUENCES && result.status !== 'PASS') {
      sequencesSheetOk = false;
    }
  }

  var sequenceKeys = Object.keys(CONFIG.SEQUENCES).map(function (key) { return CONFIG.SEQUENCES[key]; });
  for (var j = 0; j < sequenceKeys.length; j++) {
    sequenceResults.push(verifyDatabaseCheckSequence_(sequenceKeys[j], sequencesSheetOk));
  }

  var allPassed = sheetResults.concat(sequenceResults).every(function (r) { return r.status === 'PASS'; });
  var report = { success: allPassed, sheets: sheetResults, sequences: sequenceResults };
  verifyDatabaseLogReport_(report);
  return report;
}

/**
 * Memeriksa satu sheet: keberadaan dan kesesuaian header. Tidak mengubah
 * apa pun.
 * @param {Spreadsheet} spreadsheet Spreadsheet database aktif.
 * @param {{sheetName: string, headers: Array<string>}} schemaEntry Entri schema satu sheet.
 * @return {{name: string, status: string, detail: string}} Hasil pemeriksaan.
 * @private
 */
function verifyDatabaseCheckSheet_(spreadsheet, schemaEntry) {
  var sheetName = schemaEntry.sheetName;
  var sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    return { name: sheetName, status: 'FAIL', detail: 'Sheet tidak ditemukan.' };
  }

  var actualHeaders = getHeaderRow_(sheet);

  if (setupDatabaseIsHeaderEmpty_(actualHeaders)) {
    return { name: sheetName, status: 'FAIL', detail: 'Sheet ada tetapi header kosong.' };
  }

  if (!setupDatabaseHeadersMatch_(schemaEntry.headers, actualHeaders)) {
    return {
      name: sheetName,
      status: 'FAIL',
      detail: 'Header tidak sesuai. Expected: [' + schemaEntry.headers.join(', ') + '], Actual: [' + actualHeaders.join(', ') + ']'
    };
  }

  return { name: sheetName, status: 'PASS', detail: '' };
}

/**
 * Memeriksa satu sequence: apakah barisnya sudah ada pada 91_sequences.
 * Tidak mengubah apa pun.
 * @param {string} sequenceKey Nama sequence.
 * @param {boolean} sequencesSheetOk Apakah sheet 91_sequences sendiri
 *   lolos pemeriksaan header (jika false, pemeriksaan ini dilewati agar
 *   tidak memanggil getRowById() pada sheet yang berpotensi tidak valid).
 * @return {{name: string, status: string, detail: string}} Hasil pemeriksaan.
 * @private
 */
function verifyDatabaseCheckSequence_(sequenceKey, sequencesSheetOk) {
  if (!sequencesSheetOk) {
    return { name: sequenceKey, status: 'FAIL', detail: 'Dilewati — sheet 91_sequences tidak valid.' };
  }

  var existing = getRowById(CONFIG.SHEETS.SEQUENCES, 'sequence_name', sequenceKey);

  if (!existing) {
    return { name: sequenceKey, status: 'FAIL', detail: 'Baris sequence belum ada.' };
  }

  return { name: sequenceKey, status: 'PASS', detail: 'current_value=' + existing.current_value };
}

/**
 * Mencetak laporan verifyDatabaseSetup() ke Logger dalam format tabel
 * sederhana yang mudah dibaca dari execution log Apps Script.
 * @param {{success: boolean, sheets: Array<Object>, sequences: Array<Object>, detail: (string|undefined)}} report
 * @private
 */
function verifyDatabaseLogReport_(report) {
  var NAME_COLUMN_WIDTH = 22;

  function padName(name) {
    return (name + '                        ').substring(0, NAME_COLUMN_WIDTH);
  }

  Logger.log('==============================================');
  Logger.log('DATABASE SETUP VERIFICATION');
  Logger.log('==============================================');

  if (report.detail && report.sheets.length === 0) {
    Logger.log('[FAIL] ' + report.detail);
    Logger.log('==============================================');
    return;
  }

  for (var i = 0; i < report.sheets.length; i++) {
    var s = report.sheets[i];
    Logger.log(padName(s.name) + s.status + (s.status === 'FAIL' ? ' - ' + s.detail : ''));
  }

  Logger.log('');

  for (var j = 0; j < report.sequences.length; j++) {
    var seq = report.sequences[j];
    Logger.log(padName(seq.name + ' sequence') + seq.status + (seq.status === 'FAIL' ? ' - ' + seq.detail : ''));
  }

  Logger.log('==============================================');
  Logger.log('Overall: ' + (report.success ? 'PASS' : 'FAIL'));
  Logger.log('==============================================');
}
