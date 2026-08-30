/**
 * SequenceService.gs
 *
 * Layanan pembangkit ID unik dan nomor urut (sequence) untuk SIGAP SARPRAS,
 * bersumber dari sheet 91_sequences (lihat docs/DATABASE_SCHEMA.md).
 *
 * SequenceService menggunakan LockService.getScriptLock() agar seluruh
 * proses baca-ubah-tulis (read-increment-write) terhadap nilai counter
 * bersifat atomik dalam SATU lock yang sama, sehingga aman dari race
 * condition saat beberapa eksekusi berjalan bersamaan (concurrent).
 *
 * Modul ini sengaja mengakses sheet 91_sequences secara langsung melalui
 * getSheetByName()/getHeaderRow_() dari DatabaseService.gs, bukan melalui
 * insertRow()/updateRowById() milik DatabaseService — karena fungsi-fungsi
 * tersebut memperoleh lock-nya sendiri, sehingga jika dipanggil dari sini
 * proses baca dan tulis akan terpisah menjadi dua lock berbeda dan celah
 * race condition tetap terbuka di antara keduanya.
 *
 * SEQUENCE COMPATIBILITY LAYER (PHASE 3.75 — Legacy-Compatible Reconciliation):
 * Canonical nama kolom sheet 91_sequences adalah `sequence_name`/
 * `current_value` — mengikuti struktur database produksi SIGAP SARPRAS
 * yang sudah berjalan nyata (dikonfirmasi via inspeksi read-only langsung
 * terhadap spreadsheet produksi), BUKAN nama `sequence_key`/`last_value`
 * yang sebelumnya hanya ada di dokumentasi repository dan tidak pernah
 * benar-benar dipakai di deployment mana pun.
 *
 * Untuk backward compatibility (mis. bila suatu saat ada sheet yang dibuat
 * memakai nama kolom lama sesuai dokumentasi versi sebelumnya), modul ini
 * mendeteksi kolom kunci/nilai berdasarkan DAFTAR ALIAS
 * (SEQUENCE_SHEET_COLUMNS_.KEY_ALIASES / VALUE_ALIASES), bukan satu nama
 * tetap. Nama kolom yang benar-benar cocok pada sheet nyata itulah yang
 * dipakai untuk membaca DAN menulis (termasuk saat membuat baris sequence
 * baru) — sehingga modul ini otomatis mengikuti nama kolom yang sudah ada
 * di sheet, tanpa perlu tahu di awal varian mana yang dipakai, dan TANPA
 * PERNAH mengubah/mengganti nama kolom pada spreadsheet itu sendiri.
 *
 * Arsitektur:
 *   CONFIG → DATABASE ACCESS → SEQUENCE SERVICE → DOMAIN SERVICES
 *
 * Dependency:
 * - core/Config.gs (CONFIG.SHEETS.SEQUENCES, CONFIG.SEQUENCES, CONFIG.TIMEZONE)
 * - core/DatabaseService.gs (getSheetByName, getHeaderRow_)
 *
 * Referensi: docs/DATABASE_SCHEMA.md (91_sequences), docs/DATABASE_SETUP.md
 */

/**
 * Alias nama kolom kunci/nilai yang dikenali pada sheet 91_sequences,
 * diurutkan dari yang paling disukai (canonical) ke alias lama — lihat
 * catatan "SEQUENCE COMPATIBILITY LAYER" pada header file ini.
 * @private
 */
var SEQUENCE_SHEET_COLUMNS_ = {
  KEY_ALIASES: ['sequence_name', 'sequence_key'],
  VALUE_ALIASES: ['current_value', 'last_value'],
  UPDATED_AT: 'updated_at'
};

/**
 * Mencari index kolom pertama pada header yang cocok dengan salah satu
 * alias yang diberikan (exact match, urutan alias menentukan prioritas).
 * @param {Array<string>} headers Header row sheet.
 * @param {Array<string>} aliases Daftar nama kolom yang dianggap setara.
 * @return {number} Index kolom (0-based), atau -1 jika tidak ditemukan.
 * @private
 */
function sequenceFindColumnIndex_(headers, aliases) {
  for (var i = 0; i < aliases.length; i++) {
    var idx = headers.indexOf(aliases[i]);
    if (idx !== -1) {
      return idx;
    }
  }
  return -1;
}

/**
 * Mengambil nilai berikutnya dari suatu sequence secara atomik, lalu
 * menyimpan nilai tersebut kembali ke sheet 91_sequences. Jika sequence
 * dengan nama tersebut belum pernah ada, baris baru akan dibuat otomatis
 * mulai dari nilai 1.
 *
 * @param {string} sequenceName Nama/kunci sequence, mis. "REPORT" atau
 *   CONFIG.SEQUENCES.REPORT.
 * @return {number} Nilai sequence berikutnya (bulat, mulai dari 1).
 * @throws {Error} Jika sequenceName tidak valid, struktur sheet
 *   91_sequences tidak sesuai (tidak ada satu pun alias kolom kunci/nilai
 *   yang dikenali ditemukan — lihat SEQUENCE_SHEET_COLUMNS_), atau lock
 *   gagal diperoleh dalam batas waktu yang ditentukan.
 */
function getNextSequence(sequenceName) {
  if (!sequenceName || typeof sequenceName !== 'string') {
    throw new Error('SequenceService.getNextSequence: "sequenceName" wajib diisi dan bertipe string.');
  }

  var lock = LockService.getScriptLock();
  var lockAcquired = lock.tryLock(15000);
  if (!lockAcquired) {
    throw new Error(
      'SequenceService.getNextSequence: Gagal memperoleh lock untuk sequence "' +
      sequenceName + '" dalam batas waktu yang ditentukan. Coba lagi.'
    );
  }

  try {
    var sheet = getSheetByName(CONFIG.SHEETS.SEQUENCES);
    var headers = getHeaderRow_(sheet);
    var keyColIndex = sequenceFindColumnIndex_(headers, SEQUENCE_SHEET_COLUMNS_.KEY_ALIASES);
    var valueColIndex = sequenceFindColumnIndex_(headers, SEQUENCE_SHEET_COLUMNS_.VALUE_ALIASES);
    var updatedAtColIndex = headers.indexOf(SEQUENCE_SHEET_COLUMNS_.UPDATED_AT);

    if (keyColIndex === -1 || valueColIndex === -1) {
      throw new Error(
        'SequenceService.getNextSequence: Sheet "' + CONFIG.SHEETS.SEQUENCES +
        '" wajib memiliki kolom kunci sequence (salah satu dari: ' +
        SEQUENCE_SHEET_COLUMNS_.KEY_ALIASES.join(', ') + ') dan kolom nilai sequence (salah satu dari: ' +
        SEQUENCE_SHEET_COLUMNS_.VALUE_ALIASES.join(', ') + ') sesuai docs/DATABASE_SCHEMA.md.'
      );
    }

    // Nama kolom yang BENAR-BENAR ada di sheet ini — dipakai apa adanya saat
    // menulis baris baru, sehingga SequenceService mengikuti alias yang
    // sudah dipakai sheet (legacy atau canonical), bukan memaksakan satu nama.
    var keyColumnName = headers[keyColIndex];
    var valueColumnName = headers[valueColIndex];

    var lastRow = sheet.getLastRow();
    var targetRowIndex = -1;
    var currentValue = 0;

    if (lastRow >= 2) {
      var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
      for (var i = 0; i < values.length; i++) {
        if (values[i][keyColIndex] === sequenceName) {
          targetRowIndex = i;
          currentValue = Number(values[i][valueColIndex]) || 0;
          break;
        }
      }
    }

    var nextValue = currentValue + 1;
    var now = new Date();

    if (targetRowIndex === -1) {
      var newRow = headers.map(function (header) {
        if (header === keyColumnName) return sequenceName;
        if (header === valueColumnName) return nextValue;
        if (header === SEQUENCE_SHEET_COLUMNS_.UPDATED_AT) return now;
        return '';
      });
      sheet.appendRow(newRow);
    } else {
      var sheetRowNumber = targetRowIndex + 2;
      sheet.getRange(sheetRowNumber, valueColIndex + 1).setValue(nextValue);
      if (updatedAtColIndex !== -1) {
        sheet.getRange(sheetRowNumber, updatedAtColIndex + 1).setValue(now);
      }
    }

    return nextValue;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Menambahkan angka nol di depan (leading zero) suatu bilangan bulat
 * hingga mencapai panjang digit tertentu.
 *
 * @param {number} number Angka yang akan diformat (bilangan bulat).
 * @param {number} length Panjang digit akhir yang diinginkan.
 * @return {string} Angka dalam bentuk string dengan leading zero, mis.
 *   padNumber(7, 6) => "000007".
 * @throws {Error} Jika number bukan angka valid, atau length bukan angka
 *   positif.
 */
function padNumber(number, length) {
  if (typeof number !== 'number' || isNaN(number)) {
    throw new Error('SequenceService.padNumber: "number" harus berupa angka yang valid.');
  }
  if (typeof length !== 'number' || length <= 0) {
    throw new Error('SequenceService.padNumber: "length" harus berupa angka positif.');
  }

  var isNegative = number < 0;
  var numberString = String(Math.trunc(Math.abs(number)));

  while (numberString.length < length) {
    numberString = '0' + numberString;
  }

  return (isNegative ? '-' : '') + numberString;
}

/**
 * Membuat ID entitas unik dengan format "PREFIX-000001", menggunakan
 * sequence tertentu sebagai sumber angka urut. Format ini digunakan untuk
 * ID internal entitas apa pun (mis. report_id, atau entitas domain lain
 * pada tahap pengembangan berikutnya).
 *
 * @param {string} prefix Awalan ID, mis. CONFIG.ID_PREFIXES.REPORT ("RPT").
 * @param {string} sequenceName Nama sequence yang digunakan sebagai sumber
 *   angka urut, mis. CONFIG.SEQUENCES.REPORT.
 * @return {string} ID entitas, mis. "RPT-000001".
 * @throws {Error} Jika prefix tidak valid, atau getNextSequence gagal.
 */
function generateEntityId(prefix, sequenceName) {
  if (!prefix || typeof prefix !== 'string') {
    throw new Error('SequenceService.generateEntityId: "prefix" wajib diisi dan bertipe string.');
  }

  var nextValue = getNextSequence(sequenceName);
  return prefix + '-' + padNumber(nextValue, 6);
}

/**
 * Membuat nomor laporan publik dengan format "SRP-YYYY-000001", menggunakan
 * SATU sequence global monoton CONFIG.SEQUENCES.REPORT — sequence ini TIDAK
 * PERNAH direset per tahun. Tahun (YYYY) yang muncul pada nomor laporan
 * hanya bersifat tampilan (display), diambil dari tahun saat ini mengikuti
 * timezone Asia/Makassar (CONFIG.TIMEZONE); angka urut di baliknya tetap
 * berjalan menerus lintas tahun.
 *
 * Contoh urutan pemanggilan lintas pergantian tahun:
 *   SRP-2026-000001, SRP-2026-000002, SRP-2027-000003, SRP-2027-000004, ...
 *
 * report_id internal (dihasilkan melalui
 * generateEntityId(CONFIG.ID_PREFIXES.REPORT, CONFIG.SEQUENCES.REPORT))
 * menggunakan sequence yang sama persis (CONFIG.SEQUENCES.REPORT), sehingga
 * seluruh penomoran terkait laporan bersumber dari satu counter global yang
 * konsisten di sheet 91_sequences.
 *
 * @return {string} Nomor laporan, mis. "SRP-2026-000001".
 * @throws {Error} Jika getNextSequence gagal (lihat getNextSequence).
 */
function generateReportNumber() {
  var year = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy');
  var nextValue = getNextSequence(CONFIG.SEQUENCES.REPORT);
  return 'SRP-' + year + '-' + padNumber(nextValue, 6);
}
