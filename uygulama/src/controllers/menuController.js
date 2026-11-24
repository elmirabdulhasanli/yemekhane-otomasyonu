// Controller · menüler
const menuServis = require('../servisler/menuServis');

async function referans(req, res) { res.json(await menuServis.referans()); }
async function gunluk(req, res) { res.json(await menuServis.gunluk(req.oturum, req.query)); }
async function haftalik(req, res) { res.json(await menuServis.haftalik(req.oturum, req.query)); }

module.exports = { referans, gunluk, haftalik };
