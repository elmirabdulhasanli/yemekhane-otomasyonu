// Gate testleri: Aşama 4 kuralları (yarım porsiyon, alerjen uyarısı)
const test = require('node:test');
const assert = require('node:assert/strict');
const k = require('../src/kurallar');
const { IsHatasi } = require('../src/hatalar');
const mo = require('../src/onbellek/menuOnbellek');

test('yarimFiyatSec: öğle/akşamda rolüne göre, kahvaltıda null', () => {
  const ogle = { yarim_porsiyon: 1, ogrenci_yarim_fiyati: 24, personel_yarim_fiyati: 54 };
  assert.equal(k.yarimFiyatSec('ogrenci', ogle), 24);
  assert.equal(k.yarimFiyatSec('personel', ogle), 54);
  assert.equal(k.yarimFiyatSec('yonetici', ogle), 54);
  assert.equal(k.yarimFiyatSec('ogrenci', { ...ogle, yarim_porsiyon: 0 }), null);
  assert.equal(k.yarimFiyatSec('ogrenci', { ...ogle, yarim_porsiyon: false }), null);
});

test('porsiyonCoz: boş → tam, yalnızca tam/yarim', () => {
  assert.equal(k.porsiyonCoz(undefined), 'tam');
  assert.equal(k.porsiyonCoz(''), 'tam');
  assert.equal(k.porsiyonCoz('yarim'), 'yarim');
  assert.throws(() => k.porsiyonCoz('ceyrek'), IsHatasi);
  assert.throws(() => k.porsiyonCoz('YARIM'), IsHatasi);
});

test('alerjenUyarisiEkle: yalnızca kullanıcının alerjenleri, menü değişmez', () => {
  const menu = { kategoriler: [
    { id: 1, yemekler: [{ id: 4, ad: 'Yayla', alerjen_idler: [3, 7] }, { id: 1, ad: 'Mercimek', alerjen_idler: [] }] },
    { id: 3, yemekler: [{ id: 25, ad: 'Makarna', alerjen_idler: [1, 3, 7] }] },
  ] };
  const sonuc = k.alerjenUyarisiEkle(menu, [{ id: 7, ad: 'Süt' }, { id: 1, ad: 'Gluten' }]);
  assert.deepEqual(sonuc.kategoriler[0].yemekler[0].uyari, ['Süt']);
  assert.deepEqual(sonuc.kategoriler[0].yemekler[1].uyari, []);
  assert.deepEqual(sonuc.kategoriler[1].yemekler[0].uyari, ['Gluten', 'Süt']);
  assert.equal(sonuc.uyarili_yemek_sayisi, 2);
  assert.equal(menu.kategoriler[0].yemekler[0].uyari, undefined, 'önbellekteki nesne değiştirilmemeli');
  assert.equal(k.alerjenUyarisiEkle(menu, []).uyarili_yemek_sayisi, 0);
});

test('menuyuGrupla: yarım porsiyon alanları önbelleğe giren nesnede', () => {
  const m = k.menuyuGrupla([{ menu_id: 1, tarih: '2026-11-25', yemekhane_id: 1, yemekhane: 'M', ogun_id: 2, ogun: 'Öğle',
    rezervasyon_son: 'x', ogrenci_fiyati: 40, personel_fiyati: 90, yarim_porsiyon: 1, ogrenci_yarim_fiyati: 24,
    personel_yarim_fiyati: 54, yemek_id: 1, yemek: 'A', kategori_id: 1, kategori: 'Ç', kategori_sira: 1, kalori: 100,
    vejetaryen: 1, alerjenler: null, alerjen_idler: null }]);
  assert.equal(m.yarim_porsiyon, true);
  assert.equal(m.ogrenci_yarim_fiyati, 24);
});

test('önbellek yapı sürümü 2 (Aşama 4 ile değişti; eski kayıtlar okunmaz)', () => {
  assert.equal(mo.SURUM, 2);
});
