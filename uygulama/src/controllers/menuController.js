// Controller · menüler
const menuServis = require('../servisler/menuServis');

async function referans(req, res) { res.json(await menuServis.referans()); }
async function gunluk(req, res) {
  const sonuc = await menuServis.gunluk(req.oturum, req.query);
  res.set('X-Menu-Kaynak', sonuc.kaynak); // redis | veritabani (rapor ve testler için)
  res.json(sonuc);
}
async function haftalik(req, res) { res.json(await menuServis.haftalik(req.oturum, req.query)); }

module.exports = { referans, gunluk, haftalik };
