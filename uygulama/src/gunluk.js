// Basit, tek satırlık uygulama günlüğü: "docker compose logs uygulama" ile okunur.
function yaz(seviye, alan, mesaj, ek) {
  const zaman = new Date().toISOString();
  const ekStr = ek ? ' ' + JSON.stringify(ek) : '';
  const satir = `${zaman} ${seviye.padEnd(5)} [${alan}] ${mesaj}${ekStr}`;
  (seviye === 'HATA' ? console.error : console.log)(satir);
}
module.exports = {
  bilgi: (alan, mesaj, ek) => yaz('BILGI', alan, mesaj, ek),
  uyari: (alan, mesaj, ek) => yaz('UYARI', alan, mesaj, ek),
  hata: (alan, mesaj, ek) => yaz('HATA', alan, mesaj, ek),
};
