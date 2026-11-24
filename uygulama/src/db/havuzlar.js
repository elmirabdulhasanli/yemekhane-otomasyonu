// Veritabanı bağlantı havuzları: yazma → kaynak (mysql-primary), okuma → replika (mysql-replica).
const mysql = require('mysql2/promise');
const config = require('../config');
const gunluk = require('../gunluk');
const { mysqlHatasiniCevir } = require('../hatalar');

function havuzOlustur(host, ad) {
  const havuz = mysql.createPool({
    host,
    port: config.db.port,
    user: config.db.kullanici,
    password: config.db.sifre,
    database: config.db.ad,
    charset: 'utf8mb4',
    timezone: '+03:00',
    dateStrings: true,      // DATE/DATETIME metin olarak gelir, saat dilimi kayması olmaz
    decimalNumbers: true,   // DECIMAL → number (yalnızca gösterim; para hesabı yordamlarda)
    connectionLimit: 10,
    waitForConnections: true,
  });
  havuz.ad = ad;
  return havuz;
}

const yazma = havuzOlustur(config.db.yazmaHost, 'kaynak');
const okumaHam = havuzOlustur(config.db.okumaHost, 'replika');

// Replikaya ulaşılamazsa okuma kaynağa düşer (replika bakımda/çökmüşken site çalışmaya devam eder).
const BAGLANTI_HATALARI = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH',
  'PROTOCOL_CONNECTION_LOST', 'ECONNRESET']);

const okuma = {
  ad: 'replika',
  async query(sql, params) {
    try {
      return await okumaHam.query(sql, params);
    } catch (hata) {
      if (BAGLANTI_HATALARI.has(hata.code)) {
        gunluk.uyari('db', 'replikaya ulaşılamadı, okuma kaynaktan yapılıyor', { kod: hata.code });
        return yazma.query(sql, params);
      }
      throw hata;
    }
  },
};

// Okuma için hangi sunucu? Kullanıcı az önce yazma yaptıysa kaynak (bkz. config.kendiYazdiginiOkuMs).
function okuyucu(oturum) {
  if (oturum && oturum.sonYazma && Date.now() - oturum.sonYazma < config.kendiYazdiginiOkuMs) {
    return yazma;
  }
  return okuma;
}

// Stored procedure çağrısı: her zaman kaynakta, autocommit açıkken (yordam kendi transaction'ını yönetir).
// Başarıda yordamın döndürdüğü tek satırı verir; 45000 hatalarını IsHatasi'na çevirir.
async function yordamCagir(ad, parametreler) {
  const yer = parametreler.map(() => '?').join(', ');
  try {
    const [sonuclar] = await yazma.query(`CALL ${ad}(${yer})`, parametreler);
    return sonuclar[0][0];
  } catch (hata) {
    throw mysqlHatasiniCevir(hata);
  }
}

// Kaynakta yapılan son yazmanın replikaya geçmesini bekler (GTID). Önbellek silinmeden önce
// çağrılır; yoksa silinen kaydı bir sonraki okuma replikadaki ESKİ veriyle yeniden doldurabilir.
// Dönüş: true → replika yakaladı, false → süre doldu (yine de devam edilir).
async function replikaYakalasin(sureSn = 2) {
  try {
    const [[{ gtid }]] = await yazma.query('SELECT @@GLOBAL.gtid_executed AS gtid');
    const [[{ sonuc }]] = await okumaHam.query('SELECT WAIT_FOR_EXECUTED_GTID_SET(?, ?) AS sonuc', [gtid, sureSn]);
    return Number(sonuc) === 0;
  } catch (hata) {
    gunluk.uyari('db', 'replika bekleme yapılamadı', { mesaj: hata.message });
    return false;
  }
}

async function kapat() {
  await Promise.allSettled([yazma.end(), okumaHam.end()]);
}

module.exports = { yazma, okuma, okuyucu, yordamCagir, replikaYakalasin, kapat };
