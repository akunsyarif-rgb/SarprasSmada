/**
 * MasterDataSmokeTest.gs
 *
 * Manual smoke test untuk PHASE 3 — Master Data (UserService,
 * LocationService, CategoryService, FacilityService, OwnerService).
 * Dijalankan MANUAL dari editor Apps Script (pilih fungsi
 * runMasterDataSmokeTest pada dropdown fungsi, lalu Run).
 *
 * Aman dijalankan berulang kali:
 * - Tidak melakukan hard delete atau operasi destruktif apa pun.
 * - Seluruh data yang dibuat diberi awalan "TEST_" pada kolom nama
 *   (full_name/location_name/category_name/facility_name/owner_name) agar
 *   mudah dibedakan dari data produksi.
 * - Seluruh entitas yang dibuat dinonaktifkan (soft delete via is_active)
 *   di akhir pengujian sebagai bagian dari skenario (bukan dihapus) —
 *   baris tetap ada di sheet, ditandai TEST_ dan is_active = false.
 * - Setiap eksekusi menghasilkan entitas baru (email/nama disisipi
 *   timestamp) agar tidak bentrok dengan pengecekan duplikasi dari
 *   eksekusi sebelumnya.
 *
 * Test ini TIDAK menguji Report Engine maupun Audit — domain tersebut
 * belum diimplementasikan (lihat docs/DEVELOPMENT_ROADMAP.md).
 *
 * Dependency: seluruh modul core/, apps-script/users/UserService.gs,
 * apps-script/master-data/*.gs
 */

/**
 * Menjalankan seluruh smoke test Master Data secara berurutan dan
 * mencetak ringkasan hasil ke Logger.
 *
 * @return {Array<Object>} Daftar hasil tiap test ({label, passed, detail}).
 */
function runMasterDataSmokeTest() {
  var results = [];
  var ctx = { runId: String(new Date().getTime()) };

  masterDataSmokeTestUserDomain_(results, ctx);
  masterDataSmokeTestLocationDomain_(results, ctx);
  masterDataSmokeTestCategoryFacilityDomain_(results, ctx);
  masterDataSmokeTestOwnerDomain_(results, ctx);

  masterDataSmokeTestPrintSummary_(results);
  return results;
}

/**
 * Menjalankan satu pemeriksaan yang HARUS berhasil (tidak melempar Error).
 * @private
 */
function masterDataSmokeTestCheck_(results, label, fn) {
  try {
    fn();
    results.push({ label: label, passed: true });
    Logger.log('[PASS] ' + label);
  } catch (e) {
    results.push({ label: label, passed: false, detail: e.message });
    Logger.log('[FAIL] ' + label + ' -> ' + e.message);
  }
}

/**
 * Menjalankan satu pemeriksaan yang HARUS melempar Error (validasi/duplikasi
 * ditolak sebagaimana mestinya).
 * @private
 */
function masterDataSmokeTestExpectThrow_(results, label, fn) {
  try {
    fn();
    results.push({ label: label, passed: false, detail: 'Seharusnya melempar Error, tetapi tidak.' });
    Logger.log('[FAIL] ' + label + ' -> seharusnya melempar Error, tetapi tidak.');
  } catch (e) {
    results.push({ label: label, passed: true, detail: e.message });
    Logger.log('[PASS] ' + label + ' -> ditolak dengan benar: ' + e.message);
  }
}

/** @private */
function masterDataSmokeTestAssertEqual_(actual, expected, label) {
  var actualStr = JSON.stringify(actual);
  var expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(label + ': didapat ' + actualStr + ', diharapkan ' + expectedStr);
  }
}

/** @private */
function masterDataSmokeTestPrintSummary_(results) {
  var passCount = results.filter(function (r) { return r.passed; }).length;
  var failCount = results.length - passCount;

  Logger.log('==============================================');
  Logger.log('MASTER DATA SMOKE TEST SUMMARY: ' + passCount + ' PASS, ' + failCount + ' FAIL (total ' + results.length + ')');
  Logger.log('==============================================');

  if (failCount > 0) {
    Logger.log('Terdapat kegagalan pada domain Master Data. Perbaiki sebelum melanjutkan ke PHASE 4 — Report Engine.');
  } else {
    Logger.log('Seluruh smoke test Master Data lolos.');
  }
}

// ---------------------------------------------------------------------
// USER DOMAIN
// ---------------------------------------------------------------------

/** @private */
function masterDataSmokeTestUserDomain_(results, ctx) {
  var email = 'test_' + ctx.runId + '@example.com';

  masterDataSmokeTestCheck_(results, 'User 1. Create — createUser() dengan data valid', function () {
    ctx.user = createUser({ email: email, full_name: 'TEST_User ' + ctx.runId, role: CONFIG.ROLES.GURU });
    masterDataSmokeTestAssertEqual_(ctx.user.user_id.indexOf(CONFIG.ID_PREFIXES.USER + '-'), 0, 'prefix user_id');
    masterDataSmokeTestAssertEqual_(ctx.user.is_active, true, 'is_active default true');
  });

  masterDataSmokeTestExpectThrow_(results, 'User 6. Validation failure — full_name kosong ditolak', function () {
    createUser({ email: 'test_other_' + ctx.runId + '@example.com', role: CONFIG.ROLES.GURU });
  });

  masterDataSmokeTestExpectThrow_(results, 'User 6. Validation failure — role tidak dikenal ditolak', function () {
    createUser({ email: 'test_other2_' + ctx.runId + '@example.com', full_name: 'TEST_X', role: 'SUPERADMIN' });
  });

  masterDataSmokeTestExpectThrow_(results, 'User 7. Duplicate detection — email yang sama ditolak', function () {
    createUser({ email: email, full_name: 'TEST_User Lain', role: CONFIG.ROLES.SISWA });
  });

  masterDataSmokeTestCheck_(results, 'User 2. Get by ID — getUserById() menemukan user yang dibuat', function () {
    var found = getUserById(ctx.user.user_id);
    masterDataSmokeTestAssertEqual_(found.email, email, 'email cocok');
  });

  masterDataSmokeTestCheck_(results, 'User 3. Update — updateUser() memperbarui full_name', function () {
    var updated = updateUser(ctx.user.user_id, { full_name: 'TEST_User ' + ctx.runId + ' Updated' });
    masterDataSmokeTestAssertEqual_(updated.full_name, 'TEST_User ' + ctx.runId + ' Updated', 'full_name terupdate');
  });

  masterDataSmokeTestExpectThrow_(results, 'User — updateUser() menolak perubahan is_active langsung', function () {
    updateUser(ctx.user.user_id, { is_active: false });
  });

  masterDataSmokeTestCheck_(results, 'User 4. List active — listActiveUsers() memuat user yang dibuat', function () {
    var active = listActiveUsers();
    var found = active.some(function (u) { return u.user_id === ctx.user.user_id; });
    masterDataSmokeTestAssertEqual_(found, true, 'user ditemukan di daftar aktif');
  });

  masterDataSmokeTestCheck_(results, 'User 5. Deactivate — deactivateUser() soft delete', function () {
    var deactivated = deactivateUser(ctx.user.user_id);
    masterDataSmokeTestAssertEqual_(deactivated.is_active, false, 'is_active menjadi false');
    var active = listActiveUsers();
    var stillActive = active.some(function (u) { return u.user_id === ctx.user.user_id; });
    masterDataSmokeTestAssertEqual_(stillActive, false, 'tidak lagi muncul di daftar aktif');
  });
}

// ---------------------------------------------------------------------
// LOCATION DOMAIN (hierarchical)
// ---------------------------------------------------------------------

/** @private */
function masterDataSmokeTestLocationDomain_(results, ctx) {
  masterDataSmokeTestCheck_(results, 'Location 1. Create — lokasi induk (top-level)', function () {
    ctx.parentLocation = createLocation({ location_name: 'TEST_Gedung ' + ctx.runId, location_type: 'GEDUNG' });
    masterDataSmokeTestAssertEqual_(ctx.parentLocation.location_path, 'TEST_Gedung ' + ctx.runId, 'path root = nama sendiri');
  });

  masterDataSmokeTestCheck_(results, 'Location 1. Create — lokasi anak dengan parent_id (location_path tersusun)', function () {
    ctx.childLocation = createLocation({
      location_name: 'TEST_Lantai 1',
      location_type: 'LANTAI',
      parent_id: ctx.parentLocation.location_id
    });
    masterDataSmokeTestAssertEqual_(
      ctx.childLocation.location_path,
      'TEST_Gedung ' + ctx.runId + ' > TEST_Lantai 1',
      'path anak menyertakan path induk'
    );
  });

  masterDataSmokeTestCheck_(results, 'Location 1. Create — lokasi cucu (3 level hierarchy)', function () {
    ctx.grandchildLocation = createLocation({
      location_name: 'TEST_Ruang X',
      location_type: 'RUANG',
      parent_id: ctx.childLocation.location_id
    });
    masterDataSmokeTestAssertEqual_(
      ctx.grandchildLocation.location_path,
      'TEST_Gedung ' + ctx.runId + ' > TEST_Lantai 1 > TEST_Ruang X',
      'path cucu menyertakan seluruh rantai leluhur'
    );
  });

  masterDataSmokeTestExpectThrow_(results, 'Location 8. Parent-child validation — parent_id yang tidak ada ditolak', function () {
    createLocation({ location_name: 'TEST_Orphan', location_type: 'RUANG', parent_id: 'LOC-999999' });
  });

  masterDataSmokeTestExpectThrow_(results, 'Location 8. Parent-child validation — parent_id ke diri sendiri ditolak', function () {
    updateLocation(ctx.parentLocation.location_id, { parent_id: ctx.parentLocation.location_id });
  });

  masterDataSmokeTestExpectThrow_(results, 'Location 8. Parent-child validation — circular hierarchy (induk dijadikan anak dari cucunya) ditolak', function () {
    updateLocation(ctx.parentLocation.location_id, { parent_id: ctx.grandchildLocation.location_id });
  });

  masterDataSmokeTestCheck_(results, 'Location 2. Get by ID — getLocationById() menemukan lokasi', function () {
    var found = getLocationById(ctx.childLocation.location_id);
    masterDataSmokeTestAssertEqual_(found.location_id, ctx.childLocation.location_id, 'location_id cocok');
  });

  masterDataSmokeTestCheck_(results, 'Location 3. Update — rename induk merambat ke location_path keturunannya', function () {
    updateLocation(ctx.parentLocation.location_id, { location_name: 'TEST_Gedung ' + ctx.runId + ' Renamed' });
    var refreshedChild = getLocationById(ctx.childLocation.location_id);
    var refreshedGrandchild = getLocationById(ctx.grandchildLocation.location_id);
    masterDataSmokeTestAssertEqual_(
      refreshedChild.location_path,
      'TEST_Gedung ' + ctx.runId + ' Renamed > TEST_Lantai 1',
      'path anak ikut terbarui'
    );
    masterDataSmokeTestAssertEqual_(
      refreshedGrandchild.location_path,
      'TEST_Gedung ' + ctx.runId + ' Renamed > TEST_Lantai 1 > TEST_Ruang X',
      'path cucu ikut terbarui'
    );
  });

  masterDataSmokeTestCheck_(results, 'Location 4. List active — listActiveLocations() memuat lokasi yang dibuat', function () {
    var active = listActiveLocations();
    var found = active.some(function (l) { return l.location_id === ctx.grandchildLocation.location_id; });
    masterDataSmokeTestAssertEqual_(found, true, 'lokasi cucu ditemukan di daftar aktif');
  });

  masterDataSmokeTestCheck_(results, 'Location 5. Deactivate — deactivateLocation() soft delete berjenjang manual', function () {
    deactivateLocation(ctx.grandchildLocation.location_id);
    deactivateLocation(ctx.childLocation.location_id);
    var deactivatedParent = deactivateLocation(ctx.parentLocation.location_id);
    masterDataSmokeTestAssertEqual_(deactivatedParent.is_active, false, 'lokasi induk nonaktif');
  });
}

// ---------------------------------------------------------------------
// CATEGORY + FACILITY DOMAIN
// ---------------------------------------------------------------------

/** @private */
function masterDataSmokeTestCategoryFacilityDomain_(results, ctx) {
  masterDataSmokeTestCheck_(results, 'Category 1. Create — createCategory() dengan nama valid', function () {
    ctx.categoryA = createCategory({ category_name: 'TEST_Listrik ' + ctx.runId });
  });

  masterDataSmokeTestExpectThrow_(results, 'Category 6. Validation failure — category_name kosong ditolak', function () {
    createCategory({ category_name: '' });
  });

  masterDataSmokeTestExpectThrow_(results, 'Category 7. Duplicate detection — nama sama (case-insensitive) pada kategori aktif ditolak', function () {
    createCategory({ category_name: 'test_listrik ' + ctx.runId });
  });

  masterDataSmokeTestCheck_(results, 'Category — kategori kedua untuk skenario deactivate independen', function () {
    ctx.categoryB = createCategory({ category_name: 'TEST_Kebersihan ' + ctx.runId });
  });

  masterDataSmokeTestCheck_(results, 'Category 2. Get by ID — getCategoryById() menemukan kategori', function () {
    var found = getCategoryById(ctx.categoryA.category_id);
    masterDataSmokeTestAssertEqual_(found.category_id, ctx.categoryA.category_id, 'category_id cocok');
  });

  masterDataSmokeTestCheck_(results, 'Category 4. List active — listActiveCategories() memuat kategori yang dibuat', function () {
    var active = listActiveCategories();
    var found = active.some(function (c) { return c.category_id === ctx.categoryA.category_id; });
    masterDataSmokeTestAssertEqual_(found, true, 'kategori ditemukan di daftar aktif');
  });

  masterDataSmokeTestCheck_(results, 'Facility 1. Create — createFacility() terhadap kategori valid dan aktif', function () {
    ctx.facilityA = createFacility({ category_id: ctx.categoryA.category_id, facility_name: 'TEST_AC Ruang Guru ' + ctx.runId });
    masterDataSmokeTestAssertEqual_(ctx.facilityA.category_id, ctx.categoryA.category_id, 'category_id tersimpan benar');
  });

  masterDataSmokeTestExpectThrow_(results, 'Facility 9. Facility-category validation — category_id tidak dikenal ditolak', function () {
    createFacility({ category_id: 'CAT-999999', facility_name: 'TEST_X' });
  });

  masterDataSmokeTestCheck_(results, 'Category 5. Deactivate — kategori TANPA facility aktif berhasil dinonaktifkan', function () {
    var deactivated = deactivateCategory(ctx.categoryB.category_id);
    masterDataSmokeTestAssertEqual_(deactivated.is_active, false, 'kategori B nonaktif');
  });

  masterDataSmokeTestExpectThrow_(results, 'Facility 9. Facility-category validation — category_id yang sudah nonaktif ditolak', function () {
    createFacility({ category_id: ctx.categoryB.category_id, facility_name: 'TEST_Y' });
  });

  masterDataSmokeTestCheck_(results, 'Facility 3. Update — updateFacility() memperbarui facility_name', function () {
    var updated = updateFacility(ctx.facilityA.facility_id, { facility_name: 'TEST_AC Ruang Guru ' + ctx.runId + ' Updated' });
    masterDataSmokeTestAssertEqual_(updated.facility_name, 'TEST_AC Ruang Guru ' + ctx.runId + ' Updated', 'facility_name terupdate');
  });

  masterDataSmokeTestCheck_(results, 'Facility 4. List active — listActiveFacilities() memuat facility yang dibuat', function () {
    var active = listActiveFacilities();
    var found = active.some(function (f) { return f.facility_id === ctx.facilityA.facility_id; });
    masterDataSmokeTestAssertEqual_(found, true, 'facility ditemukan di daftar aktif');
  });

  masterDataSmokeTestExpectThrow_(results, 'Category 9. Deactivate ditolak — kategori A masih memiliki facility aktif', function () {
    deactivateCategory(ctx.categoryA.category_id);
  });

  masterDataSmokeTestCheck_(results, 'Facility 5. Deactivate lalu Category 5. Deactivate — berhasil setelah facility dinonaktifkan', function () {
    deactivateFacility(ctx.facilityA.facility_id);
    var deactivatedCategory = deactivateCategory(ctx.categoryA.category_id);
    masterDataSmokeTestAssertEqual_(deactivatedCategory.is_active, false, 'kategori A nonaktif setelah facility dinonaktifkan');
  });
}

// ---------------------------------------------------------------------
// OWNER DOMAIN
// ---------------------------------------------------------------------

/** @private */
function masterDataSmokeTestOwnerDomain_(results, ctx) {
  masterDataSmokeTestCheck_(results, 'Owner 1. Create — createOwner() dengan nama valid', function () {
    ctx.owner = createOwner({ owner_name: 'TEST_Tim Sarpras ' + ctx.runId });
  });

  masterDataSmokeTestExpectThrow_(results, 'Owner 6. Validation failure — owner_name kosong ditolak', function () {
    createOwner({ owner_name: '' });
  });

  masterDataSmokeTestExpectThrow_(results, 'Owner 7. Duplicate detection — nama sama pada owner aktif ditolak', function () {
    createOwner({ owner_name: 'TEST_Tim Sarpras ' + ctx.runId });
  });

  masterDataSmokeTestCheck_(results, 'Owner 2. Get by ID — getOwnerById() menemukan owner', function () {
    var found = getOwnerById(ctx.owner.owner_id);
    masterDataSmokeTestAssertEqual_(found.owner_id, ctx.owner.owner_id, 'owner_id cocok');
  });

  masterDataSmokeTestCheck_(results, 'Owner 3. Update — updateOwner() memperbarui description', function () {
    var updated = updateOwner(ctx.owner.owner_id, { description: 'TEST_deskripsi diperbarui' });
    masterDataSmokeTestAssertEqual_(updated.description, 'TEST_deskripsi diperbarui', 'description terupdate');
  });

  masterDataSmokeTestCheck_(results, 'Owner 4. List active — listActiveOwners() memuat owner yang dibuat', function () {
    var active = listActiveOwners();
    var found = active.some(function (o) { return o.owner_id === ctx.owner.owner_id; });
    masterDataSmokeTestAssertEqual_(found, true, 'owner ditemukan di daftar aktif');
  });

  masterDataSmokeTestCheck_(results, 'Owner 5. Deactivate — deactivateOwner() soft delete', function () {
    var deactivated = deactivateOwner(ctx.owner.owner_id);
    masterDataSmokeTestAssertEqual_(deactivated.is_active, false, 'owner nonaktif');
  });
}
