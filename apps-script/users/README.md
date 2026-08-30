# Domain: Users

Domain ini berisi layanan (`UserService.gs`) yang mengelola data pengguna sistem SIGAP SARPRAS, merujuk pada sheet `01_users` (lihat `docs/DATABASE_SCHEMA.md`).

## Status

**PHASE 3 — Master Data selesai diimplementasikan** untuk domain ini. `UserService.gs` menyediakan:

- `createUser(userData)` — validasi email (wajib, format valid, unik), full_name (wajib), dan role (wajib, harus salah satu `CONFIG.ROLES`).
- `getUserById(userId)`
- `listActiveUsers()`
- `updateUser(userId, updates)` — tidak dapat mengubah `is_active` (gunakan `deactivateUser`).
- `deactivateUser(userId)` — soft delete via `is_active`, tidak ada hard delete.

Domain ini **tidak** mengelola autentikasi maupun password — murni pengelolaan data pengguna.

## Cakupan yang Belum Diimplementasikan

- Pengambilan data pengguna berdasarkan peran (role) untuk keperluan otorisasi pada domain `reports` — akan dikerjakan bersama **PHASE 5 — Workflow & Authorization**.

Seluruh akses data pada domain ini melalui `apps-script/core/DatabaseService.gs` — tidak ada pemanggilan `SpreadsheetApp` langsung (lihat `docs/ARCHITECTURE.md` bagian 4).
