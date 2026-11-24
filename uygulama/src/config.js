// Tüm ayarlar ortam değişkenlerinden okunur (docker-compose.yml → x-uygulama-ortam).
const ortam = process.env;

module.exports = {
  port: Number(ortam.PORT || 8000),
  db: {
    yazmaHost: ortam.DB_YAZMA_HOST || 'mysql-primary',
    okumaHost: ortam.DB_OKUMA_HOST || 'mysql-replica',
    port: Number(ortam.DB_PORT || 3306),
    ad: ortam.DB_ADI || 'yemekhane',
    kullanici: ortam.DB_KULLANICI || 'yemekhane_app',
    sifre: ortam.DB_SIFRE || '',
  },
  redis: {
    host: ortam.REDIS_HOST || 'redis',
    port: Number(ortam.REDIS_PORT || 6379),
  },
  oturum: {
    cerezAdi: 'oturum',
    sureSn: 30 * 60, // 30 dakika, her istekte yenilenir
  },
  // Bir kullanıcı yazma yaptıktan sonra bu süre boyunca onun okumaları kaynaktan yapılır
  // (replikasyon gecikmesi yüzünden kendi yazdığını göremeyebilir).
  kendiYazdiginiOkuMs: 5000,
};
