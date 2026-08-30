# Tools

Folder ini berisi **utility infrastruktur one-time**, bukan domain bisnis. Kode di sini tidak pernah dipanggil oleh alur produksi (frontend, domain service, atau service lain) — hanya dijalankan manual oleh pengelola sistem dari editor Apps Script.

## Isi

- **`InspectDatabase.gs`** — **READ-ONLY sepenuhnya** (nol operasi tulis). Melakukan discovery terhadap spreadsheet yang sudah ada (termasuk spreadsheet lama SIGAP SARPRAS dari sebelum repository ini dibuat): sheet apa saja yang ada/hilang/asing, header cocok atau tidak dengan `docs/DATABASE_SCHEMA.md`, dan sequence yang tersedia beserta nilainya. **Jalankan ini SEBELUM `SetupDatabase.gs`** jika kondisi spreadsheet tidak diketahui pasti. Lihat `docs/DATABASE_SETUP.md` bagian 7.
- **`SetupDatabase.gs`** — membuat/memverifikasi seluruh sheet database SIGAP SARPRAS beserta header dan baris sequence awal. Idempotent (aman dijalankan berulang), tidak pernah menimpa data yang sudah ada, dan tidak pernah melakukan operasi destruktif. Lihat `docs/DATABASE_SETUP.md` bagian 8 untuk cara pakai.

## Mengapa Folder Ini Terpisah dari `core/` dan Domain Lain

- **Bukan domain** (`users/`, `master-data/`, `reports/`, `audit/`) — karena itu tidak masuk dalam aturan "domain service dilarang memanggil `SpreadsheetApp` langsung" (`docs/ARCHITECTURE.md` bagian 4).
- **Bukan bagian dari `core/`** — karena isinya bukan abstraksi yang dipakai domain service lain saat runtime, melainkan alat bantu operasional yang dijalankan sekali di awal (atau saat verifikasi berkala manual).
- Setiap akses `SpreadsheetApp` langsung di folder ini didokumentasikan eksplisit sebagai pengecualian infrastruktur pada komentar file terkait — lihat header `SetupDatabase.gs`. `InspectDatabase.gs` bahkan tidak memerlukan pengecualian penulisan sama sekali — seluruh method yang dipanggil murni baca (lihat header file tersebut untuk audit read-only-nya).
