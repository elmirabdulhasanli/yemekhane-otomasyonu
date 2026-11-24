// Veri katmanı · profil (alerjen seçimi, Aşama 4)
const { yazma } = require('../db/havuzlar');
const { mysqlHatasiniCevir } = require('../hatalar');

async function tumAlerjenler(db) {
  const [s] = await db.query('SELECT id, ad FROM alerjenler ORDER BY ad');
  return s;
}

async function kullaniciAlerjenleri(db, kullaniciId) {
  const [s] = await db.query(
    `SELECT a.id, a.ad FROM kullanici_alerjenleri ka JOIN alerjenler a ON a.id = ka.alerjen_id
      WHERE ka.kullanici_id = ? ORDER BY a.ad`, [kullaniciId]);
  return s;
}

async function alerjenlerVarMi(idler) {
  if (!idler.length) return true;
  const [s] = await yazma.query('SELECT COUNT(*) AS adet FROM alerjenler WHERE id IN (?)', [idler]);
  return s[0].adet === idler.length;
}

// Seçimi tamamen yeniler (sil + ekle) tek transaction'da.
async function alerjenleriKaydet(kullaniciId, idler) {
  const b = await yazma.getConnection();
  try {
    await b.beginTransaction();
    await b.query('DELETE FROM kullanici_alerjenleri WHERE kullanici_id = ?', [kullaniciId]);
    if (idler.length) {
      await b.query('INSERT INTO kullanici_alerjenleri (kullanici_id, alerjen_id) VALUES ?',
        [idler.map((id) => [kullaniciId, id])]);
    }
    await b.commit();
  } catch (hata) {
    await b.rollback();
    throw mysqlHatasiniCevir(hata);
  } finally {
    b.release();
  }
}

module.exports = { tumAlerjenler, kullaniciAlerjenleri, alerjenlerVarMi, alerjenleriKaydet };
