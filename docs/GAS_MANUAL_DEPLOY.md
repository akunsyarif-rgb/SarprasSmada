# Deploy Tanpa Command Line (iPad/Browser) — SIGAP SARPRAS SMADA

Panduan ini untuk operator yang **hanya punya iPad** (atau perangkat lain
tanpa terminal/command line sama sekali) — semuanya lewat Safari. Jika
punya akses komputer dengan Node.js, jalur `clasp` di
`docs/GAS_CLASP_DEPLOY.md` lebih cepat untuk update berikutnya, tapi
**sepenuhnya opsional** — panduan ini cukup untuk semuanya, dari nol sampai
sistem berjalan.

Sumber seluruh kode: branch/`main` repository ini. Cara tercepat mengambil
source tanpa buka puluhan file satu-satu: buka
[`apps-script/deployment/DEPLOYMENT_BUNDLE.txt`](../apps-script/deployment/DEPLOYMENT_BUNDLE.txt)
di GitHub (lewat Safari) — satu file berisi seluruh source backend,
dipisahkan penanda `===== FILE: <nama> =====` per file, dalam urutan yang
sama seperti tabel di bagian 2. Salin isi setiap bagian ke file Apps
Script dengan nama yang sama persis.

> **Penting jika Anda pernah mengikuti versi lama panduan ini**: sistem
> sudah berubah arsitektur (lihat `apps-script/api/README.md` — login
> sekarang email/password bertoken, bukan lagi sesi Google). Bundle di atas
> SELALU dibuat ulang mengikuti source code terbaru — jangan pakai salinan
> lama yang mungkin pernah Anda simpan.

---

## 0. Prasyarat — jangan lewati

- **Spreadsheet database sudah disiapkan** sesuai `docs/DATABASE_SETUP.md`
  bagian 1–9 (bisa dari Safari + Google Sheets, tidak butuh command line —
  lewat `setupDatabase()` yang dijalankan dari editor Apps Script, sama
  seperti langkah di bagian 8 panduan ini). Sheet `01_users` WAJIB sudah
  punya kolom `password_hash`/`password_salt` (lihat catatan di
  `docs/DATABASE_SETUP.md` bagian 5).
- Minimal satu baris di `01_users` dengan `role = ADMIN` dan
  `is_active = TRUE` — ini akun yang akan diberi password pertama di
  bagian 7 panduan ini.
- Anda tahu **Spreadsheet ID** database (bagian URL di antara `/d/` dan
  `/edit`, buka spreadsheet-nya di Safari untuk menyalinnya).

## 1. Kenapa urutan pembuatan file penting

Google Apps Script menggabungkan seluruh file `.gs` dalam satu project
menjadi satu konteks eksekusi global. Fungsi bisa saling memanggil lintas
file tanpa masalah (dan tanpa perlu import apa pun), TAPI kode di level
atas file (`var ...` di luar fungsi manapun) dijalankan mengikuti urutan
file yang tampil di panel editor. Seluruh konstanta top-level pada source
saat ini hanya berupa angka/string literal (tidak membaca `CONFIG` atau
fungsi lain saat file dimuat) — jadi urutan sebenarnya TIDAK kritis untuk
source saat ini, tapi **tetap ikuti urutan di bawah** sebagai praktik aman,
terutama jika Anda menambah kode baru nanti.

## 2. Daftar file, urutan, dan nama persis

Buat file dengan **File > New > Script** (untuk `.gs`) di editor Apps
Script, satu per satu, sesuai urutan berikut. Beri nama **persis** seperti
kolom "Nama file di Apps Script" (Apps Script mengizinkan `/` pada nama
file untuk pengelompokan tampilan folder di editor — pakai itu agar
strukturnya tetap mudah dikenali seperti repository).

| # | Nama file di Apps Script | Sumber di bundle |
|---|---|---|
| 1 | `core/Config` | `apps-script/core/Config.gs` |
| 2 | `core/DatabaseService` | `apps-script/core/DatabaseService.gs` |
| 3 | `core/SequenceService` | `apps-script/core/SequenceService.gs` |
| 4 | `core/UtilityService` | `apps-script/core/UtilityService.gs` |
| 5 | `auth/AuthService` | `apps-script/auth/AuthService.gs` |
| 6 | `users/UserService` | `apps-script/users/UserService.gs` |
| 7 | `master-data/LocationService` | `apps-script/master-data/LocationService.gs` |
| 8 | `master-data/CategoryService` | `apps-script/master-data/CategoryService.gs` |
| 9 | `master-data/FacilityService` | `apps-script/master-data/FacilityService.gs` |
| 10 | `master-data/OwnerService` | `apps-script/master-data/OwnerService.gs` |
| 11 | `reports/ReportHistoryService` | `apps-script/reports/ReportHistoryService.gs` |
| 12 | `reports/ReportService` | `apps-script/reports/ReportService.gs` |
| 13 | `reports/ReportWorkflowService` | `apps-script/reports/ReportWorkflowService.gs` |
| 14 | `api/AuthContext` | `apps-script/api/AuthContext.gs` |
| 15 | `api/ApiUtil` | `apps-script/api/ApiUtil.gs` |
| 16 | `api/AuthApi` | `apps-script/api/AuthApi.gs` |
| 17 | `api/UserApi` | `apps-script/api/UserApi.gs` |
| 18 | `api/MasterDataApi` | `apps-script/api/MasterDataApi.gs` |
| 19 | `api/ReportApi` | `apps-script/api/ReportApi.gs` |
| 20 | `api/App` | `apps-script/api/App.gs` — satu-satunya `doGet()`/`doPost()` |

Tidak ada file lain yang perlu dibuat — `apps-script/tests/`,
`apps-script/tools/`, dan seluruh `README.md` SENGAJA tidak masuk deploy
Web App (utilitas satu-kali/pengujian manual, dijalankan terpisah lewat
editor bila dibutuhkan, lihat `docs/DATABASE_SETUP.md`).

### Cara mengisi tiap file (di iPad, lewat Safari)

1. Buka `apps-script/deployment/DEPLOYMENT_BUNDLE.txt` di GitHub (Safari).
   Tap tombol **Raw** di halaman GitHub supaya tampilan teksnya polos, lebih
   gampang di-select-all per bagian.
2. Cari penanda `===== FILE: apps-script/<path> =====` sesuai kolom
   "Sumber di bundle" pada tabel di atas.
3. Tap-tahan untuk **select** seluruh isi di bawah penanda tersebut sampai
   sebelum penanda `===== FILE:` berikutnya (Safari punya handle seleksi
   yang bisa diseret — pilih dari baris setelah penanda sampai baris
   terakhir sebelum penanda berikutnya), lalu **Copy**.
4. Kembali ke tab editor Apps Script, tempel (**Paste**) ke file yang baru
   dibuat dengan nama pada kolom "Nama file di Apps Script" — hapus dulu
   isi bawaan `function myFunction() {}` yang otomatis dibuat Apps Script
   pada file baru.
5. Ulangi untuk seluruh 20 baris tabel.

### Manifest (`appsscript.json`)

Bagian TERAKHIR pada bundle (`===== FILE: apps-script/appsscript.json =====`)
BUKAN dibuat lewat "New > Script", melainkan lewat menu editor Apps
Script: **Project Settings (ikon gerigi)** → centang **"Show
'appsscript.json' manifest file in editor"** → file `appsscript.json`
akan muncul di panel file. Buka, ganti seluruh isinya dengan bagian
tersebut dari bundle. Isinya menentukan:
- `webapp.executeAs: "USER_DEPLOYING"` — script berjalan sebagai identitas
  Anda (pemilik/deployer), BUKAN identitas pengguna yang mengakses —
  konsekuensi dari sistem sekarang memakai login email/password sendiri
  (lihat `apps-script/auth/README.md`), bukan lagi sesi Google.
- `webapp.access: "ANYONE_ANONYMOUS"` — siapa pun bisa MENCAPAI Web App
  URL-nya (tidak perlu login Google) — keamanan sesungguhnya ada di token
  API + login aplikasi, BUKAN di lapisan akses Apps Script ini. Lihat
  `apps-script/api/App.gs` untuk penjelasan lengkap dua lapis token ini.

## 3. Script Properties (Spreadsheet ID + Token API)

Aplikasi TIDAK menyimpan Spreadsheet ID maupun token API di kode — wajib
diset lewat Script Properties:

1. Di editor Apps Script: **Project Settings (ikon gerigi)**.
2. Scroll ke bagian **Script Properties**.
3. **Add script property** dua kali:
   - Property: `SPREADSHEET_ID` — Value: ID spreadsheet database Anda
     (lihat bagian 0).
   - Property: `API_TOKEN` — Value: string acak bebas yang cukup panjang
     (mis. ketik asal 30+ karakter campur huruf-angka, atau minta bantuan
     generator UUID online). Catat nilainya — akan dipakai lagi di
     `frontend/config.js` (bagian 6).
4. **Save script properties**.

Tanpa langkah ini, setiap pemanggilan API akan gagal dengan pesan error
eksplisit (`Config.getSpreadsheetId()`/`Config.getApiToken()` menyebutkan
persis Script Property mana yang belum diset).

## 4. Deploy sebagai Web App

1. Simpan seluruh file (ikon simpan di toolbar editor).
2. Klik **Deploy > New deployment**.
3. Klik ikon gerigi di samping "Select type" → pilih **Web app**.
4. Isi:
   - Description: bebas, mis. "Deploy pertama".
   - Execute as: **Me (<email Anda>)** — harus sama dengan
     `webapp.executeAs: "USER_DEPLOYING"` di manifest.
   - Who has access: **Anyone** — harus sama dengan
     `webapp.access: "ANYONE_ANONYMOUS"` di manifest.
5. Klik **Deploy**.
6. Google akan meminta otorisasi (Authorize access) — pilih akun Google
   Anda, terima peringatan "unverified app" (wajar untuk script pribadi/
   internal yang belum diverifikasi Google), izinkan akses ke Spreadsheet.
7. Salin **Web app URL** yang muncul (bentuknya
   `https://script.google.com/macros/s/.../exec`) — dipakai di bagian 6.

## 5. Bootstrap Password Admin Pertama

Tidak bisa lewat Web App (butuh sudah login sebagai ADMIN, yang belum
mungkin untuk akun ADMIN pertama). Jalankan sekali langsung dari editor:

1. Di editor Apps Script, buka file `auth/AuthService`.
2. Di dropdown pemilihan fungsi (bagian atas editor, di sebelah tombol
   **Run**), pilih fungsi `setPassword`.
3. Sebelum klik **Run**, Anda perlu memberi argumen — cara termudah di
   editor Apps Script: buka file mana saja (mis. `core/Config`), scroll ke
   paling bawah, sementara ketik fungsi bantu ini (JANGAN commit/simpan
   permanen, cukup untuk sekali jalan lalu hapus lagi):
   ```js
   function bootstrapAdminPassword_TEMP() {
     setPassword('<user_id ADMIN dari 01_users>', '<password baru Anda>');
   }
   ```
4. Pilih `bootstrapAdminPassword_TEMP` di dropdown fungsi, klik **Run**.
5. Google akan minta otorisasi lagi pada pemanggilan pertama — setujui.
6. Buka **Executions** (ikon jam di sidebar) untuk memastikan tidak ada
   error.
7. **Hapus fungsi sementara tadi** dari file (agar password tidak
   tertinggal dalam bentuk teks polos di source), lalu **Save**.

Password admin pertama ini sekarang bisa dipakai login lewat frontend.
Untuk pengguna berikutnya, ADMIN yang sudah login cukup pakai menu
"Set Password" di frontend (tidak perlu lagi lewat editor Apps Script).

## 6. Sambungkan Frontend

Edit `frontend/config.js` langsung dari GitHub (Safari, tidak perlu
command line):

1. Buka `frontend/config.js` di GitHub.
2. Tap ikon pensil (**Edit this file**) — kalau tidak muncul, tap dulu
   ikon "..." atau buka lewat **Edit in place** di menu berbagi Safari.
3. Ganti `PASTE_WEB_APP_URL_DI_SINI` dengan Web App URL dari bagian 4.7.
4. Ganti `PASTE_API_TOKEN_DI_SINI` dengan nilai `API_TOKEN` dari bagian 3.
5. **Commit changes** — pilih commit langsung ke branch yang sedang aktif
   (atau ke `main` bila PR terkait sudah di-merge).

Lihat `frontend/README.md` untuk langkah hosting `frontend/` (Vercel dkk,
juga sepenuhnya lewat browser/dashboard web, tidak butuh command line).

## 7. Langkah Testing Pertama

1. Buka `frontend/config.js` sekali lagi untuk pastikan isinya sudah benar
   (bukan placeholder lagi).
2. Buka URL frontend yang sudah di-hosting (bagian 6/`frontend/README.md`)
   dari Safari.
3. Login pakai email + password admin dari bagian 5.
4. Coba buat laporan baru, lihat daftar laporan, ubah status.
5. **WAJIB dicoba dari frontend yang benar-benar online** (bukan file
   lokal) — lihat catatan CORS di `frontend/README.md`, perilaku ini belum
   pernah diverifikasi sebelumnya.

### Troubleshooting singkat

| Gejala | Kemungkinan penyebab |
|---|---|
| "Token API tidak valid" | `API_TOKEN` di `frontend/config.js` tidak sama persis dengan Script Property `API_TOKEN`. |
| "Server belum dikonfigurasi (API_TOKEN belum diset)" | Ulangi bagian 3. |
| "Email atau password salah" terus meski sudah di-set | Cek lagi `user_id` yang dipakai di bagian 5 — harus persis dari kolom `user_id`, bukan email. |
| "Sheet ... tidak ditemukan pada spreadsheet" | `SPREADSHEET_ID` benar tapi sheet dengan nama itu belum ada — lihat `docs/DATABASE_SETUP.md`. |
| Halaman frontend blank / gagal fetch | Cek Console browser (di iPad: buka Settings > Safari > Advanced > Web Inspector, sambungkan ke Mac bila ada; atau coba dari browser desktop dulu untuk diagnosis) — kemungkinan CORS atau Root Directory hosting salah, lihat `frontend/README.md`. |

## 8. Update Setelah Deploy Pertama (setiap ada perubahan `.gs`)

1. Buka lagi `apps-script/deployment/DEPLOYMENT_BUNDLE.txt` versi terbaru
   di GitHub.
2. Salin ulang bagian file yang berubah, tempel menimpa isi file yang
   sama di editor Apps Script (bagian 2).
3. **Deploy > Manage deployments** → pilih deployment yang ada → ikon
   pensil (Edit) → ganti **Version** ke **New version** → **Deploy** —
   supaya Web App URL yang sama (dan `frontend/config.js` yang sudah
   diisi) tetap memuat kode terbaru tanpa perlu diubah lagi.

**Jangan** membuat deployment BARU (`Deploy > New deployment`) untuk
update — itu menghasilkan URL BARU yang tidak dikenal `frontend/config.js`.
