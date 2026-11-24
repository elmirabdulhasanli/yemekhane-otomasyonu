// Rotalar · tüm yollar /api/ ile başlar (Apache WEBAPI modu yalnızca /api/ isteklerini iletir).
const { Router } = require('express');
const { oturumGerekli, rolGerekli } = require('../ara/oturum');
const oturum = require('../controllers/oturumController');
const menu = require('../controllers/menuController');
const rezervasyon = require('../controllers/rezervasyonController');
const bakiye = require('../controllers/bakiyeController');
const degerlendirme = require('../controllers/degerlendirmeController');
const yonetim = require('../controllers/yonetimController');

const r = Router();

r.get('/', (req, res) => res.json({ uygulama: 'yemekhane', durum: 'calisiyor' }));
r.get('/saglik', (req, res) => res.json({ durum: 'ok' }));

r.post('/oturum/giris', oturum.giris);
r.post('/oturum/cikis', oturumGerekli, oturum.cikis);
r.get('/ben', oturumGerekli, oturum.ben);

r.get('/referans', oturumGerekli, menu.referans);
r.get('/menuler/gunluk', oturumGerekli, menu.gunluk);
r.get('/menuler/haftalik', oturumGerekli, menu.haftalik);

r.get('/rezervasyonlar', oturumGerekli, rezervasyon.listele);
r.post('/rezervasyonlar', oturumGerekli, rezervasyon.yap);
r.post('/rezervasyonlar/:id/iptal', oturumGerekli, rezervasyon.iptal);

r.get('/bakiye', oturumGerekli, bakiye.ozet);
r.post('/bakiye/yukle', oturumGerekli, bakiye.yukle);

r.get('/degerlendirmeler', oturumGerekli, degerlendirme.liste);
r.post('/degerlendirmeler', oturumGerekli, degerlendirme.kaydet);

const yonetici = [oturumGerekli, rolGerekli('yonetici')];
r.get('/yonetim/yemekler', ...yonetici, yonetim.yemekler);
r.get('/yonetim/menuler', ...yonetici, yonetim.rapor);
r.get('/yonetim/menuler/:id', ...yonetici, yonetim.menuGetir);
r.post('/yonetim/menuler', ...yonetici, yonetim.olustur);
r.put('/yonetim/menuler/:id', ...yonetici, yonetim.guncelle);

module.exports = r;
