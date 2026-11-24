import { api, sayfaBaslat, esc, bildir, bildirimGizle, ROL_ADI } from './ortak.js';

const $ = (id) => document.getElementById(id);
const kutu = $('bildirim');
const form = $('alerjen-formu');

function alerjenleriCiz(liste) {
  $('alerjenler').innerHTML = '<legend class="gizli">Alerjenler</legend>' + liste.map((a) => `
    <label class="secim secim-kutu"><input type="checkbox" name="alerjen" value="${a.id}"${a.secili ? ' checked' : ''}> ${esc(a.ad)}</label>`).join('');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  bildirimGizle(kutu);
  const alerjen_idler = [...form.querySelectorAll('[name=alerjen]:checked')].map((c) => Number(c.value));
  try {
    const { alerjenler } = await api('/profil/alerjenler', { method: 'PUT', govde: { alerjen_idler } });
    alerjenleriCiz(alerjenler);
    bildir(kutu, alerjen_idler.length
      ? `Kaydedildi. ${alerjen_idler.length} alerjen için menüde uyarı gösterilecek.`
      : 'Kaydedildi. Alerjen seçmediniz, menüde uyarı gösterilmeyecek.', 'basari');
  } catch (hata) {
    bildir(kutu, hata.message);
  }
});

(async () => {
  try {
    const k = await sayfaBaslat();
    $('bilgiler').innerHTML = `
      <dt>Ad Soyad</dt><dd>${esc(k.ad)} ${esc(k.soyad)}</dd>
      <dt>E-posta</dt><dd>${esc(k.eposta)}</dd>
      <dt>Rol</dt><dd>${ROL_ADI[k.rol]}</dd>
      ${k.ogrenci_no ? `<dt>Öğrenci no</dt><dd>${esc(k.ogrenci_no)}</dd>` : ''}`;
    alerjenleriCiz((await api('/profil/alerjenler')).alerjenler);
  } catch (hata) {
    if (hata.durum !== 401) bildir(kutu, hata.message);
  }
})();
