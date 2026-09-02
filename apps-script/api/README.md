# API / Web App Entry Point

Folder ini berisi lapisan **entry point** Web App SIGAP SARPRAS (lihat
`docs/ARCHITECTURE.md`: "Google Apps Script — lapisan entry point ... yang
menerima permintaan dan meneruskannya ke Service Layer").

## Perubahan arsitektur (menggantikan PHASE 4.5 — MVP Usability)

Versi sebelumnya folder ini menyajikan `api/Index.html` — sebuah halaman uji
coba minimal yang disajikan langsung oleh `doGet()` lewat `HtmlService`, dan
client-nya memanggil backend lewat `google.script.run`. Pola itu **hanya bisa
bekerja ketika HTML disajikan oleh project Apps Script yang sama** — begitu
frontend dipindah ke hosting terpisah (`frontend/`, lihat README repo utama),
`google.script.run` tidak lagi bisa dipakai sama sekali.

Folder ini sekarang berisi **JSON API bertoken** (`doGet`/`doPost`), dipanggil
dari `frontend/` lewat `fetch()`. `api/Index.html` sudah **dihapus** —
lihat riwayat commit bila perlu merujuknya.

## Isi

- **`App.gs`** — `doGet()`/`doPost()`, satu-satunya Web App entry point.
  Memeriksa token API statis (`checkToken_()`, lihat `core/Config.gs`
  `getApiToken()`), lalu meneruskan ke `route*Action_()` berdasarkan
  parameter `action`.
- **`AuthContext.gs`** — mengidentifikasi pengguna dari **token sesi**
  (`requireSession_()`, lihat `apps-script/auth/AuthService.gs`
  `getSessionUser()`) — BUKAN lagi dari `Session.getActiveUser()`. Juga
  berisi `requireRole_()`, pemeriksaan peran MINIMAL (lihat catatan OPEN
  DESIGN DECISION di headernya).
- **`ApiUtil.gs`** — `apiRun_()`, pembungkus generik agar setiap fungsi API
  mengembalikan `{success, data, error}` yang konsisten (memakai
  `core/UtilityService.gs`).
- **`AuthApi.gs`** — login/logout/ganti password/set password (admin).
- **`UserApi.gs`** — CRUD data pengguna (ADMIN saja).
- **`ReportApi.gs`**, **`MasterDataApi.gs`** — fungsi publik untuk laporan
  dan data master (lokasi/kategori/fasilitas/owner). TIDAK ada logika bisnis
  di sini — hanya identifikasi pemanggil + pass-through ke Service Layer
  (`apps-script/reports/`, `apps-script/master-data/`) + pembungkusan
  response.

## Dua lapis token — jangan tertukar

1. **Token API statis** (`token` pada setiap request, GET maupun POST) —
   Script Property `API_TOKEN`. Gerbang pertama, diperiksa sebelum action
   apa pun diproses. Bukan autentikasi pengguna.
2. **Token sesi** (`sessionToken` pada body/query tiap action, kecuali
   `status`/`login`) — hasil `AuthService.login()`, mengidentifikasi
   pengguna yang sedang login. Ini yang sesungguhnya menentukan hak akses.

## Aturan Akses Database — tetap dipatuhi

Folder ini **BUKAN** domain bisnis dan **BUKAN** pengecualian baru pada
aturan `docs/ARCHITECTURE.md` bagian 4. Tidak ada satu pun fungsi di sini
yang memanggil `SpreadsheetApp`/`getSpreadsheet()`/`DatabaseService`
langsung — seluruhnya hanya memanggil fungsi Service Layer domain yang sudah
ada.

## Deployment

Lihat `docs/GAS_CLASP_DEPLOY.md` (lewat `clasp`, butuh komputer/terminal) atau
`docs/GAS_MANUAL_DEPLOY.md` (tanpa command line sama sekali — cukup Safari/
browser, cocok untuk operator yang hanya punya iPad). Keduanya sama-sama
valid dan menghasilkan deployment yang identik — pilih sesuai perangkat
yang tersedia.

**`webapp.access`/`webapp.executeAs`** pada `appsscript.json` diubah menjadi
`"ANYONE_ANONYMOUS"`/`"USER_DEPLOYING"` — berbeda dari versi PHASE 4.5
(`"DOMAIN"`/`"USER_ACCESSING"`) — karena identitas pengguna sekarang berasal
dari token sesi (`AuthService`), bukan lagi dari sesi Google. Lihat catatan
lengkap pada `appsscript.json` itu sendiri.

## Yang SENGAJA belum termasuk

- RBAC penuh per transisi status (baru aturan kasar: VERIFIKATOR/OWNER/ADMIN
  untuk SEMUA transisi/deaktivasi laporan).
- Photo Engine, Comment Engine.
- Audit log integration (`AuditService` belum ada).
- `system_priority` otomatis (belum ada algoritma kanonik).
- Rancangan visual/UX frontend final (lihat `frontend/README.md`) — frontend
  yang ada saat ini fungsional tapi belum melalui iterasi desain.
