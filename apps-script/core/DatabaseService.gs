/**
 * DatabaseService.gs
 *
 * Lapisan akses data (Database Access) untuk SIGAP SARPRAS. Modul ini
 * adalah SATU-SATUNYA lapisan yang boleh memanggil SpreadsheetApp secara
 * langsung. Domain services lain (users, master-data, reports, audit)
 * WAJIB mengakses data melalui fungsi-fungsi pada modul ini — tidak ada
 * pemanggilan SpreadsheetApp secara langsung di luar core/.
 *
 * Konvensi data:
 * - Baris pertama tiap sheet adalah header (nama kolom), sesuai
 *   docs/DATABASE_SCHEMA.md.
 * - Setiap baris data dipetakan menjadi objek JavaScript berdasarkan nama
 *   kolom pada header, bukan berdasarkan posisi kolom yang di-hardcode.
 * - Operasi tulis (insertRow, updateRowById) dilindungi LockService agar
 *   aman dari race condition saat beberapa eksekusi berjalan bersamaan.
 *
 * Arsitektur:
 *   CONFIG → DATABASE ACCESS → SEQUENCE SERVICE → DOMAIN SERVICES
 *
 * Dependency: core/Config.gs (getSpreadsheet)
 *
 * Referensi: docs/ARCHITECTURE.md, docs/DATABASE_SCHEMA.md
 */

/**
 * Mengambil objek Sheet berdasarkan nama.
 *
 * @param {string} sheetName Nama sheet, mis. CONFIG.SHEETS.USERS.
 * @return {Sheet} Objek Sheet Google Apps Script.
 * @throws {Error} Jika sheetName kosong/bukan string, atau sheet dengan
 *   nama tersebut tidak ditemukan pada spreadsheet.
 */
function getSheetByName(sheetName) {
  if (!sheetName || typeof sheetName !== 'string') {
    throw new Error('DatabaseService.getSheetByName: "sheetName" wajib diisi dan bertipe string.');
  }

  var spreadsheet = getSpreadsheet();
  var sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(
      'DatabaseService.getSheetByName: Sheet "' + sheetName +
      '" tidak ditemukan pada spreadsheet. Pastikan sheet sudah dibuat sesuai docs/DATABASE_SCHEMA.md.'
    );
  }

  return sheet;
}

/**
 * Mengambil baris header (baris pertama) suatu sheet.
 *
 * @param {Sheet} sheet Objek Sheet.
 * @return {Array<string>} Daftar nama kolom sesuai urutan pada sheet.
 *   Array kosong jika sheet belum memiliki kolom sama sekali.
 * @private
 */
function getHeaderRow_(sheet) {
  var lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) {
    return [];
  }
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
}

/**
 * Mengubah satu baris array nilai menjadi objek berdasarkan header.
 *
 * @param {Array<string>} headers Daftar nama kolom.
 * @param {Array} rowArray Nilai satu baris data, urutan sesuai headers.
 * @return {Object} Representasi baris sebagai objek {namaKolom: nilai}.
 * @private
 */
function rowArrayToObject_(headers, rowArray) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    if (headers[i]) {
      obj[headers[i]] = rowArray[i];
    }
  }
  return obj;
}

/**
 * Mengubah objek data menjadi array nilai sesuai urutan header. Kolom
 * pada header yang tidak ada di objek data akan diisi string kosong.
 *
 * @param {Array<string>} headers Daftar nama kolom.
 * @param {Object} dataObject Objek data satu baris.
 * @return {Array} Array nilai sesuai urutan header.
 * @private
 */
function objectToRowArray_(headers, dataObject) {
  return headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(dataObject, header) ? dataObject[header] : '';
  });
}

/**
 * Mengambil seluruh baris data (tidak termasuk header) pada suatu sheet
 * dalam bentuk array of objects.
 *
 * @param {string} sheetName Nama sheet.
 * @return {Array<Object>} Daftar baris data sebagai objek. Array kosong
 *   jika sheet belum memiliki data.
 * @throws {Error} Jika sheet tidak ditemukan.
 */
function getAllRows(sheetName) {
  var sheet = getSheetByName(sheetName);
  var headers = getHeaderRow_(sheet);
  var lastRow = sheet.getLastRow();

  if (lastRow < 2 || headers.length === 0) {
    return [];
  }

  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(function (row) {
    return rowArrayToObject_(headers, row);
  });
}

/**
 * Mencari satu baris data berdasarkan nilai kolom ID.
 *
 * @param {string} sheetName Nama sheet.
 * @param {string} idColumn Nama kolom ID, mis. "user_id".
 * @param {*} idValue Nilai ID yang dicari.
 * @return {Object|null} Objek baris data jika ditemukan, atau null jika
 *   tidak ada baris yang cocok.
 * @throws {Error} Jika idColumn kosong/bukan string, atau sheet tidak
 *   ditemukan.
 */
function getRowById(sheetName, idColumn, idValue) {
  if (!idColumn || typeof idColumn !== 'string') {
    throw new Error('DatabaseService.getRowById: "idColumn" wajib diisi dan bertipe string.');
  }

  var rows = getAllRows(sheetName);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][idColumn] === idValue) {
      return rows[i];
    }
  }
  return null;
}

/**
 * Mencari baris data yang memenuhi kondisi tertentu.
 *
 * @param {string} sheetName Nama sheet.
 * @param {function(Object): boolean} predicateFn Fungsi kondisi pencarian,
 *   menerima satu baris data dan mengembalikan boolean.
 * @return {Array<Object>} Daftar baris data yang memenuhi kondisi.
 * @throws {Error} Jika predicateFn bukan function, atau sheet tidak
 *   ditemukan.
 */
function findRows(sheetName, predicateFn) {
  if (typeof predicateFn !== 'function') {
    throw new Error('DatabaseService.findRows: "predicateFn" wajib berupa function.');
  }
  return getAllRows(sheetName).filter(predicateFn);
}

/**
 * Menambahkan satu baris data baru pada sheet. Jika sheet belum memiliki
 * header sama sekali, header akan dibuat otomatis dari urutan properti
 * pada rowObject.
 *
 * Operasi ini dilindungi LockService agar aman dari race condition saat
 * beberapa eksekusi menulis ke sheet yang sama secara bersamaan.
 *
 * @param {string} sheetName Nama sheet.
 * @param {Object} rowObject Data baris baru, dalam bentuk {namaKolom: nilai}.
 * @return {Object} rowObject yang berhasil disimpan.
 * @throws {Error} Jika rowObject tidak valid, sheet tidak ditemukan, atau
 *   lock gagal diperoleh dalam batas waktu.
 */
function insertRow(sheetName, rowObject) {
  if (!rowObject || typeof rowObject !== 'object') {
    throw new Error('DatabaseService.insertRow: "rowObject" wajib diisi dan bertipe object.');
  }

  var lock = LockService.getScriptLock();
  var lockAcquired = lock.tryLock(10000);
  if (!lockAcquired) {
    throw new Error(
      'DatabaseService.insertRow: Gagal memperoleh lock untuk menulis ke sheet "' +
      sheetName + '" dalam batas waktu yang ditentukan. Coba lagi.'
    );
  }

  try {
    var sheet = getSheetByName(sheetName);
    var headers = getHeaderRow_(sheet);

    if (headers.length === 0) {
      headers = Object.keys(rowObject);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    var rowArray = objectToRowArray_(headers, rowObject);
    sheet.appendRow(rowArray);
    return rowObject;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Memperbarui sebagian kolom pada satu baris data berdasarkan ID. Hanya
 * kolom yang ada pada parameter "updates" yang akan diubah; kolom lain
 * pada baris tersebut tidak tersentuh.
 *
 * Operasi ini dilindungi LockService agar aman dari race condition saat
 * beberapa eksekusi memperbarui sheet yang sama secara bersamaan.
 *
 * @param {string} sheetName Nama sheet.
 * @param {string} idColumn Nama kolom ID, mis. "report_id".
 * @param {*} idValue Nilai ID baris yang ingin diperbarui.
 * @param {Object} updates Pasangan kolom-nilai yang ingin diperbarui.
 * @return {Object} Objek baris lengkap setelah diperbarui.
 * @throws {Error} Jika argumen tidak valid, kolom ID tidak ditemukan pada
 *   sheet, baris dengan ID tersebut tidak ditemukan, atau lock gagal
 *   diperoleh dalam batas waktu.
 */
function updateRowById(sheetName, idColumn, idValue, updates) {
  if (!idColumn || typeof idColumn !== 'string') {
    throw new Error('DatabaseService.updateRowById: "idColumn" wajib diisi dan bertipe string.');
  }
  if (!updates || typeof updates !== 'object') {
    throw new Error('DatabaseService.updateRowById: "updates" wajib diisi dan bertipe object.');
  }

  var lock = LockService.getScriptLock();
  var lockAcquired = lock.tryLock(10000);
  if (!lockAcquired) {
    throw new Error(
      'DatabaseService.updateRowById: Gagal memperoleh lock untuk memperbarui sheet "' +
      sheetName + '" dalam batas waktu yang ditentukan. Coba lagi.'
    );
  }

  try {
    var sheet = getSheetByName(sheetName);
    var headers = getHeaderRow_(sheet);
    var idColIndex = headers.indexOf(idColumn);

    if (idColIndex === -1) {
      throw new Error(
        'DatabaseService.updateRowById: Kolom "' + idColumn +
        '" tidak ditemukan pada sheet "' + sheetName + '".'
      );
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      throw new Error('DatabaseService.updateRowById: Sheet "' + sheetName + '" belum memiliki data.');
    }

    var dataRange = sheet.getRange(2, 1, lastRow - 1, headers.length);
    var values = dataRange.getValues();
    var targetIndex = -1;

    for (var i = 0; i < values.length; i++) {
      if (values[i][idColIndex] === idValue) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1) {
      throw new Error(
        'DatabaseService.updateRowById: Baris dengan "' + idColumn + '" = "' +
        idValue + '" tidak ditemukan pada sheet "' + sheetName + '".'
      );
    }

    var targetRow = values[targetIndex];
    Object.keys(updates).forEach(function (key) {
      var colIndex = headers.indexOf(key);
      if (colIndex !== -1) {
        targetRow[colIndex] = updates[key];
      }
    });

    sheet.getRange(targetIndex + 2, 1, 1, headers.length).setValues([targetRow]);
    return rowArrayToObject_(headers, targetRow);
  } finally {
    lock.releaseLock();
  }
}
