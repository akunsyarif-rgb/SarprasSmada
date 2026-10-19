'use strict';
// Tes logika murni backend (hash password, perbandingan, sanitasi sel, validasi panjang)
// dengan shim minimal untuk Utilities Apps Script. Jalankan: node tests/auth.test.js
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const toBuf = (v) => (typeof v === 'string' ? Buffer.from(v, 'utf8') : Buffer.from(v.map((b) => b & 255)));
const toSigned = (buf) => Array.from(buf).map((b) => (b > 127 ? b - 256 : b));

const sandbox = {
  console,
  Utilities: {
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    getUuid: () => crypto.randomUUID(),
    newBlob: (s) => ({ getBytes: () => toSigned(Buffer.from(s, 'utf8')) }),
    computeDigest: (alg, v) => toSigned(crypto.createHash('sha256').update(toBuf(v)).digest()),
    computeHmacSha256Signature: (v, key) => toSigned(crypto.createHmac('sha256', toBuf(key)).update(toBuf(v)).digest())
  }
};
vm.createContext(sandbox);
const root = path.join(__dirname, '..', 'apps-script');
['core/UtilityService.gs', 'auth/AuthService.gs', 'core/DatabaseService.gs'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
});
const run = (code) => vm.runInContext(code, sandbox);

// PBKDF2 harus sama dengan implementasi referensi Node.
const hash = run("authHashPassword_('rahasia123', 'garam-uji')");
const ref = crypto.pbkdf2Sync('rahasia123', 'garam-uji', 2000, 32, 'sha256').toString('hex');
assert.strictEqual(hash, 'pbkdf2$2000$' + ref);

// Verifikasi format baru & hash lama.
sandbox.u1 = { password_hash: hash, password_salt: 'garam-uji' };
assert.strictEqual(run("authVerifyPassword_('rahasia123', u1)"), true);
assert.strictEqual(run("authVerifyPassword_('salah-total', u1)"), false);
sandbox.u2 = { password_hash: run("authLegacyHashPassword_('lama12345', 's')"), password_salt: 's' };
assert.strictEqual(run("authVerifyPassword_('lama12345', u2)"), true);
assert.strictEqual(run("authVerifyPassword_('lama12346', u2)"), false);
assert.strictEqual(run("authVerifyPassword_('x'.repeat(201), u1)"), false);

// Perbandingan waktu-konstan.
assert.strictEqual(run("authConstantTimeEquals_('abc', 'abc')"), true);
assert.strictEqual(run("authConstantTimeEquals_('abc', 'abd')"), false);
assert.strictEqual(run("authConstantTimeEquals_('abc', 'abcd')"), false);

// Formula injection.
assert.strictEqual(run("sanitizeCellValue_('=1+1')"), "'=1+1");
assert.strictEqual(run("sanitizeCellValue_('@x')"), "'@x");
assert.strictEqual(run("sanitizeCellValue_('aman')"), 'aman');
assert.strictEqual(run('sanitizeCellValue_(42)'), 42);

// Validasi panjang.
assert.doesNotThrow(() => run("assertMaxLength_('abc', 5, 'f')"));
assert.throws(() => run("assertMaxLength_('abcdef', 5, 'f')"), /maksimal 5/);
assert.throws(() => run("assertMaxLength_(123, 5, 'f')"), /teks/);

console.log('semua tes lulus');
