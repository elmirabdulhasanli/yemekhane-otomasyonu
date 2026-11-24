// İş katmanı · değerlendirme. Kural: yalnızca kullanılmış (turnikeden geçilmiş) menü puanlanır,
// kişi başına menü başına tek oy.
const db = require('../db/havuzlar');
const degerlendirmeVeri = require('../veri/degerlendirmeVeri');
const oturumServis = require('./oturumServis');
const kurallar = require('../kurallar');
const { IsHatasi } = require('../hatalar');
const gunluk = require('../gunluk');

async function liste(oturum) {
  return degerlendirmeVeri.degerlendirilebilirMenuler(db.okuyucu(oturum), oturum.kullaniciId);
}

async function kaydet(oturum, govde) {
  const menuId = kurallar.pozitifTamsayi(govde.menu_id, 'menü');
  const { puan, yorum } = kurallar.degerlendirmeDogrula(govde);
  const durum = await degerlendirmeVeri.rezervasyonDurumu(oturum.kullaniciId, menuId);
  if (durum !== 'kullanildi') throw new IsHatasi('Yalnızca kullandığınız menüleri değerlendirebilirsiniz.', 403);
  if (await degerlendirmeVeri.mevcutDegerlendirme(oturum.kullaniciId, menuId)) {
    throw new IsHatasi('Bu menüyü zaten değerlendirdiniz.', 409);
  }
  const id = await degerlendirmeVeri.ekle(oturum.kullaniciId, menuId, puan, yorum);
  await oturumServis.yazmaYapildi(oturum);
  gunluk.bilgi('degerlendirme', 'eklendi', { kullanici: oturum.kullaniciId, menu: menuId, puan });
  return { id, menu_id: menuId, puan, yorum };
}

module.exports = { liste, kaydet };
