# Apps Script — SIGAP SARPRAS SMADA

Direktori ini berisi source code backend SIGAP SARPRAS yang berjalan di atas Google Apps Script, dengan Google Spreadsheet sebagai media penyimpanan data.

## Status

**PHASE 2 — Core Backend selesai diimplementasikan.** Modul `core/` (`Config.gs`, `DatabaseService.gs`, `SequenceService.gs`, `UtilityService.gs`) sudah berisi implementasi fungsional dan siap digunakan oleh domain services.

Domain `users/`, `master-data/`, `reports/`, `audit/`, dan `tests/` **masih berupa placeholder** (belum ada implementasi logika bisnis) dan akan dikerjakan bertahap mengikuti `docs/DEVELOPMENT_ROADMAP.md`.

### Persiapan Sebelum Menjalankan

Sebelum core backend dapat berfungsi, Spreadsheet ID database wajib diset sebagai Script Property dengan key `SPREADSHEET_ID` (Project Settings > Script Properties pada editor Apps Script). Spreadsheet tersebut wajib memiliki sheet-sheet sesuai `docs/DATABASE_SCHEMA.md`, termasuk `91_sequences` dengan kolom `sequence_key`, `last_value`, dan `updated_at`.

## Struktur Domain

| Folder | Domain | Keterangan |
|---|---|---|
| `core/` | Inti sistem | Konfigurasi, akses database, sequence generator, dan utilitas yang digunakan seluruh domain lain. |
| `users/` | Pengguna | Pengelolaan data dan layanan terkait pengguna sistem. |
| `master-data/` | Data Master | Pengelolaan lokasi, kategori, fasilitas, dan owner/penanggung jawab. |
| `reports/` | Pelaporan | Pembuatan laporan, validasi, workflow status, otorisasi, dan riwayat laporan. |
| `audit/` | Audit | Pencatatan aktivitas penting sistem untuk keperluan audit. |
| `tests/` | Pengujian | Skenario pengujian untuk seluruh service backend. |

## Prinsip Penulisan Kode

- Setiap domain hanya boleh berkomunikasi dengan Google Spreadsheet melalui `core/DatabaseService.gs` — tidak ada pemanggilan `SpreadsheetApp` secara langsung di luar `core/`.
- Seluruh konfigurasi (ID spreadsheet, nama sheet, konstanta status, dsb.) hanya didefinisikan di `core/Config.gs`.
- ID unik dan nomor urut (mis. nomor laporan) hanya dihasilkan melalui `core/SequenceService.gs`.
- Perubahan status laporan wajib melalui validasi eksplisit pada domain `reports/` sesuai `docs/WORKFLOW.md`; transisi ilegal wajib ditolak.
- Aktivitas penting wajib dicatat melalui domain `audit/`.

Lihat `docs/ARCHITECTURE.md` untuk penjelasan lengkap mengenai pembagian domain dan prinsip arsitektur.
