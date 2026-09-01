# SIGAP SARPRAS SMADA

**SIGAP SARPRAS** (Sistem Informasi Gerak cepat Pelaporan Sarana Prasarana) adalah sistem informasi pelaporan dan pengelolaan sarana-prasarana untuk lingkungan SMA Negeri 2 (SMADA). Sistem ini dibangun untuk menggantikan proses pelaporan kerusakan/gangguan fasilitas sekolah yang selama ini dilakukan secara manual, menjadi proses yang terstruktur, terlacak, dan dapat diaudit.

## Tujuan Sistem

- Memberikan kanal pelaporan sarana-prasarana yang mudah diakses oleh seluruh warga sekolah (siswa, guru, staf).
- Memastikan setiap laporan yang masuk dapat diverifikasi, ditindaklanjuti, dan diselesaikan melalui alur kerja (workflow) yang jelas dan konsisten.
- Menyediakan visibilitas status laporan secara real-time bagi pelapor maupun penanggung jawab sarana-prasarana.
- Membangun riwayat dan jejak audit (audit trail) atas setiap laporan dan perubahan yang terjadi di dalamnya.
- Menjadi dasar pengambilan keputusan terkait prioritas perbaikan dan pengelolaan aset sekolah.

## Fitur Utama

Fitur utama sistem (akan dikembangkan secara bertahap sesuai roadmap):

- **Pelaporan Kerusakan/Gangguan** — pengguna dapat melaporkan kondisi sarana-prasarana beserta lokasi, kategori, tingkat dampak, dan risiko keselamatan.
- **Verifikasi Laporan** — laporan yang masuk diverifikasi oleh pihak berwenang sebelum ditindaklanjuti.
- **Penugasan & Penanganan** — laporan yang terverifikasi ditugaskan kepada penanggung jawab (owner) untuk ditindaklanjuti.
- **Pelacakan Status** — setiap laporan memiliki status yang berubah mengikuti alur kerja yang telah divalidasi.
- **Riwayat & Komentar Laporan** — setiap laporan memiliki riwayat perubahan dan ruang komunikasi antara pelapor dan penanggung jawab.
- **Audit Log** — seluruh aktivitas penting di sistem tercatat untuk keperluan pengawasan dan evaluasi.
- **Data Master** — pengelolaan data pengguna, lokasi, kategori, fasilitas, dan pemilik/penanggung jawab (owner) sarana-prasarana.

## Workflow Laporan

Setiap laporan sarana-prasarana mengikuti alur status berikut:

```
SUBMITTED → VERIFIED → ASSIGNED → IN_PROGRESS → COMPLETED → CLOSED
```

Setiap transisi status harus melalui validasi eksplisit. Transisi yang tidak sesuai urutan (misalnya `SUBMITTED → CLOSED`) akan ditolak oleh sistem. Penjelasan lengkap mengenai arti setiap status dan aturan transisi dapat dilihat pada [`docs/WORKFLOW.md`](docs/WORKFLOW.md).

## Teknologi Utama

- **Google Apps Script** — platform eksekusi backend berbasis JavaScript yang berjalan di lingkungan Google, dideploy lewat `clasp` (lihat [`docs/GAS_CLASP_DEPLOY.md`](docs/GAS_CLASP_DEPLOY.md)).
- **Google Spreadsheet** — digunakan sebagai media penyimpanan data (database) sistem.
- **Service-based Architecture** — backend disusun dalam bentuk layanan (service) yang terpisah berdasarkan domain, untuk menjaga pemisahan tanggung jawab antara akses data dan logika bisnis.
- **Frontend statis tanpa build step** (`frontend/`) — React tanpa JSX/bundler, di-hosting terpisah dari project Apps Script, berkomunikasi lewat JSON API bertoken (`fetch()` ke `apps-script/api/App.gs`). Pola yang sama dengan aplikasi SIGAP: penyimpanan di Spreadsheet, "sisanya" (frontend + tooling deploy) di GitHub.

Detail lengkap arsitektur sistem dapat dilihat pada [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Struktur Repository

```
SarprasSmada/
├── README.md                      Dokumen ini
├── docs/                          Dokumentasi arsitektur, workflow, skema data, dan roadmap
│   ├── ARCHITECTURE.md
│   ├── WORKFLOW.md
│   ├── DATABASE_SCHEMA.md
│   └── DEVELOPMENT_ROADMAP.md
├── apps-script/                   Source code backend Google Apps Script
│   ├── README.md
│   ├── core/                      Konfigurasi, akses database, sequence, utilitas
│   ├── auth/                      Autentikasi (login/password/sesi bertoken)
│   ├── users/                     Domain data pengguna
│   ├── master-data/               Domain data master (lokasi, kategori, fasilitas, owner)
│   ├── reports/                   Domain pelaporan & workflow
│   ├── audit/                     Domain audit log
│   ├── api/                       JSON API bertoken (doGet/doPost), dipanggil frontend/
│   └── tests/                     Pengujian backend
├── frontend/                      Aplikasi frontend statis (React tanpa build step)
├── .clasp.json.example            Template konfigurasi clasp (salin ke .clasp.json)
├── package.json                   Script npm untuk deploy backend via clasp
└── .gitignore
```

## Status Pengembangan Saat Ini

Repository berada pada tahap **PHASE 4.75 — Decoupled Frontend & Token Authentication** (lihat [`docs/DEVELOPMENT_ROADMAP.md`](docs/DEVELOPMENT_ROADMAP.md)). Sistem sudah punya frontend fungsional (`frontend/`) yang terpisah dari backend, dideploy independen — persis pola yang diminta: penyimpanan di Google Spreadsheet, sisanya di GitHub. Lihat [`docs/GAS_CLASP_DEPLOY.md`](docs/GAS_CLASP_DEPLOY.md) untuk cara deploy backend dan [`frontend/README.md`](frontend/README.md) untuk cara deploy frontend.

Yang sudah selesai:

- **PHASE 1 — Repository Foundation**: struktur repository, dokumentasi arsitektur, workflow, dan skema database.
- **PHASE 2 — Core Backend**: implementasi `apps-script/core/` (`Config.gs`, `DatabaseService.gs`, `SequenceService.gs`, `UtilityService.gs`) — konfigurasi terpusat, akses database generik ke Google Spreadsheet, dan pembangkitan ID/nomor unik yang aman dari race condition.
- **PHASE 2.5 — Core Backend Validation**: validation gate atas PHASE 2, termasuk koreksi `generateReportNumber()` agar sequence `REPORT` benar-benar monoton (tidak reset per tahun), dokumentasi eksplisit Aturan Akses Database, dan penyusunan `docs/DATABASE_SETUP.md` beserta `apps-script/tests/CoreSmokeTest.gs`.
- **PHASE 3 — Master Data**: implementasi domain Users (`UserService.gs`) dan Master Data (`LocationService.gs` dengan struktur hierarkis, `CategoryService.gs`, `FacilityService.gs`, `OwnerService.gs`), lengkap dengan validasi, soft delete, dan smoke test (`apps-script/tests/MasterDataSmokeTest.gs`).
- **PHASE 3.5 — Real Environment Validation**: inspeksi read-only nyata (`apps-script/tools/InspectDatabase.gs`, `DatabaseInspectorStandalone.gs`) terhadap database produksi SIGAP SARPRAS yang sudah berjalan sejak sebelum repository ini dibuat.
- **PHASE 3.75 — Legacy-Compatible Repository Reconciliation**: schema `11_report_photos`, `12_report_history`, `13_report_comments`, `20_audit_logs`, `91_sequences` diselaraskan mengikuti struktur produksi nyata (lihat "Reconciliation Notes" di `docs/DATABASE_SCHEMA.md`); `SequenceService.gs` kini punya sequence compatibility layer (alias resolution `sequence_name`/`sequence_key`, `current_value`/`last_value`) — **tidak ada migrasi spreadsheet**, hanya repository yang diselaraskan.
- **PHASE 4 — Legacy-Compatible Report Engine**: implementasi `apps-script/reports/` — `ReportService.gs` (Create/Retrieval/Listing/Update Report dengan validasi referensi berlapis: strict saat data baru dibuat/diubah, tanpa validasi saat membaca data legacy yang orphan), `ReportWorkflowService.gs` (transisi status sesuai `docs/WORKFLOW.md`), `ReportHistoryService.gs` (riwayat perubahan ke `12_report_history`). Lengkap dengan smoke test (`apps-script/tests/ReportEngineSmokeTest.gs`). **Tidak termasuk**: perhitungan `system_priority` otomatis (OPEN DESIGN DECISION — belum ada algoritma kanonik), Photo/Comment Engine, RBAC penuh, dan audit log — seluruhnya dijadwalkan PHASE 5.
- **PHASE 4.5 — MVP Usability**: penambahan `apps-script/api/` — Web App entry point yang menyajikan halaman uji coba minimal (`google.script.run` + sesi Google aktif). **Digantikan PHASE 4.75** (lihat berikutnya) — `Index.html` dan pola `google.script.run` sudah dihapus.
- **PHASE 4.75 — Decoupled Frontend & Token Authentication**: frontend statis (`frontend/`) di-hosting terpisah dari project Apps Script, berkomunikasi lewat JSON API bertoken (`apps-script/api/App.gs`, `doGet`/`doPost`). Autentikasi beralih dari sesi Google (`Session.getActiveUser()`) ke username(email)/password + sesi bertoken (domain baru `apps-script/auth/`). Mencakup seluruh fitur backend yang sudah ada (laporan, workflow, data master, pengguna). Tooling deploy backend lewat `clasp` ditambahkan (lihat `docs/GAS_CLASP_DEPLOY.md`). Ditambahkan di luar urutan roadmap awal, menuntaskan **PHASE 7 — Frontend** secara fungsional lebih awal (desain/UX belum digarap). **Perilaku CORS Web App dari origin terpisah belum diverifikasi end-to-end** — lihat `frontend/README.md`.

**Audit, RBAC penuh, Photo/Comment Engine, dan desain/UX frontend final belum diimplementasikan.** Detail lengkap fase pengembangan berikutnya dapat dilihat pada dokumen roadmap.
