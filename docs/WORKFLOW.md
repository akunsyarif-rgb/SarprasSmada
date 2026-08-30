# Workflow Laporan — SIGAP SARPRAS SMADA

Dokumen ini menjelaskan alur status (workflow) yang berlaku untuk setiap laporan sarana-prasarana, beserta aturan transisi yang valid dan ilegal.

## Diagram Alur

```
SUBMITTED → VERIFIED → ASSIGNED → IN_PROGRESS → COMPLETED → CLOSED
```

Alur di atas bersifat linear dan berurutan. Setiap laporan wajib melewati status-status tersebut secara berurutan, tanpa melompati satu status pun.

## Penjelasan Setiap Status

| Status | Arti |
|---|---|
| **SUBMITTED** | Laporan baru saja dibuat oleh pelapor. Belum ada verifikasi maupun tindak lanjut. |
| **VERIFIED** | Laporan telah diperiksa dan dikonfirmasi valid oleh pihak berwenang (mis. verifikator/admin sarana-prasarana). |
| **ASSIGNED** | Laporan telah ditugaskan kepada penanggung jawab (owner) untuk ditindaklanjuti. |
| **IN_PROGRESS** | Penanggung jawab sedang menangani/mengerjakan perbaikan atas laporan tersebut. |
| **COMPLETED** | Penanganan atas laporan telah selesai dikerjakan oleh penanggung jawab. |
| **CLOSED** | Laporan telah ditutup secara resmi, biasanya setelah dikonfirmasi oleh pelapor atau pihak berwenang bahwa penyelesaian sudah sesuai. |

## Transisi yang Valid

Transisi status hanya diperbolehkan menuju status berikutnya secara langsung dalam urutan berikut:

| Dari | Ke |
|---|---|
| `SUBMITTED` | `VERIFIED` |
| `VERIFIED` | `ASSIGNED` |
| `ASSIGNED` | `IN_PROGRESS` |
| `IN_PROGRESS` | `COMPLETED` |
| `COMPLETED` | `CLOSED` |

Setiap transisi wajib divalidasi secara eksplisit oleh Workflow Service pada domain `reports` sebelum status pada sheet `10_reports` diperbarui. Waktu setiap transisi (mis. `verified_at`, `assigned_at`, `started_at`, `completed_at`, `closed_at`) dicatat pada kolom terkait di `10_reports`, dan setiap perubahan turut dicatat pada `12_report_history` serta `20_audit_logs`.

## Contoh Transisi Ilegal

Transisi berikut **harus ditolak** oleh sistem karena melompati satu atau lebih status dalam urutan yang telah ditetapkan:

- `SUBMITTED → CLOSED` — melompati `VERIFIED`, `ASSIGNED`, `IN_PROGRESS`, dan `COMPLETED`.
- `SUBMITTED → ASSIGNED` — melompati `VERIFIED`.
- `SUBMITTED → IN_PROGRESS` — melompati `VERIFIED` dan `ASSIGNED`.
- `VERIFIED → COMPLETED` — melompati `ASSIGNED` dan `IN_PROGRESS`.
- `ASSIGNED → CLOSED` — melompati `IN_PROGRESS` dan `COMPLETED`.

Transisi mundur (mis. `IN_PROGRESS → VERIFIED`) atau transisi ke status yang sama juga dianggap tidak valid dalam alur normal, kecuali didefinisikan secara eksplisit sebagai kasus khusus (mis. pembatalan laporan) pada tahap pengembangan berikutnya.

## Catatan Implementasi

- Validasi transisi status merupakan tanggung jawab **Workflow** pada domain `reports` (lihat `docs/ARCHITECTURE.md`), bukan tanggung jawab lapisan frontend maupun `DatabaseService`.
- Setiap penolakan transisi ilegal harus menghasilkan pesan kesalahan yang jelas, dan aktivitas percobaan transisi ilegal sebaiknya turut tercatat untuk keperluan audit.
- Aturan otorisasi terkait siapa yang berhak memicu suatu transisi (mis. hanya owner terkait yang dapat mengubah status ke `IN_PROGRESS`) akan didetailkan pada tahap pengembangan **PHASE 5 — Workflow & Authorization** (lihat `docs/DEVELOPMENT_ROADMAP.md`).
