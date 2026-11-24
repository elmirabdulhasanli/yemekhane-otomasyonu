import { api, sayfaBaslat, tl, kisaTarih, esc, bildir, bildirimGizle, seciliDoldur } from './ortak.js';

const $ = (id) => document.getElementById(id);
const kutu = $('bildirim');
const form = $('menu-formu');
let ref, duzenlenenId = null;

function tarihKaydir(t, gun) {
  const d = new Date(t + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + gun);
  return d.toISOString().slice(0, 10);
}

const puanCiz = (m) => (m.ortalama_puan == null ? '<span class="soluk">—</span>'
  : `<span class="puan-goster" style="font-size:1rem">★</span> ${Number(m.ortalama_puan).toFixed(2)} <span class="soluk">(${m.oy_sayisi})</span>`);

function dolulukCiz(m) {
  const sinif = m.doluluk_yuzde >= 100 ? 'dolu' : m.doluluk_yuzde >= 80 ? 'yuksek' : '';
  return `${m.rezerve}/${m.kapasite} <span class="soluk">(%${m.doluluk_yuzde})</span>
    <div class="doluluk-cubuk"><span class="${sinif}" style="width:${Math.min(m.doluluk_yuzde, 100)}%"></span></div>`;
}

async function raporYukle() {
  const q = new URLSearchParams({ baslangic: $('r-baslangic').value, bitis: $('r-bitis').value });
  if ($('r-yemekhane').value) q.set('yemekhane_id', $('r-yemekhane').value);
  try {
    const { menuler } = await api('/yonetim/menuler?' + q);
    $('rapor').innerHTML = menuler.length ? menuler.map((m) => `
      <tr${m.menu_id === duzenlenenId ? ' class="secili-satir"' : ''}>
        <td data-etiket="Tarih">${kisaTarih(m.tarih)}</td>
        <td data-etiket="Menü">${esc(m.yemekhane)} · <strong>${esc(m.ogun)}</strong><br><span class="soluk">${tl(m.ogrenci_fiyati)} / ${tl(m.personel_fiyati)} · ${m.yemek_sayisi} yemek</span></td>
        <td data-etiket="Doluluk" style="min-width:120px">${dolulukCiz(m)}</td>
        <td data-etiket="Puan" class="puan-hucre">${puanCiz(m)}</td>
        <td><button class="dugme dugme-ikincil dugme-kucuk" data-duzenle="${m.menu_id}">Düzenle</button></td>
      </tr>`).join('') : '<tr><td colspan="5" class="bos">Bu aralıkta menü yok.</td></tr>';
  } catch (hata) {
    bildir(kutu, hata.message);
  }
}

function yemekSecimiCiz(yemekler) {
  const gruplar = new Map();
  for (const y of yemekler) {
    if (!gruplar.has(y.kategori)) gruplar.set(y.kategori, []);
    gruplar.get(y.kategori).push(y);
  }
  $('yemek-secim').innerHTML = [...gruplar].map(([kategori, liste]) => `
    <h4>${esc(kategori)}</h4>
    ${liste.map((y) => `<label class="secim"><input type="checkbox" name="yemek" value="${y.id}">
      ${esc(y.ad)} <span class="soluk kucuk">${y.kalori} kcal${y.vejetaryen ? ' · 🌿' : ''}</span></label>`).join('')}`).join('');
}

function secimOzeti() {
  const secili = [...form.querySelectorAll('[name=yemek]:checked')];
  const kalori = secili.reduce((t, c) => t + Number(c.closest('label').querySelector('.soluk').textContent.match(/\d+/)[0]), 0);
  $('secim-ozet').textContent = secili.length ? `(${secili.length} seçili · ${kalori} kcal)` : '';
}

function formuSifirla() {
  duzenlenenId = null;
  form.reset();
  $('f-tarih').value = tarihKaydir(ref.bugun, 1);
  $('f-ogr').value = '40.00';
  $('f-per').value = '90.00';
  $('form-baslik').textContent = 'Yeni menü';
  $('kaydet').textContent = 'Menüyü oluştur';
  $('onizle').hidden = true;
  secimOzeti();
  document.querySelectorAll('.secili-satir').forEach((s) => s.classList.remove('secili-satir'));
}

async function duzenle(id) {
  bildirimGizle(kutu);
  try {
    const { menu } = await api('/yonetim/menuler/' + id);
    duzenlenenId = menu.id;
    form.yemekhane_id.value = menu.yemekhane_id;
    form.ogun_id.value = menu.ogun_id;
    form.tarih.value = menu.tarih;
    form.ogrenci_fiyati.value = menu.ogrenci_fiyati.toFixed(2);
    form.personel_fiyati.value = menu.personel_fiyati.toFixed(2);
    form.querySelectorAll('[name=yemek]').forEach((c) => { c.checked = menu.yemek_idler.includes(Number(c.value)); });
    $('form-baslik').textContent = `Menü #${menu.id} düzenleniyor`;
    $('kaydet').textContent = 'Değişiklikleri kaydet';
    onizlemeGuncelle(menu);
    secimOzeti();
    document.querySelectorAll('#rapor tr').forEach((tr) => tr.classList.toggle('secili-satir', !!tr.querySelector(`[data-duzenle="${id}"]`)));
    $('form-kart').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (hata) {
    bildir(kutu, hata.message);
  }
}

function onizlemeGuncelle(m) {
  $('onizle').href = `/menu.html?yemekhane=${m.yemekhane_id}&ogun=${m.ogun_id}&tarih=${m.tarih}`;
  $('onizle').hidden = false;
}

form.addEventListener('change', (e) => { if (e.target.name === 'yemek') secimOzeti(); });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  bildirimGizle(kutu);
  const govde = {
    yemekhane_id: Number(form.yemekhane_id.value),
    ogun_id: Number(form.ogun_id.value),
    tarih: form.tarih.value,
    ogrenci_fiyati: Number(String(form.ogrenci_fiyati.value).replace(',', '.')),
    personel_fiyati: Number(String(form.personel_fiyati.value).replace(',', '.')),
    yemek_idler: [...form.querySelectorAll('[name=yemek]:checked')].map((c) => Number(c.value)),
  };
  const dugme = $('kaydet');
  dugme.disabled = true;
  try {
    if (duzenlenenId) {
      await api('/yonetim/menuler/' + duzenlenenId, { method: 'PUT', govde });
      bildir(kutu, `Menü #${duzenlenenId} güncellendi. Önbellekteki eski kayıt silindi.`, 'basari');
    } else {
      const { id } = await api('/yonetim/menuler', { method: 'POST', govde });
      duzenlenenId = id;
      $('form-baslik').textContent = `Menü #${id} düzenleniyor`;
      $('kaydet').textContent = 'Değişiklikleri kaydet';
      bildir(kutu, `Menü #${id} oluşturuldu.`, 'basari');
    }
    onizlemeGuncelle(govde);
    await raporYukle();
  } catch (hata) {
    bildir(kutu, hata.message);
  } finally {
    dugme.disabled = false;
  }
});

$('rapor').addEventListener('click', (e) => {
  const b = e.target.closest('[data-duzenle]');
  if (b) duzenle(Number(b.dataset.duzenle));
});
$('rapor-filtre').addEventListener('change', raporYukle);
$('yeni-menu').addEventListener('click', formuSifirla);

(async () => {
  try {
    await sayfaBaslat({ rol: 'yonetici' });
    const [r, { yemekler }] = await Promise.all([api('/referans'), api('/yonetim/yemekler')]);
    ref = r;
    for (const y of ref.yemekhaneler) $('r-yemekhane').insertAdjacentHTML('beforeend', `<option value="${y.id}">${esc(y.ad)}</option>`);
    seciliDoldur($('f-yemekhane'), ref.yemekhaneler, 1);
    seciliDoldur($('f-ogun'), ref.ogunler, 2);
    $('r-baslangic').value = tarihKaydir(ref.bugun, -7);
    $('r-bitis').value = tarihKaydir(ref.bugun, 7);
    yemekSecimiCiz(yemekler);
    formuSifirla();
    await raporYukle();
  } catch (hata) {
    if (hata.durum !== 401 && hata.durum !== 403) bildir(kutu, hata.message);
  }
})();
