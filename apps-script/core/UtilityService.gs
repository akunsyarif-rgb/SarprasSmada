/**
 * UtilityService.gs
 *
 * Kumpulan fungsi bantu lintas domain yang tidak spesifik terhadap satu
 * domain bisnis tertentu: format timestamp, validasi umum, dan struktur
 * response standar. Modul ini dapat digunakan oleh seluruh layer lain
 * (Database Access, Sequence Service, Domain Services) dan hanya
 * bergantung pada core/Config.gs (untuk TIMEZONE) beserta layanan bawaan
 * Apps Script (Utilities).
 *
 * Dependency: core/Config.gs (CONFIG.TIMEZONE)
 *
 * Referensi: docs/ARCHITECTURE.md (bagian CORE — Utility)
 */

/**
 * Memformat objek Date menjadi string timestamp ISO 8601 sesuai timezone
 * resmi sistem (Asia/Makassar, lihat CONFIG.TIMEZONE).
 *
 * @param {Date} date Objek tanggal yang akan diformat.
 * @return {string} Timestamp terformat, mis. "2026-08-30T14:00:00+08:00".
 * @throws {Error} Jika "date" bukan objek Date yang valid.
 */
function formatTimestamp(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('UtilityService.formatTimestamp: "date" harus berupa objek Date yang valid.');
  }
  return Utilities.formatDate(date, CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * Mengambil timestamp saat ini dalam format standar sistem.
 *
 * @return {string} Timestamp saat ini, sesuai format formatTimestamp().
 */
function nowTimestamp() {
  return formatTimestamp(new Date());
}

/**
 * Memeriksa apakah suatu nilai dianggap kosong: null, undefined, atau
 * string kosong setelah di-trim (whitespace saja dianggap kosong).
 *
 * @param {*} value Nilai yang akan diperiksa.
 * @return {boolean} true jika nilai dianggap kosong.
 */
function isEmpty(value) {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  return false;
}

/**
 * Memvalidasi format alamat email secara umum (bukan verifikasi
 * keberadaan email, hanya validasi format).
 *
 * @param {string} email Alamat email yang akan divalidasi.
 * @return {boolean} true jika format email valid.
 */
function isValidEmail(email) {
  if (typeof email !== 'string') {
    return false;
  }
  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email.trim());
}

/**
 * Membuat struktur response sukses yang seragam, digunakan sebagai bentuk
 * keluaran standar seluruh fungsi backend yang dipanggil frontend.
 *
 * @param {*} [data] Data hasil operasi. Default null jika tidak diisi.
 * @return {{success: boolean, data: *, error: null}} Objek response.
 */
function createSuccessResponse(data) {
  return {
    success: true,
    data: data !== undefined ? data : null,
    error: null
  };
}

/**
 * Membuat struktur response gagal yang seragam, digunakan sebagai bentuk
 * keluaran standar saat terjadi kesalahan pada fungsi backend.
 *
 * @param {string} message Pesan kesalahan yang jelas untuk pengguna/klien.
 * @param {*} [details] Detail tambahan mengenai kesalahan (opsional).
 * @return {{success: boolean, data: null, error: Object}} Objek response.
 * @throws {Error} Jika "message" tidak diisi atau bukan string.
 */
function createErrorResponse(message, details) {
  if (!message || typeof message !== 'string') {
    throw new Error('UtilityService.createErrorResponse: "message" wajib diisi dan bertipe string.');
  }
  return {
    success: false,
    data: null,
    error: {
      message: message,
      details: details !== undefined ? details : null
    }
  };
}
