// Veri katmanı · rezervasyonlar. Para hareketi yapan işlemler stored procedure ile yapılır.
const { yordamCagir } = require('../db/havuzlar');

// Aşama 4: porsiyon parametresi ('tam' | 'yarim'); ücret ve öğün kontrolü yordamda.
function rezervasyonYap(kullaniciId, menuId, porsiyon) {
  return yordamCagir('sp_rezervasyon_yap', [kullaniciId, menuId, porsiyon]);
}

function rezervasyonIptal(kullaniciId, rezervasyonId) {
  return yordamCagir('sp_rezervasyon_iptal', [kullaniciId, rezervasyonId]);
}

async function kullanicininRezervasyonlari(db, kullaniciId) {
  const [s] = await db.query(
    `SELECT r.id, r.menu_id, r.durum, r.porsiyon, r.ucret, r.olusturma, r.kullanma_zamani, r.iptal_zamani,
            m.tarih, m.yemekhane_id, yh.ad AS yemekhane, m.ogun_id, o.ad AS ogun,
            TIMESTAMP(m.tarih, o.son_saat) AS rezervasyon_son,
            (NOW() >= TIMESTAMP(m.tarih, o.son_saat)) AS suresi_doldu
       FROM rezervasyonlar r
       JOIN menuler m       ON m.id = r.menu_id
       JOIN ogunler o       ON o.id = m.ogun_id
       JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
      WHERE r.kullanici_id = ?
      ORDER BY m.tarih DESC, o.sira DESC`, [kullaniciId]);
  return s;
}

module.exports = { rezervasyonYap, rezervasyonIptal, kullanicininRezervasyonlari };
