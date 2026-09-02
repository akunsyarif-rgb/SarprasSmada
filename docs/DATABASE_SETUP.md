# Panduan Setup Database — SIGAP SARPRAS SMADA

Dokumen ini adalah panduan operasional (manual, dilakukan sekali oleh pengelola sistem) untuk menyiapkan Google Spreadsheet sebagai database SIGAP SARPRAS beserta konfigurasi Google Apps Script yang menyertainya.

**Penting:** Google Spreadsheet-nya sendiri (file barunya) tetap wajib dibuat **manual** oleh pengelola sistem — tidak ada source code yang membuat *Spreadsheet baru*. Namun setelah spreadsheet kosong tersebut ada dan `SPREADSHEET_ID` sudah diset, pembuatan **sheet, header, dan baris sequence awal di dalamnya** dapat diotomasi melalui `apps-script/tools/SetupDatabase.gs` — lihat "Workflow yang Direkomendasikan" di bawah.

Skema lengkap tiap sheet (deskripsi kolom) ada di [`docs/DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md). Dokumen ini berfokus pada **langkah setup**-nya.

---

## ⚠️ Punya Spreadsheet Lama? Baca Ini Dulu

**Jangan asumsikan database Anda kosong.** SIGAP SARPRAS pernah dikembangkan langsung di atas Google Apps Script + Google Spreadsheet **sebelum** repository ini dibuat. Jika Anda punya spreadsheet SIGAP SARPRAS dari sebelumnya, kemungkinan besar sudah berisi sheet, data, dan/atau sequence.

**Jangan langsung menjalankan `setupDatabase()` terhadap spreadsheet lama.** Ikuti urutan berikut:

```
DISCOVER → READ-ONLY INSPECTION → COMPARE → MIGRATION PLAN (bila perlu) → SAFE UPDATE
```

1. **DISCOVER + INSPECT**: set `SPREADSHEET_ID` pada Script Properties ke spreadsheet **lama** Anda (bagian 3 di bawah — langkah ini sendiri tidak mengubah apa pun di spreadsheet, hanya konfigurasi Apps Script). Jalankan `inspectExistingDatabase()` dari `apps-script/tools/InspectDatabase.gs` — **read-only sepenuhnya**, tidak pernah menulis. Lihat bagian "Inspeksi Database Lama via InspectDatabase.gs" di bawah untuk detail lengkap.
2. **COMPARE**: baca hasilnya — `STATUS: READY` / `PARTIAL` / `MISMATCH_FOUND`, plus rincian sheet yang cocok, hilang, asing, dan mismatch kolom apa saja.
3. **MIGRATION PLAN (bila perlu)**: jika `STATUS` bukan `READY`, jangan jalankan `setupDatabase()` dulu — bagikan hasil inspeksi (JSON dari `inspectDatabaseAsJson()`, atau log dari `inspectExistingDatabase()`) untuk direview dan disusun rencana penyesuaian yang aman (additive-only, tidak menghapus/menimpa data).
4. **SAFE UPDATE**: hanya setelah rencana disetujui, baru lanjutkan ke `setupDatabase()` (yang tetap tidak akan menimpa sheet dengan header yang sudah tidak cocok — lihat bagian setup di bawah) atau penyesuaian manual terarah.

Jika Anda memang membuat spreadsheet **baru** yang benar-benar kosong (bukan melanjutkan yang lama), langsung ke "Workflow Database Baru" di bawah — langkah inspeksi tetap aman dijalankan meski hasilnya `PARTIAL` untuk spreadsheet kosong (bukan error).

---

## Workflow Database Baru (Kosong)

1. Buat Google Spreadsheet kosong (bagian 1 di bawah).
2. Buat/buka Apps Script project yang terikat ke spreadsheet tersebut (Extensions > Apps Script).
3. Set `SPREADSHEET_ID` pada Script Properties (bagian 3 di bawah).
4. Upload/copy seluruh source code `apps-script/` (termasuk `core/`, `users/`, `master-data/`, `tests/`, dan `tools/`) ke project Apps Script tersebut.
5. Jalankan `setupDatabase()` (dari `apps-script/tools/SetupDatabase.gs`) — membuat seluruh 12 sheet, menulis header sesuai `docs/DATABASE_SCHEMA.md`, dan menginisialisasi 9 baris sequence (`current_value = 0`) secara otomatis. Aman dijalankan berulang kali (lihat bagian "Setup Otomatis via SetupDatabase.gs" di bawah).
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
user_id  email  full_name  role  student_id  class_name  owner_id  password_hash  password_salt  is_active  created_at  updated_at
```

> **Perubahan Skema — Autentikasi:** `password_hash`/`password_salt` adalah
> kolom BARU (lihat `docs/DATABASE_SCHEMA.md`). Jika sheet `01_users` Anda
> sudah ada dari sebelumnya (spreadsheet lama), tambahkan kedua kolom ini
> secara manual di akhir header yang sudah ada — TIDAK perlu mengisi nilainya
> untuk baris yang sudah ada (boleh kosong; lihat bagian 10 di bawah untuk
> cara memberi password pada pengguna). `setupDatabase()` tidak melakukan
> migrasi ini secara otomatis untuk sheet yang sudah ada dengan header lama.

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
photo_id  report_id  photo_type  drive_file_id  drive_url  file_name  mime_type  file_size  uploaded_by  uploaded_at  is_active
```

**`12_report_history`**
```
history_id  report_id  previous_status  new_status  action  notes  performed_by  created_at
```

**`13_report_comments`**
```
comment_id  report_id  comment_type  message  created_by  is_internal  created_at  is_active
```

**`20_audit_logs`**
```
audit_id  user_id  action  entity_type  entity_id  metadata  created_at
```

**`90_settings`**
```
setting_key  setting_value  description  updated_at
```

**`91_sequences`**
```
sequence_name  current_value  updated_at
```

> **PHASE 3.75:** header 5 sheet di atas (`11_report_photos`, `12_report_history`, `13_report_comments`, `20_audit_logs`, `91_sequences`) mengikuti struktur database produksi SIGAP SARPRAS yang sudah berjalan nyata — lihat "Reconciliation Notes" pada `docs/DATABASE_SCHEMA.md` untuk rincian kolom legacy-only vs. repo-only yang direkonsiliasi.

> Catatan `10_reports`, `11_report_photos`, `12_report_history`, `13_report_comments`, `20_audit_logs`, `90_settings`: sheet-sheet ini disiapkan sesuai `docs/DATABASE_SCHEMA.md` untuk PHASE 4/5 (Report Engine, Workflow & Authorization) yang belum diimplementasikan. Membuat header-nya sekarang bersifat opsional tetapi disarankan agar struktur database lengkap sejak awal.

## 6. Inisialisasi Sheet `91_sequences`

*(Otomatis dilakukan oleh `setupDatabase()` — bagian ini referensi manual.)*

`SequenceService` **tidak membuat baris sequence secara manual** — baris baru otomatis dibuat oleh `getNextSequence()` saat sequence tersebut pertama kali dipakai, dimulai dari nilai `1`. Namun, agar counter yang sudah dikenal sistem eksplisit terlihat sejak awal (dan memudahkan audit), disarankan menambahkan baris awal berikut secara manual dengan `current_value = 0`:

| `sequence_name` | `current_value` | `updated_at` |
|---|---|---|
| `REPORT` | `0` | *(boleh dikosongkan saat inisialisasi)* |
| `HISTORY` | `0` | *(boleh dikosongkan saat inisialisasi)* |
| `AUDIT` | `0` | *(boleh dikosongkan saat inisialisasi)* |

Ketiga sequence di atas bersifat **monoton dan tidak pernah direset** (termasuk `REPORT` — tidak ada varian per tahun seperti `REPORT_2026`; tahun pada `report_number` hanya tampilan, lihat `SequenceService.generateReportNumber()`).

> **PHASE 3.75:** kolom `sequence_name`/`current_value` di atas adalah nama canonical — mengikuti database produksi nyata. `core/SequenceService.gs` tetap mengenali alias lama (`sequence_key`/`last_value`) lewat compatibility layer bila suatu sheet dibuat memakainya, tapi tidak perlu Anda tulis manual lagi mulai sekarang.

### Sequence Tambahan untuk Master Data (PHASE 3)

Domain Master Data menggunakan sequence berikut melalui `SequenceService.generateEntityId()`:

| `sequence_name` | `current_value` | Digunakan oleh | Prefix ID |
|---|---|---|---|
| `USER` | `0` | `UserService.createUser()` | `USR` |
| `LOCATION` | `0` | `LocationService.createLocation()` | `LOC` |
| `CATEGORY` | `0` | `CategoryService.createCategory()` | `CAT` |
| `FACILITY` | `0` | `FacilityService.createFacility()` | `FAC` |
| `OWNER` | `0` | `OwnerService.createOwner()` | `OWN` |

Baris-baris ini juga akan dibuat otomatis saat pertama kali dipakai bila belum ada secara manual — menambahkannya di awal hanya untuk kejelasan operasional. **Catatan (temuan inspeksi PHASE 3.5):** di database produksi nyata, `Location/Category/Facility/Owner` justru TIDAK memakai sequence sama sekali — ID-nya dibuat dengan skema hex-random terpisah. Baris sequence di atas relevan untuk entitas BARU yang dibuat lewat repository ini ke depan; keputusan final strategi ID master data belum diambil (lihat pembahasan Phase 3.5/3.75 terkait "Master Data ID Strategy").

### Sequence Khusus Pengujian

| `sequence_name` | `current_value` | Digunakan oleh |
|---|---|---|
| `CORE_TEST` | `0` | `apps-script/tests/CoreSmokeTest.gs`, `apps-script/tests/SequenceCompatibilitySmokeTest.gs` (pengujian manual Core Backend) |

`CORE_TEST` **hanya untuk smoke test**, tidak boleh dipakai oleh domain service produksi mana pun. Baris ini aman untuk di-reset (dihapus lalu dibuat ulang dari 0) kapan saja tanpa memengaruhi data produksi, karena nilainya tidak pernah dirujuk oleh entitas bisnis nyata.

Jika ke depannya sequence tambahan diperlukan (mis. domain baru), tambahkan konstantanya secara konsisten pada `CONFIG.SEQUENCES` (`core/Config.gs`) dan dokumentasikan baris awalnya di tabel pada dokumen ini.

## 7. Inspeksi Database Lama via InspectDatabase.gs

`apps-script/tools/InspectDatabase.gs` adalah utility **READ-ONLY sepenuhnya** (tidak ada satu pun method penulisan Spreadsheet yang dipanggil) untuk melakukan **discovery** terhadap spreadsheet yang sudah ada — termasuk spreadsheet lama SIGAP SARPRAS yang mungkin sudah berisi sheet/data/sequence dari sebelum repository ini dibuat. Wajib dijalankan **sebelum** `setupDatabase()` jika Anda tidak yakin kondisi spreadsheet-nya (lihat peringatan di awal dokumen ini).

Dua fungsi yang tersedia:

### `inspectExistingDatabase()`

Mencetak hasil inspeksi ke Logger dalam format human-readable, dipisah jelas menjadi tiga bagian:

```
DATABASE_INSPECTION_RESULT
STATUS: READY | PARTIAL | MISMATCH_FOUND

---------------- EXPECTED SCHEMA ----------------
(12 sheet + header resminya, sesuai docs/DATABASE_SCHEMA.md)

---------------- ACTUAL DATABASE ----------------
(sheet yang benar-benar ditemukan, sheet yang hilang, sheet asing di luar schema,
 masing-masing dengan jumlah baris data, jumlah kolom, dan header — TANPA isi data)

---------------- COMPATIBILITY RESULT ----------------
(per sheet: MATCH / MISMATCH / EMPTY / NOT_FOUND, beserta kolom yang hilang/asing bila ada)
```

Arti `STATUS`:
- **`READY`** — seluruh 12 sheet ada dan headernya cocok 100% dengan `docs/DATABASE_SCHEMA.md`. Aman melanjutkan ke `setupDatabase()` (tidak akan melakukan apa-apa selain memverifikasi) atau langsung ke domain service.
- **`PARTIAL`** — tidak ada konflik struktur, tapi ada sheet yang belum ada/masih kosong (termasuk kasus spreadsheet benar-benar kosong). Aman melanjutkan ke `setupDatabase()` — ia akan melengkapi sheet yang belum ada tanpa menyentuh yang sudah benar.
- **`MISMATCH_FOUND`** — ada sheet yang SUDAH memiliki header, tapi berbeda dari schema resmi (kolom hilang dan/atau kolom asing). **Jangan** jalankan `setupDatabase()` dulu — `setupDatabase()` sendiri akan menolak jalan dan melempar `SCHEMA_MISMATCH` yang sama, tapi tujuan Inspector adalah memberi Anda gambaran lengkap SEMUA sheet bermasalah sekaligus (bukan satu per satu), untuk menyusun rencana migrasi.

### `inspectDatabaseAsJson()`

Logika yang sama persis (`inspectExistingDatabase()` adalah pembungkus tampilan di atasnya), tapi mengembalikan objek terstruktur alih-alih mencetak ke Logger — berguna untuk disalin sebagai JSON dan dikirim untuk dianalisis lebih lanjut. Untuk menyalinnya dari editor Apps Script: jalankan fungsi ini, buka **View > Logs**, atau tambahkan sementara `Logger.log(JSON.stringify(inspectDatabaseAsJson()))` bila butuh bentuk JSON persis.

### Yang TIDAK Ditampilkan (Privasi Data)

Inspector **tidak pernah** membaca/menampilkan isi baris data (data user, data laporan, dsb.). Untuk setiap sheet hanya ditampilkan: nama sheet, jumlah baris data, jumlah kolom, dan header. Untuk `91_sequences`, hanya `sequence_name` dan `current_value` yang dibaca — bukan data sensitif, sekadar angka counter.

### Audit Read-Only InspectDatabase.gs

Kepatuhan "tidak ada operasi tulis" pada `InspectDatabase.gs` diverifikasi melalui audit statis (grep) terhadap source code-nya, dijalankan sebelum setiap commit:

```bash
grep -nE "setValue|setValues|appendRow|insertSheet|deleteSheet|deleteRow|\.clear\(|clearContents|clearFormat|copyTo|moveTo" apps-script/tools/InspectDatabase.gs
```

Hasil yang benar: **tidak ada baris kode** yang cocok (hanya boleh muncul di komentar/dokumentasi yang menjelaskan larangan tersebut, bukan pemanggilan fungsi sungguhan).

### Cara Menjalankan (termasuk dari iPad)

1. Buka project Apps Script yang `SPREADSHEET_ID`-nya sudah diarahkan ke spreadsheet yang ingin diinspeksi (lihat bagian 3) — bisa lewat Safari di iPad, tidak butuh aplikasi tambahan.
2. Pastikan source code `apps-script/tools/InspectDatabase.gs` (dan dependency-nya: `core/Config.gs`, `core/DatabaseService.gs`, `core/UtilityService.gs`, `apps-script/tools/SetupDatabase.gs`) sudah ter-copy ke project tersebut.
3. Di dropdown pemilihan fungsi (bagian atas editor), pilih `inspectExistingDatabase`, lalu klik **Run** (ikon ▷).
4. Google akan meminta otorisasi izin akses spreadsheet pada pemanggilan pertama — ini normal, setujui.
5. Buka **View > Execution log** (atau `Ctrl+Enter`/`Cmd+Enter`) untuk melihat hasilnya.
6. Copy seluruh log tersebut untuk dibagikan/dianalisis lebih lanjut.

## 8. Setup Otomatis via SetupDatabase.gs

`apps-script/tools/SetupDatabase.gs` adalah **one-time infrastructure utility** (bukan domain service, bukan bagian alur produksi) yang mengotomasi bagian 4–6 di atas. Dua fungsi yang tersedia:

### `setupDatabase()`

Membuat sheet yang belum ada beserta headernya, menulis header pada sheet yang sudah ada tapi masih kosong, dan menginisialisasi baris sequence yang belum ada (`current_value = 0`). **Idempotent** — aman dijalankan berulang kali:

- Sheet yang sudah ada dan headernya sudah sesuai **tidak disentuh**.
- Sequence yang sudah ada nilainya **tidak pernah direset/diubah**.
- Tidak pernah membuat sheet atau baris sequence duplikat.
- **Tidak ada operasi destruktif** apa pun (tidak ada `deleteSheet`, `clear`, `clearContents`, atau penimpaan data yang sudah ada).

Jika suatu sheet sudah ada dengan header yang **tidak sesuai** `docs/DATABASE_SCHEMA.md`, fungsi ini **tidak memperbaikinya secara otomatis** — ia berhenti dan melempar error `SCHEMA_MISMATCH` yang menyebutkan nama sheet, header yang diharapkan, dan header yang sebenarnya ditemukan. Perbaikan wajib dilakukan manual oleh Anda di spreadsheet, lalu jalankan ulang `setupDatabase()`.

Cara menjalankan: di editor Apps Script, pilih fungsi `setupDatabase` pada dropdown lalu klik **Run**. Lihat hasilnya di **View > Logs** (atau `Ctrl+Enter`) — akan tercetak ringkasan sheet/sequence yang dibuat vs. yang sudah terverifikasi, dan hasil yang sama juga dikembalikan sebagai objek (`success`, `status`, `spreadsheet_id`, `sheets_created`, `sheets_verified`, `sequences_created`, `sequences_verified`).

### `verifyDatabaseSetup()`

Read-only — **tidak mengubah apa pun**. Memeriksa keberadaan dan kesesuaian header seluruh 12 sheet serta keberadaan seluruh 9 baris sequence, lalu mencetak laporan PASS/FAIL per item ke Logger (format tabel `NAMA_SHEET  PASS/FAIL`). Gunakan ini untuk memeriksa status database kapan saja tanpa risiko mengubah apa pun — termasuk sebagai pemeriksaan rutin setelah setup awal.

## 9. Verifikasi Akhir dengan Smoke Test

Setelah `setupDatabase()` dan `verifyDatabaseSetup()` menunjukkan hasil PASS, jalankan smoke test berikut secara manual dari editor Apps Script untuk memverifikasi domain Core Backend dan Master Data:

1. `runCoreSmokeTest()` (`apps-script/tests/CoreSmokeTest.gs`) — memverifikasi `getSpreadsheetId()`, `getSpreadsheet()`, akses sheet via `DatabaseService`, dan `SequenceService` (increment, `generateEntityId()`, `generateReportNumber()`).
2. `runMasterDataSmokeTest()` (`apps-script/tests/MasterDataSmokeTest.gs`) — memverifikasi create/get/update/list/deactivate, validasi gagal, deteksi duplikasi, hierarki lokasi, dan validasi facility-category pada data bertanda `TEST_`.
3. `runInspectDatabaseSmokeTest()` (`apps-script/tests/InspectDatabaseSmokeTest.gs`) — memverifikasi struktur hasil `inspectDatabaseAsJson()`/`inspectExistingDatabase()` dan memastikan pemanggilan berulang tidak menimbulkan efek samping (read-only sungguhan). Aman dijalankan kapan saja, termasuk terhadap spreadsheet lama.
4. `runSequenceCompatibilitySmokeTest()` (`apps-script/tests/SequenceCompatibilitySmokeTest.gs`, PHASE 3.75) — memverifikasi SEQUENCE COMPATIBILITY LAYER pada `SequenceService.gs`: mendeteksi alias kolom (`sequence_name`/`sequence_key`, `current_value`/`last_value`) yang benar-benar dipakai sheet `91_sequences` nyata, dan memastikan baca-ubah-tulis tetap konsisten lewat kolom tersebut. Hanya memakai sequence `CORE_TEST`, aman dijalankan terhadap spreadsheet produksi.

Lihat hasil eksekusi pada **View > Logs** (atau `Ctrl+Enter` di editor) setelah menjalankan masing-masing fungsi.

## 10. Setup Autentikasi (Token API + Password Admin Pertama)

Langkah ini WAJIB sebelum frontend (`frontend/`) dapat login — lihat
`apps-script/auth/README.md` dan `apps-script/api/README.md` untuk latar
belakang perubahan dari Google SSO ke username(email)/password.

### 10.1 Set `API_TOKEN` pada Script Properties

Sama seperti langkah `SPREADSHEET_ID` (bagian 3), tambahkan satu Script
Property lagi:

- **Property**: `API_TOKEN`
- **Value**: string acak yang cukup panjang (mis. hasil `Utilities.getUuid()`
  yang dijalankan sekali dari editor Apps Script, atau generator UUID
  apa pun). Ini BUKAN password pengguna — nilainya juga akan ditulis ke
  `frontend/config.js` (dikirim ke browser), lihat catatan di
  `core/Config.gs` `getApiToken()`.

Tanpa langkah ini, SETIAP request ke Web App (termasuk `login`) akan ditolak
`checkToken_()` di `apps-script/api/App.gs`.

### 10.2 Tetapkan Password Admin Pertama

Tidak ada pendaftaran/self-service password. Password HANYA bisa ditetapkan
lewat `AuthService.setPassword()` — tapi `apiSetPassword` (jalur normal lewat
Web App) mensyaratkan pemanggilnya SUDAH login sebagai ADMIN, yang tentu
belum mungkin untuk akun ADMIN pertama. Untuk akun ADMIN pertama, jalankan
langsung dari editor Apps Script (bukan lewat Web App):

1. Pastikan sudah ada baris di `01_users` dengan `role = ADMIN` dan
   `is_active = TRUE` (buat manual di spreadsheet, atau lewat
   `UserService.createUser()` dari editor Apps Script bila belum ada).
2. Di editor Apps Script, jalankan fungsi berikut sekali lewat panel
   **Run** (ganti `<user_id>` dan `<password_baru>`):
   ```js
   setPassword('<user_id>', '<password_baru>');
   ```
   (`user_id` didapat dari kolom `user_id` baris ADMIN tersebut di
   `01_users`, BUKAN email.)
3. Password admin pertama ini sekarang bisa dipakai login lewat frontend.
   Untuk pengguna berikutnya, ADMIN yang sudah login dapat memakai menu
   "Set Password" di frontend (memanggil `apiSetPassword`) — tidak perlu
   lagi lewat editor Apps Script.

Pengguna dapat mengganti password mereka sendiri kapan saja lewat menu
"Ganti Password" di frontend (`apiChangePassword`, memverifikasi password
lama lebih dulu).
