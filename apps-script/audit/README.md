# Domain: Audit

Domain ini akan berisi layanan (`.gs`) untuk mencatat aktivitas penting yang terjadi di seluruh sistem SIGAP SARPRAS, merujuk pada sheet `20_audit_logs` (lihat `docs/DATABASE_SCHEMA.md`).

## Status

Belum ada implementasi. Folder ini disiapkan sebagai bagian dari struktur repository pada **PHASE 1 — Repository Foundation**.

## Cakupan yang Direncanakan

- Pencatatan aktivitas lintas domain (perubahan status laporan, perubahan data master, percobaan transisi ilegal, dsb.).
- Penyediaan fungsi pencarian/penelusuran audit log untuk keperluan pengawasan.

Implementasi dijadwalkan pada **PHASE 5 — Workflow & Authorization** (lihat `docs/DEVELOPMENT_ROADMAP.md`). Domain lain akan memanggil layanan pada domain ini untuk mencatat aktivitas, bukan menulis langsung ke `20_audit_logs`.
