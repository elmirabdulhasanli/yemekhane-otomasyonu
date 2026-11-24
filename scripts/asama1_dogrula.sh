#!/bin/bash
# Aşama 1 doğrulaması: her maddenin komutunu ve çıktısını rapor/ciktilar/asama1.txt'ye yazar.
# Kullanım (depo kökünde): bash scripts/asama1_dogrula.sh
set -u
cd "$(dirname "$0")/.."
OUT=rapor/ciktilar/asama1.txt
mkdir -p rapor/ciktilar
: > "$OUT"
P="docker compose exec -T mysql-primary mysql -uyemekhane_app -pUyg_2026 yemekhane"
R="docker compose exec -T mysql-replica mysql -uyemekhane_app -pUyg_2026 yemekhane"

calistir() {   # $1 = başlık, $2 = komut
  { echo; echo "### $1"; echo "\$ $2"; bash -c "$2" 2>&1 | grep -v "Using a password on the command line"; } | tee -a "$OUT"
}
bekle_replika() { sleep 2; }

# Yeni başlamış container'lar "health: starting" görünmesin diye hepsi healthy olana kadar bekle (en çok 2 dk)
for i in $(seq 1 60); do
  docker compose ps --format '{{.Status}}' | grep -qE 'starting|unhealthy|Restarting' || break; sleep 2
done
calistir "1. Tüm servisler healthy, replica-setup Exited (0)" \
  "docker compose ps -a --format 'table {{.Service}}\t{{.Status}}'"
calistir "1b. replica-setup günlüğü" "docker compose logs --no-log-prefix replica-setup"
calistir "1c. Replikasyon durumu" \
  "docker compose exec -T mysql-replica mysql -uroot -pyemekhane_kok -e 'SHOW REPLICA STATUS\G' | grep -E 'Source_Host|Replica_IO_Running|Replica_SQL_Running:|Seconds_Behind_Source|Auto_Position'"

calistir "2a. Replikada önceki bakiye (kullanıcı 7)" "$R -e 'SELECT id, ad, bakiye FROM kullanicilar WHERE id = 7'"
calistir "2b. Kaynakta 100 TL yükleme" "$P -e 'CALL sp_bakiye_yukle(7, 100)'"
bekle_replika
calistir "2c. Replikada yeni bakiye" "$R -e 'SELECT id, ad, bakiye FROM kullanicilar WHERE id = 7'"

calistir "3. Replikaya yazma denemesi (ERROR 1290 beklenir)" "$R -e 'CALL sp_bakiye_yukle(7, 50)'"
calistir "3b. Replika read_only ayarları" "$R -e 'SELECT @@read_only, @@super_read_only'"

calistir "4a. Replikayı durdur" "docker compose stop mysql-replica"
calistir "4b. Replika kapalıyken kaynakta 200 TL yükleme" "$P -e 'CALL sp_bakiye_yukle(7, 200)'"
calistir "4c. Kaynaktaki bakiye" "$P -e 'SELECT id, bakiye FROM kullanicilar WHERE id = 7'"
calistir "4d. Replikayı başlat" "docker compose start mysql-replica"
for i in $(seq 1 60); do
  docker compose exec -T mysql-replica mysqladmin -uroot -pyemekhane_kok ping -h 127.0.0.1 --silent >/dev/null 2>&1 && break; sleep 1
done
sleep 3
calistir "4e. Replika aradaki değişikliği yakaladı" "$R -e 'SELECT id, bakiye FROM kullanicilar WHERE id = 7'"
calistir "4f. Bakiye = hareket toplamı (replikada)" \
  "$R -e 'SELECT k.bakiye, SUM(h.tutar) AS hareket_toplami FROM kullanicilar k JOIN bakiye_hareketleri h ON h.kullanici_id = k.id WHERE k.id = 7 GROUP BY k.id'"
calistir "4g. Replikasyon yine çalışıyor" \
  "docker compose exec -T mysql-replica mysql -uroot -pyemekhane_kok -e 'SHOW REPLICA STATUS\G' | grep -E 'Replica_IO_Running|Replica_SQL_Running:|Seconds_Behind_Source'"
calistir "5. Redis" "docker compose exec -T redis redis-cli ping"
echo; echo "Çıktı: $OUT"
