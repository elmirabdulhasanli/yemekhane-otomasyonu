import { api, sayfaBaslat, tl, tarihYaz, kisaTarih, saatYaz, esc, bildir, bildirimGizle,
  seciliDoldur, adresParam, adresGuncelle, ustBakiyeGuncelle } from './ortak.js';

const $ = (id) => document.getElementById(id);
const kutu = $('bildirim');
const icerik = $('icerik');
let bugun, baslangic;

function tarihKaydir(t, gun) {
  const d = new Date(t + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + gun);
  return d.toISOString().slice(0, 10);
}

const DURUM_ROZET = {
  aktif: '<span class="rozet rozet-aktif">✓ Rezervasyonunuz var</span>',
  kullanildi: '<span class="rozet rozet-kullanildi">Kullanıldı</span>',
  iptal: '<span class="rozet rozet-iptal">İptal ettiniz</span>',
};

function ogunCiz(m) {
  const eylem = m.dugme.aktif
    ? `${porsiyonSecimi(m)}<button class="dugme dugme-kucuk" data-rezerve="${m.menu_id}">Rezervasyon yap</button>`
    : `<button class="dugme dugme-kucuk" disabled aria-disabled="true">${esc(m.dugme.neden)}</button>`;
  return `<div class="ogun-satir">
    <div class="ogun-ust"><h3>${esc(m.ogun)}</h3><span class="fiyat" style="font-size:1.1rem">${tl(m.fiyat)}</span></div>
    <p class="ogun-yemekler">${esc(m.yemekler)}</p>
    <div class="ogun-bilgi">
      <span class="rozet">${m.bos_yer} boş yer</span>
      <span class="rozet">${m.toplam_kalori} kcal</span>
      <span class="rozet">son ${saatYaz(m.rezervasyon_son)}</span>
      ${DURUM_ROZET[m.rezervasyon_durum] || ''}
    </div>
    <div class="ogun-eylem">${eylem}</div>
  </div>`;
}

// Aşama 4'te porsiyon seçimi eklenir
function porsiyonSecimi() { return ''; }

function gunCiz(g) {
  const menuler = g.menuler.length ? g.menuler.map(ogunCiz).join('') : '<p class="ogun-satir soluk">Menü girilmemiş.</p>';
  return `<article class="kart gun${g.tarih === bugun ? ' bugun' : ''}">
    <h2>${tarihYaz(g.tarih)}${g.tarih === bugun ? ' · Bugün' : ''}</h2>${menuler}</article>`;
}

async function yukle() {
  bildirimGizle(kutu);
  adresGuncelle({ yemekhane: $('yemekhane').value, baslangic });
  $('hafta-baslik').textContent = `${kisaTarih(baslangic)} – ${kisaTarih(tarihKaydir(baslangic, 6))}`;
  try {
    const q = new URLSearchParams({ yemekhane_id: $('yemekhane').value, baslangic });
    const veri = await api('/menuler/haftalik?' + q);
    icerik.innerHTML = veri.gunler.map(gunCiz).join('');
  } catch (hata) {
    icerik.innerHTML = '';
    bildir(kutu, hata.message);
  }
}

icerik.addEventListener('click', async (e) => {
  const d = e.target.closest('[data-rezerve]');
  if (!d) return;
  d.disabled = true;
  const govde = { menu_id: Number(d.dataset.rezerve) };
  const secim = d.parentElement.querySelector('select[name="porsiyon"]');
  if (secim) govde.porsiyon = secim.value;
  try {
    const sonuc = await api('/rezervasyonlar', { method: 'POST', govde });
    // Bakiye yordamın döndürdüğü değerdir (kaynak); replikadan okunsaydı eski görünebilirdi.
    ustBakiyeGuncelle(sonuc.bakiye);
    await yukle();
    bildir(kutu, `Rezervasyon yapıldı. Ücret: ${tl(sonuc.ucret)} · Kalan bakiye: ${tl(sonuc.bakiye)}`, 'basari');
  } catch (hata) {
    d.disabled = false;
    bildir(kutu, hata.message);
  }
});

(async () => {
  try {
    await sayfaBaslat();
    const ref = await api('/referans');
    bugun = ref.bugun;
    baslangic = adresParam('baslangic', bugun);
    seciliDoldur($('yemekhane'), ref.yemekhaneler, adresParam('yemekhane', 1));
    $('yemekhane').addEventListener('change', yukle);
    $('onceki').addEventListener('click', () => { baslangic = tarihKaydir(baslangic, -7); yukle(); });
    $('sonraki').addEventListener('click', () => { baslangic = tarihKaydir(baslangic, 7); yukle(); });
    await yukle();
  } catch (hata) {
    if (hata.durum !== 401) bildir(kutu, hata.message);
  }
})();
