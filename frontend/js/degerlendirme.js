import { api, sayfaBaslat, tarihYaz, tarihSaat, esc, bildir, bildirimGizle } from './ortak.js';

const $ = (id) => document.getElementById(id);
const kutu = $('bildirim');
const icerik = $('icerik');
let menuler = [];
let filtre = 'bekleyen';

const yildizGoster = (p) => `<span class="puan-goster" aria-label="${p} / 5">${'★'.repeat(p)}<span class="bos-yildiz">${'★'.repeat(5 - p)}</span></span>`;

function formCiz(m) {
  const yildizlar = [5, 4, 3, 2, 1].map((p) => `
    <input type="radio" id="p-${m.menu_id}-${p}" name="puan" value="${p}">
    <label for="p-${m.menu_id}-${p}" title="${p} puan">★</label>`).join('');
  return `<form class="degerlendirme-formu" data-menu="${m.menu_id}">
    <fieldset class="yildizlar"><legend>Puan</legend>${yildizlar}</fieldset>
    <label for="y-${m.menu_id}" class="kucuk">Yorum (isteğe bağlı)</label>
    <textarea id="y-${m.menu_id}" name="yorum" rows="2" maxlength="500" placeholder="Yemek nasıldı?"></textarea>
    <button class="dugme dugme-kucuk" type="submit" style="margin-top:.5rem">Gönder</button>
  </form>`;
}

function ogeCiz(m) {
  const govde = m.puan
    ? `<p>${yildizGoster(m.puan)} <span class="soluk kucuk">${tarihSaat(m.degerlendirme_zamani)}</span></p>${m.yorum ? `<p class="kucuk">“${esc(m.yorum)}”</p>` : ''}`
    : formCiz(m);
  return `<li class="kart">
    <h3 style="margin:0 0 .15rem;font-size:1rem">${tarihYaz(m.tarih)} · ${esc(m.ogun)}</h3>
    <p class="soluk kucuk" style="margin-bottom:.5rem">${esc(m.yemekhane)} — ${esc(m.yemekler)}</p>
    ${govde}
  </li>`;
}

function ciz() {
  const liste = menuler.filter((m) => (filtre === 'bekleyen' ? !m.puan : m.puan));
  icerik.innerHTML = liste.length ? liste.map(ogeCiz).join('')
    : `<li class="kart bos">${filtre === 'bekleyen' ? 'Değerlendirilecek menü yok. Turnikeden geçtiğiniz menüler burada görünür.' : 'Henüz değerlendirme yapmadınız.'}</li>`;
}

async function yukle() {
  ({ menuler } = await api('/degerlendirmeler'));
  ciz();
}

$('sekmeler').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filtre]');
  if (!b) return;
  filtre = b.dataset.filtre;
  document.querySelectorAll('#sekmeler [role=tab]').forEach((t) => t.setAttribute('aria-selected', String(t === b)));
  ciz();
});

icerik.addEventListener('submit', async (e) => {
  const form = e.target.closest('.degerlendirme-formu');
  if (!form) return;
  e.preventDefault();
  bildirimGizle(kutu);
  const secili = form.querySelector('[name=puan]:checked');
  try {
    await api('/degerlendirmeler', { method: 'POST', govde: {
      menu_id: Number(form.dataset.menu), puan: secili ? Number(secili.value) : null, yorum: form.yorum.value } });
    await yukle();
    bildir(kutu, 'Değerlendirmeniz kaydedildi. Teşekkürler!', 'basari');
  } catch (hata) {
    bildir(kutu, hata.message);
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
