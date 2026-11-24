#!/bin/bash
# Aşama 3 doğrulaması: Redis menü önbelleği ve oturum deposu.
# Çıktı: rapor/ciktilar/asama3.txt   Kullanım (depo kökünde, sistem ayaktayken): bash scripts/asama3_dogrula.sh
set -u
cd "$(dirname "$0")/.."
OUT=rapor/ciktilar/asama3.txt
mkdir -p rapor/ciktilar; : > "$OUT"
API=${API:-http://localhost:8080/api}
OGR=$(mktemp); YON=$(mktemp)
RC="docker compose exec -T redis redis-cli"

calistir() { { echo; echo "### $1"; echo "\$ $2"; bash -c "$2" 2>&1 | grep -v "Using a password"; } | tee -a "$OUT"; }
giris() { curl -s -c "$1" -H 'Content-Type: application/json' -d "{\"eposta\":\"$2\",\"sifre\":\"Yemek2026!\"}" "$API/oturum/giris" >/dev/null; }

BUGUN=$(date +%F); YARIN=$(date -d tomorrow +%F 2>/dev/null || date -v+1d +%F)
K="menu:1:$YARIN:2"

calistir "0. Temiz başlangıç: bu menünün önbellek kaydı silinir" "$RC DEL $K"
giris "$OGR" mehmet.yildiz@ogr.kampus.edu.tr
giris "$YON" leyla.arslan@kampus.edu.tr

calistir "1a. İlk istek (yarın öğle, Merkez) → X-Menu-Kaynak: veritabani" \
  "curl -s -D - -o /dev/null -b $OGR '$API/menuler/gunluk?yemekhane_id=1&ogun_id=2&tarih=$YARIN' | grep -i x-menu-kaynak"
calistir "1b. İkinci istek → X-Menu-Kaynak: redis" \
  "curl -s -D - -o /dev/null -b $OGR '$API/menuler/gunluk?yemekhane_id=1&ogun_id=2&tarih=$YARIN' | grep -i x-menu-kaynak"
calistir "1c. Uygulama günlüğü" "docker compose logs --no-log-prefix uygulama | grep '\[menu\] $K' | tail -2"
calistir "1d. Redis'teki kayıt ve kalan süre (saniye, günün sonuna kadar)" \
  "$RC --scan --pattern 'menu:*' | sort | head; echo '--- TTL'; $RC TTL $K; echo '--- EXPIRETIME (unix)'; $RC EXPIRETIME $K; echo '--- GET (ilk 300 karakter)'; $RC GET $K | cut -c1-300"

MENU_ID=$(curl -s -b "$OGR" "$API/menuler/gunluk?yemekhane_id=1&ogun_id=2&tarih=$YARIN" | python3 -c 'import sys,json;print(json.load(sys.stdin)["menu"]["menu_id"])')
GOVDE=$(curl -s -b "$YON" "$API/yonetim/menuler/$MENU_ID" | python3 -c '
import sys,json; m=json.load(sys.stdin)["menu"]
ids=m["yemek_idler"]; ids=[i for i in ids if i!=41] if 41 in ids else ids+[41]   # 41: Mevsim Meyvesi ekle/çıkar
m["yemek_idler"]=ids; print(json.dumps(m))')
calistir "2a. Yönetici menüyü değiştirir (menü $MENU_ID, bir yemek ekler/çıkarır)" \
  "curl -s -b $YON -X PUT -H 'Content-Type: application/json' -d '$GOVDE' $API/yonetim/menuler/$MENU_ID; echo"
calistir "2b. Eski kayıt silindi (EXISTS 0)" "$RC EXISTS $K"
calistir "2c. Uygulama günlüğü: geçersiz kılma" "docker compose logs --no-log-prefix uygulama | grep 'geçersiz kılındı' | tail -1"
calistir "2d. Sonraki istek veritabanından, yeni menüyle" \
  "curl -s -D /dev/stderr -b $OGR '$API/menuler/gunluk?yemekhane_id=1&ogun_id=2&tarih=$YARIN' 2>&1 >/dev/null | grep -i x-menu-kaynak; curl -s -b $OGR '$API/menuler/gunluk?yemekhane_id=1&ogun_id=2&tarih=$YARIN' | python3 -c 'import sys,json;m=json.load(sys.stdin)[\"menu\"];print([y[\"ad\"] for k in m[\"kategoriler\"] for y in k[\"yemekler\"]])'"

TOKEN=$(awk '$6=="oturum"{print $7}' "$OGR")
calistir "3a. Oturum anahtarı ve süresi (1800 sn, her istekte yenilenir)" \
  "$RC --scan --pattern 'oturum:*' | grep -c . | sed 's/^/toplam oturum: /'; $RC TTL oturum:$TOKEN; $RC GET oturum:$TOKEN"
sleep 3
calistir "3b. 3 sn sonra TTL azaldı, istek atınca tekrar 1800 oldu" \
  "$RC TTL oturum:$TOKEN; curl -s -o /dev/null -w 'GET /api/ben → %{http_code}\n' -b $OGR $API/ben; $RC TTL oturum:$TOKEN"
calistir "3c. Uygulama container'ı yeniden başlatılır" "docker compose restart uygulama"
for i in $(seq 1 30); do curl -sf -o /dev/null "$API/saglik" && break; sleep 1; done
calistir "3d. Aynı çerezle istek: oturum düşmedi (HTTP 200)" \
  "curl -s -w '\nHTTP %{http_code}\n' -b $OGR $API/ben"
calistir "3e. Çıkış → Redis'teki oturum silinir" \
  "curl -s -b $OGR -X POST $API/oturum/cikis; echo; $RC EXISTS oturum:$TOKEN; curl -s -o /dev/null -w 'eski çerezle /api/ben → HTTP %{http_code}\n' -b $OGR $API/ben"
rm -f "$OGR" "$YON"
echo; echo "Çıktı: $OUT"
