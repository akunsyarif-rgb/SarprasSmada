# Frontend

Aplikasi frontend SIGAP SARPRAS — statis, TANPA build step, di-hosting
TERPISAH dari project Google Apps Script (mis. Vercel/GitHub Pages),
berkomunikasi dengan backend lewat JSON API bertoken
(`apps-script/api/App.gs`, `doGet`/`doPost`) — meniru arsitektur aplikasi
SIGAP (`Sigap-app`, TIDAK diubah oleh perubahan ini).

## Status

**Fungsional, belum melalui iterasi desain/UX.** Menggantikan
`apps-script/api/Index.html` (test harness PHASE 4.5 yang sudah dihapus —
lihat riwayat commit) sebagai satu-satunya cara pengguna nyata memakai
sistem. Mencakup seluruh fitur backend yang sudah ada: login/logout/ganti
password, buat & lihat laporan, ubah status laporan (VERIFIKATOR/OWNER/
ADMIN), riwayat laporan, dan (khusus ADMIN) pengelolaan data master
(lokasi/kategori/fasilitas/owner) serta pengguna.

Belum termasuk (di luar scope perubahan ini, sama seperti backend): Photo/
Comment Engine, audit log UI, RBAC halus per transisi status, `system_priority`
otomatis — lihat `docs/DEVELOPMENT_ROADMAP.md`.

## Arsitektur

```
User → frontend/ (statis, hosting terpisah) → fetch() JSON →
  apps-script/api/App.gs (doGet/doPost) → Service Layer → Google Spreadsheet
```

Detail lengkap: `docs/ARCHITECTURE.md`.

## Tanpa build step, TANPA JSX

Berbeda dari SIGAP (yang memakai JSX + transformasi Babel sekali saat load —
lihat komentar di `Sigap-app/index.html`), seluruh komponen di sini ditulis
langsung dengan `React.createElement` (lihat `ui-common.js`, `reports.js`,
`admin.js`, `app.js`). Konsekuensinya kode sedikit lebih verbose, tapi
menghilangkan seluruh kelas masalah versi Babel/JSX-runtime yang
didokumentasikan di SIGAP — cukup `<script src="...">` biasa berurutan,
tanpa dependency Babel sama sekali. Urutan file di `index.html` tetap
penting (tidak ada module system): `config.js → helpers.js → api.js →
ui-common.js → reports.js → admin.js → app.js`.

## Backend Appwrite (menggantikan Apps Script)

Frontend memakai SDK Appwrite Web (`appwrite@28.1.0` dari jsDelivr, dengan SRI)
— lihat `docs/APPWRITE_SCHEMA.md`. Nilai di `config.js` (endpoint, project ID,
database/function/tabel) bukan rahasia.

## Setup sebelum dipakai

1. Pastikan Function `sarpras-api` dan tabel `sarpras_*` sudah ada di project
   Appwrite (docs/APPWRITE_SCHEMA.md §12).
2. **Daftarkan domain hosting frontend sebagai platform Web** di Appwrite
   (Console → project → Overview → Platforms → Add platform → Web). Tanpa ini
   browser memblokir request (CORS). Tambahkan `localhost` bila ingin menguji lokal.
3. Beri akun admin pertama label `sarprasadmin` (Console → Auth → pengguna →
   Labels). Saat admin itu login pertama kali, baris profilnya dibuat otomatis
   (`syncMyProfile`). Pengguna lain dibuat dari tab Admin → Pengguna.
4. Deploy folder `frontend/` ke hosting statis. Untuk Vercel: **Settings >
   General** → **Root Directory** = `frontend`, **Framework Preset** = `Other`,
   tanpa build command.

