// Veri katmanı · bakiye. Yükleme sp_bakiye_yukle ile yapılır.
const { yordamCagir } = require('../db/havuzlar');

function bakiyeYukle(kullaniciId, tutar) {
  return yordamCagir('sp_bakiye_yukle', [kullaniciId, tutar]);
}

async function guncelBakiye(db, kullaniciId) {
  const [s] = await db.query('SELECT bakiye FROM kullanicilar WHERE id = ?', [kullaniciId]);
  return s[0] ? s[0].bakiye : null;
}

async function hareketler(db, kullaniciId, adet) {
  const [s] = await db.query(
    `SELECT h.id, h.tur, h.tutar, h.aciklama, h.olusturma, h.rezervasyon_id,
            m.tarih AS menu_tarih, o.ad AS ogun
       FROM bakiye_hareketleri h
       LEFT JOIN rezervasyonlar r ON r.id = h.rezervasyon_id
       LEFT JOIN menuler m ON m.id = r.menu_id
       LEFT JOIN ogunler o ON o.id = m.ogun_id
      WHERE h.kullanici_id = ?
      ORDER BY h.olusturma DESC, h.id DESC
      LIMIT ?`, [kullaniciId, adet]);
  return s;
}

module.exports = { bakiyeYukle, guncelBakiye, hareketler };
