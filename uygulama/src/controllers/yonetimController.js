// Controller · yönetici paneli
const yonetimServis = require('../servisler/yonetimServis');

async function yemekler(req, res) { res.json({ yemekler: await yonetimServis.yemekler() }); }
async function rapor(req, res) { res.json(await yonetimServis.rapor(req.oturum, req.query)); }
async function menuGetir(req, res) { res.json({ menu: await yonetimServis.menuGetir(req.params.id) }); }
async function olustur(req, res) { res.status(201).json(await yonetimServis.olustur(req.oturum, req.body)); }
async function guncelle(req, res) { res.json(await yonetimServis.guncelle(req.oturum, req.params.id, req.body)); }

module.exports = { yemekler, rapor, menuGetir, olustur, guncelle };
