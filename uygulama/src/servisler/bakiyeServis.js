// İş katmanı · bakiye ve hareketler
const db = require('../db/havuzlar');
const bakiyeVeri = require('../veri/bakiyeVeri');
const oturumServis = require('./oturumServis');
const kurallar = require('../kurallar');
const gunluk = require('../gunluk');

async function ozet(oturum) {
  const okuyucu = db.okuyucu(oturum);
  const [bakiye, hareketler] = await Promise.all([
    bakiyeVeri.guncelBakiye(okuyucu, oturum.kullaniciId),
    bakiyeVeri.hareketler(okuyucu, oturum.kullaniciId, 100),
  ]);
  return { bakiye, kaynak: okuyucu.ad, hareketler };
}

async function yukle(oturum, govde) {
  const tutar = kurallar.tutarCoz(govde.tutar);
  const sonuc = await bakiyeVeri.bakiyeYukle(oturum.kullaniciId, tutar);
  await oturumServis.yazmaYapildi(oturum);
  gunluk.bilgi('bakiye', 'yükleme', { kullanici: oturum.kullaniciId, tutar, ...sonuc });
  return sonuc;
}

module.exports = { ozet, yukle };
