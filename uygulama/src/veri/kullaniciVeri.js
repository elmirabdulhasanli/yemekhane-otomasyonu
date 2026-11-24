// Veri katmanı · kullanıcılar
async function epostaIleBul(db, eposta) {
  const [satirlar] = await db.query(
    `SELECT id, ad, soyad, eposta, sifre_hash, rol, ogrenci_no, bakiye, aktif
       FROM kullanicilar WHERE eposta = ? LIMIT 1`, [eposta]);
  return satirlar[0] || null;
}

async function idIleBul(db, id) {
  const [satirlar] = await db.query(
    `SELECT id, ad, soyad, eposta, rol, ogrenci_no, bakiye, aktif
       FROM kullanicilar WHERE id = ?`, [id]);
  return satirlar[0] || null;
}

module.exports = { epostaIleBul, idIleBul };
