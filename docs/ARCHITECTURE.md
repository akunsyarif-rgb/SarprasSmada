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
- **Frontend Application** — antarmuka yang digunakan pengguna untuk mengirim laporan dan memantau status. Belum dikembangkan pada tahap ini (lihat `frontend/README.md`).
- **Google Apps Script** — lapisan entry point (mis. Web App `doGet`/`doPost` atau fungsi yang dipanggil frontend) yang menerima permintaan dan meneruskannya ke Service Layer.
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

### MASTER DATA (`apps-script/master-data/` dan `apps-script/users/`)

Data referensi yang digunakan oleh domain pelaporan.

- **Users** — data pengguna sistem beserta peran (role) masing-masing.
- **Locations** — data lokasi/ruang di lingkungan sekolah.
- **Categories** — kategori kerusakan/gangguan sarana-prasarana.
- **Facilities** — data fasilitas/aset sarana-prasarana.
- **Owners** — pihak/unit yang bertanggung jawab menindaklanjuti laporan pada lokasi atau kategori tertentu.

### REPORT MANAGEMENT (`apps-script/reports/`)

Domain inti sistem, mencakup:

- **Create Report** — pembuatan laporan baru beserta penetapan ID dan nomor laporan unik.
- **Report Validation** — validasi kelengkapan dan konsistensi data laporan sebelum disimpan atau diubah.
- **Workflow** — pengendalian transisi status laporan sesuai aturan yang telah ditetapkan (lihat `docs/WORKFLOW.md`). Transisi status ilegal wajib ditolak pada lapisan ini.
- **Authorization** — pemeriksaan hak akses, memastikan hanya pengguna dengan peran/kewenangan yang sesuai yang dapat melakukan suatu aksi (mis. hanya verifikator yang dapat mengubah status ke `VERIFIED`).
- **History** — pencatatan riwayat perubahan pada setiap laporan (`12_report_history`), terpisah dari audit log sistem secara umum.

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
