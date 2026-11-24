// İş katmanı · giriş / çıkış
const bcrypt = require('bcryptjs');
const db = require('../db/havuzlar');
const kullaniciVeri = require('../veri/kullaniciVeri');
const depo = require('../oturum/depo');
const { IsHatasi } = require('../hatalar');
const gunluk = require('../gunluk');

// Kullanıcı bulunamasa da aynı süre harcansın diye karşılaştırılan sahte hash (zamanlama farkı olmasın)
const SAHTE_HASH = bcrypt.hashSync('yok-boyle-bir-sifre', 10);

async function giris(eposta, sifre) {
  const temizEposta = String(eposta || '').trim().toLowerCase();
  if (!temizEposta || !sifre) throw new IsHatasi('E-posta ve şifre gereklidir.');
  // Giriş, yeni açılmış/pasifleştirilmiş hesabı hemen görsün diye kaynaktan okunur.
  const k = await kullaniciVeri.epostaIleBul(db.yazma, temizEposta);
  const dogru = await bcrypt.compare(String(sifre), k ? k.sifre_hash : SAHTE_HASH);
  if (!k || !dogru) {
    gunluk.uyari('oturum', 'hatalı giriş denemesi', { eposta: temizEposta });
    throw new IsHatasi('E-posta ya da şifre hatalı.', 401);
  }
  if (k.aktif === 0) throw new IsHatasi('Hesabınız pasif durumda.', 403);
  const veri = { kullaniciId: k.id, ad: k.ad, soyad: k.soyad, rol: k.rol, eposta: k.eposta };
  const token = await depo.olustur(veri);
  gunluk.bilgi('oturum', 'giriş', { kullanici: k.id, rol: k.rol });
  return { token, kullanici: kullaniciOzeti(k) };
}

async function cikis(oturum) {
  await depo.sil(oturum.token);
  gunluk.bilgi('oturum', 'çıkış', { kullanici: oturum.kullaniciId });
}

// Üst çubuktaki bilgi: ad, rol, bakiye (yeni yazma yaptıysa kaynaktan).
async function ben(oturum) {
  const k = await kullaniciVeri.idIleBul(db.okuyucu(oturum), oturum.kullaniciId);
  if (!k) throw new IsHatasi('Kullanıcı bulunamadı.', 404);
  return kullaniciOzeti(k);
}

// Yazma işleminden sonra çağrılır: kısa süre bu kullanıcının okumaları kaynağa gider.
async function yazmaYapildi(oturum) {
  oturum.sonYazma = Date.now();
  await depo.guncelle(oturum.token, { sonYazma: oturum.sonYazma });
}

function kullaniciOzeti(k) {
  return { id: k.id, ad: k.ad, soyad: k.soyad, eposta: k.eposta, rol: k.rol, ogrenci_no: k.ogrenci_no, bakiye: k.bakiye };
}

module.exports = { giris, cikis, ben, yazmaYapildi };
