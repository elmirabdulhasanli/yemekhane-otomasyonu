// Ortak arayüz yardımcıları: API çağrısı, üst çubuk, biçimlendirme, bildirim.
// İş kuralı yoktur: fiyat, son saat, iptal edilebilirlik gibi kararlar API'den gelir.

export class ApiHatasi extends Error {
  constructor(mesaj, durum) { super(mesaj); this.durum = durum; }
}

export async function api(yol, { method = 'GET', govde } = {}) {
  let yanit;
  try {
    yanit = await fetch('/api' + yol, {
      method,
      headers: { Accept: 'application/json', ...(govde !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: govde !== undefined ? JSON.stringify(govde) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiHatasi('Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.', 0);
  }
  let veri = null;
  try { veri = await yanit.json(); } catch { /* JSON olmayan yanıt (ör. Apache 503 sayfası) */ }
  if (yanit.status === 401 && !yol.startsWith('/oturum/giris')) {
    const donus = encodeURIComponent(location.pathname + location.search);
    location.href = '/index.html?donus=' + donus;
    throw new ApiHatasi((veri && veri.hata) || 'Oturum gerekli.', 401);
  }
  if (!yanit.ok) {
    const mesaj = (veri && veri.hata) ||
      (yanit.status >= 502 ? 'Uygulama servisi şu anda yanıt vermiyor.' : 'Beklenmeyen bir hata oluştu.');
    throw new ApiHatasi(mesaj, yanit.status);
  }
  return veri;
}

// ---------- Biçimlendirme ----------
const paraBicimi = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });
export const tl = (n) => paraBicimi.format(Number(n || 0));

export function tarihYaz(t, secenek = { day: 'numeric', month: 'long', weekday: 'long' }) {
  if (!t) return '';
  const [y, a, g] = t.slice(0, 10).split('-').map(Number);
  return new Date(y, a - 1, g).toLocaleDateString('tr-TR', secenek);
}
export const kisaTarih = (t) => tarihYaz(t, { day: 'numeric', month: 'short', weekday: 'short' });
export const saatYaz = (t) => (t ? t.slice(11, 16) : '');
export const tarihSaat = (t) => (t ? `${kisaTarih(t)} ${saatYaz(t)}` : '');

export function esc(metin) {
  return String(metin ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const ROL_ADI = { ogrenci: 'Öğrenci', personel: 'Personel', yonetici: 'Yönetici' };

// ---------- Bildirim ----------
export function bildir(kutu, mesaj, tur = 'hata') {
  kutu.hidden = false;
  kutu.className = `bildirim bildirim-${tur}`;
  kutu.setAttribute('role', tur === 'hata' ? 'alert' : 'status');
  kutu.textContent = mesaj;
  kutu.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
export function bildirimGizle(kutu) { kutu.hidden = true; kutu.textContent = ''; }

// ---------- Üst çubuk ----------
const BAGLANTILAR = [
  { href: '/menu.html', ad: 'Günün Menüsü' },
  { href: '/haftalik.html', ad: 'Haftalık' },
  { href: '/rezervasyonlar.html', ad: 'Rezervasyonlarım' },
  { href: '/bakiye.html', ad: 'Bakiye' },
  { href: '/degerlendirme.html', ad: 'Değerlendir' },
  { href: '/profil.html', ad: 'Profil' },
  { href: '/yonetim.html', ad: 'Yönetim', rol: 'yonetici' },
];

let aktifKullanici = null;

export async function sayfaBaslat({ rol } = {}) {
  const { kullanici } = await api('/ben');
  aktifKullanici = kullanici;
  if (rol && kullanici.rol !== rol) {
    location.href = '/menu.html';
    throw new ApiHatasi('Yetki yok', 403);
  }
  ustCubukCiz(kullanici);
  return kullanici;
}

function ustCubukCiz(k) {
  const baslik = document.createElement('header');
  baslik.className = 'ust';
  const linkler = BAGLANTILAR.filter((b) => !b.rol || b.rol === k.rol)
    .map((b) => `<a href="${b.href}"${location.pathname === b.href ? ' aria-current="page"' : ''}>${b.ad}</a>`)
    .join('');
  baslik.innerHTML = `
    <div class="kapsayici ust-ic">
      <a class="marka" href="/menu.html" aria-label="Ana sayfa"><span class="marka-isaret" aria-hidden="true"></span>Yemekhane</a>
      <div class="kimlik">
        <span class="kimlik-ad">${esc(k.ad)} <small>${ROL_ADI[k.rol]}</small></span>
        <a class="bakiye-rozet" href="/bakiye.html" id="ust-bakiye" title="Güncel bakiye">${tl(k.bakiye)}</a>
        <button type="button" class="cikis" id="cikis">Çıkış</button>
      </div>
    </div>
    <nav class="kapsayici gezinti" aria-label="Ana menü">${linkler}</nav>`;
  document.body.prepend(baslik);
  document.getElementById('cikis').addEventListener('click', async () => {
    try { await api('/oturum/cikis', { method: 'POST' }); } finally { location.href = '/index.html'; }
  });
  const aktif = baslik.querySelector('[aria-current="page"]');
  if (aktif) aktif.scrollIntoView({ inline: 'center', block: 'nearest' });
}

// Yazma işleminden hemen sonra: yordamın döndürdüğü (kaynaktaki) bakiyeyi üst çubuğa yaz.
export function ustBakiyeGuncelle(bakiye) {
  const el = document.getElementById('ust-bakiye');
  if (el) { el.textContent = tl(bakiye); el.classList.remove('parla'); void el.offsetWidth; el.classList.add('parla'); }
  if (aktifKullanici) aktifKullanici.bakiye = bakiye;
}

// Aşama 4: tam / yarım porsiyon seçimi (yarım yoksa boş döner, düğme tam porsiyon rezerve eder).
// Fiyatlar API'den gelir; arayüz hesaplamaz.
let porsiyonSayac = 0;
export function porsiyonSecimi(m) {
  if (m.yarim_fiyat == null) return '';
  const ad = `porsiyon-${++porsiyonSayac}`;
  return `<div class="porsiyon-secim" role="radiogroup" aria-label="Porsiyon">
    <label><input type="radio" name="${ad}" data-porsiyon value="tam" checked><span>Tam ${tl(m.fiyat)}</span></label>
    <label><input type="radio" name="${ad}" data-porsiyon value="yarim"><span>Yarım ${tl(m.yarim_fiyat)}</span></label>
  </div>`;
}
export function seciliPorsiyon(kapsam) {
  const s = kapsam.querySelector('[data-porsiyon]:checked');
  return s ? s.value : 'tam';
}

export function seciliDoldur(select, liste, secili, { deger = 'id', metin = 'ad' } = {}) {
  select.innerHTML = liste.map((o) => `<option value="${esc(o[deger])}"${String(o[deger]) === String(secili) ? ' selected' : ''}>${esc(o[metin])}</option>`).join('');
}

// Seçimleri adres çubuğunda tutar (yenileyince kaybolmasın, paylaşılabilsin)
export function adresParam(ad, varsayilan) {
  return new URLSearchParams(location.search).get(ad) ?? varsayilan;
}
export function adresGuncelle(degerler) {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(degerler)) { if (v == null || v === '') p.delete(k); else p.set(k, v); }
  history.replaceState(null, '', `${location.pathname}?${p}`);
}
