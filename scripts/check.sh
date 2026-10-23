#!/bin/sh
# Production builds (dist for any address, dist-pages for GitHub Pages): no secrets, no external resources,
# CSP, manifest and service worker paths for the base.
set -e
cd "$(dirname "$0")/.."
mkdir -p build
status=0
fail() { echo "FAIL: $1"; status=1; }

secrets='(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|api[_-]?key["'"'"' ]*[:=])'
if grep -rIEn --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=dist-pages --exclude-dir=test-results --exclude-dir=content --exclude-dir=public --exclude-dir=build --exclude=check.sh "$secrets" . 2>/dev/null; then
  fail "схожий на секрет рядок у файлах проєкту"
fi
for dir in dist dist-pages; do
  [ -d "$dir" ] || { fail "немає $dir: спершу npm run build і npm run build:pages"; continue; }
  grep -rIEnq "$secrets" "$dir" && fail "схожий на секрет рядок у $dir"
  # Only XML namespaces may name another site; nothing is loaded from outside.
  external=$(grep -rIEoh "https?://[A-Za-z0-9.-]+" "$dir" | sort -u | grep -vE "^https?://(www\.w3\.org|www\.idpf\.org|purl\.org|reactjs\.org|react\.dev)$" || true)
  [ -n "$external" ] && fail "зовнішні адреси в $dir: $external"
  grep -q "Content-Security-Policy" "$dir/index.html" || fail "немає CSP у $dir/index.html"
  grep -Eq "(src|href)=\"(https?:)?//" "$dir/index.html" && fail "$dir/index.html завантажує щось ззовні"
  for f in sw.js manifest.webmanifest apple-touch-icon.png icons/icon-192.png icons/icon-512.png icons/icon-maskable-512.png data/cwiczenia.json _headers; do
    [ -f "$dir/$f" ] || fail "немає $dir/$f"
  done
done
grep -q '"start_url": "./"' dist/manifest.webmanifest || fail "dist: start_url має бути ./"
grep -q '"start_url": "/Polish_czytanie/"' dist-pages/manifest.webmanifest || fail "dist-pages: start_url має бути /Polish_czytanie/"
grep -q '"scope": "/Polish_czytanie/"' dist-pages/manifest.webmanifest || fail "dist-pages: scope має бути /Polish_czytanie/"
grep -q 'src="/Polish_czytanie/assets/' dist-pages/index.html || fail "dist-pages: скрипти не під /Polish_czytanie/"
grep -q '"/Polish_czytanie/"' dist-pages/assets/*.js || fail "dist-pages: шлях реєстрації service worker не під /Polish_czytanie/"
total=0
for f in dist/assets/*.js dist/assets/*.css; do
  size=$(gzip -c "$f" | wc -c | tr -d ' ')
  total=$((total + size))
  echo "$(basename "$f"): $((size / 1024)) КБ gzip"
done
[ $total -le 122880 ] || fail "JS + CSS $((total / 1024)) КБ gzip > 120 КБ"
audio=$(ls dist/audio/*.mp3 | wc -l | tr -d ' ')
[ "$audio" -eq 63 ] || fail "у dist/audio $audio записів замість 63"

# The author's texts are unchanged: content/ against SOURCE.md5 and, when it is on this Mac, against the course.
(cd content && md5 -r teksty/*.md | awk '{print $1"  "$2}') > build/teksty.md5
grep ' teksty/' content/SOURCE.md5 | diff -q - build/teksty.md5 > /dev/null || fail "тексти в content/teksty змінилися відносно SOURCE.md5"
COURSE=/Users/szubar/Projects/Educational_courses_2026/Krok_po_kroku_2/czytanie/teksty
if [ -d "$COURSE" ]; then
  for f in content/teksty/*.md; do
    cmp -s "$f" "$COURSE/$(basename "$f")" || echo "ПОПЕРЕДЖЕННЯ: $(basename "$f") відрізняється від тексту в курсі Krok_po_kroku_2"
  done
fi
[ $status -eq 0 ] && echo "OK: секретів і зовнішніх ресурсів немає, CSP на місці, шляхи для ./ і /Polish_czytanie/ правильні, тексти автора без змін"
exit $status
