// Oturum deposu (Aşama 2: bellek içi). Arayüz: olustur, getir (süreyi yeniler), guncelle, sil.
// Not: bellek içi depo uygulama yeniden başlayınca boşalır; Aşama 3'te Redis'e taşınır.
const crypto = require('crypto');
const config = require('../config');

const oturumlar = new Map();
const sureMs = () => config.oturum.sureSn * 1000;

async function olustur(veri) {
  const token = crypto.randomBytes(32).toString('hex');
  oturumlar.set(token, { veri, bitis: Date.now() + sureMs() });
  return token;
}

async function getir(token) {
  const kayit = oturumlar.get(token);
  if (!kayit) return null;
  if (kayit.bitis < Date.now()) { oturumlar.delete(token); return null; }
  kayit.bitis = Date.now() + sureMs(); // her istekte 30 dk yenilenir
  return { ...kayit.veri, token };
}

async function guncelle(token, veri) {
  const kayit = oturumlar.get(token);
  if (kayit) kayit.veri = { ...kayit.veri, ...veri };
}

async function sil(token) {
  oturumlar.delete(token);
}

module.exports = { olustur, getir, guncelle, sil };
