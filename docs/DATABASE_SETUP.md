# Panduan Setup Database — SIGAP SARPRAS SMADA

Dokumen ini adalah panduan operasional (manual, dilakukan sekali oleh pengelola sistem) untuk menyiapkan Google Spreadsheet sebagai database SIGAP SARPRAS beserta konfigurasi Google Apps Script yang menyertainya.

**Penting:** Google Spreadsheet-nya sendiri (file barunya) tetap wajib dibuat **manual** oleh pengelola sistem — tidak ada source code yang membuat *Spreadsheet baru*. Namun setelah spreadsheet kosong tersebut ada dan `SPREADSHEET_ID` sudah diset, pembuatan **sheet, header, dan baris sequence awal di dalamnya** dapat diotomasi melalui `apps-script/tools/SetupDatabase.gs` — lihat "Workflow yang Direkomendasikan" di bawah.

Skema lengkap tiap sheet (deskripsi kolom) ada di [`docs/DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md). Dokumen ini berfokus pada **langkah setup**-nya.

---

## Workflow yang Direkomendasikan

1. Buat Google Spreadsheet kosong (bagian 1 di bawah).
2. Buat/buka Apps Script project yang terikat ke spreadsheet tersebut (Extensions > Apps Script).
3. Set `SPREADSHEET_ID` pada Script Properties (bagian 3 di bawah).
4. Upload/copy seluruh source code `apps-script/` (termasuk `core/`, `users/`, `master-data/`, `tests/`, dan `tools/`) ke project Apps Script tersebut.
5. Jalankan `setupDatabase()` (dari `apps-script/tools/SetupDatabase.gs`) — membuat seluruh 12 sheet, menulis header sesuai `docs/DATABASE_SCHEMA.md`, dan menginisialisasi 9 baris sequence (`last_value = 0`) secara otomatis. Aman dijalankan berulang kali (lihat bagian "Setup Otomatis via SetupDatabase.gs" di bawah).
6. Jalankan `verifyDatabaseSetup()` (file yang sama) — memverifikasi tanpa mengubah apa pun, menghasilkan laporan PASS/FAIL per sheet dan per sequence.
7. Jalankan `runCoreSmokeTest()` (`apps-script/tests/CoreSmokeTest.gs`).
8. Jalankan `runMasterDataSmokeTest()` (`apps-script/tests/MasterDataSmokeTest.gs`).

> **Peringatan:** `SetupDatabase.gs` aman dijalankan ulang kapan saja (idempotent — tidak membuat sheet/sequence duplikat, tidak mereset sequence yang sudah punya nilai), **tetapi tidak memperbaiki schema mismatch secara otomatis**. Jika suatu sheet sudah ada dengan header yang **berbeda** dari `docs/DATABASE_SCHEMA.md`, `setupDatabase()` akan berhenti dan melempar error `SCHEMA_MISMATCH` yang menyebutkan sheet, header yang diharapkan, dan header yang sebenarnya ditemukan — perbaikan header tersebut wajib dilakukan **manual** oleh Anda, tidak ada perbaikan/migrasi otomatis.

Bagian-bagian di bawah ini (1–7) tetap didokumentasikan sebagai **referensi manual** — berguna untuk memahami apa yang sebenarnya dilakukan `setupDatabase()`, atau sebagai jalan alternatif jika suatu saat perlu menyiapkan sheet secara manual tanpa menjalankan script.

---

## 1. Membuat Google Spreadsheet Database

1. Buka [Google Sheets](https://sheets.google.com) dengan akun Google yang akan mengelola SIGAP SARPRAS.
2. Buat spreadsheet baru (Blank spreadsheet).
3. Beri nama spreadsheet yang jelas, mis. `SIGAP SARPRAS SMADA - Database (Production)`. Jika membutuhkan environment terpisah (development/staging), buat spreadsheet terpisah dengan nama yang membedakan environment-nya.
4. Hapus sheet default (`Sheet1`) setelah seluruh sheet pada bagian 4 dibuat, atau biarkan sebagai sheet tidak terpakai — tidak memengaruhi sistem karena akses selalu berdasarkan nama sheet, bukan urutan/posisi.

## 2. Mendapatkan Spreadsheet ID

Spreadsheet ID adalah bagian dari URL spreadsheet, terletak di antara `/d/` dan `/edit`:

```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_ADA_DI_SINI/edit
```

Contoh: jika URL-nya adalah
`https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit#gid=0`,
maka Spreadsheet ID-nya adalah `1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890`.

Salin nilai ini — akan digunakan pada langkah berikutnya.

## 3. Menyimpan Spreadsheet ID pada Script Properties

Spreadsheet ID **tidak boleh** dituliskan langsung di source code (lihat `core/Config.gs`). Nilainya wajib disimpan sebagai Script Property dengan key `SPREADSHEET_ID`:

1. Buka project Apps Script yang berisi source code `apps-script/` SIGAP SARPRAS (Extensions > Apps Script dari spreadsheet, atau project Apps Script yang sudah ada bila menggunakan `clasp`).
2. Di editor Apps Script, buka **Project Settings** (ikon gerigi di panel kiri).
3. Pada bagian **Script Properties**, klik **Add script property**.
4. Isi:
   - **Property**: `SPREADSHEET_ID`
   - **Value**: Spreadsheet ID yang didapat pada langkah 2.
5. Klik **Save script properties**.

Setelah ini, `Config.getSpreadsheetId()` dan `Config.getSpreadsheet()` akan dapat membaca dan membuka spreadsheet database dengan benar. Jika key ini belum diset, seluruh operasi yang menyentuh database akan gagal dengan pesan error yang eksplisit (bukan gagal senyap).

## 4. Daftar Seluruh Sheet yang Wajib Dibuat

*(Otomatis dilakukan oleh `setupDatabase()` — bagian ini referensi manual.)*

Buat sheet-sheet berikut pada spreadsheet database (nama sheet **harus persis sama**, termasuk huruf besar/kecil dan garis bawah, karena `DatabaseService` mencari sheet berdasarkan nama):

| Kelompok | Nama Sheet |
|---|---|
| Data Master | `01_users` |
| Data Master | `02_locations` |
| Data Master | `03_categories` |
| Data Master | `04_facilities` |
| Data Master | `05_owners` |
| Pelaporan | `10_reports` |
| Pelaporan | `11_report_photos` |
| Pelaporan | `12_report_history` |
| Pelaporan | `13_report_comments` |
| Audit | `20_audit_logs` |
| Sistem | `90_settings` |
| Sistem | `91_sequences` |

Cara membuat sheet: klik ikon **+** di kiri bawah spreadsheet, lalu ganti nama sheet (klik dua kali pada tab nama sheet) sesuai tabel di atas.

## 5. Header Kolom Setiap Sheet

*(Otomatis dilakukan oleh `setupDatabase()` — bagian ini referensi manual.)*

Header wajib ditulis persis sesuai nama kolom pada [`docs/DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) — `DatabaseService` memetakan data berdasarkan nama kolom pada baris pertama (header), bukan posisi kolom. Isikan baris pertama (row 1) setiap sheet dengan header berikut, satu nama kolom per sel:

**`01_users`**
```
user_id  email  full_name  role  student_id  class_name  owner_id  is_active  created_at  updated_at
```

**`02_locations`**
```
location_id  parent_id  location_name  location_type  location_path  is_active  created_at  updated_at
```

**`03_categories`**
```
category_id  category_name  description  is_active  created_at  updated_at
```

**`04_facilities`**
```
facility_id  category_id  facility_name  is_active  created_at  updated_at
```

**`05_owners`**
```
owner_id  owner_name  description  is_active  created_at  updated_at
```

**`10_reports`**
```
report_id  report_number  reporter_id  location_id  category_id  facility_id  condition  description  impact_level  safety_risk  system_priority  priority  priority_override_reason  status  owner_id  duplicate_of_report_id  created_at  updated_at  verified_at  assigned_at  started_at  completed_at  closed_at  is_active
```

**`11_report_photos`**
```
photo_id  report_id  file_url  uploaded_by  caption  created_at
```

**`12_report_history`**
```
history_id  report_id  previous_status  new_status  changed_by  notes  created_at
```

**`13_report_comments`**
```
comment_id  report_id  author_id  comment_text  is_internal  created_at
```

**`20_audit_logs`**
```
log_id  actor_id  action  entity_type  entity_id  details  created_at
```

**`90_settings`**
```
setting_key  setting_value  description  updated_at
```

**`91_sequences`**
```
sequence_key  last_value  updated_at
```

> Catatan `10_reports`, `11_report_photos`, `12_report_history`, `13_report_comments`, `20_audit_logs`, `90_settings`: sheet-sheet ini disiapkan sesuai `docs/DATABASE_SCHEMA.md` untuk PHASE 4/5 (Report Engine, Workflow & Authorization) yang belum diimplementasikan. Membuat header-nya sekarang bersifat opsional tetapi disarankan agar struktur database lengkap sejak awal.

## 6. Inisialisasi Sheet `91_sequences`

*(Otomatis dilakukan oleh `setupDatabase()` — bagian ini referensi manual.)*

`SequenceService` **tidak membuat baris sequence secara manual** — baris baru otomatis dibuat oleh `getNextSequence()` saat sequence tersebut pertama kali dipakai, dimulai dari nilai `1`. Namun, agar counter yang sudah dikenal sistem eksplisit terlihat sejak awal (dan memudahkan audit), disarankan menambahkan baris awal berikut secara manual dengan `last_value = 0`:

| `sequence_key` | `last_value` | `updated_at` |
|---|---|---|
| `REPORT` | `0` | *(boleh dikosongkan saat inisialisasi)* |
| `HISTORY` | `0` | *(boleh dikosongkan saat inisialisasi)* |
| `AUDIT` | `0` | *(boleh dikosongkan saat inisialisasi)* |

Ketiga sequence di atas bersifat **monoton dan tidak pernah direset** (termasuk `REPORT` — tidak ada varian per tahun seperti `REPORT_2026`; tahun pada `report_number` hanya tampilan, lihat `SequenceService.generateReportNumber()`).

### Sequence Tambahan untuk Master Data (PHASE 3)

Domain Master Data menggunakan sequence berikut melalui `SequenceService.generateEntityId()`:

| `sequence_key` | `last_value` | Digunakan oleh | Prefix ID |
|---|---|---|---|
| `USER` | `0` | `UserService.createUser()` | `USR` |
| `LOCATION` | `0` | `LocationService.createLocation()` | `LOC` |
| `CATEGORY` | `0` | `CategoryService.createCategory()` | `CAT` |
| `FACILITY` | `0` | `FacilityService.createFacility()` | `FAC` |
| `OWNER` | `0` | `OwnerService.createOwner()` | `OWN` |

Baris-baris ini juga akan dibuat otomatis saat pertama kali dipakai bila belum ada secara manual — menambahkannya di awal hanya untuk kejelasan operasional.

### Sequence Khusus Pengujian

| `sequence_key` | `last_value` | Digunakan oleh |
|---|---|---|
| `CORE_TEST` | `0` | `apps-script/tests/CoreSmokeTest.gs` (pengujian manual Core Backend) |

`CORE_TEST` **hanya untuk smoke test**, tidak boleh dipakai oleh domain service produksi mana pun. Baris ini aman untuk di-reset (dihapus lalu dibuat ulang dari 0) kapan saja tanpa memengaruhi data produksi, karena nilainya tidak pernah dirujuk oleh entitas bisnis nyata.

Jika ke depannya sequence tambahan diperlukan (mis. domain baru), tambahkan konstantanya secara konsisten pada `CONFIG.SEQUENCES` (`core/Config.gs`) dan dokumentasikan baris awalnya di tabel pada dokumen ini.

## 7. Setup Otomatis via SetupDatabase.gs

`apps-script/tools/SetupDatabase.gs` adalah **one-time infrastructure utility** (bukan domain service, bukan bagian alur produksi) yang mengotomasi bagian 4–6 di atas. Dua fungsi yang tersedia:

### `setupDatabase()`

Membuat sheet yang belum ada beserta headernya, menulis header pada sheet yang sudah ada tapi masih kosong, dan menginisialisasi baris sequence yang belum ada (`last_value = 0`). **Idempotent** — aman dijalankan berulang kali:

- Sheet yang sudah ada dan headernya sudah sesuai **tidak disentuh**.
- Sequence yang sudah ada nilainya **tidak pernah direset/diubah**.
- Tidak pernah membuat sheet atau baris sequence duplikat.
- **Tidak ada operasi destruktif** apa pun (tidak ada `deleteSheet`, `clear`, `clearContents`, atau penimpaan data yang sudah ada).

Jika suatu sheet sudah ada dengan header yang **tidak sesuai** `docs/DATABASE_SCHEMA.md`, fungsi ini **tidak memperbaikinya secara otomatis** — ia berhenti dan melempar error `SCHEMA_MISMATCH` yang menyebutkan nama sheet, header yang diharapkan, dan header yang sebenarnya ditemukan. Perbaikan wajib dilakukan manual oleh Anda di spreadsheet, lalu jalankan ulang `setupDatabase()`.

Cara menjalankan: di editor Apps Script, pilih fungsi `setupDatabase` pada dropdown lalu klik **Run**. Lihat hasilnya di **View > Logs** (atau `Ctrl+Enter`) — akan tercetak ringkasan sheet/sequence yang dibuat vs. yang sudah terverifikasi, dan hasil yang sama juga dikembalikan sebagai objek (`success`, `status`, `spreadsheet_id`, `sheets_created`, `sheets_verified`, `sequences_created`, `sequences_verified`).

### `verifyDatabaseSetup()`

Read-only — **tidak mengubah apa pun**. Memeriksa keberadaan dan kesesuaian header seluruh 12 sheet serta keberadaan seluruh 9 baris sequence, lalu mencetak laporan PASS/FAIL per item ke Logger (format tabel `NAMA_SHEET  PASS/FAIL`). Gunakan ini untuk memeriksa status database kapan saja tanpa risiko mengubah apa pun — termasuk sebagai pemeriksaan rutin setelah setup awal.

## 8. Verifikasi Akhir dengan Smoke Test

Setelah `setupDatabase()` dan `verifyDatabaseSetup()` menunjukkan hasil PASS, jalankan kedua smoke test berikut secara manual dari editor Apps Script untuk memverifikasi domain Core Backend dan Master Data:

1. `runCoreSmokeTest()` (`apps-script/tests/CoreSmokeTest.gs`) — memverifikasi `getSpreadsheetId()`, `getSpreadsheet()`, akses sheet via `DatabaseService`, dan `SequenceService` (increment, `generateEntityId()`, `generateReportNumber()`).
2. `runMasterDataSmokeTest()` (`apps-script/tests/MasterDataSmokeTest.gs`) — memverifikasi create/get/update/list/deactivate, validasi gagal, deteksi duplikasi, hierarki lokasi, dan validasi facility-category pada data bertanda `TEST_`.

Lihat hasil eksekusi pada **View > Logs** (atau `Ctrl+Enter` di editor) setelah menjalankan masing-masing fungsi.
