# Tests

Folder ini berisi skenario pengujian manual untuk service backend Google Apps Script pada SIGAP SARPRAS. Test di folder ini dijalankan **manual** dari editor Apps Script (pilih fungsi lalu Run), bukan melalui automated test runner/CI — Apps Script tidak menyediakan test runner bawaan yang terintegrasi dengan repository ini.

## Status

- `CoreSmokeTest.gs` — **tersedia**. Smoke test untuk PHASE 2 — Core Backend (`Config.gs`, `DatabaseService.gs`, `SequenceService.gs`). Jalankan `runCoreSmokeTest()`.
- `MasterDataSmokeTest.gs` — **tersedia**. Smoke test untuk PHASE 3 — Master Data (`UserService.gs`, `LocationService.gs`, `CategoryService.gs`, `FacilityService.gs`, `OwnerService.gs`), mencakup create/get/update/list/deactivate, validasi gagal, deteksi duplikasi, validasi hierarki lokasi (parent-child, anti-circular), dan validasi facility-category. Jalankan `runMasterDataSmokeTest()`. Seluruh data uji ditandai awalan `TEST_` dan dinonaktifkan (bukan dihapus) di akhir skenario.
- `InspectDatabaseSmokeTest.gs` — **tersedia**. Smoke test untuk `apps-script/tools/InspectDatabase.gs` (PHASE 3.5 — Real Environment Validation). READ-ONLY sepenuhnya, aman dijalankan terhadap spreadsheet apa pun (baru maupun lama) tanpa risiko. Jalankan `runInspectDatabaseSmokeTest()`.
- Pengujian formal untuk Report Engine dan Workflow akan ditambahkan mengikuti tahap implementasinya masing-masing.

## Prinsip Pengujian di Repository Ini

- **Tidak ada operasi destruktif.** Test tidak boleh menghapus data produksi maupun melakukan hard delete.
- **Data uji ditandai jelas.** Data yang dibuat oleh test menggunakan penanda/prefix yang jelas (mis. `TEST_`) atau sequence khusus testing (`CONFIG.SEQUENCES.CORE_TEST`) yang terpisah dari sequence produksi.
- **Output jelas.** Setiap test mencetak hasil PASS/FAIL beserta detail melalui `Logger.log()`, diakhiri ringkasan jumlah PASS/FAIL.
- **Aman dijalankan berulang.** Menjalankan test yang sama beberapa kali tidak boleh merusak konsistensi data maupun sequence produksi, kecuali dinyatakan eksplisit pada dokumentasi test terkait (mis. `generateReportNumber()` pada `CoreSmokeTest.gs` memang sengaja menambah counter produksi `REPORT`, karena itulah yang diuji).

## Cakupan yang Direncanakan Selanjutnya

- Pengujian transisi status laporan (skenario legal dan ilegal) sesuai `docs/WORKFLOW.md` — PHASE 5.
- Pengujian pembuatan laporan dan perhitungan prioritas — PHASE 4.

Referensi: `docs/DEVELOPMENT_ROADMAP.md`, `docs/DATABASE_SETUP.md`.
