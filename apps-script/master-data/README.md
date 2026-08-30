# Domain: Master Data

Domain ini berisi layanan (`.gs`) yang mengelola data referensi yang digunakan oleh domain pelaporan: `LocationService.gs`, `CategoryService.gs`, `FacilityService.gs`, dan `OwnerService.gs`, merujuk pada sheet `02_locations`, `03_categories`, `04_facilities`, dan `05_owners` (lihat `docs/DATABASE_SCHEMA.md`).

## Status

**PHASE 3 — Master Data selesai diimplementasikan.** Setiap service menyediakan Create, Get by ID, List active, Update, dan Deactivate (soft delete via `is_active`, tidak ada hard delete).

- **`LocationService.gs`** — mendukung hierarki lokasi (`parent_id`), termasuk validasi `parent_id` harus ada, pencegahan circular hierarchy, dan `location_path` yang dihitung otomatis (termasuk perambatan ke seluruh keturunan saat lokasi induk diubah nama/induknya).
- **`CategoryService.gs`** — `category_name` unik di antara kategori yang aktif. `deactivateCategory()` menolak deaktivasi selama masih ada facility aktif yang merujuk kategori tersebut.
- **`FacilityService.gs`** — `category_id` wajib merujuk kategori yang valid **dan aktif**.
- **`OwnerService.gs`** — `owner_name` unik di antara owner yang aktif.

Validasi silang antar domain (mis. Facility → Category) dilakukan dengan membaca sheet domain lain langsung melalui `DatabaseService`, **bukan** memanggil fungsi domain service lain — mencegah dependency melingkar antar domain (lihat `docs/ARCHITECTURE.md` bagian 4 poin 4).

## Cakupan yang Belum Diimplementasikan (Technical Debt)

- `deactivateOwner()` belum memeriksa referensi dari `01_users.owner_id` sebelum menonaktifkan (berbeda dengan guard serupa pada `CategoryService`) — belum diminta pada scope PHASE 3.
- `deactivateLocation()` tidak melakukan cascade ke lokasi anak.

Seluruh akses data pada domain ini melalui `apps-script/core/DatabaseService.gs` — tidak ada pemanggilan `SpreadsheetApp` langsung (lihat `docs/ARCHITECTURE.md` bagian 4).
