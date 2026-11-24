// Veri katmanı · yönetici işlemleri (menü oluşturma/düzenleme, doluluk ve puan raporu)
const { yazma } = require('../db/havuzlar');
const { IsHatasi, mysqlHatasiniCevir } = require('../hatalar');

async function yemekler(db) {
  const [s] = await db.query(
    `SELECT y.id, y.ad, y.kalori, y.vejetaryen, k.id AS kategori_id, k.ad AS kategori, k.sira AS kategori_sira
       FROM yemekler y JOIN yemek_kategorileri k ON k.id = y.kategori_id
      ORDER BY k.sira, y.ad`);
  return s;
}

// Menü bazında doluluk ve ortalama puan (rapor → replika).
async function menuRaporu(db, baslangic, bitis, yemekhaneId) {
  const [s] = await db.query(
    `SELECT d.menu_id, d.tarih, d.yemekhane_id, d.yemekhane, d.ogun_id, d.ogun,
            d.kapasite, d.rezerve, d.bos_yer, d.doluluk_yuzde,
            p.oy_sayisi, p.ortalama_puan, m.ogrenci_fiyati, m.personel_fiyati,
            (SELECT COUNT(*) FROM menu_yemekleri my WHERE my.menu_id = d.menu_id) AS yemek_sayisi
       FROM v_menu_doluluk d
       JOIN v_menu_puan p ON p.menu_id = d.menu_id
       JOIN menuler m     ON m.id = d.menu_id
       JOIN ogunler o     ON o.id = d.ogun_id
      WHERE d.tarih BETWEEN ? AND ? AND (? IS NULL OR d.yemekhane_id = ?)
      ORDER BY d.tarih, d.yemekhane_id, o.sira`, [baslangic, bitis, yemekhaneId, yemekhaneId]);
  return s;
}

// Düzenleme formu için menü (kaynaktan: yönetici az önce kaydettiyse güncel hali gelsin).
async function menuGetir(menuId) {
  const [m] = await yazma.query(
    `SELECT id, yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati
       FROM menuler WHERE id = ?`, [menuId]);
  if (!m[0]) return null;
  const [y] = await yazma.query('SELECT yemek_id FROM menu_yemekleri WHERE menu_id = ?', [menuId]);
  return { ...m[0], yemek_idler: y.map((r) => r.yemek_id) };
}

async function rezervasyonSayisi(menuId) {
  const [s] = await yazma.query(
    `SELECT COUNT(*) AS adet FROM rezervasyonlar WHERE menu_id = ? AND durum IN ('aktif','kullanildi')`,
    [menuId]);
  return s[0].adet;
}

// Menü + yemekleri tek transaction'da yazılır (para hareketi değil, yordam yok).
async function menuOlustur({ yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati, yemek_idler }) {
  const baglanti = await yazma.getConnection();
  try {
    await baglanti.beginTransaction();
    const [sonuc] = await baglanti.query(
      `INSERT INTO menuler (yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati)
       VALUES (?, ?, ?, ?, ?)`, [yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati]);
    const menuId = sonuc.insertId;
    await baglanti.query('INSERT INTO menu_yemekleri (menu_id, yemek_id) VALUES ?',
      [yemek_idler.map((id) => [menuId, id])]);
    await baglanti.commit();
    return menuId;
  } catch (hata) {
    await baglanti.rollback();
    if (hata.errno === 1062) {
      throw new IsHatasi('Bu yemekhane, tarih ve öğün için zaten bir menü var.', 409);
    }
    throw mysqlHatasiniCevir(hata);
  } finally {
    baglanti.release();
  }
}

async function menuGuncelle(menuId, { yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati, yemek_idler }) {
  const baglanti = await yazma.getConnection();
  try {
    await baglanti.beginTransaction();
    await baglanti.query(
      `UPDATE menuler SET yemekhane_id = ?, tarih = ?, ogun_id = ?, ogrenci_fiyati = ?, personel_fiyati = ?
        WHERE id = ?`, [yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati, menuId]);
    await baglanti.query('DELETE FROM menu_yemekleri WHERE menu_id = ?', [menuId]);
    await baglanti.query('INSERT INTO menu_yemekleri (menu_id, yemek_id) VALUES ?',
      [yemek_idler.map((id) => [menuId, id])]);
    await baglanti.commit();
  } catch (hata) {
    await baglanti.rollback();
    if (hata.errno === 1062) {
      throw new IsHatasi('Bu yemekhane, tarih ve öğün için zaten bir menü var.', 409);
    }
    throw mysqlHatasiniCevir(hata);
  } finally {
    baglanti.release();
  }
}

async function yemeklerVarMi(idler) {
  const [s] = await yazma.query('SELECT COUNT(*) AS adet FROM yemekler WHERE id IN (?)', [idler]);
  return s[0].adet === idler.length;
}

module.exports = { yemekler, menuRaporu, menuGetir, rezervasyonSayisi, menuOlustur, menuGuncelle, yemeklerVarMi };
