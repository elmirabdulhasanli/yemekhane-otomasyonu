#!/bin/bash
# Aşama 4 doğrulaması: migration çalışan sisteme uygulanır, replikaya geçtiği gösterilir,
# yeni uygulama devreye alınır, Redis'teki eski yapıdaki menü kayıtları temizlenir.
# Önkoşul: sistem Aşama 3 kodu ve 04 UYGULANMAMIŞ veritabanıyla çalışıyor olmalı.
# Çıktı: rapor/ciktilar/asama4.txt   Kullanım: bash scripts/asama4_dogrula.sh
set -u
cd "$(dirname "$0")/.."
OUT=rapor/ciktilar/asama4.txt
mkdir -p rapor/ciktilar; : > "$OUT"
API=${API:-http://localhost:8080/api}
PR="docker compose exec -T mysql-primary mysql --default-character-set=utf8mb4 -uroot -pyemekhane_kok yemekhane"
RE="docker compose exec -T mysql-replica mysql --default-character-set=utf8mb4 -uroot -pyemekhane_kok yemekhane"
RC="docker compose exec -T redis redis-cli"
C=$(mktemp)
calistir() { { echo; echo "### $1"; echo "\$ $2"; bash -c "$2" 2>&1 | grep -v "Using a password"; } | tee -a "$OUT"; }
YARIN=$(date -d tomorrow +%F 2>/dev/null || date -v+1d +%F)

calistir "0a. Migration öncesi: kaynakta rezervasyon tablosu (porsiyon sütunu yok)" \
  "$PR -e 'SHOW COLUMNS FROM rezervasyonlar' | cut -f1"
calistir "0b. Migration öncesi veri özeti (sonra karşılaştırılacak)" \
  "$PR -e 'SELECT COUNT(*) AS rezervasyon, SUM(ucret) AS toplam_ucret FROM rezervasyonlar; SELECT COUNT(*) AS kullanici, SUM(bakiye) AS toplam_bakiye FROM kullanicilar'"
calistir "0c. Redis'te eski yapıdaki (surum 1) menü kayıtları" \
  "$RC --scan --pattern 'menu:*' </dev/null | sort; echo '--- örnek:'; k=\$($RC --scan --pattern 'menu:*' </dev/null | head -1); $RC GET \$k </dev/null | cut -c1-120"

calistir "1. Migration KAYNAKTA uygulanır (replikaya ayrıca uygulanmaz)" \
  "$PR < db/init/04_degisiklik.sql && echo 'migration tamam (çıkış kodu 0)'"
calistir "1b. Tekrar çalıştırma güvenli (idempotent)" \
  "$PR < db/init/04_degisiklik.sql && echo 'ikinci çalıştırma tamam (çıkış kodu 0)'"
calistir "2a. Mevcut veri bozulmadı: geçmiş rezervasyonlar 'tam', toplamlar aynı" \
  "$PR -e 'SELECT porsiyon, COUNT(*) FROM rezervasyonlar GROUP BY porsiyon; SELECT COUNT(*) AS rezervasyon, SUM(ucret) AS toplam_ucret FROM rezervasyonlar; SELECT COUNT(*) AS kullanici, SUM(bakiye) AS toplam_bakiye FROM kullanicilar'"
calistir "2b. Bakiye = hareket toplamı kuralı bozulmadı (uyuşmayan kullanıcı sayısı 0)" \
  "$PR -e 'SELECT COUNT(*) AS uyusmayan FROM kullanicilar k WHERE k.bakiye <> (SELECT COALESCE(SUM(tutar),0) FROM bakiye_hareketleri h WHERE h.kullanici_id = k.id)'"

sleep 2
calistir "3a. REPLİKADAN: SHOW CREATE TABLE rezervasyonlar" "$RE -e 'SHOW CREATE TABLE rezervasyonlar\G'"
calistir "3b. REPLİKADAN: SHOW CREATE TABLE kullanici_alerjenleri" "$RE -e 'SHOW CREATE TABLE kullanici_alerjenleri\G'"
calistir "3c. REPLİKADAN: ogunler.yarim_porsiyon" "$RE -e 'SELECT id, ad, yarim_porsiyon FROM ogunler'"
calistir "3d. REPLİKADAN: güncellenmiş sp_rezervasyon_yap parametreleri ve fn_porsiyon_ucreti" \
  "$RE -e \"SELECT PARAMETER_NAME, DATA_TYPE FROM information_schema.PARAMETERS WHERE SPECIFIC_NAME='sp_rezervasyon_yap' ORDER BY ORDINAL_POSITION; SELECT fn_porsiyon_ucreti(40,'yarim') AS ogrenci_yarim, fn_porsiyon_ucreti(90,'yarim') AS personel_yarim\""
calistir "3e. Replikasyon çalışıyor, gecikme yok" \
  "docker compose exec -T mysql-replica mysql -uroot -pyemekhane_kok -e 'SHOW REPLICA STATUS\G' | grep -E 'Replica_IO_Running|Replica_SQL_Running:|Seconds_Behind_Source|Last_SQL_Error:'"

calistir "4. Yeni uygulama sürümü devreye alınır (veritabanlarına dokunmadan)" "docker compose up -d --build --no-deps uygulama frontend 2>&1 | tail -4"
for i in $(seq 1 60); do curl -sf -o /dev/null "$API/saglik" && break; sleep 1; done

calistir "5. Redis'teki eski yapıdaki menü kayıtları temizlenir" "bash scripts/redis_menu_temizle.sh"

curl -s -c "$C" -H 'Content-Type: application/json' -d '{"eposta":"mehmet.yildiz@ogr.kampus.edu.tr","sifre":"Yemek2026!"}' "$API/oturum/giris" >/dev/null
calistir "6a. Yeni yapıdaki kayıt (surum 2, yarım porsiyon alanlarıyla)" \
  "curl -s -o /dev/null -b $C '$API/menuler/gunluk?yemekhane_id=1&ogun_id=2&tarih=$YARIN'; $RC GET menu:1:$YARIN:2 | python3 -c 'import sys,json;d=json.load(sys.stdin);m=d[\"menu\"];print({k:d[\"surum\"] if k==\"surum\" else m[k] for k in [\"surum\",\"ogun\",\"yarim_porsiyon\",\"ogrenci_fiyati\",\"ogrenci_yarim_fiyati\",\"personel_yarim_fiyati\"]})'"
MENU=$(curl -s -b "$C" "$API/menuler/gunluk?yemekhane_id=1&ogun_id=2&tarih=$YARIN" | python3 -c 'import sys,json;print(json.load(sys.stdin)["menu"]["menu_id"])')
KAHV=$(curl -s -b "$C" "$API/menuler/gunluk?yemekhane_id=1&ogun_id=1&tarih=$YARIN" | python3 -c 'import sys,json;print(json.load(sys.stdin)["menu"]["menu_id"])')
calistir "6b. Yarım porsiyon rezervasyonu (öğle, öğrenci 40 TL → 24 TL)" \
  "curl -s -b $C -H 'Content-Type: application/json' -d '{\"menu_id\":$MENU,\"porsiyon\":\"yarim\"}' $API/rezervasyonlar; echo"
calistir "6c. Kahvaltıda yarım porsiyon reddedilir (yordamın mesajı)" \
  "curl -s -b $C -H 'Content-Type: application/json' -d '{\"menu_id\":$KAHV,\"porsiyon\":\"yarim\"}' $API/rezervasyonlar; echo"
calistir "6d. Kaynakta kayıt ve bakiye hareketi" \
  "$PR -e \"SELECT id, menu_id, durum, porsiyon, ucret FROM rezervasyonlar WHERE kullanici_id=7 AND menu_id=$MENU; SELECT tur, tutar, aciklama FROM bakiye_hareketleri WHERE kullanici_id=7 ORDER BY id DESC LIMIT 1\""
calistir "6e. Profilde alerjen seçimi (Süt=7, Gluten=1) ve menüde uyarı" \
  "curl -s -b $C -X PUT -H 'Content-Type: application/json' -d '{\"alerjen_idler\":[7,1]}' $API/profil/alerjenler | python3 -c 'import sys,json;print(\"seçili:\",[a[\"ad\"] for a in json.load(sys.stdin)[\"alerjenler\"] if a[\"secili\"]])'; curl -s -b $C '$API/menuler/gunluk?yemekhane_id=1&ogun_id=2&tarih=$YARIN' | python3 -c 'import sys,json;m=json.load(sys.stdin)[\"menu\"];print(\"uyarılı yemek sayısı:\",m[\"uyarili_yemek_sayisi\"]);[print(\" \",y[\"ad\"],\"→\",y[\"uyari\"] or \"-\") for k in m[\"kategoriler\"] for y in k[\"yemekler\"]]'"
sleep 2   # replikasyon eşzamansızdır; yazmadan hemen sonra replikada henüz görünmeyebilir
calistir "6f. Replikada kullanıcının alerjenleri" "$RE -e 'SELECT * FROM kullanici_alerjenleri WHERE kullanici_id = 7'"
# Gösterim için rezervasyonu geri al (bakiye iade edilir)
RID=$($PR -N -e "SELECT id FROM rezervasyonlar WHERE kullanici_id=7 AND menu_id=$MENU" 2>/dev/null)
calistir "6g. İptal: yarım ücret iade edilir" "curl -s -b $C -X POST $API/rezervasyonlar/$RID/iptal; echo"
rm -f "$C"
echo; echo "Çıktı: $OUT"
