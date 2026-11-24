// Express uygulaması (sunucuyu başlatmaz; testler de bunu kullanabilir).
const express = require('express');
const rotalar = require('./rotalar');
const { hataYakalayici, bulunamadi } = require('./ara/hataYakalayici');
const gunluk = require('./gunluk');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback, uniquelocal'); // Apache önümüzde
app.use(express.json({ limit: '50kb' }));

app.use((req, res, next) => {
  const bas = Date.now();
  res.on('finish', () => {
    if (req.path !== '/api/saglik') {
      gunluk.bilgi('http', `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - bas}ms`);
    }
  });
  next();
});

app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api', rotalar);
app.use(bulunamadi);
app.use(hataYakalayici);

module.exports = app;
