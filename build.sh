#!/bin/bash
# Builds index.html (standalone page for GitHub Pages) from src/.
set -e
cd "$(dirname "$0")"
HEAD=src/head.html
SPLIT=$(grep -n '<canvas id="gl"' "$HEAD" | cut -d: -f1)
{
  echo '<!doctype html>'
  echo '<html lang="en">'
  echo '<head>'
  echo '<meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">'
  echo '<meta name="apple-mobile-web-app-capable" content="yes">'
  echo '<meta name="mobile-web-app-capable" content="yes">'
  echo '<meta name="theme-color" content="#0b0f12">'
  head -n $((SPLIT - 1)) "$HEAD"
  echo '<style>html,body{margin:0;padding:0}:root{padding:0}</style>'
  echo '</head>'
  echo '<body>'
  tail -n +$SPLIT "$HEAD"
  echo '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
  echo '<script>'
  for f in src/01_util.js src/02_track.js src/03_route.js src/04_world.js src/05_scenery.js src/05b_detail.js src/06_models.js src/06b_diesel.js src/07_train.js src/08_physics.js src/09_audio.js src/10_sky_fx.js src/11_ui.js src/11b_net.js src/12_main.js; do cat "$f"; echo; done
  echo '</script>'
  echo '</body>'
  echo '</html>'
} > index.html
echo "built index.html ($(wc -c < index.html) bytes)"
