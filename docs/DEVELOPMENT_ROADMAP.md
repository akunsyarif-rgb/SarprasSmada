# Roadmap Pengembangan — SIGAP SARPRAS SMADA

Dokumen ini menjelaskan tahapan pengembangan SIGAP SARPRAS dari fondasi repository hingga sistem siap produksi. Setiap fase dikerjakan secara bertahap dan tidak melompati fase sebelumnya, sejalan dengan prinsip kejelasan alur kerja yang dianut sistem ini.

## PHASE 1 — Repository Foundation

Status: **Selesai**

- Menyusun struktur repository (`docs/`, `apps-script/`, `frontend/`).
- Menyusun dokumentasi arsitektur (`ARCHITECTURE.md`), workflow (`WORKFLOW.md`), dan skema database (`DATABASE_SCHEMA.md`).
- Menyiapkan kerangka folder source code Google Apps Script berdasarkan domain, tanpa implementasi logika bisnis.
- Menyusun roadmap pengembangan.

## PHASE 2 — Core Backend

Status: **Selesai**

- Implementasi `Config.gs` — konfigurasi ID spreadsheet (via Script Properties, key `SPREADSHEET_ID`), pemetaan nama sheet, timezone (`Asia/Makassar`), dan konstanta sistem.
- Implementasi `DatabaseService.gs` — operasi baca/tulis/cari generik terhadap Google Spreadsheet (`getAllRows`, `getRowById`, `findRows`, `insertRow`, `updateRowById`), dilindungi `LockService` pada operasi tulis.
- Implementasi `SequenceService.gs` — pembangkitan ID unik dan nomor laporan (`getNextSequence`, `padNumber`, `generateEntityId`, `generateReportNumber`), atomik menggunakan `LockService.getScriptLock()`.
- Implementasi `UtilityService.gs` — fungsi bantu lintas domain (format timestamp, validasi umum, struktur response standar).
- **Belum termasuk**: pembuatan sheet aktual pada Google Spreadsheet (`90_settings`, `91_sequences`, dsb.) — ini merupakan langkah operasional yang dilakukan di sisi Google Sheets, bukan bagian dari source code.

## PHASE 2.5 — Core Backend Validation

Status: **Selesai**

Validation gate sebelum melanjutkan ke PHASE 3, mengoreksi temuan pada implementasi PHASE 2:

- Koreksi `SequenceService.generateReportNumber()` — sebelumnya menurunkan sequence key per tahun (mis. `REPORT_2026`), diperbaiki menjadi satu sequence global monoton `CONFIG.SEQUENCES.REPORT` yang tidak pernah direset; tahun pada `report_number` kini murni tampilan.
- Penambahan `CONFIG.SEQUENCES.CORE_TEST` dan `CONFIG.ID_PREFIXES.CORE_TEST` khusus kebutuhan smoke test, terpisah dari sequence produksi.
- Dokumentasi eksplisit Aturan Akses Database pada `docs/ARCHITECTURE.md` (bagian 4) dan `apps-script/README.md`, termasuk penjelasan pengecualian `SequenceService` untuk menjaga operasi atomik.
- Penyusunan `docs/DATABASE_SETUP.md` — panduan operasional pembuatan spreadsheet, penyimpanan `SPREADSHEET_ID` di Script Properties, daftar seluruh sheet dan header, serta nilai awal sequence.
- Penyusunan `apps-script/tests/CoreSmokeTest.gs` — smoke test manual untuk Config, DatabaseService, dan SequenceService.
- Koreksi contoh format `report_number` dan deskripsi `91_sequences` pada `docs/DATABASE_SCHEMA.md` agar konsisten dengan desain sequence yang telah dikoreksi.

## PHASE 3 — Master Data

Status: **Selesai**

- Implementasi layanan CRUD untuk data pengguna (`01_users`) — `apps-script/users/UserService.gs`.
- Implementasi layanan CRUD untuk lokasi hierarkis (`02_locations`), kategori (`03_categories`), fasilitas (`04_facilities`), dan owner (`05_owners`) — `apps-script/master-data/`.
- Validasi relasi antar data master (mis. fasilitas harus merujuk kategori yang valid dan aktif; lokasi anak tidak boleh membentuk circular hierarchy terhadap induknya).
- Soft delete (`is_active`) untuk seluruh entitas Master Data — tidak ada hard delete.
- Penyusunan `apps-script/tests/MasterDataSmokeTest.gs` — smoke test manual untuk seluruh domain Master Data.

## PHASE 4 — Report Engine

- Implementasi pembuatan laporan baru (`Create Report`) beserta penetapan `report_number` melalui `SequenceService`.
- Implementasi validasi data laporan (`Report Validation`).
- Implementasi pencatatan lampiran laporan (`11_report_photos`) dan komentar (`13_report_comments`).
- Implementasi perhitungan `system_priority` berdasarkan kategori, `impact_level`, dan `safety_risk`.

## PHASE 5 — Workflow & Authorization

- Implementasi validasi transisi status laporan sesuai `docs/WORKFLOW.md`, termasuk penolakan transisi ilegal.
- Implementasi pencatatan riwayat perubahan laporan (`12_report_history`).
- Implementasi otorisasi berbasis peran (role) untuk setiap aksi pada laporan (mis. siapa yang berhak memverifikasi, menugaskan, atau menutup laporan).
- Implementasi pencatatan audit log (`20_audit_logs`) untuk seluruh aktivitas penting di sistem.

## PHASE 6 — Testing

- Penyusunan skenario pengujian untuk setiap service pada `apps-script/tests/`.
- Pengujian transisi status legal dan ilegal.
- Pengujian validasi data master dan laporan.
- Pengujian konsistensi pembangkitan ID/nomor laporan.

## PHASE 7 — Frontend

- Perancangan antarmuka pelaporan untuk pengguna (pelapor).
- Perancangan antarmuka verifikasi dan penanganan laporan untuk verifikator/owner.
- Integrasi frontend dengan backend Google Apps Script.

## PHASE 8 — Production Readiness

- Peninjauan keamanan (hak akses spreadsheet, validasi input, penanganan kesalahan).
- Peninjauan performa (efisiensi operasi terhadap Google Spreadsheet).
- Penyusunan dokumentasi pengguna dan panduan operasional.
- Persiapan proses deployment dan pemantauan pasca-produksi.

---

**Catatan:** Roadmap ini bersifat hidup (living document) dan dapat disesuaikan seiring kebutuhan yang ditemukan pada setiap fase. Perubahan lingkup pada suatu fase sebaiknya didokumentasikan agar riwayat keputusan arsitektur tetap dapat ditelusuri.
