# Panduan Deploy Manual ke Google Apps Script (TANPA clasp)

Panduan ini untuk operator yang ingin menjalankan SIGAP SARPRAS MVP di
sebuah project Google Apps Script **baru**, dibuat langsung dari browser
(Windows/iPad/dsb.) — **tanpa `clasp`**, tanpa command line sama sekali.

Sumber seluruh kode: branch `main` repository ini, direktori `apps-script/`.
Cara tercepat mengambil source: buka
[`apps-script/deployment/MVP_DEPLOYMENT_BUNDLE.txt`](../apps-script/deployment/MVP_DEPLOYMENT_BUNDLE.txt)
— satu file berisi seluruh source runtime, dipisahkan penanda
`===== FILE: <nama> =====` per file, dalam urutan pembuatan yang sama
seperti tabel di bawah. Salin isi setiap bagian ke file Apps Script dengan
nama yang sama persis.

**Cakupan panduan ini HANYA MVP Web App (PHASE 4.5 — Report Engine test
harness).** Domain `audit/`, Photo/Comment Engine, dan frontend final
PHASE 7 belum ada di scope ini (lihat `docs/DEVELOPMENT_ROADMAP.md`).

---

## 0. Prasyarat — jangan lewati

- **Spreadsheet database SUDAH ADA dan sudah punya sheet + header sesuai
  `docs/DATABASE_SCHEMA.md`** (minimal: `01_users`, `02_locations`,
  `03_categories`, `04_facilities`, `05_owners`, `10_reports`,
  `12_report_history`, `91_sequences`). Panduan ini **TIDAK** membuat atau
  mengubah struktur spreadsheet apa pun, **TIDAK** menjalankan
  `setupDatabase()`, dan **TIDAK** menyentuh `tools/InspectDatabase.gs` /
  `tools/DatabaseInspectorStandalone.gs` / `tools/SetupDatabase.gs`. Jika
  Anda belum yakin struktur spreadsheet sudah benar, baca
  `docs/DATABASE_SETUP.md` dan tangani itu **secara terpisah** — di luar
  langkah-langkah panduan ini.
- Minimal satu baris di `01_users` dengan `email` **sama persis** dengan
  akun Google yang akan Anda pakai untuk membuka Web App, `is_active =
  TRUE`, dan `role` salah satu dari `SISWA/GURU/STAF/VERIFIKATOR/OWNER/
  ADMIN`. Tanpa ini, halaman akan selalu gagal menampilkan identitas
  pengguna (lihat bagian Testing).
- Anda tahu **Spreadsheet ID** database (bagian URL di antara
  `/d/` dan `/edit`).

## 1. Kenapa urutan pembuatan file penting

Google Apps Script menggabungkan seluruh file `.gs` dalam satu project
menjadi satu konteks eksekusi global, dan kode di level atas (`var ...`
di luar fungsi) dijalankan mengikuti urutan file yang tampil di panel
editor — **bukan** urutan Anda membuatnya. Karena project baru ini dibuat
manual (tanpa `clasp` yang bisa memaksa urutan lewat konfigurasi), urutan
file di panel editor sangat menentukan.

Sebagian besar file di sini aman dari isu ini (konstanta top-level-nya
hanya angka/string literal). Satu file, `api/AuthContext.gs`, sempat
memiliki konstanta top-level yang membaca `CONFIG.ROLES` — ini SUDAH
diperbaiki di source repository (lihat commit yang menyertai panduan ini)
menjadi fungsi `getWorkflowAllowedRoles_()` yang dievaluasi saat dipanggil,
bukan saat file dimuat, sehingga tidak lagi bergantung urutan file. Source
pada bundle sudah termasuk perbaikan ini.

**Tetap ikuti urutan pembuatan pada tabel di bagian 2** sebagai praktik
aman, dan setelah semua file dibuat, **cek panel daftar file di editor
Apps Script** — jika editor mengurutkan ulang secara alfabetis, itu tidak
masalah untuk source saat ini (karena perbaikan di atas), tapi tetap
hindari menambahkan kode baru dengan konstanta top-level yang bergantung
pada file lain.

## 2. Daftar file, urutan, nama persis, dan dependency

Buat file dengan **File > New > Script** (untuk `.gs`) atau **File > New >
HTML** (khusus `Index.html`) di editor Apps Script, satu per satu, sesuai
urutan berikut. Beri nama **persis** seperti kolom "Nama file di Apps
Script" (Apps Script mengizinkan `/` pada nama file untuk pengelompokan
tampilan folder di editor — gunakan itu agar strukturnya tetap mudah
dikenali seperti repository).

| # | Nama file di Apps Script | Sumber di bundle | Dependency (harus sudah ada) |
|---|---|---|---|
| 1 | `core/Config` | `core/Config.gs` | — |
| 2 | `core/DatabaseService` | `core/DatabaseService.gs` | `core/Config` |
| 3 | `core/UtilityService` | `core/UtilityService.gs` | `core/Config` |
| 4 | `core/SequenceService` | `core/SequenceService.gs` | `core/Config`, `core/DatabaseService` |
| 5 | `users/UserService` | `users/UserService.gs` | `core/Config`, `core/DatabaseService`, `core/SequenceService`, `core/UtilityService` |
| 6 | `master-data/LocationService` | `master-data/LocationService.gs` | `core/Config`, `core/DatabaseService`, `core/SequenceService`, `core/UtilityService` |
| 7 | `master-data/CategoryService` | `master-data/CategoryService.gs` | sama seperti di atas (baca sheet `04_facilities` langsung untuk cek referensi, tanpa memanggil FacilityService) |
| 8 | `master-data/FacilityService` | `master-data/FacilityService.gs` | sama seperti di atas (baca sheet `03_categories` langsung, tanpa memanggil CategoryService) |
| 9 | `master-data/OwnerService` | `master-data/OwnerService.gs` | `core/Config`, `core/DatabaseService`, `core/SequenceService`, `core/UtilityService` |
| 10 | `reports/ReportHistoryService` | `reports/ReportHistoryService.gs` | `core/Config`, `core/DatabaseService`, `core/SequenceService`, `core/UtilityService` |
| 11 | `reports/ReportService` | `reports/ReportService.gs` | # 1–4, 10 (`ReportHistoryService.reportHistoryRecord_`), plus baca `01_users`/`02_locations`/`03_categories`/`04_facilities`/`05_owners` langsung untuk validasi referensi |
| 12 | `reports/ReportWorkflowService` | `reports/ReportWorkflowService.gs` | `core/Config`, `core/DatabaseService`, `core/UtilityService`, `reports/ReportService` (`getReportById`, `reportValidateActiveUser_`, `reportValidateStatusValue_`), `reports/ReportHistoryService` |
| 13 | `api/AuthContext` | `api/AuthContext.gs` | `core/Config` (`CONFIG.ROLES`), `core/UtilityService` (`isEmpty`), `users/UserService` (`getUserByEmail`) |
| 14 | `api/ApiUtil` | `api/ApiUtil.gs` | `core/UtilityService` |
| 15 | `api/MasterDataApi` | `api/MasterDataApi.gs` | `api/AuthContext`, `api/ApiUtil`, `master-data/LocationService`, `master-data/CategoryService` |
| 16 | `api/ReportApi` | `api/ReportApi.gs` | `core/Config`, `api/AuthContext`, `api/ApiUtil`, `reports/ReportService`, `reports/ReportWorkflowService`, `reports/ReportHistoryService` |
| 17 | `api/App` | `api/App.gs` | `api/Index` (HTML, lihat # 18) — satu-satunya `doGet()` |
| 18 | `api/Index` | `api/Index.html` | dipanggil dari `api/App`; memanggil `apiGetCurrentUser`, `apiListLocations`, `apiListCategories`, `apiGetReportStatusOptions`, `apiListReports`, `apiCreateReport`, `apiChangeReportStatus` lewat `google.script.run` |

**Tidak perlu file lain.** File berikut SENGAJA tidak masuk MVP ini —
jangan dibuat di project baru:
`tests/CoreSmokeTest.gs`, `tests/MasterDataSmokeTest.gs`,
`tests/ReportEngineSmokeTest.gs`, `tests/SequenceCompatibilitySmokeTest.gs`,
`tests/InspectDatabaseSmokeTest.gs`, `tools/InspectDatabase.gs`,
`tools/DatabaseInspectorStandalone.gs`, `tools/SetupDatabase.gs`, dan
seluruh `README.md`.

### Cara mengisi tiap file

1. Buka `apps-script/deployment/MVP_DEPLOYMENT_BUNDLE.txt`.
2. Cari penanda `===== FILE: <path-repo> =====` sesuai kolom "Sumber di
   bundle" pada tabel di atas.
3. Salin **seluruh isi** di bawah penanda tersebut sampai sebelum penanda
   `===== FILE:` berikutnya.
4. Tempel ke file Apps Script dengan nama pada kolom "Nama file di Apps
   Script" (hapus isi bawaan `function myFunction() {}` yang otomatis
   dibuat Apps Script pada file baru).

### Manifest (`appsscript.json`)

File ini bukan dibuat lewat "New > Script", melainkan lewat menu editor
Apps Script: **Project Settings (ikon gerigi)** → centang **"Show
'appsscript.json' manifest file in editor"** → file `appsscript.json`
akan muncul di panel file. Buka, ganti seluruh isinya dengan bagian
`===== FILE: appsscript.json =====` dari bundle. Isinya menentukan:
- `webapp.executeAs: "USER_ACCESSING"` — **WAJIB**, agar
  `Session.getActiveUser()` di `AuthContext.gs` bisa mengenali pengguna
  yang benar-benar mengakses (bukan pemilik script).
- `webapp.access: "DOMAIN"` — hanya akun dalam Google Workspace yang sama
  yang bisa mengakses. Sesuaikan dengan kebijakan Anda bila perlu (lihat
  catatan di `apps-script/api/README.md` — `"ANYONE_ANONYMOUS"` TIDAK
  disarankan karena sesi anonim tidak bisa diidentifikasi).

## 3. Script Properties (Spreadsheet ID)

Aplikasi TIDAK menyimpan Spreadsheet ID di kode — wajib diset lewat Script
Properties:

1. Di editor Apps Script: **Project Settings (ikon gerigi)**.
2. Scroll ke bagian **Script Properties**.
3. **Add script property**:
   - Property: `SPREADSHEET_ID`
   - Value: ID spreadsheet database Anda (dari URL, bagian antara `/d/`
     dan `/edit`).
4. **Save script properties**.

Tanpa langkah ini, setiap pemanggilan API akan gagal dengan pesan error
dari `Config.getSpreadsheetId()` yang secara eksplisit menyebutkan
`SPREADSHEET_ID` belum diset.

## 4. Deploy sebagai Web App

1. Simpan seluruh file (Ctrl+S / Cmd+S atau ikon simpan).
2. Klik **Deploy > New deployment**.
3. Klik ikon gerigi di samping "Select type" → pilih **Web app**.
4. Isi:
   - Description: bebas, mis. "MVP manual deploy".
   - Execute as: **User accessing the web app** (harus sama dengan
     `webapp.executeAs` di manifest).
   - Who has access: sesuai `webapp.access` di manifest (mis. hanya akun
     dalam organisasi Anda).
5. Klik **Deploy**.
6. Google akan meminta otorisasi (Authorize access) — pilih akun Google
   Anda, terima peringatan "unverified app" (wajar untuk script pribadi/
   internal yang belum diverifikasi Google), izinkan akses ke Spreadsheet.
7. Salin **Web app URL** yang muncul — inilah URL untuk membuka MVP dari
   browser/iPad/Windows.

Setiap kali Anda mengubah isi file setelah deployment pertama, ulangi
lewat **Deploy > Manage deployments** → pilih deployment yang ada → ikon
pensil (Edit) → ganti **Version** ke **New version** → **Deploy**, supaya
URL yang sama memuat kode terbaru.

## 5. Langkah testing pertama

1. Buka Web App URL dari langkah 4 di browser (disarankan mencoba dari
   akun Google yang emailnya sudah terdaftar di `01_users` sebagai
   langkah pertama).
2. Halaman **"SIGAP SARPRAS — Report Engine (Test Harness, PHASE 4.5)"**
   akan tampil dengan baris **"Memuat identitas pengguna..."**, lalu
   berubah menjadi **"Masuk sebagai: <nama> (<email>) — peran: <role>"**.
   - Jika muncul pesan error "Email ... belum terdaftar sebagai pengguna
     SIGAP SARPRAS" → tambahkan baris pengguna tersebut ke `01_users`
     (manual lewat spreadsheet, `is_active = TRUE`) lalu muat ulang
     halaman. (Menambah baris data BUKAN mengubah schema — aman.)
3. Dropdown **Lokasi** dan **Kategori** pada form "Buat Laporan Baru"
   harus terisi data dari `02_locations`/`03_categories` yang aktif. Jika
   kosong, pastikan ada baris dengan `is_active = TRUE` di sheet tersebut.
4. Isi form (Lokasi, Kategori, Deskripsi wajib) dan klik **Kirim
   Laporan**. Berhasil jika muncul pesan hijau "Laporan berhasil dibuat:
   SRP-YYYY-000001" dan baris baru muncul di tabel **Daftar Laporan**.
5. Jika akun Anda berperan `VERIFIKATOR`/`OWNER`/`ADMIN`, kolom "Aksi"
   pada tabel laporan akan menampilkan dropdown status + tombol **Ubah
   Status**. Coba ubah status laporan yang baru dibuat dari `SUBMITTED`
   ke `VERIFIED` — berhasil jika status di tabel berubah tanpa reload
   manual.
6. Jika langkah 2–5 semuanya berhasil, MVP sudah berjalan penuh di project
   Apps Script baru ini.

### Troubleshooting singkat

| Gejala | Kemungkinan penyebab |
|---|---|
| Error "Script Property SPREADSHEET_ID belum diset" | Ulangi bagian 3. |
| Error "Sheet ... tidak ditemukan pada spreadsheet" | Spreadsheet ID benar tapi sheet dengan nama itu belum ada — lihat Prasyarat, bagian 0 (di luar scope panduan ini untuk membuatnya). |
| "Email ... belum terdaftar" terus-menerus meski sudah ditambahkan | Pastikan penulisan email di `01_users` sama persis (huruf besar/kecil tidak masalah, tapi typo tetap gagal) dan `is_active` benar `TRUE` (boolean), bukan teks `"TRUE"`. |
| Halaman blank / error skrip saat dibuka | Buka **Executions** (ikon jam di sidebar editor) untuk melihat stack trace; cek juga apakah semua 18 file pada tabel bagian 2 sudah dibuat dan tidak ada nama file yang typo (nama file dipakai `HtmlService.createHtmlOutputFromFile('api/Index')` di `api/App.gs` — harus persis `api/Index`). |
| "Peran ... tidak diizinkan melakukan aksi ini" saat ubah status | Wajar — hanya `VERIFIKATOR`/`OWNER`/`ADMIN` yang boleh mengubah status (lihat `apps-script/api/AuthContext.gs`). |
