# Deployment — SIGAP SARPRAS MVP Web App (clasp)

Panduan ini menjelaskan cara push source `apps-script/` ke project Apps Script
BARU bernama **"SIGAP SARPRAS - MVP Web App"**, menggunakan
[`clasp`](https://github.com/google/clasp), tanpa copy-paste manual.

> **PENTING — project TERPISAH dari Database Inspector.** Project Apps Script
> **"SIGAP SARPRAS - Database Inspector"** adalah project lain, READ-ONLY,
> dan **TIDAK BOLEH** dipakai sebagai target `clasp push` di sini. Panduan
> ini HANYA untuk project MVP Web App yang BARU.

## 1. Audit runtime dependency (sudah dilakukan, ringkasan)

File yang benar-benar dibutuhkan Web App untuk berjalan (dimuat sebagai satu
scope global oleh Apps Script) — **tidak ada ketergantungan sebaliknya**
terhadap `apps-script/tools/` atau `apps-script/tests/`, dikonfirmasi lewat
audit dependency fungsi/variabel lintas file:

```
apps-script/appsscript.json
apps-script/core/{Config,DatabaseService,SequenceService,UtilityService}.gs
apps-script/users/UserService.gs
apps-script/master-data/{LocationService,CategoryService,FacilityService,OwnerService}.gs
apps-script/reports/{ReportService,ReportWorkflowService,ReportHistoryService}.gs
apps-script/api/{App,AuthContext,ApiUtil,ReportApi,MasterDataApi}.gs
apps-script/api/Index.html
```

- `doGet()` (`api/App.gs`) memanggil `HtmlService.createHtmlOutputFromFile('api/Index')`
  — nama file HARUS `api/Index.html` relatif terhadap `rootDir` (lihat bagian 2)
  agar Apps Script mengenalinya sebagai `api/Index`.
- Seluruh fungsi `google.script.run.api...()` yang dipanggil `Index.html`
  (`apiGetCurrentUser`, `apiCreateReport`, `apiListReports`,
  `apiListLocations`, `apiListCategories`, `apiGetReportStatusOptions`,
  `apiChangeReportStatus`) terkonfirmasi ADA persis di `ReportApi.gs`/
  `MasterDataApi.gs`.
- Tidak ada duplicate global function/variable di antara seluruh file
  runtime di atas.
- `SpreadsheetApp` HANYA dipanggil di satu titik: `core/Config.gs`
  (`getSpreadsheet()`) — pengecualian arsitektur yang sudah disetujui.
  `apps-script/api/` tidak pernah memanggil `SpreadsheetApp`/`DatabaseService`
  langsung, hanya Service Layer domain yang sudah ada.

**SENGAJA DIKECUALIKAN** dari deployment (lihat `.claspignore`):
`apps-script/tools/**` (utility satu-kali: `SetupDatabase.gs` menulis
struktur spreadsheet, `InspectDatabase.gs`/`DatabaseInspectorStandalone.gs`
adalah source untuk project Inspector yang terpisah), `apps-script/tests/**`
(smoke test manual — beberapa di antaranya menambah sequence produksi atau
menulis baris `TEST_` bila dijalankan, sehingga tidak boleh ikut ke Web App
yang dideploy), dan seluruh `*.md`.

## 2. Konfigurasi clasp yang disiapkan

- **`.clasp.json.example`** — template. `rootDir: "apps-script"` sehingga
  struktur folder (`core/`, `users/`, `api/`, dst.) tetap terjaga persis
  sesuai referensi `doGet()` di atas. **Tidak berisi Script ID nyata** —
  lihat bagian 3.
- **`.claspignore`** — mengecualikan `tools/**`, `tests/**`, dan `**/*.md`
  dari push.
- **`package.json`** — `devDependency` `@google/clasp` + npm script
  (`clasp:login`, `clasp:status`, `clasp:push-dry-run`, `clasp:push`,
  `clasp:open`).
- **`.gitignore`** — SUDAH mengecualikan `.clasp.json` (berisi Script ID
  spesifik environment/operator) dan `.clasprc.json` (kredensial login clasp)
  sejak awal repository ini dibuat — tidak diubah pada tahap ini.

## 3. Membuat project Apps Script BARU + Script ID (dilakukan operator)

`clasp` tidak dipakai untuk MEMBUAT project baru pada panduan ini (menghindari
risiko salah kaitkan ke spreadsheet lain) — buat manual lewat editor:

1. Buka Spreadsheet **SARPRAS SMADA** (database produksi) di Google Sheets.
2. **Extensions > Apps Script**. Ini membuat/membuka **bound script** yang
   sudah otomatis terikat ke spreadsheet tersebut (`SpreadsheetApp.openById`
   pada `core/Config.gs` tetap dipakai via `SPREADSHEET_ID` di Script
   Properties — bound/standalone tidak mengubah cara itu, tapi bound
   script lebih aman karena tidak mungkin salah kaitkan ke spreadsheet lain).
3. Ganti nama project (ikon judul di kiri atas editor) menjadi
   **"SIGAP SARPRAS - MVP Web App"** — JANGAN pakai nama/project
   "SIGAP SARPRAS - Database Inspector" yang sudah ada.
4. **Project Settings** (ikon gerigi) > salin **Script ID**.
5. Pada **Project Settings**, set **Script Property** `SPREADSHEET_ID` ke
   ID Spreadsheet SARPRAS SMADA (lihat `docs/DATABASE_SETUP.md` — WAJIB,
   `core/Config.gs` membaca nilai ini, tidak ada default/hardcode).

## 4. Perintah yang dijalankan operator (URUTAN PERSIS)

```bash
# Dari root repository:

# 1) Install clasp (devDependency, sekali saja)
npm install

# 2) Login Google (membuka browser, sekali saja per mesin)
npx clasp login

# 3) Siapkan .clasp.json dengan Script ID project MVP yang BARU dibuat
cp .clasp.json.example .clasp.json
# lalu edit .clasp.json: ganti "REPLACE_WITH_YOUR_MVP_WEB_APP_SCRIPT_ID"
# dengan Script ID dari langkah 3.4 di atas.

# 4) WAJIB: tinjau file apa saja yang akan dipush SEBELUM push sungguhan
npx clasp status
# Pastikan HANYA file di bawah ini yang muncul (bukan tools/, tests/, *.md):
#   appsscript.json, core/*.gs, users/*.gs, master-data/*.gs,
#   reports/*.gs, api/*.gs, api/Index.html

# 5) Push (baru dilakukan setelah langkah 4 dikonfirmasi benar)
npx clasp push
```

Setelah push:

```bash
# Buka project di browser untuk deploy sebagai Web App
npx clasp open
```

Di editor: **Deploy > New deployment > Web app**. Periksa `webapp.access`
pada `apps-script/appsscript.json` (default repo ini: `"DOMAIN"`) sesuai
kebijakan Google Workspace sekolah sebelum deploy — lihat
`apps-script/api/README.md` bagian Deployment untuk detail lengkap
(termasuk kenapa `executeAs: "USER_ACCESSING"` wajib).

## 5. Yang TIDAK dilakukan panduan/perintah ini

- **Tidak** menjalankan `setupDatabase()`, migration, atau smoke test apa
  pun — file-file tersebut memang sengaja tidak ikut terpush (bagian 1).
- **Tidak** mengubah struktur/data Spreadsheet SARPRAS SMADA.
- **Tidak** menyentuh project "SIGAP SARPRAS - Database Inspector".
- **Tidak** melakukan `clasp push` secara otomatis — Script ID dan
  persetujuan eksplisit operator diperlukan lebih dulu (bagian 3-4).

Referensi terkait: `apps-script/api/README.md` (arsitektur & batasan MVP),
`docs/DATABASE_SETUP.md` (Script Property `SPREADSHEET_ID`),
`docs/ARCHITECTURE.md` (Aturan Akses Database).
