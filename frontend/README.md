# Frontend

Folder ini disiapkan sebagai lokasi aplikasi frontend SIGAP SARPRAS pada tahap pengembangan berikutnya.

## Status

**Belum dikembangkan.** Sesuai lingkup tahap **PHASE 1 — Repository Foundation**, pengembangan frontend secara eksplisit berada di luar cakupan tahap ini.

Frontend akan berkomunikasi dengan backend Google Apps Script (lihat `apps-script/`) sesuai alur pada `docs/ARCHITECTURE.md`:

```
User → Frontend Application → Google Apps Script → Service Layer → Google Spreadsheet
```

Implementasi frontend dijadwalkan pada **PHASE 7 — Frontend** (lihat `docs/DEVELOPMENT_ROADMAP.md`), setelah backend inti, data master, dan workflow laporan tersedia.
