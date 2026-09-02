# Skema Database — SIGAP SARPRAS SMADA

Database sistem disimpan dalam bentuk Google Spreadsheet, dengan setiap sheet merepresentasikan satu entitas/tabel. Penamaan sheet menggunakan awalan angka sebagai penanda kelompok domain dan urutan:

- `01`–`09` — Data Master
- `10`–`19` — Pelaporan (Reports)
- `20`–`29` — Audit
- `90`–`99` — Konfigurasi & Utilitas Sistem

Seluruh akses terhadap sheet-sheet berikut wajib melalui `DatabaseService` (lihat `docs/ARCHITECTURE.md`) — tidak ada modul domain yang mengakses `SpreadsheetApp` secara langsung.

**PHASE 3.75 — Legacy-Compatible Repository Reconciliation:** skema `11_report_photos`, `12_report_history`, `13_report_comments`, `20_audit_logs`, dan `91_sequences` di bawah ini telah disesuaikan berdasarkan **inspeksi read-only nyata** (via `SpreadsheetApp`, bukan asumsi) terhadap database produksi SIGAP SARPRAS yang sudah berjalan sejak sebelum repository ini dibuat. Setiap sheet yang direkonsiliasi memiliki subbagian **"Reconciliation Notes"** yang membedakan secara eksplisit:
- **Legacy-only columns** — kolom yang hanya ada di database produksi nyata, tidak pernah ada di dokumentasi awal repository, dan sekarang diadopsi sebagai bagian dari schema canonical.
- **Repo-only columns** — kolom yang hanya ada di dokumentasi awal repository, tidak pernah benar-benar dipakai di deployment nyata, dan sekarang **dihapus dari schema canonical** (kecuali dinyatakan eksplisit sebagai retensi yang disengaja).

Tidak ada satu pun perubahan terhadap spreadsheet nyata sebagai bagian dari reconciliation ini — hanya dokumentasi dan kode repository yang diselaraskan mengikuti kondisi nyata.

---

## Data Master

### `01_users`

Menyimpan data pengguna sistem.

| Kolom | Deskripsi |
|---|---|
| `user_id` | ID unik pengguna |
| `email` | Alamat email pengguna (identitas login) |
| `full_name` | Nama lengkap pengguna |
| `role` | Peran pengguna dalam sistem — wajib salah satu nilai kanonik pada `CONFIG.ROLES` (`SISWA`, `GURU`, `STAF`, `VERIFIKATOR`, `OWNER`, `ADMIN`); penambahan role baru wajib didokumentasikan di sini dan di `core/Config.gs` |
| `student_id` | Nomor induk siswa (khusus role siswa, dapat kosong untuk role lain) |
| `class_name` | Nama kelas (khusus role siswa, dapat kosong untuk role lain) |
| `owner_id` | Referensi ke `05_owners`, apabila pengguna terasosiasi dengan suatu unit penanggung jawab |
| `password_hash` | Hash SHA-256 (salted) dari password login pengguna. Dikelola HANYA oleh `apps-script/auth/AuthService.gs` — lihat "Perubahan Skema — Autentikasi" di bawah. Kosong untuk baris lama/pengguna yang belum diberi password. |
| `password_salt` | Salt acak (UUID) unik per pengguna, dipakai bersama `password_hash`. Dikelola HANYA oleh `AuthService.gs`. |
| `is_active` | Status aktif/nonaktif akun pengguna |
| `created_at` | Waktu data dibuat |
| `updated_at` | Waktu data terakhir diperbarui |

**Perubahan Skema — Autentikasi (menggantikan PHASE 4.5 Google SSO):**
`password_hash`/`password_salt` adalah kolom **baru, additive** — ditambahkan
saat frontend dipindah ke hosting terpisah dan sistem login beralih dari sesi
Google Workspace (`Session.getActiveUser()`) ke username(email)/password +
token sesi (lihat `apps-script/auth/README.md`,
`apps-script/api/AuthContext.gs`). **Tidak ada migrasi data** — baris
pengguna yang sudah ada sebelum perubahan ini memiliki kedua kolom tersebut
KOSONG dan tidak bisa login sampai seorang ADMIN menetapkan password awal
lewat `apiSetPassword` (lihat `docs/DATABASE_SETUP.md` untuk langkah
bootstrap). Kolom ini WAJIB ditambahkan secara manual ke sheet `01_users`
yang sudah ada di spreadsheet produksi — `apps-script/tools/SetupDatabase.gs`
tidak menjalankan migrasi otomatis. `apps-script/users/UserService.gs`
sengaja TIDAK menyentuh dua kolom ini (lihat header filenya) — hanya
`AuthService.gs` yang boleh menulis ke keduanya.

### `02_locations`

Menyimpan data lokasi/ruang di lingkungan sekolah, mendukung struktur hierarkis (parent-child) — mis. Sekolah → Gedung A → Lantai 1 → Ruang Kelas X.

| Kolom | Deskripsi |
|---|---|
| `location_id` | ID unik lokasi |
| `parent_id` | Referensi ke `02_locations` lain (lokasi induk); kosong jika lokasi berada di level teratas |
| `location_name` | Nama lokasi (mis. "Ruang Kelas X IPA 1", "Lantai 1") |
| `location_type` | Jenis/tingkatan lokasi (mis. "GEDUNG", "LANTAI", "RUANG") |
| `location_path` | Jalur hierarki lengkap yang dihasilkan otomatis oleh `LocationService`, mis. "Gedung A > Lantai 1 > Ruang Kelas X" |
| `is_active` | Status aktif/nonaktif data lokasi |
| `created_at` | Waktu data dibuat |
| `updated_at` | Waktu data terakhir diperbarui |

### `03_categories`

Menyimpan kategori kerusakan/gangguan sarana-prasarana.

| Kolom | Deskripsi |
|---|---|
| `category_id` | ID unik kategori |
| `category_name` | Nama kategori (mis. "Listrik", "Kebersihan", "Furnitur", "IT/Jaringan"); unik di antara kategori yang aktif (`is_active = true`) |
| `description` | Keterangan tambahan mengenai kategori |
| `is_active` | Status aktif/nonaktif data kategori |
| `created_at` | Waktu data dibuat |
| `updated_at` | Waktu data terakhir diperbarui |

### `04_facilities`

Menyimpan data fasilitas/aset sarana-prasarana.

| Kolom | Deskripsi |
|---|---|
| `facility_id` | ID unik fasilitas |
| `category_id` | Referensi ke `03_categories` — wajib merujuk kategori yang valid dan aktif |
| `facility_name` | Nama fasilitas/aset (mis. "AC Ruang Guru", "Proyektor Kelas XI IPA 2") |
| `is_active` | Status aktif/nonaktif data fasilitas |
| `created_at` | Waktu data dibuat |
| `updated_at` | Waktu data terakhir diperbarui |

### `05_owners`

Menyimpan data pihak/unit yang bertanggung jawab menindaklanjuti laporan.

| Kolom | Deskripsi |
|---|---|
| `owner_id` | ID unik owner/penanggung jawab |
| `owner_name` | Nama unit/pihak penanggung jawab (mis. "Tim Sarpras", "Petugas Kebersihan", "Teknisi IT"); unik di antara owner yang aktif (`is_active = true`) |
| `description` | Keterangan tambahan mengenai unit/pihak |
| `is_active` | Status aktif/nonaktif data owner |
| `created_at` | Waktu data dibuat |
| `updated_at` | Waktu data terakhir diperbarui |

---

## Pelaporan (Reports)

### `10_reports`

Tabel utama yang menyimpan data laporan sarana-prasarana.

| Kolom | Deskripsi |
|---|---|
| `report_id` | ID unik internal laporan |
| `report_number` | Nomor laporan yang ditampilkan ke pengguna, dihasilkan oleh `SequenceService.generateReportNumber()` (format `SRP-YYYY-000001`, mis. `SRP-2026-000001`). Tahun hanya bersifat tampilan; angka urut di baliknya berasal dari sequence `REPORT` yang monoton dan tidak pernah reset per tahun (lihat `docs/DATABASE_SETUP.md`) |
| `reporter_id` | Referensi ke `01_users` — pengguna yang membuat laporan |
| `location_id` | Referensi ke `02_locations` |
| `category_id` | Referensi ke `03_categories` |
| `facility_id` | Referensi ke `04_facilities` (dapat kosong jika laporan tidak terikat pada satu fasilitas tertentu) |
| `condition` | Deskripsi singkat kondisi yang dilaporkan |
| `description` | Deskripsi lengkap laporan dari pelapor |
| `impact_level` | Tingkat dampak kerusakan/gangguan terhadap aktivitas (mis. `RENDAH`, `SEDANG`, `TINGGI`) |
| `safety_risk` | Penanda risiko terhadap keselamatan (mis. `YA`/`TIDAK`) |
| `system_priority` | Prioritas yang dihitung otomatis oleh sistem berdasarkan kategori, dampak, dan risiko keselamatan |
| `priority` | Prioritas final yang berlaku (hasil `system_priority`, atau hasil override manual) |
| `priority_override_reason` | Alasan apabila `priority` diubah secara manual dari `system_priority` |
| `status` | Status laporan saat ini (lihat `docs/WORKFLOW.md`) |
| `owner_id` | Referensi ke `05_owners` — penanggung jawab yang ditugaskan menangani laporan |
| `duplicate_of_report_id` | Referensi ke `10_reports` lain, apabila laporan ini merupakan duplikat dari laporan yang sudah ada |
| `created_at` | Waktu laporan dibuat (status `SUBMITTED`) |
| `updated_at` | Waktu data laporan terakhir diperbarui |
| `verified_at` | Waktu laporan diverifikasi (status `VERIFIED`) |
| `assigned_at` | Waktu laporan ditugaskan (status `ASSIGNED`) |
| `started_at` | Waktu penanganan dimulai (status `IN_PROGRESS`) |
| `completed_at` | Waktu penanganan selesai (status `COMPLETED`) |
| `closed_at` | Waktu laporan ditutup (status `CLOSED`) |
| `is_active` | Penanda soft-delete/keaktifan data laporan |

### `11_report_photos`

Menyimpan referensi foto/lampiran yang terkait dengan suatu laporan. Terintegrasi dengan Google Drive untuk penyimpanan berkas aktual.

| Kolom | Deskripsi |
|---|---|
| `photo_id` | ID unik foto/lampiran |
| `report_id` | Referensi ke `10_reports` |
| `photo_type` | Kategori/jenis foto (mis. "BEFORE", "AFTER" — nilai pasti akan didefinisikan saat PHASE 4) |
| `drive_file_id` | ID file pada Google Drive (dipakai untuk operasi Drive API — hapus, re-fetch, dsb.) |
| `drive_url` | URL/tautan berkas foto di Google Drive |
| `file_name` | Nama berkas asli saat diunggah |
| `mime_type` | Tipe MIME berkas (mis. `image/jpeg`) — dipakai untuk validasi format |
| `file_size` | Ukuran berkas dalam byte — dipakai untuk validasi terhadap `90_settings.MAX_FILE_SIZE_MB` |
| `uploaded_by` | Referensi ke `01_users` — pengguna yang mengunggah foto |
| `uploaded_at` | Waktu foto diunggah |
| `is_active` | Status aktif/nonaktif (soft-delete) — konsisten dengan konvensi sheet lain |

**Reconciliation Notes (PHASE 3.75):**
- **Legacy-only columns** (diadopsi ke canonical): `photo_type`, `drive_file_id`, `drive_url`, `file_name`, `mime_type`, `file_size`, `is_active`.
- **Repo-only columns** (dihapus dari canonical — tidak pernah dipakai di deployment nyata): `file_url` (digantikan `drive_url`), `caption` (belum ada padanan di database produksi; dapat ditambahkan kembali di PHASE 4 jika dibutuhkan, sebagai kolom baru yang bersifat additive).
- **Rename**: `created_at` → `uploaded_at` (mengikuti konvensi nyata; secara semantik sama).

### `12_report_history`

Menyimpan riwayat perubahan status/data pada suatu laporan, digunakan untuk merekonstruksi alur penanganan laporan.

| Kolom | Deskripsi |
|---|---|
| `history_id` | ID unik entri riwayat |
| `report_id` | Referensi ke `10_reports` |
| `previous_status` | Status laporan sebelum perubahan (kosong untuk entri pertama, mis. `REPORT_CREATED`) |
| `new_status` | Status laporan setelah perubahan |
| `action` | Jenis aksi yang terjadi (mis. `REPORT_CREATED`, `STATUS_CHANGED`) — lebih deskriptif daripada sekadar before/after status |
| `notes` | Catatan/keterangan atas perubahan yang dilakukan |
| `performed_by` | Referensi ke `01_users` — pengguna yang melakukan perubahan |
| `created_at` | Waktu perubahan terjadi |

**Reconciliation Notes (PHASE 3.75):**
- **Legacy-only columns** (diadopsi ke canonical): `action`.
- **Repo-only columns**: tidak ada yang dihapus — seluruh kolom rancangan awal repository tetap ada.
- **Rename**: `changed_by` → `performed_by` (mengikuti konvensi nyata; secara semantik sama).

### `13_report_comments`

Menyimpan komunikasi/komentar terkait suatu laporan antara pelapor, penanggung jawab, dan pihak terkait lainnya.

| Kolom | Deskripsi |
|---|---|
| `comment_id` | ID unik komentar |
| `report_id` | Referensi ke `10_reports` |
| `comment_type` | Kategori/jenis komentar (mis. "NOTE", "QUESTION" — nilai pasti akan didefinisikan saat PHASE 4) |
| `message` | Isi komentar |
| `created_by` | Referensi ke `01_users` — penulis komentar |
| `is_internal` | Penanda apakah komentar bersifat internal (hanya terlihat oleh pihak berwenang) atau dapat dilihat pelapor |
| `created_at` | Waktu komentar dibuat |
| `is_active` | Status aktif/nonaktif (soft-delete) — konsisten dengan konvensi sheet lain |

**Reconciliation Notes (PHASE 3.75) — SCHEMA HYBRID:**
- **Legacy-only columns** (diadopsi ke canonical): `comment_type`, `is_active`.
- **Repo-only columns RETAINED secara sengaja** (bukan legacy, TIDAK dihapus): `is_internal` — fitur privasi (komentar internal staff vs. terlihat pelapor) belum diimplementasikan di database produksi (sheet ini masih 0 baris di produksi saat inspeksi dilakukan), tetapi tetap relevan untuk PHASE 4/5 dan aman ditambahkan karena tidak ada data yang perlu disesuaikan.
- **Rename**: `comment_text` → `message`, `author_id` → `created_by` (mengikuti konvensi nyata; secara semantik sama).

---

## Audit

### `20_audit_logs`

Menyimpan jejak audit atas aktivitas penting yang terjadi di seluruh sistem, tidak terbatas pada domain pelaporan.

| Kolom | Deskripsi |
|---|---|
| `audit_id` | ID unik entri log |
| `user_id` | Referensi ke `01_users` — pengguna yang melakukan aksi (dapat kosong untuk aksi sistem otomatis) |
| `action` | Jenis aksi yang dilakukan (mis. `CREATE_REPORT`, `STATUS_CHANGE`, `UPDATE_MASTER_DATA`, `REJECTED_TRANSITION`) |
| `entity_type` | Jenis entitas yang terdampak (mis. `report`, `user`, `facility`) |
| `entity_id` | ID entitas yang terdampak |
| `metadata` | Detail tambahan terkait aksi dalam bentuk JSON (mis. `report_number`, `status`, `priority` saat itu) |
| `created_at` | Waktu aksi tercatat |

**Reconciliation Notes (PHASE 3.75):**
- **Legacy-only / Repo-only columns**: tidak ada penambahan atau penghapusan kolom — struktur (7 kolom, jenis informasi yang sama) identik antara rancangan awal repository dan database produksi.
- **Rename**: `log_id` → `audit_id`, `actor_id` → `user_id`, `details` → `metadata` (mengikuti konvensi nyata, yang sudah memiliki data produksi berjalan; `audit_id` juga dianggap lebih jelas untuk tabel bernama `20_audit_logs`).

---

## Konfigurasi & Utilitas Sistem

### `90_settings`

Menyimpan konfigurasi sistem yang bersifat dinamis (dapat diubah tanpa mengubah kode), sebagai pelengkap konfigurasi statis pada `apps-script/core/Config.gs`.

| Kolom | Deskripsi |
|---|---|
| `setting_key` | Kunci unik pengaturan |
| `setting_value` | Nilai pengaturan |
| `description` | Keterangan mengenai kegunaan pengaturan |
| `updated_at` | Waktu pengaturan terakhir diperbarui |

### `91_sequences`

Menyimpan penghitung (counter) yang digunakan `SequenceService` untuk menghasilkan ID unik dan nomor urut secara konsisten dan bebas duplikasi. Setiap `sequence_name` bersifat **monoton dan tidak pernah direset** (termasuk lintas pergantian tahun) — lihat `docs/DATABASE_SETUP.md` untuk daftar lengkap sequence yang digunakan sistem beserta nilai awalnya.

| Kolom | Deskripsi |
|---|---|
| `sequence_name` | Kunci unik penghitung (mis. `REPORT`, `HISTORY`, `AUDIT`) |
| `current_value` | Nilai terakhir yang telah digunakan |
| `updated_at` | Waktu penghitung terakhir diperbarui |

**Reconciliation Notes (PHASE 3.75) — SEQUENCE COMPATIBILITY LAYER:**
- **Rename canonical**: `sequence_key` → `sequence_name`, `last_value` → `current_value`. Nama `sequence_key`/`last_value` sebelumnya hanya ada di dokumentasi repository dan **tidak pernah dipakai di deployment nyata mana pun** — `sequence_name`/`current_value` adalah nama yang sudah berjalan di database produksi SIGAP SARPRAS sejak awal.
- **Tidak ada migrasi spreadsheet** yang dilakukan atau diperlukan untuk perubahan ini — canonical documentation kini hanya mengikuti apa yang sudah nyata berjalan.
- `core/SequenceService.gs` menerapkan **alias resolution**: mengenali baik `sequence_name` maupun `sequence_key` (demikian pula `current_value`/`last_value`) pada sheet yang sebenarnya, dan menulis balik menggunakan nama kolom yang SAMA dengan yang sudah ada di sheet tersebut — sehingga tetap backward-compatible terhadap sheet yang mungkin dibuat memakai nama kolom versi dokumentasi sebelumnya, tanpa memaksa satu nama tertentu.

---

## Catatan Umum

- Seluruh kolom `*_id` bersifat unik dalam sheet-nya masing-masing dan dihasilkan melalui `SequenceService` atau mekanisme pembangkitan ID yang konsisten, tidak dibuat secara manual/acak.
- Seluruh kolom bertipe waktu (`created_at`, `updated_at`, `*_at`) disimpan dalam format timestamp yang konsisten, ditentukan pada `core/Config.gs` atau `core/UtilityService.gs`.
- Skema Data Master (`01_users` s.d. `05_owners`) telah disesuaikan pada **PHASE 3 — Master Data** agar konsisten dengan validasi dan struktur hierarkis (khusus `02_locations`) yang diimplementasikan pada `apps-script/users/` dan `apps-script/master-data/`.
- Skema `11_report_photos`, `12_report_history`, `13_report_comments`, `20_audit_logs`, dan `91_sequences` telah disesuaikan pada **PHASE 3.75 — Legacy-Compatible Repository Reconciliation** mengikuti struktur database produksi nyata (lihat "Reconciliation Notes" pada masing-masing sheet di atas). `10_reports` sudah cocok 100% dengan produksi sejak awal, tidak berubah.
- **PHASE 4 — Legacy-Compatible Report Engine** telah mengimplementasikan domain `reports/` (`ReportService.gs`, `ReportWorkflowService.gs`, `ReportHistoryService.gs`) di atas skema `10_reports` dan `12_report_history` di atas. Domain `audit/` (`20_audit_logs`) serta service `11_report_photos`/`13_report_comments` masih belum diimplementasikan — schema-nya sudah siap sejak PHASE 3.75, dijadwalkan **PHASE 5 — Workflow & Authorization**.
- Petunjuk teknis pembuatan sheet dan nilai awal sequence tersedia di `docs/DATABASE_SETUP.md`.
