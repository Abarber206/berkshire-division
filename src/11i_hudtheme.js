/* ============================================================================
   HUD themes and the cursor.
   Each engine dresses the HUD in its own colours: panels, lever knobs, keys,
   gauge bezels and faces, the nameplate in the speed box, and the mouse cursor.
   The theme follows the engine actually on the rails, so a live swap, a load
   or the holiday finish restyle the HUD on the next HUD tick.
   ========================================================================== */
'use strict';

/* g: what the gauge canvas paints with. css: custom properties set on #hud. */
const HUD_THEMES = {
  // Nickel Plate Road 765: the original night-steel and brass
  nkp: {
    name: 'Nickel Plate brass',
    css: { steel: '#0e1317', 'steel-2': '#172027', rule: '#2c3a44', ink: '#dfe4e6', 'ink-dim': '#8d9aa2', brass: '#cfa651', 'brass-deep': '#7c6230',
      panel: 'rgba(14,19,23,.74)', radius: '6px', knob: 'linear-gradient(#f0d38a,#b88c35 55%,#7d5d22)', 'knob-edge': '#5d461b',
      key: 'linear-gradient(#212c33,#141b20)', 'key-edge': '#33424c', 'key-on': 'linear-gradient(#f1d58c,#c09238)', 'key-on-ink': '#1a1307' },
    g: { bezel: ['#f6e7b8', '#c9a24f', '#6d531f'], face: '#efe9d6', tick: '#1c1c1c', label: '#3a3a3a', needle: '#151515', needle2: '#c0281e', hub: '#222',
      acc: '#cfa651', dim: '#8d9aa2', txt: '#dfe4e6', cap: '#6d531f', glass: '#0d1418' },
    cur: { fill: '#0e1317', edge: '#cfa651', lamp: '#ffe9a8' },
  },
  // Pere Marquette 1225: nickel-plated hardware on a deep lake blue
  pm: {
    name: 'Pere Marquette nickel',
    css: { steel: '#0c1420', 'steel-2': '#14202f', rule: '#2c3f55', ink: '#e4eaf0', 'ink-dim': '#8fa0b2', brass: '#c3d0da', 'brass-deep': '#5f6f7d',
      panel: 'rgba(11,19,31,.76)', radius: '5px', knob: 'linear-gradient(#ffffff,#b9c6cf 50%,#66737d)', 'knob-edge': '#3c4852',
      key: 'linear-gradient(#1d2a3a,#111a26)', 'key-edge': '#2f4258', 'key-on': 'linear-gradient(#f4f8fb,#a9b9c5)', 'key-on-ink': '#0c1420' },
    g: { bezel: ['#ffffff', '#aeb9c1', '#4a565f'], face: '#f2f1eb', tick: '#1a2230', label: '#33415a', needle: '#111826', needle2: '#c0281e', hub: '#1a2230',
      acc: '#c3d0da', dim: '#8fa0b2', txt: '#e4eaf0', cap: '#56626c', glass: '#0b131d' },
    cur: { fill: '#0c1420', edge: '#d6e0e7', lamp: '#bfe3ff' },
  },
  // the Polar Limited holiday finish: evergreen, gold leaf and candy-stripe knobs
  polar: {
    name: 'Polar Limited',
    css: { steel: '#0a1a13', 'steel-2': '#10261c', rule: '#2f5a45', ink: '#f4efe2', 'ink-dim': '#a7bba9', brass: '#e2c066', 'brass-deep': '#8c6b1f',
      panel: 'rgba(9,27,19,.78)', radius: '8px', knob: 'repeating-linear-gradient(135deg,#f6f2e8 0 5px,#c8322a 5px 10px)', 'knob-edge': '#6e1f17',
      key: 'linear-gradient(#173526,#0d2017)', 'key-edge': '#2f5a45', 'key-on': 'linear-gradient(#ee6f61,#a8281e)', 'key-on-ink': '#fff8ea' },
    g: { bezel: ['#fff1c2', '#d9b04f', '#7a5a16'], face: '#f7f2e4', tick: '#1d2a20', label: '#2c4a36', needle: '#14251b', needle2: '#c0281e', hub: '#1d2a20',
      acc: '#e2c066', dim: '#a7bba9', txt: '#f4efe2', cap: '#7a5a16', glass: '#0a1712' },
    cur: { fill: '#b8261d', edge: '#f6f2e8', lamp: '#e2c066' },
  },
  // the wide-cab diesel: charcoal, safety yellow and hazard stripes
  diesel: {
    name: 'Diesel safety yellow',
    css: { steel: '#141618', 'steel-2': '#1d2023', rule: '#3c4248', ink: '#eceae4', 'ink-dim': '#9a9d9f', brass: '#f2c230', 'brass-deep': '#7a6110',
      panel: 'rgba(20,22,24,.82)', radius: '2px', knob: 'linear-gradient(#ffe066,#e0a800 55%,#8a6500)', 'knob-edge': '#4d3a00',
      key: 'linear-gradient(#2a2d30,#18191b)', 'key-edge': '#44494e', 'key-on': 'linear-gradient(#ffe066,#e8b000)', 'key-on-ink': '#141618' },
    g: { bezel: ['#6a6e72', '#2c2f32', '#0f1011'], face: '#f1f0ea', tick: '#141618', label: '#3a3c3e', needle: '#141618', needle2: '#d0261a', hub: '#141618',
      acc: '#f2c230', dim: '#9a9d9f', txt: '#eceae4', cap: '#2c2f32', glass: '#0e0f10' },
    cur: { fill: '#f2c230', edge: '#141618', lamp: '#ffffff' },
  },
  // E5 Shinkansen: a glass cockpit in tokiwa green with the hayate pink stripe
  e5: {
    name: 'Shinkansen glass',
    css: { steel: '#071416', 'steel-2': '#0d2023', rule: '#1f5d55', ink: '#eaf7f3', 'ink-dim': '#8fb5ad', brass: '#34c79a', 'brass-deep': '#17694f',
      panel: 'rgba(6,20,22,.72)', radius: '12px', knob: 'linear-gradient(#ffffff,#d9e5e3 55%,#98aeab)', 'knob-edge': '#4f6764',
      key: 'linear-gradient(#11292b,#0a1b1d)', 'key-edge': '#1f5d55', 'key-on': 'linear-gradient(#5fe0b8,#20a77d)', 'key-on-ink': '#04130f' },
    g: { bezel: ['#7d9290', '#2f3f40', '#111a1b'], face: '#0c1a1c', tick: '#bfe3d8', label: '#7fb5a8', needle: '#eaf7f3', needle2: '#ff4fa3', hub: '#eaf7f3',
      acc: '#34c79a', dim: '#8fb5ad', txt: '#eaf7f3', cap: '#2f3f40', glass: '#061012' },
    cur: { fill: '#f7fbfa', edge: '#0f8a66', lamp: '#ff4fa3' },
  },
  // Acela: midnight blue, brushed silver and a teal line
  acela: {
    name: 'Acela midnight',
    css: { steel: '#0b1120', 'steel-2': '#131b2e', rule: '#34425e', ink: '#e3e9f3', 'ink-dim': '#8c9ab3', brass: '#3fb7c9', 'brass-deep': '#1d6470',
      panel: 'rgba(11,17,32,.76)', radius: '8px', knob: 'linear-gradient(#f1f4f8,#aab4c2 55%,#5b6576)', 'knob-edge': '#343c4a',
      key: 'linear-gradient(#18223a,#0e1526)', 'key-edge': '#34425e', 'key-on': 'linear-gradient(#7fdbe6,#2b9fb1)', 'key-on-ink': '#06121a' },
    g: { bezel: ['#eef2f7', '#9aa5b5', '#3f4858'], face: '#0f1728', tick: '#c6d2e4', label: '#7f93b4', needle: '#ffffff', needle2: '#ff6a4d', hub: '#e3e9f3',
      acc: '#3fb7c9', dim: '#8c9ab3', txt: '#e3e9f3', cap: '#3f4858', glass: '#090f1c' },
    cur: { fill: '#0b1120', edge: '#3fb7c9', lamp: '#ffffff' },
  },
};

/* which theme an engine wears: the holiday finish only dresses the steam engines */
function hudThemeKey(loco, finish) {
  const steam = loco === '765' || loco === '1225';
  if (steam && finish === 'polar') return 'polar';
  if (loco === '1225') return 'pm';
  if (loco === 'diesel' || loco === 'e5' || loco === 'acela') return loco;
  return 'nkp';
}

/* the engine's nameplate in the speed box */
function hudPlate(loco, finish, number) {
  if (loco === 'diesel') return 'AC44 · ' + (number || 4401);
  if (loco === 'e5') return 'E5 · Shinkansen';
  if (loco === 'acela') return 'Acela Express';
  const n = loco === '1225' ? 'PM 1225' : 'NKP 765';
  return finish === 'polar' ? n + ' · Polar' : n;
}

/* ---------------- cursors ---------------- */
// one arrow with a little headlamp at its heel, a filled version for things you can press,
// and an orbit mark while you drag the view round
function cursorSvg(kind, c) {
  const open = "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>";
  const arrow = 'M3 2 L3 24.5 L8.6 19.4 L12.6 28.4 L16.8 26.6 L12.9 17.8 L20.6 17.8 Z';
  if (kind === 'drag') {
    // a curved two-headed arrow round a hub: the view swings round the train
    const arc = 'M7.5 15.5 Q16 23.5 24.5 15.5', heads = 'M3 11.2 L11.6 12.6 L6.4 18.8 Z M29 11.2 L20.4 12.6 L25.6 18.8 Z';
    return open +
      `<path d='${arc}' fill='none' stroke='#000' stroke-opacity='.55' stroke-width='5.6' stroke-linecap='round'/>` +
      `<path d='${heads}' fill='#000' fill-opacity='.55' stroke='#000' stroke-opacity='.55' stroke-width='2.4' stroke-linejoin='round'/>` +
      `<path d='${arc}' fill='none' stroke='${c.edge}' stroke-width='2.6' stroke-linecap='round'/>` +
      `<path d='${heads}' fill='${c.edge}' stroke='${c.edge}' stroke-width='.8' stroke-linejoin='round'/>` +
      `<circle cx='16' cy='12' r='3.6' fill='${c.fill}' stroke='${c.edge}' stroke-width='1.6'/>` +
      `<circle cx='16' cy='12' r='1.3' fill='${c.lamp}'/></svg>`;
  }
  const hot = kind === 'hot';
  const fill = hot ? c.edge : c.fill, edge = hot ? c.fill : c.edge;
  return open +
    `<path d='${arrow}' fill='none' stroke='#000' stroke-opacity='.5' stroke-width='3.6' stroke-linejoin='round' transform='translate(.6 .9)'/>` +
    `<path d='${arrow}' fill='${fill}' stroke='${edge}' stroke-width='1.7' stroke-linejoin='round'/>` +
    `<path d='M5.4 7 L5.4 19 L8.3 16.4' fill='none' stroke='${edge}' stroke-opacity='.55' stroke-width='1'/>` +
    `<circle cx='24.5' cy='25' r='${hot ? 3.6 : 2.6}' fill='${c.lamp}' stroke='#000' stroke-opacity='.6' stroke-width='1'/>` +
    (hot ? `<circle cx='24.5' cy='25' r='5.6' fill='none' stroke='${c.lamp}' stroke-opacity='.55' stroke-width='1.2'/>` : '') +
    '</svg>';
}
function cursorCss(kind, c, fallback) {
  const hot = kind === 'drag' ? '16 12' : '3 2';
  return `url("data:image/svg+xml,${encodeURIComponent(cursorSvg(kind, c))}") ${hot}, ${fallback}`;
}

/* ---------------- applying a theme ---------------- */
const HUDT = { key: '', plate: '', t: HUD_THEMES.nkp };
// the gauge canvas reads its colours from here
let HT = HUD_THEMES.nkp;

HUDT.apply = function (key) {
  const t = HUD_THEMES[key] || HUD_THEMES.nkp;
  HUDT.key = key; HUDT.t = t; HT = t;
  const hud = document.getElementById('hud');
  if (hud && hud.style) {
    for (const k in t.css) hud.style.setProperty('--' + k, t.css[k]);
    hud.dataset.theme = key;
  }
  const root = document.documentElement;
  if (root && root.style) {
    root.style.setProperty('--cur', cursorCss('arrow', t.cur, 'auto'));
    root.style.setProperty('--cur-hot', cursorCss('hot', t.cur, 'pointer'));
    root.style.setProperty('--cur-drag', cursorCss('drag', t.cur, 'grabbing'));
  }
  if (typeof drawLeverTicks === 'function') drawLeverTicks();
};

/* called on every HUD tick: restyle only when the engine or its finish changed */
HUDT.sync = function () {
  const T = GAME.train, loco = T ? T.locoKey : GAME.settings.loco, fin = GAME.settings.finish;
  const key = hudThemeKey(loco, fin);
  if (key !== HUDT.key) HUDT.apply(key);
  const plate = hudPlate(loco, fin, GAME.settings.number);
  if (plate !== HUDT.plate) { HUDT.plate = plate; const p = document.getElementById('hudPlate'); if (p) p.textContent = plate; }
};

// the menu wears the default cursor before any engine is on the rails
HUDT.apply('nkp');
