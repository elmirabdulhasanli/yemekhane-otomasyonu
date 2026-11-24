// Menü önbelleği · anahtar: menu:{yemekhane_id}:{tarih}:{ogun_id}
// Süre: menünün gününün sonuna kadar (geçmiş tarihli menüde bugünün sonuna kadar).
// Silinme: yönetici o menüyü oluşturduğunda/değiştirdiğinde (yonetimServis).
// Redis'e ulaşılamazsa önbellek atlanır, menü veritabanından gelir (site çalışmaya devam eder).
const redis = require('./redis');
const gunluk = require('../gunluk');

// Önbellekteki JSON'un yapı sürümü. Yapı değişirse artırılır; eski sürümlü kayıt "yok" sayılır.
const SURUM = 1;

const anahtar = (yemekhaneId, tarih, ogunId) => `menu:${yemekhaneId}:${tarih}:${ogunId}`;

// YYYY-MM-DD gününün 23:59:59'u (container saati Europe/Istanbul) → unix saniye
function gunSonu(tarih, bugun) {
  const t = tarih > bugun ? tarih : bugun;
  const [y, a, g] = t.split('-').map(Number);
  return Math.floor(new Date(y, a - 1, g, 23, 59, 59).getTime() / 1000);
}

async function getir(k) {
  if (!redis.hazir()) return undefined;
  try {
    const ham = await redis.istemci.get(k);
    if (ham === null) return undefined;
    const kayit = JSON.parse(ham);
    if (kayit.surum !== SURUM) {
      await redis.istemci.del(k);
      gunluk.bilgi('onbellek', `eski yapıdaki kayıt silindi ${k}`, { surum: kayit.surum });
      return undefined;
    }
    return kayit.menu;
  } catch (hata) {
    gunluk.uyari('onbellek', 'okunamadı, veritabanına gidiliyor', { mesaj: hata.message });
    return undefined;
  }
}

async function yaz(k, menu, tarih, bugun) {
  if (!redis.hazir()) return;
  try {
    await redis.istemci.set(k, JSON.stringify({ surum: SURUM, menu }), { EXAT: gunSonu(tarih, bugun) });
  } catch (hata) {
    gunluk.uyari('onbellek', 'yazılamadı', { mesaj: hata.message });
  }
}

async function sil(anahtarlar) {
  const liste = [...new Set(anahtarlar)];
  const silinen = await redis.istemci.del(liste);
  gunluk.bilgi('onbellek', `geçersiz kılındı ${liste.join(', ')}`, { silinen });
  return silinen;
}

module.exports = { SURUM, anahtar, gunSonu, getir, yaz, sil };
