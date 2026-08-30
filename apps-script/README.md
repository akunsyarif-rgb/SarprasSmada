# Apps Script — SIGAP SARPRAS SMADA

Direktori ini berisi source code backend SIGAP SARPRAS yang berjalan di atas Google Apps Script, dengan Google Spreadsheet sebagai media penyimpanan data.

## Status

Direktori ini saat ini berisi **kerangka struktur (scaffold) berdasarkan domain**, bukan implementasi logika bisnis. Setiap file `.gs` pada tahap ini merupakan **placeholder berisi dokumentasi tanggung jawab modul**, belum berisi kode produksi. Implementasi akan dilakukan bertahap mengikuti `docs/DEVELOPMENT_ROADMAP.md`.

## Struktur Domain

| Folder | Domain | Keterangan |
|---|---|---|
| `core/` | Inti sistem | Konfigurasi, akses database, sequence generator, dan utilitas yang digunakan seluruh domain lain. |
| `users/` | Pengguna | Pengelolaan data dan layanan terkait pengguna sistem. |
| `master-data/` | Data Master | Pengelolaan lokasi, kategori, fasilitas, dan owner/penanggung jawab. |
| `reports/` | Pelaporan | Pembuatan laporan, validasi, workflow status, otorisasi, dan riwayat laporan. |
| `audit/` | Audit | Pencatatan aktivitas penting sistem untuk keperluan audit. |
| `tests/` | Pengujian | Skenario pengujian untuk seluruh service backend. |

## Prinsip Penulisan Kode (berlaku mulai PHASE 2)

- Setiap domain hanya boleh berkomunikasi dengan Google Spreadsheet melalui `core/DatabaseService.gs` — tidak ada pemanggilan `SpreadsheetApp` secara langsung di luar `core/`.
- Seluruh konfigurasi (ID spreadsheet, nama sheet, konstanta status, dsb.) hanya didefinisikan di `core/Config.gs`.
- ID unik dan nomor urut (mis. nomor laporan) hanya dihasilkan melalui `core/SequenceService.gs`.
- Perubahan status laporan wajib melalui validasi eksplisit pada domain `reports/` sesuai `docs/WORKFLOW.md`; transisi ilegal wajib ditolak.
- Aktivitas penting wajib dicatat melalui domain `audit/`.

Lihat `docs/ARCHITECTURE.md` untuk penjelasan lengkap mengenai pembagian domain dan prinsip arsitektur.
