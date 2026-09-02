#!/usr/bin/env node
/**
 * clasp-deploy-existing.js
 *
 * Menjalankan `clasp push` lalu `clasp deploy -i <CLASP_DEPLOYMENT_ID>` —
 * TIDAK PERNAH membuat deployment baru. Meniru pola yang sama dengan
 * aplikasi SIGAP (`Sigap-app/.github/scripts/clasp-deploy-existing.js`,
 * TIDAK diubah oleh perubahan ini) untuk alasan yang sama: `clasp deploy`
 * TANPA `-i` membuat deployment BARU dengan URL Web App BARU yang tidak
 * dikenal `frontend/config.js` — dan TIDAK error saat itu terjadi, jadi
 * satu-satunya gejala adalah pengguna tetap memakai versi lama tanpa ada
 * yang sadar.
 *
 * WAJIB diset: environment variable CLASP_DEPLOYMENT_ID (dapatkan dari
 * `clasp deployments`, cocokkan dengan Web App URL yang dipakai
 * frontend/config.js API_URL). Skrip ini SENGAJA berhenti dengan error jika
 * variabel ini kosong — TIDAK ada fallback ke `clasp deploy` biasa.
 *
 * Untuk deployment PERTAMA KALI (belum ada deployment sama sekali), pakai
 * `npm run clasp:deploy:first` sekali saja, lalu catat deployment id yang
 * dihasilkan sebagai CLASP_DEPLOYMENT_ID untuk seluruh deploy berikutnya.
 */

'use strict';

const { execFileSync } = require('child_process');

function run(command, args) {
  console.log('> ' + command + ' ' + args.join(' '));
  execFileSync(command, args, { stdio: 'inherit' });
}

function main() {
  const deploymentId = process.env.CLASP_DEPLOYMENT_ID;

  if (!deploymentId) {
    console.error(
      'clasp-deploy-existing.js: environment variable CLASP_DEPLOYMENT_ID belum diset.\n' +
      'Dapatkan deployment id lewat `clasp deployments` (cocokkan dengan Web App URL\n' +
      'yang dipakai frontend/config.js API_URL), lalu jalankan ulang dengan:\n' +
      '  CLASP_DEPLOYMENT_ID=<id> npm run clasp:deploy\n' +
      'Untuk deployment PERTAMA KALI (belum ada satu pun), pakai `npm run clasp:deploy:first`.'
    );
    process.exit(1);
  }

  run('clasp', ['push']);
  run('clasp', ['deploy', '-i', deploymentId]);
}

main();
