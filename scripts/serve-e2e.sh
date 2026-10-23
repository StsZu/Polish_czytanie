#!/bin/sh
# Both production builds for the e2e tests, built one after the other (they share public/audio), then served:
# dist at http://localhost:4280/ and dist-pages at http://localhost:4281/Polish_czytanie/.
set -e
cd "$(dirname "$0")/.."
npm run data --silent > /dev/null
npx tsc --noEmit
npx vite build --logLevel warn
npx vite build --mode pages --logLevel warn
npx vite preview --mode pages --port 4281 --strictPort &
exec npx vite preview --port 4280 --strictPort
