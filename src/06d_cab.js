/* ============================================================================
   Cab interiors: the Berkshire's backhead and the diesel's control stand.
   Gauges read the simulation and every control can be grabbed and moved.
   CTL holds the lever definitions the on-screen control stand uses too, so a
   lever in the cab and its twin on the HUD always agree, detents and all.
   ========================================================================== */

/* ---------------- controls shared by the HUD levers and the cab ----------------
   t is lever travel: 0 at the top of a HUD lever, 1 at the bottom. */
const CTL = {
  throttle: { get: () => S.throttle, set: v => { S.throttle = v; }, fromT: t => GAME.isDiesel() ? Math.round((1 - t) * 8) / 8 : 1 - t, toT: v => 1 - v,
    label: v => GAME.isDiesel() ? (Math.round(v * 8) ? (GAME.train && GAME.train.elec ? 'P' : 'N') + Math.round(v * 8) : (GAME.train && GAME.train.elec ? 'OFF' : 'IDLE')) : Math.round(v * 100) + '%',
    ticks: () => GAME.isDiesel() ? [...Array(9)].map((_, i) => [i / 8, '']) : [[0, ''], [0.25, ''], [0.5, ''], [0.75, ''], [1, '']] },
  reverser: { get: () => S.reverser, set: v => { S.reverser = v; },
    fromT: t => { if (GAME.isDiesel()) return t < 0.34 ? 1 : (t > 0.66 ? -1 : 0); let r = 1 - 2 * t; if (Math.abs(r) < 0.06) r = 0; return Math.round(r * 17) / 17; }, toT: v => (1 - v) / 2,
    label: v => GAME.isDiesel() ? (v > 0.5 ? 'FWD' : v < -0.5 ? 'REV' : 'N') : (v === 0 ? 'N' : (v > 0 ? 'F ' : 'R ') + Math.round(Math.abs(v) * 85) + '%'), ticks: [[0, 'F'], [0.5, 'N'], [1, 'R']] },
  dyn: { get: () => S.dyn, set: v => { S.dyn = v; }, fromT: t => t < 0.04 ? 0 : t, toT: v => v, label: v => v < 0.03 ? 'OFF' : v < 0.06 ? 'SETUP' : (GAME.train && GAME.train.elec ? 'RB ' : 'DB ') + Math.round((v - 0.06) / 0.94 * 100) + '%', ticks: [[0, ''], [0.06, ''], [1, '']] },
  brake: { get: () => S.brakeH, set: v => { S.brakeH = v; }, fromT: t => { if (Math.abs(t - 0.12) < 0.04) return 0.12; if (Math.abs(t - 0.23) < 0.035) return 0.23; return t; }, toT: v => v, label: v => brakeLabel(v), ticks: [[0.03, 'REL'], [0.12, 'RUN'], [0.23, 'LAP'], [0.3, 'SVC'], [0.95, 'EMG']] },
  ind: { get: () => S.indH, set: v => { S.indH = v; }, fromT: t => t < 0.08 ? 0 : t, toT: v => v, label: v => Math.round(clamp((v - 0.1) / 0.9, 0, 1) * 45) + ' psi', ticks: [[0, 'REL'], [1, 'FULL']] },
};
/* a cab lever's travel p (0..1 along its own swing) for a CTL control; inv when the swing runs opposite to the HUD lever */
const ctlTravel = (c, inv) => { const t = c.toT(c.get()); return inv ? 1 - t : t; };
const ctlSetTravel = (c, inv, p) => { c.set(c.fromT(clamp(inv ? 1 - p : p, 0, 1))); };
/* the whistle or horn while held: travel 0..1 pulls from a gentle 25% to wide open */
const pullToWhistle = p => 0.25 + 0.75 * clamp(p, 0, 1);
const whistleToPull = w => clamp((w - 0.25) / 0.75, 0, 1);
/* gauge needles: 270 degrees of sweep from lower left, clockwise, as the HUD dials draw them.
   Returns the needle's turn about the dial's face normal (counterclockwise positive). */
const DIAL_A0 = Math.PI * 0.75, DIAL_SWEEP = Math.PI * 1.5;
const dialAngle = (v, max) => -(DIAL_A0 + DIAL_SWEEP * clamp(v, 0, max) / max);
/* water in the glass, 0 (out of sight below the bottom nut) to 1 (out of sight above the top) */
const glassLevel = W => clamp((W + 0.1) / 1.2, 0, 1);
/* stoker valve: a tap opens it a quarter turn more, and closes it from wide open, as the HUD button does */
const STOKER_STEPS = [0, 0.25, 0.5, 0.75, 1];
const stokerNext = v => { const i = STOKER_STEPS.findIndex(s => s > v + 0.05); return i < 0 ? 0 : STOKER_STEPS[i]; };
/* the far end of the train, where the rear brake pipe pressure is read */
const rearBP = T => { const b = T ? T.vehicles : null; return b ? (T.li > b.length - 1 - T.li ? b[0] : b[b.length - 1]).brake.BP : 90; };

const CAB = { lamps: [] };

/* ---------------- what the cab shows when you point at something ---------------- */
const CAB_READ = {
  boiler: () => `Boiler pressure · ${Math.round(S.P)} psi${S.safety ? ' · popping' : ''}`,
  chest: () => `Steam chest · ${Math.round(S.Psc)} psi`,
  mreq: () => `Main reservoir ${Math.round(S.MR)} · equalizing ${Math.round(S.ER)} psi`,
  bpbc: T => `Brake pipe ${Math.round(T ? T.lead.brake.BP : 90)} · brake cylinders ${Math.round(S.BCloco || 0)} psi`,
  speed: () => `Speed · ${Math.round(Math.abs(S.v) / MPH)} mph`,
  glass: () => `Water glass · ${Math.round(glassLevel(S.W) * 100)}%${S.lowWater ? ' · LOW' : ''}`,
  power: () => `${Math.round(Math.abs(S.v) / MPH)} mph · ${S.dyn > 0.06 ? 'dynamic brake ' + Math.round(S.dbLoad * 100) + '%' : (S.notch ? 'notch ' + S.notch : 'idle')} · ${Math.round(S.amps)} A`,
  air: T => `MR ${Math.round(S.MR)} · EQ ${Math.round(S.ER)} · BP ${Math.round(T ? T.lead.brake.BP : 90)} · BC ${Math.round(S.BCloco || 0)} psi`,
};

/* ---------------- building blocks ---------------- */
const _Y = new THREE.Vector3(0, 1, 0);
/* a frame whose +Z is the normal n and whose +Y leans as close to up as it can, placed at p */
function faceFrame(p, n, up = _Y) {
  const z = n.clone().normalize(), x = new THREE.Vector3().crossVectors(up, z).normalize(), y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(p);
}
const DIALS = {
  boiler: { max: 300, major: 50, minor: 10, label: 'BOILER', red: 245 },
  chest: { max: 300, major: 50, minor: 10, label: 'STEAM CHEST' },
  mreq: { max: 160, major: 20, minor: 5, label: 'MAIN RES', label2: 'EQUAL RES', two: true },
  bpbc: { max: 160, major: 20, minor: 5, label: 'BRAKE PIPE', label2: 'BRAKE CYL', two: true },
  speed: { max: 100, major: 10, minor: 2, label: 'MPH', small: true },
};
function dialMaterial(kind) {
  const key = 'dial_' + kind; if (RMAT[key]) return RMAT[key];
  const o = DIALS[kind];
  const map = canvasTex(256, 256, (g, w) => {
    const c = w / 2, r = c - 4;
    g.fillStyle = '#efe9d6'; g.fillRect(0, 0, w, w);
    if (o.red) { const a = DIAL_A0 + DIAL_SWEEP * o.red / o.max; g.strokeStyle = '#c0281e'; g.lineWidth = 7; g.beginPath(); g.moveTo(c + Math.cos(a) * r * 0.66, c + Math.sin(a) * r * 0.66); g.lineTo(c + Math.cos(a) * r * 0.97, c + Math.sin(a) * r * 0.97); g.stroke(); }
    g.strokeStyle = '#1b1b1b'; g.fillStyle = '#1b1b1b';
    for (let v = 0; v <= o.max + 1e-6; v += o.minor) {
      const a = DIAL_A0 + DIAL_SWEEP * v / o.max, major = Math.abs(v / o.major - Math.round(v / o.major)) < 1e-6;
      g.lineWidth = major ? 4 : 1.6; g.beginPath(); g.moveTo(c + Math.cos(a) * r * (major ? 0.76 : 0.85), c + Math.sin(a) * r * (major ? 0.76 : 0.85)); g.lineTo(c + Math.cos(a) * r * 0.95, c + Math.sin(a) * r * 0.95); g.stroke();
      if (major) { g.font = `600 ${o.small ? 21 : 24}px "IBM Plex Mono", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(v), c + Math.cos(a) * r * 0.6, c + Math.sin(a) * r * 0.6); }
    }
    g.font = '600 15px "IBM Plex Sans Condensed", Arial, sans-serif'; g.textAlign = 'center';
    if (o.two) { g.fillStyle = '#b8261c'; g.fillText(o.label, c, c + r * 0.36); g.fillStyle = '#1b1b1b'; g.fillText(o.label2, c, c + r * 0.52); }
    else { g.fillStyle = '#3a3a3a'; g.fillText(o.label, c, c + r * 0.42); }
    g.fillStyle = '#5b5b5b'; g.font = '600 12px "IBM Plex Sans Condensed", Arial, sans-serif'; g.fillText(kind === 'speed' ? '' : 'LBS PER SQ IN', c, c - r * 0.3);
  });
  const m = new THREE.MeshStandardMaterial({ map, metalness: 0, roughness: 0.45, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0 });
  CAB.lamps.push(m);
  return (RMAT[key] = m);
}
function cabMaterials() {
  if (RMAT.cabHi) return;
  const S2 = (c, m, r, extra = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r, ...extra });
  RMAT.cabHi = S2(0x3a3226, 0.5, 0.5, { emissive: 0xffb347, emissiveIntensity: 0.6 });
  RMAT.cabHi.color.convertSRGBToLinear(); RMAT.cabHi.emissive.convertSRGBToLinear(); RMAT.cabHi.userData.lin = true;
  RMAT.gglass = S2(0xcfe3ea, 0.1, 0.05, { transparent: true, opacity: 0.3, depthWrite: false });
  RMAT.winGlass = S2(0x15232a, 0.6, 0.05, { transparent: true, opacity: 0.25, depthWrite: false }); RMAT.winGlass.userData.noShadow = true;   // cab window panes, clear enough to see out
  RMAT.water = S2(0x6fa9c4, 0.1, 0.2, { emissive: 0x2c5f78, emissiveIntensity: 0.4 });
  RMAT.knob = S2(0x1a1a1a, 0.2, 0.35);
  RMAT.grip = S2(0x6b4a2c, 0.05, 0.6);
  RMAT.redKnob = S2(0x9e1d16, 0.2, 0.4);
  RMAT.handle = S2(0xb8bcc0, 0.9, 0.3);
  RMAT.hand = new THREE.MeshBasicMaterial({ color: 0x111111 });
  RMAT.handRed = new THREE.MeshBasicMaterial({ color: 0xb8261c });
  for (const k of ['gglass', 'water', 'knob', 'grip', 'redKnob', 'handle']) RMAT[k].side = THREE.DoubleSide;
}

/* Collects a cab's moving parts and their hit boxes while a model is built. */
class CabKit {
  constructor(gb, body) { this.gb = gb; this.body = body; this.ctls = []; this.dials = []; this.hits = []; this.screens = []; this.glasses = []; }
  /* a pivot in the body frame; geometry added to part.gb swings with it */
  part(pos, euler) {
    const outer = new THREE.Group(); outer.position.copy(pos); if (euler) outer.rotation.copy(euler);
    const inner = new THREE.Group(); outer.add(inner); this.body.add(outer);
    return { outer, inner, gb: new GeoBin() };
  }
  done(pt) { const g = pt.gb.build(RMAT, { cast: false }); while (g.children.length) pt.inner.add(g.children[0]); return pt; }
  /* an invisible box that catches the pointer for control c, in the part's own frame */
  hit(pt, c, w, h, d, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), RMAT.hit); m.position.set(x, y, z); m.userData.ctl = c; m.castShadow = false;
    (pt.inner || pt).add(m); this.hits.push(m); return m;
  }
  /* c: { id, name, kind: 'lever' | 'toggle' | 'hold' | 'info', part, grip, pose(p), show(), p(), setP(p), tap(), press(), release(), label() } */
  ctl(c) { c.cur = c.show ? c.show() : 0; if (c.pose) c.pose(c.cur); this.ctls.push(c); return c; }
  /* a gauge on a face: case, bezel, printed dial and its hands */
  dial(o) {
    const dep = o.depth || 0.07, gb = this.gb, m = faceFrame(o.p.clone().addScaledVector(o.n.clone().normalize(), dep), o.n), r = o.r;   // o.p is where the case meets its mount
    gb.add('dark', new THREE.CylinderGeometry(r + 0.012, r + 0.014, dep, 28).rotateX(Math.PI / 2).translate(0, 0, -dep / 2), m);
    gb.add('brass', new THREE.TorusGeometry(r + 0.005, 0.011, 6, 32), m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.002)));
    const kind = 'dial_' + o.kind; dialMaterial(o.kind);
    gb.add(kind, new THREE.CircleGeometry(r, 36).translate(0, 0, 0.002), m);
    gb.add('brass', new THREE.CylinderGeometry(r * 0.08, r * 0.08, 0.012, 10).rotateX(Math.PI / 2).translate(0, 0, 0.012), m);
    const hands = (o.hands || []).map(([fn, red], i) => {
      const outer = new THREE.Group(); outer.matrixAutoUpdate = false; outer.matrix.copy(m); this.body.add(outer);
      const inner = new THREE.Group(); outer.add(inner);
      const L = r * 0.98, nd = new THREE.Mesh(new THREE.BoxGeometry(L, r * 0.045, 0.0025).translate(L / 2 - r * 0.18, 0, 0.006 + i * 0.0028), red ? RMAT.handRed : RMAT.hand);
      nd.castShadow = false; inner.add(nd);
      return { inner, fn, max: DIALS[o.kind].max, a: null };
    });
    const d = { kind: o.kind, hands, m };
    this.dials.push(d);
    if (o.read) {
      const holder = new THREE.Group(); holder.matrixAutoUpdate = false; holder.matrix.copy(m); this.body.add(holder);
      this.hit(holder, this.ctl({ id: o.kind, kind: 'info', label: o.read }), 2 * r + 0.03, 2 * r + 0.03, 0.06, 0, 0, -0.01);
    }
    return d;
  }
  out(eye, extra) { return Object.assign({ eye, ctls: this.ctls, dials: this.dials, hits: this.hits, screens: this.screens, glasses: this.glasses }, extra); }
}

/* a spoked handwheel lying in the local XY plane, centred on the origin */
function handwheel(gb, key, r, spokes = 3) {
  gb.add(key, new THREE.TorusGeometry(r, r * 0.13, 6, 24));
  for (let i = 0; i < spokes; i++) gb.add(key, new THREE.BoxGeometry(r * 2 - 0.004, r * 0.14, r * 0.12), M(0, 0, 0, 0, 0, i * Math.PI / spokes));
  gb.add(key, new THREE.CylinderGeometry(r * 0.22, r * 0.22, r * 0.4, 10).rotateX(Math.PI / 2));
}

/* ======================= the Berkshire's cab ======================= */
/* d: x0 (front wall, inner face), x1 (rear), fl (deck), floor (top of the cab floor), hw (half width to the wall's centre),
   bh (firebox back sheet), FB (firebox outline), ceil(z) (roof underside), fwin {y0, y1, zi, zo} (front windows),
   eyeY (optional). Local frame: +X forward, +Z the engineer's (right) side. */
function steamCab(gb, body, d) {
  cabMaterials();
  const K = new CabKit(gb, body), FB = d.FB;
  const F = d.bh - 0.04;                      // the backhead's face, toward the crew
  const ffl = d.floor !== undefined ? d.floor : d.fl + 0.04;   // top of the cab floor
  const wallZ = d.hw - 0.025;                 // inner face of the side walls
  const cy = FB.cy;
  const half = y => y > cy ? Math.sqrt(Math.max(0, FB.r * FB.r - (y - cy) ** 2)) : FB.r + (FB.wb - FB.r) * (cy - y) / (cy - FB.base);
  const eye = new THREE.Vector3(F - 0.66, d.eyeY || ffl + 1.58, wallZ - 0.28);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const back = V(-1, 0, 0);
  // shapes drawn in (z, y) and stood on the backhead face, thickness running back toward the crew
  const onFace = (key, shape, depth, off = 0) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 18 }); g.rotateY(-Math.PI / 2); g.translate(F - off, 0, 0); gb.add(key, g); return g; };
  const rrect = (s, z0, y0, z1, y1, r) => { s.moveTo(z0 + r, y0); s.lineTo(z1 - r, y0); s.quadraticCurveTo(z1, y0, z1, y0 + r); s.lineTo(z1, y1 - r); s.quadraticCurveTo(z1, y1, z1 - r, y1); s.lineTo(z0 + r, y1); s.quadraticCurveTo(z0, y1, z0, y1 - r); s.lineTo(z0, y0 + r); s.quadraticCurveTo(z0, y0, z0 + r, y0); return s; };

  /* ---- backhead sheet: the firebox's own outline, 12 mm proud, from below the floor up to the crown ---- */
  {
    const e = 0.012, y0 = d.fl - 0.01, s = new THREE.Shape();
    s.moveTo(-half(y0) - e, y0); s.lineTo(-FB.r - e, cy); s.absarc(0, cy, FB.r + e, Math.PI, 0, true); s.lineTo(half(y0) + e, y0); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false, curveSegments: 32 }); g.rotateY(Math.PI / 2); g.translate(F, 0, 0); gb.add('backhead', g);
    // staybolt heads in rows across the sheet, kept inside its edge
    for (let y = ffl + 0.12; y < cy + FB.r - 0.05; y += 0.15) for (let z = -1.2; z <= 1.2; z += 0.15) {
      const zz = z + ((Math.round((y - ffl) / 0.15) % 2) ? 0.075 : 0);
      if (Math.abs(zz) > half(y) - 0.06) continue;
      gb.add('backhead', new THREE.CylinderGeometry(0.007, 0.008, 0.01, 6).rotateZ(Math.PI / 2).translate(F - 0.003, y, zz));
    }
    // washout plugs low at the corners and high on the shoulders
    for (const [z, y] of [[-1.0, ffl + 0.22], [1.0, ffl + 0.22], [-0.62, cy + 0.76], [0.62, cy + 0.76]]) gb.cylX('brass', 0.03, 0.03, 0.03, 6, F - 0.012, y, Math.sign(z) * Math.min(Math.abs(z), half(y) - 0.08));
  }

  /* ---- firedoor: frame, butterfly doors with the fire showing between them, air cylinder, foot pedal ---- */
  const fy = ffl + 0.68;
  {
    const s = rrect(new THREE.Shape(), -0.31, fy - 0.25, 0.31, fy + 0.25, 0.06);
    s.holes.push(rrect(new THREE.Path(), -0.22, fy - 0.16, 0.22, fy + 0.16, 0.035));
    onFace('dark', s, 0.05);
    for (const sd of [-1, 1]) {
      gb.box('dark', 0.03, 0.34, 0.2, F - 0.065, fy, sd * 0.12);                     // door leaf, 4 cm apart in the middle
      gb.box('steel', 0.02, 0.04, 0.05, F - 0.09, fy, sd * 0.06);                    // its handle
      gb.cyl('dark', 0.018, 0.018, 0.36, 8, F - 0.065, fy, sd * 0.235);              // hinge
    }
    gb.cylZ('dark', 0.035, 0.42, 12, F - 0.075, fy + 0.3, 0);                          // door engine
    for (const z of [-0.17, 0.17]) gb.box('dark', 0.075, 0.05, 0.04, F - 0.037, fy + 0.3, z);
    gb.box('dark', 0.08, 0.03, 0.1, F - 0.28, ffl + 0.025, -0.3);                      // pedal block on the deck
    gb.box('steel', 0.16, 0.02, 0.09, F - 0.29, ffl + 0.06, -0.3, 0, 0, -0.18);       // pedal
  }
  const firePos = V(F - 0.003, fy, 0), fireSize = [0.44, 0.32];

  /* ---- steam turret across the top: four valves, the blower and injector among them ---- */
  const ty = cy + 0.84, tx = F - 0.12, tL = 0.86;
  gb.cylZ('steel', 0.07, tL, 18, tx, ty, 0);
  for (const sd of [-1, 1]) gb.cylZ('steel', 0.082, 0.03, 18, tx, ty, sd * (tL / 2 + 0.01));
  gb.box('steel', 0.13, 0.08, 0.12, F - 0.06, ty, 0);                                 // the turret's feed from the dome
  const valveZ = [-0.3, -0.1, 0.1, 0.3];
  for (const z of valveZ) { gb.cyl('steel', 0.026, 0.032, 0.08, 10, tx, ty + 0.1, z); gb.cyl('rod', 0.008, 0.008, 0.06, 6, tx, ty + 0.16, z); }
  for (const z of [-0.3, 0.1]) { const g = new GeoBin(); handwheel(g, 'black', 0.05); for (const k in g.bins) for (const geo of g.bins[k]) gb.add('black', geo, M(tx, ty + 0.19, z, Math.PI / 2, 0, 0)); }
  // blower: a handwheel turned open
  {
    const pt = K.part(V(tx, ty + 0.19, -0.1)); handwheel(pt.gb, 'brass', 0.055); pt.inner.rotation.order = 'YXZ';
    for (const k in pt.gb.bins) pt.gb.bins[k].forEach(g => g.rotateX(Math.PI / 2));
    K.done(pt);
    const c = K.ctl({ id: 'blower', name: 'Blower', kind: 'lever', part: pt.inner, outer: pt.outer, grip: V(0, 0, 0.055),
      show: () => S.blower, p: () => S.blower, setP: p => { GAME.manualFire('blower'); S.blower = clamp(p, 0, 1); }, pose: p => { pt.inner.rotation.y = -p * 4.5; }, wheel: [1, -4.5],
      tap: () => { GAME.manualFire('blower'); S.blower = S.blower > 0.3 ? 0 : 0.65; }, label: () => 'Blower · ' + Math.round(S.blower * 100) + '%' });
    K.hit(pt, c, 0.14, 0.06, 0.14);
  }
  // injector steam valve: a lever handle, along the turret when shut, swung back when open
  {
    const pt = K.part(V(tx, ty + 0.19, 0.3));
    pt.gb.cyl('steel', 0.016, 0.016, 0.03, 8, 0, 0, 0); pt.gb.box('handle', 0.022, 0.014, 0.15, 0, 0.005, 0.075); pt.gb.box('redKnob', 0.03, 0.026, 0.04, 0, 0.006, 0.145);
    K.done(pt);
    const c = K.ctl({ id: 'injector', name: 'Injector', kind: 'toggle', part: pt.inner, outer: pt.outer, grip: V(0, 0, 0.14),
      show: () => S.injector ? 1 : 0, pose: p => { pt.inner.rotation.y = -p * 1.35; },
      tap: () => { GAME.manualFire('injector'); S.injector = !S.injector; }, label: () => 'Injector · ' + (S.injector ? 'on: feeding the boiler' : 'off') });
    K.hit(pt, c, 0.08, 0.08, 0.2, 0, 0, 0.08);
  }

  /* ---- gauges ---- */
  const dials = [
    { kind: 'boiler', p: V(F, cy + 0.52, -0.05), r: 0.14, hands: [[() => S.P]], read: CAB_READ.boiler },
    { kind: 'chest', p: V(F, cy + 0.48, 0.3), r: 0.095, hands: [[() => S.Psc]], read: CAB_READ.chest },
    { kind: 'mreq', p: V(F, cy + 0.56, 0.58), r: 0.095, hands: [[() => S.MR, true], [() => S.ER]], read: CAB_READ.mreq },
    { kind: 'bpbc', p: V(F, cy + 0.34, 0.82), r: 0.095, hands: [[() => GAME.train ? GAME.train.lead.brake.BP : 90], [() => S.BCloco || 0, true]], read: () => CAB_READ.bpbc(GAME.train) },
  ];
  for (const o of dials) K.dial(Object.assign({ n: back }, o));
  // speed recorder on the engineer's wall, below the front window, turned toward his seat
  {
    const p = V((d.x0 + F) / 2, d.fwin.y0 - 0.16, wallZ - 0.14), n = eye.clone().sub(p).normalize();
    K.dial({ kind: 'speed', p, n, r: 0.1, depth: 0.06, hands: [[() => Math.abs(S.v) / MPH]], read: CAB_READ.speed });
    const b = p.clone();
    gb.box('dark', 0.07, 0.07, wallZ + 0.01 - b.z, b.x, b.y, (b.z + wallZ + 0.01) / 2);   // bracket to the wall
  }

  /* ---- water glasses each side, with try cocks on the engineer's side ---- */
  for (const sd of [-1, 1]) {
    const z = sd * 0.66, yb = cy - 0.19, yt = cy + 0.15;
    gb.box('brass', 0.07, 0.06, 0.06, F - 0.035, yt, z); gb.box('brass', 0.07, 0.06, 0.06, F - 0.035, yb, z);
    gb.add('gglass', new THREE.CylinderGeometry(0.016, 0.016, yt - yb, 12, 1, true).translate(F - 0.045, (yt + yb) / 2, z));
    for (const dz of [-0.024, 0.024]) gb.cyl('rod', 0.004, 0.004, yt - yb, 5, F - 0.064, (yt + yb) / 2, z + dz);
    gb.cyl('brass', 0.01, 0.01, 0.06, 6, F - 0.035, yb - 0.06, z); gb.box('brass', 0.012, 0.012, 0.05, F - 0.035, yb - 0.09, z + 0.02);
    const g0 = yb + 0.03, g1 = yt - 0.03;
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 10).translate(0, 0.5, 0), RMAT.water); w.position.set(F - 0.045, g0, z); w.castShadow = false; body.add(w);
    K.glasses.push({ mesh: w, h: g1 - g0 });
    const holder = new THREE.Group(); holder.position.set(F - 0.045, (yt + yb) / 2, z); body.add(holder);
    K.hit(holder, K.ctl({ id: 'glass', kind: 'info', label: CAB_READ.glass }), 0.08, yt - yb + 0.08, 0.1);
  }
  for (const y of [cy - 0.16, cy - 0.04, cy + 0.08]) { gb.cylX('brass', 0.017, 0.017, 0.06, 8, F - 0.03, y, 0.92); gb.box('dark', 0.012, 0.05, 0.012, F - 0.06, y, 0.92); }
  // the fireman's stoker jets: a header and five small valves
  gb.cylZ('steel', 0.02, 0.36, 8, F - 0.03, cy - 0.1, -0.92);
  for (let i = 0; i < 5; i++) { const z = -0.76 - i * 0.07; gb.cylX('steel', 0.016, 0.016, 0.07, 8, F - 0.055, cy - 0.1, z); gb.cyl('black', 0.022, 0.022, 0.008, 8, F - 0.09, cy - 0.1, z, 0, 0, Math.PI / 2); }

  /* ---- throttle: a long lever pivoted on the backhead, pulled back across its toothed quadrant ---- */
  {
    const pv = V(F - 0.11, cy + 0.18, 0.2), TH = 1.05;
    gb.box('dark', 0.115, 0.08, 0.08, F - 0.05, pv.y, pv.z);
    gb.cyl('dark', 0.035, 0.035, 0.1, 14, pv.x, pv.y - 0.01, pv.z);
    const q = new THREE.Shape(), r0 = 0.45, r1 = 0.49, a0 = -0.05, a1 = TH + 0.05;
    q.absarc(0, 0, r1, a0, a1, false); q.absarc(0, 0, r0, a1, a0, true); q.closePath();
    const rib = (a) => { const s = new THREE.Shape(); const c = Math.cos(a), sn = Math.sin(a), n = [-sn, c]; const w = 0.016; s.moveTo(0.03 * c + n[0] * w, 0.03 * sn + n[1] * w); s.lineTo(r0 * c + n[0] * w, r0 * sn + n[1] * w); s.lineTo(r0 * c - n[0] * w, r0 * sn - n[1] * w); s.lineTo(0.03 * c - n[0] * w, 0.03 * sn - n[1] * w); s.closePath(); return s; };
    for (const sh of [q, rib(a0 + 0.03), rib(a1 - 0.03)]) {
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: false, curveSegments: 20 });
      g.rotateX(Math.PI / 2); g.rotateY(-Math.PI / 2); g.translate(pv.x, pv.y - 0.04, pv.z); gb.add('dark', g);
    }
    for (let i = 0; i <= 20; i++) { const a = i / 20 * TH; gb.box('steel', 0.007, 0.008, 0.028, pv.x - Math.sin(a) * 0.47, pv.y - 0.036, pv.z + Math.cos(a) * 0.47, 0, -a, 0); }
    const pt = K.part(pv);
    pt.gb.box('handle', 0.035, 0.03, 0.58, 0, 0, 0.3); pt.gb.cyl('steel', 0.04, 0.04, 0.04, 12, 0, 0, 0);
    pt.gb.cyl('grip', 0.019, 0.019, 0.11, 10, 0, -0.07, 0.565); pt.gb.box('handle', 0.012, 0.03, 0.022, 0, -0.03, 0.47);
    pt.gb.box('handle', 0.01, 0.01, 0.1, 0, -0.03, 0.52);                               // latch rod
    K.done(pt);
    const c = K.ctl({ id: 'throttle', name: 'Throttle', kind: 'lever', part: pt.inner, outer: pt.outer, grip: V(0, -0.06, 0.565),
      show: () => S.throttle, p: () => ctlTravel(CTL.throttle, true), setP: p => { ctlSetTravel(CTL.throttle, true, p); GAME.controlTouched('lvThrottle'); },
      pose: p => { pt.inner.rotation.y = -p * TH; }, label: () => 'Throttle · ' + CTL.throttle.label(S.throttle) });
    K.hit(pt, c, 0.1, 0.16, 0.34, 0, -0.03, 0.44);
  }

  /* ---- reverser: the power reverse valve handle on its quadrant, with the cutoff scale ---- */
  {
    const pz = 0.98, pv = V(F - 0.22, ffl + 0.3, pz), Lr = 0.42, R = 0.47, RS = 0.4;
    const s = new THREE.Shape(), ax0 = 0.0, aR = 0.58;
    s.moveTo(0.005, ffl + 0.22); s.lineTo(0.005, pv.y + Math.cos(aR) * RS);
    for (let i = 0; i <= 16; i++) { const a = aR - i / 16 * 2 * aR; s.lineTo(pv.x - F + Math.sin(a) * RS, pv.y + Math.cos(a) * RS); }
    s.lineTo(pv.x - F - 0.06, ffl + 0.22); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }); g.translate(F, 0, pz - 0.01); gb.add('dark', g);
    const tex = canvasTex(256, 256, (cg, w) => {
      cg.clearRect(0, 0, w, w); const k = w / 0.5, cx = 0.26 * k, cyy = w - 0.06 * k;   // texture covers x (F-0.48..F+0.02), y (pivot-0.06 .. +0.44)
      cg.strokeStyle = '#e8e2cf'; cg.fillStyle = '#e8e2cf'; cg.lineWidth = 3; cg.font = 'bold 22px "IBM Plex Sans Condensed", Arial, sans-serif'; cg.textAlign = 'center'; cg.textBaseline = 'middle';
      cg.beginPath(); for (let i = 0; i <= 30; i++) { const a = 0.5 - i / 30; const px = cx + Math.sin(a) * 0.37 * k, py = cyy - Math.cos(a) * 0.37 * k; i ? cg.lineTo(px, py) : cg.moveTo(px, py); } cg.stroke();
      for (let i = -5; i <= 5; i++) { const a = i / 5 * 0.47, rr = i === 0 ? 0.3 : 0.335; cg.lineWidth = i === 0 ? 4 : 2; cg.beginPath(); cg.moveTo(cx + Math.sin(a) * rr * k, cyy - Math.cos(a) * rr * k); cg.lineTo(cx + Math.sin(a) * 0.37 * k, cyy - Math.cos(a) * 0.37 * k); cg.stroke(); }
      cg.fillText('F', cx + Math.sin(0.47) * 0.28 * k, cyy - Math.cos(0.47) * 0.28 * k); cg.fillText('R', cx - Math.sin(0.47) * 0.28 * k, cyy - Math.cos(0.47) * 0.28 * k); cg.fillText('N', cx, cyy - 0.26 * k);
    });
    RMAT.cutScale = RMAT.cutScale || new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, metalness: 0.1, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    gb.add('cutScale', new THREE.PlaneGeometry(0.5, 0.5), M(F - 0.23, pv.y + 0.19, pz + 0.0105));
    gb.cylZ('steel', 0.025, 0.07, 10, pv.x, pv.y, pz + 0.015);
    const pt = K.part(V(pv.x, pv.y, pz + 0.022));
    pt.gb.box('handle', 0.03, Lr, 0.016, 0, Lr / 2, 0); pt.gb.cyl('knob', 0.022, 0.022, 0.06, 10, 0, Lr + 0.005, 0, Math.PI / 2, 0, 0);
    pt.gb.box('handle', 0.012, 0.15, 0.012, -0.022, Lr - 0.12, 0.008);                // latch
    K.done(pt);
    const c = K.ctl({ id: 'reverser', name: 'Reverser', kind: 'lever', part: pt.inner, outer: pt.outer, grip: V(0, Lr, 0),
      show: () => S.reverser, p: () => ctlTravel(CTL.reverser, false), setP: p => { ctlSetTravel(CTL.reverser, false, p); GAME.controlTouched('lvReverser'); },
      pose: v => { pt.inner.rotation.z = -v * 0.47; }, label: () => 'Reverser · ' + CTL.reverser.label(S.reverser) });
    // pose takes the reverser value itself (-1..1); the drag works in travel, so convert
    c.pose = v => { pt.inner.rotation.z = -v * 0.47; };
    c.poseP = p => c.pose(1 - 2 * p);
    K.hit(pt, c, 0.09, 0.22, 0.08, 0, Lr - 0.08, 0);
  }

  /* ---- brake stand on the engineer's side: automatic valve on top, independent below, bell and sander valves ---- */
  const bx = F - 0.14, bz = wallZ - 0.175, Ya = eye.y - 0.55, Yi = Ya - 0.29, Yb = Yi - 0.24;
  {
    gb.cyl('dark', 0.09, 0.11, 0.03, 16, bx, ffl + 0.005, bz);
    gb.cyl('dark', 0.04, 0.04, Ya - 0.17 - ffl + 0.01, 12, bx, (ffl + Ya - 0.17) / 2, bz);
    gb.cyl('dark', 0.07, 0.07, 0.12, 18, bx, Yi - 0.085, bz);
    gb.cyl('dark', 0.1, 0.1, 0.14, 20, bx, Ya - 0.1, bz);
    gb.cyl('dark', 0.102, 0.102, 0.012, 20, bx, Ya - 0.06, bz);
    gb.tube('copper', [[bx - 0.06, Ya - 0.14, bz + 0.07], [bx - 0.04, Ya - 0.4, bz + 0.12], [bx, ffl + 0.25, bz + 0.12], [bx + 0.02, ffl - 0.02, bz + 0.12]], 0.014, 16, 6);
    gb.tube('copper', [[bx + 0.05, Yi - 0.11, bz - 0.04], [bx + 0.06, ffl + 0.25, bz - 0.06], [bx + 0.06, ffl - 0.02, bz - 0.06]], 0.012, 10, 6);
    gb.box('dark', 0.09, 0.2, 0.08, bx - 0.055, Yb, bz);                                // bell & sander valve block
    // automatic brake valve handle
    const pa = K.part(V(bx, Ya - 0.045, bz));
    pa.gb.cyl('dark', 0.07, 0.075, 0.035, 16, 0, 0, 0); pa.gb.box('handle', 0.28, 0.026, 0.035, -0.15, 0.025, 0); pa.gb.cyl('knob', 0.024, 0.024, 0.07, 10, -0.28, 0.05, 0);
    K.done(pa);
    const ca = K.ctl({ id: 'brake', name: 'Automatic brake', kind: 'lever', part: pa.inner, outer: pa.outer, grip: V(-0.28, 0.04, 0),
      show: () => S.brakeH, p: () => ctlTravel(CTL.brake, false), setP: p => { ctlSetTravel(CTL.brake, false, p); GAME.controlTouched('lvBrake'); },
      pose: p => { pa.inner.rotation.y = -0.85 + 1.3 * p; }, label: () => 'Automatic brake · ' + CTL.brake.label(S.brakeH) });
    K.hit(pa, ca, 0.1, 0.09, 0.08, -0.26, 0.045, 0);
    // independent
    const pi = K.part(V(bx, Yi - 0.0, bz));
    pi.gb.add('dark', new THREE.CylinderGeometry(0.055, 0.055, 0.05, 14, 1, false).translate(0, -0.0, 0)); pi.gb.box('handle', 0.19, 0.022, 0.03, -0.12, 0.012, 0); pi.gb.cyl('knob', 0.02, 0.02, 0.06, 10, -0.21, 0.035, 0);
    K.done(pi);
    const ci = K.ctl({ id: 'ind', name: 'Independent brake', kind: 'lever', part: pi.inner, outer: pi.outer, grip: V(-0.21, 0.03, 0),
      show: () => S.indH, p: () => ctlTravel(CTL.ind, false), setP: p => { ctlSetTravel(CTL.ind, false, p); GAME.controlTouched('lvInd'); },
      pose: p => { pi.inner.rotation.y = -0.6 + 1.1 * p; }, label: () => 'Independent brake · ' + CTL.ind.label(S.indH) });
    K.hit(pi, ci, 0.09, 0.08, 0.08, -0.19, 0.03, 0);
    // sander (top of the valve block) and bell ringer (bottom)
    for (const [id, y, name] of [['sander', Yb + 0.1, 'Sander'], ['bell', Yb - 0.1, 'Bell']]) {
      const pt = K.part(V(bx - 0.08, y + (id === 'sander' ? 0.01 : -0.01), bz));
      pt.gb.cyl('steel', 0.014, 0.014, 0.02, 8, 0, 0, 0); pt.gb.box('handle', 0.11, 0.014, 0.02, -0.055, 0, 0); pt.gb.cyl(id === 'bell' ? 'brass' : 'knob', 0.016, 0.016, 0.04, 8, -0.11, 0, 0);
      K.done(pt);
      const c = K.ctl({ id, name, kind: 'toggle', part: pt.inner, outer: pt.outer, grip: V(-0.11, 0, 0),
        show: () => (id === 'bell' ? S.bell : S.sander) ? 1 : 0, pose: p => { pt.inner.rotation.y = p * 0.6; },
        tap: () => { if (id === 'bell') S.bell = !S.bell; else S.sander = !S.sander; }, label: () => name + ' · ' + ((id === 'bell' ? S.bell : S.sander) ? (id === 'bell' ? 'ringing' : 'sanding') : 'off') });
      K.hit(pt, c, 0.13, 0.06, 0.07, -0.07, 0, 0);
    }
  }
  /* ---- cylinder cocks valve on the engineer's wall ---- */
  {
    const x = F - 0.34, y = Yb;
    gb.box('dark', 0.08, 0.1, 0.07, x, y, wallZ - 0.034);
    const pt = K.part(V(x, y, wallZ - 0.076));
    pt.gb.cyl('steel', 0.014, 0.014, 0.02, 8, 0, 0, 0, Math.PI / 2, 0, 0); pt.gb.box('handle', 0.016, 0.14, 0.014, 0, 0.07, 0); pt.gb.cyl('knob', 0.018, 0.018, 0.04, 8, 0, 0.145, 0);
    K.done(pt);
    const c = K.ctl({ id: 'cocks', name: 'Cylinder cocks', kind: 'toggle', part: pt.inner, outer: pt.outer, grip: V(0, 0.14, 0),
      show: () => S.cocks ? 1 : 0, pose: p => { pt.inner.rotation.z = -0.35 + 0.7 * p; },
      tap: () => { S.cocks = !S.cocks; }, label: () => 'Cylinder cocks · ' + (S.cocks ? 'open' : 'shut') });
    K.hit(pt, c, 0.07, 0.18, 0.07, 0, 0.09, 0);
  }
  /* ---- headlight switch on the backhead's right shoulder (the turbo-generator's lamp switch) ---- */
  {
    const y = cy + 0.1, z = 1.02;
    gb.box('dark', 0.05, 0.1, 0.08, F - 0.025, y, z);
    const pt = K.part(V(F - 0.05, y, z));
    pt.gb.cyl('knob', 0.022, 0.024, 0.02, 12, -0.01, 0, 0, 0, 0, Math.PI / 2); pt.gb.box('handle', 0.012, 0.05, 0.012, -0.022, 0.018, 0);
    K.done(pt);
    const c = K.ctl({ id: 'light', name: 'Headlight', kind: 'toggle', part: pt.inner, outer: pt.outer, grip: V(-0.02, 0.03, 0),
      show: () => S.light / 2, pose: p => { pt.inner.rotation.x = (p - 0.5) * 1.4; },
      tap: () => { S.light = (S.light + 1) % 3; }, label: () => 'Headlight · ' + ['off', 'dim', 'bright'][S.light] });
    K.hit(pt, c, 0.07, 0.1, 0.1);
  }

  /* ---- stoker valve, fireman's side ---- */
  {
    const p = V(F - 0.12, ffl + 0.6, -0.92);
    gb.cylX('steel', 0.03, 0.03, 0.06, 10, F - 0.03, p.y, p.z); gb.cylX('rod', 0.011, 0.011, 0.12, 6, F - 0.06, p.y, p.z);
    const pt = K.part(p); handwheel(pt.gb, 'red', 0.075, 4);
    for (const k in pt.gb.bins) pt.gb.bins[k].forEach(g => g.rotateY(Math.PI / 2));
    K.done(pt);
    const c = K.ctl({ id: 'stoker', name: 'Stoker', kind: 'lever', part: pt.inner, outer: pt.outer, grip: V(0, 0.075, 0),
      show: () => S.stoker, p: () => S.stoker, setP: p => { GAME.manualFire('stoker'); S.stoker = clamp(p, 0, 1); }, pose: p => { pt.inner.rotation.x = p * 4.2; }, wheel: [0, 4.2],
      tap: () => { GAME.manualFire('stoker'); S.stoker = stokerNext(S.stoker); }, label: () => 'Stoker · ' + Math.round(S.stoker * 100) + '%' + (S.autoFire ? ' (fireman)' : '') });
    K.hit(pt, c, 0.06, 0.18, 0.18);
  }

  /* ---- whistle cord: from the valve linkage at the front wall, back under the roof, down to a wooden grip ---- */
  {
    const z = 0.95, yc = d.ceil(z) - 0.24, xp = F - 0.42;
    gb.box('dark', 0.06, 0.08, 0.05, d.x0 - 0.03, yc, z);
    gb.cyl('dark', 0.006, 0.006, (d.x0 - 0.06) - xp, 5, (d.x0 - 0.06 + xp) / 2, yc, z, 0, 0, Math.PI / 2);
    const top = d.ceil(z) + 0.01, hb = top - (yc - 0.06);
    gb.box('dark', 0.05, hb, 0.04, xp, top - hb / 2, z);                                  // hanger and pulley housing from the roof
    gb.cylZ('steel', 0.022, 0.05, 10, xp, yc, z);
    const pt = K.part(V(xp, yc - 0.03, z));
    const drop = clamp(yc - 0.03 - (eye.y + 0.42), 0.25, 0.6); pt.gb.cyl('dark', 0.005, 0.005, drop + 0.12, 5, 0, -drop / 2 + 0.06, 0); pt.gb.cylZ('grip', 0.016, 0.11, 10, 0, -drop, 0);
    K.done(pt);
    const c = K.ctl({ id: 'whistle', name: 'Whistle cord', kind: 'hold', part: pt.inner, outer: pt.outer, grip: V(0, -drop, 0),
      show: () => S.whistle > 0.02 ? whistleToPull(S.whistle) * 0.85 + 0.15 : 0, p: () => whistleToPull(S.whistle || 0.62), setP: p => { S.whistle = pullToWhistle(p); },
      pose: p => { pt.inner.position.y = -p * 0.1; }, press: () => { S.whistle = 0.62; }, release: () => { S.whistle = 0; },
      label: () => 'Whistle cord · pull down for more' });
    c.poseP = p => c.pose(p * 0.85 + 0.15);
    K.hit(pt, c, 0.14, 0.16, 0.14, 0, -drop + 0.03, 0);
  }

  /* ---- seats: tall seat boxes with padded cushions and backs ---- */
  const seatTop = eye.y - 0.8;
  for (const sd of [-1, 1]) {
    const xa = eye.x + 0.13, xb = eye.x - 0.37, xm = (xa + xb) / 2, z0 = 1.03, z1 = wallZ + 0.002, zm = sd * (z0 + z1) / 2;
    gb.box('dark', xa - xb, seatTop - 0.12 - ffl + 0.01, z1 - z0, xm, (seatTop - 0.12 + ffl - 0.01) / 2, zm);
    gb.box('cabInt', xa - xb + 0.02, 0.12, z1 - z0 - 0.02, xm, seatTop - 0.06, zm);
    gb.box('cabInt', 0.07, 0.46, 0.42, xb + 0.045, seatTop + 0.23, sd * 1.27);
    gb.box('dark', 0.05, 0.04, z1 - z0, xa + 0.02, ffl + 0.32, zm);                         // foot rail
  }
  // cab lamp in the middle of the roof
  { const xl = F - 0.9, yt = d.ceil(0) + 0.01; gb.cyl('dark', 0.05, 0.05, 0.05, 12, xl, yt - 0.025, 0); gb.add('white', new THREE.SphereGeometry(0.045, 12, 6, 0, TAU, Math.PI / 2, Math.PI / 2).translate(xl, yt - 0.05, 0)); }

  return K.out(eye, { firePos, fireSize, look: [{ yaw: 0.06, pitch: -0.04 }, { yaw: 0.75, pitch: -0.32 }] });
}

/* ======================= the diesel's cab ======================= */
/* d: dx (model x from distance a back from the nose), CAB0, CAB1, FL (floor top), W (half width to the wall's centre),
   sill (windshield foot), ceil (ceiling), lead (live screens only on the lead unit) */
function dieselCab(gb, body, d) {
  cabMaterials();
  const K = new CabKit(gb, body), dx = d.dx, FL = d.FL, wallZ = d.W - 0.03;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const box = (k, a0, a1, y0, y1, z0, z1) => gb.box(k, Math.abs(a1 - a0), Math.abs(y1 - y0), Math.abs(z1 - z0), dx((a0 + a1) / 2), (y0 + y1) / 2, (z0 + z1) / 2);
  const eye = V(dx(4.15), 3.98, 0.86);

  /* ---- console across the front: tucked under the nose roof, its face sloped back toward the crew ---- */
  const aF = d.CAB0 - 0.17, aT = d.CAB0 + 0.38, aS = d.CAB0 + 0.65, yTop = d.sill - 0.015, yS = 3.22;
  {
    const s = new THREE.Shape();
    s.moveTo(dx(aF), FL - 0.03); s.lineTo(dx(aF), yTop); s.lineTo(dx(aT), yTop); s.lineTo(dx(aS), yS); s.lineTo(dx(aS), FL - 0.03); s.closePath();
    const zw = wallZ + 0.005, g = new THREE.ExtrudeGeometry(s, { depth: 2 * zw, bevelEnabled: false }); g.translate(0, 0, -zw); gb.add('dDesk', g);
    box('dUnder', aS - 0.01, aS + 0.005, FL - 0.03, FL + 0.12, -zw, zw);                 // kick plate
  }
  // the sloped face: a frame for each screen and a row of switches under the engineer's
  const sl0 = V(dx(aT), yTop, 0), sl1 = V(dx(aS), yS, 0), along = sl1.clone().sub(sl0), sLen = along.length(); along.normalize();
  const sn = V(along.y, -along.x, 0).normalize(); if (sn.y < 0) sn.negate();          // the face's normal, up and back
  const onSlope = (t, z, off = 0) => sl0.clone().addScaledVector(along, t * sLen).addScaledVector(sn, off).setZ(z);
  const slopeFrame = (t, z, off) => faceFrame(onSlope(t, z, off), sn, along.clone().negate());
  const screenAt = (t, z, w, h, key, read) => {
    const m = slopeFrame(t, z, 0.0);
    gb.add('dUnder', new THREE.BoxGeometry(w + 0.04, h + 0.04, 0.03).translate(0, 0, 0.0), m);
    gb.add(key, new THREE.PlaneGeometry(w, h).translate(0, 0, 0.0155), m);
    const holder = new THREE.Group(); holder.matrixAutoUpdate = false; holder.matrix.copy(m); body.add(holder);
    K.hit(holder, K.ctl({ id: 'screen', kind: 'info', label: read }), w, h, 0.05, 0, 0, 0.02);
  };
  const sw = 0.36, shh = 0.26, tS = 0.36;
  let lt = null, rt = null;
  if (d.lead) {
    lt = canvasTex(512, 370, g => { g.fillStyle = '#05080a'; g.fillRect(0, 0, 512, 370); }); rt = canvasTex(512, 370, g => { g.fillStyle = '#05080a'; g.fillRect(0, 0, 512, 370); });
    RMAT['scrL' + d.uid] = new THREE.MeshBasicMaterial({ map: lt }); RMAT['scrR' + d.uid] = new THREE.MeshBasicMaterial({ map: rt });
    K.screens.push({ tex: lt, kind: 'power' }, { tex: rt, kind: 'air' });
  }
  screenAt(tS, 0.8, sw, shh, d.lead ? 'scrL' + d.uid : 'screen', () => CAB_READ.power());
  screenAt(tS, 1.2, sw, shh, d.lead ? 'scrR' + d.uid : 'screen', () => CAB_READ.air(GAME.train));
  screenAt(tS, -0.85, sw, shh, d.lead ? 'scrL' + d.uid : 'screen', () => CAB_READ.power());
  // switch panel: headlight, ditch lights, bell, sander, engine run
  {
    const t = 0.86, zs = [0.66, 0.84, 1.0, 1.16, 1.34], names = ['HEADLIGHT', 'DITCH', 'BELL', 'SAND', 'ENGINE'];
    const lab = canvasTex(512, 48, (g, w, h) => { g.fillStyle = '#1d2022'; g.fillRect(0, 0, w, h); g.fillStyle = '#d8d8d0'; g.font = 'bold 19px "IBM Plex Sans Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; names.forEach((n, i) => g.fillText(n, (zs[i] - 0.57) / 0.86 * w, h / 2)); });
    RMAT.swLabel = RMAT.swLabel || new THREE.MeshStandardMaterial({ map: lab, metalness: 0.1, roughness: 0.6 });
    gb.add('swLabel', new THREE.PlaneGeometry(0.86, 0.035).translate(0, 0, 0.002), slopeFrame(0.73, 1.0, 0));
    gb.add('dUnder', new THREE.BoxGeometry(0.86, 0.08, 0.012).translate(0, 0, 0.006), slopeFrame(t, 1.0, 0));
    const defs = [
      { id: 'light', name: 'Headlight', get: () => S.light / 2, tap: () => { S.light = (S.light + 1) % 3; }, txt: () => ['off', 'dim', 'bright'][S.light], rot: true },
      { id: 'ditch', name: 'Ditch lights', get: () => S.ditch ? 1 : 0, tap: () => { S.ditch = !S.ditch; }, txt: () => S.ditch ? 'on' : 'off' },
      { id: 'bell', name: 'Bell', get: () => S.bell ? 1 : 0, tap: () => { S.bell = !S.bell; }, txt: () => S.bell ? 'ringing' : 'off' },
      { id: 'sander', name: 'Sander', get: () => S.sander ? 1 : 0, tap: () => { S.sander = !S.sander; }, txt: () => S.sander ? 'sanding' : 'off' },
      { id: 'engine', name: 'Engine run', get: () => (S.engineRun || S.crank > 0) ? 1 : 0, tap: () => { const b = $('btnInj'); if (b) b.click(); }, txt: () => S.crank > 0 ? 'starting' : (S.engineRun ? 'running' : 'shut down') },
    ];
    defs.forEach((o, i) => {
      const m = slopeFrame(t, zs[i], 0.012), pt = K.part(V());
      pt.outer.matrixAutoUpdate = false; pt.outer.matrix.copy(m);
      if (o.rot) { pt.gb.add('knob', new THREE.CylinderGeometry(0.024, 0.026, 0.025, 14).rotateX(Math.PI / 2).translate(0, 0, 0.0125)); pt.gb.box('handle', 0.008, 0.03, 0.006, 0, 0.008, 0.027); }
      else { pt.gb.box(o.id === 'engine' ? 'redKnob' : 'knob', 0.03, 0.022, 0.02, 0, 0, 0.01); pt.gb.box('handle', 0.008, 0.024, 0.006, 0, 0.0, 0.022); }
      K.done(pt);
      const c = K.ctl({ id: o.id, name: o.name, kind: 'toggle', part: pt.inner, outer: pt.outer, grip: V(0, 0, 0.02),
        show: o.get, pose: o.rot ? (p => { pt.inner.rotation.z = (0.5 - p) * 1.6; }) : (p => { pt.inner.rotation.x = (p - 0.5) * 0.9; }),
        tap: o.tap, label: () => o.name + ' · ' + o.txt() });
      K.hit(pt, c, 0.07, 0.08, 0.06, 0, 0, 0.02);
    });
  }

  /* ---- AAR control stand on the engineer's left: brake valves forward, throttle and dynamic brake facing him ---- */
  const A0 = d.CAB0 + 0.38, A1 = d.CAB0 + 1.26, Am = d.CAB0 + 0.98, z0 = 0.3, z1 = 0.56, yLow = 3.45, yHigh = 3.62;
  {
    box('dDesk', A0, A1, FL - 0.01, yLow, z0, z1);
    box('dDesk', A0, Am, yLow - 0.01, yHigh, z0, z1);
    box('dSteel', A0 + 0.03, Am - 0.02, yHigh, yHigh + 0.04, z0 - 0.02, z1 + 0.02);           // 26L valve top
    box('dUnder', aS + 0.08, A1 - 0.06, FL + 0.1, yLow - 0.34, z1, z1 + 0.004);              // access door
  }
  // automatic brake
  {
    const pa = K.part(V(dx(A0 + 0.25), yHigh + 0.04, 0.36));
    pa.gb.cyl('dSteel', 0.03, 0.035, 0.04, 14, 0, 0.02, 0); pa.gb.box('handle', 0.2, 0.02, 0.026, -0.1, 0.03, 0); pa.gb.cyl('knob', 0.02, 0.02, 0.06, 10, -0.2, 0.05, 0);
    K.done(pa);
    const c = K.ctl({ id: 'brake', name: 'Automatic brake', kind: 'lever', part: pa.inner, outer: pa.outer, grip: V(-0.2, 0.05, 0),
      show: () => S.brakeH, p: () => ctlTravel(CTL.brake, false), setP: p => { ctlSetTravel(CTL.brake, false, p); GAME.controlTouched('lvBrake'); },
      pose: p => { pa.inner.rotation.y = 0.35 - 1.6 * p; }, label: () => 'Automatic brake · ' + CTL.brake.label(S.brakeH) });
    K.hit(pa, c, 0.12, 0.08, 0.08, -0.17, 0.05, 0);
  }
  // independent, on a raised boss so it swings clear above the automatic
  {
    const bxx = dx(A0 + 0.42);
    gb.cyl('dSteel', 0.035, 0.035, 0.08, 14, bxx, yHigh + 0.08, 0.5);
    const pi = K.part(V(bxx, yHigh + 0.12, 0.5));
    pi.gb.cyl('dSteel', 0.03, 0.03, 0.03, 12, 0, 0.0, 0); pi.gb.box('handle', 0.15, 0.018, 0.024, -0.075, 0.01, 0); pi.gb.cyl('knob', 0.018, 0.018, 0.05, 10, -0.15, 0.03, 0);
    K.done(pi);
    const c = K.ctl({ id: 'ind', name: 'Independent brake', kind: 'lever', part: pi.inner, outer: pi.outer, grip: V(-0.15, 0.03, 0),
      show: () => S.indH, p: () => ctlTravel(CTL.ind, false), setP: p => { ctlSetTravel(CTL.ind, false, p); GAME.controlTouched('lvInd'); },
      pose: p => { pi.inner.rotation.y = 0.4 - 1.3 * p; }, label: () => 'Independent brake · ' + CTL.ind.label(S.indH) });
    K.hit(pi, c, 0.06, 0.07, 0.06, -0.15, 0.03, 0);                                     // the knob only: the automatic sits just below
  }
  // throttle and dynamic brake: handles out of the stand's face, swung back toward the engineer
  const plateD = (y, ticks) => {
    const s = new THREE.Shape(); s.absarc(0, 0, 0.17, -Math.PI / 2, Math.PI / 2, false); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: false, curveSegments: 16 });
    // shape x -> out of the face (+z), shape y -> back (+a, -x); extrusion goes down
    g.rotateX(Math.PI / 2); g.rotateY(-Math.PI / 2);
    g.translate(dx(Am + 0.03), y, z1); gb.add('dSteel', g);
    for (let i = 0; i <= ticks; i++) { const a = i / ticks * 0.95; gb.box('dUnder', 0.006, 0.004, 0.03, dx(Am + 0.03) - Math.sin(a) * 0.15, y + 0.002, z1 + Math.cos(a) * 0.15, 0, -a, 0); }
  };
  const handleOut = (y, len, knobKey) => {
    const pt = K.part(V(dx(Am + 0.03), y, z1));
    pt.gb.cyl('dSteel', 0.022, 0.022, 0.03, 10, 0, 0, 0.01); pt.gb.box('handle', 0.024, 0.02, len, 0, 0, len / 2); pt.gb.cyl(knobKey, 0.022, 0.022, 0.07, 10, 0, 0.02, len);
    return pt;
  };
  {
    plateD(yLow - 0.11, 8);
    const pt = handleOut(yLow - 0.09, 0.22, 'knob'); K.done(pt);
    const c = K.ctl({ id: 'throttle', name: 'Throttle', kind: 'lever', part: pt.inner, outer: pt.outer, grip: V(0, 0.02, 0.22),
      show: () => S.throttle, p: () => ctlTravel(CTL.throttle, true), setP: p => { ctlSetTravel(CTL.throttle, true, p); GAME.controlTouched('lvThrottle'); },
      pose: p => { pt.inner.rotation.y = -p * 0.95; }, label: () => 'Throttle · ' + CTL.throttle.label(S.throttle) });
    K.hit(pt, c, 0.09, 0.08, 0.14, 0, 0.01, 0.17);
  }
  {
    plateD(yLow - 0.27, 2);
    const pt = handleOut(yLow - 0.25, 0.18, 'redKnob'); K.done(pt);
    const c = K.ctl({ id: 'dyn', name: 'Dynamic brake', kind: 'lever', part: pt.inner, outer: pt.outer, grip: V(0, 0.02, 0.18),
      show: () => S.dyn, p: () => ctlTravel(CTL.dyn, false), setP: p => { ctlSetTravel(CTL.dyn, false, p); GAME.controlTouched('lvDyn'); },
      pose: p => { pt.inner.rotation.y = -p * 0.95; }, label: () => 'Dynamic brake · ' + CTL.dyn.label(S.dyn) });
    K.hit(pt, c, 0.09, 0.08, 0.12, 0, 0.01, 0.14);
  }
  // reverser on top, and the horn lever behind it
  {
    box('dSteel', Am + 0.02, Am + 0.18, yLow, yLow + 0.04, 0.37, 0.49);
    box('dUnder', Am + 0.03, Am + 0.17, yLow + 0.04, yLow + 0.042, 0.42, 0.44);              // slot
    const pt = K.part(V(dx(Am + 0.1), yLow + 0.03, 0.43));
    pt.gb.box('handle', 0.02, 0.15, 0.03, 0, 0.075, 0); pt.gb.box('knob', 0.05, 0.035, 0.04, 0, 0.15, 0);
    K.done(pt);
    const c = K.ctl({ id: 'reverser', name: 'Reverser', kind: 'lever', part: pt.inner, outer: pt.outer, grip: V(0, 0.15, 0),
      show: () => S.reverser, p: () => ctlTravel(CTL.reverser, false), setP: p => { ctlSetTravel(CTL.reverser, false, p); GAME.controlTouched('lvReverser'); },
      pose: v => { pt.inner.rotation.z = -v * 0.42; }, label: () => 'Reverser · ' + CTL.reverser.label(S.reverser) });
    c.poseP = p => c.pose(1 - 2 * p);
    K.hit(pt, c, 0.08, 0.12, 0.07, 0, 0.12, 0);
    box('dSteel', Am + 0.2, Am + 0.27, yLow, yLow + 0.03, 0.39, 0.47);
    const ph = K.part(V(dx(Am + 0.235), yLow + 0.025, 0.43));
    ph.gb.box('handle', 0.016, 0.11, 0.02, 0, 0.055, 0); ph.gb.cyl('knob', 0.016, 0.016, 0.05, 8, 0, 0.11, 0, Math.PI / 2, 0, 0);
    K.done(ph);
    const h = K.ctl({ id: 'horn', name: 'Horn', kind: 'hold', part: ph.inner, outer: ph.outer, grip: V(0, 0.11, 0),
      show: () => S.whistle > 0.02 ? whistleToPull(S.whistle) * 0.8 + 0.2 : 0, p: () => whistleToPull(S.whistle || 0.62), setP: p => { S.whistle = pullToWhistle(p); },
      pose: p => { ph.inner.rotation.z = p * 0.6; }, press: () => { S.whistle = 0.62; }, release: () => { S.whistle = 0; }, label: () => 'Horn · pull back for more' });
    h.poseP = p => h.pose(p * 0.8 + 0.2);
    K.hit(ph, h, 0.07, 0.12, 0.07, 0, 0.08, 0);
  }

  /* ---- seats on pedestals ---- */
  const seatTop = eye.y - 0.76;
  for (const sd of [-1, 1]) {
    const x = dx(4.25), z = sd * 0.86;
    gb.cyl('dSteel', 0.2, 0.22, 0.03, 16, x, FL + 0.015, z);
    gb.cyl('dSteel', 0.045, 0.045, seatTop - 0.08 - FL, 10, x, (seatTop - 0.08 + FL) / 2, z);
    gb.box('dDesk', 0.5, 0.09, 0.5, x, seatTop - 0.045, z);
    gb.box('dDesk', 0.08, 0.6, 0.46, x - 0.27, seatTop + 0.29, z);
    gb.box('dSteel', 0.14, 0.04, 0.06, x - 0.21, seatTop + 0.02, z);                        // back support
  }
  return K.out(eye, { look: [{ yaw: 0.0, pitch: -0.1 }, { yaw: 0.45, pitch: -0.42 }] });
}

/* ---------------- the diesel's displays ---------------- */
function drawCabScreen(sc, T) {
  const c = sc.tex.image, g = c.getContext('2d'), w = c.width, h = c.height;
  g.fillStyle = '#05080a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#16252c'; g.fillRect(0, 0, w, 44);
  g.font = 'bold 24px "IBM Plex Mono", monospace'; g.textBaseline = 'middle'; g.textAlign = 'left';
  const bar = (x, y, bw, bh, f, col, bg = '#14202a') => { g.fillStyle = bg; g.fillRect(x, y, bw, bh); g.fillStyle = col; g.fillRect(x, y, bw * clamp(f, 0, 1), bh); };
  if (sc.kind === 'power') {
    const dir = S.reverser > 0.5 ? 'FWD' : S.reverser < -0.5 ? 'REV' : 'NEUT';
    g.fillStyle = dir === 'NEUT' ? '#e8c23a' : '#7fe0a0'; g.fillText(dir, 14, 23);
    g.textAlign = 'right'; g.fillStyle = S.slipCtl ? '#ff6b5a' : '#cfe9d8'; g.fillText(S.slipCtl ? 'WHEEL SLIP' : (S.dyn > 0.06 ? 'DB ' + Math.round(S.dbLoad * 100) + '%' : S.notch ? 'NOTCH ' + S.notch : 'IDLE'), w - 14, 23);
    const mph = Math.abs(S.v) / MPH;
    // speed arc
    const cx = 150, cyy = 200, r = 110;
    g.lineWidth = 16; g.strokeStyle = '#14202a'; g.beginPath(); g.arc(cx, cyy, r, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
    g.strokeStyle = mph > 72 ? '#ff6b5a' : '#3fae74'; g.beginPath(); g.arc(cx, cyy, r, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * clamp(mph / 80, 0, 1)); g.stroke();
    g.fillStyle = '#5d7480'; g.font = '600 15px "IBM Plex Mono", monospace'; g.textAlign = 'center';
    for (let v = 0; v <= 80; v += 20) { const a = Math.PI * 0.75 + Math.PI * 1.5 * v / 80; g.fillText(String(v), cx + Math.cos(a) * (r - 30), cyy + Math.sin(a) * (r - 30)); }
    g.fillStyle = '#eef6f1'; g.font = 'bold 74px "IBM Plex Mono", monospace'; g.fillText(String(Math.round(mph)), cx, cyy + 6);
    g.fillStyle = '#8fb3a0'; g.font = '600 20px "IBM Plex Sans Condensed", Arial, sans-serif'; g.fillText('MPH', cx, cyy + 56);
    // tractive effort and dynamic brake
    const nU = (T && T.nUnits) || 1, te = Math.abs(S.TE) / LBF / 1000, db = S.DBF * nU / LBF / 1000;
    g.textAlign = 'left'; g.fillStyle = '#8fb3a0'; g.font = '600 18px "IBM Plex Sans Condensed", Arial, sans-serif';
    g.fillText('TRACTIVE EFFORT', 290, 76); bar(290, 92, 200, 22, te / (200 * nU), '#3fae74');
    g.fillText('DYNAMIC BRAKE', 290, 136); bar(290, 152, 200, 22, db / (120 * nU), '#e8a33a');
    g.fillStyle = '#eef6f1'; g.font = 'bold 22px "IBM Plex Mono", monospace';
    g.fillText(Math.round(te) + ' klbf', 290, 192); g.fillText(Math.round(S.amps) + ' A', 290, 222);
    g.fillStyle = '#8fb3a0'; g.font = '600 18px "IBM Plex Mono", monospace';
    g.fillText(Math.round(S.rpm) + ' RPM', 290, 262); g.fillText('FUEL ' + Math.round(S.fuel / 3.785).toLocaleString() + ' GAL', 290, 292);
    g.fillStyle = S.engineRun ? '#7fe0a0' : (S.crank > 0 ? '#e8c23a' : '#ff6b5a'); g.fillText(S.engineRun ? 'ENGINE RUN' : (S.crank > 0 ? 'CRANKING' : 'ENGINE OFF'), 290, 322);
    g.fillStyle = '#5d7480'; g.fillText(nU > 1 ? nU + ' UNITS' : '1 UNIT', 290, 350);
  } else {
    g.fillStyle = '#cfe9d8'; g.fillText('AIR BRAKE', 14, 23);
    g.textAlign = 'right'; const z = brakeZone(S.brakeH); g.fillStyle = z === 'EMG' ? '#ff6b5a' : (z === 'REL' || z === 'RUN' ? '#7fe0a0' : '#e8c23a'); g.fillText({ REL: 'RELEASE', RUN: 'RUNNING', LAP: 'LAP', SRV: 'SERVICE', EMG: 'EMERGENCY' }[z], w - 14, 23);
    const rows = [['MR', S.MR, 160, '#ff8a6a'], ['EQ', S.ER, 160, '#cfe9d8'], ['BP', T ? T.lead.brake.BP : 90, 160, '#cfe9d8'], ['BC', S.BCloco || 0, 80, '#ff8a6a'], ['EOT', rearBP(T), 160, '#9fc7d6']];
    rows.forEach(([k, v, mx, col], i) => {
      const y = 74 + i * 58;
      g.textAlign = 'left'; g.fillStyle = '#8fb3a0'; g.font = '600 22px "IBM Plex Sans Condensed", Arial, sans-serif'; g.fillText(k, 18, y + 12);
      bar(80, y, 300, 26, v / mx, col);
      g.textAlign = 'right'; g.fillStyle = '#eef6f1'; g.font = 'bold 28px "IBM Plex Mono", monospace'; g.fillText(String(Math.round(v)), w - 18, y + 13);
    });
  }
  sc.tex.needsUpdate = true;
}

/* ======================= running the cab ======================= */
CAB.grab = null; CAB.hover = null; CAB.scrT = 0; CAB.lookTo = null; CAB.look = 0;
const _cr = new THREE.Raycaster(), _cv = new THREE.Vector2(), _cw = new THREE.Vector3(), _s0 = new THREE.Vector2(), _s1 = new THREE.Vector2(), _cWm = new THREE.Matrix4(), _cWd = new THREE.Vector3();
/* the player's own cab, when the camera is in it */
CAB.live = function () {
  const T = GAME.train;
  return T && T.loco.cab && CAM.mode === 'cab' && !MP.view() ? T.loco.cab : null;
};
CAB.pick = function (x, y) {
  const cab = CAB.live(); if (!cab) return null;
  _cv.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); _cr.setFromCamera(_cv, camera); _cr.near = 0; _cr.far = 4;
  const hs = _cr.intersectObjects(cab.hits, false); if (!hs.length) return null;
  // handles that cross (a brake handle swung over its neighbour's knob): take the one whose grip is aimed nearest
  let best = hs[0], bd = Infinity;
  for (const h of hs) {
    if (h.distance > hs[0].distance + 0.3) break;
    const c = h.object.userData.ctl, d = _cr.ray.distanceSqToPoint(c.grip ? _cw.copy(c.grip).applyMatrix4(c.part.matrixWorld) : h.object.getWorldPosition(_cw));
    if (d < bd) { bd = d; best = h; }
  }
  return best.object.userData.ctl;
};
CAB.screenOf = function (c, p, out) {
  (c.poseP || c.pose)(p); c.outer.updateMatrixWorld(true);
  _cw.copy(c.grip).applyMatrix4(c.part.matrixWorld).project(camera);
  return out.set((_cw.x + 1) / 2 * innerWidth, (1 - _cw.y) / 2 * innerHeight);
};
CAB.highlight = function (c, on) {
  if (!c || !c.part) return;
  c.part.traverse(o => { if (!o.isMesh || o.material === RMAT.hit) return; if (on) { if (!o.userData.mat) o.userData.mat = o.material; o.material = RMAT.cabHi; } else if (o.userData.mat) { o.material = o.userData.mat; o.userData.mat = null; } });
};
CAB.tip = function (c, x, y) {
  const tip = $('cplTip');
  if (!c) { tip.hidden = true; return; }
  tip.textContent = c.label(); tip.hidden = false;
  if (x !== undefined) { CAB.tipAt = [x, y]; tip.style.left = Math.min(innerWidth - tip.offsetWidth - 8, x + 14) + 'px'; tip.style.top = Math.max(8, y - 34) + 'px'; }
};
/* pointer down on the view: grab a control. Returns true when one was there. */
CAB.down = function (x, y, pid) {
  const c = CAB.pick(x, y); if (!c || c.kind === 'info') return false;
  CAB.grab = { c, pid, x, y, sx: x, sy: y, raw: c.p ? c.p() : 0, moved: 0 };
  if (c.kind === 'hold') { c.press(); CAB.grab.raw = c.p(); }
  if (CAB.hover && CAB.hover !== c) CAB.highlight(CAB.hover, false);
  CAB.hover = c; CAB.highlight(c, true); CAB.tip(c, x, y);
  GAME.refreshKeys();
  return true;
};
CAB.move = function (x, y) {
  const g = CAB.grab, c = g.c;
  g.moved = Math.max(g.moved, Math.hypot(x - g.sx, y - g.sy));
  if ((c.kind === 'lever' || c.kind === 'hold') && (c.kind === 'hold' || g.moved > 3)) {
    const h = 0.03, a = clamp(g.raw - h, 0, 1), b = clamp(g.raw + h, 0, 1);
    CAB.screenOf(c, a, _s0); CAB.screenOf(c, b, _s1);
    if (c.wheel) {   // a handwheel turns with the pointer going round its hub, measured in the wheel's own plane
      const [ax, k] = c.wheel; c.pose(c.cur); c.outer.updateMatrixWorld(true);
      const inv = _cWm.copy(c.outer.matrixWorld).invert(), at = (u, v) => {
        _cv.set(u / innerWidth * 2 - 1, -(v / innerHeight) * 2 + 1); _cr.setFromCamera(_cv, camera);
        const o = _cw.copy(_cr.ray.origin).applyMatrix4(inv), dir = _cWd.copy(_cr.ray.direction).transformDirection(inv), dn = dir.getComponent(ax);
        if (Math.abs(dn) < 0.3) return null;   // seen edge on: fall back to dragging the rim
        o.addScaledVector(dir, -o.getComponent(ax) / dn);
        const a = o.getComponent((ax + 1) % 3), b = o.getComponent((ax + 2) % 3);
        return Math.hypot(a, b) > 0.01 ? Math.atan2(b, a) : null;
      };
      const a0 = at(g.x, g.y), a1 = a0 === null ? null : at(x, y);
      if (a1 !== null) { g.raw = clamp(g.raw + Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)) / k, 0, 1); c.setP(g.raw); g.x = x; g.y = y; CAB.tip(c, x, y); return; }
    }
    c.pose(c.cur);
    const ddx = (_s1.x - _s0.x) / (b - a), ddy = (_s1.y - _s0.y) / (b - a), L2 = Math.max(ddx * ddx + ddy * ddy, 6400);
    g.raw = clamp(g.raw + ((x - g.x) * ddx + (y - g.y) * ddy) / L2, 0, 1);
    c.setP(g.raw);
  }
  g.x = x; g.y = y;
  CAB.tip(c, x, y);
};
CAB.up = function () {
  const g = CAB.grab; if (!g) return; const c = g.c;
  if (c.kind === 'toggle' && g.moved < 12) c.tap();
  else if (c.kind === 'lever' && g.moved < 4 && c.tap) c.tap();
  if (c.kind === 'hold') c.release();
  CAB.grab = null;
  GAME.refreshKeys();
  if (!CAB.mouse) { CAB.highlight(c, false); CAB.hover = null; setTimeout(() => { if (!CAB.hover) CAB.tip(null); }, 900); }
};
/* mouse hover: light up what a click would work and say what it reads. True when over the cab. */
CAB.point = function (x, y) {
  CAB.mouse = true;
  const c = x === null ? null : CAB.pick(x, y);
  if (CAB.hover !== c) { CAB.highlight(CAB.hover, false); if (c && c.kind !== 'info') CAB.highlight(c, true); CAB.hover = c; }
  $('gl').style.cursor = c ? (c.kind === 'info' ? 'help' : (c.kind === 'toggle' ? 'pointer' : 'grab')) : '';
  if (c) CAB.tip(c, x, y); else if (CAB.tipAt) { CAB.tip(null); CAB.tipAt = null; }
  return !!c;
};
/* a tap on a gauge or display says what it reads */
CAB.tapInfo = function (x, y) {
  const c = CAB.pick(x, y); if (!c || c.kind !== 'info') return false;
  CAB.tip(c, x, y); clearTimeout(CAB.tipT); CAB.tipT = setTimeout(() => CAB.tip(null), 2200);
  return true;
};
/* entering the cab: look out ahead. N swings between the road and the controls. */
CAB.enter = function () {
  const T = GAME.train, cab = T && T.loco.cab; if (!cab) return;
  CAB.look = 0; CAM.cabYaw = cab.look[0].yaw; CAM.cabPitch = cab.look[0].pitch; CAB.lookTo = null;
};
CAB.nextLook = function () {
  const T = GAME.train, cab = T && T.loco.cab; if (!cab || CAM.mode !== 'cab') return;
  CAB.look = (CAB.look + 1) % cab.look.length; CAB.lookTo = cab.look[CAB.look];
};
/* every frame: needles, levers and the water glass follow the simulation */
CAB.frame = function (dt, T) {
  const cab = T && T.loco.cab; if (!cab) return;
  const k = 1 - Math.exp(-dt * 16), kn = 1 - Math.exp(-dt * 9);
  for (const c of cab.ctls) {
    if (!c.pose || (CAB.grab && CAB.grab.c === c && c.kind !== 'hold' && c.kind !== 'toggle')) { if (c.pose && c.show) { c.cur = c.show(); c.pose(c.cur); } continue; }
    const t = c.show(); c.cur = Math.abs(t - c.cur) < 1e-4 ? t : c.cur + (t - c.cur) * k; c.pose(c.cur);
  }
  for (const dl of cab.dials) for (const hd of dl.hands) {
    const a = dialAngle(hd.fn(), hd.max);
    hd.a = hd.a === null ? a : hd.a + (a - hd.a) * kn; hd.inner.rotation.z = hd.a;
  }
  const lvl = glassLevel(S.W), bob = Math.sin(S.time * 9) * 0.004 * Math.min(1, Math.abs(S.v) / 8);
  for (const gl of cab.glasses) gl.mesh.scale.y = Math.max(0.001, gl.h * clamp(lvl + bob, 0, 1));
  const lamp = smooth(0.2, 0.6, SKY.dark) * 0.55;
  for (const m of CAB.lamps) m.emissiveIntensity = lamp;
  if (CAB.lookTo) {
    const lk = CAB.lookTo, a = 1 - Math.exp(-dt * 6);
    CAM.cabYaw += (lk.yaw - CAM.cabYaw) * a; CAM.cabPitch += (lk.pitch - CAM.cabPitch) * a;
    if (Math.abs(lk.yaw - CAM.cabYaw) + Math.abs(lk.pitch - CAM.cabPitch) < 0.002) CAB.lookTo = null;
  }
  if (cab.screens.length && CAM.mode === 'cab') {
    CAB.scrT -= dt;
    if (CAB.scrT <= 0) { CAB.scrT = 0.15; for (const sc of cab.screens) drawCabScreen(sc, T); }
  }
  if (CAB.hover && CAB.tipAt && !$('cplTip').hidden) CAB.tip(CAB.hover);
};
