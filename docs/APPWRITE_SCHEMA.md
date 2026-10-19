# Skema & Izin Appwrite — SIGAP SARPRAS SMADA

Status: **USULAN (belum diterapkan)**. Dokumen ini dibuat untuk di-review sebelum ada resource yang dibuat di Appwrite. Menggantikan backend Google Apps Script/Sheets (`docs/DATABASE_SCHEMA.md`, `docs/WORKFLOW.md` tetap menjadi sumber aturan bisnis).

## 1. Target

| Item | Nilai |
|---|---|
| Project | `PRESENSI` (`6ace48710006ad3f6b31`, region Singapura) — dipakai bersama aplikasi presensi |
| Isolasi | Database, bucket, function, dan label **terpisah** dari presensi. Tidak ada resource presensi yang disentuh. |
| Database | `sarpras` (baru) |
| Bucket | `foto-sarpras` (fase 2) |
| Prefiks function | `sarpras-` |
| Prefiks label | `sarpras_` |

Aturan keras: jangan ubah/hapus `presensi` (database), `foto-presensi` (bucket), `submit-presensi` (function), `presensi-xi-f-teknik-2` (site), dan jangan ubah label `guru` yang sudah ada.

## 2. Prinsip desain

1. **Client hanya membaca.** Semua penulisan data laporan, riwayat, dan pengguna lewat Function (server). Client tidak pernah menentukan `permissions`, `reporter_id`, `status`, atau nomor laporan sendiri.
2. **Identitas dari Appwrite Auth.** Tidak ada lagi `API_TOKEN` statis, hash password buatan sendiri, atau cache sesi buatan sendiri.
3. **Role = Label Auth**, hanya bisa diubah server (Function admin). Pengguna tidak bisa menaikkan role sendiri.
4. **Relasi memakai string ID biasa**, bukan fitur Relationship Appwrite (lebih sederhana, mudah dimigrasi dari Sheets, tanpa kaskade tak terduga). Integritas dicek di Function.
5. **Soft delete** (`is_active`) dipertahankan seperti sistem lama.
6. **Function memverifikasi ulang role** dari server (`Users.get` memakai `x-appwrite-user-id`), tidak mempercayai input client.

## 3. Role

| Role | Label Appwrite | Hak |
|---|---|---|
| Siswa | `sarpras_siswa` | Buat laporan; lihat/ubah laporan sendiri |
| Guru | `sarpras_guru` | Sama seperti siswa |
| Staf | `sarpras_staf` | Sama seperti siswa |
| Verifikator | `sarpras_verifikator` | Lihat semua laporan; ubah status; nonaktifkan laporan |
| Owner | `sarpras_owner` | Sama seperti verifikator (sesuai `getWorkflowAllowedRoles_()` lama) |
| Admin | `sarpras_admin` | Semua hak verifikator + kelola data master + kelola pengguna |

Satu pengguna = tepat satu label `sarpras_*` role. Akun pemilik (`akunsyarif@gmail.com`) mendapat `sarpras_admin` **ditambah** label `guru` yang sudah ada.

Catatan: label `guru` (presensi) dan `sarpras_guru` sengaja berbeda agar izin data presensi tidak bocor ke sarpras dan sebaliknya.

## 4. Tabel

Semua tabel di database `sarpras`. Tipe: `str(n)` = string maksimal n, `enum` = enum, `bool`, `dt` = datetime, `int`.
`$id` baris memakai ID lama (mis. `RPT-000012`, `LOC-000003`) agar relasi hasil migrasi tetap valid; baris baru memakai `ID.unique()`.

### 4.1 `users_profile`
`$id` = ID user Appwrite Auth.

| Kolom | Tipe | Wajib | Catatan |
|---|---|---|---|
| `email` | str(254) | ya | salinan dari Auth (untuk daftar admin) |
| `full_name` | str(100) | ya | |
| `role` | enum | ya | `SISWA`,`GURU`,`STAF`,`VERIFIKATOR`,`OWNER`,`ADMIN` |
| `student_id` | str(50) | tidak | |
| `class_name` | str(50) | tidak | |
| `owner_id` | str(36) | tidak | → `owners` |
| `is_active` | bool | ya | default `true` |
| `legacy_user_id` | str(36) | tidak | `USR-...` dari sistem lama, untuk migrasi |

Index: `email` (unique), `role` (key).

### 4.2 `locations`
| Kolom | Tipe | Wajib | Catatan |
|---|---|---|---|
| `parent_id` | str(36) | tidak | → `locations` |
| `location_name` | str(100) | ya | |
| `location_type` | str(20) | ya | mis. GEDUNG/LANTAI/RUANG |
| `location_path` | str(500) | ya | dihitung klien admin saat simpan |
| `is_active` | bool | ya | |

Index: `parent_id` (key), `location_path` (key).

### 4.3 `categories`
`category_name` str(100) ya · `description` str(300) · `is_active` bool. Index: `category_name` (unique).

### 4.4 `facilities`
`category_id` str(36) ya · `facility_name` str(150) ya · `is_active` bool. Index: `category_id` (key).

### 4.5 `owners`
`owner_name` str(100) ya · `description` str(300) · `is_active` bool. Index: `owner_name` (unique).

> Trade-off: indeks unik Appwrite tidak bisa bersyarat `is_active=true` seperti aturan lama ("unik di antara yang aktif"). Nama data nonaktif tetap "memakai" nama itu. Alternatif: Function `sarpras-master` yang memvalidasi di sisi server (lihat §9, keputusan B).

### 4.6 `reports`
| Kolom | Tipe | Wajib | Catatan |
|---|---|---|---|
| `report_number` | str(20) | ya | `SRP-YYYY-000001`, dari Function |
| `reporter_id` | str(36) | ya | = `$id` user pelapor |
| `location_id` | str(36) | ya | |
| `category_id` | str(36) | ya | |
| `facility_id` | str(36) | tidak | |
| `condition` | str(200) | tidak | |
| `description` | str(2000) | ya | |
| `impact_level` | str(20) | tidak | RENDAH/SEDANG/TINGGI |
| `safety_risk` | str(10) | tidak | YA/TIDAK |
| `system_priority` | str(20) | tidak | |
| `priority` | str(20) | tidak | |
| `priority_override_reason` | str(300) | tidak | |
| `status` | enum | ya | `SUBMITTED`,`VERIFIED`,`ASSIGNED`,`IN_PROGRESS`,`COMPLETED`,`CLOSED` |
| `owner_id` | str(36) | tidak | |
| `duplicate_of_report_id` | str(36) | tidak | |
| `verified_at`,`assigned_at`,`started_at`,`completed_at`,`closed_at` | dt | tidak | diisi workflow |
| `is_active` | bool | ya | default `true` |

`$createdAt`/`$updatedAt` bawaan Appwrite menggantikan `created_at`/`updated_at`.
Index: `report_number` (unique), `reporter_id`, `status`, `is_active`, `owner_id`.

### 4.7 `report_history`
`report_id` str(36) ya · `previous_status` str(20) · `new_status` str(20) ya · `action` str(30) ya · `notes` str(1000) · `performed_by` str(36) ya. Index: `report_id`.

### 4.8 `sequences` (internal)
`sequence_name` str(30) ya (unique) · `current_value` int ya. Dinaikkan atomik oleh Function (increment bawaan TablesDB) — mencegah nomor ganda.

### 4.9 `audit_logs`
`user_id` str(36) · `action` str(40) ya · `entity_type` str(30) · `entity_id` str(36) · `metadata` str(2000) (JSON). Index: `user_id`, `entity_type`+`entity_id`.

### 4.10 Fase 2 (tidak dibuat di MVP)
`report_photos` + bucket `foto-sarpras` (JPG/PNG ≤ 2 MB, antivirus, enkripsi) dan `report_comments`. Frontend sekarang belum punya unggah foto, jadi ditunda. Unggah akan lewat Function agar izin file ditetapkan server.

## 5. Matriks izin tabel

Notasi: `R` baca, `C` buat, `U` ubah, `D` hapus. "Row" = izin per baris (`rowSecurity` aktif) yang ditetapkan **Function** saat baris dibuat.

| Tabel | rowSecurity | Izin tabel (client) | Izin baris |
|---|---|---|---|
| `users_profile` | ya | R: `label:sarpras_admin`, `label:sarpras_verifikator`, `label:sarpras_owner` | R: `user:<id sendiri>` |
| `locations` | tidak | R: `users`; C/U/D: `label:sarpras_admin` | — |
| `categories` | tidak | R: `users`; C/U/D: `label:sarpras_admin` | — |
| `facilities` | tidak | R: `users`; C/U/D: `label:sarpras_admin` | — |
| `owners` | tidak | R: `users`; C/U/D: `label:sarpras_admin` | — |
| `reports` | ya | R: `label:sarpras_verifikator`, `label:sarpras_owner`, `label:sarpras_admin`; **tanpa C/U/D** | R: `user:<reporter_id>` |
| `report_history` | ya | R: `label:sarpras_verifikator`, `label:sarpras_owner`, `label:sarpras_admin`; tanpa C/U/D | R: `user:<reporter_id laporan>` |
| `sequences` | tidak | **tidak ada** (hanya Function dengan API key) | — |
| `audit_logs` | tidak | R: `label:sarpras_admin`; tanpa C/U/D | — |

Pelapor melihat laporan dan riwayat miliknya lewat izin baris; staf lewat izin tabel. Tidak ada izin `any`/`guests` di tabel mana pun.

## 6. Function (semua `execute: users`, bukan `any`)

Setiap function: ambil `x-appwrite-user-id` → `Users.get` → baca label & `is_active` → tolak jika bukan haknya. Kunci API function memakai scope minimal.

| Function | Siapa | Kerja |
|---|---|---|
| `sarpras-create-report` | semua role login | Validasi lokasi/kategori/fasilitas/owner aktif; `reporter_id` = pemanggil; nomor via `sequences`; status `SUBMITTED`; set izin baris `read(user:<pelapor>)`; tulis `report_history` & `audit_logs` |
| `sarpras-update-report` | pelapor laporan itu, atau staf | Hanya kolom yang boleh (lokasi, kategori, fasilitas, owner, kondisi, deskripsi, dampak, risiko); kolom terlarang sama seperti `ReportService.updateReport` lama |
| `sarpras-change-status` | verifikator/owner/admin | Validasi transisi linear (`docs/WORKFLOW.md`), isi `*_at`, tulis riwayat & audit |
| `sarpras-deactivate-report` | verifikator/owner/admin | `is_active=false`, riwayat & audit |
| `sarpras-manage-user` | admin | Buat user Auth + profil + label; ubah role; nonaktifkan (`Users.updateStatus` ⇒ login & sesi aktif langsung ditolak); reset password |
| `sarpras-master` *(opsional, §9-B)* | admin | Validasi unik-aktif & `location_path` di server |

Ganti password sendiri: SDK client `account.updatePassword`, tanpa Function.

Scope function yang diperlukan: `databases.read/write` (tabel `sarpras`), `users.read/write` (hanya `sarpras-manage-user` & pemeriksa label). Tidak ada akses bucket di MVP.

## 7. Auth

| Fungsi lama | Pengganti |
|---|---|
| `apiLogin/Logout` | `account.createEmailPasswordSession` / `deleteSession` |
| `getCurrentUser` | `account.get()` + baca `users_profile` |
| Token sesi 6 jam di cache | Sesi Appwrite (dapat dicabut) |
| Rate limit login buatan sendiri | Rate limit bawaan Appwrite Auth *(nilai pastinya diverifikasi saat uji)* |
| `setPassword` admin | `sarpras-manage-user` → `Users.updatePassword` |
| Hash PBKDF2 buatan sendiri | Argon2 bawaan |

Pengaturan Auth: kebijakan password minimal 8 karakter, aktifkan pengecekan password bocor (pwned), batas sesi per pengguna dibatasi, tidak ada pendaftaran publik (akun hanya dibuat admin; nonaktifkan Sign Up jika opsinya tersedia, atau pastikan pembuatan akun dari client tidak menghasilkan label — akun tanpa label `sarpras_*` tidak punya hak apa pun).

Platform web yang diizinkan: domain hosting frontend sarpras saja.

## 8. Migrasi data

1. Ekspor sheet (`01_users`…`12_report_history`, `91_sequences`) ke JSON via skrip Apps Script sekali pakai.
2. Impor master data dengan `$id` lama.
3. Pengguna: buat user Auth baru (tanpa hash lama — SHA-256 buatan sendiri tidak bisa diimpor), isi `legacy_user_id`, kirim password awal/reset ke tiap pengguna. Petakan `reporter_id`/`performed_by` lama → `$id` baru.
4. Impor `reports` + `report_history` dengan izin baris `read(user:<id baru pelapor>)`.
5. Set `sequences.REPORT` = nilai terakhir sheet agar `report_number` melanjutkan.
6. Apps Script tetap hidup read-only sampai verifikasi selesai.

## 9. Keputusan yang perlu Anda putuskan

- **A. Foto laporan** — masuk MVP atau fase 2? (Usulan: fase 2.)
- **B. Data master** — admin menulis langsung ke tabel (sederhana, nama unik mencakup data nonaktif) atau lewat Function `sarpras-master` (aturan lama "unik di antara yang aktif" terjaga)? (Usulan: langsung dulu.)
- **C. Role OWNER** — tetap melihat semua laporan (perilaku lama), atau hanya laporan yang `owner_id`-nya miliknya? (Usulan: tetap semua, sama seperti lama.)
- **D. Pembuatan akun** — hanya admin (usulan), atau pendaftaran mandiri siswa dengan persetujuan admin?

## 10. Uji penerimaan izin (wajib lulus sebelum go-live)

Dengan akun uji tiap role, dari SDK client:
1. SISWA A tidak bisa `listRows` laporan SISWA B; hanya melihat miliknya.
2. SISWA tidak bisa `createRow`/`updateRow`/`deleteRow` langsung ke `reports`, `report_history`, `users_profile`.
3. SISWA memanggil `sarpras-update-report` pada laporan orang lain → ditolak.
4. SISWA tidak bisa memanggil `sarpras-change-status`/`sarpras-manage-user`.
5. VERIFIKATOR melihat semua laporan, tidak bisa menulis data master.
6. Pengguna dinonaktifkan → permintaan berikutnya langsung ditolak.
7. Pengguna tanpa label `sarpras_*` (mis. akun presensi) tidak membaca apa pun di `sarpras`, dan label `guru` tidak membuka tabel sarpras.
8. Akun tamu (tanpa login) tidak membaca apa pun.
9. Transisi status melompat (`SUBMITTED→CLOSED`) ditolak.
10. Dua pembuatan laporan bersamaan tidak menghasilkan `report_number` ganda.

## 11. Dampak ke kode repo

- `frontend/api.js` ditulis ulang memakai SDK Appwrite; `config.js`: ganti `API_URL/API_TOKEN` dengan endpoint, project ID, database ID, function ID.
- `frontend/app.js`: sesi dari SDK, bukan `localStorage` buatan sendiri.
- Folder `functions/sarpras-*` baru; `apps-script/` dipertahankan sampai migrasi selesai, lalu diarsipkan.
- Tes: tambahkan tes logika murni (transisi workflow, whitelist kolom update) yang dipakai bersama.
