/* Nothing that moves on a locomotive may pass through anything else. Each engine is posed through a turn of its
   wheels in forward, mid and back gear, and every moving piece (wheels, rods, valve gear, reverse gear) is tested
   against every piece outside its own group. Parts that are pinned or slide in one another meet by design, so
   each such joint is named below with how deep it may reach; anything else deeper than 12 mm fails.
   Run with: node --test tests/     (CLIP_DUMP=1 lists every contact found, allowed or not) */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('./geocheck');
const C = require('./clipcheck');

const kind = p => p.tag.split('#')[0];
/* joints between two moving parts: [kind, kind, deepest allowed (m)] */
const PINS = [
  ['cross', 'piston', 0.07], ['cross', 'main', 0.03], ['driver', 'main', 0.08], ['driver', 'side', 0.08], ['side', 'side', 0.03], ['driver', 'ecc', 0.05],
  ['ecc', 'eccRod', 0.04], ['driver', 'eccRod', 0.035], ['cross', 'union', 0.03], ['comb', 'union', 0.035], ['comb', 'vstem', 0.065],
  // Baker gear (Berkshires)
  ['eccRod', 'gcr', 0.035], ['rbar', 'yoke', 0.04], ['bell', 'gcr', 0.03], ['bell', 'vrod', 0.03], ['comb', 'vrod', 0.035], ['rarm', 'reach', 0.03],
  // Walschaerts gear (Big Boy)
  ['eccRod', 'link', 0.025], ['link', 'rrod', 0.06], ['comb', 'rrod', 0.035], ['lifter', 'rrod', 0.035], ['lifter', 'rarm', 0.03],
];
/* joints between a moving part and the engine: a wheel on its axle in the boxes, a part on its own pivot, a rod
   sliding in its bore. Each is allowed only where the joint is: measured from the part's own pivot. */
const AXLE = new Set(['driver', 'lead', 'trail', 'wheel']), PIVOT = new Set(['bell', 'yoke', 'rarm', 'link', 'rrod']), SLIDE = { piston: 1, vstem: 1, reach: -1 };
function jointed(c) {
  const a = c.a.tag ? c.a : c.b, b = c.a.tag ? c.b : c.a;
  if (b.tag) { const ka = kind(a), kb = kind(b); return PINS.some(([p, q, d]) => ((p === ka && q === kb) || (p === kb && q === ka)) && c.d <= d); }
  const k = kind(a), dx = c.at.x - a.org.x, dy = c.at.y - a.org.y;
  if (AXLE.has(k)) return Math.hypot(dx, dy) < 0.2 && c.d < 0.16;
  if (PIVOT.has(k)) return Math.hypot(dx, dy) < 0.13 && c.d < 0.09;
  if (SLIDE[k]) return Math.abs(dy) < 0.1 && dx * SLIDE[k] > -0.25;
  return false;
}
/* pose the model with each of `poses` and list the contacts that are not joints */
function sweep(groups, movers, poses) {
  const keep = new Map(), bad = new Map(), all = new Map();
  for (const pose of poses) {
    pose();
    for (const g of groups) for (const c of C.clips(C.posedPieces(g, movers, keep))) {
      const k = `${C.name(c.a)} x ${C.name(c.b)}`, m = jointed(c) ? all : bad, e = m.get(k);
      if (!e || c.d > e.d) m.set(k, { d: c.d, at: c.at });
    }
  }
  const fmt = m => [...m].sort((a, b) => b[1].d - a[1].d).map(([k, e]) => `${(e.d * 100).toFixed(1)} cm  ${k}  at ${e.at.toArray().map(n => n.toFixed(2)).join(',')}`);
  if (process.env.CLIP_DUMP) console.log(fmt(all).map(s => '  joint ' + s).join('\n'));
  return fmt(bad);
}
const tagAll = (movers, o, k, id) => { if (Array.isArray(o)) o.forEach((x, i) => movers.set(x, `${k}#${id}${i}`)); else if (o && o.isObject3D) movers.set(o, `${k}#${id}`); };
/* a turn of the wheels in each gear: six crank positions forward and back (half a step apart), three in mid gear */
function gearPoses(fn) {
  const out = [];
  for (const [rev, n, off] of [[1, 6, 0], [-1, 6, 0.5], [0, 3, 0.25]]) for (let i = 0; i < n; i++) out.push(() => fn(-(i + off) / n * Math.PI * 2, rev));
  return out;
}
const none = (name, bad) => assert.strictEqual(bad.length, 0, `${name}: ${bad.length} moving part(s) pass through something:\n  ${bad.slice(0, 12).join('\n  ')}`);

for (const key of ['765', '1225']) test(`${key}: wheels, rods, Baker gear and reverse gear turn clear of everything`, () => {
  const w = G.world(), L = w.buildBerkshire(key), p = L.parts, movers = new Map();
  tagAll(movers, p.drivers, 'driver', ''); tagAll(movers, p.lead, 'lead', ''); tagAll(movers, p.trail, 'trail', '');
  for (const s of [-1, 1]) for (const [k, o] of Object.entries(p.rods[s])) tagAll(movers, o, k, s > 0 ? 'R' : 'L');
  none(key, sweep([L.root, L.leadTruck], movers, gearPoses((th, rev) => {
    w.animateBerkshire(L, th, rev); p.lead.rotation.z = th * 1.9; p.trail[0].rotation.z = th * 1.9; p.trail[1].rotation.z = th * 1.6;
  })));
});

test('Big Boy: both engines\' wheels, rods, Walschaerts gear and lifting links turn clear of everything', () => {
  const w = G.world(), L = w.buildBigBoy('4014'), p = L.parts, movers = new Map();
  tagAll(movers, p.lead, 'lead', ''); tagAll(movers, p.trail, 'trail', '');
  for (const e of ['f', 'r']) {
    tagAll(movers, p.eng[e].drivers, 'driver', e);
    for (const s of [-1, 1]) for (const [k, o] of Object.entries(p.eng[e].rods[s])) tagAll(movers, o, k, e + (s > 0 ? 'R' : 'L'));
  }
  none('Big Boy', sweep([L.root, L.front, L.leadTruck], movers, gearPoses((th, rev) => w.animateBigBoy(L, -th * w.BB.rD, th, rev, 40))));
});

test('C&O 1308: both engines\' wheels, rods, Walschaerts gear and lifting links turn clear of everything', () => {
  const w = G.world(), L = w.buildMallet('1308'), p = L.parts, movers = new Map();
  tagAll(movers, p.lead, 'lead', ''); tagAll(movers, p.trail, 'trail', '');
  for (const e of ['f', 'r']) {
    tagAll(movers, p.eng[e].drivers, 'driver', e);
    for (const s of [-1, 1]) for (const [k, o] of Object.entries(p.eng[e].rods[s])) tagAll(movers, o, k, e + (s > 0 ? 'R' : 'L'));
  }
  none('C&O 1308', sweep([L.root, L.front, L.leadTruck], movers, gearPoses((th, rev) => w.animateMallet(L, -th * w.ML.rD, th, rev, 40))));
});

test('diesel, turbine and Big Boy tender: every wheel turns clear of its truck, brakes and frame', () => {
  const w = G.world(), bad = [];
  const models = { diesel: w.buildDiesel({ livery: w.LIVERIES.ss, number: 4401, lead: true }), 'turbine cab unit': w.buildTurbineUnit({ unit: 'A', number: 18 }),
    'turbine unit': w.buildTurbineUnit({ unit: 'B', number: 18 }), 'Big Boy tender': w.buildBigBoyTender('4014') };
  for (const [name, M] of Object.entries(models)) {
    const movers = new Map(), top = o => { while (o.parent) o = o.parent; return o; };
    const groups = [M.root, ...[...(M.trucks || []), ...(M.extras || [])].filter(t => t.isObject3D && top(t) !== M.root)];
    assert.ok(M.wheels && M.wheels.length, `${name} has wheels to check`);
    tagAll(movers, M.wheels, 'wheel', '');
    bad.push(...sweep(groups, movers, [0, 0.9, 2.3].map(a => () => { for (const x of M.wheels) x.rotation.z = a; })).map(s => `${name}: ${s}`));
  }
  none('trucks', bad);
});

test('car and tender trucks: the wheels turn clear of the side frames, bolster and brake rigging', () => {
  const w = G.world(), { THREE } = w, bins = w.truckBins(), bad = [], seen = new Set();
  const cars = { tender: w.buildTender('765'), 'turbine tender': w.buildTurbineTender(), coach: w.coachModel(w.LOCO_SPEC['765'], 3010, false), boxcar: w.freightModel('box', 1234, () => 0.5) };
  for (const [name, m] of Object.entries(cars)) for (const t of m.trucks) {
    const sp = t.type === 'four' ? 0.865 : (t.sp || 1.676), id = `${t.type} R${t.R} sp${sp}`;
    if (seen.has(id)) continue; seen.add(id);
    const P = bins[t.type].pieces.map(p => { const q = G.prep(THREE, p.g.clone(), p.k, p.at); q.tag = ''; return q; }), A = w.plainAxle(t.R, true, undefined, w.AXJ);
    (t.type === 'four' ? [-sp, sp] : [-sp, 0, sp]).forEach((dx, i) => { for (const k of ['black', 'tire']) { const q = G.prep(THREE, A[k].clone().translate(dx, t.R, 0), k, 'mesh'); q.tag = 'wheel#' + i; q.org = new THREE.Vector3(dx, t.R, 0); P.push(q); } });
    for (const c of C.clips(P)) if (!jointed(c)) bad.push(`${name} truck (${id}): ${(c.d * 100).toFixed(1)} cm  ${C.name(c.a)} x ${C.name(c.b)}  at ${c.at.toArray().map(n => n.toFixed(2)).join(',')}`);
  }
  assert.ok(seen.size >= 2, 'trucks found to check');
  none('car trucks', bad);
});
