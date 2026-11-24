// Controller · giriş/çıkış. SQL yok, iş kuralı yok: isteği servise iletir, yanıtı yazar.
const oturumServis = require('../servisler/oturumServis');
const { cerezYaz, cerezSil } = require('../ara/oturum');

async function giris(req, res) {
  const { token, kullanici } = await oturumServis.giris(req.body.eposta, req.body.sifre);
  cerezYaz(res, token);
  res.json({ kullanici });
}

async function cikis(req, res) {
  await oturumServis.cikis(req.oturum);
  cerezSil(res);
  res.json({ tamam: true });
}

async function ben(req, res) {
  res.json({ kullanici: await oturumServis.ben(req.oturum) });
}

module.exports = { giris, cikis, ben };
