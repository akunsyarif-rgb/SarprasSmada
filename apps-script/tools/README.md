# Tools

Folder ini berisi **utility infrastruktur one-time**, bukan domain bisnis. Kode di sini tidak pernah dipanggil oleh alur produksi (frontend, domain service, atau service lain) — hanya dijalankan manual oleh pengelola sistem dari editor Apps Script.

## Isi

- **`SetupDatabase.gs`** — membuat/memverifikasi seluruh sheet database SIGAP SARPRAS beserta header dan baris sequence awal. Idempotent (aman dijalankan berulang), tidak pernah menimpa data yang sudah ada, dan tidak pernah melakukan operasi destruktif. Lihat `docs/DATABASE_SETUP.md` untuk cara pakai.

## Mengapa Folder Ini Terpisah dari `core/` dan Domain Lain

- **Bukan domain** (`users/`, `master-data/`, `reports/`, `audit/`) — karena itu tidak masuk dalam aturan "domain service dilarang memanggil `SpreadsheetApp` langsung" (`docs/ARCHITECTURE.md` bagian 4).
- **Bukan bagian dari `core/`** — karena isinya bukan abstraksi yang dipakai domain service lain saat runtime, melainkan alat bantu operasional yang dijalankan sekali di awal (atau saat verifikasi berkala manual).
- Setiap akses `SpreadsheetApp` langsung di folder ini didokumentasikan eksplisit sebagai pengecualian infrastruktur pada komentar file terkait — lihat header `SetupDatabase.gs`.
