// Uçtan uca testler: çalışan sisteme (http://localhost:8080) gerçek HTTP istekleri atar.
// Çalıştırma (depo kökünde, sistem ayaktayken):  node testler/e2e.mjs
// Not: örnek veriyi değiştirir (rezervasyon, yükleme, test menüsü). Sıfırlamak için: docker compose down -v
import test from 'node:test';
import assert from 'node:assert/strict';

const TABAN = process.env.TABAN || 'http://localhost:8080';
const SIFRE = 'Yemek2026!';

class Istemci {
  constructor() { this.cerez = ''; }
  async istek(yol, { method = 'GET', govde } = {}) {
    const y = await fetch(TABAN + '/api' + yol, {
      method,
      headers: { 'Content-Type': 'application/json', ...(this.cerez ? { Cookie: this.cerez } : {}) },
      body: govde === undefined ? undefined : JSON.stringify(govde),
    });
    const sc = y.headers.get('set-cookie');
    if (sc) this.cerez = sc.split(';')[0];
    let veri = null;
    try { veri = await y.json(); } catch { /* boş */ }
    return { durum: y.status, veri, basliklar: y.headers };
  }
  async giris(eposta) {
    const r = await this.istek('/oturum/giris', { method: 'POST', govde: { eposta, sifre: SIFRE } });
    assert.equal(r.durum, 200, JSON.stringify(r.veri));
    return r.veri.kullanici;
  }
}

const gunEkle = (t, n) => { const d = new Date(t + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const ogrenci = new Istemci();
const fakir = new Istemci();
const yonetici = new Istemci();
let bugun;

test('giriş: hatalı şifre 401 ve Türkçe mesaj', async () => {
  const r = await new Istemci().istek('/oturum/giris', { method: 'POST', govde: { eposta: 'mehmet.yildiz@ogr.kampus.edu.tr', sifre: 'yanlis' } });
  assert.equal(r.durum, 401);
  assert.equal(r.veri.hata, 'E-posta ya da şifre hatalı.');
});

test('oturumsuz istek 401', async () => {
  const r = await new Istemci().istek('/ben');
  assert.equal(r.durum, 401);
});

test('giriş (bcrypt) ve /ben', async () => {
  const k = await ogrenci.giris('Mehmet.Yildiz@ogr.kampus.edu.tr '); // büyük harf / boşluk tolere edilir
  assert.equal(k.rol, 'ogrenci');
  await fakir.giris('ayse.demir@ogr.kampus.edu.tr');
  await yonetici.giris('leyla.arslan@kampus.edu.tr');
  const r = await ogrenci.istek('/referans');
  bugun = r.veri.bugun;
  assert.equal(r.veri.ogunler.length, 3);
});

test('günün menüsü: yemekler, toplam kalori, öğrenci fiyatı', async () => {
  const r = await ogrenci.istek(`/menuler/gunluk?yemekhane_id=1&ogun_id=2&tarih=${gunEkle(bugun, 1)}`);
  assert.equal(r.durum, 200);
  const m = r.veri.menu;
  const toplam = m.kategoriler.flatMap((k) => k.yemekler).reduce((t, y) => t + y.kalori, 0);
  assert.equal(m.toplam_kalori, toplam);
  assert.equal(m.fiyat, m.ogrenci_fiyati);
  const sira = m.kategoriler.map((k) => k.sira);
  assert.deepEqual(sira, [...sira].sort((a, b) => a - b));
});

test('haftalık: 7 gün, rol fiyatı, geçmiş öğün pasif', async () => {
  const r = await yonetici.istek(`/menuler/haftalik?yemekhane_id=2&baslangic=${gunEkle(bugun, -1)}`);
  assert.equal(r.veri.gunler.length, 7);
  const dun = r.veri.gunler[0].menuler;
  assert.ok(dun.length > 0);
  for (const m of dun) assert.equal(m.dugme.aktif, false);
  const yarin = r.veri.gunler[2].menuler[0];
  assert.ok(yarin.fiyat >= 50, 'yönetici personel fiyatı öder');
});

async function menuBul(istemci, tarih, ogunId, yemekhaneId = 1) {
  const r = await istemci.istek(`/menuler/gunluk?yemekhane_id=${yemekhaneId}&ogun_id=${ogunId}&tarih=${tarih}`);
  return r.veri.menu;
}

test('rezervasyon → bakiye kaynaktan; tekrar → yordam mesajı; iptal → iade', async () => {
  const menu = await menuBul(ogrenci, gunEkle(bugun, 2), 3);
  const once = (await ogrenci.istek('/ben')).veri.kullanici.bakiye;
  if (menu.rezervasyon_durum === 'aktif') {
    await ogrenci.istek(`/rezervasyonlar/${menu.rezervasyon_id}/iptal`, { method: 'POST' });
  }
  const baslangic = (await ogrenci.istek('/ben')).veri.kullanici.bakiye;
  const r = await ogrenci.istek('/rezervasyonlar', { method: 'POST', govde: { menu_id: menu.menu_id } });
  assert.equal(r.durum, 201, JSON.stringify(r.veri));
  assert.equal(r.veri.bakiye, +(baslangic - r.veri.ucret).toFixed(2));
  // Hemen ardından okunan bakiye de güncel olmalı (okuma kaynağa yönlenir)
  const b = await ogrenci.istek('/bakiye');
  assert.equal(b.veri.bakiye, r.veri.bakiye);
  assert.equal(b.veri.kaynak, 'kaynak');

  const tekrar = await ogrenci.istek('/rezervasyonlar', { method: 'POST', govde: { menu_id: menu.menu_id } });
  assert.equal(tekrar.durum, 400);
  assert.equal(tekrar.veri.hata, 'Bu menü için zaten rezervasyonunuz var.');

  const liste = (await ogrenci.istek('/rezervasyonlar')).veri.rezervasyonlar;
  const kayit = liste.find((x) => x.id === r.veri.rezervasyon_id);
  assert.equal(kayit.durum, 'aktif');
  assert.equal(kayit.iptal_edilebilir, true);

  const iptal = await ogrenci.istek(`/rezervasyonlar/${r.veri.rezervasyon_id}/iptal`, { method: 'POST' });
  assert.equal(iptal.durum, 200);
  assert.equal(iptal.veri.iade, r.veri.ucret);
  assert.equal(iptal.veri.bakiye, baslangic);
  assert.ok(once >= 0);
});

test('yordam hata mesajları arayüze aynen iletilir', async () => {
  const yarin = await menuBul(fakir, gunEkle(bugun, 1), 2);
  const r1 = await fakir.istek('/rezervasyonlar', { method: 'POST', govde: { menu_id: yarin.menu_id } });
  assert.equal(r1.veri.hata, 'Bakiye yetersiz.');

  const dun = await menuBul(ogrenci, gunEkle(bugun, -1), 2);
  const r2 = await ogrenci.istek('/rezervasyonlar', { method: 'POST', govde: { menu_id: dun.menu_id } });
  assert.equal(r2.veri.hata, 'Bu menü için rezervasyon süresi doldu.');

  const r3 = await ogrenci.istek('/bakiye/yukle', { method: 'POST', govde: { tutar: 5 } });
  assert.equal(r3.veri.hata, 'Yükleme tutarı 10 ile 1000 TL arasında olmalıdır.');

  const r4 = await ogrenci.istek('/rezervasyonlar/999999/iptal', { method: 'POST' });
  assert.equal(r4.veri.hata, 'Rezervasyon bulunamadı.');

  const r5 = await ogrenci.istek('/rezervasyonlar', { method: 'POST', govde: { menu_id: 999999 } });
  assert.equal(r5.veri.hata, 'Menü bulunamadı.');
});

test('bakiye yükleme ve hareket geçmişi', async () => {
  const once = (await ogrenci.istek('/bakiye')).veri;
  const r = await ogrenci.istek('/bakiye/yukle', { method: 'POST', govde: { tutar: '25,50' } });
  assert.equal(r.durum, 201);
  assert.equal(r.veri.bakiye, +(once.bakiye + 25.5).toFixed(2));
  const sonra = (await ogrenci.istek('/bakiye')).veri;
  assert.equal(sonra.hareketler[0].tur, 'yukleme');
  assert.equal(sonra.hareketler[0].tutar, 25.5);
});

test('değerlendirme: kullanılmamış menü reddedilir, kullanılmış menü bir kez puanlanır', async () => {
  const gelecek = await menuBul(ogrenci, gunEkle(bugun, 3), 2);
  const red = await ogrenci.istek('/degerlendirmeler', { method: 'POST', govde: { menu_id: gelecek.menu_id, puan: 5 } });
  assert.equal(red.durum, 403);
  assert.equal(red.veri.hata, 'Yalnızca kullandığınız menüleri değerlendirebilirsiniz.');

  const { menuler } = (await ogrenci.istek('/degerlendirmeler')).veri;
  const bekleyen = menuler.find((m) => m.puan == null);
  if (!bekleyen) return; // örnek veride hepsi puanlanmışsa
  const gecersiz = await ogrenci.istek('/degerlendirmeler', { method: 'POST', govde: { menu_id: bekleyen.menu_id, puan: 7 } });
  assert.equal(gecersiz.durum, 400);
  const ok = await ogrenci.istek('/degerlendirmeler', { method: 'POST', govde: { menu_id: bekleyen.menu_id, puan: 4, yorum: 'e2e test' } });
  assert.equal(ok.durum, 201);
  const iki = await ogrenci.istek('/degerlendirmeler', { method: 'POST', govde: { menu_id: bekleyen.menu_id, puan: 2 } });
  assert.equal(iki.veri.hata, 'Bu menüyü zaten değerlendirdiniz.');
});

test('yönetici paneli: yetki, menü oluşturma, çakışma, düzenleme, rapor', async () => {
  assert.equal((await ogrenci.istek('/yonetim/menuler')).durum, 403);
  // Menüsü olmayan rastgele bir gelecek tarih bul (önceki çalıştırmalarla çakışmasın)
  let tarih;
  for (let i = 0; i < 30 && !tarih; i++) {
    const aday = gunEkle(bugun, 40 + Math.floor(Math.random() * 600));
    const v = await yonetici.istek(`/yonetim/menuler?baslangic=${aday}&bitis=${aday}&yemekhane_id=2`);
    if (!v.veri.menuler.some((m) => m.ogun_id === 2)) tarih = aday;
  }
  assert.ok(tarih, 'boş tarih bulunamadı');
  const govde = { yemekhane_id: 2, ogun_id: 2, tarih, ogrenci_fiyati: 41.5, personel_fiyati: 91, yemek_idler: [1, 10, 25] };
  const r = await yonetici.istek('/yonetim/menuler', { method: 'POST', govde });
  assert.equal(r.durum, 201, JSON.stringify(r.veri));
  const cakisma = await yonetici.istek('/yonetim/menuler', { method: 'POST', govde });
  assert.equal(cakisma.durum, 409);

  // Aşama 3: ilk istek veritabanından, ikincisi Redis'ten
  const yol = `/menuler/gunluk?yemekhane_id=2&ogun_id=2&tarih=${tarih}`;
  const ilk = await ogrenci.istek(yol);
  assert.equal(ilk.basliklar.get('x-menu-kaynak'), 'veritabani');
  const ikinci = await ogrenci.istek(yol);
  assert.equal(ikinci.basliklar.get('x-menu-kaynak'), 'redis');
  assert.deepEqual(ikinci.veri.menu.kategoriler, ilk.veri.menu.kategoriler);

  const g = await yonetici.istek(`/yonetim/menuler/${r.veri.id}`, { method: 'PUT', govde: { ...govde, yemek_idler: [2, 11], ogrenci_fiyati: 42 } });
  assert.equal(g.durum, 200, JSON.stringify(g.veri));
  // Güncellemeden sonra eski kayıt silinmiş olmalı: istek yine veritabanına gider ve YENİ menüyü görür
  const sonra = await ogrenci.istek(yol);
  assert.equal(sonra.basliklar.get('x-menu-kaynak'), 'veritabani');
  const menu = sonra.veri.menu;
  assert.deepEqual(menu.kategoriler.flatMap((k) => k.yemekler.map((y) => y.id)).sort((a, b) => a - b), [2, 11]);
  assert.equal(menu.fiyat, 42);
  const rapor = await yonetici.istek(`/yonetim/menuler?baslangic=${tarih}&bitis=${tarih}&yemekhane_id=2`);
  assert.equal(rapor.veri.menuler.length, 1);
  assert.equal(rapor.veri.menuler[0].rezerve, 0);
  const bos = await yonetici.istek('/yonetim/menuler', { method: 'POST', govde: { ...govde, yemek_idler: [] } });
  assert.equal(bos.veri.hata, 'Menüye en az bir yemek ekleyin.');
});

// ---------------- Aşama 4 ----------------
test('Aşama 4 · yarım porsiyon: öğlede %60 ücret, kahvaltıda reddedilir', async () => {
  const k = new Istemci();
  await k.giris('zeynep.sahin@ogr.kampus.edu.tr');
  await k.istek('/bakiye/yukle', { method: 'POST', govde: { tutar: 200 } });
  const ogle = await menuBul(k, gunEkle(bugun, 4), 2, 2);
  assert.equal(ogle.yarim_porsiyon, true);
  assert.equal(ogle.yarim_fiyat, +(ogle.fiyat * 0.6).toFixed(2));
  if (ogle.rezervasyon_durum === 'aktif') await k.istek(`/rezervasyonlar/${ogle.rezervasyon_id}/iptal`, { method: 'POST' });
  const r = await k.istek('/rezervasyonlar', { method: 'POST', govde: { menu_id: ogle.menu_id, porsiyon: 'yarim' } });
  assert.equal(r.durum, 201, JSON.stringify(r.veri));
  assert.equal(r.veri.porsiyon, 'yarim');
  assert.equal(r.veri.ucret, ogle.yarim_fiyat);
  const liste = (await k.istek('/rezervasyonlar')).veri.rezervasyonlar;
  assert.equal(liste.find((x) => x.id === r.veri.rezervasyon_id).porsiyon, 'yarim');
  const h = (await k.istek('/bakiye')).veri.hareketler[0];
  assert.equal(h.aciklama, 'Rezervasyon (yarım porsiyon)');
  assert.equal(h.tutar, -ogle.yarim_fiyat);
  // iptal → yarım ücret iade edilir; tekrar tam porsiyon → kayıt yeniden aktif, tam ücret
  const iptal = await k.istek(`/rezervasyonlar/${r.veri.rezervasyon_id}/iptal`, { method: 'POST' });
  assert.equal(iptal.veri.iade, ogle.yarim_fiyat);
  const tam = await k.istek('/rezervasyonlar', { method: 'POST', govde: { menu_id: ogle.menu_id, porsiyon: 'tam' } });
  assert.equal(tam.veri.ucret, ogle.fiyat);
  assert.equal(tam.veri.rezervasyon_id, r.veri.rezervasyon_id);
  await k.istek(`/rezervasyonlar/${tam.veri.rezervasyon_id}/iptal`, { method: 'POST' });

  const kahvalti = await menuBul(k, gunEkle(bugun, 4), 1, 2);
  assert.equal(kahvalti.yarim_porsiyon, false);
  assert.equal(kahvalti.yarim_fiyat, null);
  const red = await k.istek('/rezervasyonlar', { method: 'POST', govde: { menu_id: kahvalti.menu_id, porsiyon: 'yarim' } });
  assert.equal(red.veri.hata, 'Bu öğünde yarım porsiyon seçilemez.');
  const gecersiz = await k.istek('/rezervasyonlar', { method: 'POST', govde: { menu_id: ogle.menu_id, porsiyon: 'ceyrek' } });
  assert.equal(gecersiz.veri.hata, 'Geçersiz porsiyon seçimi.');
});

test('Aşama 4 · personel yarım porsiyonu personel fiyatının %60ı', async () => {
  const k = new Istemci();
  await k.giris('sevgi.ozdemir@kampus.edu.tr');
  const m = await menuBul(k, gunEkle(bugun, 5), 3, 1);
  assert.equal(m.fiyat, m.personel_fiyati);
  assert.equal(m.yarim_fiyat, +(m.personel_fiyati * 0.6).toFixed(2));
});

test('Aşama 4 · alerjen profili ve menüde uyarı', async () => {
  const k = new Istemci();
  await k.giris('emre.koc@ogr.kampus.edu.tr');
  const { alerjenler } = (await k.istek('/profil/alerjenler')).veri;
  assert.equal(alerjenler.length, 14);
  const sut = alerjenler.find((a) => a.ad === 'Süt');
  const gluten = alerjenler.find((a) => a.ad === 'Gluten');
  const kayit = await k.istek('/profil/alerjenler', { method: 'PUT', govde: { alerjen_idler: [sut.id, gluten.id] } });
  assert.equal(kayit.durum, 200);
  assert.deepEqual(kayit.veri.alerjenler.filter((a) => a.secili).map((a) => a.ad).sort(), ['Gluten', 'Süt']);

  let bulundu = false;
  for (let gun = 0; gun < 6 && !bulundu; gun++) {
    for (const ogun of [1, 2, 3]) {
      const m = await menuBul(k, gunEkle(bugun, gun), ogun, 1);
      if (!m) continue;
      for (const y of m.kategoriler.flatMap((x) => x.yemekler)) {
        const beklenen = y.alerjenler.filter((a) => a === 'Süt' || a === 'Gluten').sort();
        assert.deepEqual([...y.uyari].sort(), beklenen, y.ad);
        if (beklenen.length) bulundu = true;
      }
      if (bulundu) {
        assert.ok(m.uyarili_yemek_sayisi > 0);
        assert.deepEqual([...m.alerjenlerim].sort(), ['Gluten', 'Süt']);
        break;
      }
    }
  }
  assert.ok(bulundu, 'süt/gluten içeren yemek bulunamadı');

  const hafta = (await k.istek(`/menuler/haftalik?yemekhane_id=1&baslangic=${bugun}`)).veri;
  assert.ok(hafta.gunler.flatMap((g) => g.menuler).some((m) => m.uyarili_yemekler.length > 0));

  // Başka kullanıcı etkilenmez (menü önbelleği kullanıcıdan bağımsız)
  const diger = new Istemci();
  await diger.giris('elif.kurt@ogr.kampus.edu.tr');
  await diger.istek('/profil/alerjenler', { method: 'PUT', govde: { alerjen_idler: [] } });
  const m2 = await menuBul(diger, bugun, 2, 1);
  assert.equal(m2.uyarili_yemek_sayisi, 0);

  const kotu = await k.istek('/profil/alerjenler', { method: 'PUT', govde: { alerjen_idler: [99] } });
  assert.equal(kotu.veri.hata, 'Seçilen alerjenlerden biri bulunamadı.');
});

test('çıkış oturumu kapatır', async () => {
  const k = new Istemci();
  await k.giris('murat.kaya@kampus.edu.tr');
  const eskiCerez = k.cerez;
  assert.equal((await k.istek('/oturum/cikis', { method: 'POST' })).durum, 200);
  k.cerez = eskiCerez; // tarayıcı çerezi silmese bile sunucu tarafında oturum yok olmalı
  assert.equal((await k.istek('/ben')).durum, 401);
});
