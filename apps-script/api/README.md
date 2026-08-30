# API / Web App Entry Point (MVP)

Folder ini berisi lapisan **entry point** Web App SIGAP SARPRAS (lihat `docs/ARCHITECTURE.md`: "Google Apps Script — lapisan entry point ... yang menerima permintaan dan meneruskannya ke Service Layer"). Ditambahkan sebagai **PHASE 4.5 — MVP Usability**, di luar urutan roadmap awal (`docs/DEVELOPMENT_ROADMAP.md`), atas prioritas eksplisit: sistem harus benar-benar dapat dibuka dan diuji oleh pengguna nyata sesegera mungkin, bukan hanya berfungsi secara teoritis lewat editor Apps Script.

## Isi

- **`App.gs`** — `doGet()`, satu-satunya Web App entry point. Menyajikan `Index.html`.
- **`Index.html`** — **halaman uji coba MINIMAL** (vanilla HTML/CSS/JS, tanpa framework/CDN eksternal): identitas pengguna aktif, form buat laporan, daftar laporan, kontrol ubah status (khusus peran tertentu). **BUKAN frontend final PHASE 7** — lihat `frontend/README.md`.
- **`AuthContext.gs`** — mengidentifikasi pengguna dari sesi Google aktif (`Session.getActiveUser()`) lalu mencocokkannya ke `01_users` (`getUserByEmail`, di `apps-script/users/UserService.gs`). BUKAN autentikasi (tidak ada password) — memanfaatkan sesi Google Workspace yang sudah ada. Juga berisi `requireRole_()`, pemeriksaan peran MINIMAL (lihat catatan OPEN DESIGN DECISION di headernya).
- **`ApiUtil.gs`** — `apiRun_()`, pembungkus generik agar setiap fungsi API mengembalikan `{success, data, error}` yang konsisten (memakai `core/UtilityService.gs`).
- **`ReportApi.gs`**, **`MasterDataApi.gs`** — fungsi publik yang dipanggil dari `Index.html` lewat `google.script.run`. TIDAK ada logika bisnis di sini — hanya identifikasi pemanggil + pass-through ke Service Layer (`apps-script/reports/`, `apps-script/master-data/`) + pembungkusan response.

## Aturan Akses Database — tetap dipatuhi

Folder ini **BUKAN** domain bisnis dan **BUKAN** pengecualian baru pada aturan `docs/ARCHITECTURE.md` bagian 4. Tidak ada satu pun fungsi di sini yang memanggil `SpreadsheetApp`/`getSpreadsheet()`/`DatabaseService` langsung — seluruhnya hanya memanggil fungsi Service Layer domain yang sudah ada (`createReport`, `getUserByEmail`, `listActiveLocations`, dst.), persis seperti yang akan dilakukan frontend PHASE 7 nanti.

## Deployment (dilakukan MANUAL oleh operator, TIDAK dilakukan otomatis)

1. Pastikan `apps-script/appsscript.json` sudah ada di project Apps Script (mendefinisikan `webapp.executeAs: "USER_ACCESSING"` — WAJIB agar `Session.getActiveUser()` dapat mengidentifikasi pemanggil individual, bukan pemilik script).
2. **Periksa `webapp.access`** pada `appsscript.json` sebelum deploy — nilai default repository ini adalah `"DOMAIN"` (hanya akun dalam Google Workspace yang sama, mis. akun sekolah). Sesuaikan dengan kebijakan sekolah bila berbeda (mis. `"ANYONE_ANONYMOUS"` TIDAK direkomendasikan karena `Session.getActiveUser()` tidak dapat mengidentifikasi pengguna anonim — `getCurrentUserContext_()` akan selalu gagal).
3. Deploy sebagai **Web App** (Deploy > New deployment > Web app) dari editor Apps Script.
4. Pengguna yang mengakses URL Web App WAJIB sudah terdaftar aktif di `01_users` (lihat `apps-script/users/README.md`) dengan email yang SAMA PERSIS dengan akun Google yang dipakai mengakses — tidak ada pendaftaran mandiri (self-service) pada MVP ini.
5. Peran `VERIFIKATOR`/`OWNER`/`ADMIN` diperlukan agar kontrol "Ubah Status" muncul dan berfungsi di halaman.

## Yang SENGAJA belum termasuk (lihat laporan MVP)

- RBAC penuh per transisi status (baru aturan kasar: VERIFIKATOR/OWNER/ADMIN untuk SEMUA transisi/deaktivasi).
- Photo Engine, Comment Engine.
- Audit log integration (`AuditService` belum ada).
- `system_priority` otomatis (belum ada algoritma kanonik).
- Frontend final PHASE 7 (framework, desain, dsb.) — `Index.html` di sini murni test harness fungsional.
