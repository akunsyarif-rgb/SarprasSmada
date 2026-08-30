# Apps Script — SIGAP SARPRAS SMADA

Direktori ini berisi source code backend SIGAP SARPRAS yang berjalan di atas Google Apps Script, dengan Google Spreadsheet sebagai media penyimpanan data.

## Status

**PHASE 3.75 — Legacy-Compatible Repository Reconciliation selesai** (di atas PHASE 3 — Master Data, PHASE 3.5 — Real Environment Validation, dan PHASE 2/2.5 yang juga sudah selesai). Schema `11_report_photos`, `12_report_history`, `13_report_comments`, `20_audit_logs`, `91_sequences` kini mengikuti struktur database produksi nyata (lihat `docs/DATABASE_SCHEMA.md` bagian "Reconciliation Notes") — tidak ada migrasi spreadsheet, hanya repository yang diselaraskan.

- `core/` — `Config.gs`, `DatabaseService.gs`, `SequenceService.gs`, `UtilityService.gs`: fungsional, telah divalidasi (lihat `apps-script/tests/CoreSmokeTest.gs`).
- `users/` — `UserService.gs`: fungsional.
- `master-data/` — `LocationService.gs`, `CategoryService.gs`, `FacilityService.gs`, `OwnerService.gs`: fungsional (lihat `apps-script/tests/MasterDataSmokeTest.gs`).
- `reports/`, `audit/` — **masih placeholder** (belum ada implementasi logika bisnis), dijadwalkan pada PHASE 4 dan PHASE 5.
- `tools/` — **one-time infrastructure utility** (bukan domain service): `InspectDatabase.gs` (READ-ONLY, discovery database yang sudah ada) dan `SetupDatabase.gs` (membuat sheet/header/sequence awal). Lihat `docs/DATABASE_SETUP.md`.

### Persiapan Sebelum Menjalankan

**Jangan asumsikan database Anda kosong** — SIGAP SARPRAS pernah dikembangkan langsung di Apps Script sebelum repository ini ada. Ikuti panduan lengkap pada **`docs/DATABASE_SETUP.md`**, dimulai dari bagian "Punya Spreadsheet Lama? Baca Ini Dulu": inspeksi dulu via `InspectDatabase.gs` (read-only) sebelum menjalankan `SetupDatabase.gs`.

## Struktur Domain

| Folder | Domain | Keterangan |
|---|---|---|
| `core/` | Inti sistem | Konfigurasi, akses database, sequence generator, dan utilitas yang digunakan seluruh domain lain. |
| `users/` | Pengguna | Pengelolaan data dan layanan terkait pengguna sistem. |
| `master-data/` | Data Master | Pengelolaan lokasi, kategori, fasilitas, dan owner/penanggung jawab. |
| `reports/` | Pelaporan | Pembuatan laporan, validasi, workflow status, otorisasi, dan riwayat laporan. |
| `audit/` | Audit | Pencatatan aktivitas penting sistem untuk keperluan audit. |
| `tests/` | Pengujian | Skenario pengujian untuk seluruh service backend. |
| `tools/` | Infrastruktur | Utility setup one-time, bukan domain — lihat `docs/ARCHITECTURE.md` bagian 4 poin 5. |

## Prinsip Penulisan Kode

- Setiap domain (`users/`, `master-data/`, `reports/`, `audit/`) **dilarang** memanggil `SpreadsheetApp` secara langsung. Seluruh akses data wajib melalui fungsi generik `core/DatabaseService.gs` (`getAllRows`, `getRowById`, `findRows`, `insertRow`, `updateRowById`).
- **Pengecualian pertama**: `core/SequenceService.gs` boleh mengakses sheet `91_sequences` secara langsung, semata-mata agar operasi READ → INCREMENT → WRITE pada counter sequence tetap atomik dalam satu `LockService.getScriptLock()`.
- **Pengecualian kedua**: `apps-script/tools/SetupDatabase.gs` — utility infrastruktur one-time, bukan domain — boleh mengakses `SpreadsheetApp` langsung untuk operasi STRUKTUR (membuat sheet, menulis header) yang tidak disediakan `DatabaseService`, tetapi tetap wajib memakai `DatabaseService`/`Config.gs` untuk operasi DATA. `apps-script/tools/InspectDatabase.gs` juga di folder yang sama, tapi READ-ONLY sepenuhnya — tidak butuh pengecualian penulisan sama sekali.
- Lihat `docs/ARCHITECTURE.md` bagian 4 (Aturan Akses Database) untuk penjelasan lengkap kedua pengecualian ini.
- Seluruh konfigurasi (ID spreadsheet, nama sheet, konstanta status, prefix ID, dsb.) hanya didefinisikan di `core/Config.gs`.
- ID unik dan nomor urut (mis. nomor laporan) hanya dihasilkan melalui `core/SequenceService.gs`.
- Jika suatu domain perlu memvalidasi data milik domain lain, gunakan `DatabaseService` langsung ke sheet domain tersebut — jangan memanggil fungsi domain service lain (mencegah dependency melingkar antar domain).
- Perubahan status laporan wajib melalui validasi eksplisit pada domain `reports/` sesuai `docs/WORKFLOW.md`; transisi ilegal wajib ditolak.
- Aktivitas penting wajib dicatat melalui domain `audit/`.

Lihat `docs/ARCHITECTURE.md` untuk penjelasan lengkap mengenai pembagian domain dan prinsip arsitektur.
