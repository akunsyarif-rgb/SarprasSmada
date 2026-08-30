# Domain: Reports

Domain ini merupakan inti sistem SIGAP SARPRAS, mencakup pembuatan laporan, validasi, workflow status, dan riwayat laporan. Merujuk pada sheet `10_reports`, `11_report_photos`, `12_report_history`, dan `13_report_comments` (lihat `docs/DATABASE_SCHEMA.md`).

## Status

**PHASE 4 — Legacy-Compatible Report Engine selesai** untuk Create/Retrieval/Listing/Update/Workflow/History. Lihat `apps-script/tests/ReportEngineSmokeTest.gs` untuk smoke test, dan laporan PHASE 4 (riwayat percakapan/commit) untuk detail lengkap (business rules, atomicity analysis, open design decisions, technical debt).

- `ReportService.gs` — Create Report, Report Retrieval, Report Listing, Report Update, Referential Validation (strict saat create/kolom yang diubah, TIDAK memvalidasi ulang referensi lama yang tidak disentuh — lihat catatan LEGACY COMPATIBILITY pada header file).
- `ReportWorkflowService.gs` — validasi transisi status laporan sesuai `docs/WORKFLOW.md`; transisi ilegal wajib ditolak (mis. `SUBMITTED → CLOSED`).
- `ReportHistoryService.gs` — pencatatan riwayat perubahan status/data laporan ke `12_report_history` (append-only, dipakai internal oleh dua file di atas).
- **Authorization** — BELUM diimplementasikan (pemeriksaan hak akses berdasarkan peran pengguna untuk setiap aksi pada laporan). Dijadwalkan **PHASE 5 — Workflow & Authorization** (lihat `docs/DEVELOPMENT_ROADMAP.md`).
- **Photo/Comment Engine** (`11_report_photos`, `13_report_comments`) — di luar scope PHASE 4 secara eksplisit. Report Engine kompatibel secara struktural (report_id dapat direferensikan), tetapi belum ada service pembuatan foto/komentar.
- **Audit integration** — `audit/` belum diimplementasikan (PHASE 5). Fungsi-fungsi di atas mengembalikan objek baris lengkap (state akhir) agar mudah diteruskan ke Audit Service nanti, sama seperti pola pada domain Master Data.

Seluruh akses data pada domain ini wajib melalui `apps-script/core/DatabaseService.gs` — tidak ada pemanggilan `SpreadsheetApp` langsung (lihat `docs/ARCHITECTURE.md` bagian 4).
