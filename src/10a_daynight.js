/* ============================================================================
   Day and night: where the sun and moon are at a given hour, and what the sky,
   light, fog and lamps look like for that height of the sun. Plain numbers only,
   so the clock can be checked without a page (tests/daynight.test.js).
   ========================================================================== */
const DN = {
  lat: 41,     // Ohio and the Laurel Highlands both sit near 41 N (Fort Wayne 41.1, Altoona 40.5)
  dec: 8,      // late April or mid August: a 13 h 6 min day, 57 degree noon sun
  // the clock starts here for each choice in the menu (hours). Morning, Midday, Golden hour and
  // Night put the sun (or moon) where the old fixed looks had it, so jobs and photos keep their light
  starts: {
    dawn: { name: 'Dawn', sub: 'First light, 5:15', h: 5.25 },
    morning: { name: 'Morning', sub: 'Low sun, 6:40', h: 6 + 40 / 60 },
    noon: { name: 'Midday', sub: 'High sun, noon', h: 12 },
    golden: { name: 'Golden hour', sub: 'Sun on the drivers, 5:55', h: 17 + 55 / 60 },
    dusk: { name: 'Dusk', sub: 'Lamps lit, 6:50', h: 18 + 50 / 60 },
    night: { name: 'Night', sub: 'Headlight & firebox, 10:30', h: 22.5 },
  },
  // how fast the clock runs (game seconds per real second)
  rates: {
    hold: { name: 'Hold', sub: 'Time stands still', k: 0 },
    real: { name: 'Real time', sub: '24 hours a day', k: 1 },
    x30: { name: 'Fast', sub: 'A day in 48 min', k: 30 },
    x120: { name: 'Faster', sub: 'A day in 12 min', k: 120 },
  },
};
const D2R = Math.PI / 180;

/* elevation and azimuth (degrees; azimuth from north through east) of a body with declination dec
   at local solar hour h. Hour angle 0 is due south at noon. */
function dnBody(h, dec) {
  const H = (h - 12) * 15 * D2R, f = DN.lat * D2R, d = dec * D2R;
  const el = Math.asin(clamp(Math.sin(f) * Math.sin(d) + Math.cos(f) * Math.cos(d) * Math.cos(H), -1, 1));
  let az = Math.atan2(-Math.sin(H), Math.tan(d) * Math.cos(f) - Math.sin(f) * Math.cos(H)) / D2R;
  if (az < 0) az += 360;
  return { el: el / D2R, az };
}
const dnSun = h => dnBody(h, DN.dec);
// a full moon: opposite the sun, rising at sunset and setting at sunrise, so every night is moonlit
const dnMoon = h => dnBody(h + 12, -DN.dec);
/* unit vector toward a body: x east, y up, -z north (the world's own axes) */
function dnDir(b, out) {
  const el = b.el * D2R, az = b.az * D2R;
  out.x = Math.sin(az) * Math.cos(el); out.y = Math.sin(el); out.z = -Math.cos(az) * Math.cos(el);
  return out;
}
/* the hour (0-24) the sun stands at elevation el, morning or evening */
function dnHourAt(el, evening) {
  const f = DN.lat * D2R, d = DN.dec * D2R;
  const c = (Math.sin(el * D2R) - Math.sin(f) * Math.sin(d)) / (Math.cos(f) * Math.cos(d));
  const H = Math.acos(clamp(c, -1, 1)) / D2R / 15;
  return evening ? 12 + H : 12 - H;
}

/* The look of the sky by the sun's elevation (degrees). Colours are sRGB. The 6.5, 13 and 56 degree
   keys are the old Golden hour, Morning and Midday looks; -18 is the old Night. Twilight is filled in
   between: blue hour, then the orange band and red sun at the horizon. */
const DN_KEYS = [
  { el: -18, top: 0x03070f, hor: 0x162236, sun: 0x8ea6d6, sunI: 0, hemiS: 0x304060, hemiG: 0x141210, hemiI: 0.16, fog: 0x0a0f18, fogD: 0.00036, exp: 1.25, cloud: 0x1a2030, smoke: [0.25, 0.245, 0.24] },
  { el: -10, top: 0x050c1c, hor: 0x1c2c48, sun: 0x6a5a8a, sunI: 0, hemiS: 0x324464, hemiG: 0x151311, hemiI: 0.17, fog: 0x101826, fogD: 0.00034, exp: 1.25, cloud: 0x1e2436, smoke: [0.28, 0.275, 0.27] },
  { el: -5, top: 0x10264c, hor: 0x5c5c78, sun: 0xd0603a, sunI: 0, hemiS: 0x48587e, hemiG: 0x1c1915, hemiI: 0.24, fog: 0x30354a, fogD: 0.0003, exp: 1.22, cloud: 0x4a3e56, smoke: [0.38, 0.36, 0.36] },
  { el: -1.5, top: 0x23457a, hor: 0xb08070, sun: 0xff6a30, sunI: 0, hemiS: 0x7584aa, hemiG: 0x2e2a22, hemiI: 0.4, fog: 0x8a7470, fogD: 0.00025, exp: 1.15, cloud: 0xc08878, smoke: [0.62, 0.52, 0.48] },
  { el: 1.5, top: 0x3a5a90, hor: 0xe69c62, sun: 0xff8a40, sunI: 1.1, hemiS: 0x8e9cc4, hemiG: 0x4a3c2a, hemiI: 0.65, fog: 0xc8987a, fogD: 0.00022, exp: 1.1, cloud: 0xffb48a, smoke: [0.95, 0.75, 0.6] },
  { el: 6.5, top: 0x4c6ea6, hor: 0xf3ae6e, sun: 0xffad63, sunI: 2.3, hemiS: 0x9fb2d6, hemiG: 0x584430, hemiI: 0.8, fog: 0xe2b58e, fogD: 0.0002, exp: 1.05, cloud: 0xffe0c0, smoke: [1.05, 0.86, 0.7] },
  { el: 13, top: 0x5f93d6, hor: 0xe9d3b4, sun: 0xffdcae, sunI: 2.7, hemiS: 0xb9cde8, hemiG: 0x4f4836, hemiI: 0.8, fog: 0xd9cfbe, fogD: 0.00017, exp: 1.0, cloud: 0xfff6ea, smoke: [1, 0.93, 0.84] },
  { el: 56, top: 0x3e7dcf, hor: 0xbcd4ea, sun: 0xfff4e4, sunI: 2.6, hemiS: 0xc4d8f0, hemiG: 0x5d5845, hemiI: 0.6, fog: 0xc6d5e2, fogD: 0.00013, exp: 0.95, cloud: 0xffffff, smoke: [1, 1, 1] },
];
const DN_COLS = ['top', 'hor', 'sun', 'hemiS', 'hemiG', 'fog', 'cloud'], DN_NUMS = ['sunI', 'hemiI', 'fogD', 'exp'];
const mixHex = (a, b, t) => {
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t)), g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)), bl = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | bl;
};
function dnLook(el, out = {}) {
  const K = DN_KEYS;
  let i = 0; while (i < K.length - 2 && el > K[i + 1].el) i++;
  const a = K[i], b = K[i + 1], t = smooth(0, 1, clamp((el - a.el) / (b.el - a.el), 0, 1));
  for (const k of DN_COLS) out[k] = mixHex(a[k], b[k], t);
  for (const k of DN_NUMS) out[k] = lerp(a[k], b[k], t);
  out.smoke = [0, 1, 2].map(j => lerp(a.smoke[j], b.smoke[j], t));
  return out;
}
/* 0 by day, 1 at night: when lamps, windows and the headlight's full beam come on. House lights
   go on around sunset and are all lit by the end of civil twilight. */
const dnDark = el => 1 - smooth(-7, 2, el);
/* how much starlight shows (0-1) */
const dnStars = el => 1 - smooth(-15, -6, el);
/* moonlight strength, 0-1: the moon has to be up and the sky dark */
const dnMoonK = (sunEl, moonEl) => smooth(-1, 10, moonEl) * (1 - smooth(-10, -1.5, sunEl));
/* dawn chorus: birds at their loudest from first light until the sun is a few degrees up, in the morning only */
const dnChorus = (h, el) => (h < 12 ? smooth(-10, -4, el) * (1 - smooth(4, 14, el)) : 0);
const dnWrap = h => ((h % 24) + 24) % 24;
function dnFmt(h) {
  h = dnWrap(h); const H = Math.floor(h), m = Math.floor((h - H) * 60);
  return `${H % 12 || 12}:${String(m).padStart(2, '0')} ${H < 12 ? 'AM' : 'PM'}`;
}
