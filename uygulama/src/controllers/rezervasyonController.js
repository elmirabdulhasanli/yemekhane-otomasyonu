// Controller · rezervasyonlar
const rezervasyonServis = require('../servisler/rezervasyonServis');

async function listele(req, res) { res.json({ rezervasyonlar: await rezervasyonServis.listele(req.oturum) }); }
async function yap(req, res) { res.status(201).json(await rezervasyonServis.yap(req.oturum, req.body)); }
async function iptal(req, res) { res.json(await rezervasyonServis.iptal(req.oturum, req.params.id)); }

module.exports = { listele, yap, iptal };
