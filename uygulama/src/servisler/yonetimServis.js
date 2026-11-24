// İş katmanı · yönetici paneli
const db = require('../db/havuzlar');
const yonetimVeri = require('../veri/yonetimVeri');
const oturumServis = require('./oturumServis');
const kurallar = require('../kurallar');
const zaman = require('../zaman');
const { IsHatasi } = require('../hatalar');
const gunluk = require('../gunluk');

function yemekler() {
  return yonetimVeri.yemekler(db.okuma);
}

async function rapor(oturum, sorgu) {
  const baslangic = sorgu.baslangic || kurallar.tarihEkle(zaman.bugun(), -7);
  const bitis = sorgu.bitis || kurallar.tarihEkle(zaman.bugun(), 7);
  if (!kurallar.tarihGecerli(baslangic) || !kurallar.tarihGecerli(bitis)) throw new IsHatasi('Geçersiz tarih.');
  if (bitis < baslangic) throw new IsHatasi('Bitiş tarihi başlangıçtan önce olamaz.');
  const yemekhaneId = sorgu.yemekhane_id ? kurallar.pozitifTamsayi(sorgu.yemekhane_id, 'yemekhane') : null;
  const menuler = await yonetimVeri.menuRaporu(db.okuyucu(oturum), baslangic, bitis, yemekhaneId);
  return { baslangic, bitis, menuler };
}

async function menuGetir(idHam) {
  const menu = await yonetimVeri.menuGetir(kurallar.pozitifTamsayi(idHam, 'menü'));
  if (!menu) throw new IsHatasi('Menü bulunamadı.', 404);
  return menu;
}

async function yemekleriDenetle(idler) {
  if (!(await yonetimVeri.yemeklerVarMi(idler))) throw new IsHatasi('Seçilen yemeklerden biri bulunamadı.');
}

async function olustur(oturum, govde) {
  const menu = kurallar.menuFormuDogrula(govde);
  await yemekleriDenetle(menu.yemek_idler);
  const id = await yonetimVeri.menuOlustur(menu);
  await oturumServis.yazmaYapildi(oturum);
  gunluk.bilgi('yonetim', 'menü oluşturuldu', { menu: id, yonetici: oturum.kullaniciId });
  return { id };
}

async function guncelle(oturum, idHam, govde) {
  const id = kurallar.pozitifTamsayi(idHam, 'menü');
  const eski = await yonetimVeri.menuGetir(id);
  if (!eski) throw new IsHatasi('Menü bulunamadı.', 404);
  const yeni = kurallar.menuFormuDogrula(govde);
  await yemekleriDenetle(yeni.yemek_idler);
  const tasiniyor = eski.yemekhane_id !== yeni.yemekhane_id || eski.tarih !== yeni.tarih || eski.ogun_id !== yeni.ogun_id;
  if (tasiniyor && (await yonetimVeri.rezervasyonSayisi(id)) > 0) {
    throw new IsHatasi('Rezervasyonu olan menünün yemekhanesi, tarihi ya da öğünü değiştirilemez; yalnızca yemekler ve fiyat değişebilir.', 409);
  }
  await yonetimVeri.menuGuncelle(id, yeni);
  await oturumServis.yazmaYapildi(oturum);
  gunluk.bilgi('yonetim', 'menü güncellendi', { menu: id, yonetici: oturum.kullaniciId });
  return { id, eski, yeni };
}

module.exports = { yemekler, rapor, menuGetir, olustur, guncelle };
