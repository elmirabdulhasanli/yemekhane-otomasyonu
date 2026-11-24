// Giriş noktası: HTTP sunucusunu başlatır, kapanışta bağlantıları düzgün kapatır.
const app = require('./app');
const config = require('./config');
const db = require('./db/havuzlar');
const gunluk = require('./gunluk');
const redis = require('./onbellek/redis');

redis.baglan().catch((hata) => gunluk.hata('redis', 'ilk bağlantı kurulamadı, yeniden denenecek', { mesaj: hata.message }));

const sunucu = app.listen(config.port, () => {
  gunluk.bilgi('baslat', `uygulama ${config.port} portunda`, {
    yazma: config.db.yazmaHost, okuma: config.db.okumaHost,
  });
});

async function kapat(sinyal) {
  gunluk.bilgi('baslat', `${sinyal} alındı, kapanıyor`);
  sunucu.close(async () => { await Promise.allSettled([db.kapat(), redis.kapat()]); process.exit(0); });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => kapat('SIGTERM'));
process.on('SIGINT', () => kapat('SIGINT'));
