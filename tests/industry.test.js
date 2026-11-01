/* Industries and car routing: a car spotted at the customer on its waybill is paid for, loaded or unloaded,
   and billed home; Bellevue Yard sends delivered cars out again on the next order; loads change a car's weight;
   the waybills survive a save. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');

/* an industry spur, a yard track and a main, all meeting at one switch, each a named line */
function railroad(sim) {
  const net = new sim.Network();
  const yard = net.edge(new sim.PathBuilder(0, 0, 0).straight(400).pts, { kind: 'yard' });
  const main = net.edge(new sim.PathBuilder(400, 0, 0).straight(600).pts, { kind: 'main' });
  const b = new sim.PathBuilder(400, 0, 0); b.jog(-4.5, 180); b.straight(300);
  const spur = net.edge(b.pts, { kind: 'yard' });
  const node = net.node();
  net.attach(yard, 1, node); net.attach(main, 0, node); net.attach(spur, 0, node);
  const sw = net.addSwitch(node, node.att[0], node.att[1], node.att[2], 'Kenton Spur');
  sim.ctx.NET = net;
  sim.CARS.geo = { tg: {}, a6: {}, a4: {} };
  yard.line = { name: 'Yard 4' }; main.line = { name: 'Main' }; spur.line = { name: 'Kenton Spur' };
  sim.ctx.WORLD.mtn = false;
  return { net, yard, main, spur, sw };
}
function car(sim, type, ld, to) {
  const v = { kind: type, len: 13, frame: [2, 11], trucks: [], mass: 30000, axles: 4, area: 105, brakeA: 0.5, root: h.Anything(),
    brake: { AR: 0, BC: 0, BP: 0, emerg: false, released: true }, kn: [0, 0], made: { type, num: 21000 + Math.round(Math.random() * 999), rs: 'NKP' } };
  sim.IND.setLoad(v, ld); sim.IND.bill(v, to);
  return v;
}
function cutAt(sim, e, s, cars) {
  const c = new sim.Cut(sim.ctx.scene, cars);
  c.place(new sim.TrackPos(e, s, 1));
  sim.CARS.cuts.push(c);
  return c;
}
/* run the industries' half-second clock for so many seconds */
function wait(sim, seconds) { for (let t = 0; t < seconds; t += 0.25) { sim.S.time += 0.25; sim.IND.tick(0.25); } }

test('a parsed yard car says its type, its load and where it is billed', () => {
  const sim = h.load();
  assert.deepEqual({ ...sim.IND.parse('tank/oil>delphos') }, { type: 'tank', ld: 'oil', to: 'delphos' });
  assert.deepEqual({ ...sim.IND.parse('box/>elevator') }, { type: 'box', ld: '', to: 'elevator' });
  assert.deepEqual({ ...sim.IND.parse('hopper') }, { type: 'hopper', ld: '', to: '' });
  // every yard car names a real lading that goes in its car type, and a real customer
  for (const cut of sim.YARD_CUTS) for (const spec of cut.cars) {
    const p = sim.IND.parse(spec);
    if (p.ld) assert.ok(sim.LADING[p.ld].cars.includes(p.type), spec);
    if (p.to) assert.ok(sim.IND.def(p.to), spec);
  }
});

test('a loaded car weighs what its load does, an empty only its light weight', () => {
  const sim = h.load(), STON = sim.STON;
  for (const [type, [light, loaded]] of Object.entries(sim.LOAD_TONS)) {
    const v = car(sim, type, '', '');
    assert.equal(Math.round(v.mass / STON), light, type + ' empty');
    sim.IND.setLoad(v, Object.keys(sim.LADING).find(l => sim.LADING[l].cars.includes(type)));
    assert.equal(Math.round(v.mass / STON), loaded, type + ' loaded');
    assert.ok(loaded > 2.5 * light, `${type}: a load is most of a car's weight`);
  }
});

test('coal spotted at Kenton is paid for, unloaded once the crew has left it, and billed home empty', () => {
  const sim = h.load(), y = railroad(sim);
  const c = cutAt(sim, y.spur, 250, [car(sim, 'hopper', 'coal', 'kenton'), car(sim, 'hopper', 'coal', 'kenton')]);
  const [a] = c.vehicles;
  assert.equal(sim.IND.at(a), 'kenton');
  wait(sim, 2);
  assert.equal(sim.IND.cash, 2 * sim.LADING.coal.rate, 'paid for both cars on arrival');
  assert.equal(a.ld, 'coal', 'still loaded while it is worked');
  wait(sim, sim.IND_WORK);
  assert.equal(a.ld, '', 'unloaded');
  assert.equal(a.wb, 'yard', 'billed back to Bellevue');
  assert.equal(Math.round(a.mass / sim.STON), sim.LOAD_TONS.hopper[0]);
  assert.equal(sim.IND.cash, 2 * sim.LADING.coal.rate, 'paid once, not again when it is rebilled');
});

test('an empty set out at a shipper is loaded with what that shipper ships', () => {
  const sim = h.load(), y = railroad(sim);
  y.spur.line.name = 'Elevator Track';
  const c = cutAt(sim, y.spur, 250, [car(sim, 'box', '', 'elevator')]);
  wait(sim, sim.IND_WORK + 1);
  assert.equal(c.vehicles[0].ld, 'grain');
  assert.equal(c.vehicles[0].wb, 'yard');
  assert.equal(sim.IND.cash, 45, 'car hire for the empty');
});

test('nothing is worked while the cars roll, stand foul of the switch, or are on the wrong customer', () => {
  const sim = h.load(), y = railroad(sim);
  const moving = cutAt(sim, y.spur, 250, [car(sim, 'hopper', 'coal', 'kenton')]);
  moving.v = 0.5; moving.rolling = true;
  const foul = cutAt(sim, y.spur, 40, [car(sim, 'hopper', 'coal', 'kenton')]);
  const wrong = cutAt(sim, y.spur, 150, [car(sim, 'tank', 'oil', 'delphos')]);
  assert.ok(sim.ctx.NET.switches.some(sw => foul.fouls(sw)), 'the second cut stands by the points');
  wait(sim, sim.IND_WORK + 1);
  for (const c of [moving, foul, wrong]) { assert.notEqual(c.vehicles[0].ld, ''); assert.equal(c.vehicles[0].paid, false); }
  assert.equal(sim.IND.cash, 0);
});

test('cars coupled to the engine are not worked: the crew has to set them out', () => {
  const sim = h.load(), y = railroad(sim);
  const c = cutAt(sim, y.spur, 250, [car(sim, 'hopper', 'coal', 'kenton')]);
  sim.CARS.cuts.length = 0;            // the cut is now part of the train, not standing on its own
  wait(sim, sim.IND_WORK + 1);
  assert.equal(c.vehicles[0].ld, 'coal');
});

test('Bellevue Yard takes delivery, then sends the car out on the order with the fewest cars coming', () => {
  const sim = h.load(), y = railroad(sim);
  const c = cutAt(sim, y.yard, 300, [car(sim, 'hopper', 'stone', 'yard')]);
  const v = c.vehicles[0];
  wait(sim, 2);
  assert.equal(sim.IND.cash, sim.LADING.stone.rate);
  wait(sim, sim.YARD_TURN);
  // a hopper can go empty to the quarry or loaded with coal to Kenton; neither has any cars coming
  assert.ok(['quarry', 'kenton'].includes(v.wb), v.wb);
  assert.equal(v.ld, v.wb === 'kenton' ? 'coal' : '');
  // with that order out, the next hopper goes to the other customer
  const c2 = cutAt(sim, y.yard, 200, [car(sim, 'hopper', '', 'yard')]);
  wait(sim, sim.YARD_TURN + 1);
  assert.notEqual(c2.vehicles[0].wb, v.wb);
});

test('a car waiting in the yard for the local is left alone', () => {
  const sim = h.load(), y = railroad(sim);
  const c = cutAt(sim, y.yard, 300, [car(sim, 'tank', 'oil', 'delphos')]);
  wait(sim, sim.YARD_TURN + 1);
  assert.equal(c.vehicles[0].wb, 'delphos');
  assert.equal(sim.IND.cash, 0);
});

test('loads, waybills and the time a car has been worked come back from a save', () => {
  const sim = h.load(), y = railroad(sim);
  const c = cutAt(sim, y.spur, 250, [car(sim, 'tank', 'oil', 'delphos'), car(sim, 'gon', '', 'quarry')]);
  wait(sim, 20);
  const saved = JSON.parse(JSON.stringify(sim.consistOut(c)));
  const back = c.vehicles.map(v => car(sim, v.made.type, '', ''));
  back.forEach((v, i) => sim.vehicleIn(v, saved.v[i]));
  assert.equal(back[0].ld, 'oil'); assert.equal(back[0].wb, 'delphos');
  assert.equal(Math.round(back[0].mass / sim.STON), sim.LOAD_TONS.tank[1]);
  assert.equal(back[1].ld, ''); assert.equal(back[1].wb, 'quarry');
  // a save from before industries: a heavy car comes back loaded, a light one empty, neither billed
  const old = car(sim, 'hopper', '', ''); old.mass = 92 * sim.STON; delete old.ld;
  sim.vehicleIn(old, { ...saved.v[0], ind: undefined });
  assert.equal(old.ld, 'coal'); assert.equal(old.wb, '');
});

test('the switch list says what is coming, being worked and ready to pull', () => {
  const sim = h.load(), y = railroad(sim);
  sim.GAME.train = { vehicles: [] };
  cutAt(sim, y.spur, 250, [car(sim, 'hopper', 'coal', 'kenton'), car(sim, 'box', '', 'yard')]);
  cutAt(sim, y.yard, 300, [car(sim, 'tank', 'oil', 'delphos')]);
  wait(sim, 5);
  const st = Object.fromEntries(sim.IND.status().map(s => [s.d.id, s]));
  assert.equal(st.kenton.working.length, 1);
  assert.equal(st.kenton.ready.length, 1, 'the empty billed home is ready to pull');
  assert.equal(st.delphos.coming.length, 1);
  assert.equal(st.yard.ready.length, 1, 'the tank waits in the yard for the local');
});
