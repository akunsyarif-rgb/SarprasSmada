/**
 * OwnerService.gs
 *
 * Domain service untuk data pihak/unit penanggung jawab sarana-prasarana
 * (sheet 05_owners).
 *
 * Pola implementasi (lihat docs/ARCHITECTURE.md):
 *   VALIDATION → BUSINESS LOGIC → DATABASE SERVICE → GOOGLE SPREADSHEET
 *
 * Domain ini TIDAK memanggil SpreadsheetApp secara langsung — seluruh
 * akses data melalui core/DatabaseService.gs (lihat docs/ARCHITECTURE.md
 * bagian 4, Aturan Akses Database).
 *
 * Soft delete: penonaktifan owner menggunakan kolom is_active, TIDAK
 * PERNAH menghapus baris (hard delete).
 *
 * Kesiapan Audit: createOwner/updateOwner/deactivateOwner mengembalikan
 * objek baris lengkap (state akhir) agar mudah diteruskan ke Audit
 * Service pada tahap berikutnya (belum diimplementasikan).
 *
 * Catatan technical debt: berbeda dengan CategoryService.deactivateCategory()
 * yang menolak deaktivasi bila masih ada facility aktif merujuknya,
 * deactivateOwner() TIDAK memeriksa referensi dari 01_users.owner_id
 * (referensi tersebut belum diminta pada scope PHASE 3 ini). Lihat laporan
 * PHASE 3 untuk rekomendasi penambahan guard serupa di masa depan.
 *
 * Dependency:
 * - core/Config.gs (CONFIG.SHEETS.OWNERS, CONFIG.SEQUENCES.OWNER,
 *   CONFIG.ID_PREFIXES.OWNER)
 * - core/DatabaseService.gs (getRowById, findRows, insertRow, updateRowById)
 * - core/SequenceService.gs (generateEntityId)
 * - core/UtilityService.gs (isEmpty, normalizeText, nowTimestamp)
 *
 * Referensi: docs/DATABASE_SCHEMA.md (05_owners)
 */

/**
 * Membuat owner baru.
 *
 * Validasi:
 * - owner_name wajib diisi dan unik di antara owner yang aktif.
 *
 * @param {Object} ownerData Data owner baru.
 * @param {string} ownerData.owner_name Nama unit/pihak penanggung jawab, wajib.
 * @param {string} [ownerData.description] Keterangan tambahan (opsional).
 * @return {Object} Baris owner yang berhasil dibuat.
 * @throws {Error} Jika validasi gagal.
 */
function createOwner(ownerData) {
  if (!ownerData || typeof ownerData !== 'object') {
    throw new Error('OwnerService.createOwner: "ownerData" wajib diisi dan bertipe object.');
  }
  if (isEmpty(ownerData.owner_name)) {
    throw new Error('OwnerService.createOwner: "owner_name" wajib diisi.');
  }
  if (ownerIsNameTakenByActiveOwner_(ownerData.owner_name, null)) {
    throw new Error('OwnerService.createOwner: "owner_name" sudah dipakai owner aktif lain: "' + ownerData.owner_name + '".');
  }

  var timestamp = nowTimestamp();
  var newOwner = {
    owner_id: generateEntityId(CONFIG.ID_PREFIXES.OWNER, CONFIG.SEQUENCES.OWNER),
    owner_name: ownerData.owner_name.trim(),
    description: ownerData.description || '',
    is_active: true,
    created_at: timestamp,
    updated_at: timestamp
  };

  return insertRow(CONFIG.SHEETS.OWNERS, newOwner);
}

/**
 * Mengambil satu owner berdasarkan owner_id.
 *
 * @param {string} ownerId ID owner.
 * @return {Object|null} Baris owner, atau null jika tidak ditemukan.
 * @throws {Error} Jika ownerId kosong.
 */
function getOwnerById(ownerId) {
  if (isEmpty(ownerId)) {
    throw new Error('OwnerService.getOwnerById: "ownerId" wajib diisi.');
  }
  return getRowById(CONFIG.SHEETS.OWNERS, 'owner_id', ownerId);
}

/**
 * Mengambil seluruh owner yang berstatus aktif.
 *
 * @return {Array<Object>} Daftar owner aktif.
 */
function listActiveOwners() {
  return findRows(CONFIG.SHEETS.OWNERS, function (row) {
    return row.is_active === true;
  });
}

/**
 * Memperbarui data owner. is_active TIDAK dapat diubah lewat fungsi ini —
 * gunakan deactivateOwner() untuk menonaktifkan owner.
 *
 * @param {string} ownerId ID owner yang diperbarui.
 * @param {Object} updates Kolom yang ingin diperbarui.
 * @return {Object} Baris owner setelah diperbarui.
 * @throws {Error} Jika validasi gagal atau owner tidak ditemukan.
 */
function updateOwner(ownerId, updates) {
  if (isEmpty(ownerId)) {
    throw new Error('OwnerService.updateOwner: "ownerId" wajib diisi.');
  }
  if (!updates || typeof updates !== 'object') {
    throw new Error('OwnerService.updateOwner: "updates" wajib diisi dan bertipe object.');
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'is_active')) {
    throw new Error('OwnerService.updateOwner: "is_active" tidak dapat diubah lewat updateOwner(). Gunakan deactivateOwner().');
  }

  var patch = {};

  if (Object.prototype.hasOwnProperty.call(updates, 'owner_name')) {
    if (isEmpty(updates.owner_name)) {
      throw new Error('OwnerService.updateOwner: "owner_name" tidak boleh dikosongkan.');
    }
    if (ownerIsNameTakenByActiveOwner_(updates.owner_name, ownerId)) {
      throw new Error('OwnerService.updateOwner: "owner_name" sudah dipakai owner aktif lain: "' + updates.owner_name + '".');
    }
    patch.owner_name = updates.owner_name.trim();
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
    patch.description = updates.description || '';
  }

  patch.updated_at = nowTimestamp();

  return updateRowById(CONFIG.SHEETS.OWNERS, 'owner_id', ownerId, patch);
}

/**
 * Menonaktifkan owner (soft delete). Tidak menghapus baris data.
 *
 * @param {string} ownerId ID owner yang dinonaktifkan.
 * @return {Object} Baris owner setelah dinonaktifkan.
 * @throws {Error} Jika ownerId kosong atau owner tidak ditemukan.
 */
function deactivateOwner(ownerId) {
  if (isEmpty(ownerId)) {
    throw new Error('OwnerService.deactivateOwner: "ownerId" wajib diisi.');
  }
  return updateRowById(CONFIG.SHEETS.OWNERS, 'owner_id', ownerId, {
    is_active: false,
    updated_at: nowTimestamp()
  });
}

/**
 * Memeriksa apakah suatu owner_name sudah dipakai owner lain yang masih
 * aktif (perbandingan tanpa mempermasalahkan huruf besar/kecil atau spasi).
 *
 * @param {string} ownerName Nama owner yang diperiksa.
 * @param {?string} excludeOwnerId owner_id yang dikecualikan dari
 *   pemeriksaan (dipakai saat update).
 * @return {boolean} true jika nama sudah dipakai owner aktif lain.
 * @private
 */
function ownerIsNameTakenByActiveOwner_(ownerName, excludeOwnerId) {
  var normalizedName = normalizeText(ownerName);
  var matches = findRows(CONFIG.SHEETS.OWNERS, function (row) {
    if (excludeOwnerId && row.owner_id === excludeOwnerId) {
      return false;
    }
    return row.is_active === true && normalizeText(row.owner_name) === normalizedName;
  });
  return matches.length > 0;
}
