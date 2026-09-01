/**
 * MasterDataApi.gs
 *
 * Fungsi PUBLIK lapisan API untuk data master (lokasi, kategori, fasilitas,
 * owner), dipanggil dari apps-script/api/App.gs. Tidak ada logika bisnis di
 * sini — hanya identifikasi/otorisasi pemanggil lewat AuthContext.gs +
 * pass-through ke Service Layer Master Data yang sudah ada
 * (apps-script/master-data/) + pembungkusan response lewat ApiUtil.gs.
 *
 * BACA (list*) — boleh dipanggil siapa pun yang sedang login (dibutuhkan
 * untuk mengisi dropdown form laporan oleh SEMUA peran, termasuk SISWA/GURU/
 * STAF sebagai pelapor).
 * TULIS (create.../update.../deactivate...) — HANYA ADMIN. Data master
 * mempengaruhi seluruh sistem (setiap laporan baru merujuknya), sehingga
 * tidak dibuka ke peran lain pada tahap ini.
 *
 * Dependency:
 * - core/Config.gs (CONFIG.ROLES)
 * - apps-script/api/AuthContext.gs (requireSession_, requireRole_)
 * - apps-script/api/ApiUtil.gs (apiRun_)
 * - apps-script/master-data/LocationService.gs
 * - apps-script/master-data/CategoryService.gs
 * - apps-script/master-data/FacilityService.gs
 * - apps-script/master-data/OwnerService.gs
 */

/** @private */
function masterDataRequireAdmin_(token) {
  var user = requireSession_(token);
  requireRole_(user, [CONFIG.ROLES.ADMIN]);
  return user;
}

// ---- Locations ----------------------------------------------------------

function apiListLocations(token) {
  return apiRun_(function () {
    requireSession_(token);
    return listActiveLocations();
  });
}

function apiCreateLocation(token, payload) {
  return apiRun_(function () {
    masterDataRequireAdmin_(token);
    return createLocation(payload || {});
  });
}

function apiUpdateLocation(token, locationId, updates) {
  return apiRun_(function () {
    masterDataRequireAdmin_(token);
    return updateLocation(locationId, updates || {});
  });
}

function apiDeactivateLocation(token, locationId) {
  return apiRun_(function () {
    masterDataRequireAdmin_(token);
    return deactivateLocation(locationId);
  });
}

// ---- Categories -----------------------------------------------------------

function apiListCategories(token) {
  return apiRun_(function () {
    requireSession_(token);
    return listActiveCategories();
  });
}

function apiCreateCategory(token, payload) {
  return apiRun_(function () {
    masterDataRequireAdmin_(token);
    return createCategory(payload || {});
  });
}

function apiUpdateCategory(token, categoryId, updates) {
  return apiRun_(function () {
    masterDataRequireAdmin_(token);
    return updateCategory(categoryId, updates || {});
  });
}

function apiDeactivateCategory(token, categoryId) {
  return apiRun_(function () {
    masterDataRequireAdmin_(token);
    return deactivateCategory(categoryId);
  });
}

// ---- Facilities -----------------------------------------------------------

function apiListFacilities(token) {
  return apiRun_(function () {
    requireSession_(token);
    return listActiveFacilities();
  });
}

function apiCreateFacility(token, payload) {
  return apiRun_(function () {
    masterDataRequireAdmin_(token);
    return createFacility(payload || {});
  });
}

function apiUpdateFacility(token, facilityId, updates) {
  return apiRun_(function () {
    masterDataRequireAdmin_(token);
    return updateFacility(facilityId, updates || {});
  });
}

function apiDeactivateFacility(token, facilityId) {
  return apiRun_(function () {
    masterDataRequireAdmin_(token);
    return deactivateFacility(facilityId);
  });
}

// ---- Owners -----------------------------------------------------------

function apiListOwners(token) {
  return apiRun_(function () {
    requireSession_(token);
    return listActiveOwners();
  });
}

function apiCreateOwner(token, payload) {
  return apiRun_(function () {
    masterDataRequireAdmin_(token);
    return createOwner(payload || {});
  });
}

function apiUpdateOwner(token, ownerId, updates) {
  return apiRun_(function () {
    masterDataRequireAdmin_(token);
    return updateOwner(ownerId, updates || {});
  });
}

function apiDeactivateOwner(token, ownerId) {
  return apiRun_(function () {
    masterDataRequireAdmin_(token);
    return deactivateOwner(ownerId);
  });
}
