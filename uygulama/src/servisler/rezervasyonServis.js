// İş katmanı · rezervasyon yap / iptal / listele
const db = require('../db/havuzlar');
const rezervasyonVeri = require('../veri/rezervasyonVeri');
const oturumServis = require('./oturumServis');
const kurallar = require('../kurallar');
const gunluk = require('../gunluk');

async function yap(oturum, govde) {
  const menuId = kurallar.pozitifTamsayi(govde.menu_id, 'menü');
  const sonuc = await rezervasyonVeri.rezervasyonYap(oturum.kullaniciId, menuId);
  await oturumServis.yazmaYapildi(oturum);
  gunluk.bilgi('rezervasyon', 'yapıldı', { kullanici: oturum.kullaniciId, menu: menuId, ...sonuc });
  // Yordamın döndürdüğü bakiye kaynaktaki güncel değerdir (replika henüz yakalamamış olabilir).
  return sonuc;
}

async function iptal(oturum, rezervasyonIdHam) {
  const rezervasyonId = kurallar.pozitifTamsayi(rezervasyonIdHam, 'rezervasyon');
  const sonuc = await rezervasyonVeri.rezervasyonIptal(oturum.kullaniciId, rezervasyonId);
  await oturumServis.yazmaYapildi(oturum);
  gunluk.bilgi('rezervasyon', 'iptal', { kullanici: oturum.kullaniciId, ...sonuc });
  return sonuc;
}

async function listele(oturum) {
  const satirlar = await rezervasyonVeri.kullanicininRezervasyonlari(db.okuyucu(oturum), oturum.kullaniciId);
  return satirlar.map(({ suresi_doldu, ...r }) => ({ ...r, iptal_edilebilir: kurallar.iptalEdilebilir({ durum: r.durum, suresi_doldu }) }));
}

module.exports = { yap, iptal, listele };
