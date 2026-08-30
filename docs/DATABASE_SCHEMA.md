# Skema Database — SIGAP SARPRAS SMADA

Database sistem disimpan dalam bentuk Google Spreadsheet, dengan setiap sheet merepresentasikan satu entitas/tabel. Penamaan sheet menggunakan awalan angka sebagai penanda kelompok domain dan urutan:

- `01`–`09` — Data Master
- `10`–`19` — Pelaporan (Reports)
- `20`–`29` — Audit
- `90`–`99` — Konfigurasi & Utilitas Sistem

Seluruh akses terhadap sheet-sheet berikut wajib melalui `DatabaseService` (lihat `docs/ARCHITECTURE.md`) — tidak ada modul domain yang mengakses `SpreadsheetApp` secara langsung.

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
| `is_active` | Status aktif/nonaktif akun pengguna |
| `created_at` | Waktu data dibuat |
| `updated_at` | Waktu data terakhir diperbarui |

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

Menyimpan referensi foto/lampiran yang terkait dengan suatu laporan.

| Kolom | Deskripsi |
|---|---|
| `photo_id` | ID unik foto/lampiran |
| `report_id` | Referensi ke `10_reports` |
| `file_url` | URL/tautan berkas foto (mis. tautan Google Drive) |
| `uploaded_by` | Referensi ke `01_users` — pengguna yang mengunggah foto |
| `caption` | Keterangan singkat foto (opsional) |
| `created_at` | Waktu foto diunggah |

### `12_report_history`

Menyimpan riwayat perubahan status/data pada suatu laporan, digunakan untuk merekonstruksi alur penanganan laporan.

| Kolom | Deskripsi |
|---|---|
| `history_id` | ID unik entri riwayat |
| `report_id` | Referensi ke `10_reports` |
| `previous_status` | Status laporan sebelum perubahan |
| `new_status` | Status laporan setelah perubahan |
| `changed_by` | Referensi ke `01_users` — pengguna yang melakukan perubahan |
| `notes` | Catatan/keterangan atas perubahan yang dilakukan |
| `created_at` | Waktu perubahan terjadi |

### `13_report_comments`

Menyimpan komunikasi/komentar terkait suatu laporan antara pelapor, penanggung jawab, dan pihak terkait lainnya.

| Kolom | Deskripsi |
|---|---|
| `comment_id` | ID unik komentar |
| `report_id` | Referensi ke `10_reports` |
| `author_id` | Referensi ke `01_users` — penulis komentar |
| `comment_text` | Isi komentar |
| `is_internal` | Penanda apakah komentar bersifat internal (hanya terlihat oleh pihak berwenang) atau dapat dilihat pelapor |
| `created_at` | Waktu komentar dibuat |

---

## Audit

### `20_audit_logs`

Menyimpan jejak audit atas aktivitas penting yang terjadi di seluruh sistem, tidak terbatas pada domain pelaporan.

| Kolom | Deskripsi |
|---|---|
| `log_id` | ID unik entri log |
| `actor_id` | Referensi ke `01_users` — pengguna yang melakukan aksi (dapat kosong untuk aksi sistem otomatis) |
| `action` | Jenis aksi yang dilakukan (mis. `CREATE_REPORT`, `STATUS_CHANGE`, `UPDATE_MASTER_DATA`, `REJECTED_TRANSITION`) |
| `entity_type` | Jenis entitas yang terdampak (mis. `report`, `user`, `facility`) |
| `entity_id` | ID entitas yang terdampak |
| `details` | Detail tambahan terkait aksi (mis. representasi data sebelum/sesudah perubahan) |
| `created_at` | Waktu aksi tercatat |

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

Menyimpan penghitung (counter) yang digunakan `SequenceService` untuk menghasilkan ID unik dan nomor urut secara konsisten dan bebas duplikasi. Setiap `sequence_key` bersifat **monoton dan tidak pernah direset** (termasuk lintas pergantian tahun) — lihat `docs/DATABASE_SETUP.md` untuk daftar lengkap sequence key yang digunakan sistem beserta nilai awalnya.

| Kolom | Deskripsi |
|---|---|
| `sequence_key` | Kunci unik penghitung (mis. `REPORT`, `HISTORY`, `AUDIT`) |
| `last_value` | Nilai terakhir yang telah digunakan |
| `updated_at` | Waktu penghitung terakhir diperbarui |

---

## Catatan Umum

- Seluruh kolom `*_id` bersifat unik dalam sheet-nya masing-masing dan dihasilkan melalui `SequenceService` atau mekanisme pembangkitan ID yang konsisten, tidak dibuat secara manual/acak.
- Seluruh kolom bertipe waktu (`created_at`, `updated_at`, `*_at`) disimpan dalam format timestamp yang konsisten, ditentukan pada `core/Config.gs` atau `core/UtilityService.gs`.
- Skema Data Master (`01_users` s.d. `05_owners`) telah disesuaikan pada **PHASE 3 — Master Data** agar konsisten dengan validasi dan struktur hierarkis (khusus `02_locations`) yang diimplementasikan pada `apps-script/users/` dan `apps-script/master-data/`. Skema Pelaporan (`10`–`13`) dan Audit (`20`) masih berupa rancangan awal dan akan disempurnakan pada **PHASE 4 — Report Engine** dan **PHASE 5 — Workflow & Authorization**.
- Petunjuk teknis pembuatan sheet dan nilai awal sequence tersedia di `docs/DATABASE_SETUP.md`.
