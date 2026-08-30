/**
 * ApiUtil.gs
 *
 * Helper generik untuk lapisan API (apps-script/api/) — SATU tempat untuk
 * membungkus pemanggilan Service Layer dengan format response standar
 * (core/UtilityService.gs: createSuccessResponse/createErrorResponse),
 * agar setiap fungsi google.script.run yang dipanggil dari Index.html
 * SELALU mengembalikan bentuk yang konsisten dan TIDAK PERNAH melempar
 * Error mentah ke client (google.script.run menangani exception secara
 * terpisah dari data — membungkusnya di sini membuat penanganan error di
 * sisi client seragam untuk sukses maupun gagal).
 *
 * Dependency: core/UtilityService.gs (createSuccessResponse, createErrorResponse)
 */

/**
 * Menjalankan satu operasi API, menangkap Error apa pun, dan selalu
 * mengembalikan struktur response standar.
 *
 * @param {function(): *} fn Fungsi yang menjalankan satu operasi API.
 * @return {{success: boolean, data: *, error: ?Object}} Response standar.
 * @private
 */
function apiRun_(fn) {
  try {
    return createSuccessResponse(fn());
  } catch (e) {
    return createErrorResponse(e.message);
  }
}
