# Deploy Backend via clasp — SIGAP SARPRAS SMADA

Jalur deploy utama untuk backend (`apps-script/`), memakai
[`@google/clasp`](https://github.com/google/clasp) — meniru pola yang sama
dengan aplikasi SIGAP (`Sigap-app`, TIDAK diubah oleh perubahan ini). Untuk
jalur tanpa command line, lihat catatan deprecation di
`docs/GAS_MANUAL_DEPLOY.md`.

**Frontend (`frontend/`) TIDAK memakai clasp** — itu file statis biasa,
di-deploy lewat hosting statis pilihan Anda (Vercel, GitHub Pages, dst.).
Lihat `frontend/README.md`.

---

## 0. Prasyarat

- Node.js terpasang (untuk `npm`/`clasp`).
- Google Spreadsheet database sudah disiapkan sesuai `docs/DATABASE_SETUP.md`
  bagian 1–9 (sheet + header + sequence awal, via `setupDatabase()` atau
  manual).
- Akun Google yang akan dipakai clasp punya akses edit ke project Apps
  Script (atau akan membuat project baru).

## 1. Install dependency

```bash
npm install
```

Ini memasang `@google/clasp` sebagai devDependency (lihat `package.json`) —
tidak menyentuh apa pun di `frontend/` (yang memang tidak butuh dependency
apa pun, lihat `frontend/README.md`).

## 2. Login clasp

```bash
npm run clasp:login
```

Membuka browser untuk otorisasi akun Google. Menulis kredensial ke
`~/.clasprc.json` (di luar repo, tidak pernah commit — lihat `.gitignore`).

## 3. Siapkan `.clasp.json`

```bash
cp .clasp.json.example .clasp.json
```

Isi `scriptId`:

- **Sudah punya project Apps Script** (mis. dibuat manual dari
  Extensions > Apps Script di spreadsheet database): ambil dari
  **Project Settings > Script ID** di editor Apps Script.
- **Belum punya**: jalankan `npx clasp create --type webapp --title "SIGAP SARPRAS" --rootDir apps-script` dari root repo, lalu salin `scriptId` yang dihasilkan ke `.clasp.json` (perintah ini SUDAH membuat `.clasp.json` otomatis dengan `rootDir` yang benar — cukup pastikan isinya sama dengan `.clasp.json.example`, tidak perlu copy manual lagi).

`.clasp.json` sengaja gitignored (lihat `.gitignore`) — per-orang/per-checkout,
bukan dibagikan lewat repo.

## 4. Push kode

```bash
npm run clasp:push
```

`apps-script/.claspignore` memastikan HANYA file `.gs` + `appsscript.json`
yang terdorong (bukan `README.md`, bukan `docs/`).

## 5. Set Script Properties

Di editor Apps Script (Project Settings > Script Properties), set:

- `SPREADSHEET_ID` — lihat `docs/DATABASE_SETUP.md` bagian 3.
- `API_TOKEN` — lihat `docs/DATABASE_SETUP.md` bagian 10.1.

Lakukan ini SEBELUM langkah 6 — deployment yang jalan tanpa kedua Script
Property ini akan menolak semua request (`checkToken_`/`getSpreadsheetId`
melempar error eksplisit, bukan gagal senyap).

## 6. Deploy sebagai Web App

### 6a. Deployment PERTAMA KALI (belum ada satu pun)

```bash
npm run clasp:deploy:first
```

Ini `clasp push && clasp deploy` — membuat deployment **baru** dengan Web
App URL baru. Setelah selesai:

```bash
npx clasp deployments
```

Catat **deployment id** (kolom pertama) yang baru saja dibuat — INI yang
dipakai sebagai `CLASP_DEPLOYMENT_ID` untuk SELURUH deploy berikutnya (lihat
6b). Catat juga Web App URL-nya (bentuknya
`https://script.google.com/macros/s/.../exec`) — ini yang diisi ke
`frontend/config.js` `API_URL`.

**Otorisasi pertama kali:** browser/`clasp` akan meminta izin akses ke
Spreadsheet — setujui (wajar untuk script internal yang belum diverifikasi
Google, sama seperti disebutkan di `apps-script/api/README.md` versi
sebelumnya).

### 6b. Deploy BERIKUTNYA (selalu, setelah 6a pernah dijalankan sekali)

```bash
CLASP_DEPLOYMENT_ID=<id-dari-clasp-deployments> npm run clasp:deploy
```

**JANGAN PERNAH** menjalankan `clasp deploy` polos (tanpa `-i`) lagi setelah
deployment pertama — itu diam-diam membuat Web App URL BARU yang tidak
dikenal `frontend/config.js`, dan TIDAK error saat terjadi (lihat komentar
di `.github/scripts/clasp-deploy-existing.js`). `npm run clasp:deploy`
sengaja menolak jalan (`process.exit(1)`) jika `CLASP_DEPLOYMENT_ID` kosong,
justru untuk mencegah kesalahan ini.

## 7. Uji Coba

1. Ping status (tanpa token, mirip pola SIGAP `BACKEND_VERSION`):
   ```bash
   curl "<WEB_APP_URL>?"
   ```
   Harus mengembalikan JSON `{"success":true,"data":{"service":"SIGAP SARPRAS","backendVersion":1}}`.
2. Login (butuh `API_TOKEN` dan akun yang sudah punya password — lihat
   `docs/DATABASE_SETUP.md` bagian 10.2):
   ```bash
   curl -X POST "<WEB_APP_URL>" \
     -H "Content-Type: text/plain;charset=utf-8" \
     -d '{"token":"<API_TOKEN>","action":"login","email":"<email>","password":"<password>"}'
   ```
   Harus mengembalikan `{"success":true,"data":{"token":"...","expiresAt":"...","user":{...}}}`.
3. **WAJIB, sebelum dianggap selesai**: uji dari frontend yang BENAR-BENAR
   di-hosting di origin terpisah (bukan file lokal) — lihat catatan CORS di
   `frontend/README.md`. Perilaku CORS Apps Script Web App untuk pola ini
   belum diverifikasi end-to-end sebagai bagian dari perubahan yang
   memperkenalkan arsitektur ini.

## 8. Setiap kali mengubah kode `.gs`

```bash
CLASP_DEPLOYMENT_ID=<id> npm run clasp:deploy
```

Naikkan `APP_BACKEND_VERSION_` di `apps-script/api/App.gs` agar mudah
memverifikasi deployment sudah benar-benar terbarui (lewat ping status pada
langkah 7.1) — sama seperti alasan `BACKEND_VERSION` di aplikasi SIGAP.
