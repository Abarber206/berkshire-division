/* ============================================================================
   Multiplayer. Everyone in a room drives their own train on the same railroad,
   sees the others move, hears their whistles and bells, and shares the switches.

   Each player broadcasts one small absolute state about eight times a second:
   where the front of their train is on the track, what the train is, speed,
   reverser, whistle, bell, lights, exhaust, a switch vector and the latest chat
   line. Other players' trains are built locally from the same models and follow
   that state along the track with dead reckoning, so they glide between updates.

   Two transports carry the same messages:
   - MQTT over WebSockets through two free public brokers. Works from any web
     page, phones on cellular included, no accounts. A small MQTT 3.1.1 client
     is built in below.
   - Inside claude.ai, the artifact's `room` capability (presence only).
   Switches carry a version each (higher wins, ties go to the lower player id),
   so everyone settles on the same switch positions without a server.
   ========================================================================== */
const MQ_TE = new TextEncoder(), MQ_TD = new TextDecoder();
function mqStr(s) { const b = typeof s === 'string' ? MQ_TE.encode(s) : s; const o = new Uint8Array(2 + b.length); o[0] = b.length >> 8; o[1] = b.length & 255; o.set(b, 2); return o; }
function mqPacket(head, parts) {
  let n = 0; for (const p of parts) n += p.length;
  const len = []; let x = n;
  do { let d = x % 128; x = Math.floor(x / 128); if (x > 0) d |= 128; len.push(d); } while (x > 0);
  const out = new Uint8Array(1 + len.length + n); out[0] = head; out.set(len, 1);
  let o = 1 + len.length; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
class MiniMQTT {
  constructor(url, clientId, will, onMessage, onStatus) {
    Object.assign(this, { url, clientId, will, onMessage, onStatus });
    this.subs = []; this.ok = false; this.closed = false; this.everOk = false; this.dead = false; this.fails = 0; this.pid = 1; this.buf = new Uint8Array(0);
    this.open();
  }
  open() {
    if (this.closed) return;
    let ws;
    try { ws = new WebSocket(this.url, ['mqtt']); } catch (e) { this.retry(); return; }
    this.ws = ws; ws.binaryType = 'arraybuffer'; this.buf = new Uint8Array(0);
    ws.onopen = () => {
      const flags = 0x02 | (this.will ? 0x04 : 0);                 // clean session, optional last will (QoS 0)
      const parts = [mqStr('MQTT'), Uint8Array.of(4, flags, 0, 30), mqStr(this.clientId)];
      if (this.will) parts.push(mqStr(this.will.topic), mqStr(MQ_TE.encode(this.will.payload)));
      ws.send(mqPacket(0x10, parts));
    };
    ws.onmessage = ev => { if (typeof ev.data !== 'string') this.feed(new Uint8Array(ev.data)); };
    ws.onclose = () => { if (this.ws !== ws) return; const was = this.ok; this.ok = false; clearInterval(this.pingT); if (was && this.onStatus) this.onStatus(); this.retry(); };
    ws.onerror = () => {};
  }
  retry() {
    if (this.closed) return;
    this.fails++;
    if (!this.everOk && this.fails >= 4) { this.dead = true; if (this.onStatus) this.onStatus(); return; }
    this.retryT = setTimeout(() => this.open(), Math.min(15000, 1000 * Math.pow(2, Math.min(4, this.fails - 1))));
  }
  feed(chunk) {
    const b = new Uint8Array(this.buf.length + chunk.length); b.set(this.buf); b.set(chunk, this.buf.length);
    let i = 0;
    while (b.length - i >= 2) {
      let mult = 1, len = 0, k = i + 1, byte = 0, complete = false;
      while (k < b.length) { byte = b[k++]; len += (byte & 127) * mult; mult *= 128; if (!(byte & 128)) { complete = true; break; } if (mult > 2097152) break; }
      if (!complete || k + len > b.length) break;
      this.packet(b[i], b.subarray(k, k + len));
      i = k + len;
    }
    this.buf = b.slice(i);
  }
  packet(head, body) {
    const type = head >> 4;
    if (type === 2) {                                              // CONNACK
      if (body[1] !== 0) { try { this.ws.close(); } catch (e) {} return; }
      this.ok = true; this.everOk = true; this.fails = 0;
      for (const t of this.subs) this.sendSub(t);
      clearInterval(this.pingT); this.pingT = setInterval(() => this.raw(Uint8Array.of(0xC0, 0)), 15000);
      if (this.onStatus) this.onStatus();
    } else if (type === 3 && this.onMessage) {                     // PUBLISH
      const qos = (head >> 1) & 3, tl = (body[0] << 8) | body[1];
      const topic = MQ_TD.decode(body.subarray(2, 2 + tl));
      this.onMessage(topic, MQ_TD.decode(body.subarray(2 + tl + (qos ? 2 : 0))));
    }
  }
  raw(p) { if (this.ws && this.ws.readyState === 1) { try { this.ws.send(p); } catch (e) {} } }
  sendSub(topic) { const id = this.pid = (this.pid % 65535) + 1; this.raw(mqPacket(0x82, [Uint8Array.of(id >> 8, id & 255), mqStr(topic), Uint8Array.of(0)])); }
  subscribe(topic) { this.subs.push(topic); if (this.ok) this.sendSub(topic); }
  publish(topic, text, retain) { if (this.ok) this.raw(mqPacket(retain ? 0x31 : 0x30, [mqStr(topic), MQ_TE.encode(text)])); }
  close() {
    this.closed = true; clearTimeout(this.retryT); clearInterval(this.pingT);
    if (this.ws) { try { if (this.ok) this.ws.send(Uint8Array.of(0xE0, 0)); this.ws.close(); } catch (e) {} }
    this.ok = false;
  }
}

/* The artifact's room capability: presence carries the same state object. */
async function mpRoomLink(code, onState, onGone) {
  const c = window.claude;
  if (!c || typeof c.use !== 'function') return null;
  let room = null, r = null;
  try { room = await c.use('room'); } catch (e) { return null; }
  if (!room) return null;
  try { r = await room.join('bd-' + code.toLowerCase()); } catch (e) { return null; }
  const ids = new Map();
  const unsub = r.onPeers(ch => {
    for (const p of [...ch.joined, ...ch.updated]) {
      if (p.isMe && p.sameTab) continue;
      const st = p.presence && p.presence.st;
      if (st && typeof st === 'object') { ids.set(p.peer, st.id); onState(st); }
    }
    for (const p of ch.left) { const id = ids.get(p.peer); if (id) { ids.delete(p.peer); onGone(id); } }
  }, () => {});
  return {
    send: st => { r.presence({ st }).catch(() => {}); },
    ok: () => { try { return r.connected(); } catch (e) { return false; } },
    close: () => { try { unsub(); r.leave(); } catch (e) {} },
  };
}

const MP_COLORS = ['#5ec2e8', '#ee6a5e', '#7fd67a', '#c58cf0', '#f08cc0', '#5ee8c4', '#f2924b', '#9fb4ff'];
const MP_ME = '#ffe08a';   // our own train is always drawn pale yellow
const MP_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/* where new trains are made up in a room, in order of preference (negative = from the end of the line) */
const MP_SPAWNS = [['Yard 2', -175], ['Yard 3', -140], ['Yard 4', -112], ['Yard 1', -200], ['Fostoria Siding', -320], ['Kenton Siding', -220], ['Main', 3200], ['Main', 9800], ['Main', 16000], ['Quarry Branch', -700]];
const MP_SPAWN_NAMES = { 'Yard 2': 'Yard 2, Bellevue', 'Yard 3': 'Yard 3, Bellevue', 'Yard 4': 'Yard 4, Bellevue', 'Yard 1': 'Yard 1, Bellevue', 'Fostoria Siding': 'the Fostoria siding', 'Kenton Siding': 'the Kenton siding', 'Main': 'the main line', 'Quarry Branch': 'the quarry branch' };
const MP = {
  on: false, ready: false, code: '', ly: '', id: '', name: '', color: '', peers: new Map(), links: [], room: null, topic: '',
  q: 0, sentAt: 0, dirty: false, spawned: false, needSpawn: false, swv: null, seen: null, pend: new Map(), lt: null,
  chatN: 0, chat: null, log: [], watching: null, edges: null, panelT: 0, joinedAt: 0, autoJoin: '', last: null,
  brokers: ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'],
};
const _mpA = new THREE.Vector3(), _mpB = new THREE.Vector3(), _mpC = new THREE.Vector3(), _mpD = new THREE.Vector3(), _mpE = new THREE.Vector3(), _mpF = new THREE.Vector3(), _mpG = new THREE.Vector3();
function mpHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
/* control, bidi, zero-width and private-use characters are dropped from names and chat */
const MP_STRIP = new RegExp('[' + [[0, 31], [127, 159], [173, 173], [8203, 8204], [8206, 8207], [8232, 8238], [8288, 8292], [8298, 8303], [57344, 63743], [65279, 65279], [65529, 65531]].map(([a, b]) => String.fromCharCode(a) + '-' + String.fromCharCode(b)).join('') + ']', 'g');
function mpText(x, n) {
  if (typeof x !== 'string') return '';
  const t = x.replace(MP_STRIP, '').replace(/[ ]+/g, ' ').trim();
  return Array.from(t).slice(0, n).join('');
}
/* everything another player sends is checked and clamped before use */
function mpClean(r) {
  if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !/^[a-z0-9]{6,16}$/.test(r.id)) return null;
  const n = (x, lo, hi, d = 0) => (typeof x === 'number' && isFinite(x)) ? clamp(x, lo, hi) : d;
  const o = { id: r.id, q: Math.round(n(r.q, 0, 1e12)), bye: r.bye ? 1 : 0 };
  if (o.bye) return o;
  o.nm = mpText(r.nm, 16) || 'Engineer';
  o.ly = typeof r.ly === 'string' ? r.ly.slice(0, 16) : '';
  o.other = o.ly !== MP.ly ? 1 : 0;   // on another railroad: chat only
  o.e = !o.other && Number.isInteger(r.e) && MP.edges && MP.edges.has(r.e) ? r.e : -1;
  if (o.e >= 0) {
    o.lk = LOCO_SPEC[r.lk] ? r.lk : '765'; o.ck = CONSISTS[r.ck] ? r.ck : 'light';
    o.u = Math.round(n(r.u, 1, 3, 1)); o.lv = LIVERIES[r.lv] ? r.lv : 'ss'; o.mx = r.mx ? 1 : 0;
    o.cu = Array.isArray(r.cu) && r.cu.length === 3 ? r.cu.map(c => Math.round(n(c, 0, 0xffffff))) : null;
    o.no = Math.round(n(r.no, 0, 9999)); o.tm = r.tm === 'polar' ? 'polar' : '';
    o.vh = Number.isInteger(r.vh) && r.vh > 0 ? r.vh >>> 0 : 0;
    o.vs = o.vh && typeof r.vs === 'string' && r.vs.length < 12000 && mpHash(r.vs) === o.vh ? r.vs : null;
    o.s = n(r.s, 0, 1e5); o.o = r.o < 0 ? -1 : 1; o.v = n(r.v, -60, 60); o.rv = n(r.rv, -1, 1);
    o.wh = n(r.wh, 0, 1); o.bl = r.bl ? 1 : 0; o.cl = r.cl ? 1 : 0; o.hl = Math.round(n(r.hl, 0, 2, 1)); o.dl = r.dl ? 1 : 0;
    o.ex = n(r.ex, 0, 1.5); o.rpm = n(r.rpm, 0, 1200); o.dr = r.dr ? 1 : 0;
    o.wk = o.dr && Array.isArray(r.wk) && r.wk.length >= 4 ? [n(r.wk[0], 0, 5000), r.wk[1] < 0 ? -1 : 1, Math.round(n(r.wk[2], 1, 2e9, 1)), n(r.wk[3], 0, 1), n(r.wk[4], 0, 150), n(r.wk[5], -150, 150), r.wk[6] ? 1 : 0] : null;
  }
  o.pz = r.pz ? 1 : 0; o.cs = r.cs ? 1 : 0;
  o.av = !o.other ? walkClean(r.av) : null;   // walking about or riding (11j_walk.js)
  // send time on their clock, and their echo of ours: [our send time, ms they held it]
  o.ts = n(r.ts, 0, 1e12);
  const ak = r.ak && typeof r.ak === 'object' ? r.ak[MP.id] : null;
  o.ak = Array.isArray(ak) && ak.length === 2 ? [n(ak[0], 0, 1e12), n(ak[1], 0, 1e5)] : null;
  o.sw = !o.other && Array.isArray(r.sw) && r.sw.length === NET.switches.length ? r.sw.map(x => Math.round(n(x, 0, 2e9))) : null;
  o.lt = Array.isArray(r.lt) && r.lt.length === 2 ? [Math.round(n(r.lt[0], 0, 255)), Math.round(n(r.lt[1], 0, 1e9))] : null;
  // a hit on someone's train: [their id, count, mph, x, z of the point of impact]
  o.hx = Array.isArray(r.hx) && r.hx.length === 5 && typeof r.hx[0] === 'string' ? [r.hx[0].slice(0, 16), Math.round(n(r.hx[1], 0, 1e9)), n(r.hx[2], 0, 200), n(r.hx[3], -1e5, 1e5), n(r.hx[4], -1e5, 1e5)] : null;
  o.ch = Array.isArray(r.ch) && r.ch.length === 2 ? [Math.round(n(r.ch[0], 0, 1e9)), mpText(r.ch[1], 80)] : null;
  return o;
}
function mpSegDist(p, a, b) {
  _mpC.subVectors(b, a); const L2 = _mpC.lengthSq();
  const t = L2 > 1e-9 ? clamp(_mpD.subVectors(p, a).dot(_mpC) / L2, 0, 1) : 0;
  return _mpD.copy(a).addScaledVector(_mpC, t).distanceTo(p);
}
/* the two coupler ends of a train, extrapolated from its first and last tracked points */
function mpEnds(T, front, rear) {
  const p0 = T.pts[0], pl = T.pts[T.pts.length - 1];
  front.copy(p0.F.p).addScaledVector(p0.F.f, p0.a);
  rear.copy(pl.F.p).addScaledVector(pl.F.f, -(T.length - pl.a));
}
function mpShade(h, k) { const r = (h >> 16) & 255, g = (h >> 8) & 255, b = h & 255; return (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k); }
function mpOpts(st) {
  const cu = st.cu ? { body: st.cu[0], accent: st.cu[1], letter: st.cu[2], rail: st.cu[1], roof: mpShade(st.cu[0], 0.78) } : null;
  return { units: st.u, livery: st.lv, mix: !!st.mx, custom: cu, number: st.lv === 'custom' ? (st.no || 4401) : null, trim: st.tm || '' };
}
function mpLocoLabel(st) {
  if (st && st.other) return 'On another railroad';
  if (!st || st.e < 0) return 'In the menu';
  const loco = HSR[st.lk] ? HSR[st.lk].name : st.lk === 'diesel' ? (st.lv === 'custom' ? 'Custom' : LIVERIES[st.lv].init) + ' diesel' + (st.u > 1 ? ' ×' + st.u : '') : (st.lk === '765' ? 'NKP 765' : st.lk === '4014' ? 'UP 4014 Big Boy' : 'PM 1225');
  return HSR[st.lk] ? loco : loco + ' · ' + CONSISTS[st.ck].name;
}
function mpJoints(T, mem, speed, cp) {
  for (const v of T.vehicles) {
    const dv = v.pos.distanceTo(cp); if (dv > 110) continue;
    const g = Math.min(1, Math.abs(speed) / 7) / (1 + Math.pow(dv / 13, 1.4));
    const pts = (v.kind === 'loco' || v.kind === 'loco2') ? (T.diesel ? [[v.fp[0], v.emu ? 2 : 3, v.emu ? v.model.wb : DG.axle], [v.fp[1], v.emu ? 2 : 3, v.emu ? v.model.wb : DG.axle]] : [[v.leadPt, 1, 0], [v.fp[0], 4, 1.855]]) : v.tp.map((p, i) => [p, v.trucks[i].type === 'four' ? 2 : 3, v.trucks[i].sp || (v.trucks[i].type === 'four' ? 1.73 : 1.676)]);
    for (const [p, axles, sp] of pts) {
      const j = Math.floor(p.tp.s / 11.89), prev = mem.get(p);
      if (prev && prev.e === p.tp.e && prev.j !== j) for (let a = 0; a < axles; a++) sndJoint(g * (a === 0 ? 1 : 0.8), a * sp / Math.max(0.5, Math.abs(speed)), v.pos, Math.abs(speed));
      mem.set(p, { e: p.tp.e, j });
    }
  }
}

/* another player's train made up as they have it: T is their engine built light, code its trainCode */
function mpCompose(T, code) {
  const power = T.vehicles.slice(), used = new Set(), V = [];
  for (const tok of code.split(',').slice(0, 240)) {
    if (tok[0] === '#') {
      const v = power[+tok.slice(1)];
      if (!v || used.has(v)) throw new Error('their engine is built differently');
      used.add(v); V.push(v); continue;
    }
    const k = carTokenIn(tok); if (!k) throw new Error('unknown car ' + tok.slice(0, 20));
    const v = carFromToken(k); T.track(v); T.markerLamps(v); V.push(v);
  }
  if (used.size !== power.length) { for (const v of V) if (!power.includes(v)) { T.scene.remove(v.root); freeVehicle(v); } throw new Error('their engine is built differently'); }
  T.vehicles = V; T.layout(); T.buildInstances();
}

/* ---------------- another player's train ---------------- */
class RemoteTrain {
  constructor(peer, st, extra) {
    this.peer = peer;
    this.key = `${st.lk}|${st.ck}|${st.u}|${st.tm || ''}`; this.paint = `${st.lv}|${st.mx}|${st.cu}|${st.no}`;
    const code = extra && extra.code;
    this.train = new Train(scene, st.lk, code ? 'light' : st.ck, Object.assign(mpOpts(st), { remote: true }));
    if (code) { try { mpCompose(this.train, code); } catch (e) { this.train.disposeDeep(); throw e; } }
    prepareTrain(this.train);
    this.a0 = this.train.pts[0].a;
    this.tp = null; this.err = 0; this.v = 0; this.theta = 0; this.chuffQ = null; this.idleT = 0; this.bellT = 0.8; this.updT = 0;
    this.mem = new Map(); this.visible = true; this.placed = false; this.poly = []; this.lastFx = 0;
    this.tv = new THREE.Vector3(); this.wp = new THREE.Vector3();
  }
  repaint(st) {
    const p = `${st.lv}|${st.mx}|${st.cu}|${st.no}`; if (p === this.paint) return; this.paint = p;
    if (!this.train.diesel || this.train.elec) return;
    const o = mpOpts(st);
    this.train.units.forEach((m, u) => { const lv = dieselLiveryFor(o, u); applyLivery(m, lv, (o.number || lv.num) + u); });
  }
  /* lat: how old this state is by now, in seconds. The train has run on since it was sent, so it is
     drawn that much further along, or it trails its true place by the network delay. */
  target(st, lat = 0) {
    const e = MP.edges.get(st.e); if (!e) return;
    const tp = new TrackPos(e, clamp(st.s, 0, e.len), st.o);
    if (lat > 0 && st.v && !st.dr) tp.advance(st.v * lat, null);
    // since: when this train appeared where it is, so a train made up on top of ours is not taken for a collision
    if (!this.tp) { this.tp = tp; this.err = 0; this.since = performance.now(); }
    else { const d = trackDelta(this.tp, tp); if (d === null || Math.abs(d) > 45) { this.tp = tp; this.err = 0; this.since = performance.now(); } else this.err = d; }
    this.v = st.v;
    // their wreck, as they see it: the same cars go over in the same order while it slides to rest
    const wk = st.dr && st.wk ? st.wk.join() : '';
    if (wk !== (this.wkKey || '')) { this.wkKey = wk; this.train.wreck(wk ? { a: st.wk[0], side: st.wk[1], seed: st.wk[2], k: st.wk[3], v0: st.wk[4], vs: st.wk[5] || 0, hit: !!st.wk[6] } : null); }
  }
  frame(dt, st, cam, force) {
    if (!this.tp) return;
    const c = this.err * Math.min(1, dt * 5); this.err -= c;
    const step = this.v * dt + c;
    if (step) this.tp.advance(step, null);
    const T = this.train;
    T.dist += step; this.theta -= step / LG.rD;
    this.tp.pose(FR);
    const far = !force && FR.p.distanceTo(cam) > 2600 + T.length;
    if (far) { if (this.visible) { T.setVisible(false); this.visible = false; } this.updT += dt; if (this.placed && this.updT < 0.5) return; }
    else if (!this.visible) { T.setVisible(true); this.visible = true; }
    this.updT = 0;
    for (const p of T.pts) { if (p.tp) p.tp.copy(this.tp); else p.tp = this.tp.clone(); const off = p.a - this.a0; if (off) p.tp.advance(-off, null); }
    // their wreck plays out here too, the cars still on the rails going at the speed they report
    if (T.rb) { this.kin = this.kin || { v: 0, mass: 0, force: 0 }; this.kin.v = this.v; try { T.rb.step(dt, this.kin); } catch (e) { T.rb.asleep = true; } }
    T.update(dt, this.theta, st.rv || 0);
    // polyline for contact tests: front coupler, every tracked point, rear coupler
    const n = T.pts.length + 2;
    while (this.poly.length < n) this.poly.push(new THREE.Vector3());
    mpEnds(T, this.poly[0], this.poly[n - 1]);
    for (let i = 0; i < T.pts.length; i++) this.poly[i + 1].copy(T.pts[i].F.p);
    this.polyN = n;
    this.placed = true;
  }
  fx(dt, st, cam) {
    // the bell's strokes: the sound rings on them and the bell swings to them
    const bellP = this.train.diesel ? 1.05 : 0.86; let struck = false;
    if (st.bl) { this.bellT += dt; if (this.bellT > bellP) { this.bellT = 0; struck = this.bellHit = true; } } else { this.bellT = 0.8; this.bellHit = false; }
    if (!this.placed || !this.visible) return;
    const T = this.train, L = T.loco, night = SKY.dark;
    bellSwing(T, !!st.bl, this.bellT, bellP, struck, dt);
    if (!T.diesel) clsLampsShow(L.cls, !!st.cl);
    const head = T.lead.pos, d = head.distanceTo(cam);
    this.tv.copy(T.lead.fwd).multiplyScalar(this.v);
    // lamps
    const hl = st.hl;
    L.beam.material.opacity = hl === 0 ? 0 : Math.max(night * (hl === 2 ? 0.075 : 0.035), wxBeam());
    L.halo.material.opacity = hl === 0 ? 0 : lerp(0.35, 1, night) * (hl === 2 ? 1 : 0.6) * lampFacing(L, cam);
    if (L.ditch && L.ditch.length) {
      const ph = Math.floor(performance.now() / 385) % 2, flash = st.wh > 0.05 || st.bl, on = (T.diesel ? st.dl : 1) && hl > 0;
      L.ditch.forEach((dd, k) => { const b = !on ? 0.12 : (flash ? (ph === k ? 1 : 0.15) : 0.85); dd.lens.material.color.setScalar(0.25 + 0.75 * b); dd.halo.material.opacity = b * lerp(0.45, 1, night); });
    }
    if (!T.diesel) {
      const fl = 0.85 + 0.15 * Math.sin(performance.now() * 0.023);
      L.fire.material.color.setRGB(fl, 0.4 * fl + 0.1, 0.1); L.ash.material.opacity = night * 0.3 * fl;
    }
    // exhaust
    if (d < 1500) {
      if (T.elec) {
        // electric: nothing out of a stack
      } else if (T.diesel) {
        this.idleT += dt;
        if (this.idleT > 0.09 && st.rpm > 60) {
          this.idleT = 0;
          const rf = clamp((st.rpm - 300) / 750, 0, 1), a = 0.12 + 0.25 * rf * st.ex;
          for (const m of T.units) emit(T.unitWorld(m, m.stackPos, this.wp), _mpA.set(this.tv.x + (Math.random() - 0.5) * 0.6, 4 + 9 * rf, this.tv.z + (Math.random() - 0.5) * 0.6), 2.5 + Math.random() * 1.5, 0.7, 3.5 + 3 * rf, a, [0.62, 0.62, 0.63], 0.5, 1.1);
        }
      } else {
        const q = Math.floor(-this.theta / (Math.PI / 2));
        if (this.chuffQ === null) this.chuffQ = q;
        if (q !== this.chuffQ) {
          const steps = Math.min(4, Math.abs(q - this.chuffQ)), n = Math.abs(this.v) / DRIVER_C, inten = st.ex;
          if (inten > 0.05) for (let i = 0; i < steps; i++) {
            if (this.bus && d < 900) sndChuff(q - i, n, inten * (0.6 + 0.4 * Math.min(1, n * 1.2)), this.bus.g, false);
            const stack = T.worldOf(L.stackPos, this.wp);
            for (let j = 0; j < 2; j++) emit(stack, _mpA.set(this.tv.x + (Math.random() - 0.5) * 1.5, 7 + 13 * inten + Math.random() * 3, this.tv.z + (Math.random() - 0.5) * 1.5), 4 + Math.random() * 3 + inten * 2, 1.1, 7 + inten * 7, 0.55 + 0.25 * inten, [0.7, 0.69, 0.67], 0.9, 1.1);
          }
          this.chuffQ = q;
        }
        this.idleT += dt;
        if (this.idleT > 0.14) { this.idleT = 0; if (st.ex < 0.05) emit(T.worldOf(L.stackPos, this.wp), _mpA.set(this.tv.x, 2.8, this.tv.z), 5 + Math.random() * 2, 1.0, 5.5, 0.12, [0.55, 0.53, 0.5], 0.7, 0.9); }
      }
    }
    // sound
    if (!AU.on) return;
    if (!this.bus) this.bus = makeRemoteBus(T.diesel && !T.elec);
    remoteSound(this, dt, st, d, cam);
    if (d < 160 && Math.abs(this.v) > 0.6) mpJoints(T, this.mem, this.v, cam);
  }
  dispose() {
    this.train.disposeDeep();
    if (this.bus) this.bus.kill(); if (this.wh) this.wh.kill(); this.bus = this.wh = null;
  }
}

/* ---------------- rooms ---------------- */
MP.init = function () {
  let id = ''; for (let i = 0; i < 10; i++) id += 'abcdefghijkmnpqrstuvwxyz23456789'[(Math.random() * 32) | 0];
  MP.id = id; MP.color = MP_ME;
  let nm = ''; try { nm = localStorage.getItem('bd_name') || ''; } catch (e) {}
  MP.name = mpText(nm, 16) || 'Engineer ' + (10 + ((Math.random() * 89) | 0));
  try {
    const q = new URLSearchParams(location.search);
    const code = (q.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length >= 4 && code.length <= 6) MP.autoJoin = code;
    const b = q.get('broker') || '';
    if (/^wss?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/[\w\-/]*)?$/.test(b)) MP.brokers = [b];
  } catch (e) {}
  const nameIn = $('mpName'), codeIn = $('mpCode');
  nameIn.value = MP.name;
  nameIn.addEventListener('input', () => { MP.name = mpText(nameIn.value, 16) || 'Engineer'; try { localStorage.setItem('bd_name', MP.name); } catch (e) {} MP.dirty = true; });
  if (MP.autoJoin) codeIn.value = MP.autoJoin;
  codeIn.addEventListener('input', () => { const v = codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); if (v !== codeIn.value) codeIn.value = v; });
  codeIn.addEventListener('keydown', e => { if (e.key === 'Enter') $('mpJoin').click(); });
  $('mpCreate').addEventListener('click', () => MP.create());
  $('mpJoin').addEventListener('click', () => { const c = codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length < 4) { MP.say('Type the room code your friend sent you.', true); codeIn.focus(); return; } MP.join(c); });
  $('mpLeave').addEventListener('click', () => MP.leave());
  for (const id2 of ['mpShare', 'mpShare2']) $(id2).addEventListener('click', () => MP.share());
  $('btnPlayers').addEventListener('click', () => { const p = $('mpPanel'); p.hidden = !p.hidden; if (!p.hidden) { MP.panel(); carPanelToggle(false); } });
  $('mpPanelClose').addEventListener('click', () => { $('mpPanel').hidden = true; });
  $('mpWatchBack').addEventListener('click', () => MP.unwatch());
  const send = () => { const t = mpText($('mpChatIn').value, 80); if (!t) return; $('mpChatIn').value = ''; MP.talk(t); };
  $('mpSend').addEventListener('click', send);
  $('mpChatIn').addEventListener('keydown', e => { if (e.key === 'Enter') send(); e.stopPropagation(); });
  for (const b of document.querySelectorAll('#mpQuick button')) b.addEventListener('click', () => MP.talk(b.dataset.q));
  addEventListener('pagehide', () => { if (MP.on) MP.bye(); });
  // keep reporting while the page is in the background (animation frames stop there)
  setInterval(() => { if (MP.on && performance.now() - MP.sentAt > 900) { MP.sentAt = performance.now(); MP.send(); } }, 1000);
  MP.ui();
};
MP.worldReady = function () {
  MP.ready = true;
  MP.edges = new Map(NET.edges.map(e => [e.id, e]));
  MP.ui();
  MP.ly = WORLD.custom ? layoutHash(PLAY_LAYOUT) : WORLD.mtn ? 'route:laurel' : '';
  if (MP.autoJoin) MP.join(MP.autoJoin);
};
MP.create = function () {
  let c = ''; for (let i = 0; i < 5; i++) c += MP_CODE[(Math.random() * MP_CODE.length) | 0];
  MP.connect(c, true);
};
MP.join = function (code) { MP.connect(code, false); };
MP.connect = function (code, creator) {
  if (!MP.ready) { MP.autoJoin = code; MP.ui(); return; }
  if (MP.on) MP.leave(true);
  MP.on = true; MP.code = code; MP.creator = creator; MP.joinedAt = performance.now(); MP.onSince = 0;
  MP.swv = NET.switches.map(() => creator ? 1 : 0); MP.seen = NET.switches.map(() => 0); MP.pend.clear(); MP.lt = null;
  MP.spawned = creator && GAME.running; MP.needSpawn = !MP.spawned;
  MP.topic = 'bdiv/v1/' + code; MP.hit = null;
  const will = { topic: MP.topic, payload: JSON.stringify({ id: MP.id, bye: 1 }) };
  MP.links = MP.brokers.map((url, i) => { const l = new MiniMQTT(url, 'bd-' + MP.id + '-' + i, will, (t, txt) => t === MP.topic ? MP.onText(txt) : t === MP.topic + '/c' ? MPC.onText(txt) : MP.onWorldText(txt), () => MP.ui()); l.subscribe(MP.topic); l.subscribe(MP.topic + '/w'); l.subscribe(MP.topic + '/c'); return l; });
  MP.worldJoin(creator);
  MPC.join(creator);
  mpRoomLink(code, st => MP.receive(st), id => MP.drop(id, 'left')).then(link => { if (link && MP.on && MP.code === code) { MP.room = link; MP.ui(); } else if (link) link.close(); });
  try { history.replaceState(null, '', location.pathname + mpQuery(code)); } catch (e) {}
  MP.dirty = true; MP.ui(); startLabel();
  setTimeout(() => MP.ui(), 2500); setTimeout(() => MP.ui(), 9000);
};
MP.bye = function () {
  const txt = JSON.stringify({ id: MP.id, bye: 1 });
  for (const l of MP.links) l.publish(MP.topic, txt);
};
MP.leave = function (quiet) {
  if (!MP.on) return;
  MP.bye();
  for (const l of MP.links) l.close();
  if (MP.room) MP.room.close();
  MPC.leave();
  MP.links = []; MP.room = null; MP.on = false; MP.code = ''; MP.needSpawn = false; MP.spawned = false;
  for (const id of [...MP.peers.keys()]) MP.drop(id, null);
  MP.unwatch(); $('mpPanel').hidden = true;
  try { history.replaceState(null, '', location.pathname + mpQuery('')); } catch (e) {}
  if (!quiet) toast('Left the room. You are driving solo.', '', 3000);
  MP.ui(); startLabel();
};
MP.share = function () {
  const inClaude = !!(window.claude && window.claude.use);
  const url = location.origin + location.pathname + '?room=' + MP.code;
  const text = `Drive with me on Berkshire Division. Room ${MP.code}`;
  if (!inClaude && navigator.share) { navigator.share({ title: 'Berkshire Division', text, url }).catch(() => {}); return; }
  const what = inClaude ? MP.code : url;
  const done = () => toast(inClaude ? `Room code ${MP.code} copied.` : 'Room link copied. Send it to your friends.', 'good', 3000);
  try { navigator.clipboard.writeText(what).then(done, () => toast(`Room code: ${MP.code}`, '', 6000)); } catch (e) { toast(`Room code: ${MP.code}`, '', 6000); }
};
MP.status = function () {
  if (!MP.on) return 'off';
  if (MP.links.some(l => l.ok) || (MP.room && MP.room.ok())) return 'on';
  if (MP.links.every(l => l.dead) && !MP.room) return 'failed';
  return 'connecting';
};
/* how long to hold a new train back after joining, so we know where everyone else is first */
MP.spawnWait = function () {
  if (!MP.on || !MP.needSpawn) return 0;
  const now = performance.now(), st = MP.status();
  if (st === 'on') { if (!MP.onSince) MP.onSince = now; return Math.max(0, 1500 - (now - MP.onSince)); }
  if (st === 'connecting' && now - MP.joinedAt < 9000) return 400;
  return 0;
};
MP.ui = function () {
  const st = MP.status(), n = MP.peers.size + 1;
  if (st === 'on' && !MP.onSince) MP.onSince = performance.now();
  $('mpSolo').hidden = MP.on; $('mpInRoom').hidden = !MP.on;
  $('mpCreate').disabled = $('mpJoin').disabled = !MP.ready;
  $('mpCodeBig').textContent = MP.code;
  $('mpShare').textContent = window.claude && window.claude.use ? 'Copy code' : 'Share link';
  const s = $('mpStatus');
  s.textContent = !MP.ready ? 'Loading the railroad…' : st === 'off' ? 'Drive with friends: create a room, then send them the link or the code.'
    : st === 'connecting' ? `Connecting to room ${MP.code}…` : st === 'failed' ? "Couldn't reach the room server. Check your connection, then try again."
    : n === 1 ? `In room ${MP.code}. Nobody else yet: send your friends the link.` : `In room ${MP.code} with ${n - 1} other${n > 2 ? 's' : ''}.`;
  $('btnPlayers').hidden = !MP.on;
  $('mpCount').textContent = n;
  $('mpPanelCode').textContent = MP.code;
  if (MP.jobOn !== MP.on) { MP.jobOn = MP.on; jobMenu(); }
};
MP.say = function (msg, warn) { const s = $('mpStatus'); s.textContent = msg; if (warn) s.style.color = 'var(--approach)'; setTimeout(() => { s.style.color = ''; MP.ui(); }, 3500); };
MP.talk = function (text) {
  if (!MP.on) return;
  MP.chatN++; MP.chat = [MP.chatN, text]; MP.dirty = true;
  MP.addLog(MP.name, MP.color, text);
};
MP.addLog = function (name, color, text) {
  MP.log.push({ name, color, text }); if (MP.log.length > 30) MP.log.shift();
  const box = $('mpLog'); if (!box) return;
  const row = document.createElement('div'); const b = document.createElement('b'); b.textContent = name + ': '; b.style.color = color; row.appendChild(b); row.appendChild(document.createTextNode(text)); box.appendChild(row);
  while (box.children.length > 30) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
};

/* ---------------- messages ---------------- */
MP.onText = function (txt) { if (txt.length > 16000) return; let r; try { r = JSON.parse(txt); } catch (e) { return; } MP.receive(r); };
MP.receive = function (raw) {
  if (!MP.on || !MP.ready) return;
  const st = mpClean(raw);
  if (!st || st.id === MP.id) return;
  if (st.bye) { MP.drop(st.id, 'left'); return; }
  let p = MP.peers.get(st.id);
  if (!p) {
    if (MP.peers.size >= 8) return;
    p = { id: st.id, q: -1, color: MP_COLORS[mpHash(st.id) % MP_COLORS.length], st, at: 0, rt: null, tag: null, lastCh: st.ch ? st.ch[0] : 0 };
    MP.peers.set(st.id, p);
    toast(performance.now() - MP.joinedAt < 3000 ? `${st.nm} is in the room.` : `${st.nm} joined the room.`, 'good', 3200);
    MP.ui();
  } else if (st.q <= p.q) return;
  p.q = st.q; p.st = st; p.at = performance.now();
  // round trip from their echo of our send time, less the time they held it before replying
  p.ts = st.ts; p.rx = p.at;
  if (st.ak) { const rtt = p.at - st.ak[0] - st.ak[1]; if (rtt > 0 && rtt < 5000) p.rtt = p.rtt ? p.rtt * 0.85 + rtt * 0.15 : rtt; }
  if (st.sw) MP.mergeSwitches(p, st.sw);
  if (st.hx && st.hx[0] === MP.id && st.hx[1] > (p.hx || 0)) { const fresh = p.hx !== undefined; p.hx = st.hx[1]; if (fresh) MP.struck(p, st.hx); }
  else if (p.hx === undefined) p.hx = st.hx ? st.hx[1] : 0;
  if (st.ch && st.ch[0] !== p.lastCh) { p.lastCh = st.ch[0]; if (st.ch[1]) { toast(`${st.nm}: ${st.ch[1]}`, '', 5200); MP.addLog(st.nm, p.color, st.ch[1]); } }
  if (st.e < 0) { if (p.rt) { if (MP.watching === p.id) MP.unwatch(); p.rt.dispose(); p.rt = null; } return; }
  // what their train is made up of: the cars come with the state now and then, and are kept until they change
  if (st.vs) p.vs = { h: st.vh, code: st.vs };
  const code = st.vh ? (p.vs && p.vs.h === st.vh ? p.vs.code : null) : null;
  const key = `${st.lk}|${st.ck}|${st.u}|${st.tm || ''}|${st.vh ? (code ? st.vh : '?') : ''}`;
  // until the list of cars comes in, the train they had is kept on show
  if (p.rt && p.rt.key !== key && !(st.vh && !code && p.rt.key.startsWith(`${st.lk}|${st.ck}|${st.u}|${st.tm || ''}|`))) { p.rt.dispose(); p.rt = null; }
  if (!p.rt) {
    try { p.rt = new RemoteTrain(p, st, code ? { code } : undefined); p.rt.key = key; }
    catch (e) { console.warn('remote train', e); if (!code) return; try { p.rt = new RemoteTrain(p, st); p.rt.key = key; } catch (e2) { return; } }
  }
  p.rt.repaint(st);
  p.rt.target(st, MP.lag(p));
};
/* one-way delay to a player in seconds: half the measured round trip, a guess until there is one */
MP.lag = p => clamp((p.rtt || 300) / 2000, 0, 1.5);
MP.drop = function (id, why) {
  const p = MP.peers.get(id); if (!p) return;
  if (MP.watching === id) MP.unwatch();
  if (p.rt) p.rt.dispose();
  if (p.tag) p.tag.remove();
  MP.peers.delete(id);
  if (why) toast(`${p.st.nm} left the room.`, '', 3000);
  MP.ui();
};
MP.state = function () {
  const T = GAME.train, g = GAME.settings;
  const now = performance.now();
  const st = { id: MP.id, q: ++MP.q, nm: MP.name, ly: MP.ly, e: -1, pz: (S.paused || !GAME.running) ? 1 : 0, ts: Math.round(now) };
  // echo each player's last send time so they can time the round trip
  if (MP.peers.size) { st.ak = {}; for (const p of MP.peers.values()) if (p.ts !== undefined) st.ak[p.id] = [p.ts, Math.round(now - p.rx)]; }
  if (MPC.synced) st.cs = 1;
  if (MP.spawned && T) {
    // while the train is held up to be placed, the room still sees it where it stood
    const held = PLACE.on && PLACE.ghost && PLACE.ghost.kind === 'train' ? PLACE.ghost.orig : null;
    const f = held ? held[0] : T.pts[0].tp;
    Object.assign(st, {
      lk: T.locoKey, ck: T.consistKey, u: T.nUnits || 1, lv: g.livery, mx: g.mix ? 1 : 0, cu: g.livery === 'custom' ? [g.custom.body, g.custom.accent, g.custom.letter] : 0, no: g.livery === 'custom' ? (+g.number || 0) : 0, tm: T.trim || '',
      e: f.e.id, s: +f.s.toFixed(2), o: f.o, v: PLACE.on ? 0 : +S.v.toFixed(2), rv: +S.reverser.toFixed(2), wh: +S.whistle.toFixed(2), bl: S.bell ? 1 : 0, cl: S.classLamps ? 1 : 0, hl: S.light, dl: S.ditch ? 1 : 0,
      ex: T.diesel ? +S.load.toFixed(2) : (S.Psc > 6 && S.cut > 0 && S.throttle > 0.02 ? +clamp((S.Psc / SK.PL) * (0.35 + S.cut * 1.25), 0, 1.3).toFixed(2) : 0),
      rpm: T.diesel && !T.elec && S.engineRun ? Math.round(S.rpm) : 0, dr: S.derailed ? 1 : 0,
    });
    // a train made up differently from what its engine and train build (cars picked up, set out or placed) says what is in it
    const code = trainCode(T);
    if (code !== T.code0) {
      st.vh = mpHash(code);
      if (code !== MP.code1) { MP.code1 = code; MP.codeAt = now; }
      if (now - MP.codeAt < 3000 || MP.q % 8 === 0) st.vs = code;
    }
    if (S.derailed && T.wk) st.wk = [+T.wk.a.toFixed(1), T.wk.side, T.wk.seed, +T.wk.k.toFixed(2), +(T.wk.v0 || 0).toFixed(1), +(T.wk.vs || 0).toFixed(2), T.wk.hit ? 1 : 0];
  }
  { const av = WALK.net(); if (av) st.av = av; }
  st.sw = NET.switches.map((sw, i) => MP.swv[i] * 2 + sw.state);
  if (MP.lt) st.lt = MP.lt;
  if (MP.hit) st.hx = MP.hit;
  if (MP.chat) st.ch = MP.chat;
  return st;
};
MP.send = function () {
  const st = MP.state(); MP.last = st;
  const txt = JSON.stringify(st);
  for (const l of MP.links) l.publish(MP.topic, txt);
  if (MP.room) MP.room.send(st);
};

/* ---------------- switches ---------------- */
MP.mergeSwitches = function (p, vec) {
  NET.switches.forEach((sw, i) => {
    const pv = Math.floor(vec[i] / 2), ps = vec[i] & 1, lv = MP.swv[i];
    if (pv > MP.seen[i]) MP.seen[i] = pv;
    if (!(pv > lv || (pv === lv && ps !== sw.state && p.id < MP.id))) return;
    if (ps !== sw.state && GAME.train && GAME.occupied(sw)) { const pd = MP.pend.get(i); if (!pd || pd.v <= pv) MP.pend.set(i, { v: pv, s: ps }); return; }
    if (ps !== sw.state) MP.setSwitch(sw, ps, pv > lv && pv > 1 ? MP.thrower(i, pv) : null);
    MP.swv[i] = pv; MP.pend.delete(i);
  });
};
MP.thrower = function (i, v) { for (const p of MP.peers.values()) if (p.st.lt && p.st.lt[0] === i && p.st.lt[1] === v) return p.st.nm; return null; };
MP.setSwitch = function (sw, state, who) {
  sw.state = state;
  if (who) toast(`${who} threw ${sw.name}: lined for ${sw.lined}.`, '', 2800);
  if (MAP.visible) MAP.draw();
};
MP.noteThrow = function (sw) {
  if (!MP.on) return;
  const i = NET.switches.indexOf(sw); if (i < 0) return;
  MP.swv[i] = Math.max(MP.swv[i], MP.seen[i]) + 1; MP.seen[i] = MP.swv[i];
  MP.lt = [i, MP.swv[i]]; MP.pend.delete(i); MP.dirty = true;
};
MP.occupant = function (sw) {
  if (!MP.on) return null;
  for (const p of MP.peers.values()) {
    const rt = p.rt; if (!rt || !rt.placed) continue;
    if (rt.train.fouls(sw)) return p.st.nm;
  }
  return null;
};

/* true when len metres of track behind front are clear of every other player's train */
MP.clearOf = function (front, len) {
  if (!MP.on) return true;
  const rts = [...MP.peers.values()].map(p => p.rt).filter(rt => rt && rt.placed && rt.polyN);
  if (!rts.length) return true;
  const tp = front.clone(), F = newFrame();
  for (let d = 0; d <= len; d += 2) {
    if (d) tp.advance(-2, null);
    tp.pose(F);
    for (const rt of rts) for (let i = 0; i < rt.polyN - 1; i++) if (mpSegDist(F.p, rt.poly[i], rt.poly[i + 1]) < 1.6) return false;
  }
  return true;
};

/* ---------------- spawning ---------------- */
MP.spawnSlot = function (T) {
  // make sure every train we have heard about is placed before looking for room
  for (const p of MP.peers.values()) if (p.rt && p.rt.tp && !p.rt.placed) p.rt.frame(0, p.st, camera.position, true);
  const rts = [...MP.peers.values()].map(p => p.rt).filter(rt => rt && rt.placed && rt.polyN);
  // the cars standing about are shared too, so a new train is not made up on top of them
  // (and, in single player, nor on top of your other trains or the timetable trains)
  const polys = [...rts.map(rt => rt.poly.slice(0, rt.polyN)), ...CARS.cuts.map(c => c.pts.map(p => p.F.p)), ...AI.trains.map(a => a.train.pts.map(p => p.F.p))];
  // clear when no other train or car comes within 3.4 m of the track centre anywhere along our length, plus 30 m each end
  const clear = (line, sF) => {
    for (let s = sF + 30; s >= sF - T.length - 30; s -= 3) {
      const P = line.poseAt(line.loop ? ((s % line.len) + line.len) % line.len : clamp(s, 0, line.len));
      _mpE.set(P.X, 0, -P.N);
      for (const poly of polys) for (let i = 0; i < poly.length - 1; i++) {
        _mpF.copy(poly[i]).setY(0); _mpG.copy(poly[i + 1]).setY(0);
        if (mpSegDist(_mpE, _mpF, _mpG) < 3.4) return false;
      }
    }
    return true;
  };
  for (const [name, off] of (WORLD.mtn ? MTN_SPAWNS : MP_SPAWNS)) {
    const line = ROUTE.lines[name]; if (!line) continue;
    const sF = off < 0 ? line.len + off : off;
    if (!line.loop && sF - T.length < 5) continue;
    if (clear(line, sF)) return { line, s: sF, name: (WORLD.mtn ? MTN_SPAWN_NAMES : MP_SPAWN_NAMES)[name] || name };
  }
  // every usual place is taken: anywhere on either main
  for (const name of ['Main', 'Main 2']) {
    const line = ROUTE.lines[name]; if (!line) continue;
    for (let sF = 1500; sF < line.len; sF += 700) if (clear(line, sF)) return { line, s: sF, name: MP_SPAWN_NAMES.Main };
  }
  return null;
};

/* ---------------- per frame ---------------- */
MP.frame = function (dt) {
  if (!MP.on) return;
  const now = performance.now(), cam = camera.position;
  for (const p of [...MP.peers.values()]) if (now - p.at > 15000) MP.drop(p.id, 'left');
  if (MP.pend.size && GAME.train) for (const [i, pd] of [...MP.pend]) {
    const sw = NET.switches[i]; if (GAME.occupied(sw)) continue;
    MP.pend.delete(i);
    if (pd.v >= MP.swv[i]) { if (pd.s !== sw.state) MP.setSwitch(sw, pd.s, MP.thrower(i, pd.v)); MP.swv[i] = pd.v; }
  }
  for (const p of MP.peers.values()) if (p.rt) p.rt.frame(dt, p.st, cam, MP.watching === p.id);
  MPC.tick();
  // by the wall clock, so a slow device still reports eight times a second
  if (now - MP.sentAt >= 125 || (MP.dirty && now - MP.sentAt > 40)) { MP.sentAt = now; MP.dirty = false; MP.send(); }
  MP.panelT += dt; if (MP.panelT > 0.5) { MP.panelT = 0; if (!$('mpPanel').hidden) MP.panel(); MP.ui(); }
};
MP.post = function (dt) {
  if (!MP.on) return;
  const cam = camera.position;
  for (const p of MP.peers.values()) if (p.rt) p.rt.fx(dt, p.st, cam);
  MP.tags();
};
/* Buffers and collisions with other players' trains, checked against our own two couplers.
   - Coupler to coupler: we buff off their end, and they feel the same hit on their screen, so a train
     that runs into another shoves it along. Over 25 mph both trains are wrecked.
   - Into the side of their train (foul at a switch or a crossover): over 5 mph both trains are wrecked,
     slower than that we stop against it.
   - A train made up on top of another (or found inside it on joining) passes through it untouched
     until the two are clear, instead of the pair locking together. */
const MP_END = 10, MP_TOUCH = 1.25, MP_SIDESWIPE = 2.2;
MP.contact = function (T) {
  if (!MP.on || !MP.spawned || !T) return;
  const front = _mpA, rear = _mpB; mpEnds(T, front, rear);
  const fwd = T.lead.fwd, now = performance.now();
  for (const p of MP.peers.values()) {
    const rt = p.rt; if (!rt || !rt.placed || !rt.polyN) continue;
    if (front.distanceTo(rt.poly[0]) > T.length + rt.train.length + 60) { p.touch = null; continue; }
    const touch = p.touch || (p.touch = [null, null]);
    let any = false;
    for (const [ei, end, sg] of [[0, front, 1], [1, rear, -1]]) {
      // nearest point of their train to this coupler, and how far along their train it is
      let d = 1e9, at = 0, run = 0, len = 0;
      for (let i = 0; i < rt.polyN - 1; i++) {
        const A = rt.poly[i], B = rt.poly[i + 1], L = A.distanceTo(B);
        const x = mpSegDist(end, A, B);
        if (x < d) { d = x; at = run + (L > 1e-6 ? clamp(_mpD.copy(end).sub(A).dot(_mpC.subVectors(B, A)) / (L * L), 0, 1) * L : 0); }
        run += L;
      }
      len = run;
      if (d > MP_TOUCH) { if (d > MP_TOUCH + 1) touch[ei] = null; continue; }
      any = true;
      const theirs = rt.train.lead.fwd.dot(fwd) * rt.v, closing = sg * (S.v - theirs);
      if (!touch[ei]) {
        // first contact for this coupler: what kind?
        const depth = Math.min(at, len - at);
        const fresh = now - (rt.since || 0) < 15000 || now - (GAME.spawnAt || 0) < 15000;
        const deep = MP.overlaps(T, rt, 3), slow = Math.abs(closing) < 0.45;
        touch[ei] = { kind: !deep && depth <= MP_END ? 'end' : (fresh || slow ? 'ghost' : 'side'), d };
        if (touch[ei].kind === 'ghost') toast(`Your train is overlapping ${p.st.nm}'s. Drive clear of it.`, 'warn', 4000, 'mpghost');
      }
      const tc = touch[ei];
      if (p.ghost || tc.kind === 'ghost') { p.ghost = true; continue; }
      if (tc.kind === 'side') {
        const sp = Math.abs(S.v - theirs);
        if (sp > MP_SIDESWIPE) { MP.wreckBoth(T, p, end, sp, sg); return; }
        // pressed against their side: no further in
        if (d < tc.d - 0.01 && Math.abs(S.v) > 0.02) { S.v = 0; S.vw = 0; toast(`Stopped against ${p.st.nm}'s train. It is foul of your track.`, 'warn', 3000, 'mpside'); }
        tc.d = Math.min(tc.d, d);
        continue;
      }
      // coupler to coupler
      if (closing > COUPLE_WRECK) { MP.wreckBoth(T, p, end, closing, sg); return; }
      if (closing > 0.02) {
        S.v = theirs - sg * buffE(closing) * closing; S.vw = S.v;
        if (closing > 0.3) sndClunk(clamp(closing / COUPLE_OK, 0.3, 1.5), 0);
        if (closing > COUPLE_OK) JOB.note('couple', { mph: closing / MPH, shove: true });
      }
      // their updates come a few times a second, so we can end up a little inside their end: back out
      const depth = Math.min(at, len - at);
      if (depth > 0.3 && depth <= MP_END + 2) T.move(-sg * (depth - 0.2), {});
    }
    if (!any) { touch[0] = touch[1] = null; if (p.ghost && !MP.overlaps(T, rt)) p.ghost = false; }
  }
};
/* n or more of our tracked points within a car width of their train: the two are inside each other */
MP.overlaps = function (T, rt, n = 1) {
  let k = 0;
  for (const q of T.pts) for (let i = 0; i < rt.polyN - 1; i++) if (mpSegDist(q.F.p, rt.poly[i], rt.poly[i + 1]) < 2) { if (++k >= n) return true; break; }
  return false;
};
/* a collision bad enough to put both trains on the ground */
MP.wreckBoth = function (T, p, end, sp, sg) {
  const mph = Math.round(sp / MPH);
  MP.hitN = (MP.hitN || 0) + 1;
  MP.hit = [p.id, MP.hitN, mph, +end.x.toFixed(1), +end.z.toFixed(1)];
  GAME.derail(`Collided with ${p.st.nm}'s train at ${mph} mph. Back away before you try again.`, 'Collision', { a: sg > 0 ? 0 : T.length, k: clamp((sp / MPH - 4) / 35, 0.3, 1) });
};
/* someone else's train hit ours hard */
MP.struck = function (p, hx) {
  const T = GAME.train; if (!T || !MP.spawned || S.derailed || !GAME.running) return;
  // where along our train it hit
  let a = 0, best = Infinity; _mpC.set(hx[3], 0, hx[4]);
  for (const v of T.vehicles) { const dd = Math.hypot(v.pos.x - _mpC.x, v.pos.z - _mpC.z); if (dd < best) { best = dd; a = v.a0 + v.len / 2; } }
  if (best > 80) return;   // not near us any more: an old message
  GAME.derail(`${p.st.nm}'s train hit yours at ${hx[2]} mph.`, 'Collision', { a, k: clamp((hx[2] - 4) / 35, 0.3, 1) });
};
MP.view = function () {
  if (!MP.watching) return null;
  const p = MP.peers.get(MP.watching);
  if (!p || !p.rt || !p.rt.placed) { MP.unwatch(); return null; }
  return p.rt.train;
};
MP.watch = function (id) {
  const p = MP.peers.get(id); if (!p || !p.rt) return;
  MP.watching = id; CAM.init = false; CAM.side = null;
  $('mpWatchName').textContent = p.st.nm; $('mpWatch').hidden = false; $('mpPanel').hidden = true;
};
MP.unwatch = function () { if (!MP.watching) return; MP.watching = null; CAM.init = false; CAM.side = null; $('mpWatch').hidden = true; };
MP.tags = function () {
  const W = innerWidth, H = innerHeight, cam = camera.position, box = $('mpTags');
  for (const p of MP.peers.values()) {
    const rt = p.rt; let el = p.tag;
    const show = rt && rt.placed && rt.visible && MP.watching !== p.id;
    if (!show) { if (el) el.style.display = 'none'; continue; }
    if (!el) {
      el = p.tag = document.createElement('div'); el.className = 'mpTag';
      const dot = document.createElement('i'); dot.style.background = p.color; el.appendChild(dot);
      el.appendChild(document.createElement('span')); el.appendChild(document.createElement('small')); box.appendChild(el);
    }
    const L = rt.train.loco;
    _mpC.set(L.cabEye ? L.cabEye.x : 0, 6.3, 0).applyMatrix4(L.root.matrixWorld);
    const d = _mpC.distanceTo(cam);
    _mpD.copy(_mpC).project(camera);
    if (d > 4500 || _mpD.z > 1 || _mpD.z < -1 || Math.abs(_mpD.x) > 1.1 || Math.abs(_mpD.y) > 1.1) { el.style.display = 'none'; continue; }
    el.style.display = '';
    el.style.transform = `translate(${Math.round((_mpD.x * 0.5 + 0.5) * W)}px,${Math.round((-_mpD.y * 0.5 + 0.5) * H)}px) translate(-50%,-100%)`;
    const nm = p.st.nm + (p.st.pz ? ' (in menu)' : ''), ds = fmtMi(d);
    if (el.children[1].textContent !== nm) el.children[1].textContent = nm;
    if (el.children[2].textContent !== ds) el.children[2].textContent = ds;
  }
};
MP.panel = function () {
  const box = $('mpList'); if (!box) return;
  const T = GAME.train, me = T && MP.spawned ? T.lead.pos : null;
  box.textContent = '';
  const row = (color, name, sub, right, peerId) => {
    const r = document.createElement('div'); r.className = 'mpP';
    const dot = document.createElement('i'); dot.style.background = color; r.appendChild(dot);
    const mid = document.createElement('div'); mid.className = 'mpN';
    const b = document.createElement('b'); b.textContent = name; mid.appendChild(b);
    const s = document.createElement('span'); s.textContent = sub; mid.appendChild(s); r.appendChild(mid);
    const rr = document.createElement('span'); rr.className = 'mpS'; rr.textContent = right; r.appendChild(rr);
    if (peerId) { const w = document.createElement('button'); w.className = 'btn'; w.textContent = 'Watch'; w.disabled = !(MP.peers.get(peerId).rt); w.addEventListener('click', () => MP.watch(peerId)); r.appendChild(w); }
    box.appendChild(r);
  };
  row(MP.color, MP.name + ' (you)', MP.last ? mpLocoLabel(MP.last) : 'In the menu', MP.spawned ? Math.round(Math.abs(S.v) / MPH) + ' mph' : '');
  for (const p of MP.peers.values()) {
    const st = p.st;
    let right = st.e >= 0 ? Math.round(Math.abs(st.v) / MPH) + ' mph' : '';
    if (st.dr) right = 'Derailed'; else if (st.pz && st.e >= 0) right = 'In the menu';
    if (me && p.rt && p.rt.placed) right += ' · ' + fmtMi(me.distanceTo(p.rt.train.lead.pos));
    row(p.color, st.nm, mpLocoLabel(st) + (p.rtt ? ` · ${Math.round(p.rtt / 2)} ms` : ''), right, p.id);
  }
};
MP.drawMap = function (g, tx, ty, opt) {
  if (!MP.on) return;
  for (const p of MP.peers.values()) {
    const rt = p.rt; if (!rt || !rt.placed) continue;
    const T = rt.train;
    g.strokeStyle = p.color; g.lineWidth = 4 * opt.w; g.beginPath();
    T.vehicles.forEach((v, i) => { const x = tx(v.pos.x), y = ty(-v.pos.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    const q = T.lead.pos, x = tx(q.x), y = ty(-q.z);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, 3 * opt.w, 0, TAU); g.fill();
    if (opt.labels) { g.font = `700 ${opt.fs}px "IBM Plex Sans Condensed", sans-serif`; g.textAlign = 'left'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(p.st.nm, x + 7, y - 7); g.fillStyle = p.color; g.fillText(p.st.nm, x + 7, y - 7); }
  }
};
