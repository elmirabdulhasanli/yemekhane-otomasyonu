// Redis istemcisi (tek bağlantı). Bağlantı koparsa kendiliğinden yeniden bağlanır.
const { createClient } = require('redis');
const config = require('../config');
const gunluk = require('../gunluk');

const istemci = createClient({
  socket: {
    host: config.redis.host,
    port: config.redis.port,
    reconnectStrategy: (deneme) => Math.min(deneme * 200, 3000),
  },
});

let sonHata = 0;
istemci.on('error', (hata) => {
  if (Date.now() - sonHata > 10000) { gunluk.hata('redis', 'bağlantı hatası', { mesaj: hata.message }); sonHata = Date.now(); }
});
istemci.on('ready', () => gunluk.bilgi('redis', `bağlandı ${config.redis.host}:${config.redis.port}`));

const baglan = () => istemci.connect();
const hazir = () => istemci.isReady;
const kapat = () => (istemci.isOpen ? istemci.quit() : undefined);

module.exports = { istemci, baglan, hazir, kapat };
