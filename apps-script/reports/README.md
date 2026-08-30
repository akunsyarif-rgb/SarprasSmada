# Domain: Reports

Domain ini merupakan inti sistem SIGAP SARPRAS, mencakup pembuatan laporan, validasi, workflow status, otorisasi, dan riwayat laporan. Merujuk pada sheet `10_reports`, `11_report_photos`, `12_report_history`, dan `13_report_comments` (lihat `docs/DATABASE_SCHEMA.md`).

## Status

Belum ada implementasi. Folder ini disiapkan sebagai bagian dari struktur repository pada **PHASE 1 — Repository Foundation**.

## Cakupan yang Direncanakan

- **Create Report** — pembuatan laporan baru beserta penetapan `report_number` melalui `SequenceService`.
- **Report Validation** — validasi kelengkapan dan konsistensi data laporan.
- **Workflow** — validasi transisi status laporan sesuai `docs/WORKFLOW.md`; transisi ilegal wajib ditolak (mis. `SUBMITTED → CLOSED`).
- **Authorization** — pemeriksaan hak akses berdasarkan peran pengguna untuk setiap aksi pada laporan.
- **History** — pencatatan riwayat perubahan status/data laporan ke `12_report_history`.

Implementasi dijadwalkan pada **PHASE 4 — Report Engine** dan **PHASE 5 — Workflow & Authorization** (lihat `docs/DEVELOPMENT_ROADMAP.md`). Seluruh akses data pada domain ini wajib melalui `apps-script/core/DatabaseService.gs`, dan seluruh perubahan status wajib tercatat melalui domain `audit`.
