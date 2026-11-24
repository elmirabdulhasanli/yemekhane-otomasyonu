// Oturum deposu (Aşama 3: Redis) · anahtar: oturum:{token}, 30 dakika, her istekte yenilenir.
// Uygulama container'ı yeniden başlasa da oturumlar Redis'te (AOF açık) durduğu için düşmez.
const crypto = require('crypto');
const config = require('../config');
const redis = require('../onbellek/redis');
const { IsHatasi } = require('../hatalar');

const anahtar = (token) => `oturum:${token}`;
const SURE = () => config.oturum.sureSn;

function redisGerekli() {
  if (!redis.hazir()) throw new IsHatasi('Oturum servisine şu anda ulaşılamıyor, lütfen biraz sonra tekrar deneyin.', 503);
}

async function olustur(veri) {
  redisGerekli();
  const token = crypto.randomBytes(32).toString('hex');
  await redis.istemci.set(anahtar(token), JSON.stringify({ ...veri, olusturma: Date.now() }), { EX: SURE() });
  return token;
}

// GETEX: değeri okur ve süreyi aynı komutta 30 dakikaya yeniler (atomik).
async function getir(token) {
  redisGerekli();
  const ham = await redis.istemci.getEx(anahtar(token), { EX: SURE() });
  return ham ? { ...JSON.parse(ham), token } : null;
}

async function guncelle(token, ek) {
  redisGerekli();
  const ham = await redis.istemci.get(anahtar(token));
  if (!ham) return;
  await redis.istemci.set(anahtar(token), JSON.stringify({ ...JSON.parse(ham), ...ek }), { KEEPTTL: true });
}

async function sil(token) {
  redisGerekli();
  await redis.istemci.del(anahtar(token));
}

module.exports = { olustur, getir, guncelle, sil, anahtar };
