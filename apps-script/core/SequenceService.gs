/**
 * SequenceService.gs — PLACEHOLDER
 *
 * Modul ini akan bertanggung jawab menghasilkan ID unik dan nomor urut
 * (mis. report_number pada 10_reports) secara konsisten dan bebas
 * duplikasi, dengan mengacu pada sheet 91_sequences.
 *
 * Belum ada implementasi pada tahap PHASE 1 (Repository Foundation).
 * Implementasi dijadwalkan pada PHASE 2 — Core Backend.
 * Lihat docs/ARCHITECTURE.md (bagian CORE — Sequence Generation) dan
 * docs/DATABASE_SCHEMA.md (91_sequences).
 *
 * Cakupan yang direncanakan:
 * - Pengambilan dan penambahan nilai counter secara atomik (aman dari
 *   akses bersamaan) menggunakan LockService.
 * - Pembentukan format ID/nomor akhir (mis. RPT-2026-00001) berdasarkan
 *   konstanta pada core/Config.gs.
 */
