# Domain: Master Data

Domain ini akan berisi layanan (`.gs`) yang mengelola data referensi yang digunakan oleh domain pelaporan, merujuk pada sheet `02_locations`, `03_categories`, `04_facilities`, dan `05_owners` (lihat `docs/DATABASE_SCHEMA.md`).

## Status

Belum ada implementasi. Folder ini disiapkan sebagai bagian dari struktur repository pada **PHASE 1 — Repository Foundation**.

## Cakupan yang Direncanakan

- Pengelolaan data lokasi (`Locations`).
- Pengelolaan data kategori kerusakan/gangguan (`Categories`).
- Pengelolaan data fasilitas/aset (`Facilities`).
- Pengelolaan data owner/penanggung jawab (`Owners`).
- Validasi relasi antar data master (mis. fasilitas harus merujuk pada lokasi dan kategori yang valid).

Implementasi dijadwalkan pada **PHASE 3 — Master Data** (lihat `docs/DEVELOPMENT_ROADMAP.md`). Seluruh akses data pada domain ini wajib melalui `apps-script/core/DatabaseService.gs`.
