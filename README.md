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

- **Google Apps Script** — platform eksekusi backend berbasis JavaScript yang berjalan di lingkungan Google.
- **Google Spreadsheet** — digunakan sebagai media penyimpanan data (database) sistem.
- **Service-based Architecture** — backend disusun dalam bentuk layanan (service) yang terpisah berdasarkan domain, untuk menjaga pemisahan tanggung jawab antara akses data dan logika bisnis.

Detail lengkap arsitektur sistem dapat dilihat pada [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Struktur Repository

```
SarprasSmada/
├── README.md                      Dokumen ini
├── package.json                   Devtool deployment (clasp) — lihat docs/DEPLOYMENT.md
├── .clasp.json.example            Template konfigurasi clasp (rootDir apps-script/, tanpa Script ID nyata)
├── .claspignore                   Mengecualikan tools/, tests/, *.md dari clasp push
├── docs/                          Dokumentasi arsitektur, workflow, skema data, roadmap, deployment
│   ├── ARCHITECTURE.md
│   ├── WORKFLOW.md
│   ├── DATABASE_SCHEMA.md
│   ├── DEVELOPMENT_ROADMAP.md
│   └── DEPLOYMENT.md
├── apps-script/                   Source code backend Google Apps Script
│   ├── README.md
│   ├── appsscript.json            Manifest Web App
│   ├── core/                      Konfigurasi, akses database, sequence, utilitas
│   ├── users/                     Domain pengguna
│   ├── master-data/               Domain data master (lokasi, kategori, fasilitas, owner)
│   ├── reports/                   Domain pelaporan & workflow
│   ├── api/                       Entry point Web App (doGet, MVP) — lihat apps-script/api/README.md
│   ├── audit/                     Domain audit log (belum diimplementasikan)
│   ├── tools/                     Utility infrastruktur one-time (TIDAK ikut deployment MVP)
│   └── tests/                     Pengujian backend (TIDAK ikut deployment MVP)
├── frontend/                      Placeholder aplikasi frontend final (belum dikembangkan)
└── .gitignore
```

## Status Pengembangan Saat Ini

Repository berada pada tahap **PHASE 4.5 — MVP Usability** (lihat [`docs/DEVELOPMENT_ROADMAP.md`](docs/DEVELOPMENT_ROADMAP.md)). Sistem sudah dapat **dibuka dan diuji pengguna nyata** lewat URL Web App (lihat [`apps-script/api/README.md`](apps-script/api/README.md)). Cara push source ke project Apps Script tanpa copy-paste manual (`clasp`) ada di [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

Yang sudah selesai:

- **PHASE 1 — Repository Foundation**: struktur repository, dokumentasi arsitektur, workflow, dan skema database.
- **PHASE 2 — Core Backend**: implementasi `apps-script/core/` (`Config.gs`, `DatabaseService.gs`, `SequenceService.gs`, `UtilityService.gs`) — konfigurasi terpusat, akses database generik ke Google Spreadsheet, dan pembangkitan ID/nomor unik yang aman dari race condition.
- **PHASE 2.5 — Core Backend Validation**: validation gate atas PHASE 2, termasuk koreksi `generateReportNumber()` agar sequence `REPORT` benar-benar monoton (tidak reset per tahun), dokumentasi eksplisit Aturan Akses Database, dan penyusunan `docs/DATABASE_SETUP.md` beserta `apps-script/tests/CoreSmokeTest.gs`.
- **PHASE 3 — Master Data**: implementasi domain Users (`UserService.gs`) dan Master Data (`LocationService.gs` dengan struktur hierarkis, `CategoryService.gs`, `FacilityService.gs`, `OwnerService.gs`), lengkap dengan validasi, soft delete, dan smoke test (`apps-script/tests/MasterDataSmokeTest.gs`).
- **PHASE 3.5 — Real Environment Validation**: inspeksi read-only nyata (`apps-script/tools/InspectDatabase.gs`, `DatabaseInspectorStandalone.gs`) terhadap database produksi SIGAP SARPRAS yang sudah berjalan sejak sebelum repository ini dibuat.
- **PHASE 3.75 — Legacy-Compatible Repository Reconciliation**: schema `11_report_photos`, `12_report_history`, `13_report_comments`, `20_audit_logs`, `91_sequences` diselaraskan mengikuti struktur produksi nyata (lihat "Reconciliation Notes" di `docs/DATABASE_SCHEMA.md`); `SequenceService.gs` kini punya sequence compatibility layer (alias resolution `sequence_name`/`sequence_key`, `current_value`/`last_value`) — **tidak ada migrasi spreadsheet**, hanya repository yang diselaraskan.
- **PHASE 4 — Legacy-Compatible Report Engine**: implementasi `apps-script/reports/` — `ReportService.gs` (Create/Retrieval/Listing/Update Report dengan validasi referensi berlapis: strict saat data baru dibuat/diubah, tanpa validasi saat membaca data legacy yang orphan), `ReportWorkflowService.gs` (transisi status sesuai `docs/WORKFLOW.md`), `ReportHistoryService.gs` (riwayat perubahan ke `12_report_history`). Lengkap dengan smoke test (`apps-script/tests/ReportEngineSmokeTest.gs`). **Tidak termasuk**: perhitungan `system_priority` otomatis (OPEN DESIGN DECISION — belum ada algoritma kanonik), Photo/Comment Engine, RBAC penuh, dan audit log — seluruhnya dijadwalkan PHASE 5.
- **PHASE 4.5 — MVP Usability**: penambahan `apps-script/api/` — Web App entry point (`App.gs`/`doGet`) yang menyajikan halaman uji coba minimal (`Index.html`), identifikasi pengguna dari sesi Google aktif + otorisasi MINIMAL berbasis peran (`AuthContext.gs`: hanya VERIFIKATOR/OWNER/ADMIN dapat mengubah status/menonaktifkan laporan), dan fungsi publik `google.script.run` (`ReportApi.gs`, `MasterDataApi.gs`). Ditambahkan di luar urutan roadmap awal, atas prioritas eksplisit: sistem harus benar-benar dapat dijalankan dan diuji oleh pengguna nyata sesegera mungkin. **Bukan** frontend final PHASE 7.

**Audit, RBAC penuh, Photo/Comment Engine, dan frontend final PHASE 7 belum diimplementasikan.** Detail lengkap fase pengembangan berikutnya dapat dilihat pada dokumen roadmap.
