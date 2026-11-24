// Ara katman · çerezdeki oturum belirtecini doğrular, req.oturum'u doldurur.
const config = require('../config');
const depo = require('../oturum/depo');
const { YetkiHatasi } = require('../hatalar');

function cerezleriAyristir(baslik) {
  const sonuc = {};
  for (const parca of (baslik || '').split(';')) {
    const i = parca.indexOf('=');
    if (i > 0) sonuc[parca.slice(0, i).trim()] = decodeURIComponent(parca.slice(i + 1).trim());
  }
  return sonuc;
}

function cerezYaz(res, token) {
  res.cookie(config.oturum.cerezAdi, token, {
    httpOnly: true, sameSite: 'strict', path: '/', maxAge: config.oturum.sureSn * 1000,
  });
}

function cerezSil(res) {
  res.clearCookie(config.oturum.cerezAdi, { httpOnly: true, sameSite: 'strict', path: '/' });
}

async function oturumGerekli(req, res, next) {
  const token = cerezleriAyristir(req.headers.cookie)[config.oturum.cerezAdi];
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return next(new YetkiHatasi());
  const oturum = await depo.getir(token); // süreyi de 30 dk'ya yeniler
  if (!oturum) { cerezSil(res); return next(new YetkiHatasi('Oturumunuzun süresi doldu, yeniden giriş yapın.')); }
  req.oturum = oturum;
  cerezYaz(res, token); // tarayıcı tarafında da süre yenilenir
  next();
}

function rolGerekli(...roller) {
  return (req, res, next) => {
    if (!roller.includes(req.oturum.rol)) return next(new YetkiHatasi('Bu sayfa için yetkiniz yok.', 403));
    next();
  };
}

module.exports = { oturumGerekli, rolGerekli, cerezYaz, cerezSil };
