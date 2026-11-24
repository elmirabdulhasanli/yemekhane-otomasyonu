// İş kuralları · saf fonksiyonlar (veritabanı ve HTTP bilmez, birim testleri test/kurallar.test.js).
const { IsHatasi } = require('./hatalar');

const TARIH_DESENI = /^\d{4}-\d{2}-\d{2}$/;

// Rolüne göre ödenecek tam fiyat: öğrenci → öğrenci fiyatı, personel ve yönetici → personel fiyatı.
function fiyatSec(rol, menu) {
  return rol === 'ogrenci' ? menu.ogrenci_fiyati : menu.personel_fiyati;
}

// Haftalık menüdeki "Rezervasyon yap" düğmesinin durumu ve pasifse nedeni.
function rezervasyonDugmesi({ suresi_doldu, bos_yer, rezervasyon_durum }) {
  if (rezervasyon_durum === 'aktif') return { aktif: false, neden: 'Rezervasyonunuz var' };
  if (rezervasyon_durum === 'kullanildi') return { aktif: false, neden: 'Kullanıldı' };
  if (Number(suresi_doldu) === 1) return { aktif: false, neden: 'Son saat geçti' };
  if (bos_yer <= 0) return { aktif: false, neden: 'Kapasite dolu' };
  return { aktif: true, neden: null };
}

// Rezervasyon iptal edilebilir mi? (Son kararı yine sp_rezervasyon_iptal verir.)
function iptalEdilebilir({ durum, suresi_doldu }) {
  return durum === 'aktif' && Number(suresi_doldu) !== 1;
}

// v_menu_detay satırlarını (yemek başına bir satır) tek menü nesnesine çevirir.
function menuyuGrupla(satirlar) {
  if (!satirlar.length) return null;
  const ilk = satirlar[0];
  const kategoriler = [];
  let toplamKalori = 0;
  for (const s of satirlar) {
    let kat = kategoriler.find((k) => k.id === s.kategori_id);
    if (!kat) { kat = { id: s.kategori_id, ad: s.kategori, sira: s.kategori_sira, yemekler: [] }; kategoriler.push(kat); }
    kat.yemekler.push({
      id: s.yemek_id,
      ad: s.yemek,
      kalori: s.kalori,
      vejetaryen: s.vejetaryen === 1,
      alerjenler: s.alerjenler ? s.alerjenler.split(', ') : [],
      alerjen_idler: s.alerjen_idler ? s.alerjen_idler.split(',').map(Number) : [],
    });
    toplamKalori += s.kalori;
  }
  kategoriler.sort((a, b) => a.sira - b.sira);
  const tumYemekler = kategoriler.flatMap((k) => k.yemekler);
  return {
    menu_id: ilk.menu_id,
    tarih: ilk.tarih,
    yemekhane_id: ilk.yemekhane_id,
    yemekhane: ilk.yemekhane,
    ogun_id: ilk.ogun_id,
    ogun: ilk.ogun,
    rezervasyon_son: ilk.rezervasyon_son,
    ogrenci_fiyati: ilk.ogrenci_fiyati,
    personel_fiyati: ilk.personel_fiyati,
    toplam_kalori: toplamKalori,
    vejetaryen: tumYemekler.every((y) => y.vejetaryen),
    kategoriler,
  };
}

function tarihGecerli(t) {
  if (typeof t !== 'string' || !TARIH_DESENI.test(t)) return false;
  const d = new Date(t + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t;
}

function tarihEkle(t, gun) {
  const d = new Date(t + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + gun);
  return d.toISOString().slice(0, 10);
}

function pozitifTamsayi(deger, alan) {
  const n = Number(deger);
  if (!Number.isInteger(n) || n <= 0) throw new IsHatasi(`Geçersiz ${alan}.`);
  return n;
}

// Bakiye yükleme tutarı: sayı ve en fazla 2 ondalık. Aralık kontrolünü (10–1000) yordam yapar
// ve mesajını kullanıcıya iletiriz; burada yalnızca biçimi denetleriz.
function tutarCoz(deger) {
  const metin = String(deger ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(metin)) throw new IsHatasi('Tutar geçerli bir sayı olmalıdır (ör. 50 ya da 72,50).');
  return Number(metin);
}

function degerlendirmeDogrula({ puan, yorum }) {
  const p = Number(puan);
  if (!Number.isInteger(p) || p < 1 || p > 5) throw new IsHatasi('Puan 1 ile 5 arasında bir tam sayı olmalıdır.');
  let y = yorum == null ? null : String(yorum).trim();
  if (y === '') y = null;
  if (y && y.length > 500) throw new IsHatasi('Yorum en fazla 500 karakter olabilir.');
  return { puan: p, yorum: y };
}

// Yönetici menü formu
function menuFormuDogrula(g) {
  const yemekhane_id = pozitifTamsayi(g.yemekhane_id, 'yemekhane');
  const ogun_id = pozitifTamsayi(g.ogun_id, 'öğün');
  if (!tarihGecerli(g.tarih)) throw new IsHatasi('Geçerli bir tarih seçin.');
  const ogrenci_fiyati = Number(g.ogrenci_fiyati);
  const personel_fiyati = Number(g.personel_fiyati);
  for (const [f, ad] of [[ogrenci_fiyati, 'Öğrenci'], [personel_fiyati, 'Personel']]) {
    if (!Number.isFinite(f) || f < 0 || f > 10000 || Math.round(f * 100) !== f * 100) {
      throw new IsHatasi(`${ad} fiyatı 0 ile 10000 arasında, en fazla 2 ondalıklı olmalıdır.`);
    }
  }
  if (!Array.isArray(g.yemek_idler) || g.yemek_idler.length === 0) throw new IsHatasi('Menüye en az bir yemek ekleyin.');
  const yemek_idler = [...new Set(g.yemek_idler.map((id) => pozitifTamsayi(id, 'yemek')))];
  if (yemek_idler.length > 15) throw new IsHatasi('Bir menüde en fazla 15 yemek olabilir.');
  return { yemekhane_id, ogun_id, tarih: g.tarih, ogrenci_fiyati, personel_fiyati, yemek_idler };
}

module.exports = {
  fiyatSec, rezervasyonDugmesi, iptalEdilebilir, menuyuGrupla, tarihGecerli, tarihEkle,
  pozitifTamsayi, tutarCoz, degerlendirmeDogrula, menuFormuDogrula,
};
