// Ara katman · tüm hataları JSON'a çevirir.
// İş kuralı hataları (yordamın Türkçe mesajı dahil) olduğu gibi; diğerleri genel mesajla.
const { IsHatasi } = require('../hatalar');
const gunluk = require('../gunluk');

// eslint-disable-next-line no-unused-vars
function hataYakalayici(hata, req, res, next) {
  if (hata instanceof IsHatasi) {
    return res.status(hata.durum).json({ hata: hata.message });
  }
  if (hata.type === 'entity.parse.failed') {
    return res.status(400).json({ hata: 'İstek gövdesi geçerli JSON değil.' });
  }
  gunluk.hata('http', `${req.method} ${req.originalUrl} beklenmeyen hata`, {
    errno: hata.errno, kod: hata.code, mesaj: hata.sqlMessage || hata.message,
  });
  res.status(500).json({ hata: 'İşlem şu anda tamamlanamadı. Lütfen daha sonra tekrar deneyin.' });
}

function bulunamadi(req, res) {
  res.status(404).json({ hata: 'İstenen adres bulunamadı.' });
}

module.exports = { hataYakalayici, bulunamadi };
