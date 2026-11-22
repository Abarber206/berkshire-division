/* Jobs in a multiplayer room (src/11p_mpjobs.js): one player to a job, the room sees everyone's job, a
   second engine can push another player's train for real, and the pusher job's own steps.
   Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');
const V3 = h.Vector3;

/* a room: us (id 'mmmmmm') and the peers given as { id: { nm, jb, ... } } */
function room(sim, peers = {}, extra = {}) {
  const map = new Map();
  for (const [id, st] of Object.entries(peers)) map.set(id, { id, color: '#fff', at: sim.ctx.__now, st: { nm: id, ...st } });
  sim.ctx.MP = Object.assign({ on: true, id: 'mmmmmm', name: 'Me', color: '#ffe08a', peers: map, noteThrow() {}, addLog() {}, dirty: false, trains: () => [] }, extra);
  sim.ctx.$ = () => ({ hidden: true });
  sim.ctx.jobMenu = () => {};
  return map;
}
const job = (id, over = 0, i = 0, claim = 1000, lead = '') => [id, i, 90, over, claim, 22000, lead, over === 1 ? 1500 : 0];

test('the pusher job only shows in a room, and only on Laurel Mountain', () => {
  const sim = h.load();
  sim.ctx.ROUTE_KEY = 'laurel'; sim.ctx.PLAY_LAYOUT = null; sim.GAME.settings = { loco: '765' };
  assert.deepEqual(Array.from(sim.JOB.list(), j => j.id), ['pusher', 'no21']);
  room(sim);
  assert.deepEqual(Array.from(sim.JOB.list(), j => j.id), ['pusher', 'no21', 'assist']);
  sim.ctx.ROUTE_KEY = 'ohio';
  assert.ok(!sim.JOB.list().some(j => j.id === 'assist'));
  assert.ok(sim.JOB.available(), 'jobs can be taken in a room now');
});

test('a job report from another player is checked and clamped', () => {
  const sim = h.load();
  const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
  same(sim.MPJ.clean(['no3', 2, 140, 7, 5, -3, 'NOT AN ID', 2e9]), ['no3', 2, 100, 2, 5, 0, '', 1e6]);
  assert.equal(sim.MPJ.clean(['<b>', 0, 0, 0, 0, 0, '', 0]), null);
  assert.equal(sim.MPJ.clean('no3'), null);
  assert.equal(sim.MPJ.clean(['no3', 1]), null);
  same(sim.MPJ.cleanPush(['abcdefg', 3, 5e6]), ['abcdefg', 3, 900e3]);
  assert.equal(sim.MPJ.cleanPush(['abcdefg', 3, -10]), null, 'nobody pulls through a push');
  same(sim.MPJ.cleanTally([1500.4, 'x']), [1500, 0]);
});

test('a job someone else is working cannot be taken until they are done', () => {
  const sim = h.load();
  sim.ctx.ROUTE_KEY = 'ohio';
  sim.CARS.cuts = [];
  const peers = room(sim, { sam000: { nm: 'Sam', jb: job('no3') } });
  const no3 = sim.JOBS.find(j => j.id === 'no3'), no7 = sim.JOBS.find(j => j.id === 'no7');
  assert.match(sim.JOB.ready(no3), /Sam is working this job/);
  assert.equal(sim.JOB.ready(no7), '');
  peers.get('sam000').st.jb = job('no3', 1);
  assert.equal(sim.JOB.ready(no3), '', 'free again once Sam has finished it');
});

test('a pickup job wants its cars where it left them', () => {
  const sim = h.load();
  room(sim);
  const on = name => ({ home: 'Elevator Track', pts: [{ tp: { e: { line: { name } } } }], vehicles: [{}] });
  const el = sim.JOBS.find(j => j.id === 'elevator');
  sim.CARS.cuts = [on('Elevator Track')];
  assert.equal(sim.JOB.ready(el), '');
  sim.CARS.cuts = [on('Yard 1')];
  assert.match(sim.JOB.ready(el), /someone has moved them/);
  sim.CARS.cuts = [];
  assert.match(sim.JOB.ready(el), /someone has moved them/);
});

test('two players start the same job: whoever took it first keeps it', () => {
  const sim = h.load();
  const peers = room(sim, { sam000: { nm: 'Sam' } });
  let freed = 0; sim.JOB.toFree = () => { freed++; sim.JOB.run = null; };
  const def = sim.JOBS.find(j => j.id === 'no3');
  sim.JOB.run = { def, claim: 2000, over: false, steps: def.steps, i: 0, items: [] };
  const p = peers.get('sam000');
  sim.MPJ.receive(p, p.st, Object.assign(p.st, { jb: job('no3', 0, 0, 3000) }));
  assert.equal(freed, 0, 'Sam took it after us: ours stands');
  sim.MPJ.receive(p, p.st, Object.assign({}, p.st, { jb: job('no3', 0, 0, 1500) }));
  assert.equal(freed, 1, 'Sam took it before us: we are free running');
});

test('the room log says when someone takes and finishes a job', () => {
  const sim = h.load(), lines = [];
  const peers = room(sim, { sam000: { nm: 'Sam' } }, { addLog: (nm, c, t) => lines.push(nm + ' ' + t) });
  const p = peers.get('sam000');
  const s1 = { nm: 'Sam', jb: job('no7') };
  sim.MPJ.receive(p, { nm: 'Sam', jb: null }, s1);
  sim.MPJ.receive(p, s1, { nm: 'Sam', jb: job('no7', 1) });
  assert.deepEqual(lines, ['Sam took No. 7, around the division', 'Sam finished No. 7, around the division: 90 points, $1,500']);
  assert.match(sim.MPJ.status({ jb: job('no7', 0, 2) }), /No\. 7.*Stop at Kenton.*90 pts/);
});

test('another player coming to push sends our own pusher back to the shed', () => {
  const sim = h.load();
  const peers = room(sim, { sam000: { nm: 'Sam' } });
  const def = sim.JOBS.find(j => j.id === 'pusher');
  let gone = 0;
  const H = { parkS: {}, pusher: true, disposeDeep() { gone++; } };
  sim.CARS.cuts = [H, { home: 'x' }];
  sim.ctx.MAP = { visible: false };
  sim.JOB.run = { def, claim: 1000, over: false, steps: def.steps.map(s => ({ ...s })), i: 0, items: [] };
  const p = peers.get('sam000');
  sim.MPJ.receive(p, { nm: 'Sam', jb: null }, { nm: 'Sam', jb: job('assist', 0, 0, 2000, 'mmmmmm') });
  assert.equal(gone, 1);
  assert.equal(sim.CARS.cuts.length, 1);
  assert.equal(sim.JOB.run.roomPusher, 'sam000');
});

test('the pusher job opens for a mine run waiting at the foot of the hill, once', () => {
  const sim = h.load();
  sim.ctx.ROUTE_KEY = 'laurel';
  const peers = room(sim, { lead00: { nm: 'Austin', jb: job('pusher'), f: 0 } });
  const lead = peers.get('lead00'); lead.rt = { placed: true };
  const assist = sim.JOBS.find(j => j.id === 'assist');
  assert.equal(sim.JOB.ready(assist), '');
  assert.equal(sim.MPJ.title(assist), "Push Austin's mine run");
  lead.st.jb = job('pusher', 0, 1);
  assert.match(sim.JOB.ready(assist), /Nobody in the room/, 'already climbing: too late to push');
  lead.st.jb = job('pusher');
  peers.set('sam000', { id: 'sam000', st: { nm: 'Sam', jb: job('assist', 0, 0, 5, 'lead00') } });
  assert.match(sim.JOB.ready(assist), /Nobody in the room/, 'Sam is already pushing it');
});

test('a push from another player moves the train; our own effort is reported for them', () => {
  const run = push => {
    const sim = h.load(), T = h.train(sim, 20), S = sim.S;
    Object.assign(S, { cocks: false, throttle: 0, reverser: 1, indH: 0, brakeH: 0, pushF: push });
    h.run(sim, T, 10);
    return S.v;
  };
  assert.equal(run(0), 0);
  assert.ok(run(150e3) > 0.05, 'shoved ahead from the rear');
  assert.ok(run(-150e3) < -0.05, 'shoved back from the front');
  const sim = h.load(), T = h.train(sim, 20), S = sim.S;
  Object.assign(S, { cocks: false, throttle: 1, reverser: 1, indH: 0, brakeH: 0 });
  for (let i = 0; i < 90; i++) { S.v = 0; S.vw = 0; sim.physicsStep(1 / 30, T); }
  assert.ok(S.Fnet > 50e3, `effort left to push with: ${S.Fnet}`);
});

/* a train standing with its front at x = 0 and its rear at x = -50 */
function ours(sim) {
  sim.ctx.mpEnds = (T, f, r) => { f.set(0, 0, 0); r.set(-50, 0, 0); };
  return { fid: 0 };
}
test('we tell the train we are against how hard we are shoving it', () => {
  const sim = h.load(), T = ours(sim);
  const rt = { placed: true, polyN: 2, poly: [new V3(41, 0, 0), new V3(1, 0, 0)] };   // their rear coupler a metre ahead of our front
  room(sim, { lead00: { nm: 'Austin' } }, { trains: () => [{ p: { id: 'lead00', st: {} }, h: { f: 4 }, rt }] });
  sim.S.Fnet = 120e3; sim.MPJ.pushOut(T);
  assert.equal(JSON.stringify(sim.ctx.MP.push), JSON.stringify(['lead00', 4, 120000]));
  sim.S.Fnet = -120e3; sim.MPJ.pushOut(T);
  assert.equal(sim.ctx.MP.push, null, 'backing away pushes nothing');
  rt.poly[1] = new V3(9, 0, 0); sim.S.Fnet = 120e3; sim.MPJ.pushOut(T);
  assert.equal(sim.ctx.MP.push, null, 'not against them');
});

test('a push reported for our train is felt at the end they are against', () => {
  const sim = h.load(), T = ours(sim);
  const peers = room(sim, { sam000: { nm: 'Sam' } });
  const p = peers.get('sam000');
  const rt = { placed: true, polyN: 2, poly: [new V3(-51, 0, 0), new V3(-70, 0, 0)] };   // their front just behind our rear
  p.trains = new Map([[0, { rt }]]);
  p.st.ps = ['mmmmmm', 0, 200e3];
  sim.MPJ.pushIn(T);
  assert.equal(sim.S.pushF, 200e3);
  rt.poly = [new V3(1, 0, 0), new V3(30, 0, 0)];
  sim.MPJ.pushIn(T);
  assert.equal(sim.S.pushF, -200e3, 'against our front: shoved back');
  p.st.ps = ['someone', 0, 200e3]; sim.MPJ.pushIn(T);
  assert.equal(sim.S.pushF, 0, 'pushing someone else');
  p.st.ps = ['mmmmmm', 0, 200e3]; p.at = sim.ctx.__now - 5000; sim.MPJ.pushIn(T);
  assert.equal(sim.S.pushF, 0, 'an old report');
});

test('the pusher job: buff up, shove to Summit, drop back', () => {
  const sim = h.load();
  sim.ctx.carPanelState = {}; sim.ctx.setTimeout = () => 0; sim.JOB.ui = () => {}; sim.CAREER.payJob = () => 0;
  const hold = { touch: [null, null], rt: null };
  const peers = room(sim, { lead00: { nm: 'Austin', jb: job('pusher', 0, 0), f: 0, v: 0 } });
  const lead = peers.get('lead00'); lead.trains = new Map([[0, hold]]);
  const T = { vehicles: [{ kind: 'loco' }], lead: { pos: new V3(), fwd: new V3(1, 0, 0) }, loco: { cabEye: { x: 0 } }, worldOf() { return new V3(); }, pts: [] };
  const def = sim.JOBS.find(j => j.id === 'assist');
  const R = sim.JOB.run = { def, t0: 0, steps: def.steps.map(s => ({ ...s, state: 'todo' })), i: 0, items: [], over: false, cars: [], ep: {}, lastStop: 2, score: 100, lead: 'lead00' };
  sim.JOB.steps(R, T, 10); assert.equal(R.i, 0, 'not against the caboose yet');
  hold.touch[0] = { kind: 'end' };
  sim.JOB.steps(R, T, 20); assert.equal(R.i, 1, 'buffed up');
  lead.st.jb = job('pusher', 0, 2); lead.st.v = 8;
  for (let k = 0; k < 400; k++) { hold.touch[0] = k < 200 ? { kind: 'end' } : null; sim.JOB.steps(R, T, 30 + k / 10); }
  assert.equal(R.i, 1, 'still climbing');
  lead.st.jb = job('pusher', 0, 4); lead.st.v = 0;
  sim.JOB.steps(R, T, 80); assert.equal(R.i, 2, 'at Summit');
  assert.ok(R.items.some(i => i.label === 'Dropped off the train'), 'pushed only half the climb');
  hold.touch[0] = null; R.lastStop = 2;
  sim.JOB.steps(R, T, 90);
  assert.ok(R.over && !R.failed, 'job done');
});

test('the pusher job ends if the train it pushes comes off the rails', () => {
  const sim = h.load();
  sim.ctx.carPanelState = {}; sim.ctx.setTimeout = () => 0; sim.JOB.ui = () => {};
  room(sim, { lead00: { nm: 'Austin', jb: job('pusher', 2, 2) } });
  const def = sim.JOBS.find(j => j.id === 'assist');
  const R = sim.JOB.run = { def, t0: 0, steps: def.steps.map(s => ({ ...s, state: 'todo' })), i: 1, items: [], over: false, cars: [], ep: {}, lastStop: 2, score: 100, lead: 'lead00' };
  sim.JOB.steps(R, {}, 10);
  assert.ok(R.failed); assert.match(R.failed.title, /grief/);
});
