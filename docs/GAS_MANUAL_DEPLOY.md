# Panduan Deploy Manual ke Google Apps Script — SUDAH USANG

**Dokumen ini sudah tidak berlaku dan sengaja dikosongkan isinya.** Panduan
sebelumnya di sini (copy-paste manual 18 file lewat browser, memakai
`apps-script/deployment/MVP_DEPLOYMENT_BUNDLE.txt`) khusus untuk MVP PHASE
4.5 (`api/Index.html` + `google.script.run`), yang **sudah dihapus** — lihat
riwayat commit dan `apps-script/api/README.md` bagian "Perubahan arsitektur".
Bundle txt yang jadi acuan langkah-langkahnya juga sudah dihapus karena
tidak lagi mencerminkan source code (folder `apps-script/auth/` dan file
`api/AuthApi.gs`/`api/UserApi.gs` yang baru tidak pernah ada di dalamnya).

**Jalur deploy yang berlaku sekarang: `docs/GAS_CLASP_DEPLOY.md`** (memakai
`clasp`, meniru pola yang sama dengan aplikasi SIGAP). Skrip project ini
(`.clasp.json.example`, `apps-script/.claspignore`,
`package.json`) sudah disiapkan untuk jalur itu.

Jika suatu saat benar-benar dibutuhkan jalur tanpa command line lagi (mis.
operator hanya punya iPad tanpa akses terminal), tulis ulang panduan ini
dari nol mengikuti struktur file `apps-script/` yang SEKARANG (lihat
`apps-script/README.md` untuk daftar domain) — jangan mencoba memperbarui
langkah-langkah lama di atas, karena urutan dependency antar file sudah
banyak berubah (domain `auth/` baru, `api/App.gs` bukan lagi `doGet` yang
menyajikan HTML).
