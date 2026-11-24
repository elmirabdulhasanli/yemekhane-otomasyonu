#!/usr/bin/env python3
"""rapor/rapor.html dosyasını komut çıktıları (rapor/ciktilar) ve kod parçalarından üretir.
PDF'e çevirme: node scripts/rapor_pdf.js  → rapor/Yemekhane_Otomasyonu_Rapor.pdf"""
import html, pathlib, re

KOK = pathlib.Path(__file__).resolve().parent.parent
R = KOK / 'rapor'
oku = lambda p: (KOK / p).read_text(encoding='utf-8')
e = html.escape

def cikti(ad):
    return f'<pre class="cikti">{e(oku(f"rapor/ciktilar/{ad}").strip())}</pre>'

def kod(yol, bas, son=None, baslik=None):
    """yol dosyasında 'bas' deseninin geçtiği satırdan 'son' desenine kadar (dahil) alır."""
    satirlar = oku(yol).splitlines()
    i = next(n for n, s in enumerate(satirlar) if bas in s)
    j = i if son is None else next(n for n in range(i, len(satirlar)) if son in satirlar[n])
    parca = '\n'.join(satirlar[i:j + 1])
    return f'<div class="kod"><div class="kod-baslik">{e(baslik or yol)} : {i + 1}</div><pre>{e(parca)}</pre></div>'

def ekran(dosyalar, alt):
    imgs = ''.join(f'<figure><img src="ekran/{d}.png"><figcaption>{e(a)}</figcaption></figure>' for d, a in zip(dosyalar, alt))
    return f'<div class="ekranlar">{imgs}</div>'

ICERIK = f'''<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Yemekhane Otomasyonu · Rapor</title>
<style>
@page {{ size: A4; margin: 16mm 14mm; }}
body {{ font-family: "Segoe UI", Roboto, "Noto Sans", sans-serif; color: #1F2A2E; font-size: 10.5pt; line-height: 1.45; }}
h1 {{ color: #1B6B5A; font-size: 22pt; margin: 0 0 4pt; }}
h2 {{ color: #1B6B5A; border-bottom: 2px solid #1B6B5A; padding-bottom: 3pt; margin-top: 18pt; break-after: avoid; }}
h3 {{ margin: 12pt 0 4pt; break-after: avoid; }}
.kapak {{ border-bottom: 3px dashed #C9D3D0; padding-bottom: 10pt; margin-bottom: 10pt; }}
.secim {{ background: #DCEFEA; border-left: 5px solid #1B6B5A; padding: 8pt 12pt; font-size: 12pt; margin: 10pt 0; }}
table {{ border-collapse: collapse; width: 100%; margin: 6pt 0; font-size: 9.5pt; }}
th, td {{ border: 1px solid #C9D3D0; padding: 3pt 6pt; text-align: left; vertical-align: top; }}
th {{ background: #EEF2F0; }}
pre {{ white-space: pre-wrap; word-break: break-all; margin: 0; }}
.cikti {{ background: #1F2A2E; color: #E8F0EC; font: 7.6pt/1.35 "DejaVu Sans Mono", Consolas, monospace; padding: 8pt; border-radius: 4pt; }}
.kod {{ border: 1px solid #C9D3D0; border-radius: 4pt; margin: 6pt 0; break-inside: avoid; }}
.kod-baslik {{ background: #EEF2F0; font: 8pt monospace; padding: 2pt 6pt; color: #5A686D; }}
.kod pre {{ font: 8pt/1.35 "DejaVu Sans Mono", Consolas, monospace; padding: 6pt; }}
.ekranlar {{ display: flex; flex-wrap: wrap; gap: 8pt; }}
.ekranlar figure {{ margin: 0; width: 31%; break-inside: avoid; }}
.ekranlar img {{ width: 100%; border: 1px solid #C9D3D0; }}
.genis img {{ width: 100%; border: 1px solid #C9D3D0; }}
figcaption {{ font-size: 8pt; color: #5A686D; text-align: center; }}
.not {{ background: #FFF4DD; border-left: 4px solid #F2B134; padding: 6pt 10pt; }}
.sayfa-kir {{ break-before: page; }}
code {{ background: #EEF2F0; padding: 0 3pt; border-radius: 2pt; font-size: 9pt; }}
</style></head><body>

<section class="kapak">
  <h1>Yemekhane Otomasyonu · Dönem Ödevi Raporu</h1>
  <p>Web Teknolojileri · Öğrenci: <b>____________________</b> · Numara: <b>__________</b> · Depo: <b>____________________</b></p>
  <div class="secim"><b>Seçilen yol: Web API + arayüz.</b> Uygulama Node.js 22 + Express 5 ile yazılmış, yalnızca JSON döndüren bir Web API'dir
  (<code>uygulama/</code>). HTML5 + CSS3 arayüz <code>frontend/</code> klasöründe Apache tarafından sunulur ve veriyi JavaScript <code>fetch</code> ile alır;
  çerçeve (React vb.) kullanılmamıştır. Apache <code>-D WEBAPI</code> modunda <code>/api/</code> isteklerini uygulamaya iletir.</div>
  <table>
    <tr><th>Aşama</th><th>Etiket</th><th>Kanıt</th></tr>
    <tr><td>1 · Altyapı</td><td><code>asama-1</code></td><td><code>scripts/asama1_dogrula.sh</code> → <code>rapor/ciktilar/asama1.txt</code></td></tr>
    <tr><td>2 · Uygulama</td><td><code>asama-2</code></td><td>7 ekran, katmanlı API, <code>testler/e2e.mjs</code></td></tr>
    <tr><td>3 · Redis</td><td><code>asama-3</code></td><td><code>scripts/asama3_dogrula.sh</code> → <code>rapor/ciktilar/asama3.txt</code></td></tr>
    <tr><td>4 · Değişiklik</td><td><code>asama-4</code></td><td><code>db/init/04_degisiklik.sql</code>, <code>scripts/asama4_dogrula.sh</code> → <code>asama4.txt</code></td></tr>
  </table>
  <p>Tüm komut çıktıları elle kopyalanmadı; betikler gerçek komutları çalıştırıp çıktıyı dosyaya yazdı. Dizi: sıfırdan kurulum (Aşama 3 kodu) →
  Aşama 1 ve 3 betikleri → çalışan sisteme migration ve yeni sürüm (Aşama 4) → <code>down -v</code> ile 04 dahil sıfırdan kurulum → testler.</p>
</section>

<h2>Aşama 1 · Altyapı</h2>
<p>Beş servis <code>healthy</code>, <code>replica-setup</code> <code>Exited (0)</code>. Kaynakta yapılan 100 TL yükleme replikada görünüyor,
replikaya yazma <code>ERROR 1290 (--super-read-only)</code> ile reddediliyor, replika durdurulup başlatıldığında aradaki 200 TL'lik yüklemeyi
GTID otomatik konumlandırma sayesinde yakalıyor ve <code>bakiye = SUM(hareket)</code> kuralı replikada da tutuyor.</p>
{cikti('asama1.txt')}

<h2 class="sayfa-kir">Aşama 2 · Uygulama</h2>
<h3>Katmanlar ve klasör yapısı</h3>
<table>
<tr><th>Katman</th><th>Klasör</th><th>Görevi</th></tr>
<tr><td>Rota</td><td><code>src/rotalar/index.js</code></td><td>URL → controller, oturum ve rol ara katmanları</td></tr>
<tr><td>Controller</td><td><code>src/controllers/</code></td><td>İsteği okur, servisi çağırır, JSON yazar. <b>SQL yok, iş kuralı yok.</b></td></tr>
<tr><td>Servis (iş)</td><td><code>src/servisler/</code>, <code>src/kurallar.js</code></td><td>İş kuralları (rol fiyatı, iptal edilebilirlik, "yalnızca kullanılmış menü puanlanır"), okuma/yazma sunucusu seçimi</td></tr>
<tr><td>Veri</td><td><code>src/veri/</code>, <code>src/db/havuzlar.js</code></td><td>Tüm SQL burada. Para hareketi yapan işlemler yalnızca stored procedure çağrısıdır.</td></tr>
<tr><td>Arayüz</td><td><code>frontend/*.html</code>, <code>js/</code>, <code>css/</code></td><td>Yalnızca gösterim; fiyat, düğme durumu, uyarı gibi kararlar API'den gelir.</td></tr>
</table>

<h3>Bir isteğin yolu: <code>POST /api/rezervasyonlar</code></h3>
<p>Tarayıcı → Apache (<code>ProxyPass /api/</code>) → rota → controller → servis → veri katmanı → <code>CALL sp_rezervasyon_yap</code> (kaynak) → JSON yanıt.</p>
{kod('uygulama/src/rotalar/index.js', "r.post('/rezervasyonlar'", baslik='1. Rota')}
{kod('uygulama/src/controllers/rezervasyonController.js', 'async function yap', baslik='2. Controller')}
{kod('uygulama/src/servisler/rezervasyonServis.js', 'async function yap', 'return sonuc;', baslik='3. Servis')}
{kod('uygulama/src/veri/rezervasyonVeri.js', 'function rezervasyonYap', '}', baslik='4. Veri katmanı')}
{kod('uygulama/src/db/havuzlar.js', 'async function yordamCagir', '^}' if False else 'throw mysqlHatasiniCevir', baslik='5. Yordam çağrısı (kaynak havuzu)')}
{kod('uygulama/src/hatalar.js', 'function mysqlHatasiniCevir', 'return hata;', baslik='6. Hata çevirisi')}
<p>Yordam <code>SQLSTATE 45000</code> (MySQL 1644) döndürürse mesajı değiştirilmeden <code>{{"hata": "Bakiye yetersiz."}}</code> olarak 400 ile döner ve
arayüzde kırmızı bildirim kutusunda gösterilir (ekran 8). CHECK ihlali (3819) programlama hatasıdır; kullanıcı genel bir mesaj görür, ayrıntı günlüğe yazılır.</p>

<h3>Okuma / yazma ayrımı ve replikasyon gecikmesi</h3>
<table>
<tr><th>İşlem</th><th>Sunucu</th></tr>
<tr><td>Rezervasyon, iptal, bakiye yükleme (yordamlar), değerlendirme, menü oluşturma/düzenleme, alerjen kaydı</td><td>Kaynak (<code>mysql-primary</code>)</td></tr>
<tr><td>Yazma öncesi kontroller (ör. rezervasyon "kullanıldı" mı), giriş</td><td>Kaynak</td></tr>
<tr><td>Menüler, haftalık liste, rezervasyonlarım, hareket geçmişi, yönetici raporu</td><td>Replika (<code>mysql-replica</code>)</td></tr>
<tr><td>Kullanıcının kendi yazmasından sonraki 5 sn içindeki okumaları</td><td>Kaynak</td></tr>
</table>
{kod('uygulama/src/db/havuzlar.js', 'function okuyucu', '^}' if False else 'return okuma;', baslik='Okuma sunucusu seçimi')}
<p><b>Neden rezervasyondan hemen sonraki bakiye kaynaktan okunur?</b> MySQL replikasyonu eşzamansızdır: kaynak işlemi COMMIT ettiği anda yanıt
verir, değişiklik binlog üzerinden replikaya birkaç milisaniye ile birkaç saniye arasında (yük altında ya da replika yeniden bağlanırken daha uzun)
sonra uygulanır. Rezervasyondan hemen sonra bakiye replikadan okunsaydı kullanıcı parasının düşmediğini görebilir, aynı rezervasyonu tekrar
denemeye ya da gereksiz yükleme yapmaya kalkabilirdi. Bu yüzden ekranda gösterilen bakiye, <code>sp_rezervasyon_yap</code>'ın kaynakta
döndürdüğü değerdir (üst çubuk anında güncellenir); ayrıca oturuma <code>sonYazma</code> zamanı yazılır ve o kullanıcının sonraki 5 saniyedeki
okumaları kaynağa yönlenir ("kendi yazdığını oku"). Bakiye ekranı hangi sunucudan okuduğunu da gösterir. Bu gecikmeyi testler sırasında
gerçekten gözlemledik: kaynak yeniden başlatıldığında replika ancak 60 sn sonra yeniden bağlandı (MySQL'in varsayılan yeniden deneme süresi);
o arada replikadaki veri eskiydi. Replikaya hiç ulaşılamazsa uygulama okumayı kaynağa düşürür.</p>

<h3>Ekranlar (400 px telefon genişliği)</h3>
{ekran(['01-giris','01b-giris-hata','02-gunun-menusu'], ['1. Giriş (bcrypt)','1. Hatalı giriş mesajı','2. Günün menüsü: kalori, vejetaryen, alerjen'])}
{ekran(['03-haftalik-rezervasyon','03b-haftalik-liste','04-rezervasyonlarim'], ['3. Haftalık: rezervasyon sonrası bakiye','3. Boş yer, rol fiyatı, pasif düğme','4. Rezervasyonlarım ve iptal'])}
{ekran(['05-bakiye','06-degerlendirme-form','06b-degerlendirmelerim'], ['5. Bakiye, yükleme, hareketler','6. Değerlendirme (1–5, yorum)','6. Değerlendirmelerim'])}
{ekran(['08-hata-bakiye-yetersiz','09b-yonetim-telefon','07-profil-alerjen'], ['Yordam hatası arayüzde: "Bakiye yetersiz."','7. Yönetici paneli (telefon)','Aşama 4: profil, alerjen seçimi'])}
<div class="genis"><figure><img src="ekran/09-yonetim-masaustu.png"><figcaption>7. Yönetici paneli (masaüstü): menü bazında doluluk ve ortalama puan, menü düzenleme</figcaption></figure></div>

<h2 class="sayfa-kir">Aşama 3 · Redis</h2>
<table>
<tr><th>Görev</th><th>Anahtar</th><th>Süre</th><th>Silinme</th></tr>
<tr><td>Menü önbelleği</td><td><code>menu:{{yemekhane_id}}:{{tarih}}:{{ogun_id}}</code></td><td><code>EXAT</code> = menünün gününün 23:59:59'u (geçmiş tarihte bugünün sonu)</td><td>Yönetici menüyü oluşturduğunda/değiştirdiğinde (taşındıysa eski ve yeni anahtar)</td></tr>
<tr><td>Oturum</td><td><code>oturum:{{token}}</code> (64 hex)</td><td>1800 sn; her istekte <code>GETEX ... EX 1800</code> ile atomik yenilenir</td><td>Çıkışta <code>DEL</code></td></tr>
</table>
<p>Önbellekte yalnızca kullanıcıdan bağımsız menü içeriği tutulur (yemekler, kalori, alerjenler, fiyatlar). Boş yer, kullanıcının rezervasyonu,
rolüne göre fiyat ve alerjen uyarısı her istekte ayrıca hesaplanır; böylece tek bir kayıt tüm kullanıcılara hizmet eder ve doluluk bayatlamaz.</p>
<p><b>Geçersiz kılma sırası:</b> menü kaynağa yazılır → uygulama <code>WAIT_FOR_EXECUTED_GTID_SET</code> ile replikanın bu yazmayı almasını bekler
(en çok 2 sn) → Redis kaydı silinir. Önce silip beklemeseydik, araya giren bir okuma replikadaki <i>eski</i> menüyü okuyup önbelleğe yeniden
yazabilirdi ve eski menü gün sonuna kadar görünürdü. Redis'e ulaşılamazsa menü doğrudan veritabanından gelir (site çalışır), oturum
işlemleri ise anlaşılır bir 503 mesajı verir.</p>
{kod('uygulama/src/servisler/menuServis.js', 'async function menuIcerigi', 'return { menu, kaynak', baslik='Önbellek okuma (cache-aside)')}
{cikti('asama3.txt')}

<h2 class="sayfa-kir">Aşama 4 · Değişiklik talebi</h2>
<h3>Tasarım</h3>
<table>
<tr><th>Değişiklik</th><th>Karar</th></tr>
<tr><td><code>ogunler.yarim_porsiyon</code></td><td>Kural veride durur (Kahvaltı 0, Öğle/Akşam 1). Kahvaltıya açılırsa tek UPDATE yeter, kod değişmez.</td></tr>
<tr><td><code>rezervasyonlar.porsiyon ENUM('tam','yarim') DEFAULT 'tam'</code></td><td>Var olan 367 satır otomatik "tam" olur: geçmiş rezervasyonlar tam sayılır, <code>ucret</code> zaten ödenen tutarı tuttuğu için iade doğru kalır.</td></tr>
<tr><td><code>fn_porsiyon_ucreti()</code></td><td>%60 oranı tek yerde. Yordam da uygulamanın gösterdiği fiyat da bunu kullanır; ekrandaki fiyat ile kesilen ücret farklı olamaz.</td></tr>
<tr><td><code>sp_rezervasyon_yap(kullanici, menu, porsiyon)</code></td><td>Kahvaltıda yarım → "Bu öğünde yarım porsiyon seçilemez."; yarım porsiyon da bir kişilik yer kaplar; hareket açıklaması "Rezervasyon (yarım porsiyon)".</td></tr>
<tr><td><code>kullanici_alerjenleri</code></td><td>Çoka çok; kullanıcı silinirse seçimleri de silinir. Uyarı eşleştirmesi menüden ayrı yapılır, önbellek paylaşımlı kalır.</td></tr>
<tr><td>Redis</td><td>Önbellek yapı sürümü 1 → 2. <code>scripts/redis_menu_temizle.sh</code> eski <code>menu:*</code> kayıtlarını SCAN + UNLINK ile siler (oturumlar korunur); uygulama da eski sürümlü bir kayda rastlarsa onu okumaz ve siler.</td></tr>
</table>
<p class="not">Migration tekrar çalıştırılabilir (idempotent): MySQL'de <code>ADD COLUMN IF NOT EXISTS</code> olmadığından geçici bir yardımcı yordam
<code>information_schema</code>'ya bakarak sütunu yalnızca yoksa ekler. Yordamın imzası değiştiği için sıra şudur: migration → hemen ardından yeni uygulama
sürümü. Arada eski sürüm 2 parametreyle çağırırsa rezervasyon hata verir; canlı ortamda bu birkaç saniyelik pencere bakım duyurusuyla yönetilir.</p>
<h3>Çalışan sisteme uygulama ve replikaya geçiş kanıtı</h3>
{cikti('asama4.txt')}
<h3>Sıfırdan kurulum (04 db/init içinde)</h3>
{cikti('temiz_kurulum.txt')}

<h2>Testler</h2>
<p><b>Birim testleri</b> (<code>uygulama/test/</code>, veritabanı gerekmez): iş kuralları, önbellek anahtarı ve süresi, hata çevirisi, Aşama 4 kuralları.
<b>Uçtan uca testler</b> (<code>testler/e2e.mjs</code>): çalışan sisteme gerçek HTTP istekleri; yordam mesajlarının aynen iletilmesi, okuma-sonrası-yazma tutarlılığı,
önbellek kaynağı (<code>X-Menu-Kaynak</code>) ve geçersiz kılma, yarım porsiyon ücreti ve iadesi, alerjen uyarısı, yetki.</p>
{cikti('testler.txt')}
</body></html>'''

(R / 'rapor.html').write_text(ICERIK, encoding='utf-8')
print('yazıldı:', R / 'rapor.html')
