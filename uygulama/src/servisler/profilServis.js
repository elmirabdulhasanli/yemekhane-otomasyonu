// İş katmanı · profil: kullanıcının alerjenleri
const db = require('../db/havuzlar');
const profilVeri = require('../veri/profilVeri');
const oturumServis = require('./oturumServis');
const kurallar = require('../kurallar');
const { IsHatasi } = require('../hatalar');
const gunluk = require('../gunluk');

async function alerjenler(oturum) {
  const okuyucu = db.okuyucu(oturum);
  const [tumu, secili] = await Promise.all([
    profilVeri.tumAlerjenler(okuyucu),
    profilVeri.kullaniciAlerjenleri(okuyucu, oturum.kullaniciId),
  ]);
  const seciliIdler = new Set(secili.map((a) => a.id));
  return { alerjenler: tumu.map((a) => ({ ...a, secili: seciliIdler.has(a.id) })) };
}

async function alerjenleriKaydet(oturum, govde) {
  if (!Array.isArray(govde.alerjen_idler)) throw new IsHatasi('alerjen_idler bir liste olmalıdır.');
  const idler = [...new Set(govde.alerjen_idler.map((id) => kurallar.pozitifTamsayi(id, 'alerjen')))];
  if (!(await profilVeri.alerjenlerVarMi(idler))) throw new IsHatasi('Seçilen alerjenlerden biri bulunamadı.');
  await profilVeri.alerjenleriKaydet(oturum.kullaniciId, idler);
  await oturumServis.yazmaYapildi(oturum); // menü sayfası hemen yeni seçime göre uyarsın
  gunluk.bilgi('profil', 'alerjenler güncellendi', { kullanici: oturum.kullaniciId, alerjenler: idler });
  return alerjenler(oturum);
}

module.exports = { alerjenler, alerjenleriKaydet };
