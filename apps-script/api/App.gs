/**
 * App.gs
 *
 * Satu-satunya Web App entry point SIGAP SARPRAS (doGet). Menyajikan
 * apps-script/api/Index.html — sebuah HALAMAN UJI COBA MINIMAL (test
 * harness), BUKAN frontend final PHASE 7 (lihat frontend/README.md dan
 * docs/DEVELOPMENT_ROADMAP.md). Tujuannya HANYA agar Report Engine
 * (PHASE 4) benar-benar dapat dibuka dan diuji oleh pengguna nyata lewat
 * URL Web App, tanpa menunggu pengembangan frontend penuh.
 *
 * Interaksi client-server memakai google.script.run (dipanggil langsung
 * dari Index.html) — TIDAK ada routing doPost/REST JSON API terpisah,
 * karena pola ini adalah cara standar Apps Script untuk halaman yang
 * dilayani lewat HtmlService pada project yang sama.
 *
 * Konfigurasi deployment (siapa yang boleh mengakses, sebagai identitas
 * siapa script dijalankan) ada pada apps-script/appsscript.json
 * ("webapp.executeAs"/"webapp.access") — WAJIB executeAs "USER_ACCESSING"
 * agar Session.getActiveUser() pada AuthContext.gs dapat mengidentifikasi
 * pemanggil.
 *
 * Dependency: HtmlService (bawaan Apps Script), apps-script/api/Index.html
 */

/**
 * Entry point Web App. Menyajikan halaman uji coba Report Engine.
 * @param {Object} e Parameter request (tidak dipakai pada MVP ini).
 * @return {HtmlOutput}
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('api/Index')
    .setTitle('SIGAP SARPRAS — Report Engine (Test Harness)')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
