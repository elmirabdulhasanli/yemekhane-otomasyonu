// Controller · bakiye
const bakiyeServis = require('../servisler/bakiyeServis');

async function ozet(req, res) { res.json(await bakiyeServis.ozet(req.oturum)); }
async function yukle(req, res) { res.status(201).json(await bakiyeServis.yukle(req.oturum, req.body)); }

module.exports = { ozet, yukle };
