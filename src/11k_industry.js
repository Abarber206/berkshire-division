/* ============================================================================
   Industries and car routing: every freight car carries a load (or none) and
   a waybill to where it goes next. Spot a car at the industry on its bill and,
   once the crew has set it out, the industry loads or unloads it and bills it
   back to Bellevue. Bellevue Yard is the interchange: cars brought in are paid
   for and, after a while, go out again billed to the next customer.
   ========================================================================== */

/* what moves on the division, the car it goes in, and what the railroad is paid per car */
const LADING = {
  grain: { name: 'grain', cars: ['box'], rate: 210 },
  feed: { name: 'feed', cars: ['box'], rate: 165 },
  coal: { name: 'coal', cars: ['hopper'], rate: 150 },
  stone: { name: 'crushed stone', cars: ['hopper', 'gon'], rate: 125 },
  oil: { name: 'fuel oil', cars: ['tank'], rate: 240 },
};
const EMPTY_RATE = 45;           // car hire paid for placing an empty where it was ordered
const IND_WORK = 150;            // seconds an industry takes to load or unload a car once it is set out
const YARD_TURN = 240;           // seconds a car delivered to Bellevue waits before the interchange sends it out again
/* light and loaded weights in short tons, for the car types that carry loads */
const LOAD_TONS = { box: [22, 62], hopper: [20, 92], gon: [24, 88], tank: [27, 70] };

/* the customers along the line. ships: what an empty is loaded with there; takes: loads unloaded there */
const INDUSTRIES = [
  { id: 'elevator', name: 'Fostoria Grain Co.', tag: 'FGC', town: 'Fostoria', track: 'Elevator Track', ships: ['grain'], takes: [], spots: 4 },
  { id: 'kenton', name: 'Kenton Coal & Feed', tag: 'KCF', town: 'Kenton', track: 'Kenton Spur', ships: [], takes: ['coal', 'feed'], spots: 4 },
  { id: 'delphos', name: 'Delphos Oil Co.', tag: 'DOC', town: 'Delphos', track: 'Delphos Spur', ships: [], takes: ['oil'], spots: 3 },
  { id: 'quarry', name: 'Sandusky Valley Stone', tag: 'SVS', town: 'the quarry', track: 'Quarry Storage', ships: ['stone'], takes: [], spots: 6 },
];
const IND_YARD = { id: 'yard', name: 'Bellevue Yard', tag: 'BY', town: 'Bellevue', tracks: ['Yard 1', 'Yard 2', 'Yard 3', 'Yard 4'] };

const IND = { cash: 0, cars: 0, career: { cash: 0, cars: 0 }, hz: 0, log: [] };
IND.on = () => !MP.on && !WORLD.custom && !WORLD.mtn;
IND.def = id => id === 'yard' ? IND_YARD : INDUSTRIES.find(d => d.id === id) || null;
IND.tracks = d => d.tracks || [d.track];
IND.load = function () { try { const o = JSON.parse(localStorage.getItem('bd_ind') || '{}') || {}; IND.career = { cash: +o.cash || 0, cars: +o.cars || 0 }; } catch (e) { IND.career = { cash: 0, cars: 0 }; } };
IND.save = function () { try { localStorage.setItem('bd_ind', JSON.stringify(IND.career)); } catch (e) {} };

/* ---------------- a car's load ---------------- */
const carType = v => (v.made && v.made.type) || v.kind;
IND.carries = v => !!LOAD_TONS[carType(v)];
/* fill or empty a car: the heap in a hopper or gon shows, and the car weighs what it carries */
IND.setLoad = function (v, ld) {
  const type = carType(v), w = LOAD_TONS[type]; if (!w) return;
  v.ld = ld || '';
  v.mass = (v.ld ? w[1] : w[0]) * STON;
  const heap = v.root && v.root.getObjectByName && (v.root.getObjectByName('coal') || v.root.getObjectByName('stoneLoad'));
  if (heap && heap.isMesh) {
    heap.visible = !!v.ld;
    const m = v.ld === 'stone' ? RMAT.stoneLoad : RMAT.coal;
    if (m && heap.material !== m) heap.material = m;
  }
};
/* a car's lading: cars made up with a train (not from the yard) carry what their weight says */
const LADING_OF = { box: 'grain', hopper: 'coal', gon: 'stone', tank: 'oil' };
IND.ld = function (v) {
  if (v.ld !== undefined) return v.ld;
  const w = LOAD_TONS[carType(v)]; return w && v.mass > (w[0] + w[1]) / 2 * STON ? LADING_OF[carType(v)] : '';
};
/* bill a car to a destination (an industry id or 'yard'); the clock and payment start over */
IND.bill = function (v, to) { v.wb = to || ''; v.wt = 0; v.paid = false; CARS.gen++; };
/* one car of a yard cut or a save: "type/lading>destination", e.g. 'tank/oil>delphos' or 'box/>elevator' */
IND.parse = function (spec) {
  const m = /^(\w+)(?:\/(\w*))?(?:>(\w+))?$/.exec(spec) || [];
  return { type: m[1] || spec, ld: m[2] || '', to: m[3] || '' };
};

/* what a car's bill says, in words */
IND.ladingName = v => IND.ld(v) ? (LADING[IND.ld(v)] || { name: IND.ld(v) }).name : '';
IND.describe = function (v) {
  if (!IND.carries(v)) return '';
  const what = IND.ld(v) ? `Loaded, ${IND.ladingName(v)}` : 'Empty';
  const d = v.wb && IND.def(v.wb);
  if (!d) return what;
  const at = IND.at(v);
  if (at === v.wb && v.wb !== 'yard' && v.wt > 0 && v.wt < IND_WORK) return `${what}, ${v.ld && d.takes.includes(v.ld) ? 'unloading' : 'loading'} at ${d.name}`;
  return `${what}, for ${d.name}`;
};

/* ---------------- where a car stands ---------------- */
const cutOfCar = v => CARS.cuts.find(c => c.vehicles.includes(v)) || null;
/* the industry (or the yard) whose track the whole car stands on, set out and clear of every switch; else '' */
IND.at = function (v) {
  const c = cutOfCar(v); if (!c || c.rolling || Math.abs(c.v) > 0.01) return '';
  const ln = v.ptsAll[0] && v.ptsAll[0].tp.e.line; if (!ln) return '';
  if (!v.ptsAll.every(p => p.tp.e.line === ln)) return '';
  const d = IND.yardTrack(ln.name) ? IND_YARD : INDUSTRIES.find(x => x.track === ln.name);
  if (!d) return '';
  if (NET.switches.some(sw => c.fouls(sw))) return '';   // the whole cut has to be in the clear
  return d.id;
};
IND.yardTrack = name => IND_YARD.tracks.includes(name);

/* ---------------- every half second ---------------- */
IND.tick = function (dt) {
  if (!IND.on() || !CARS.cuts.length) return;
  IND.hz += dt; if (IND.hz < 0.5) return;
  const h = IND.hz; IND.hz = 0;
  for (const c of CARS.cuts) for (const v of c.vehicles) {
    if (!IND.carries(v)) continue;
    const at = IND.at(v);
    if (!at) continue;
    if (at === 'yard') IND.inYard(v, h);
    else if (at === v.wb) IND.atIndustry(v, h);
  }
};
/* placed where it was billed: paid on arrival, then loaded or unloaded and billed home */
IND.atIndustry = function (v, h) {
  const d = IND.def(v.wb);
  if (!v.paid) IND.pay(v, d);
  v.wt = (v.wt || 0) + h;
  if (v.wt < IND_WORK) return;
  const unload = v.ld && d.takes.includes(v.ld);
  const load = !v.ld && d.ships.find(l => LADING[l].cars.includes(carType(v)));
  if (unload) IND.setLoad(v, '');
  else if (load) IND.setLoad(v, load);
  IND.bill(v, 'yard');
  IND.note(`${IND.mark(v)} is ${unload ? 'unloaded' : 'loaded'} at ${d.name} and billed to Bellevue Yard.`);
};
/* in Bellevue Yard: a car billed home (or carrying no bill) is delivered, then goes out again on the next order */
IND.inYard = function (v, h) {
  if (v.wb && v.wb !== 'yard') return;           // waiting for the local
  if (v.wb === 'yard' && !v.paid) IND.pay(v, IND_YARD);
  v.wt = (v.wt || 0) + h;
  if (v.wt < YARD_TURN) return;
  const o = IND.order(v); if (!o) { v.wt = 0; return; }
  IND.setLoad(v, o.ld); IND.bill(v, o.to);
  IND.note(`Interchange: ${IND.mark(v)} goes out ${o.ld ? 'loaded with ' + LADING[o.ld].name : 'empty'} for ${IND.def(o.to).name}.`);
};
/* the next order for a car in the yard: the customer, of those that can use this car, with the fewest cars coming */
IND.order = function (v) {
  const type = carType(v), opts = [];
  for (const d of INDUSTRIES) {
    for (const l of d.ships) if (LADING[l].cars.includes(type)) opts.push({ to: d.id, ld: '' });
    for (const l of d.takes) if (LADING[l].cars.includes(type)) opts.push({ to: d.id, ld: l });
  }
  if (!opts.length) return null;
  const coming = id => IND.billed(id).length / IND.def(id).spots;
  opts.sort((a, b) => coming(a.to) - coming(b.to));
  return opts[0];
};
/* every car of the cuts and the player's train billed to an industry */
IND.allCars = function () {
  const out = []; for (const c of [GAME.train, ...CARS.cuts]) if (c) for (const v of c.vehicles) if (IND.carries(v)) out.push(v);
  return out;
};
IND.billed = id => IND.allCars().filter(v => v.wb === id);
IND.pay = function (v, d) {
  v.paid = true;
  const amt = v.ld ? (LADING[v.ld] || { rate: 100 }).rate : EMPTY_RATE;
  IND.cash += amt; IND.cars++; IND.career.cash += amt; IND.career.cars++; IND.save();
  toast(`+$${amt} · ${IND.mark(v)} ${d.id === 'yard' ? 'delivered to' : 'spotted at'} ${d.name}`, 'good', 3200, 'indpay');
};
IND.mark = v => `${(v.made && v.made.rs) || ROAD_SHORT} ${(v.made && v.made.num) || ''}`.trim();
IND.note = function (msg) { IND.log.unshift({ t: S.time, msg }); IND.log.length = Math.min(IND.log.length, 8); CARS.gen++; };

/* ---------------- making up the railroad ---------------- */
/* a fresh run: every car of the yard cuts gets the load and bill it was made up with */
IND.reset = function () { IND.cash = 0; IND.cars = 0; IND.log = []; IND.hz = 0; };

/* ---------------- saving ---------------- */
IND.carOut = v => IND.carries(v) ? { ld: IND.ld(v), wb: v.wb || '', wt: Math.round(v.wt || 0), pd: !!v.paid } : null;
/* a car from a save made before industries: loaded if it was heavy, with no bill */
IND.carIn = function (v, o) {
  if (!IND.carries(v)) return;
  IND.setLoad(v, o ? o.ld : IND.ld(v));
  v.wb = o ? o.wb || '' : ''; v.wt = o ? o.wt || 0 : 0; v.paid = !!(o && o.pd);
};
IND.out = () => ({ cash: IND.cash, cars: IND.cars });
IND.in = function (o) { IND.reset(); if (o) { IND.cash = o.cash || 0; IND.cars = o.cars || 0; } };

/* ---------------- the switch list ---------------- */
/* what each customer has coming, standing on its track, and ready to go */
IND.status = function () {
  const cars = IND.allCars();
  return [...INDUSTRIES, IND_YARD].map(d => {
    const here = cars.filter(v => IND.at(v) === d.id);
    const coming = cars.filter(v => v.wb === d.id && !here.includes(v));
    const working = here.filter(v => v.wb === d.id && d.id !== 'yard' && v.wt < IND_WORK);
    const ready = here.filter(v => v.wb && v.wb !== d.id);
    return { d, here, coming, working, ready };
  });
};
const indEsc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const IND_CAR_WORD = { box: 'boxcar', hopper: 'hopper', gon: 'gondola', tank: 'tank car' };
/* group cars by their load and car type: "2 loaded hoppers, 1 empty boxcar" */
function indCars(list) {
  const g = new Map();
  for (const v of list) { const k = (IND.ld(v) ? 'loaded ' : 'empty ') + (IND_CAR_WORD[carType(v)] || carType(v)); g.set(k, (g.get(k) || 0) + 1); }
  return [...g].map(([k, n]) => `${n} ${k}${n === 1 ? '' : 's'}`).join(', ');
}
IND.listHTML = function () {
  if (!IND.on()) return '';
  const rows = IND.status().map(({ d, here, coming, working, ready }) => {
    const bits = [];
    if (coming.length && d.id !== 'yard') bits.push(`<span class="ic">Coming: ${indCars(coming)}</span>`);
    const turning = d.id === 'yard' ? here.filter(v => !v.wb || v.wb === 'yard') : [];
    if (turning.length) bits.push(`<span class="iw">Delivered, going out again soon: ${indCars(turning)}</span>`);
    if (working.length) bits.push(`<span class="iw">${d.takes.length && working.some(v => v.ld) ? 'Unloading' : 'Loading'} ${working.length} · ${fmtDur(IND_WORK - Math.max(...working.map(v => v.wt || 0)))}</span>`);
    if (ready.length) bits.push(`<span class="ir">${d.id === 'yard' ? 'For the local' : 'Ready to pull'}: ${indCars(ready)}</span>`);
    if (!bits.length) bits.push('<span class="in">Nothing moving</span>');
    return `<div class="il"><b>${indEsc(d.name)}</b><small>${indEsc(d.id === 'yard' ? 'Interchange, Yard 1 to 4' : d.track + ', ' + d.town)}</small>${bits.join('')}</div>`;
  }).join('');
  return `<div class="lbl">Switch list<em>$${IND.cash.toLocaleString()} this run · $${IND.career.cash.toLocaleString()} all time</em></div>${rows}`;
};

/* ---------------- on the map ---------------- */
IND.drawMap = function (g, tx, ty, opt) {
  if (!IND.on()) return;
  g.save();
  g.font = `600 ${Math.round(10 * opt.w)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const d of INDUSTRIES) {
    const ln = ROUTE.lines[d.track]; if (!ln) continue;
    const p = ln.poseAt(ln.len * 0.6), x = tx(p.X), y = ty(p.N);
    g.fillStyle = 'rgba(20,24,22,0.82)'; g.fillRect(x - 15 * opt.w, y - 8 * opt.w - 12 * opt.w, 30 * opt.w, 14 * opt.w);
    g.fillStyle = '#e9d9a6'; g.fillText(d.tag, x, y - 13 * opt.w);
  }
  // cars with a bill, coloured by whether they are loaded
  for (const v of IND.allCars()) {
    if (!v.wb || !v.pos || GAME.train.vehicles.includes(v)) continue;
    g.fillStyle = v.ld ? '#d98f3c' : '#8fb8c9';
    g.beginPath(); g.arc(tx(v.pos.x), ty(-v.pos.z), 2 * opt.w, 0, TAU); g.fill();
  }
  g.restore();
};
