/**
 * Config.gs — PLACEHOLDER
 *
 * Modul ini akan menjadi satu-satunya sumber konfigurasi sistem SIGAP SARPRAS:
 * ID Google Spreadsheet, nama-nama sheet, konstanta status laporan, dan
 * parameter global lainnya. Tidak ada nilai konfigurasi yang boleh
 * di-hardcode di modul domain lain (users, master-data, reports, audit).
 *
 * Belum ada implementasi pada tahap PHASE 1 (Repository Foundation).
 * Implementasi dijadwalkan pada PHASE 2 — Core Backend.
 * Lihat docs/ARCHITECTURE.md (bagian CORE) dan docs/DEVELOPMENT_ROADMAP.md.
 *
 * Cakupan yang direncanakan:
 * - ID Google Spreadsheet yang digunakan sebagai database.
 * - Pemetaan nama sheet sesuai docs/DATABASE_SCHEMA.md
 *   (01_users, 02_locations, ..., 91_sequences).
 * - Konstanta status workflow laporan sesuai docs/WORKFLOW.md
 *   (SUBMITTED, VERIFIED, ASSIGNED, IN_PROGRESS, COMPLETED, CLOSED).
 * - Konstanta peran (role) pengguna.
 */
