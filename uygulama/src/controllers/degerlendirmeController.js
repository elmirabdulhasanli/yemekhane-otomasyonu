// Controller · değerlendirmeler
const degerlendirmeServis = require('../servisler/degerlendirmeServis');

async function liste(req, res) { res.json({ menuler: await degerlendirmeServis.liste(req.oturum) }); }
async function kaydet(req, res) { res.status(201).json(await degerlendirmeServis.kaydet(req.oturum, req.body)); }

module.exports = { liste, kaydet };
