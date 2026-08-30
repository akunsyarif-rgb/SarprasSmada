/**
 * Config.gs
 *
 * Lapisan konfigurasi tunggal (single source of truth) untuk SIGAP SARPRAS.
 * Modul lain (DatabaseService, SequenceService, UtilityService, dan domain
 * services pada tahap berikutnya) WAJIB membaca konfigurasi dari sini.
 * Spreadsheet ID, nama sheet, dan parameter global lainnya TIDAK BOLEH
 * di-hardcode di modul lain.
 *
 * Spreadsheet ID diambil dari Script Properties (Project Settings > Script
 * Properties) dengan key SPREADSHEET_ID — bukan dari nilai tetap di kode,
 * agar spreadsheet database dapat diganti per environment (development/
 * staging/production) tanpa mengubah source code.
 *
 * Arsitektur:
 *   CONFIG → DATABASE ACCESS → SEQUENCE SERVICE → DOMAIN SERVICES
 *
 * Referensi: docs/ARCHITECTURE.md (bagian CORE), docs/DATABASE_SCHEMA.md
 */

/**
 * Konfigurasi global sistem.
 * @const
 */
var CONFIG = {
  /** Key Script Properties yang digunakan sistem. */
  SCRIPT_PROPERTY_KEYS: {
    SPREADSHEET_ID: 'SPREADSHEET_ID'
  },

  /** Timezone resmi yang digunakan seluruh sistem untuk pencatatan waktu. */
  TIMEZONE: 'Asia/Makassar',

  /** Pemetaan nama sheet database sesuai docs/DATABASE_SCHEMA.md. */
  SHEETS: {
    USERS: '01_users',
    LOCATIONS: '02_locations',
    CATEGORIES: '03_categories',
    FACILITIES: '04_facilities',
    OWNERS: '05_owners',
    REPORTS: '10_reports',
    REPORT_PHOTOS: '11_report_photos',
    REPORT_HISTORY: '12_report_history',
    REPORT_COMMENTS: '13_report_comments',
    AUDIT_LOGS: '20_audit_logs',
    SETTINGS: '90_settings',
    SEQUENCES: '91_sequences'
  },

  /**
   * Nama sequence yang dikelola SequenceService melalui sheet 91_sequences.
   * Setiap key merepresentasikan SATU baris counter monoton pada sheet
   * tersebut dan TIDAK PERNAH direset (mis. tidak ada varian per tahun
   * seperti "REPORT_2026"). Lihat SequenceService.generateReportNumber()
   * untuk contoh bagaimana tahun tampilan tetap terpisah dari nilai
   * counter yang monoton.
   *
   * CORE_TEST khusus digunakan oleh apps-script/tests/CoreSmokeTest.gs
   * untuk pengujian manual dan tidak boleh dipakai oleh domain service
   * produksi.
   */
  SEQUENCES: {
    REPORT: 'REPORT',
    HISTORY: 'HISTORY',
    AUDIT: 'AUDIT',
    CORE_TEST: 'CORE_TEST'
  },

  /** Prefix ID entitas, digunakan bersama SequenceService.generateEntityId(). */
  ID_PREFIXES: {
    REPORT: 'RPT',
    HISTORY: 'HIS',
    AUDIT: 'AUD',
    CORE_TEST: 'TST'
  }
};

/**
 * Mengambil Spreadsheet ID database sistem dari Script Properties.
 * Spreadsheet ID tidak boleh di-hardcode di kode — nilainya wajib diset
 * melalui Project Settings > Script Properties dengan key SPREADSHEET_ID.
 *
 * @return {string} Spreadsheet ID.
 * @throws {Error} Jika Script Property SPREADSHEET_ID belum diset.
 */
function getSpreadsheetId() {
  var spreadsheetId = PropertiesService.getScriptProperties()
    .getProperty(CONFIG.SCRIPT_PROPERTY_KEYS.SPREADSHEET_ID);

  if (!spreadsheetId) {
    throw new Error(
      'Config.getSpreadsheetId: Script Property "' +
      CONFIG.SCRIPT_PROPERTY_KEYS.SPREADSHEET_ID +
      '" belum diset. Set nilainya melalui Project Settings > Script Properties ' +
      'sebelum menjalankan sistem.'
    );
  }

  return spreadsheetId;
}

/**
 * Membuka Spreadsheet database sistem berdasarkan Spreadsheet ID yang
 * dikonfigurasi pada Script Properties.
 *
 * @return {Spreadsheet} Objek Spreadsheet aktif sebagai database.
 * @throws {Error} Jika Spreadsheet ID belum diset atau spreadsheet tidak
 *   dapat dibuka (ID salah, dihapus, atau tidak ada akses).
 */
function getSpreadsheet() {
  var spreadsheetId = getSpreadsheetId();

  try {
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (e) {
    throw new Error(
      'Config.getSpreadsheet: Gagal membuka spreadsheet dengan ID "' +
      spreadsheetId + '". Pastikan ID benar dan script memiliki akses. Detail: ' +
      e.message
    );
  }
}
