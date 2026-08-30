# Domain: Users

Domain ini akan berisi layanan (`.gs`) yang mengelola data pengguna sistem SIGAP SARPRAS, merujuk pada sheet `01_users` (lihat `docs/DATABASE_SCHEMA.md`).

## Status

Belum ada implementasi. Folder ini disiapkan sebagai bagian dari struktur repository pada **PHASE 1 — Repository Foundation**.

## Cakupan yang Direncanakan

- Pengelolaan data pengguna (pendaftaran/penyesuaian data, penonaktifan akun).
- Pengambilan data pengguna berdasarkan peran (role) untuk keperluan otorisasi pada domain `reports`.

Implementasi dijadwalkan pada **PHASE 3 — Master Data** (lihat `docs/DEVELOPMENT_ROADMAP.md`). Seluruh akses data pada domain ini wajib melalui `apps-script/core/DatabaseService.gs`.
