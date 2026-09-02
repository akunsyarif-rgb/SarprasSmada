/**
 * helpers.js
 *
 * Fungsi bantu murni (tidak menyimpan state), dipakai oleh komponen lain.
 */

/**
 * Memformat timestamp ISO 8601 (format yang dipakai backend, lihat
 * apps-script/core/UtilityService.gs formatTimestamp()) menjadi string
 * yang enak dibaca dalam Bahasa Indonesia.
 * @param {string} isoString
 * @return {string}
 */
function formatDateTime(isoString) {
  if (!isoString) {
    return '-';
  }
  var d = new Date(isoString);
  if (isNaN(d.getTime())) {
    return String(isoString);
  }
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Urutan status workflow kanonik, sesuai docs/WORKFLOW.md — dipakai untuk
 * menentukan status berikutnya sebagai SARAN TAMPILAN saja. Legalitas
 * transisi TETAP divalidasi ulang di server
 * (ReportWorkflowService.changeReportStatus) — daftar ini tidak boleh
 * dipakai sebagai satu-satunya validasi.
 * @type {Array<string>}
 */
var REPORT_STATUS_ORDER = ['SUBMITTED', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'];

/**
 * Mengambil status berikutnya (SARAN, bukan otoritatif) dari status saat ini.
 * @param {string} currentStatus
 * @return {?string} Status berikutnya, atau null jika sudah status akhir/tidak dikenal.
 */
function nextReportStatus(currentStatus) {
  var idx = REPORT_STATUS_ORDER.indexOf(currentStatus);
  if (idx === -1 || idx === REPORT_STATUS_ORDER.length - 1) {
    return null;
  }
  return REPORT_STATUS_ORDER[idx + 1];
}

/**
 * Label warna badge per status laporan (nama kelas CSS, lihat index.html).
 * @param {string} status
 * @return {string}
 */
function reportStatusBadgeClass(status) {
  switch (status) {
    case 'SUBMITTED': return 'badge-gray';
    case 'VERIFIED': return 'badge-blue';
    case 'ASSIGNED': return 'badge-purple';
    case 'IN_PROGRESS': return 'badge-yellow';
    case 'COMPLETED': return 'badge-green';
    case 'CLOSED': return 'badge-dark';
    default: return 'badge-gray';
  }
}

/**
 * Menyusun location_name -> objek lokasi menjadi peta cepat berdasarkan id,
 * dipakai untuk menampilkan nama dari id yang tersimpan pada laporan.
 * @param {Array<Object>} list Daftar objek dengan field id.
 * @param {string} idField Nama field id, mis. "location_id".
 * @return {Object<string, Object>}
 */
function indexById(list, idField) {
  var map = {};
  (list || []).forEach(function (item) {
    map[item[idField]] = item;
  });
  return map;
}
