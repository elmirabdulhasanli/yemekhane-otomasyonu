// Veri katmanı · menüler (okuma). Görünümler: v_menu_detay, v_menu_doluluk, v_menu_puan.

async function yemekhaneler(db) {
  const [s] = await db.query('SELECT id, ad, konum, kapasite FROM yemekhaneler ORDER BY id');
  return s;
}

async function ogunler(db) {
  const [s] = await db.query(
    `SELECT id, ad, sira, TIME_FORMAT(son_saat, '%H:%i') AS son_saat,
            TIME_FORMAT(servis_baslangic, '%H:%i') AS servis_baslangic,
            TIME_FORMAT(servis_bitis, '%H:%i') AS servis_bitis
       FROM ogunler ORDER BY sira`);
  return s;
}

// Bir menünün yemekleri (yemek başına bir satır), kategori sırasıyla.
async function menuDetay(db, yemekhaneId, tarih, ogunId) {
  const [s] = await db.query(
    `SELECT d.menu_id, d.tarih, d.yemekhane_id, d.yemekhane, d.ogun_id, d.ogun, d.rezervasyon_son,
            d.ogrenci_fiyati, d.personel_fiyati, o.yarim_porsiyon,
            fn_porsiyon_ucreti(d.ogrenci_fiyati, 'yarim')  AS ogrenci_yarim_fiyati,
            fn_porsiyon_ucreti(d.personel_fiyati, 'yarim') AS personel_yarim_fiyati,
            d.yemek_id, d.yemek, d.kategori_id, d.kategori,
            d.kategori_sira, d.kalori, d.vejetaryen, d.alerjenler, d.alerjen_idler
       FROM v_menu_detay d
       JOIN ogunler o ON o.id = d.ogun_id
      WHERE d.yemekhane_id = ? AND d.tarih = ? AND d.ogun_id = ?
      ORDER BY d.kategori_sira, d.yemek`, [yemekhaneId, tarih, ogunId]);
  return s;
}

// Tarih aralığındaki menüler: doluluk, fiyatlar, yemek adları ve bu kullanıcının rezervasyonu.
// suresi_doldu karşılaştırması veritabanı saatiyle yapılır (README: son saati DB'ye bırakın).
async function haftalik(db, yemekhaneId, baslangic, bitis, kullaniciId) {
  const [s] = await db.query(
    `SELECT d.menu_id, d.tarih, d.yemekhane_id, d.yemekhane, d.ogun_id, d.ogun, o.sira AS ogun_sira,
            d.kapasite, d.rezerve, d.bos_yer, d.rezervasyon_son,
            (NOW() >= d.rezervasyon_son) AS suresi_doldu,
            m.ogrenci_fiyati, m.personel_fiyati, o.yarim_porsiyon,
            fn_porsiyon_ucreti(m.ogrenci_fiyati, 'yarim')  AS ogrenci_yarim_fiyati,
            fn_porsiyon_ucreti(m.personel_fiyati, 'yarim') AS personel_yarim_fiyati,
            r.id AS rezervasyon_id, r.durum AS rezervasyon_durum, r.porsiyon AS rezervasyon_porsiyon,
            -- Aşama 4: menüde kullanıcının alerjenini içeren yemekler
            (SELECT GROUP_CONCAT(DISTINCT y.ad ORDER BY y.ad SEPARATOR ', ')
               FROM menu_yemekleri my
               JOIN yemekler y               ON y.id = my.yemek_id
               JOIN yemek_alerjenleri ya     ON ya.yemek_id = y.id
               JOIN kullanici_alerjenleri ka ON ka.alerjen_id = ya.alerjen_id AND ka.kullanici_id = ?
              WHERE my.menu_id = d.menu_id) AS uyarili_yemekler,
            (SELECT GROUP_CONCAT(y.ad ORDER BY k.sira, y.ad SEPARATOR ', ')
               FROM menu_yemekleri my
               JOIN yemekler y ON y.id = my.yemek_id
               JOIN yemek_kategorileri k ON k.id = y.kategori_id
              WHERE my.menu_id = d.menu_id) AS yemekler,
            (SELECT SUM(y.kalori) FROM menu_yemekleri my JOIN yemekler y ON y.id = my.yemek_id
              WHERE my.menu_id = d.menu_id) AS toplam_kalori
       FROM v_menu_doluluk d
       JOIN menuler m ON m.id = d.menu_id
       JOIN ogunler o ON o.id = d.ogun_id
       LEFT JOIN rezervasyonlar r ON r.menu_id = d.menu_id AND r.kullanici_id = ?
      WHERE d.yemekhane_id = ? AND d.tarih BETWEEN ? AND ?
      ORDER BY d.tarih, o.sira`, [kullaniciId, kullaniciId, yemekhaneId, baslangic, bitis]);
  return s;
}

// Tek menünün doluluğu ve süre durumu (günün menüsü ekranı için, önbelleğe alınmaz).
async function menuDurumu(db, menuId, kullaniciId) {
  const [s] = await db.query(
    `SELECT d.menu_id, d.kapasite, d.rezerve, d.bos_yer, d.rezervasyon_son,
            (NOW() >= d.rezervasyon_son) AS suresi_doldu,
            r.id AS rezervasyon_id, r.durum AS rezervasyon_durum, r.porsiyon AS rezervasyon_porsiyon
       FROM v_menu_doluluk d
       LEFT JOIN rezervasyonlar r ON r.menu_id = d.menu_id AND r.kullanici_id = ?
      WHERE d.menu_id = ?`, [kullaniciId, menuId]);
  return s[0] || null;
}

// Aşama 4: kullanıcının profilinde seçtiği alerjenler
async function kullaniciAlerjenleri(db, kullaniciId) {
  const [s] = await db.query(
    `SELECT a.id, a.ad FROM kullanici_alerjenleri ka JOIN alerjenler a ON a.id = ka.alerjen_id
      WHERE ka.kullanici_id = ?`, [kullaniciId]);
  return s;
}

async function bugun(db) {
  const [s] = await db.query('SELECT CURDATE() AS bugun');
  return s[0].bugun;
}

module.exports = { yemekhaneler, ogunler, menuDetay, haftalik, menuDurumu, kullaniciAlerjenleri, bugun };
