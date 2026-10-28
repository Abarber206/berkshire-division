/* Switch lockout: when the player's train or a cut of cars holds a switch. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');

/* one turnout: a 200 m trunk into the points, a straight normal leg and a leg that jogs 4.5 m aside the
   way the yard ladders do (radius 180 m) */
function turnout(sim) {
  const net = new sim.Network();
  const trunk = net.edge(new sim.PathBuilder(0, 0, 0).straight(200).pts, { kind: 'yard' });
  const normal = net.edge(new sim.PathBuilder(200, 0, 0).straight(200).pts, { kind: 'yard' });
  const b = new sim.PathBuilder(200, 0, 0); b.jog(-4.5, 180); b.straight(140);
  const reverse = net.edge(b.pts, { kind: 'yard' });
  const node = net.node();
  net.attach(trunk, 1, node); net.attach(normal, 0, node); net.attach(reverse, 0, node);
  const sw = net.addSwitch(node, node.att[0], node.att[1], node.att[2], 'Yard ladder E3');
  return { trunk, normal, reverse, sw };
}
/* a 765 and tender: 30 m and 20 m, each with a pivot 3 m in from either end */
function engine(sim) {
  const C = new sim.Consist(null);
  C.update = () => {};
  C.vehicles = [30, 20].map(len => { const v = { len, flip: false, kind: len === 30 ? 'loco' : 'tender' }; v.ptsAll = [3, len - 3].map(loc => ({ loc, a: 0, tp: null, v })); return v; });
  C.layout();
  return C;
}
/* stand the consist with its front coupler at s on edge e, facing +s */
const stand = (sim, C, e, s) => { C.place(new sim.TrackPos(e, s, 1)); return C; };

test('a train pulled clear of the points onto the trunk can throw the switch behind it', () => {
  const sim = h.load(), y = turnout(sim), T = engine(sim);
  // pulled off the yard track facing away from the switch: the tender end is 10 m clear of the points
  T.place(new sim.TrackPos(y.trunk, 140, -1));
  assert.equal(Math.round(200 - T.endTP('rear').s), 10);
  assert.equal(T.fouls(y.sw), false, 'ten metres clear of the points on the single track is clear');
  T.place(new sim.TrackPos(y.trunk, 152, -1));          // tender end 2 m from the points
  assert.equal(T.fouls(y.sw), true, 'a coupler right at the points holds the switch');
});

test('a train standing on either leg holds the switch until it is back of the fouling point', () => {
  const sim = h.load(), y = turnout(sim), T = engine(sim);
  for (const leg of [y.normal, y.reverse]) {
    stand(sim, T, leg, 50 + sim.FOUL_LEN - 5);           // rear coupler 33 m past the points: still foul
    assert.equal(T.fouls(y.sw), true);
    stand(sim, T, leg, 50 + sim.FOUL_LEN + 5);           // rear coupler past the fouling point
    assert.equal(T.fouls(y.sw), false);
  }
});

test('a train spanning the points holds the switch', () => {
  const sim = h.load(), y = turnout(sim), T = engine(sim);
  stand(sim, T, y.normal, 25);                         // engine on the leg, tender back on the trunk
  assert.equal(T.fouls(y.sw), true);
  stand(sim, T, y.normal, 49);                         // just the tender's rear coupler is back on the trunk
  assert.equal(T.fouls(y.sw), true);
});
