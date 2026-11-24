// Gate testleri: iş kuralları (veritabanı gerekmez). Çalıştırma: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const k = require('../src/kurallar');
const { IsHatasi, mysqlHatasiniCevir } = require('../src/hatalar');

const menu = { ogrenci_fiyati: 40, personel_fiyati: 90 };

test('fiyatSec: öğrenci öğrenci fiyatı, personel ve yönetici personel fiyatı öder', () => {
  assert.equal(k.fiyatSec('ogrenci', menu), 40);
  assert.equal(k.fiyatSec('personel', menu), 90);
  assert.equal(k.fiyatSec('yonetici', menu), 90);
});

test('rezervasyonDugmesi: son saat, kapasite ve mevcut rezervasyon', () => {
  assert.deepEqual(k.rezervasyonDugmesi({ suresi_doldu: 0, bos_yer: 5, rezervasyon_durum: null }), { aktif: true, neden: null });
  assert.equal(k.rezervasyonDugmesi({ suresi_doldu: 1, bos_yer: 5 }).neden, 'Son saat geçti');
  assert.equal(k.rezervasyonDugmesi({ suresi_doldu: 0, bos_yer: 0 }).neden, 'Kapasite dolu');
  assert.equal(k.rezervasyonDugmesi({ suresi_doldu: 0, bos_yer: 5, rezervasyon_durum: 'aktif' }).aktif, false);
  // İptal edilmiş rezervasyon yeniden yapılabilir (yordam kaydı tekrar aktif yapar)
  assert.equal(k.rezervasyonDugmesi({ suresi_doldu: 0, bos_yer: 5, rezervasyon_durum: 'iptal' }).aktif, true);
});

test('iptalEdilebilir: yalnızca süresi dolmamış aktif rezervasyon', () => {
  assert.equal(k.iptalEdilebilir({ durum: 'aktif', suresi_doldu: 0 }), true);
  assert.equal(k.iptalEdilebilir({ durum: 'aktif', suresi_doldu: 1 }), false);
  assert.equal(k.iptalEdilebilir({ durum: 'kullanildi', suresi_doldu: 0 }), false);
  assert.equal(k.iptalEdilebilir({ durum: 'iptal', suresi_doldu: 0 }), false);
});

test('menuyuGrupla: kategori sırası, toplam kalori, vejetaryen, alerjenler', () => {
  const ortak = { menu_id: 9, tarih: '2026-11-24', yemekhane_id: 1, yemekhane: 'Merkez', ogun_id: 2, ogun: 'Öğle',
    rezervasyon_son: '2026-11-24 10:00:00', ogrenci_fiyati: 40, personel_fiyati: 90 };
  const m = k.menuyuGrupla([
    { ...ortak, yemek_id: 1, yemek: 'Mercimek', kategori_id: 1, kategori: 'Çorba', kategori_sira: 1, kalori: 180, vejetaryen: 1, alerjenler: 'Kereviz', alerjen_idler: '9' },
    { ...ortak, yemek_id: 10, yemek: 'Tavuk', kategori_id: 2, kategori: 'Ana Yemek', kategori_sira: 2, kalori: 380, vejetaryen: 0, alerjenler: null, alerjen_idler: null },
    { ...ortak, yemek_id: 25, yemek: 'Makarna', kategori_id: 3, kategori: 'Yardımcı', kategori_sira: 3, kalori: 420, vejetaryen: 1, alerjenler: 'Gluten, Süt', alerjen_idler: '1,7' },
  ]);
  assert.equal(m.toplam_kalori, 980);
  assert.equal(m.vejetaryen, false);
  assert.deepEqual(m.kategoriler.map((x) => x.ad), ['Çorba', 'Ana Yemek', 'Yardımcı']);
  assert.deepEqual(m.kategoriler[2].yemekler[0].alerjen_idler, [1, 7]);
  assert.deepEqual(m.kategoriler[2].yemekler[0].alerjenler, ['Gluten', 'Süt']);
  assert.deepEqual(m.kategoriler[1].yemekler[0].alerjenler, []);
  assert.equal(k.menuyuGrupla([]), null);
});

test('tarihGecerli ve tarihEkle', () => {
  assert.equal(k.tarihGecerli('2026-11-24'), true);
  assert.equal(k.tarihGecerli('2026-02-30'), false);
  assert.equal(k.tarihGecerli('24.11.2026'), false);
  assert.equal(k.tarihGecerli("2026-11-24' OR 1=1"), false);
  assert.equal(k.tarihEkle('2026-11-28', 6), '2026-12-04');
  assert.equal(k.tarihEkle('2026-03-01', -1), '2026-02-28');
});

test('tutarCoz: biçim denetimi, virgül kabul edilir, aralık yordamın işi', () => {
  assert.equal(k.tutarCoz('72,50'), 72.5);
  assert.equal(k.tutarCoz(100), 100);
  assert.equal(k.tutarCoz('5'), 5); // 10'un altı: "Yükleme tutarı 10 ile 1000..." mesajını yordam verir
  for (const kotu of ['', 'abc', '-50', '10.999', '1e3', null]) {
    assert.throws(() => k.tutarCoz(kotu), IsHatasi, String(kotu));
  }
});

test('degerlendirmeDogrula: 1–5 tam sayı, yorum en fazla 500', () => {
  assert.deepEqual(k.degerlendirmeDogrula({ puan: 4, yorum: '  güzel ' }), { puan: 4, yorum: 'güzel' });
  assert.deepEqual(k.degerlendirmeDogrula({ puan: '5', yorum: '' }), { puan: 5, yorum: null });
  for (const p of [0, 6, 3.5, null, 'x']) assert.throws(() => k.degerlendirmeDogrula({ puan: p }), IsHatasi);
  assert.throws(() => k.degerlendirmeDogrula({ puan: 3, yorum: 'a'.repeat(501) }), IsHatasi);
});

test('menuFormuDogrula: zorunlu alanlar, fiyat ve yemek listesi', () => {
  const iyi = { yemekhane_id: 1, ogun_id: 2, tarih: '2026-12-01', ogrenci_fiyati: 40, personel_fiyati: 90.5, yemek_idler: [1, 1, 10] };
  assert.deepEqual(k.menuFormuDogrula(iyi).yemek_idler, [1, 10]);
  assert.throws(() => k.menuFormuDogrula({ ...iyi, yemek_idler: [] }), /en az bir yemek/);
  assert.throws(() => k.menuFormuDogrula({ ...iyi, ogrenci_fiyati: -1 }), /fiyatı/);
  assert.throws(() => k.menuFormuDogrula({ ...iyi, personel_fiyati: 10.123 }), /fiyatı/);
  assert.throws(() => k.menuFormuDogrula({ ...iyi, tarih: 'yarın' }), /tarih/);
});

test('mysqlHatasiniCevir: 1644 mesajı aynen, 3819 kullanıcıya gösterilmez', () => {
  const sp = mysqlHatasiniCevir({ errno: 1644, sqlMessage: 'Bakiye yetersiz.' });
  assert.ok(sp instanceof IsHatasi);
  assert.equal(sp.message, 'Bakiye yetersiz.');
  const check = { errno: 3819, sqlMessage: "Check constraint 'ck_kullanici_bakiye' is violated." };
  assert.equal(mysqlHatasiniCevir(check), check);
  assert.ok(!(mysqlHatasiniCevir(check) instanceof IsHatasi));
});
