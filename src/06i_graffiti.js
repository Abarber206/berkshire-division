/* =================== GRAFFITI =================== */
/* Spray paint on the freight cars. About two cars in five carry some: a big piece on one or both sides, sometimes
   a throw-up or a hand tag beside it, and now and then the ghost of an older tag the paint has faded over. Every
   piece is drawn here, from nothing, on a canvas: the writer's name is made up from letters, and the style, colours,
   size and place on the car all come from the car's own number, so a car looks the same after a save and resume,
   on every player's screen in a multiplayer room and each time it is rebuilt, while no two cars look alike.
   The paint is a thin sheet laid on the car's side sheets (3 mm proud of them, under the posts, ribs, ladders and
   grab irons, which stand out in front of it) and it keeps clear of the reporting marks and the data stencil. On the
   tank car it is bent around the barrel, facet by facet, so it lies flat on every face of the 32-sided barrel. */
var GRAFFITI = { rate: 0.4, pxm: 150 };

function gfHash(type, num) {
  let h = 2166136261 >>> 0; const s = 'gf:' + type + ':' + num;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
const GF_BAD = /SEX|NAZ|KKK|DIK|DIC|FAG|NIG|NEG|NIK|JEW|PIS|POO|ASS|TIT|RAP|SLUT|HOE|GOD|KIL|DED|DIE|WAR|ISIS|KYK|COK|CUM|FUK|FUC|PUS|VAG|BOOB|NAS|GAY|DAM|WTF|AID|SUK|SUC|POT|WEED|METH|GUN|HIT|SS$|^SS|^HO|HO$|SHT|SHIT|PENI|NUT|JIZ|ANAL|BUT|DOP/;
/* a made-up writer's name, 3 to 6 letters, built from sounds that look good in spray paint */
function gfName(r, min = 3, max = 6) {
  const C = 'KZRSTDVMNXBJLPGHWQ', V = 'AEOYIU', CC = ['ST', 'SK', 'KR', 'TR', 'DR', 'ZR', 'SM', 'KL', 'VR', 'BR', 'GR', 'PR', 'ZK', 'XR', 'SN'];
  const pats = ['CVC', 'CVCV', 'CVCC', 'VCVC', 'CVCVC', 'WVC', 'WVCV', 'VCW', 'CVCW', 'WVCVC', 'CVVC'];
  const p = a => a[(r() * a.length) | 0];
  let name = '';
  for (let t = 0; t < 40; t++) {
    let s = '';
    for (const c of p(pats)) s += c === 'C' ? p(C) : c === 'V' ? p(V) : p(CC);
    if (r() < 0.25) s += p(['X', 'Z', 'K', 'S', 'R', 'E', 'O', '1', '2', '3']);
    if (GF_BAD.test(s) || /(.)\1\1/.test(s)) continue;
    if (s.length >= min && s.length <= max) return s;
    if (!name || Math.abs(s.length - max) < Math.abs(name.length - max)) name = s;
  }
  return (name || 'ZEKO').slice(0, max);
}
/* colour schemes: two fill colours, the outline, the 3D shadow, the second outline, a cloud behind */
const GF_PAL = [
  ['#f4c430', '#e8542a', '#161616', '#5b2a86', '#ffffff', '#3a7bd5'],
  ['#5fd3e8', '#2a6fd6', '#0d1a33', '#e83a8c', '#f2f2f2', '#ffd23f'],
  ['#9be35a', '#2f9a4a', '#111611', '#f0e14a', '#ffffff', '#24324a'],
  ['#ff7ac0', '#9d4edd', '#1a0f24', '#36c9c6', '#ffffff', '#ffe066'],
  ['#e9ecef', '#8f99a3', '#111111', '#d6322e', '#ffffff', '#1d3557'],
  ['#ff9f1c', '#ffd27a', '#2b2d42', '#2ec4b6', '#fff8e8', '#6a2c70'],
  ['#ef476f', '#ffd166', '#073b4c', '#06d6a0', '#ffffff', '#118ab2'],
  ['#e63946', '#f1faee', '#1d3557', '#457b9d', '#ffffff', '#f4a261'],
  ['#b8f2e6', '#5e60ce', '#1b1b3a', '#ff595e', '#ffffff', '#ffca3a'],
  ['#ffef5a', '#ff8c42', '#3d1f0f', '#c0392b', '#ffffff', '#2d6a4f'],
  ['#c77dff', '#48bfe3', '#10002b', '#80ffdb', '#ffffff', '#ff6d00'],
  ['#f5f5f5', '#f5f5f5', '#c1121f', '#2b2b2b', '#111111', '#669bbc'],
];
const GF_FONTS = ['"Arial Black", "Arial Bold", Impact, sans-serif', 'Impact, "Arial Black", "Haettenschweiler", sans-serif',
  '"Trebuchet MS", "Verdana", sans-serif', '"Verdana", "Tahoma", sans-serif', 'Georgia, "Times New Roman", serif', '"Comic Sans MS", "Chalkboard SE", sans-serif'];
const GF_HAND = ['"Segoe Script", "Brush Script MT", "Bradley Hand", cursive', '"Brush Script MT", "Segoe Script", cursive',
  '"Comic Sans MS", "Chalkboard SE", cursive', '"Marker Felt", "Comic Sans MS", cursive', 'italic 700 "Trebuchet MS", sans-serif'];
const GF_SPRAY = ['#151515', '#f2f2f2', '#c8ccd0', '#d62828', '#1e6fd9', '#2a9d4b', '#f2c14e', '#ff5fa2', '#7b2cbf'];

function gfCanvas(W, H) { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; }

/* lays the letters of a word out along a line: each its own size, tilt and bounce, overlapping a little */
function gfLayout(g, word, font, fs, W, H, o) {
  const L = [];
  let total = 0;
  for (const ch of word) {
    const sc = 1 + (o.r() - 0.5) * o.size, rot = (o.r() - 0.5) * o.tilt;
    g.font = `${o.weight || 900} ${Math.round(fs * sc)}px ${font}`;
    const w = +g.measureText(ch).width || fs * 0.6 * sc;
    L.push({ ch, sc, rot, w, dy: (o.r() - 0.5) * o.bounce * fs });
    total += w * (1 - o.overlap);
  }
  // fit the letters and everything drawn round them (outlines, the 3D block, a tilt) inside the sheet, both ways
  const pad = o.pad || 0, fitW = (W * o.wide) / Math.max(1, total + pad * fs), fitH = (H * 0.94) / (fs * (0.74 * (1 + o.size / 2) + o.bounce + pad + o.tilt * 0.25));
  const fit = Math.min(o.grow || 1, fitW, fitH), x0 = (W - total * fit) / 2;
  let x = x0;
  for (const l of L) { l.x = x + l.w * fit / 2; l.y = H * o.base + l.dy * fit; l.w *= fit; x += l.w * (1 - o.overlap); }
  return { L, fs: fs * fit, x0, x1: x };
}
function gfEach(g, lay, font, weight, fn) {
  for (const l of lay.L) {
    g.save(); g.translate(l.x, l.y); g.rotate(l.rot);
    g.font = `${weight || 900} ${Math.round(lay.fs * l.sc)}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    fn(l); g.restore();
  }
}
function gfStar(g, x, y, R, col) {
  g.save(); g.fillStyle = col; g.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? R * 0.22 : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill(); g.restore();
}
function gfArrow(g, x, y, ang, len, lw, cOut, cIn) {
  const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len, cx = x + Math.cos(ang + 0.6) * len * 0.6, cy = y + Math.sin(ang + 0.6) * len * 0.6;
  const head = (w, col) => {
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
    const a = Math.atan2(ey - cy, ex - cx), hl = lw * 2.4 + (w - lw);
    g.beginPath(); g.moveTo(ex + Math.cos(a) * hl * 0.8, ey + Math.sin(a) * hl * 0.8);
    g.lineTo(ex + Math.cos(a + 2.3) * hl, ey + Math.sin(a + 2.3) * hl); g.lineTo(ex + Math.cos(a - 2.3) * hl, ey + Math.sin(a - 2.3) * hl); g.closePath(); g.fill();
  };
  head(lw * 1.9, cOut); head(lw, cIn);
}
function gfDrips(g, r, x0, x1, y, n, len, w, col) {
  g.save(); g.strokeStyle = col; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * r(), l = len * (0.3 + r()), ww = w * (0.6 + 0.6 * r());
    g.lineWidth = ww; g.beginPath(); g.moveTo(x, y - ww); g.lineTo(x, y + l); g.stroke();
    g.beginPath(); g.arc(x, y + l, ww * 0.75, 0, Math.PI * 2); g.fillStyle = col; g.fill();
  }
  g.restore();
}

/* a full piece: tilted, overlapping letters with a gradient fill, a double outline, a 3D block shadow, shines,
   drips and, when it is a wild one, arrows; sometimes a cloud and stars behind it */
function gfPiece(g, W, H, r, wild) {
  const P = GF_PAL[(r() * GF_PAL.length) | 0], font = GF_FONTS[(r() * GF_FONTS.length) | 0];
  const t = Math.max(3, Math.min(7, Math.round(W / H / 0.68))), word = gfName(r, Math.max(3, t - 1), t);
  const lay = gfLayout(g, word, font, H * 0.74, W, H, { r, size: wild ? 0.32 : 0.16, tilt: wild ? 0.55 : 0.22, bounce: wild ? 0.16 : 0.08, overlap: wild ? 0.2 : 0.1, wide: 0.9, base: 0.47, grow: 1.2, pad: wild ? 0.5 : 0.36 });
  const fs = lay.fs, ow = fs * 0.15, dx = (r() < 0.5 ? -1 : 1) * fs * 0.0055, dy = fs * 0.0045, depth = 10 + ((r() * 10) | 0);
  // the cloud behind: overlapping circles in a soft colour with its own outline
  if (r() < 0.5) {
    const blobs = []; for (let i = 0; i < 9 + r() * 6; i++) blobs.push([lay.x0 + (lay.x1 - lay.x0) * r(), H * (0.35 + 0.3 * r()), fs * (0.35 + 0.3 * r())]);
    for (const [col, grow] of [[P[2], ow * 0.6], [P[5], 0]]) { g.fillStyle = col; for (const [x, y, R] of blobs) { g.beginPath(); g.arc(x, y, R + grow, 0, Math.PI * 2); g.fill(); } }
    for (let i = 0; i < 4; i++) gfStar(g, W * r(), H * (0.1 + 0.8 * r()), fs * (0.08 + 0.1 * r()), P[4]);
  }
  const Lc = gfCanvas(W, H), L = Lc.getContext('2d');
  L.lineJoin = 'round'; L.miterLimit = 2;
  // the 3D block, stepped back from the letters
  for (let k = depth; k >= 1; k--) for (const l of lay.L) {
    L.save(); L.translate(l.x + dx * k, l.y + dy * k); L.rotate(l.rot);
    L.font = `900 ${Math.round(fs * l.sc)}px ${font}`; L.textAlign = 'center'; L.textBaseline = 'middle';
    L.strokeStyle = k === depth ? P[2] : P[3]; L.lineWidth = ow * (k === depth ? 1.2 : 1); L.strokeText(l.ch, 0, 0); L.fillStyle = L.strokeStyle; L.fillText(l.ch, 0, 0);
    L.restore();
  }
  if (wild) for (let i = 0; i < 1 + r() * 2.5; i++) {
    const l = lay.L[(r() * lay.L.length) | 0], a = -Math.PI / 2 + (r() - 0.5) * 2.4;
    gfArrow(L, l.x, l.y, a, fs * (0.5 + 0.3 * r()), fs * 0.07, P[2], P[0]);
  }
  gfEach(L, lay, font, 900, l => { L.strokeStyle = P[2]; L.lineWidth = ow * 1.35; L.strokeText(l.ch, 0, 0); });
  gfEach(L, lay, font, 900, l => { L.strokeStyle = P[4]; L.lineWidth = ow * 0.55; L.strokeText(l.ch, 0, 0); });
  // the fill, on its own sheet so its bands and fades only land on the letters
  const Fc = gfCanvas(W, H), F = Fc.getContext('2d');
  gfEach(F, lay, font, 900, l => { F.fillStyle = '#fff'; F.fillText(l.ch, 0, 0); });
  F.globalCompositeOperation = 'source-atop';
  const gr = F.createLinearGradient(0, H * 0.2, 0, H * 0.8); gr.addColorStop(0, P[0]); gr.addColorStop(1, P[1]);
  F.fillStyle = gr; F.fillRect(0, 0, W, H);
  const fx = r();
  if (fx < 0.3) { F.fillStyle = P[1]; for (let y = H * 0.25; y < H * 0.85; y += fs * 0.16) F.fillRect(0, y, W, fs * 0.05); }                 // bands
  else if (fx < 0.55) { F.fillStyle = P[5]; for (let i = 0; i < 60; i++) { F.beginPath(); F.arc(W * r(), H * r(), fs * (0.02 + 0.04 * r()), 0, Math.PI * 2); F.fill(); } }   // bubbles
  else if (fx < 0.75) { F.strokeStyle = P[2]; F.lineWidth = Math.max(1, fs * 0.012); F.beginPath(); for (let i = 0; i < 14; i++) { const x = W * r(), y = H * r(); F.moveTo(x, y); F.lineTo(x + (r() - 0.5) * fs * 0.5, y + (r() - 0.5) * fs * 0.5); } F.stroke(); }   // cracks
  else { const g2 = F.createLinearGradient(0, 0, W, 0); g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(0.5, P[5] + '99'); g2.addColorStop(1, 'rgba(255,255,255,0)'); F.fillStyle = g2; F.fillRect(0, 0, W, H); }   // a fade across
  L.drawImage(Fc, 0, 0);
  // shines
  L.strokeStyle = '#ffffff'; L.lineCap = 'round';
  for (const l of lay.L) if (r() < 0.75) {
    L.lineWidth = Math.max(1.5, fs * 0.03);
    const x = l.x - l.w * 0.22, y = l.y - fs * l.sc * 0.22;
    L.beginPath(); L.moveTo(x, y + fs * 0.08); L.lineTo(x, y); L.lineTo(x + fs * 0.08, y - fs * 0.02); L.stroke();
    if (r() < 0.3) gfStar(L, l.x + l.w * 0.25, l.y - fs * 0.3, fs * 0.07, '#ffffff');
  }
  if (r() < 0.6) gfDrips(L, r, lay.x0 + fs * 0.2, lay.x1 - fs * 0.2, H * 0.5 + fs * 0.33, 3 + ((r() * 6) | 0), H * 0.16, fs * 0.035, P[1]);
  g.drawImage(Lc, 0, 0);
  // the crew's initials and a year in a corner, hand-sprayed
  if (r() < 0.55) {
    g.save(); g.font = `700 ${Math.round(fs * 0.17)}px ${GF_HAND[(r() * GF_HAND.length) | 0]}`; g.fillStyle = P[2]; g.textAlign = 'right'; g.textBaseline = 'bottom';
    g.fillText(gfName(r, 2, 3) + (r() < 0.5 ? ' ' + (10 + ((r() * 17) | 0)) : ' CREW'), W * 0.97, H * 0.98); g.restore();
  }
}
/* a throw-up: two to four fat round letters, one fill and a hard outline, done fast */
function gfThrow(g, W, H, r) {
  const fills = [['#e3e6ea', '#111111'], ['#ffffff', '#111111'], ['#111111', '#f0f0f0'], ['#f6d32d', '#1b1b1b'], ['#ff5fa2', '#16123a'], ['#4cc9f0', '#111111'], ['#c8ccd0', '#c1121f']];
  const [fc, oc] = fills[(r() * fills.length) | 0], font = GF_FONTS[(r() * 2) | 0];
  const t = Math.max(2, Math.min(5, Math.round(W / H / 0.75))), lay = gfLayout(g, gfName(r, Math.max(2, t - 1), t), font, H * 0.62, W, H, { r, size: 0.2, tilt: 0.3, bounce: 0.12, overlap: 0.18, wide: 0.9, base: 0.5, grow: 1.2, pad: 0.45 });
  const fs = lay.fs, Lc = gfCanvas(W, H), L = Lc.getContext('2d'); L.lineJoin = 'round';
  gfEach(L, lay, font, 900, l => { L.strokeStyle = oc; L.lineWidth = fs * 0.4; L.strokeText(l.ch, 0, 0); });
  gfEach(L, lay, font, 900, l => { L.strokeStyle = fc; L.lineWidth = fs * 0.26; L.strokeText(l.ch, 0, 0); L.fillStyle = fc; L.fillText(l.ch, 0, 0); });
  gfEach(L, lay, font, 900, l => { L.strokeStyle = oc; L.lineWidth = Math.max(1, fs * 0.025); L.globalAlpha = 0.7; L.strokeText(l.ch, 0, 0); L.globalAlpha = 1; });
  if (r() < 0.5) gfDrips(L, r, lay.x0, lay.x1, H * 0.52 + fs * 0.42, 2 + ((r() * 4) | 0), H * 0.14, fs * 0.04, fc);
  g.drawImage(Lc, 0, 0);
}
/* a hand tag: one colour, written quickly with a skew, a swoosh under it and sometimes a crown or a star */
function gfTag(g, W, H, r, faded) {
  const col = GF_SPRAY[(r() * GF_SPRAY.length) | 0], font = GF_HAND[(r() * GF_HAND.length) | 0], word = gfName(r, 3, 5);
  g.save(); g.globalAlpha = faded ? 0.28 : 0.92;
  g.translate(W / 2, H * 0.5); g.transform(1, 0, -0.25 - 0.25 * r(), 1, 0, 0); g.rotate((r() - 0.5) * 0.25);
  let fs = H * 0.55; g.font = `700 ${Math.round(fs)}px ${font}`;
  const tw = +g.measureText(word).width || fs * word.length * 0.55, fit = Math.min(1, W * 0.78 / Math.max(1, tw)); fs *= fit;
  g.font = `700 ${Math.round(fs)}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.strokeStyle = g.fillStyle = col; g.lineWidth = Math.max(1.5, fs * 0.06); g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeText(word, 0, 0); g.fillText(word, 0, 0);
  const w = Math.min(W * 0.8, tw * fit) / 2;
  g.lineWidth = Math.max(1.5, fs * 0.05); g.beginPath(); g.moveTo(-w, fs * 0.45); g.quadraticCurveTo(0, fs * (0.55 + 0.2 * r()), w * 1.1, fs * 0.25); g.stroke();
  const deco = r();
  if (deco < 0.25) { g.beginPath(); const y = -fs * 0.55, x = -w * 0.6; g.moveTo(x - fs * 0.2, y); g.lineTo(x - fs * 0.2, y - fs * 0.25); g.lineTo(x - fs * 0.1, y - fs * 0.12); g.lineTo(x, y - fs * 0.3); g.lineTo(x + fs * 0.1, y - fs * 0.12); g.lineTo(x + fs * 0.2, y - fs * 0.25); g.lineTo(x + fs * 0.2, y); g.closePath(); g.stroke(); }   // crown
  else if (deco < 0.45) gfStar(g, w * 0.9, -fs * 0.45, fs * 0.16, col);
  g.restore();
  if (!faded && r() < 0.5) gfDrips(g, r, W * 0.2, W * 0.8, H * 0.5 + fs * 0.3, 2 + ((r() * 5) | 0), H * 0.2, Math.max(1.5, fs * 0.04), col);
}
/* sun fade, flaking and road grime over the paint, so it sits on a car that has been in service for years */
function gfAge(g, W, H, r) {
  g.save();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < W * H / 700; i++) { g.globalAlpha = 0.25 + 0.6 * r(); g.beginPath(); g.arc(W * r(), H * r(), 0.6 + 2.2 * r(), 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 0.5; g.lineWidth = 1;
  for (let i = 0; i < 18; i++) { const x = W * r(), y = H * r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 8); g.stroke(); }
  g.globalAlpha = 1 - (0.78 + 0.18 * r()); g.fillRect(0, 0, W, H);   // the sun has had it a while
  g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 1;
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(70,55,40,0.05)'); gr.addColorStop(0.6, 'rgba(70,55,40,0.12)'); gr.addColorStop(1, 'rgba(55,42,30,0.42)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(40,32,24,0.35)'; for (let i = 0; i < W * H / 1200; i++) { g.beginPath(); g.arc(W * r(), H * (0.3 + 0.7 * r()), 0.5 + 1.5 * r(), 0, Math.PI * 2); g.fill(); }
  g.restore();
}
function gfDraw(g, W, H, r, kind) {
  g.clearRect(0, 0, W, H);
  if (kind !== 'tag' && r() < 0.35) gfTag(g, W, H, r, true);     // an older tag showing through
  if (kind === 'piece' || kind === 'wild') gfPiece(g, W, H, r, kind === 'wild');
  else if (kind === 'throw') gfThrow(g, W, H, r);
  else gfTag(g, W, H, r, false);
  gfAge(g, W, H, r);
}
function graffitiMat(key, w, h, r, kind) {
  const W = Math.round(Math.min(1024, Math.max(96, w * GRAFFITI.pxm))), H = Math.round(Math.max(48, W * h / w));
  const m = new THREE.MeshStandardMaterial({ map: canvasTex(W, H, (g, W, H) => gfDraw(g, W, H, r, kind)), transparent: true, alphaTest: 0.04,
    metalness: 0.05, roughness: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  m.userData.noCast = true; m.userData.graffiti = kind;
  RMAT[key] = m; return m;
}

/* Where paint can go on each car's sides, clear of the reporting marks and data. Rects are [u0, u1, y0, y1] in
   metres; u runs along the car with the data stencil end positive (x = u * side), so a rect means the same place on
   both sides. z is the face the paint lies on; a tank's paint wraps its barrel (radius R, centre height yc). */
function graffitiSpots(type, d) {
  if (type === 'box') return { z: d.hw + 0.003, rects: [[-5.8, -1.1, 1.17, 2.7], [1.1, 5.8, 2.06, 4.06], [1.1, 3.55, 1.17, 2.0]] };
  if (type === 'hopper') return { z: d.hw - 0.007, rects: [[-4.95, 4.95, 1.27, 2.4], [0.2, 4.95, 1.27, 3.1], [-4.95, -0.2, 1.27, 2.4], [-2.4, 0.1, 2.5, 3.1]] };
  if (type === 'gon') return { z: d.hw + 0.003, rects: [[-3.9, 6.6, 1.16, 2.48], [-3.9, 1.2, 1.16, 2.48], [1.4, 6.6, 1.16, 2.48], [-6.6, -5.3, 1.16, 2.48]] };
  if (type === 'tank') return { R: d.R, yc: d.yc, segs: 32, rects: [[-2.55, 4.3, 1.62, 3.22], [-1.4, 1.4, 1.62, 3.25], [1.6, 4.3, 1.62, 3.25], [-4.7, -2.75, 2.5, 3.25]] };
  return null;
}
/* the outside of a 32-sided barrel at angle a up from the horizontal (the CylinderGeometry facets sit between
   vertices every 2pi/segs, counted from the side, so the flats are where the paint must lie) */
function gfFacet(R, segs, a) {
  // distance from the barrel's axis to its surface at angle a: the flat between the two vertices either side of a
  const st = 2 * Math.PI / segs, k = Math.floor(a / st), mid = (k + 0.5) * st;
  return R * Math.cos(st / 2) / Math.cos(a - mid);
}
function gfSheet(gb, key, sp, s, u0, u1, y0, y1) {
  const w = u1 - u0, h = y1 - y0, xc = s * (u0 + u1) / 2;
  if (!sp.R) {
    const g = new THREE.PlaneGeometry(w, h); if (s < 0) g.rotateY(Math.PI);
    gb.add(key, g.translate(xc, (y0 + y1) / 2, s * sp.z)); return;
  }
  // bent around the barrel: rows of vertices on every facet edge in between, each laid onto its flat
  const a0 = Math.asin((y0 - sp.yc) / sp.R), a1 = Math.asin((y1 - sp.yc) / sp.R), st = 2 * Math.PI / sp.segs;
  const as = [a0]; for (let k = Math.ceil(a0 / st); k * st < a1; k++) if (k * st > a0) as.push(k * st); as.push(a1);
  const pos = [], uv = [], idx = [];
  for (let j = 0; j < as.length; j++) for (let i = 0; i <= 1; i++) {
    const a = as[j], mid = j === 0 ? as[0] + 1e-6 : j === as.length - 1 ? as[j] - 1e-6 : a;
    // at a facet edge both flats meet, so the vertex is on the edge itself; ends sit on their own flat
    const rr = (j === 0 || j === as.length - 1 ? gfFacet(sp.R, sp.segs, mid) : sp.R) + 0.004;
    const x = (i ? 1 : -1) * w / 2;
    pos.push(x, sp.yc + rr * Math.sin(a), rr * Math.cos(a)); uv.push(i, (a - a0) / (a1 - a0));
  }
  for (let j = 0; j < as.length - 1; j++) { const b = j * 2; idx.push(b, b + 1, b + 3, b, b + 3, b + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  if (s < 0) g.rotateY(Math.PI);
  gb.add(key, g.translate(xc, 0, 0));
}
/* paints this car, if it is one of the painted ones; returns how many pieces went on */
function addGraffiti(gb, type, num, d) {
  const sp = graffitiSpots(type, d); if (!sp) return 0;
  const r = rng(gfHash(type, num));
  if (r() >= GRAFFITI.rate) return 0;
  const first = r() < 0.5 ? 1 : -1, both = r() < 0.6, hit = (a, b) => a[0] < b[1] && b[0] < a[1] && a[2] < b[3] && b[2] < a[3];
  let n = 0;
  for (const s of [first, -first]) {
    if (s !== first && !both) continue;
    const used = [], big = sp.rects.filter(q => q[1] - q[0] >= 2.6), q = big[(r() * big.length) | 0];
    // the main piece fills most of its panel
    const qw = q[1] - q[0], qh = q[3] - q[2], w = qw * (0.74 + 0.26 * r()), h = Math.min(qh, Math.max(qh * (0.82 + 0.18 * r()), 0.5));
    const u0 = q[0] + (qw - w) * r(), y0 = q[2] + (qh - h) * r(), main = [u0, u0 + w, y0, y0 + h];
    const kr = r(), kind = w / h < 1.6 ? 'throw' : kr < 0.42 ? 'piece' : kr < 0.7 ? 'wild' : kr < 0.9 ? 'throw' : 'tag';
    const key = `gf_${type}_${num}_${s}_${n}`; graffitiMat(key, w, h, rng(gfHash(type, num) ^ (n + 1) * 0x9E3779B1), kind);
    gfSheet(gb, key, sp, s, ...main); used.push(main); n++;
    // and maybe a tag or a throw-up or two in the room left over
    const extra = r() < 0.55 ? 1 + (r() < 0.35 ? 1 : 0) : 0;
    for (let e = 0; e < extra; e++) for (let t = 0; t < 8; t++) {
      const c = sp.rects[(r() * sp.rects.length) | 0], cw = c[1] - c[0], ch = c[3] - c[2];
      const tw = Math.min(cw, 0.9 + 1.3 * r()), th = Math.min(ch, Math.max(0.42, tw * (0.28 + 0.2 * r())));
      const a = c[0] + (cw - tw) * r(), b = c[2] + (ch - th) * r(), R2 = [a, a + tw, b, b + th];
      if (used.some(U => hit(U, R2))) continue;
      const k2 = `gf_${type}_${num}_${s}_${n}`; graffitiMat(k2, tw, th, rng(gfHash(type, num) ^ (n + 1) * 0x9E3779B1), r() < 0.6 ? 'tag' : 'throw');
      gfSheet(gb, k2, sp, s, ...R2); used.push(R2); n++; break;
    }
  }
  return n;
}
