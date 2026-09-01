/**
 * App.gs
 *
 * Satu-satunya Web App entry point SIGAP SARPRAS (doGet/doPost) — JSON API
 * bertoken yang dipanggil dari frontend statis (`frontend/`, di-hosting
 * TERPISAH dari project Apps Script ini, mis. Vercel/GitHub Pages) lewat
 * `fetch()`, BUKAN lagi lewat `google.script.run` (yang hanya bekerja untuk
 * HTML yang disajikan Apps Script sendiri).
 *
 * ================================================================
 * PERUBAHAN ARSITEKTUR (menggantikan PHASE 4.5 MVP Usability)
 * ================================================================
 * Versi sebelumnya `doGet()` menyajikan `api/Index.html` (test harness
 * vanilla HTML/JS memakai `google.script.run`), dan pengguna diidentifikasi
 * dari sesi Google aktif. File itu (beserta `google.script.run` sebagai pola
 * komunikasi) SUDAH DIPENSIUNKAN — lihat commit yang menyertai perubahan ini
 * dan `docs/ARCHITECTURE.md`. Digantikan pola JSON API doGet/doPost + token
 * sesi (`apps-script/auth/AuthService.gs`), meniru arsitektur aplikasi SIGAP
 * (`Sigap-app`, TIDAK diubah oleh perubahan ini — lihat `Code.gs` di repo
 * tersebut untuk pola aslinya).
 *
 * DUA LAPIS TOKEN, JANGAN TERTUKAR:
 * 1. `token` (parameter request) — token API STATIS (Script Property
 *    API_TOKEN, lihat core/Config.gs getApiToken()), dikirim SETIAP request
 *    (GET maupun POST), diperiksa checkToken_() SEBELUM action apa pun
 *    diproses. Ini BUKAN autentikasi pengguna — hanya gerbang pertama.
 * 2. `sessionToken` (parameter aksi, untuk seluruh action KECUALI
 *    `status`/`login`) — token SESI hasil AuthService.login(), diteruskan
 *    ke fungsi apps-script/api/*Api.gs yang membutuhkan identitas pemanggil.
 *
 * CORS: frontend WAJIB mengirim body POST dengan Content-Type
 * `text/plain;charset=utf-8` (BUKAN `application/json`) — Apps Script Web
 * App tidak mengizinkan header kustom lewat preflight CORS, tapi
 * `e.postData.contents` di sini tetap diparse sebagai JSON apa pun
 * Content-Type yang dikirim, jadi body-nya tetap JSON biasa, hanya header
 * Content-Type-nya yang disamarkan agar browser tidak mengirim preflight
 * OPTIONS (yang tidak bisa dijawab Apps Script Web App). Lihat
 * frontend/api.js. CATATAN: perilaku CORS Apps Script Web App belum
 * diverifikasi end-to-end pada deployment nyata sebagai bagian dari
 * perubahan ini — WAJIB diuji coba langsung dari frontend yang benar-benar
 * di-hosting di origin terpisah sebelum dianggap selesai, lihat
 * docs/GAS_CLASP_DEPLOY.md bagian Testing.
 *
 * Konfigurasi deployment ada pada apps-script/appsscript.json
 * (`webapp.executeAs: "USER_DEPLOYING"`, `webapp.access: "ANYONE_ANONYMOUS"`
 * — WAJIB, karena identitas pengguna TIDAK LAGI berasal dari sesi Google;
 * lihat catatan di appsscript.json itu sendiri).
 *
 * Dependency: ContentService (bawaan Apps Script), core/Config.gs
 * (getApiToken), seluruh apps-script/api/*Api.gs
 */

/**
 * Entry point GET — action baca (read-only) via query string.
 * @param {Object} e Parameter request Apps Script.
 * @return {TextOutput}
 */
function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = params.action;

  // Status ping — TIDAK memerlukan token, sesuai pola yang sama dipakai
  // aplikasi SIGAP (BACKEND_VERSION) untuk membedakan "belum deploy ulang"
  // dari "sudah tapi error lain".
  if (!action) {
    return jsonOutput_(createSuccessResponse({
      service: 'SIGAP SARPRAS',
      backendVersion: APP_BACKEND_VERSION_
    }));
  }

  var tokenError = checkToken_(params.token);
  if (tokenError) {
    return jsonOutput_(tokenError);
  }

  return jsonOutput_(routeGetAction_(action, params));
}

/**
 * Entry point POST — action tulis (mutating) via JSON body.
 * @param {Object} e Parameter request Apps Script.
 * @return {TextOutput}
 */
function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (parseError) {
    return jsonOutput_(createErrorResponse('Body request bukan JSON yang valid.'));
  }

  var tokenError = checkToken_(body.token);
  if (tokenError) {
    return jsonOutput_(tokenError);
  }

  return jsonOutput_(routePostAction_(body.action, body));
}

/** Versi backend saat ini — bump setiap perubahan .gs perlu diverifikasi setelah deploy manual. @private */
var APP_BACKEND_VERSION_ = 1;

/**
 * Memeriksa token API statis. Mengembalikan response error siap-kirim bila
 * tidak valid, atau null bila valid.
 * @param {string} token
 * @return {?Object}
 * @private
 */
function checkToken_(token) {
  var expected;
  try {
    expected = getApiToken();
  } catch (e) {
    return createErrorResponse('Server belum dikonfigurasi (API_TOKEN belum diset).');
  }
  if (isEmpty(token) || token !== expected) {
    return createErrorResponse('Token API tidak valid.');
  }
  return null;
}

/**
 * Membungkus objek response standar (createSuccessResponse/createErrorResponse)
 * menjadi TextOutput JSON.
 * @param {Object} responseObject
 * @return {TextOutput}
 * @private
 */
function jsonOutput_(responseObject) {
  return ContentService
    .createTextOutput(JSON.stringify(responseObject))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Router action GET. Setiap action (kecuali "status", ditangani di doGet())
 * memerlukan sessionToken yang divalidasi oleh fungsi api* masing-masing.
 * @param {string} action
 * @param {Object} p Query params.
 * @return {Object} Response standar (createSuccessResponse/createErrorResponse).
 * @private
 */
function routeGetAction_(action, p) {
  switch (action) {
    case 'getCurrentUser':
      return apiGetCurrentUser(p.sessionToken);
    case 'listReports':
      return apiListReports(p.sessionToken, p.status);
    case 'getReport':
      return apiGetReport(p.sessionToken, p.reportId);
    case 'listReportHistory':
      return apiListReportHistory(p.sessionToken, p.reportId);
    case 'getReportStatusOptions':
      return apiGetReportStatusOptions(p.sessionToken);
    case 'listLocations':
      return apiListLocations(p.sessionToken);
    case 'listCategories':
      return apiListCategories(p.sessionToken);
    case 'listFacilities':
      return apiListFacilities(p.sessionToken);
    case 'listOwners':
      return apiListOwners(p.sessionToken);
    case 'listUsers':
      return apiListUsers(p.sessionToken);
    default:
      return createErrorResponse('Action GET tidak dikenal: "' + action + '".');
  }
}

/**
 * Router action POST.
 * @param {string} action
 * @param {Object} b Parsed JSON body.
 * @return {Object} Response standar (createSuccessResponse/createErrorResponse).
 * @private
 */
function routePostAction_(action, b) {
  switch (action) {
    case 'login':
      return apiLogin(b.email, b.password);
    case 'logout':
      return apiLogout(b.sessionToken);
    case 'changePassword':
      return apiChangePassword(b.sessionToken, b.oldPassword, b.newPassword);
    case 'setPassword':
      return apiSetPassword(b.sessionToken, b.userId, b.newPassword);

    case 'createReport':
      return apiCreateReport(b.sessionToken, b.payload);
    case 'updateReport':
      return apiUpdateReport(b.sessionToken, b.reportId, b.updates);
    case 'changeReportStatus':
      return apiChangeReportStatus(b.sessionToken, b.reportId, b.newStatus, b.notes);
    case 'deactivateReport':
      return apiDeactivateReport(b.sessionToken, b.reportId);

    case 'createUser':
      return apiCreateUser(b.sessionToken, b.payload);
    case 'updateUser':
      return apiUpdateUser(b.sessionToken, b.userId, b.updates);
    case 'deactivateUser':
      return apiDeactivateUser(b.sessionToken, b.userId);

    case 'createLocation':
      return apiCreateLocation(b.sessionToken, b.payload);
    case 'updateLocation':
      return apiUpdateLocation(b.sessionToken, b.locationId, b.updates);
    case 'deactivateLocation':
      return apiDeactivateLocation(b.sessionToken, b.locationId);

    case 'createCategory':
      return apiCreateCategory(b.sessionToken, b.payload);
    case 'updateCategory':
      return apiUpdateCategory(b.sessionToken, b.categoryId, b.updates);
    case 'deactivateCategory':
      return apiDeactivateCategory(b.sessionToken, b.categoryId);

    case 'createFacility':
      return apiCreateFacility(b.sessionToken, b.payload);
    case 'updateFacility':
      return apiUpdateFacility(b.sessionToken, b.facilityId, b.updates);
    case 'deactivateFacility':
      return apiDeactivateFacility(b.sessionToken, b.facilityId);

    case 'createOwner':
      return apiCreateOwner(b.sessionToken, b.payload);
    case 'updateOwner':
      return apiUpdateOwner(b.sessionToken, b.ownerId, b.updates);
    case 'deactivateOwner':
      return apiDeactivateOwner(b.sessionToken, b.ownerId);

    default:
      return createErrorResponse('Action POST tidak dikenal: "' + action + '".');
  }
}
