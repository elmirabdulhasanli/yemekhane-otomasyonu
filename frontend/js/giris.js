import { api, bildir, bildirimGizle } from './ortak.js';

const form = document.getElementById('giris-formu');
const kutu = document.getElementById('bildirim');
const params = new URLSearchParams(location.search);
// Yalnızca site içi yönlendirmeye izin ver (açık yönlendirme olmasın)
const donus = /^\/[a-z]+\.html(\?.*)?$/i.test(params.get('donus') || '') ? params.get('donus') : '/menu.html';

// Oturum zaten açıksa doğrudan devam et
fetch('/api/ben', { credentials: 'same-origin' }).then((y) => { if (y.ok) location.replace(donus); }).catch(() => {});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  bildirimGizle(kutu);
  const dugme = form.querySelector('button[type=submit]');
  dugme.disabled = true;
  try {
    await api('/oturum/giris', { method: 'POST', govde: { eposta: form.eposta.value, sifre: form.sifre.value } });
    location.replace(donus);
  } catch (hata) {
    bildir(kutu, hata.message);
    form.sifre.select();
  } finally {
    dugme.disabled = false;
  }
});

document.querySelectorAll('[data-eposta]').forEach((b) => b.addEventListener('click', () => {
  form.eposta.value = b.dataset.eposta;
  form.sifre.value = 'Yemek2026!';
  form.sifre.focus();
}));
