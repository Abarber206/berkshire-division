/* ============================================================================
   Weather: what the sky is doing and how it changes. Plain numbers only (no
   three.js, no page), so the spells, the blending and the wet rail can be
   checked headless (tests/weather.test.js).

   Each kind of weather is a set of numbers (cloud cover, cloud base and depth,
   rain or snow, haze, wind...). "Changing" weather walks from kind to kind on
   its own: a spell holds for a few minutes, then the next kind blends in over a
   minute or two, so clouds build before the rain and the sky clears slowly
   after it. The rail gets wet when it rains and dries off afterwards, and wet
   rail is slippery, most of all when the rain has only just started.
   ========================================================================== */
const WX_KINDS = {
  //            cloud: cover 0-1, base and depth (m), strat 0 = heaped cumulus .. 1 = flat sheet, dark = heavy rain-cloud bases
  clear:    { name: 'Clear',    cover: 0.16, base: 1500, thick: 800,  strat: 0,    dark: 0,    dens: 0.8, rain: 0,   snow: 0,   fogK: 1,   haze: 260, sunK: 1,    gray: 0,    wind: 1.4, bolt: 0 },
  fair:     { name: 'Fair',     cover: 0.3,  base: 1400, thick: 1100, strat: 0,    dark: 0.05, dens: 0.9, rain: 0,   snow: 0,   fogK: 1.05, haze: 260, sunK: 1,   gray: 0,    wind: 1.8, bolt: 0 },
  cloudy:   { name: 'Cloudy',   cover: 0.52, base: 1250, thick: 1250, strat: 0.1,  dark: 0.25, dens: 1,   rain: 0,   snow: 0,   fogK: 1.2, haze: 240, sunK: 0.9,  gray: 0.12, wind: 2.4, bolt: 0 },
  overcast: { name: 'Overcast', cover: 0.95, base: 900,  thick: 900,  strat: 0.85, dark: 0.5,  dens: 0.7,   rain: 0,   snow: 0,   fogK: 1.9, haze: 220, sunK: 0.32, gray: 0.55, wind: 2.6, bolt: 0 },
  rain:     { name: 'Rain',     cover: 1,    base: 650,  thick: 1500, strat: 0.7,  dark: 0.75, dens: 1.2, rain: 0.6, snow: 0,   fogK: 2.7, haze: 200, sunK: 0.2,  gray: 0.7,  wind: 3.4, bolt: 0 },
  storm:    { name: 'Thunderstorm', cover: 1, base: 520, thick: 2800, strat: 0.35, dark: 1,    dens: 1.5, rain: 1,   snow: 0,   fogK: 3.1, haze: 200, sunK: 0.12, gray: 0.8,  wind: 6,   bolt: 5 },
  fog:      { name: 'Fog',      cover: 1,    base: 380,  thick: 500,  strat: 1,    dark: 0.3,  dens: 0.9, rain: 0,   snow: 0,   fogK: 50,  haze: 60,  sunK: 0.3,  gray: 0.75,  wind: 0.5, bolt: 0 },
  snow:     { name: 'Snow',     cover: 1,    base: 700,  thick: 1300, strat: 0.8,  dark: 0.45, dens: 1.1, rain: 0,   snow: 0.8, fogK: 3.4, haze: 220, sunK: 0.25, gray: 0.7,  wind: 3,   bolt: 0 },
};
const WX_NUMS = ['cover', 'base', 'thick', 'strat', 'dark', 'dens', 'rain', 'snow', 'fogK', 'haze', 'sunK', 'gray', 'wind', 'bolt'];

/* The menu. Changing and Winter walk on their own; the rest hold one kind. A season decides the
   ground (snow lying in Winter and Snow) and which kinds a changing sky can turn to. */
const WEATHER = {
  changing: { name: 'Changing', sub: 'Sun, cloud, rain, storms', season: 'summer', walk: true },
  winter: { name: 'Winter', sub: 'Changing, with snow', season: 'winter', walk: true },
  clear: { name: 'Clear', sub: 'Dry rail', season: 'summer', kind: 'clear' },
  cloudy: { name: 'Cloudy', sub: 'Big clouds, sun between', season: 'summer', kind: 'cloudy' },
  overcast: { name: 'Overcast', sub: 'Damp rail', season: 'summer', kind: 'overcast' },
  rain: { name: 'Rain', sub: 'Wet rail, sand early', season: 'summer', kind: 'rain' },
  storm: { name: 'Thunderstorm', sub: 'Downpour and lightning', season: 'summer', kind: 'storm' },
  fog: { name: 'Fog', sub: 'Low visibility, damp rail', season: 'summer', kind: 'fog' },
  snow: { name: 'Snow', sub: 'Slippery, low visibility', season: 'winter', kind: 'snow' },
};

/* where a changing sky can go next from each kind, with weights. Rain comes after cloud has built
   up; storms break into rain; fog lifts into cloud or sun */
const WX_NEXT = {
  summer: {
    clear: { fair: 6, cloudy: 2, fog: 0.6 },
    fair: { clear: 3, cloudy: 5, fog: 0.4 },
    cloudy: { fair: 3, overcast: 3, rain: 2, storm: 1.2 },
    overcast: { cloudy: 2.5, rain: 4, fog: 1.2, storm: 0.8 },
    rain: { overcast: 4, cloudy: 3, storm: 1.5 },
    storm: { rain: 6, overcast: 2 },
    fog: { fair: 3, cloudy: 3, overcast: 2 },
    snow: { overcast: 1 },
  },
  winter: {
    clear: { fair: 5, cloudy: 2 },
    fair: { clear: 3, cloudy: 5 },
    cloudy: { fair: 3, overcast: 4, snow: 2.5 },
    overcast: { cloudy: 2, snow: 5, fog: 1.2 },
    snow: { overcast: 4, cloudy: 2 },
    fog: { cloudy: 3, overcast: 2 },
    rain: { overcast: 1 }, storm: { snow: 1 },
  },
};
/* how long a spell holds, and how long the change to the next one takes (real seconds) */
const WX_HOLD = { clear: [300, 600], fair: [240, 540], cloudy: [200, 420], overcast: [180, 360], rain: [200, 420], storm: [120, 240], fog: [180, 360], snow: [240, 480] };
const WX_BLEND = [90, 170];

/* the weather as it stands: the spell blending from `from` to `to`, t seconds into a blend of dur,
   then holding for hold seconds. P is the blend of the two kinds' numbers. wet is how wet the rail
   is (0-1), wash how long the rain has been washing it clean (0-1). */
const WX = { key: 'changing', season: 'summer', walk: true, from: 'fair', to: 'fair', t: 1, dur: 1, hold: 300, seed: 1, P: {}, wet: 0, wash: 0, flash: 0, boltIn: 20, bolts: [], changed: null };

function wxRand() { WX.seed = (WX.seed * 16807) % 2147483647; return (WX.seed - 1) / 2147483646; }
function wxRange(r) { return r[0] + (r[1] - r[0]) * wxRand(); }
function wxPick(table) {
  let tot = 0; for (const k in table) tot += table[k];
  let x = wxRand() * tot;
  for (const k in table) { x -= table[k]; if (x <= 0) return k; }
  return Object.keys(table)[0];
}
const wxEase = t => t * t * (3 - 2 * t);
function wxBlend(a, b, t, out = {}) {
  const A = WX_KINDS[a], B = WX_KINDS[b], e = wxEase(Math.min(1, Math.max(0, t)));
  for (const k of WX_NUMS) out[k] = A[k] + (B[k] - A[k]) * e;
  return out;
}
/* pick the menu's weather. A changing sky starts in a settled kind (with a wet rail if it starts wet) */
function wxSet(key, seed) {
  const M = WEATHER[key] || WEATHER.changing;
  WX.key = WEATHER[key] ? key : 'changing'; WX.season = M.season; WX.walk = !!M.walk;
  if (seed !== undefined) WX.seed = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  let k = M.kind;
  if (!k) k = M.season === 'winter' ? wxPick({ clear: 2, fair: 3, cloudy: 3, overcast: 2, snow: 2 }) : wxPick({ clear: 3, fair: 4, cloudy: 3, overcast: 1, rain: 0.6 });
  WX.from = WX.to = k; WX.t = WX.dur = 1; WX.hold = M.walk ? wxRange(WX_HOLD[k]) : 1e9;
  WX.wet = wxWetTarget(WX_KINDS[k]); WX.wash = WX_KINDS[k].rain > 0.3 ? 0.5 : 0;
  WX.flash = 0; WX.bolts = []; WX.boltIn = 8 + 20 * wxRand(); WX.changed = null;
  wxBlend(k, k, 1, WX.P);
  return WX;
}
/* the wetness the rail settles at under steady weather of this kind */
const wxWetTarget = P => Math.min(1, Math.max(P.rain * 1.6, P.fogK > 4 ? 0.45 : 0, P.gray > 0.5 && !P.snow ? 0.25 : 0));
/* one step of dt real seconds: the spell runs on, the next kind blends in, the rail wets or dries.
   sunLight (0-1) is how much sun is reaching the rail, which dries it faster */
function wxStep(dt, sunLight = 1) {
  WX.changed = null;
  if (WX.t < WX.dur) WX.t = Math.min(WX.dur, WX.t + dt);
  else if (WX.walk) {
    WX.hold -= dt;
    if (WX.hold <= 0) {
      const next = wxPick(WX_NEXT[WX.season][WX.to] || { fair: 1 });
      WX.from = WX.to; WX.to = next; WX.t = 0; WX.dur = wxRange(WX_BLEND); WX.hold = wxRange(WX_HOLD[next]);
      WX.changed = { from: WX.from, to: next };
    }
  }
  wxBlend(WX.from, WX.to, WX.t / WX.dur, WX.P);
  const P = WX.P, target = wxWetTarget(P);
  // rain wets the rail in under a minute; it dries in a quarter of an hour, faster in sunshine
  if (target > WX.wet) WX.wet = Math.min(target, WX.wet + dt * (0.004 + 0.03 * P.rain));
  else WX.wet = Math.max(target, WX.wet - dt * (0.0006 + 0.0016 * sunLight * P.sunK));
  // steady rain washes the grime off the railhead; the film builds back as the rail dries
  WX.wash = P.rain > 0.3 ? Math.min(1, WX.wash + dt * P.rain / 240) : Math.max(0, WX.wash - dt / 900);
  // lightning: a stroke every few seconds to a minute in a storm, each a flicker of two or three flashes
  WX.flash = Math.max(0, WX.flash - dt * 6);
  if (P.bolt > 0.2) {
    WX.boltIn -= dt * P.bolt / 5;
    if (WX.boltIn <= 0) {
      WX.boltIn = 4 + 40 * wxRand() * wxRand();
      const dist = 600 + 6000 * wxRand(), n = 1 + Math.floor(wxRand() * 3);
      WX.bolts.push({ at: 0, dist, az: wxRand() * Math.PI * 2, n, k: Math.min(1, 1400 / dist) * (0.6 + 0.4 * wxRand()), heard: false });
    }
  }
  for (const b of WX.bolts) {
    const pre = b.at; b.at += dt;
    for (let i = 0; i < b.n; i++) { const ti = i * 0.11; if (pre <= ti && b.at > ti) WX.flash = Math.max(WX.flash, b.k * (i ? 0.7 : 1)); }
  }
  WX.bolts = WX.bolts.filter(b => b.at < b.dist / 343 + 8);
  return WX;
}
/* adhesion on the rail: dry 0.27; a film of water on a dirty railhead is the worst (about 0.16),
   and a long rain washes it a little better; snow and frost 0.15 */
const WX_DRY_MU = 0.27;
function wxMu(P = WX.P, wet = WX.wet, wash = WX.wash, winter = WX.season === 'winter') {
  let mu = WX_DRY_MU * (1 - 0.42 * wet * (1 - 0.32 * wash));
  if (P.snow > 0) mu = Math.min(mu, WX_DRY_MU - 0.15 * Math.min(1, P.snow / 0.8));
  if (winter) mu = Math.min(mu, 0.235);
  return mu;
}
/* the rail's condition for the HUD and toasts */
function wxRailWord(mu) { return mu > 0.25 ? 'dry' : mu > 0.215 ? 'damp' : mu > 0.18 ? 'wet' : 'slippery'; }
function wxName() { return WX_KINDS[WX.t / WX.dur < 0.5 ? WX.from : WX.to].name; }
function wxOut() { return { key: WX.key, from: WX.from, to: WX.to, t: +WX.t.toFixed(2), dur: +WX.dur.toFixed(2), hold: +WX.hold.toFixed(1), seed: WX.seed, wet: +WX.wet.toFixed(3), wash: +WX.wash.toFixed(3) }; }
function wxIn(d) {
  if (!d || !WEATHER[d.key]) return false;
  wxSet(d.key);
  if (WX_KINDS[d.from] && WX_KINDS[d.to]) { WX.from = d.from; WX.to = d.to; }
  WX.t = +d.t || 0; WX.dur = Math.max(1, +d.dur || 1); WX.hold = WX.walk ? +d.hold || 60 : 1e9;
  if (d.seed) WX.seed = d.seed;
  WX.wet = Math.min(1, Math.max(0, +d.wet || 0)); WX.wash = Math.min(1, Math.max(0, +d.wash || 0));
  wxBlend(WX.from, WX.to, WX.t / WX.dur, WX.P);
  return true;
}

/* ---- the cloud map: where the clouds are, the same numbers for the GPU (as a texture) and for
   the sun's shadow here (wxCoverAt). A tileable noise, levelled so its values are spread evenly
   from 0 to 1: then the share of sky under cloud is just the cover number. ---- */
const WX_MAP = { n: 128, tile: 26000, a: null, b: null };
function wxHash(i, j, s) { let h = (i * 374761393 + j * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function wxVNoise(x, y, per, s) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const h = (a, b) => wxHash(((a % per) + per) % per, ((b % per) + per) % per, s);
  return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
}
function wxEqualize(a) {
  const idx = Array.from(a.keys()).sort((p, q) => a[p] - a[q]), out = new Float32Array(a.length);
  idx.forEach((k, r) => { out[k] = r / (a.length - 1); });
  return out;
}
function wxBuildMap() {
  const N = WX_MAP.n, A = new Float32Array(N * N), B = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let a = 0, b = 0, amp = 1, f = 7;
    for (let o = 0; o < 3; o++) { a += amp * wxVNoise(x * f / N, y * f / N, f, 11 + o); amp *= 0.5; f *= 2; }
    amp = 1; f = 13;
    for (let o = 0; o < 2; o++) { b += amp * wxVNoise(x * f / N, y * f / N, f, 31 + o); amp *= 0.5; f *= 2; }
    A[y * N + x] = a; B[y * N + x] = b;
  }
  // the big field decides where the cloud is; small lumps break its edges up into separate clouds
  const C = new Float32Array(N * N), Ae = wxEqualize(A), Be = wxEqualize(B);
  for (let i = 0; i < C.length; i++) C[i] = Ae[i] * 0.72 + Be[i] * 0.28;
  WX_MAP.a = wxEqualize(C); WX_MAP.b = Be;
  return WX_MAP;
}
/* bilinear, wrapping: what the GPU's linear filter gives for texel centres at (i + 0.5) / n */
function wxMapAt(u, v, ch = WX_MAP.a) {
  const N = WX_MAP.n; let x = u * N - 0.5, y = v * N - 0.5;
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, w = k => ((k % N) + N) % N;
  const g = (a, b) => ch[w(b) * N + w(a)];
  return (g(i, j) * (1 - fx) + g(i + 1, j) * fx) * (1 - fy) + (g(i, j + 1) * (1 - fx) + g(i + 1, j + 1) * fx) * fy;
}
/* how much cloud (0-1) stands over world point (x, z) for cover c; the shader uses the same edges */
const wxCoverEdge = c => [1 - c * 1.17, 1.17 - c * 1.17];
function wxCoverAt(x, z, cover, drift = { x: 0, z: 0 }) {
  const m = wxMapAt((x + drift.x) / WX_MAP.tile, (z + drift.z) / WX_MAP.tile);
  const [a, b] = wxCoverEdge(cover); const t = Math.min(1, Math.max(0, (m - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
/* the headlight beam shows in the air when there is haze, rain or snow to light up */
const wxBeam = () => Math.min(0.045, WX.P.gray * 0.03 + WX.P.rain * 0.02 + WX.P.snow * 0.02 + (WX.P.fogK > 3 ? 0.012 : 0));
wxSet('changing');
