/**
 * api.js
 *
 * Satu-satunya lapisan yang berbicara ke backend Google Apps Script
 * (apps-script/api/App.gs). Setiap fungsi mengembalikan Promise yang
 * resolve ke `data` (bila success) atau reject dengan Error berisi pesan
 * dari server (bila gagal) — komponen React tidak perlu tahu bentuk
 * response mentah {success, data, error}.
 *
 * CATATAN CORS (lihat apps-script/api/App.gs untuk penjelasan lengkap):
 * request POST WAJIB dikirim dengan Content-Type "text/plain;charset=utf-8"
 * (BUKAN "application/json") agar browser tidak mengirim preflight OPTIONS
 * — Apps Script Web App tidak bisa menjawab preflight. Body-nya sendiri
 * TETAP JSON biasa; hanya header Content-Type yang disamarkan.
 */

var Api = (function () {
  function buildQuery(params) {
    return Object.keys(params)
      .filter(function (k) { return params[k] !== undefined && params[k] !== null; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
      .join('&');
  }

  function unwrap(response) {
    if (!response || typeof response.success === 'undefined') {
      throw new Error('Response server tidak valid.');
    }
    if (!response.success) {
      throw new Error((response.error && response.error.message) || 'Terjadi kesalahan.');
    }
    return response.data;
  }

  /**
   * Action GET (baca).
   * @param {string} action
   * @param {Object} [params] Parameter tambahan (mis. sessionToken, status, reportId).
   * @return {Promise<*>}
   */
  function get(action, params) {
    var query = buildQuery(Object.assign({ token: CONFIG.API_TOKEN, action: action }, params || {}));
    return fetch(CONFIG.API_URL + '?' + query, { method: 'GET' })
      .then(function (res) { return res.json(); })
      .then(unwrap);
  }

  /**
   * Action POST (tulis).
   * @param {string} action
   * @param {Object} [body] Field tambahan (mis. sessionToken, payload, updates).
   * @return {Promise<*>}
   */
  function post(action, body) {
    var payload = Object.assign({ token: CONFIG.API_TOKEN, action: action }, body || {});
    return fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(unwrap);
  }

  return {
    // Auth
    login: function (email, password) { return post('login', { email: email, password: password }); },
    logout: function (sessionToken) { return post('logout', { sessionToken: sessionToken }); },
    getCurrentUser: function (sessionToken) { return get('getCurrentUser', { sessionToken: sessionToken }); },
    changePassword: function (sessionToken, oldPassword, newPassword) {
      return post('changePassword', { sessionToken: sessionToken, oldPassword: oldPassword, newPassword: newPassword });
    },
    setPassword: function (sessionToken, userId, newPassword) {
      return post('setPassword', { sessionToken: sessionToken, userId: userId, newPassword: newPassword });
    },

    // Reports
    listReports: function (sessionToken, status) { return get('listReports', { sessionToken: sessionToken, status: status }); },
    getReport: function (sessionToken, reportId) { return get('getReport', { sessionToken: sessionToken, reportId: reportId }); },
    listReportHistory: function (sessionToken, reportId) { return get('listReportHistory', { sessionToken: sessionToken, reportId: reportId }); },
    createReport: function (sessionToken, payload) { return post('createReport', { sessionToken: sessionToken, payload: payload }); },
    updateReport: function (sessionToken, reportId, updates) { return post('updateReport', { sessionToken: sessionToken, reportId: reportId, updates: updates }); },
    changeReportStatus: function (sessionToken, reportId, newStatus, notes) {
      return post('changeReportStatus', { sessionToken: sessionToken, reportId: reportId, newStatus: newStatus, notes: notes });
    },
    deactivateReport: function (sessionToken, reportId) { return post('deactivateReport', { sessionToken: sessionToken, reportId: reportId }); },

    // Master data
    listLocations: function (sessionToken) { return get('listLocations', { sessionToken: sessionToken }); },
    createLocation: function (sessionToken, payload) { return post('createLocation', { sessionToken: sessionToken, payload: payload }); },
    updateLocation: function (sessionToken, locationId, updates) { return post('updateLocation', { sessionToken: sessionToken, locationId: locationId, updates: updates }); },
    deactivateLocation: function (sessionToken, locationId) { return post('deactivateLocation', { sessionToken: sessionToken, locationId: locationId }); },

    listCategories: function (sessionToken) { return get('listCategories', { sessionToken: sessionToken }); },
    createCategory: function (sessionToken, payload) { return post('createCategory', { sessionToken: sessionToken, payload: payload }); },
    updateCategory: function (sessionToken, categoryId, updates) { return post('updateCategory', { sessionToken: sessionToken, categoryId: categoryId, updates: updates }); },
    deactivateCategory: function (sessionToken, categoryId) { return post('deactivateCategory', { sessionToken: sessionToken, categoryId: categoryId }); },

    listFacilities: function (sessionToken) { return get('listFacilities', { sessionToken: sessionToken }); },
    createFacility: function (sessionToken, payload) { return post('createFacility', { sessionToken: sessionToken, payload: payload }); },
    updateFacility: function (sessionToken, facilityId, updates) { return post('updateFacility', { sessionToken: sessionToken, facilityId: facilityId, updates: updates }); },
    deactivateFacility: function (sessionToken, facilityId) { return post('deactivateFacility', { sessionToken: sessionToken, facilityId: facilityId }); },

    listOwners: function (sessionToken) { return get('listOwners', { sessionToken: sessionToken }); },
    createOwner: function (sessionToken, payload) { return post('createOwner', { sessionToken: sessionToken, payload: payload }); },
    updateOwner: function (sessionToken, ownerId, updates) { return post('updateOwner', { sessionToken: sessionToken, ownerId: ownerId, updates: updates }); },
    deactivateOwner: function (sessionToken, ownerId) { return post('deactivateOwner', { sessionToken: sessionToken, ownerId: ownerId }); },

    // Users (admin)
    listUsers: function (sessionToken) { return get('listUsers', { sessionToken: sessionToken }); },
    createUser: function (sessionToken, payload) { return post('createUser', { sessionToken: sessionToken, payload: payload }); },
    updateUser: function (sessionToken, userId, updates) { return post('updateUser', { sessionToken: sessionToken, userId: userId, updates: updates }); },
    deactivateUser: function (sessionToken, userId) { return post('deactivateUser', { sessionToken: sessionToken, userId: userId }); }
  };
})();
