/**
 * LocationService.gs
 *
 * Domain service untuk data lokasi hierarkis (sheet 02_locations), mis.
 * Sekolah → Gedung A → Lantai 1 → Ruang Kelas X.
 *
 * Pola implementasi (lihat docs/ARCHITECTURE.md):
 *   VALIDATION → BUSINESS LOGIC → DATABASE SERVICE → GOOGLE SPREADSHEET
 *
 * Domain ini TIDAK memanggil SpreadsheetApp secara langsung — seluruh
 * akses data melalui core/DatabaseService.gs (lihat docs/ARCHITECTURE.md
 * bagian 4, Aturan Akses Database).
 *
 * Soft delete: penonaktifan lokasi menggunakan kolom is_active, TIDAK
 * PERNAH menghapus baris (hard delete). Dekativasi TIDAK melakukan cascade
 * ke lokasi anak pada fase ini (lihat catatan technical debt pada laporan
 * PHASE 3).
 *
 * Kesiapan Audit: createLocation/updateLocation/deactivateLocation
 * mengembalikan objek baris lengkap (state akhir) agar mudah diteruskan
 * ke Audit Service pada tahap berikutnya (belum diimplementasikan).
 *
 * Dependency:
 * - core/Config.gs (CONFIG.SHEETS.LOCATIONS, CONFIG.SEQUENCES.LOCATION,
 *   CONFIG.ID_PREFIXES.LOCATION)
 * - core/DatabaseService.gs (getRowById, findRows, insertRow, updateRowById)
 * - core/SequenceService.gs (generateEntityId)
 * - core/UtilityService.gs (isEmpty, nowTimestamp)
 *
 * Referensi: docs/DATABASE_SCHEMA.md (02_locations)
 */

/** Batas kedalaman penelusuran hierarki, mencegah infinite loop jika data korup. @private */
var LOCATION_MAX_HIERARCHY_DEPTH_ = 100;
/** Pemisah antar level pada location_path. @private */
var LOCATION_PATH_SEPARATOR_ = ' > ';

/**
 * Membuat lokasi baru.
 *
 * Validasi:
 * - location_name wajib diisi.
 * - location_type wajib diisi.
 * - parent_id, jika diisi, harus merujuk lokasi yang benar-benar ada.
 *
 * @param {Object} locationData Data lokasi baru.
 * @param {string} locationData.location_name Nama lokasi, wajib.
 * @param {string} locationData.location_type Jenis/tingkatan lokasi, wajib.
 * @param {string} [locationData.parent_id] ID lokasi induk (opsional).
 * @return {Object} Baris lokasi yang berhasil dibuat.
 * @throws {Error} Jika validasi gagal.
 */
function createLocation(locationData) {
  if (!locationData || typeof locationData !== 'object') {
    throw new Error('LocationService.createLocation: "locationData" wajib diisi dan bertipe object.');
  }
  if (isEmpty(locationData.location_name)) {
    throw new Error('LocationService.createLocation: "location_name" wajib diisi.');
  }
  if (isEmpty(locationData.location_type)) {
    throw new Error('LocationService.createLocation: "location_type" wajib diisi.');
  }

  var parentId = locationData.parent_id || '';
  var parentLocation = null;

  if (!isEmpty(parentId)) {
    parentLocation = getRowById(CONFIG.SHEETS.LOCATIONS, 'location_id', parentId);
    if (!parentLocation) {
      throw new Error('LocationService.createLocation: "parent_id" tidak ditemukan: "' + parentId + '".');
    }
  }

  var locationName = locationData.location_name.trim();
  var locationPath = parentLocation
    ? parentLocation.location_path + LOCATION_PATH_SEPARATOR_ + locationName
    : locationName;

  var timestamp = nowTimestamp();
  var newLocation = {
    location_id: generateEntityId(CONFIG.ID_PREFIXES.LOCATION, CONFIG.SEQUENCES.LOCATION),
    parent_id: parentId,
    location_name: locationName,
    location_type: locationData.location_type.trim(),
    location_path: locationPath,
    is_active: true,
    created_at: timestamp,
    updated_at: timestamp
  };

  return insertRow(CONFIG.SHEETS.LOCATIONS, newLocation);
}

/**
 * Mengambil satu lokasi berdasarkan location_id.
 *
 * @param {string} locationId ID lokasi.
 * @return {Object|null} Baris lokasi, atau null jika tidak ditemukan.
 * @throws {Error} Jika locationId kosong.
 */
function getLocationById(locationId) {
  if (isEmpty(locationId)) {
    throw new Error('LocationService.getLocationById: "locationId" wajib diisi.');
  }
  return getRowById(CONFIG.SHEETS.LOCATIONS, 'location_id', locationId);
}

/**
 * Mengambil seluruh lokasi yang berstatus aktif.
 *
 * @return {Array<Object>} Daftar lokasi aktif.
 */
function listActiveLocations() {
  return findRows(CONFIG.SHEETS.LOCATIONS, function (row) {
    return row.is_active === true;
  });
}

/**
 * Memperbarui data lokasi. is_active TIDAK dapat diubah lewat fungsi ini —
 * gunakan deactivateLocation() untuk menonaktifkan lokasi.
 *
 * Jika location_name atau parent_id berubah, location_path dihitung ulang
 * (termasuk untuk seluruh keturunan lokasi ini, agar location_path tetap
 * konsisten).
 *
 * @param {string} locationId ID lokasi yang diperbarui.
 * @param {Object} updates Kolom yang ingin diperbarui.
 * @return {Object} Baris lokasi setelah diperbarui.
 * @throws {Error} Jika validasi gagal, lokasi tidak ditemukan, parent_id
 *   tidak valid, atau perubahan menyebabkan circular hierarchy.
 */
function updateLocation(locationId, updates) {
  if (isEmpty(locationId)) {
    throw new Error('LocationService.updateLocation: "locationId" wajib diisi.');
  }
  if (!updates || typeof updates !== 'object') {
    throw new Error('LocationService.updateLocation: "updates" wajib diisi dan bertipe object.');
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'is_active')) {
    throw new Error('LocationService.updateLocation: "is_active" tidak dapat diubah lewat updateLocation(). Gunakan deactivateLocation().');
  }

  var existingLocation = getRowById(CONFIG.SHEETS.LOCATIONS, 'location_id', locationId);
  if (!existingLocation) {
    throw new Error('LocationService.updateLocation: Lokasi tidak ditemukan: "' + locationId + '".');
  }

  var patch = {};
  var nameChanged = false;
  var parentChanged = false;

  if (Object.prototype.hasOwnProperty.call(updates, 'location_name')) {
    if (isEmpty(updates.location_name)) {
      throw new Error('LocationService.updateLocation: "location_name" tidak boleh dikosongkan.');
    }
    patch.location_name = updates.location_name.trim();
    nameChanged = true;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'location_type')) {
    if (isEmpty(updates.location_type)) {
      throw new Error('LocationService.updateLocation: "location_type" tidak boleh dikosongkan.');
    }
    patch.location_type = updates.location_type.trim();
  }

  var newParentId = existingLocation.parent_id;
  if (Object.prototype.hasOwnProperty.call(updates, 'parent_id')) {
    newParentId = updates.parent_id || '';

    if (!isEmpty(newParentId)) {
      if (newParentId === locationId) {
        throw new Error('LocationService.updateLocation: "parent_id" tidak boleh merujuk lokasi itu sendiri (circular hierarchy).');
      }
      var newParentLocation = getRowById(CONFIG.SHEETS.LOCATIONS, 'location_id', newParentId);
      if (!newParentLocation) {
        throw new Error('LocationService.updateLocation: "parent_id" tidak ditemukan: "' + newParentId + '".');
      }
      if (locationIsDescendantOf_(newParentId, locationId)) {
        throw new Error(
          'LocationService.updateLocation: perubahan "parent_id" ke "' + newParentId +
          '" akan membentuk circular hierarchy (lokasi tersebut adalah keturunan dari "' + locationId + '").'
        );
      }
    }

    patch.parent_id = newParentId;
    parentChanged = true;
  }

  if (nameChanged || parentChanged) {
    var effectiveName = nameChanged ? patch.location_name : existingLocation.location_name;
    var parentLocation = isEmpty(newParentId) ? null : getRowById(CONFIG.SHEETS.LOCATIONS, 'location_id', newParentId);
    patch.location_path = parentLocation
      ? parentLocation.location_path + LOCATION_PATH_SEPARATOR_ + effectiveName
      : effectiveName;
  }

  patch.updated_at = nowTimestamp();

  var updatedLocation = updateRowById(CONFIG.SHEETS.LOCATIONS, 'location_id', locationId, patch);

  if (patch.location_path) {
    locationRecalculateDescendantPaths_(locationId, patch.location_path);
  }

  return updatedLocation;
}

/**
 * Menonaktifkan lokasi (soft delete). Tidak menghapus baris data, dan
 * tidak melakukan cascade ke lokasi anak pada fase ini.
 *
 * @param {string} locationId ID lokasi yang dinonaktifkan.
 * @return {Object} Baris lokasi setelah dinonaktifkan.
 * @throws {Error} Jika locationId kosong atau lokasi tidak ditemukan.
 */
function deactivateLocation(locationId) {
  if (isEmpty(locationId)) {
    throw new Error('LocationService.deactivateLocation: "locationId" wajib diisi.');
  }
  return updateRowById(CONFIG.SHEETS.LOCATIONS, 'location_id', locationId, {
    is_active: false,
    updated_at: nowTimestamp()
  });
}

/**
 * Memeriksa apakah "candidateAncestorId" berada pada rantai leluhur
 * (ancestor chain) dari "startLocationId", dengan menelusuri parent_id
 * secara berulang. Digunakan untuk mencegah circular hierarchy.
 *
 * @param {string} startLocationId ID lokasi awal penelusuran (calon induk baru).
 * @param {string} candidateAncestorId ID lokasi yang ingin diubah parent_id-nya.
 * @return {boolean} true jika candidateAncestorId ditemukan pada rantai
 *   leluhur startLocationId (artinya perubahan akan membentuk siklus).
 * @private
 */
function locationIsDescendantOf_(startLocationId, candidateAncestorId) {
  var currentId = startLocationId;
  var depth = 0;

  while (!isEmpty(currentId) && depth < LOCATION_MAX_HIERARCHY_DEPTH_) {
    if (currentId === candidateAncestorId) {
      return true;
    }
    var currentLocation = getRowById(CONFIG.SHEETS.LOCATIONS, 'location_id', currentId);
    if (!currentLocation) {
      break;
    }
    currentId = currentLocation.parent_id;
    depth++;
  }

  return false;
}

/**
 * Memperbarui location_path seluruh keturunan langsung dan tidak langsung
 * dari suatu lokasi, setelah location_path induknya berubah. Rekursif
 * dangkal (bukan rekursi fungsi) menggunakan antrian eksplisit agar aman
 * dari hierarki yang dalam.
 *
 * @param {string} locationId ID lokasi yang location_path-nya baru saja berubah.
 * @param {string} newPath location_path baru milik locationId.
 * @private
 */
function locationRecalculateDescendantPaths_(locationId, newPath) {
  var queue = [{ id: locationId, path: newPath }];
  var processed = 0;

  while (queue.length > 0 && processed < LOCATION_MAX_HIERARCHY_DEPTH_) {
    var current = queue.shift();
    var children = findRows(CONFIG.SHEETS.LOCATIONS, function (row) {
      return row.parent_id === current.id;
    });

    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var childNewPath = current.path + LOCATION_PATH_SEPARATOR_ + child.location_name;
      updateRowById(CONFIG.SHEETS.LOCATIONS, 'location_id', child.location_id, {
        location_path: childNewPath,
        updated_at: nowTimestamp()
      });
      queue.push({ id: child.location_id, path: childNewPath });
    }

    processed++;
  }
}
