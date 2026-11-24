import { api, sayfaBaslat, tl, tarihYaz, saatYaz, esc, bildir, bildirimGizle, seciliDoldur,
  adresParam, adresGuncelle, ustBakiyeGuncelle, porsiyonSecimi, seciliPorsiyon } from './ortak.js';

const $ = (id) => document.getElementById(id);
const kutu = $('bildirim');
const icerik = $('icerik');

function dolulukCubugu(m) {
  const oran = Math.round(100 * (m.kapasite - m.bos_yer) / m.kapasite);
  const sinif = oran >= 100 ? 'dolu' : oran >= 80 ? 'yuksek' : '';
  return `<div class="doluluk"><span class="kucuk"><strong>${m.bos_yer}</strong> boş yer / ${m.kapasite}</span>
    <div class="doluluk-cubuk" role="img" aria-label="Doluluk yüzde ${oran}"><span class="${sinif}" style="width:${Math.min(oran, 100)}%"></span></div></div>`;
}

function yemekSatiri(y) {
  const uyari = y.uyari || [];
  const rozetler = [
    uyari.length ? `<span class="rozet rozet-uyari">⚠ Alerjeniniz: ${esc(uyari.join(', '))}</span>` : '',
    y.vejetaryen ? '<span class="rozet rozet-veg" title="Vejetaryen">🌿 Vejetaryen</span>' : '',
    ...y.alerjenler.filter((a) => !uyari.includes(a)).map((a) => `<span class="rozet rozet-alerjen">${esc(a)}</span>`),
  ].join('');
  return `<div class="yemek${uyari.length ? ' uyarili' : ''}">
      <div><div class="yemek-ad">${esc(y.ad)}</div>${rozetler ? `<div class="yemek-rozetler">${rozetler}</div>` : ''}</div>
      <div class="yemek-kalori">${y.kalori} kcal</div>
    </div>`;
}

function menuCiz(m) {
  const kategoriler = m.kategoriler.map((k) => `
    <section class="kategori"><h3>${esc(k.ad)}</h3>${k.yemekler.map(yemekSatiri).join('')}</section>`).join('');
  return `<article class="kart menu-kart">
    <div class="menu-ust">
      <div>
        <h2>${esc(m.yemekhane)} · ${esc(m.ogun)}</h2>
        <div class="menu-ozet">
          <span class="rozet">🔥 Toplam ${m.toplam_kalori} kcal</span>
          ${m.vejetaryen ? '<span class="rozet rozet-veg">🌿 Tamamen vejetaryen</span>' : ''}
          <span class="rozet">⏰ Son rezervasyon ${saatYaz(m.rezervasyon_son)}</span>
        </div>
      </div>
      <div class="fiyat">${tl(m.fiyat)} <small>/ kişi${m.yarim_fiyat != null ? ` · yarım ${tl(m.yarim_fiyat)}` : ''}</small></div>
    </div>
    ${m.uyarili_yemek_sayisi ? `<p class="bildirim bildirim-hata uyari-bant" role="note">⚠ Bu menüde profilinizde seçtiğiniz alerjenleri
      (${esc(m.alerjenlerim.join(', '))}) içeren ${m.uyarili_yemek_sayisi} yemek var.</p>` : ''}
    ${kategoriler}
    <div class="menu-alt">
      ${dolulukCubugu(m)}
      <div class="ogun-eylem">${eylemCiz(m)}</div>
    </div>
  </article>`;
}

function eylemCiz(m) {
  if (m.dugme.aktif) return `${porsiyonSecimi(m)}<button class="dugme" data-rezerve="${m.menu_id}">Rezervasyon yap</button>`;
  if (m.rezervasyon_durum === 'aktif' && m.rezervasyon_porsiyon === 'yarim') {
    return '<button class="dugme" disabled>Rezervasyonunuz var (yarım)</button>';
  }
  return `<button class="dugme" disabled title="${esc(m.dugme.neden)}">${esc(m.dugme.neden)}</button>`;
}

async function yukle() {
  bildirimGizle(kutu);
  const yemekhane_id = $('yemekhane').value, ogun_id = $('ogun').value, tarih = $('tarih').value;
  adresGuncelle({ yemekhane: yemekhane_id, ogun: ogun_id, tarih });
  $('tarih-baslik').textContent = tarihYaz(tarih);
  icerik.innerHTML = '<p class="yukleniyor">Yükleniyor…</p>';
  try {
    const q = new URLSearchParams({ yemekhane_id, ogun_id, tarih });
    const { menu } = await api('/menuler/gunluk?' + q);
    icerik.innerHTML = menu ? menuCiz(menu) : '<div class="kart bos">Bu yemekhane ve öğün için o güne menü girilmemiş.</div>';
  } catch (hata) {
    icerik.innerHTML = '';
    bildir(kutu, hata.message);
  }
}

icerik.addEventListener('click', async (e) => {
  const d = e.target.closest('[data-rezerve]');
  if (!d) return;
  d.disabled = true;
  try {
    const govde = { menu_id: Number(d.dataset.rezerve), porsiyon: seciliPorsiyon(d.parentElement) };
    const sonuc = await api('/rezervasyonlar', { method: 'POST', govde });
    ustBakiyeGuncelle(sonuc.bakiye);
    await yukle();
    bildir(kutu, `Rezervasyon yapıldı (${sonuc.porsiyon === 'yarim' ? 'yarım' : 'tam'} porsiyon). Ücret: ${tl(sonuc.ucret)} · Kalan bakiye: ${tl(sonuc.bakiye)}`, 'basari');
  } catch (hata) {
    d.disabled = false;
    bildir(kutu, hata.message);
  }
});

(async () => {
  try {
    await sayfaBaslat();
    const ref = await api('/referans');
    seciliDoldur($('yemekhane'), ref.yemekhaneler, adresParam('yemekhane', 1));
    // Varsayılan öğün: rezervasyonu henüz kapanmamış ilk öğün, yoksa akşam
    const simdi = new Date().toTimeString().slice(0, 5);
    const sonraki = ref.ogunler.find((o) => o.son_saat > simdi) || ref.ogunler[ref.ogunler.length - 1];
    seciliDoldur($('ogun'), ref.ogunler, adresParam('ogun', sonraki.id));
    $('tarih').value = adresParam('tarih', ref.bugun);
    $('filtre').addEventListener('change', yukle);
    await yukle();
  } catch (hata) {
    if (hata.durum !== 401) bildir(kutu, hata.message);
  }
})();
