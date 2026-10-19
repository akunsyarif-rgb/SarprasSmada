/**
 * api.js
 *
 * Satu-satunya lapisan yang berbicara ke backend Appwrite
 * (docs/APPWRITE_SCHEMA.md). Setiap fungsi mengembalikan Promise yang
 * resolve ke data, atau reject dengan Error berpesan Indonesia.
 *
 * - BACA data: langsung dari tabel Appwrite; izin tabel/baris di server yang
 *   membatasi apa yang terlihat (pelapor hanya melihat laporannya sendiri).
 * - TULIS laporan & kelola pengguna: lewat Function `sarpras-api`
 *   (validasi role, workflow, nomor laporan, riwayat & audit di server).
 * - Master data: ditulis langsung oleh ADMIN (izin tabel `label:sarprasadmin`).
 *
 * Baris Appwrite dinormalisasi ke bentuk lama (report_id, location_id, ...
 * = $id; created_at/updated_at = $createdAt/$updatedAt) agar komponen UI
 * tidak perlu berubah.
 */

var Api = (function () {
  var A = CONFIG.APPWRITE;
  var client = new Appwrite.Client().setEndpoint(A.ENDPOINT).setProject(A.PROJECT_ID);
  var account = new Appwrite.Account(client);
  var tablesDB = new Appwrite.TablesDB(client);
  var functions = new Appwrite.Functions(client);
  var Query = Appwrite.Query;
  var ID = Appwrite.ID;

  function friendlyError(e) {
    var code = e && e.code;
    var msg = (e && e.message) || 'Terjadi kesalahan.';
    if (e instanceof Error && e.isApiError) { return e; }
    if (e && e.type === 'user_invalid_credentials') { msg = 'Email atau password salah.'; }
    else if (code === 401) { msg = 'Sesi berakhir atau tidak valid. Silakan login kembali.'; }
    else if (code === 403) { msg = 'Anda tidak berhak melakukan aksi ini.'; }
    else if (code === 404) { msg = 'Data tidak ditemukan.'; }
    else if (code === 409) { msg = 'Data dengan nama/email tersebut sudah ada.'; }
    else if (code === 429) { msg = 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.'; }
    var err = new Error(msg);
    err.code = code;
    err.isApiError = true;
    return err;
  }

  function wrap(promise) {
    return promise.catch(function (e) { throw friendlyError(e); });
  }

  /** Menyalin $id/$createdAt ke nama kolom lama. */
  function norm(row, idField) {
    if (!row) { return row; }
    var out = Object.assign({}, row);
    out[idField] = row.$id;
    out.created_at = row.$createdAt;
    out.updated_at = row.$updatedAt;
    return out;
  }

  function normList(res, idField) {
    return res.rows.map(function (r) { return norm(r, idField); });
  }

  function list(tableId, idField, extraQueries) {
    var queries = [Query.limit(CONFIG.LIST_LIMIT)].concat(extraQueries || []);
    return wrap(tablesDB.listRows({ databaseId: A.DATABASE_ID, tableId: tableId, queries: queries }))
      .then(function (res) { return normList(res, idField); });
  }

  function createRow(tableId, idField, data) {
    return wrap(tablesDB.createRow({ databaseId: A.DATABASE_ID, tableId: tableId, rowId: ID.unique(), data: data }))
      .then(function (row) { return norm(row, idField); });
  }

  function updateRow(tableId, idField, rowId, data) {
    return wrap(tablesDB.updateRow({ databaseId: A.DATABASE_ID, tableId: tableId, rowId: rowId, data: data }))
      .then(function (row) { return norm(row, idField); });
  }

  /** Memanggil Function `sarpras-api`; mengembalikan data atau melempar Error. */
  function call(action, body) {
    var payload = Object.assign({ action: action }, body || {});
    return wrap(functions.createExecution({
      functionId: A.FUNCTION_ID,
      body: JSON.stringify(payload),
      async: false,
      xpath: '/',
      method: 'POST',
      headers: { 'content-type': 'application/json' }
    })).then(function (exec) {
      var parsed;
      try { parsed = JSON.parse(exec.responseBody); } catch (e) { parsed = null; }
      if (!parsed) {
        throw friendlyError(new Error('Server tidak memberi jawaban yang valid (status ' + exec.status + ').'));
      }
      if (!parsed.success) {
        var err = new Error((parsed.error && parsed.error.message) || 'Terjadi kesalahan.');
        err.isApiError = true;
        throw err;
      }
      return parsed.data;
    });
  }

  function userFromAccount(acc) {
    var role = null;
    (acc.labels || []).forEach(function (label) {
      if (CONFIG.LABEL_TO_ROLE[label]) { role = role || CONFIG.LABEL_TO_ROLE[label]; }
    });
    return { user_id: acc.$id, full_name: acc.name, email: acc.email, role: role };
  }

  function getCurrentUser() {
    return wrap(account.get()).then(function (acc) {
      var user = userFromAccount(acc);
      if (!user.role) {
        return account.deleteSession({ sessionId: 'current' }).catch(function () {}).then(function () {
          throw friendlyError(new Error('Akun ini tidak memiliki akses ke SIGAP SARPRAS.'));
        });
      }
      return { user: user };
    });
  }

  function listActive(tableId, idField) {
    return list(tableId, idField, [Query.equal('is_active', [true]), Query.orderAsc('$createdAt')]);
  }

  function deactivate(tableId, idField, id) {
    return updateRow(tableId, idField, id, { is_active: false });
  }

  var T = A.TABLES;

  return {
    // Auth
    /** Memulihkan sesi dari cookie/localStorage SDK; resolve null bila belum login. */
    restoreSession: function () { return getCurrentUser().catch(function () { return null; }); },
    login: function (email, password) {
      return account.deleteSession({ sessionId: 'current' }).catch(function () {})
        .then(function () { return wrap(account.createEmailPasswordSession({ email: email, password: password })); })
        .then(getCurrentUser)
        .then(function (session) {
          // Membuat baris profil bila belum ada (mis. admin pertama); gagal tidak menghalangi login.
          return call('syncMyProfile').catch(function () {}).then(function () { return session; });
        });
    },
    logout: function () { return wrap(account.deleteSession({ sessionId: 'current' })); },
    changePassword: function (oldPassword, newPassword) {
      return wrap(account.updatePassword({ password: newPassword, oldPassword: oldPassword }));
    },
    setPassword: function (userId, newPassword) { return call('setPassword', { user_id: userId, new_password: newPassword }); },

    // Reports
    listReports: function (status) {
      var q = [Query.equal('is_active', [true]), Query.orderDesc('$createdAt')];
      if (status) { q.push(Query.equal('status', [status])); }
      return list(T.REPORTS, 'report_id', q);
    },
    listReportHistory: function (reportId) {
      return list(T.HISTORY, 'history_id', [Query.equal('report_id', [reportId]), Query.orderAsc('$createdAt')]);
    },
    createReport: function (payload) {
      return call('createReport', payload).then(function (r) { return norm(r, 'report_id'); });
    },
    updateReport: function (reportId, updates) {
      return call('updateReport', { report_id: reportId, updates: updates }).then(function (r) { return norm(r, 'report_id'); });
    },
    changeReportStatus: function (reportId, newStatus, notes) {
      return call('changeReportStatus', { report_id: reportId, new_status: newStatus, notes: notes }).then(function (r) { return norm(r, 'report_id'); });
    },
    deactivateReport: function (reportId) {
      return call('deactivateReport', { report_id: reportId }).then(function (r) { return norm(r, 'report_id'); });
    },

    // Master data
    listLocations: function () { return listActive(T.LOCATIONS, 'location_id'); },
    createLocation: function (payload) {
      var parent = payload.parent_id
        ? wrap(tablesDB.getRow({ databaseId: A.DATABASE_ID, tableId: T.LOCATIONS, rowId: payload.parent_id }))
        : Promise.resolve(null);
      return parent.then(function (p) {
        var path = p ? p.location_path + ' > ' + payload.location_name : payload.location_name;
        return createRow(T.LOCATIONS, 'location_id', {
          parent_id: payload.parent_id || '',
          location_name: payload.location_name,
          location_type: payload.location_type,
          location_path: path,
          is_active: true
        });
      });
    },
    deactivateLocation: function (id) { return deactivate(T.LOCATIONS, 'location_id', id); },

    listCategories: function () { return listActive(T.CATEGORIES, 'category_id'); },
    createCategory: function (payload) {
      return createRow(T.CATEGORIES, 'category_id', { category_name: payload.category_name, description: payload.description || '', is_active: true });
    },
    deactivateCategory: function (id) { return deactivate(T.CATEGORIES, 'category_id', id); },

    listFacilities: function () { return listActive(T.FACILITIES, 'facility_id'); },
    createFacility: function (payload) {
      return createRow(T.FACILITIES, 'facility_id', { category_id: payload.category_id, facility_name: payload.facility_name, is_active: true });
    },
    deactivateFacility: function (id) { return deactivate(T.FACILITIES, 'facility_id', id); },

    listOwners: function () { return listActive(T.OWNERS, 'owner_id'); },
    createOwner: function (payload) {
      return createRow(T.OWNERS, 'owner_id', { owner_name: payload.owner_name, description: payload.description || '', is_active: true });
    },
    deactivateOwner: function (id) { return deactivate(T.OWNERS, 'owner_id', id); },

    // Users (admin)
    listUsers: function () { return listActive(T.USERS, 'user_id'); },
    createUser: function (payload) { return call('createUser', payload).then(function (r) { return norm(r, 'user_id'); }); },
    deactivateUser: function (id) { return call('deactivateUser', { user_id: id }); }
  };
})();
