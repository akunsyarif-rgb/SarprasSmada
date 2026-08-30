/**
 * CategoryService.gs
 *
 * Domain service untuk data kategori kerusakan/gangguan sarana-prasarana
 * (sheet 03_categories).
 *
 * Pola implementasi (lihat docs/ARCHITECTURE.md):
 *   VALIDATION → BUSINESS LOGIC → DATABASE SERVICE → GOOGLE SPREADSHEET
 *
 * Domain ini TIDAK memanggil SpreadsheetApp secara langsung — seluruh
 * akses data melalui core/DatabaseService.gs (lihat docs/ARCHITECTURE.md
 * bagian 4, Aturan Akses Database).
 *
 * Catatan desain: pemeriksaan "kategori masih memiliki facility aktif"
 * pada deactivateCategory() membaca sheet 04_facilities LANGSUNG melalui
 * DatabaseService (findRows), BUKAN dengan memanggil FacilityService.
 * Ini disengaja agar tidak terjadi dependency melingkar antar domain
 * service (FacilityService memvalidasi Category dengan cara yang sama —
 * membaca sheet Category langsung), sesuai docs/ARCHITECTURE.md bagian 4
 * poin 4.
 *
 * Soft delete: penonaktifan kategori menggunakan kolom is_active, TIDAK
 * PERNAH menghapus baris (hard delete).
 *
 * Kesiapan Audit: createCategory/updateCategory/deactivateCategory
 * mengembalikan objek baris lengkap (state akhir) agar mudah diteruskan
 * ke Audit Service pada tahap berikutnya (belum diimplementasikan).
 *
 * Dependency:
 * - core/Config.gs (CONFIG.SHEETS.CATEGORIES, CONFIG.SHEETS.FACILITIES,
 *   CONFIG.SEQUENCES.CATEGORY, CONFIG.ID_PREFIXES.CATEGORY)
 * - core/DatabaseService.gs (getRowById, findRows, insertRow, updateRowById)
 * - core/SequenceService.gs (generateEntityId)
 * - core/UtilityService.gs (isEmpty, normalizeText, nowTimestamp)
 *
 * Referensi: docs/DATABASE_SCHEMA.md (03_categories)
 */

/**
 * Membuat kategori baru.
 *
 * Validasi:
 * - category_name wajib diisi dan unik di antara kategori yang aktif.
 *
 * @param {Object} categoryData Data kategori baru.
 * @param {string} categoryData.category_name Nama kategori, wajib.
 * @param {string} [categoryData.description] Keterangan tambahan (opsional).
 * @return {Object} Baris kategori yang berhasil dibuat.
 * @throws {Error} Jika validasi gagal.
 */
function createCategory(categoryData) {
  if (!categoryData || typeof categoryData !== 'object') {
    throw new Error('CategoryService.createCategory: "categoryData" wajib diisi dan bertipe object.');
  }
  if (isEmpty(categoryData.category_name)) {
    throw new Error('CategoryService.createCategory: "category_name" wajib diisi.');
  }
  if (categoryIsNameTakenByActiveCategory_(categoryData.category_name, null)) {
    throw new Error('CategoryService.createCategory: "category_name" sudah dipakai kategori aktif lain: "' + categoryData.category_name + '".');
  }

  var timestamp = nowTimestamp();
  var newCategory = {
    category_id: generateEntityId(CONFIG.ID_PREFIXES.CATEGORY, CONFIG.SEQUENCES.CATEGORY),
    category_name: categoryData.category_name.trim(),
    description: categoryData.description || '',
    is_active: true,
    created_at: timestamp,
    updated_at: timestamp
  };

  return insertRow(CONFIG.SHEETS.CATEGORIES, newCategory);
}

/**
 * Mengambil satu kategori berdasarkan category_id.
 *
 * @param {string} categoryId ID kategori.
 * @return {Object|null} Baris kategori, atau null jika tidak ditemukan.
 * @throws {Error} Jika categoryId kosong.
 */
function getCategoryById(categoryId) {
  if (isEmpty(categoryId)) {
    throw new Error('CategoryService.getCategoryById: "categoryId" wajib diisi.');
  }
  return getRowById(CONFIG.SHEETS.CATEGORIES, 'category_id', categoryId);
}

/**
 * Mengambil seluruh kategori yang berstatus aktif.
 *
 * @return {Array<Object>} Daftar kategori aktif.
 */
function listActiveCategories() {
  return findRows(CONFIG.SHEETS.CATEGORIES, function (row) {
    return row.is_active === true;
  });
}

/**
 * Memperbarui data kategori. is_active TIDAK dapat diubah lewat fungsi
 * ini — gunakan deactivateCategory() untuk menonaktifkan kategori.
 *
 * @param {string} categoryId ID kategori yang diperbarui.
 * @param {Object} updates Kolom yang ingin diperbarui.
 * @return {Object} Baris kategori setelah diperbarui.
 * @throws {Error} Jika validasi gagal atau kategori tidak ditemukan.
 */
function updateCategory(categoryId, updates) {
  if (isEmpty(categoryId)) {
    throw new Error('CategoryService.updateCategory: "categoryId" wajib diisi.');
  }
  if (!updates || typeof updates !== 'object') {
    throw new Error('CategoryService.updateCategory: "updates" wajib diisi dan bertipe object.');
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'is_active')) {
    throw new Error('CategoryService.updateCategory: "is_active" tidak dapat diubah lewat updateCategory(). Gunakan deactivateCategory().');
  }

  var patch = {};

  if (Object.prototype.hasOwnProperty.call(updates, 'category_name')) {
    if (isEmpty(updates.category_name)) {
      throw new Error('CategoryService.updateCategory: "category_name" tidak boleh dikosongkan.');
    }
    if (categoryIsNameTakenByActiveCategory_(updates.category_name, categoryId)) {
      throw new Error('CategoryService.updateCategory: "category_name" sudah dipakai kategori aktif lain: "' + updates.category_name + '".');
    }
    patch.category_name = updates.category_name.trim();
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
    patch.description = updates.description || '';
  }

  patch.updated_at = nowTimestamp();

  return updateRowById(CONFIG.SHEETS.CATEGORIES, 'category_id', categoryId, patch);
}

/**
 * Menonaktifkan kategori (soft delete). Ditolak jika kategori masih
 * memiliki facility yang aktif — facility tersebut wajib dinonaktifkan
 * atau dipindahkan ke kategori lain terlebih dahulu.
 *
 * @param {string} categoryId ID kategori yang dinonaktifkan.
 * @return {Object} Baris kategori setelah dinonaktifkan.
 * @throws {Error} Jika categoryId kosong, kategori tidak ditemukan, atau
 *   masih memiliki facility aktif yang merujuknya.
 */
function deactivateCategory(categoryId) {
  if (isEmpty(categoryId)) {
    throw new Error('CategoryService.deactivateCategory: "categoryId" wajib diisi.');
  }

  var activeFacilities = findRows(CONFIG.SHEETS.FACILITIES, function (row) {
    return row.category_id === categoryId && row.is_active === true;
  });

  if (activeFacilities.length > 0) {
    throw new Error(
      'CategoryService.deactivateCategory: Kategori "' + categoryId +
      '" masih memiliki ' + activeFacilities.length +
      ' facility aktif yang merujuknya. Nonaktifkan atau pindahkan facility tersebut terlebih dahulu.'
    );
  }

  return updateRowById(CONFIG.SHEETS.CATEGORIES, 'category_id', categoryId, {
    is_active: false,
    updated_at: nowTimestamp()
  });
}

/**
 * Memeriksa apakah suatu category_name sudah dipakai kategori lain yang
 * masih aktif (perbandingan tanpa mempermasalahkan huruf besar/kecil atau
 * spasi).
 *
 * @param {string} categoryName Nama kategori yang diperiksa.
 * @param {?string} excludeCategoryId category_id yang dikecualikan dari
 *   pemeriksaan (dipakai saat update).
 * @return {boolean} true jika nama sudah dipakai kategori aktif lain.
 * @private
 */
function categoryIsNameTakenByActiveCategory_(categoryName, excludeCategoryId) {
  var normalizedName = normalizeText(categoryName);
  var matches = findRows(CONFIG.SHEETS.CATEGORIES, function (row) {
    if (excludeCategoryId && row.category_id === excludeCategoryId) {
      return false;
    }
    return row.is_active === true && normalizeText(row.category_name) === normalizedName;
  });
  return matches.length > 0;
}
