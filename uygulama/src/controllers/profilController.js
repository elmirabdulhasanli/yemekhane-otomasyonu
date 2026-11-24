// Controller · profil
const profilServis = require('../servisler/profilServis');

async function alerjenler(req, res) { res.json(await profilServis.alerjenler(req.oturum)); }
async function alerjenleriKaydet(req, res) { res.json(await profilServis.alerjenleriKaydet(req.oturum, req.body)); }

module.exports = { alerjenler, alerjenleriKaydet };
