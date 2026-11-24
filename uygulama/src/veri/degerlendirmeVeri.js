// Veri katmanı · değerlendirmeler
const { yazma } = require('../db/havuzlar');
const { mysqlHatasiniCevir } = require('../hatalar');

// Kullanıcının kullandığı menüler ve varsa verdiği puan.
async function degerlendirilebilirMenuler(db, kullaniciId) {
  const [s] = await db.query(
    `SELECT r.menu_id, m.tarih, yh.ad AS yemekhane, o.ad AS ogun, r.kullanma_zamani,
            d.puan, d.yorum, d.olusturma AS degerlendirme_zamani,
            (SELECT GROUP_CONCAT(y.ad ORDER BY k.sira, y.ad SEPARATOR ', ')
               FROM menu_yemekleri my JOIN yemekler y ON y.id = my.yemek_id
               JOIN yemek_kategorileri k ON k.id = y.kategori_id
              WHERE my.menu_id = r.menu_id) AS yemekler
       FROM rezervasyonlar r
       JOIN menuler m       ON m.id = r.menu_id
       JOIN ogunler o       ON o.id = m.ogun_id
       JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
       LEFT JOIN degerlendirmeler d ON d.menu_id = r.menu_id AND d.kullanici_id = r.kullanici_id
      WHERE r.kullanici_id = ? AND r.durum = 'kullanildi'
      ORDER BY m.tarih DESC, o.sira DESC`, [kullaniciId]);
  return s;
}

// Yazma öncesi kontrol olduğu için her zaman kaynaktan okunur.
async function rezervasyonDurumu(kullaniciId, menuId) {
  const [s] = await yazma.query(
    'SELECT durum FROM rezervasyonlar WHERE kullanici_id = ? AND menu_id = ?', [kullaniciId, menuId]);
  return s[0] ? s[0].durum : null;
}

async function mevcutDegerlendirme(kullaniciId, menuId) {
  const [s] = await yazma.query(
    'SELECT id FROM degerlendirmeler WHERE kullanici_id = ? AND menu_id = ?', [kullaniciId, menuId]);
  return s[0] || null;
}

async function ekle(kullaniciId, menuId, puan, yorum) {
  try {
    const [sonuc] = await yazma.query(
      'INSERT INTO degerlendirmeler (kullanici_id, menu_id, puan, yorum) VALUES (?, ?, ?, ?)',
      [kullaniciId, menuId, puan, yorum]);
    return sonuc.insertId;
  } catch (hata) {
    throw mysqlHatasiniCevir(hata);
  }
}

module.exports = { degerlendirilebilirMenuler, rezervasyonDurumu, mevcutDegerlendirme, ekle };
