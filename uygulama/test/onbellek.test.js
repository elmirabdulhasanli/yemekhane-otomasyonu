// Gate testleri: menü önbelleği anahtarı ve süresi (Redis bağlantısı gerekmez).
const test = require('node:test');
const assert = require('node:assert/strict');
const mo = require('../src/onbellek/menuOnbellek');

test('anahtar biçimi: menu:{yemekhane_id}:{tarih}:{ogun_id}', () => {
  assert.equal(mo.anahtar(1, '2026-11-24', 2), 'menu:1:2026-11-24:2');
});

test('süre: menünün gününün sonu; geçmiş menüde bugünün sonu', () => {
  process.env.TZ = 'Europe/Istanbul';
  const gelecek = mo.gunSonu('2026-11-26', '2026-11-24');
  assert.equal(new Date(gelecek * 1000).toISOString(), '2026-11-26T20:59:59.000Z'); // 23:59:59 +03:00
  const gecmis = mo.gunSonu('2026-11-20', '2026-11-24');
  assert.equal(new Date(gecmis * 1000).toISOString(), '2026-11-24T20:59:59.000Z');
});
