/**
 * MasterDataApi.gs
 *
 * Fungsi PUBLIK read-only yang dipanggil dari client (Index.html) lewat
 * google.script.run, khusus untuk mengisi pilihan (dropdown) pada form
 * pembuatan laporan (lokasi, kategori). Sama seperti ReportApi.gs — tidak
 * ada logika bisnis di sini, hanya identifikasi pemanggil + pass-through
 * ke Service Layer Master Data yang sudah ada + pembungkusan response.
 *
 * facility_id/owner_id SENGAJA TIDAK diekspos sebagai dropdown pada MVP
 * ini (field opsional pada createReport, lihat apps-script/reports/README.md)
 * — mengurangi kompleksitas form MVP; tetap dapat dikirim manual lewat
 * apiCreateReport() bila dibutuhkan.
 *
 * Dependency:
 * - apps-script/api/AuthContext.gs (getCurrentUserContext_)
 * - apps-script/api/ApiUtil.gs (apiRun_)
 * - apps-script/master-data/LocationService.gs (listActiveLocations)
 * - apps-script/master-data/CategoryService.gs (listActiveCategories)
 */

/**
 * Mengambil daftar lokasi aktif, untuk dropdown form laporan.
 * @return {{success: boolean, data: *, error: ?Object}}
 */
function apiListLocations() {
  return apiRun_(function () {
    getCurrentUserContext_();
    return listActiveLocations();
  });
}

/**
 * Mengambil daftar kategori aktif, untuk dropdown form laporan.
 * @return {{success: boolean, data: *, error: ?Object}}
 */
function apiListCategories() {
  return apiRun_(function () {
    getCurrentUserContext_();
    return listActiveCategories();
  });
}
