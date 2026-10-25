# STATUS — SIGAP SARPRAS SMADA (SarprasSmada)

_Disusun 25 Oktober 2026 dari isi repo (commit terakhir 2 Sep 2026, PR #3). Hanya fakta yang tertulis di repo; yang tidak bisa diverifikasi dari repo ditandai._

## Ringkasan
Sistem informasi pelaporan dan pengelolaan sarana-prasarana SMA Negeri 2 Tarakan: warga sekolah melaporkan kerusakan atau gangguan, lalu laporan diverifikasi, ditugaskan, dan diselesaikan. Alur status: SUBMITTED → VERIFIED → ASSIGNED → IN_PROGRESS → COMPLETED → CLOSED. Repo public. **Tidak ada commit sejak 2 September.** Roadmap hidup ada di `docs/DEVELOPMENT_ROADMAP.md`.

## Stack
Backend Google Apps Script, penyimpanan Google Spreadsheet, arsitektur berbasis service per domain (`apps-script/`). Frontend statis tanpa build (React tanpa JSX/bundler, `frontend/`), di-hosting terpisah dan berbicara lewat JSON API bertoken. Deploy lewat `clasp` (butuh terminal), dan ada jalur deploy tanpa command line (browser/iPad) yang dipulihkan pada 2 Sep.

## Sudah ada (status "Selesai" di roadmap)
- Fase 1: fondasi repo dan dokumentasi (arsitektur, workflow, skema database).
- Fase 2 dan 2.5: backend inti (Config, DatabaseService dengan LockService, SequenceService, UtilityService) dan validasinya.
- Fase 3: data master (pengguna, lokasi hierarkis, kategori, fasilitas, owner) dengan soft delete.
- Fase 3.75: penyelarasan skema dengan struktur database produksi yang sudah ada.
- Fase 4: Report Engine (buat laporan, daftar, transisi status dengan validasi, riwayat).
- Fase 4.5: lapisan Web App MVP agar bisa dibuka dan diuji.
- Fase 4.75: frontend terpisah dengan autentikasi password dan token.
- Fase 7 (fungsional): frontend fungsional sudah ada lewat Fase 4.75, tetapi desain/UX belum digarap.
- Smoke test manual di `apps-script/tests/` untuk core, master data, report engine, kompatibilitas sequence, dan inspeksi database.

## Belum / terbuka
- Fase 5 (otorisasi per peran yang lebih halus, `AuditService` untuk audit log, lampiran foto dan komentar laporan, perhitungan `system_priority`) belum selesai.
- Fase 6 (skenario pengujian per service) dan Fase 8 (tinjauan keamanan dan performa, dokumentasi pengguna, persiapan produksi) tidak diberi status selesai.
- Desain visual dan antarmuka per peran (pelapor vs verifikator/owner) belum ada; saat ini satu antarmuka generik.
- Algoritma kanonik `system_priority` masih menunggu konfirmasi (tertulis sebagai keputusan desain terbuka).
- Tidak ada workflow CI dan tidak ada tes otomatis, hanya smoke test manual.
- Tidak tercatat: apakah sistem ini sudah dipakai warga sekolah.

## Hal yang perlu diwaspadai
- `SPREADSHEET_ID` disimpan di Script Properties, bukan di repo. Sheet harus dibuat manual sesuai `docs/DATABASE_SETUP.md`.
- Tidak ada hard delete; entitas master memakai `is_active`.
- Transisi status yang tidak berurutan (mis. SUBMITTED → CLOSED) sengaja ditolak.
- Jangan dicampur dengan SIGAP (gerbang/absensi); ini aplikasi terpisah.

## Dokumen penting
`README.md`, `docs/DEVELOPMENT_ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/WORKFLOW.md`, `docs/DATABASE_SCHEMA.md`, `docs/DATABASE_SETUP.md`, `docs/GAS_CLASP_DEPLOY.md`.

## Langkah berikutnya (usulan, bukan dari repo)
Putuskan apakah proyek dilanjutkan; jika ya, kerjakan Fase 5 mulai dari audit log dan otorisasi per peran.

---
Perbarui file ini di akhir tiap sesi kerja: tanggal, apa yang selesai, apa yang terbuka.
