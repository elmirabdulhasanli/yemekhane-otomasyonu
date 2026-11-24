import { api, sayfaBaslat, tl, tarihYaz, tarihSaat, saatYaz, esc, bildir, bildirimGizle, ustBakiyeGuncelle } from './ortak.js';

const $ = (id) => document.getElementById(id);
const kutu = $('bildirim');
const icerik = $('icerik');
let tumu = [];
let filtre = '';

const DURUM = {
  aktif: '<span class="rozet rozet-aktif">Aktif</span>',
  kullanildi: '<span class="rozet rozet-kullanildi">Kullanıldı</span>',
  iptal: '<span class="rozet rozet-iptal">İptal</span>',
};

function ogeCiz(r) {
  let alt = '';
  if (r.durum === 'aktif') alt = r.iptal_edilebilir ? `İptal için son: ${saatYaz(r.rezervasyon_son)}` : 'İptal süresi doldu';
  if (r.durum === 'kullanildi') alt = `Kullanıldı: ${tarihSaat(r.kullanma_zamani)}`;
  if (r.durum === 'iptal') alt = `İptal edildi: ${tarihSaat(r.iptal_zamani)}`;
  const eylem = r.iptal_edilebilir
    ? `<button class="dugme dugme-tehlike dugme-kucuk" data-iptal="${r.id}">İptal et</button>` : '';
  return `<li class="kart liste-oge">
    <div>
      <h3>${tarihYaz(r.tarih)} · ${esc(r.ogun)}</h3>
      <p class="soluk kucuk">${esc(r.yemekhane)} · ${tl(r.ucret)}${r.porsiyon === 'yarim' ? ' · Yarım porsiyon' : ''}</p>
      <p class="kucuk">${DURUM[r.durum]} <span class="soluk">${alt}</span></p>
    </div>
    ${eylem}
  </li>`;
}

function ciz() {
  const liste = filtre ? tumu.filter((r) => r.durum === filtre) : tumu;
  icerik.innerHTML = liste.length ? liste.map(ogeCiz).join('') : '<li class="kart bos">Kayıt yok.</li>';
}

async function yukle() {
  const { rezervasyonlar } = await api('/rezervasyonlar');
  tumu = rezervasyonlar;
  ciz();
}

$('sekmeler').addEventListener('click', (e) => {
  const b = e.target.closest('[data-durum]');
  if (!b) return;
  filtre = b.dataset.durum;
  document.querySelectorAll('#sekmeler [role=tab]').forEach((t) => t.setAttribute('aria-selected', String(t === b)));
  ciz();
});

icerik.addEventListener('click', async (e) => {
  const d = e.target.closest('[data-iptal]');
  if (!d || !confirm('Bu rezervasyonu iptal etmek istiyor musunuz? Ücret bakiyenize iade edilir.')) return;
  d.disabled = true;
  try {
    const sonuc = await api(`/rezervasyonlar/${d.dataset.iptal}/iptal`, { method: 'POST' });
    ustBakiyeGuncelle(sonuc.bakiye);
    await yukle();
    bildir(kutu, `Rezervasyon iptal edildi. İade: ${tl(sonuc.iade)} · Bakiye: ${tl(sonuc.bakiye)}`, 'basari');
  } catch (hata) {
    d.disabled = false;
    bildir(kutu, hata.message);
  }
});

(async () => {
  try {
    await sayfaBaslat();
    bildirimGizle(kutu);
    await yukle();
  } catch (hata) {
    if (hata.durum !== 401) bildir(kutu, hata.message);
  }
})();
