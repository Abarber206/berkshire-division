/* HUD themes and cursors (src/11i_hudtheme.js): every engine gets a complete theme, and applying one dresses #hud and the cursor */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load() {
  const props = (o) => ({ setProperty(k, v) { o[k] = v; } });
  const hudVars = {}, rootVars = {}, plate = { textContent: '' };
  const hud = { style: props(hudVars), dataset: {} };
  const ctx = {
    console, encodeURIComponent,
    document: { getElementById: id => (id === 'hud' ? hud : id === 'hudPlate' ? plate : null), documentElement: { style: props(rootVars) } },
    GAME: { train: null, settings: { loco: '765', finish: 'standard', number: 4401 } },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', '11i_hudtheme.js'), 'utf8') + '\nthis.HUD_THEMES = HUD_THEMES; this.HUDT = HUDT; this.hudThemeKey = hudThemeKey; this.hudPlate = hudPlate; this.cursorSvg = cursorSvg; this.getHT = () => HT;', ctx);
  return { ctx, hud, hudVars, rootVars, plate };
}

test('each engine and the holiday finish map to their own theme', () => {
  const { ctx } = load();
  const k = ctx.hudThemeKey;
  assert.strictEqual(k('765', 'standard'), 'nkp');
  assert.strictEqual(k('765', 'white'), 'nkp');
  assert.strictEqual(k('1225', 'black'), 'pm');
  assert.strictEqual(k('765', 'polar'), 'polar');
  assert.strictEqual(k('1225', 'polar'), 'polar');
  assert.strictEqual(k('diesel', 'polar'), 'diesel', 'the holiday finish is steam only');
  assert.strictEqual(k('e5', 'standard'), 'e5');
  assert.strictEqual(k('acela', 'polar'), 'acela');
  assert.strictEqual(k('nonsense', 'standard'), 'nkp');
  assert.strictEqual(new Set(['765', '1225', 'diesel', 'e5', 'acela'].map(l => k(l, 'standard'))).size, 5, 'no two engines share a HUD');
});

test('every theme defines the same colours as the default, so nothing falls back by accident', () => {
  const { ctx } = load(), T = ctx.HUD_THEMES, base = T.nkp;
  for (const key in T) {
    for (const part of ['css', 'g', 'cur']) assert.deepStrictEqual(Object.keys(T[key][part]).sort(), Object.keys(base[part]).sort(), `${key}.${part}`);
    assert.strictEqual(T[key].g.bezel.length, 3, key + ' bezel stops');
  }
});

test('applying a theme sets the HUD custom properties, the theme attribute, the gauge palette and three cursors', () => {
  const { ctx, hud, hudVars, rootVars, plate } = load();
  ctx.GAME.train = { locoKey: 'diesel' }; ctx.GAME.settings.number = 4407;
  ctx.HUDT.sync();
  assert.strictEqual(hud.dataset.theme, 'diesel');
  assert.strictEqual(hudVars['--brass'], ctx.HUD_THEMES.diesel.css.brass);
  assert.strictEqual(ctx.getHT(), ctx.HUD_THEMES.diesel);
  assert.strictEqual(plate.textContent, 'AC44 · 4407');
  for (const v of ['--cur', '--cur-hot', '--cur-drag']) assert.match(rootVars[v], /^url\("data:image\/svg\+xml,[^"]+"\) \d+ \d+, \w+$/, v);
  // the train on the rails wins over the menu setting, and the finish follows a live change
  ctx.GAME.train = { locoKey: '1225' }; ctx.GAME.settings.loco = 'diesel'; ctx.GAME.settings.finish = 'polar';
  ctx.HUDT.sync();
  assert.strictEqual(hud.dataset.theme, 'polar');
  assert.strictEqual(plate.textContent, 'PM 1225 · Polar');
});

test('cursor images are small, well-formed SVG with the hotspot inside', () => {
  const { ctx } = load();
  for (const key in ctx.HUD_THEMES) for (const kind of ['arrow', 'hot', 'drag']) {
    const svg = ctx.cursorSvg(kind, ctx.HUD_THEMES[key].cur);
    assert.match(svg, /^<svg [^>]*width='32' height='32'[^>]*>.*<\/svg>$/, `${key} ${kind}`);
    assert.ok(!svg.includes('undefined'), `${key} ${kind} has every colour`);
    const opens = (svg.match(/<(path|circle|ellipse)\b/g) || []).length, closes = (svg.match(/\/>/g) || []).length;
    assert.strictEqual(opens, closes, `${key} ${kind} shapes are closed`);
  }
});
