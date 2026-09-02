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

## Setup sebelum dipakai

Seluruh langkah di bawah bisa dilakukan tanpa command line sama sekali
(Safari/browser saja, cocok untuk operator yang hanya punya iPad) — lihat
`docs/GAS_MANUAL_DEPLOY.md` untuk langkah 1-2-4 secara rinci.

1. Deploy backend lebih dulu (`docs/GAS_CLASP_DEPLOY.md` bila punya
   terminal, atau `docs/GAS_MANUAL_DEPLOY.md` bila hanya lewat browser),
   dapatkan Web App URL-nya.
2. Set `SPREADSHEET_ID` dan `API_TOKEN` di Script Properties backend (lihat
   `docs/DATABASE_SETUP.md` bagian 3 dan 10).
3. Isi `frontend/config.js`: `API_URL` = Web App URL, `API_TOKEN` = SAMA
   PERSIS dengan Script Property `API_TOKEN`. Tanpa command line: buka
   `frontend/config.js` di GitHub (Safari), tap ikon pensil untuk edit,
   ubah kedua nilainya, lalu **Commit changes**.
4. Bootstrap akun ADMIN pertama beserta passwordnya (lihat
   `docs/DATABASE_SETUP.md` bagian 10.2 — langkah ini dilakukan dari editor
   Apps Script, bukan dari frontend).
5. Deploy folder `frontend/` ke hosting statis pilihan Anda. Untuk Vercel
   (yang sudah tersambung ke repo ini): buka dashboard Vercel di browser
   (tidak perlu command line/CLI Vercel) → project ini → **Settings >
   General** → set **Root Directory** ke `frontend` (BUKAN root repo —
   root repo punya `package.json` sendiri untuk tooling `clasp`, yang akan
   membingungkan Vercel kalau Root Directory dibiarkan default) →
   **Framework Preset**: `Other` → **Build Command**/**Output Directory**:
   kosongkan/biarkan default (tidak perlu build). Simpan, lalu redeploy.

## CORS — hal yang WAJIB diuji

`apps-script/api/App.gs` dan `api.js` sudah didesain mengikuti pola yang
umum dipakai untuk memanggil Apps Script Web App lintas origin (`fetch`
tanpa header kustom yang memicu preflight, `Content-Type:
text/plain;charset=utf-8` pada POST). **Ini BELUM diverifikasi end-to-end
terhadap deployment nyata** sebagai bagian dari perubahan ini — sebelum
dianggap selesai, coba langsung dari frontend yang benar-benar di-hosting di
origin terpisah (bukan dibuka sebagai file lokal) melawan Web App URL asli.
Jika ternyata gagal, opsi berikutnya yang belum dieksplorasi: proxy
sederhana di sisi hosting frontend, atau `HtmlService` iframe hybrid — lihat
diskusi arsitektur di `docs/ARCHITECTURE.md` sebelum memutuskan.
