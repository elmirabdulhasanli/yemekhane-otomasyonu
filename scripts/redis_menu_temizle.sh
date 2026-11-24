#!/bin/bash
# Aşama 4 · Redis'teki eski yapıdaki menü kayıtlarını temizler.
# Migration sonrası önbellekteki menu:* kayıtlarında yarım porsiyon alanları yoktur;
# bunlar silinir, bir sonraki istekte yeni yapıyla (surum 2) yeniden oluşur.
# Ayrıca uygulama, sürümü eski bir kayda rastlarsa onu okumaz ve siler (menuOnbellek.js) — bu betik
# o "tembel" temizliği beklemeden hepsini bir kerede yapar. Oturumlara (oturum:*) dokunulmaz.
# Kullanım (depo kökünde): bash scripts/redis_menu_temizle.sh
set -euo pipefail
cd "$(dirname "$0")/.."
RC=(docker compose exec -T redis redis-cli)

once=$("${RC[@]}" --scan --pattern 'menu:*' </dev/null | grep -c . || true)
echo "Temizlik öncesi menu:* kayıt sayısı: $once"
# SCAN ile (KEYS gibi Redis'i kilitlemez) anahtarlar önce listeye alınır, sonra UNLINK ile silinir.
# Not: listeyi döngüde borudan okumak hatalıdır; "docker compose exec" stdin'i yutar ve
# yalnızca ilk anahtar silinir. Bu yüzden mapfile + tek komut.
mapfile -t anahtarlar < <("${RC[@]}" --scan --pattern 'menu:*' </dev/null)
if [ "${#anahtarlar[@]}" -gt 0 ]; then
  printf '  %s\n' "${anahtarlar[@]}"
  echo "UNLINK → $("${RC[@]}" UNLINK "${anahtarlar[@]}" </dev/null) kayıt silindi"
fi
sonra=$("${RC[@]}" --scan --pattern 'menu:*' </dev/null | grep -c . || true)
echo "Temizlik sonrası menu:* kayıt sayısı: $sonra"
echo "Oturumlar korunur, oturum:* kayıt sayısı: $("${RC[@]}" --scan --pattern 'oturum:*' | grep -c . || true)"
