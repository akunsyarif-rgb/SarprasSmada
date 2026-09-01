# Auth

Domain autentikasi (login/logout/sesi/password) — `AuthService.gs`. Menggantikan
model lama berbasis `Session.getActiveUser()` (Google SSO), yang hanya bisa
bekerja ketika HTML disajikan langsung oleh Apps Script (`HtmlService`) di
project yang sama. Sejak frontend dipindah ke hosting terpisah (`frontend/`,
lihat README repo utama), identifikasi pengguna dilakukan lewat username
(email) + password + token sesi, dikirim lewat `fetch()` ke
`apps-script/api/App.gs` — sama seperti pola yang dipakai aplikasi SIGAP
(`Sigap-app`, TIDAK diubah oleh perubahan ini).

**Bukan** domain data pengguna — itu tetap tanggung jawab
`apps-script/users/UserService.gs` (create/update/deactivate/list). Modul ini
HANYA menangani: hashing password (salted SHA-256), verifikasi login,
pembuatan/pengambilan sesi (`CacheService`, TTL 6 jam mengikuti batas keras
`CacheService.put()`), dan rate limiting percobaan login gagal.

Sheet `01_users` mendapat dua kolom baru untuk ini: `password_hash`,
`password_salt` (lihat `docs/DATABASE_SCHEMA.md`). Baris pengguna lama (dibuat
sebelum perubahan ini) memiliki kedua kolom tersebut kosong — pengguna itu
tidak bisa login sampai admin men-set password awal lewat `setPassword()`
(lihat `docs/DATABASE_SETUP.md` untuk langkah bootstrap).

Password (hash maupun salt) TIDAK PERNAH dikirim ke client — setiap fungsi di
sini yang mengembalikan objek pengguna melewati `authSanitizeUser_()` lebih
dulu.

Otorisasi (siapa yang boleh memanggil `setPassword()` untuk pengguna lain,
dsb.) ada di lapisan API (`apps-script/api/AuthApi.gs`), bukan di sini — modul
ini tidak tahu apa-apa tentang role pemanggil.
