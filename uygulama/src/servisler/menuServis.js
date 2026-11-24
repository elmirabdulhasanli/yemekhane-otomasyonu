// İş katmanı · günün menüsü ve haftalık menü
const db = require('../db/havuzlar');
const menuVeri = require('../veri/menuVeri');
const kurallar = require('../kurallar');
const zaman = require('../zaman');
const { IsHatasi } = require('../hatalar');
const menuOnbellek = require('../onbellek/menuOnbellek');
const gunlukYaz = require('../gunluk');

async function referans() {
  const [yemekhaneler, ogunler] = await Promise.all([menuVeri.yemekhaneler(db.okuma), menuVeri.ogunler(db.okuma)]);
  return { yemekhaneler, ogunler, bugun: zaman.bugun() };
}

// Kullanıcıdan bağımsız menü içeriği (yemekler, kalori, alerjenler, fiyatlar) → Redis'te önbelleklenir.
// Dönüş: { menu, kaynak: 'redis' | 'veritabani' }
async function menuIcerigi(yemekhaneId, tarih, ogunId) {
  const k = menuOnbellek.anahtar(yemekhaneId, tarih, ogunId);
  const onbellekte = await menuOnbellek.getir(k);
  if (onbellekte !== undefined) {
    gunlukYaz.bilgi('menu', `${k} kaynak=redis`);
    return { menu: onbellekte, kaynak: 'redis' };
  }
  const satirlar = await menuVeri.menuDetay(db.okuma, yemekhaneId, tarih, ogunId);
  const menu = kurallar.menuyuGrupla(satirlar);
  gunlukYaz.bilgi('menu', `${k} kaynak=veritabani(${db.okuma.ad})`);
  if (menu) await menuOnbellek.yaz(k, menu, tarih, zaman.bugun()); // menü yoksa önbelleğe yazılmaz
  return { menu, kaynak: 'veritabani' };
}

async function gunluk(oturum, sorgu) {
  const yemekhaneId = kurallar.pozitifTamsayi(sorgu.yemekhane_id, 'yemekhane');
  const ogunId = kurallar.pozitifTamsayi(sorgu.ogun_id, 'öğün');
  const tarih = sorgu.tarih || zaman.bugun();
  if (!kurallar.tarihGecerli(tarih)) throw new IsHatasi('Geçersiz tarih.');

  const { menu, kaynak } = await menuIcerigi(yemekhaneId, tarih, ogunId);
  if (!menu) return { menu: null, tarih, kaynak };

  // Kullanıcıya özel ve anlık kısımlar (doluluk, rezervasyon, alerjen uyarısı) önbelleğe alınmaz
  const okuyucu = db.okuyucu(oturum);
  const [durum, alerjenler] = await Promise.all([
    menuVeri.menuDurumu(okuyucu, menu.menu_id, oturum.kullaniciId),
    menuVeri.kullaniciAlerjenleri(okuyucu, oturum.kullaniciId),
  ]);
  return {
    tarih,
    kaynak,
    menu: {
      ...kurallar.alerjenUyarisiEkle(menu, alerjenler),
      fiyat: kurallar.fiyatSec(oturum.rol, menu),
      yarim_fiyat: kurallar.yarimFiyatSec(oturum.rol, menu),
      rezervasyon_porsiyon: durum.rezervasyon_porsiyon,
      alerjenlerim: alerjenler.map((a) => a.ad),
      bos_yer: durum.bos_yer,
      kapasite: durum.kapasite,
      rezervasyon_durum: durum.rezervasyon_durum,
      rezervasyon_id: durum.rezervasyon_id,
      dugme: kurallar.rezervasyonDugmesi(durum),
    },
  };
}

async function haftalik(oturum, sorgu) {
  const yemekhaneId = kurallar.pozitifTamsayi(sorgu.yemekhane_id, 'yemekhane');
  const baslangic = sorgu.baslangic || zaman.bugun();
  if (!kurallar.tarihGecerli(baslangic)) throw new IsHatasi('Geçersiz tarih.');
  const bitis = kurallar.tarihEkle(baslangic, 6);

  const satirlar = await menuVeri.haftalik(db.okuyucu(oturum), yemekhaneId, baslangic, bitis, oturum.kullaniciId);
  const gunler = [];
  for (let i = 0; i < 7; i++) gunler.push({ tarih: kurallar.tarihEkle(baslangic, i), menuler: [] });
  for (const s of satirlar) {
    const gun = gunler.find((g) => g.tarih === s.tarih);
    gun.menuler.push({
      menu_id: s.menu_id,
      ogun_id: s.ogun_id,
      ogun: s.ogun,
      yemekler: s.yemekler,
      toplam_kalori: Number(s.toplam_kalori),
      kapasite: s.kapasite,
      bos_yer: s.bos_yer,
      rezervasyon_son: s.rezervasyon_son,
      fiyat: kurallar.fiyatSec(oturum.rol, s),
      yarim_fiyat: kurallar.yarimFiyatSec(oturum.rol, s),
      uyarili_yemekler: s.uyarili_yemekler ? s.uyarili_yemekler.split(', ') : [],
      rezervasyon_porsiyon: s.rezervasyon_porsiyon,
      rezervasyon_id: s.rezervasyon_id,
      rezervasyon_durum: s.rezervasyon_durum,
      dugme: kurallar.rezervasyonDugmesi(s),
    });
  }
  return { yemekhane_id: yemekhaneId, baslangic, bitis, gunler };
}

module.exports = { referans, gunluk, haftalik, menuIcerigi };
