# Arsitektur Sistem — SIGAP SARPRAS SMADA

## 1. Gambaran Arsitektur

SIGAP SARPRAS dibangun di atas ekosistem Google Workspace, dengan Google Apps Script sebagai runtime backend dan Google Spreadsheet sebagai media penyimpanan data. Alur permintaan dalam sistem mengikuti lapisan berikut:

```
User
  ↓
Frontend Application
  ↓
Google Apps Script
  ↓
Service Layer
  ↓
Google Spreadsheet (Database)
```

Penjelasan tiap lapisan:

- **User** — warga sekolah (siswa, guru, staf, penanggung jawab sarana-prasarana) yang berinteraksi dengan sistem.
- **Frontend Application** — `frontend/`, aplikasi statis (React tanpa build step, lihat `frontend/README.md`) di-hosting TERPISAH dari project Apps Script (mis. Vercel/GitHub Pages), berkomunikasi lewat `fetch()` ke JSON API `apps-script/api/App.gs`. Menggantikan `apps-script/api/Index.html` (test harness PHASE 4.5, memakai `google.script.run`, SUDAH DIHAPUS) sebagai satu-satunya cara pengguna nyata memakai sistem — perubahan ini sekaligus menuntaskan **PHASE 7** lebih awal dari urutan roadmap asli (lihat `docs/DEVELOPMENT_ROADMAP.md`), atas alasan yang sama dengan PHASE 4.5: sistem harus benar-benar dapat dijalankan, bukan cuma berfungsi secara teoritis.
- **Google Apps Script** — lapisan entry point: `apps-script/api/App.gs` (`doGet`/`doPost`) menerima request JSON bertoken dari `frontend/`, lalu memanggil fungsi publik pada `apps-script/api/*Api.gs` — inilah "fungsi yang dipanggil frontend" yang meneruskan permintaan ke Service Layer. `apps-script/api/AuthContext.gs` mengidentifikasi pemanggil dari **token sesi** (`apps-script/auth/AuthService.gs`, BUKAN lagi sesi Google aktif — lihat catatan PERUBAHAN ARSITEKTUR di kedua file tersebut) sebelum permintaan diteruskan.
- **Service Layer** — kumpulan modul (`.gs`) yang berisi logika bisnis, dikelompokkan berdasarkan domain. Service Layer tidak boleh mengakses spreadsheet secara langsung, melainkan melalui `DatabaseService`.
- **Google Spreadsheet** — media penyimpanan data terstruktur dalam bentuk sheet, masing-masing merepresentasikan satu entitas/tabel (lihat `docs/DATABASE_SCHEMA.md`).

## 2. Domain Backend

Source code backend dikelompokkan ke dalam domain-domain berikut (lihat struktur folder pada `apps-script/`):

### CORE (`apps-script/core/`)

Modul dasar yang digunakan oleh seluruh domain lain.

- **Configuration** (`Config.gs`) — titik tunggal (single source of truth) untuk konfigurasi sistem: ID spreadsheet, nama sheet, konstanta status, dan parameter global lainnya. Konfigurasi tidak boleh tersebar atau di-hardcode di luar modul ini.
- **Database Access** (`DatabaseService.gs`) — satu-satunya lapisan yang berkomunikasi langsung dengan Google Spreadsheet (baca, tulis, cari, filter baris). Seluruh domain lain wajib mengakses data melalui service ini, tidak diperkenankan memanggil `SpreadsheetApp` secara langsung dari luar `core/`.
- **Sequence Generation** (`SequenceService.gs`) — bertanggung jawab menghasilkan ID unik dan nomor urut (mis. nomor laporan) secara konsisten dan bebas duplikasi, mengacu pada sheet `91_sequences`.
- **Utility** (`UtilityService.gs`) — fungsi bantu lintas domain (format tanggal, validasi umum, pembuatan response, dsb.) yang tidak spesifik terhadap satu domain bisnis.

### AUTH (`apps-script/auth/`)

Autentikasi (login/logout/password/sesi) — TERPISAH dari data pengguna
(lihat MASTER DATA di bawah). `AuthService.gs` menangani hashing password
(salted SHA-256), verifikasi login, pembuatan/pengambilan sesi bertoken
(`CacheService`, TTL 6 jam), dan rate limiting percobaan login gagal.
Menggantikan model lama (`Session.getActiveUser()`/SSO Google Workspace) —
lihat `apps-script/auth/README.md` untuk latar belakang perubahan. Sama
seperti domain lain, TIDAK memanggil `SpreadsheetApp` langsung — akses ke
sheet `01_users` (kolom `password_hash`/`password_salt`) lewat
`core/DatabaseService.gs`.

### MASTER DATA (`apps-script/master-data/` dan `apps-script/users/`)

Data referensi yang digunakan oleh domain pelaporan.

- **Users** — data pengguna sistem beserta peran (role) masing-masing.
- **Locations** — data lokasi/ruang di lingkungan sekolah.
- **Categories** — kategori kerusakan/gangguan sarana-prasarana.
- **Facilities** — data fasilitas/aset sarana-prasarana.
- **Owners** — pihak/unit yang bertanggung jawab menindaklanjuti laporan pada lokasi atau kategori tertentu.

### REPORT MANAGEMENT (`apps-script/reports/`)

Domain inti sistem. Diimplementasikan pada **PHASE 4 — Legacy-Compatible Report Engine**, terbagi tiga file sesuai tanggung jawabnya:

- **Create Report, Report Validation, Report Retrieval/Listing/Update** (`ReportService.gs`) — pembuatan laporan baru beserta penetapan `report_id`/`report_number` melalui `SequenceService`; validasi kelengkapan dan konsistensi data laporan, dengan tiga tingkat berbeda untuk CREATE (strict), READ (tanpa validasi — legacy-compatible), dan UPDATE (contextual, hanya kolom yang diubah) — lihat `apps-script/reports/README.md` dan header file untuk detail.
- **Workflow** (`ReportWorkflowService.gs`) — pengendalian transisi status laporan sesuai aturan yang telah ditetapkan (lihat `docs/WORKFLOW.md`). Transisi status ilegal wajib ditolak pada lapisan ini.
- **History** (`ReportHistoryService.gs`) — pencatatan riwayat perubahan pada setiap laporan (`12_report_history`), terpisah dari audit log sistem secara umum. Dipanggil internal oleh `ReportService.gs`/`ReportWorkflowService.gs`.
- **Authorization** — pemeriksaan hak akses, memastikan hanya pengguna dengan peran/kewenangan yang sesuai yang dapat melakukan suatu aksi (mis. hanya verifikator yang dapat mengubah status ke `VERIFIED`). **BELUM diimplementasikan** — dijadwalkan **PHASE 5**; `changeReportStatus()` PHASE 4 hanya memvalidasi legalitas urutan transisi, bukan hak akses pemanggil.

### AUDIT (`apps-script/audit/`)

- **Audit Log** — pencatatan aktivitas penting di seluruh sistem (login, perubahan data master, perubahan status laporan, dsb.) ke sheet `20_audit_logs`, guna mendukung pengawasan dan investigasi.

## 3. Prinsip Arsitektur

Pengembangan sistem berpedoman pada prinsip berikut:

- **Separation of Concerns** — setiap modul memiliki satu tanggung jawab yang jelas. Logika bisnis, akses data, dan konfigurasi tidak boleh bercampur dalam satu file.
- **Service-based Design** — seluruh fungsionalitas backend diekspos melalui service yang terdefinisi jelas, bukan skrip prosedural yang tersebar.
- **Explicit Workflow Validation** — setiap perubahan status laporan wajib melalui pemeriksaan transisi yang valid; tidak ada perubahan status yang dilakukan secara langsung tanpa validasi.
- **Auditability** — setiap aktivitas penting harus dapat ditelusuri: siapa melakukan apa, kapan, dan terhadap data apa.
- **Maintainability** — struktur kode dikelompokkan berdasarkan domain agar mudah dipahami, diuji, dan dikembangkan secara bertahap tanpa mengganggu domain lain.
- **Centralized Configuration** — seluruh konfigurasi (ID spreadsheet, nama sheet, konstanta) hanya didefinisikan di `core/Config.gs`, tidak di-hardcode pada modul domain.
- **Database Isolation** — akses ke Google Spreadsheet hanya diperbolehkan melalui `DatabaseService`, tidak langsung dari modul domain.

## 4. Aturan Akses Database (Database Access Rules)

Aturan berikut bersifat **wajib (mandatory)** dan menjadi bagian dari validation gate setiap tahap pengembangan:

1. **Domain service DILARANG memanggil `SpreadsheetApp` — maupun `Config.getSpreadsheet()` — secara langsung.** Ini berlaku untuk seluruh domain: `apps-script/users/`, `apps-script/master-data/`, `apps-script/reports/`, dan `apps-script/audit/`. Seluruh kebutuhan baca/tulis/cari data pada domain-domain tersebut wajib menggunakan fungsi generik yang disediakan `core/DatabaseService.gs` (`getSheetByName`, `getAllRows`, `getRowById`, `findRows`, `insertRow`, `updateRowById`) — bukan memanggil `getSpreadsheet()` lalu mengakses objek Spreadsheet/Sheet secara langsung, meski itu tidak akan memunculkan literal teks "SpreadsheetApp" pada audit grep sederhana.
2. **Satu-satunya pengecualian adalah `core/SequenceService.gs`.** Modul ini boleh mengakses sheet `91_sequences` secara langsung (melalui `getSheetByName()`/`getHeaderRow_()` milik `DatabaseService.gs`, bukan `SpreadsheetApp` secara langsung) — bukan untuk melanggar lapisan Database Access, melainkan agar seluruh proses **READ → INCREMENT → WRITE** terhadap nilai counter dapat berjalan **atomik dalam satu `LockService.getScriptLock()` yang sama**. Jika `SequenceService` memanggil `DatabaseService.insertRow()`/`updateRowById()` (yang masing-masing memperoleh lock-nya sendiri), proses baca dan tulis akan terpisah menjadi dua lock berbeda dan celah race condition tetap terbuka di antara keduanya. Pengecualian ini **hanya berlaku untuk sheet `91_sequences`**, tidak untuk sheet lain.
3. **Jika kapabilitas `DatabaseService` belum cukup** untuk kebutuhan suatu domain, kapabilitas generik boleh ditambahkan ke `DatabaseService.gs` — **hanya jika** kapabilitas tersebut reusable (dapat dipakai domain lain), tidak spesifik terhadap satu domain bisnis, dan tetap menjaga separation of concerns. Domain service tidak boleh menduplikasi logika akses spreadsheet sendiri sebagai jalan pintas.
4. **Tidak ada domain-ke-domain coupling untuk validasi silang.** Jika satu domain perlu memvalidasi keberadaan/status data milik domain lain (mis. Facility memvalidasi Category), validasi dilakukan dengan memanggil `DatabaseService` langsung terhadap sheet domain tersebut (mis. `getRowById(CONFIG.SHEETS.CATEGORIES, ...)`), **bukan** dengan memanggil fungsi domain service milik domain lain. Ini mencegah dependency melingkar antar domain service dan menjaga setiap domain service tetap independen selain terhadap lapisan `core/`.
5. **`apps-script/tools/` bukan domain, dan tidak terikat aturan larangan pada poin 1.** Folder ini berisi utility infrastruktur one-time (mis. `SetupDatabase.gs`) yang dijalankan manual oleh pengelola sistem untuk operasi STRUKTUR (membuat sheet via `insertSheet()`, menulis header pertama kali) yang memang tidak disediakan `DatabaseService` (yang sengaja generik dan mengasumsikan sheet sudah ada dengan header valid). Utility di folder ini tetap wajib memakai `DatabaseService` untuk operasi DATA (baca/tulis baris pada sheet yang sudah tervalidasi, mis. `91_sequences`), dan setiap pemanggilan method struktural pada objek Spreadsheet/Sheet hasil `getSpreadsheet()` wajib didokumentasikan eksplisit sebagai pengecualian infrastruktur pada komentar file terkait. `apps-script/tests/` juga boleh memanggil `getSpreadsheet()` langsung, khusus untuk **menguji fungsi `Config.gs` itu sendiri** (lihat `CoreSmokeTest.gs`) — bukan untuk mengakses data domain.

Audit kepatuhan terhadap aturan ini sebaiknya mencari (grep) penggunaan literal `SpreadsheetApp` DAN pemanggilan `getSpreadsheet(` di luar `apps-script/core/`, dengan `apps-script/tools/` (operasi struktural) dan `apps-script/tests/` (pengujian `Config.gs`) sebagai pengecualian yang terdokumentasi — di luar keduanya, hasil pencarian harus kosong.
