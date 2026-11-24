// Uygulama genelinde kullanılan hata türleri.

// Kullanıcıya olduğu gibi gösterilebilen iş kuralı hatası (ör. "Bakiye yetersiz.").
class IsHatasi extends Error {
  constructor(mesaj, durum = 400) {
    super(mesaj);
    this.name = 'IsHatasi';
    this.durum = durum;
  }
}

class YetkiHatasi extends IsHatasi {
  constructor(mesaj = 'Bu işlem için oturum açmalısınız.', durum = 401) {
    super(mesaj, durum);
    this.name = 'YetkiHatasi';
  }
}

// MySQL hatasını uygulama hatasına çevirir.
//  1644 (SQLSTATE 45000): stored procedure'ün Türkçe mesajı → değiştirmeden kullanıcıya
//  3819 (CHECK ihlali)  : programlama hatası → ham mesaj kullanıcıya gösterilmez
function mysqlHatasiniCevir(hata) {
  if (hata && hata.errno === 1644) return new IsHatasi(hata.sqlMessage, 400);
  if (hata && hata.errno === 1062) return new IsHatasi('Bu kayıt zaten var.', 409);
  return hata; // 3819 dahil diğer her şey: 500, genel mesaj (ara/hataYakalayici.js)
}

module.exports = { IsHatasi, YetkiHatasi, mysqlHatasiniCevir };
