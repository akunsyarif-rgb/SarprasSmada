/**
 * FacilityService.gs
 *
 * Domain service untuk data fasilitas/aset sarana-prasarana (sheet
 * 04_facilities).
 *
 * Pola implementasi (lihat docs/ARCHITECTURE.md):
 *   VALIDATION → BUSINESS LOGIC → DATABASE SERVICE → GOOGLE SPREADSHEET
 *
 * Domain ini TIDAK memanggil SpreadsheetApp secara langsung — seluruh
 * akses data melalui core/DatabaseService.gs (lihat docs/ARCHITECTURE.md
 * bagian 4, Aturan Akses Database).
 *
 * Catatan desain: validasi category_id membaca sheet 03_categories
 * LANGSUNG melalui DatabaseService (getRowById), BUKAN dengan memanggil
 * CategoryService, untuk menghindari dependency melingkar antar domain
 * service (lihat docs/ARCHITECTURE.md bagian 4 poin 4, dan catatan serupa
 * pada CategoryService.gs).
 *
 * Soft delete: penonaktifan facility menggunakan kolom is_active, TIDAK
 * PERNAH menghapus baris (hard delete).
 *
 * Kesiapan Audit: createFacility/updateFacility/deactivateFacility
 * mengembalikan objek baris lengkap (state akhir) agar mudah diteruskan
 * ke Audit Service pada tahap berikutnya (belum diimplementasikan).
 *
 * Dependency:
 * - core/Config.gs (CONFIG.SHEETS.FACILITIES, CONFIG.SHEETS.CATEGORIES,
 *   CONFIG.SEQUENCES.FACILITY, CONFIG.ID_PREFIXES.FACILITY)
 * - core/DatabaseService.gs (getRowById, findRows, insertRow, updateRowById)
 * - core/SequenceService.gs (generateEntityId)
 * - core/UtilityService.gs (isEmpty, nowTimestamp)
 *
 * Referensi: docs/DATABASE_SCHEMA.md (04_facilities)
 */

/**
 * Membuat facility baru.
 *
 * Validasi:
 * - category_id wajib diisi dan harus merujuk kategori yang valid dan aktif.
 * - facility_name wajib diisi.
 *
 * @param {Object} facilityData Data facility baru.
 * @param {string} facilityData.category_id Referensi ke 03_categories, wajib.
 * @param {string} facilityData.facility_name Nama facility, wajib.
 * @return {Object} Baris facility yang berhasil dibuat.
 * @throws {Error} Jika validasi gagal.
 */
function createFacility(facilityData) {
  if (!facilityData || typeof facilityData !== 'object') {
    throw new Error('FacilityService.createFacility: "facilityData" wajib diisi dan bertipe object.');
  }
  if (isEmpty(facilityData.facility_name)) {
    throw new Error('FacilityService.createFacility: "facility_name" wajib diisi.');
  }
  facilityValidateActiveCategory_(facilityData.category_id);

  var timestamp = nowTimestamp();
  var newFacility = {
    facility_id: generateEntityId(CONFIG.ID_PREFIXES.FACILITY, CONFIG.SEQUENCES.FACILITY),
    category_id: facilityData.category_id,
    facility_name: facilityData.facility_name.trim(),
    is_active: true,
    created_at: timestamp,
    updated_at: timestamp
  };

  return insertRow(CONFIG.SHEETS.FACILITIES, newFacility);
}

/**
 * Mengambil satu facility berdasarkan facility_id.
 *
 * @param {string} facilityId ID facility.
 * @return {Object|null} Baris facility, atau null jika tidak ditemukan.
 * @throws {Error} Jika facilityId kosong.
 */
function getFacilityById(facilityId) {
  if (isEmpty(facilityId)) {
    throw new Error('FacilityService.getFacilityById: "facilityId" wajib diisi.');
  }
  return getRowById(CONFIG.SHEETS.FACILITIES, 'facility_id', facilityId);
}

/**
 * Mengambil seluruh facility yang berstatus aktif.
 *
 * @return {Array<Object>} Daftar facility aktif.
 */
function listActiveFacilities() {
  return findRows(CONFIG.SHEETS.FACILITIES, function (row) {
    return row.is_active === true;
  });
}

/**
 * Memperbarui data facility. is_active TIDAK dapat diubah lewat fungsi
 * ini — gunakan deactivateFacility() untuk menonaktifkan facility.
 *
 * @param {string} facilityId ID facility yang diperbarui.
 * @param {Object} updates Kolom yang ingin diperbarui.
 * @return {Object} Baris facility setelah diperbarui.
 * @throws {Error} Jika validasi gagal atau facility tidak ditemukan.
 */
function updateFacility(facilityId, updates) {
  if (isEmpty(facilityId)) {
    throw new Error('FacilityService.updateFacility: "facilityId" wajib diisi.');
  }
  if (!updates || typeof updates !== 'object') {
    throw new Error('FacilityService.updateFacility: "updates" wajib diisi dan bertipe object.');
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'is_active')) {
    throw new Error('FacilityService.updateFacility: "is_active" tidak dapat diubah lewat updateFacility(). Gunakan deactivateFacility().');
  }

  var patch = {};

  if (Object.prototype.hasOwnProperty.call(updates, 'category_id')) {
    facilityValidateActiveCategory_(updates.category_id);
    patch.category_id = updates.category_id;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'facility_name')) {
    if (isEmpty(updates.facility_name)) {
      throw new Error('FacilityService.updateFacility: "facility_name" tidak boleh dikosongkan.');
    }
    patch.facility_name = updates.facility_name.trim();
  }

  patch.updated_at = nowTimestamp();

  return updateRowById(CONFIG.SHEETS.FACILITIES, 'facility_id', facilityId, patch);
}

/**
 * Menonaktifkan facility (soft delete). Tidak menghapus baris data.
 *
 * @param {string} facilityId ID facility yang dinonaktifkan.
 * @return {Object} Baris facility setelah dinonaktifkan.
 * @throws {Error} Jika facilityId kosong atau facility tidak ditemukan.
 */
function deactivateFacility(facilityId) {
  if (isEmpty(facilityId)) {
    throw new Error('FacilityService.deactivateFacility: "facilityId" wajib diisi.');
  }
  return updateRowById(CONFIG.SHEETS.FACILITIES, 'facility_id', facilityId, {
    is_active: false,
    updated_at: nowTimestamp()
  });
}

/**
 * Memvalidasi bahwa category_id diisi dan merujuk kategori yang ada serta
 * berstatus aktif.
 *
 * @param {string} categoryId ID kategori yang diperiksa.
 * @throws {Error} Jika categoryId kosong, kategori tidak ditemukan, atau
 *   kategori tidak aktif.
 * @private
 */
function facilityValidateActiveCategory_(categoryId) {
  if (isEmpty(categoryId)) {
    throw new Error('FacilityService: "category_id" wajib diisi.');
  }
  var category = getRowById(CONFIG.SHEETS.CATEGORIES, 'category_id', categoryId);
  if (!category) {
    throw new Error('FacilityService: "category_id" tidak ditemukan: "' + categoryId + '".');
  }
  if (category.is_active !== true) {
    throw new Error('FacilityService: "category_id" tidak aktif, tidak dapat dipakai facility baru: "' + categoryId + '".');
  }
}
