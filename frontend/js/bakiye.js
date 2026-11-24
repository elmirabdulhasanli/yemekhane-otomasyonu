import { api, sayfaBaslat, tl, tarihSaat, kisaTarih, esc, bildir, bildirimGizle, ustBakiyeGuncelle } from './ortak.js';

const $ = (id) => document.getElementById(id);
const kutu = $('bildirim');
const form = $('yukle-formu');

const TUR = { yukleme: 'Yükleme', rezervasyon: 'Rezervasyon', iade: 'İade' };

async function yukle() {
  const veri = await api('/bakiye');
  $('bakiye').textContent = tl(veri.bakiye);
  $('bakiye-kaynak').textContent = veri.kaynak === 'kaynak'
    ? 'Az önce işlem yaptığınız için bakiye kaynak sunucudan okundu.'
    : 'Bakiye her zaman hareketlerin toplamına eşittir.';
  $('hareketler').innerHTML = veri.hareketler.length ? veri.hareketler.map((h) => `
    <tr>
      <td data-etiket="Tarih">${tarihSaat(h.olusturma)}</td>
      <td data-etiket="İşlem">${TUR[h.tur]}</td>
      <td data-etiket="Açıklama">${esc(h.aciklama || '')}${h.menu_tarih ? ` <span class="soluk">(${kisaTarih(h.menu_tarih)} ${esc(h.ogun)})</span>` : ''}</td>
      <td class="sayi ${h.tutar > 0 ? 'arti' : 'eksi'}" data-etiket="Tutar">${h.tutar > 0 ? '+' : ''}${tl(h.tutar)}</td>
    </tr>`).join('') : '<tr><td colspan="4" class="bos">Henüz hareket yok.</td></tr>';
}

form.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tutar]');
  if (b) { form.tutar.value = b.dataset.tutar; form.tutar.focus(); }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  bildirimGizle(kutu);
  const dugme = form.querySelector('[type=submit]');
  dugme.disabled = true;
  try {
    const sonuc = await api('/bakiye/yukle', { method: 'POST', govde: { tutar: form.tutar.value } });
    ustBakiyeGuncelle(sonuc.bakiye);
    form.reset();
    await yukle();
    bildir(kutu, `Yükleme tamamlandı. Yeni bakiye: ${tl(sonuc.bakiye)}`, 'basari');
  } catch (hata) {
    bildir(kutu, hata.message);
  } finally {
    dugme.disabled = false;
  }
});

(async () => {
  try {
    await sayfaBaslat();
    await yukle();
  } catch (hata) {
    if (hata.durum !== 401) bildir(kutu, hata.message);
  }
})();
