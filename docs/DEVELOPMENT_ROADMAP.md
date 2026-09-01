# Roadmap Pengembangan — SIGAP SARPRAS SMADA

Dokumen ini menjelaskan tahapan pengembangan SIGAP SARPRAS dari fondasi repository hingga sistem siap produksi. Setiap fase dikerjakan secara bertahap dan tidak melompati fase sebelumnya, sejalan dengan prinsip kejelasan alur kerja yang dianut sistem ini.

## PHASE 1 — Repository Foundation

Status: **Selesai**

- Menyusun struktur repository (`docs/`, `apps-script/`, `frontend/`).
- Menyusun dokumentasi arsitektur (`ARCHITECTURE.md`), workflow (`WORKFLOW.md`), dan skema database (`DATABASE_SCHEMA.md`).
- Menyiapkan kerangka folder source code Google Apps Script berdasarkan domain, tanpa implementasi logika bisnis.
- Menyusun roadmap pengembangan.

## PHASE 2 — Core Backend

Status: **Selesai**

- Implementasi `Config.gs` — konfigurasi ID spreadsheet (via Script Properties, key `SPREADSHEET_ID`), pemetaan nama sheet, timezone (`Asia/Makassar`), dan konstanta sistem.
- Implementasi `DatabaseService.gs` — operasi baca/tulis/cari generik terhadap Google Spreadsheet (`getAllRows`, `getRowById`, `findRows`, `insertRow`, `updateRowById`), dilindungi `LockService` pada operasi tulis.
- Implementasi `SequenceService.gs` — pembangkitan ID unik dan nomor laporan (`getNextSequence`, `padNumber`, `generateEntityId`, `generateReportNumber`), atomik menggunakan `LockService.getScriptLock()`.
- Implementasi `UtilityService.gs` — fungsi bantu lintas domain (format timestamp, validasi umum, struktur response standar).
- **Belum termasuk**: pembuatan sheet aktual pada Google Spreadsheet (`90_settings`, `91_sequences`, dsb.) — ini merupakan langkah operasional yang dilakukan di sisi Google Sheets, bukan bagian dari source code.

## PHASE 2.5 — Core Backend Validation

Status: **Selesai**

Validation gate sebelum melanjutkan ke PHASE 3, mengoreksi temuan pada implementasi PHASE 2:

- Koreksi `SequenceService.generateReportNumber()` — sebelumnya menurunkan sequence key per tahun (mis. `REPORT_2026`), diperbaiki menjadi satu sequence global monoton `CONFIG.SEQUENCES.REPORT` yang tidak pernah direset; tahun pada `report_number` kini murni tampilan.
- Penambahan `CONFIG.SEQUENCES.CORE_TEST` dan `CONFIG.ID_PREFIXES.CORE_TEST` khusus kebutuhan smoke test, terpisah dari sequence produksi.
- Dokumentasi eksplisit Aturan Akses Database pada `docs/ARCHITECTURE.md` (bagian 4) dan `apps-script/README.md`, termasuk penjelasan pengecualian `SequenceService` untuk menjaga operasi atomik.
- Penyusunan `docs/DATABASE_SETUP.md` — panduan operasional pembuatan spreadsheet, penyimpanan `SPREADSHEET_ID` di Script Properties, daftar seluruh sheet dan header, serta nilai awal sequence.
- Penyusunan `apps-script/tests/CoreSmokeTest.gs` — smoke test manual untuk Config, DatabaseService, dan SequenceService.
- Koreksi contoh format `report_number` dan deskripsi `91_sequences` pada `docs/DATABASE_SCHEMA.md` agar konsisten dengan desain sequence yang telah dikoreksi.

## PHASE 3 — Master Data

Status: **Selesai**

- Implementasi layanan CRUD untuk data pengguna (`01_users`) — `apps-script/users/UserService.gs`.
- Implementasi layanan CRUD untuk lokasi hierarkis (`02_locations`), kategori (`03_categories`), fasilitas (`04_facilities`), dan owner (`05_owners`) — `apps-script/master-data/`.
- Validasi relasi antar data master (mis. fasilitas harus merujuk kategori yang valid dan aktif; lokasi anak tidak boleh membentuk circular hierarchy terhadap induknya).
- Soft delete (`is_active`) untuk seluruh entitas Master Data — tidak ada hard delete.
- Penyusunan `apps-script/tests/MasterDataSmokeTest.gs` — smoke test manual untuk seluruh domain Master Data.

## PHASE 3.75 — Legacy-Compatible Repository Reconciliation

Status: **Selesai**

- Menyelaraskan schema `11_report_photos`, `12_report_history`, `13_report_comments`, `20_audit_logs`, dan `91_sequences` mengikuti struktur database produksi nyata (temuan PHASE 3.5), tanpa migrasi spreadsheet.
- Menambahkan sequence compatibility layer pada `SequenceService.gs` (alias resolution `sequence_name`/`sequence_key`, `current_value`/`last_value`).

## PHASE 4 — Legacy-Compatible Report Engine

Status: **Selesai** (cakupan diperluas dari rencana awal atas permintaan eksplisit — lihat catatan di bawah)

- Implementasi `apps-script/reports/ReportService.gs` — Create Report (penetapan `report_id`/`report_number` melalui `SequenceService`), Report Retrieval, Report Listing (`listActiveReports`, `listReportsByStatus`), Report Update, dan Referential Validation berlapis (CREATE strict, READ tanpa validasi/legacy-compatible, UPDATE contextual — lihat `apps-script/reports/README.md`).
- Implementasi `apps-script/reports/ReportWorkflowService.gs` — validasi transisi status laporan sesuai `docs/WORKFLOW.md`, termasuk penolakan transisi ilegal (`changeReportStatus`).
- Implementasi `apps-script/reports/ReportHistoryService.gs` — pencatatan riwayat perubahan laporan (`12_report_history`), dipanggil otomatis oleh `ReportService`/`ReportWorkflowService` (action `CREATE`/`UPDATE`/`STATUS_CHANGE`/`DEACTIVATE`).
- Penyusunan `apps-script/tests/ReportEngineSmokeTest.gs` — smoke test manual untuk seluruh fungsi di atas, termasuk skenario legacy orphan compatibility.
- **Cakupan yang SENGAJA DITUNDA** (lihat laporan PHASE 4 untuk detail): perhitungan `system_priority` otomatis (belum ada algoritma kanonik yang ditemukan — OPEN DESIGN DECISION), pencatatan lampiran laporan (`11_report_photos`) dan komentar (`13_report_comments`) — schema sudah siap sejak PHASE 3.75, service belum diimplementasikan, otorisasi berbasis peran, dan integrasi audit log (`20_audit_logs`) — seluruhnya tetap dijadwalkan PHASE 5 sesuai rencana awal, KECUALI validasi transisi status dan pencatatan riwayat (`12_report_history`) yang aslinya direncanakan PHASE 5 namun diminta dan diselesaikan lebih awal pada PHASE 4 ini.

## PHASE 4.5 — MVP Usability

Status: **Selesai**

Ditambahkan **di luar urutan roadmap awal**, atas prioritas eksplisit: sebelum menambah fitur baru, sistem harus lebih dulu benar-benar dapat **dijalankan dan diuji oleh pengguna nyata** (bukan hanya lewat editor Apps Script oleh developer). Sebelum fase ini, tidak ada `appsscript.json`, tidak ada `doGet`/`doPost`, dan folder `frontend/` masih kosong — sehingga tidak ada cara bagi pengguna nyata untuk mencoba sistem sama sekali, walau seluruh backend (PHASE 1-4) sudah fungsional.

- Menambahkan `apps-script/appsscript.json` — manifest Web App (`webapp.executeAs: "USER_ACCESSING"` agar sesi pemanggil dapat diidentifikasi individual, bukan sebagai pemilik script).
- Implementasi `apps-script/api/App.gs` (`doGet`) yang menyajikan `apps-script/api/Index.html` — halaman uji coba MINIMAL (vanilla HTML/CSS/JS, tanpa framework/CDN eksternal): identitas pengguna aktif, form buat laporan, daftar laporan (dengan filter status), dan kontrol ubah status untuk peran yang berwenang. Ditegaskan **BUKAN** frontend final PHASE 7.
- Implementasi `apps-script/api/AuthContext.gs` — mengidentifikasi pengguna dari sesi Google aktif (`Session.getActiveUser()`) dan mencocokkannya ke `01_users` (`UserService.getUserByEmail()`, ditambahkan pada fase ini). Juga menerapkan otorisasi **MINIMAL** (bukan RBAC penuh): hanya peran `VERIFIKATOR`/`OWNER`/`ADMIN` yang dapat memicu perubahan status atau menonaktifkan laporan — diambil langsung dari contoh yang sudah ada di `docs/ARCHITECTURE.md`, bukan aturan baru yang dikarang.
- Implementasi `apps-script/api/ReportApi.gs`, `apps-script/api/MasterDataApi.gs`, `apps-script/api/ApiUtil.gs` — fungsi publik `google.script.run` yang HANYA meneruskan permintaan ke Service Layer yang sudah ada (`reports/`, `master-data/`) dan membungkus hasil/error dengan `core/UtilityService.gs` — tidak ada logika bisnis baru di lapisan ini, dan tidak ada pemanggilan `SpreadsheetApp`/`DatabaseService` langsung.
- **Tidak termasuk** (di luar scope, dijadwalkan fase berikutnya): RBAC penuh per jenis transisi status, Photo/Comment Engine, audit log, dan frontend final PHASE 7 (framework, desain).

## PHASE 4.75 — Decoupled Frontend & Token Authentication

Status: **Selesai**

Ditambahkan **di luar urutan roadmap awal**, atas alasan yang sama dengan
PHASE 4.5: MVP PHASE 4.5 (`api/Index.html` + `google.script.run`) hanya bisa
dijalankan dari DALAM project Apps Script itu sendiri (`HtmlService`) —
tidak ada cara menghostingnya sebagai aplikasi statis terpisah di GitHub
seperti yang diminta secara eksplisit (menyamai arsitektur aplikasi SIGAP:
penyimpanan di Google Spreadsheet, "sisanya" — frontend + tooling deploy —
di GitHub). Perubahan ini sekaligus menuntaskan **PHASE 7 — Frontend** lebih
awal (fungsional, belum melalui iterasi desain/UX — lihat catatan pada
PHASE 7 di bawah).

- **Frontend baru** (`frontend/`) — aplikasi statis React tanpa build step
  DAN tanpa JSX/Babel (`React.createElement` langsung, lihat
  `frontend/README.md` untuk alasan penyederhanaan ini dibanding pola SIGAP),
  di-hosting terpisah dari project Apps Script. Mencakup seluruh fitur
  backend yang sudah ada: login/logout/ganti password, buat & lihat laporan,
  ubah status laporan, riwayat laporan, dan (ADMIN) pengelolaan data master
  serta pengguna.
- **`apps-script/api/App.gs`** dirombak total dari `doGet()` penyaji HTML
  (`google.script.run`) menjadi JSON API bertoken (`doGet`/`doPost`),
  meniru pola `Code.gs` pada aplikasi SIGAP. `api/Index.html` **dihapus**.
- **Domain baru `apps-script/auth/`** (`AuthService.gs`) — login
  username(email)/password + sesi bertoken (`CacheService`, TTL 6 jam),
  menggantikan `Session.getActiveUser()` yang tidak lagi bisa diandalkan
  begitu frontend dipindah ke origin terpisah. `apps-script/api/AuthContext.gs`
  dirombak mengikuti (`requireSession_()` menggantikan
  `getCurrentUserContext_()`).
- **Schema `01_users` bertambah** `password_hash`/`password_salt` (additive,
  lihat `docs/DATABASE_SCHEMA.md`) — baris pengguna lama TIDAK bisa login
  sampai ADMIN menetapkan password awal (`docs/DATABASE_SETUP.md` bagian 10).
- **`apps-script/appsscript.json`** diubah (`webapp.executeAs:
  "USER_DEPLOYING"`, `webapp.access: "ANYONE_ANONYMOUS"`, dari
  `"USER_ACCESSING"`/`"DOMAIN"`) — konsekuensi wajib dari lepasnya
  ketergantungan pada sesi Google; keamanan akses sepenuhnya berpindah ke
  token API + `AuthService`.
- **Tooling deploy baru**: `.clasp.json.example`, `apps-script/.claspignore`,
  `package.json` (`clasp:push`/`clasp:deploy`/`clasp:deploy:first`),
  `.github/scripts/clasp-deploy-existing.js` — meniru pola aman yang sama
  dengan aplikasi SIGAP (`clasp deploy` TANPA `-i` ditolak, mencegah
  pembuatan deployment baru yang tidak disengaja). Lihat
  `docs/GAS_CLASP_DEPLOY.md` (jalur utama, menggantikan
  `docs/GAS_MANUAL_DEPLOY.md` yang sekarang usang).
- **Belum diverifikasi** (di luar cakupan perubahan ini, lihat catatan di
  `frontend/README.md` dan `docs/GAS_CLASP_DEPLOY.md`): perilaku CORS Apps
  Script Web App end-to-end dari frontend yang benar-benar di-hosting di
  origin terpisah. WAJIB diuji sebelum sistem dianggap benar-benar siap
  dipakai pengguna nyata.

## PHASE 5 — Workflow & Authorization

- Memperhalus otorisasi berbasis peran (role) untuk setiap aksi pada laporan (mis. siapa yang berhak memverifikasi vs. menugaskan vs. menutup laporan, bukan satu gerbang kasar untuk semua transisi). PHASE 4.5 sudah menambahkan otorisasi MINIMAL di `apps-script/api/AuthContext.gs` (hanya VERIFIKATOR/OWNER/ADMIN yang boleh memicu transisi status APA PUN) — `ReportWorkflowService.changeReportStatus()` sendiri (domain layer) tetap hanya memvalidasi legalitas URUTAN transisi, bukan hak akses; otorisasi memang sengaja ditempatkan di lapisan API/entry point, bukan domain, agar Service Layer tetap dapat dipanggil test/tools tanpa konteks pengguna.
- Implementasi pencatatan audit log (`20_audit_logs`) untuk seluruh aktivitas penting di sistem — `AuditService` belum ada; titik integrasi yang diperlukan sudah diidentifikasi pada laporan PHASE 4 (createReport, updateReport, changeReportStatus, deactivateReport).
- Implementasi service lampiran laporan (`11_report_photos`) dan komentar (`13_report_comments`) — di luar scope PHASE 4 secara eksplisit.
- Implementasi perhitungan `system_priority` berdasarkan kategori, `impact_level`, dan `safety_risk`, setelah algoritma kanonik dikonfirmasi (lihat OPEN DESIGN DECISIONS pada laporan PHASE 4).

## PHASE 6 — Testing

- Penyusunan skenario pengujian untuk setiap service pada `apps-script/tests/`.
- Pengujian transisi status legal dan ilegal.
- Pengujian validasi data master dan laporan.
- Pengujian konsistensi pembangkitan ID/nomor laporan.

## PHASE 7 — Frontend

Status: **Fungsional lebih awal lewat PHASE 4.75 — desain/UX belum digarap**

Versi FUNGSIONAL frontend (integrasi penuh ke backend, seluruh fitur yang
ada dipakaikan UI) sudah selesai lewat **PHASE 4.75 — Decoupled Frontend &
Token Authentication** di atas, lebih awal dari urutan roadmap asli (alasan
sama dengan PHASE 4.5: sistem harus bisa dipakai pengguna nyata lebih dulu).
Sisa pekerjaan PHASE 7 yang BELUM digarap:

- Perancangan visual/UX (saat ini murni fungsional, CSS minim — lihat
  `frontend/index.html`).
- Perancangan antarmuka yang dioptimalkan per peran (pelapor vs
  verifikator/owner) — saat ini satu antarmuka generik untuk semua peran
  yang login, dibedakan lewat kontrol yang ditampilkan/disembunyikan
  (`frontend/app.js`), bukan alur terpisah.

## PHASE 8 — Production Readiness

- Peninjauan keamanan (hak akses spreadsheet, validasi input, penanganan kesalahan).
- Peninjauan performa (efisiensi operasi terhadap Google Spreadsheet).
- Penyusunan dokumentasi pengguna dan panduan operasional.
- Persiapan proses deployment dan pemantauan pasca-produksi.

---

**Catatan:** Roadmap ini bersifat hidup (living document) dan dapat disesuaikan seiring kebutuhan yang ditemukan pada setiap fase. Perubahan lingkup pada suatu fase sebaiknya didokumentasikan agar riwayat keputusan arsitektur tetap dapat ditelusuri.
