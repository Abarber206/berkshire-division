/* ============================================================================
   Which railroad a room runs on. Everyone in a room has to drive the same track,
   so the room carries its world on <room>/w: the built-in division, or a layout
   from the editor sent whole. The message is retained by the brokers so a late
   joiner gets it at once. The room's creator announces its world; in a room with
   no creator (everyone came from a shared build), the first player to find it
   silent claims it. A creator's word beats a claim, a newer one beats an older,
   and anyone on a different world loads the room's and rejoins.
   ========================================================================== */
/* a layout's identity: the sanitised pieces in id order, its name and start */
function layoutCanon(m) {
  const v = m && edValidImport(m); if (!v) return '';
  v.pieces.sort((a, b) => a.id - b.id);
  return JSON.stringify({ name: v.name, pieces: v.pieces, start: v.start });
}
const layoutHash = m => mpHash(layoutCanon(m)).toString(36);

function mpQuery(room) {   // keep ?layout= when the room part of the address changes
  const q = new URLSearchParams(location.search); q.delete('room');
  if (room) q.set('room', room);
  const t = q.toString(); return t ? '?' + t : '';
}
MP.world = null;
MP.worldJoin = function (creator) {
  MP.world = creator ? { at: Date.now(), id: MP.id, ly: MP.ly, cr: 1 } : null;
  clearTimeout(MP.worldT);
  // nothing is sent until a broker is reached, so every step waits for a live link
  const code = MP.code; let since = 0, asked = false;
  const step = () => {
    if (!MP.on || MP.code !== code) return;
    if (MP.status() !== 'on') { since = 0; MP.worldT = setTimeout(step, 500); return; }
    if (creator) { MP.sendWorld(true); return; }
    if (MP.world) return;
    if (!since) since = performance.now();
    // ask whoever holds the world, then claim it ourselves if the room stays quiet for 4 s
    if (!asked && performance.now() - since > 400) { asked = true; MP.pubWorld(JSON.stringify({ id: MP.id, wq: 1 })); }
    if (performance.now() - since < 4000) { MP.worldT = setTimeout(step, 500); return; }
    MP.world = { at: Date.now(), id: MP.id, ly: MP.ly, cr: 0 }; MP.sendWorld(true);
  };
  MP.worldT = setTimeout(step, 300);
};
MP.pubWorld = function (txt, retain) { for (const l of MP.links) l.publish(MP.topic + '/w', txt, retain); };
MP.sendWorld = function (retain) {
  if (!MP.on || !MP.world || MP.world.ly !== MP.ly) return;
  const lay = WORLD.custom ? layoutCanon(PLAY_LAYOUT) : '';
  MP.pubWorld(JSON.stringify({ id: MP.world.id, at: MP.world.at, cr: MP.world.cr, ly: MP.ly, nm: WORLD.custom ? PLAY_LAYOUT.name : ROUTES[WORLD.mtn ? 'laurel' : 'ohio'].name, lay }), retain);
};
MP.onWorldText = function (txt) {
  if (!MP.on || txt.length > 2e6) return;
  let r; try { r = JSON.parse(txt); } catch (e) { return; }
  if (!r || typeof r.id !== 'string' || !/^[a-z0-9]{6,16}$/.test(r.id)) return;
  if (r.wq) { if (r.id !== MP.id && MP.world && MP.world.ly === MP.ly) setTimeout(() => MP.sendWorld(false), 200 + Math.random() * 800); return; }
  if (typeof r.ly !== 'string' || typeof r.at !== 'number' || !isFinite(r.at)) return;
  const cur = MP.world, cr = r.cr ? 1 : 0;
  if (MP.creator) return;   // the creator's railroad stands
  if (cur && (cur.cr > cr || (cur.cr === cr && (cur.at > r.at || (cur.at === r.at && cur.id >= r.id))))) return;
  MP.world = { at: r.at, id: r.id, ly: r.ly, cr };
  if (r.ly !== MP.ly) MP.adoptWorld(r);
};
MP.adoptWorld = function (r) {
  let id = '', route = '';
  if (/^route:/.test(r.ly)) { route = r.ly.slice(6); if (!ROUTES[route]) return; }
  else if (r.ly) {
    let m = null; try { m = edValidImport(JSON.parse(r.lay)); } catch (e) { m = null; }
    if (!m || layoutHash(m) !== r.ly) return;
    m.id = 'R' + r.ly; m.from = 'room';
    if (!LAYOUTS.put(m)) { MP.say("This room runs on a layout your browser couldn't save.", true); return; }
    id = m.id;
  }
  // never bounce between worlds: one reload per room and railroad
  const key = MP.code + ':' + r.ly;
  try {
    const o = JSON.parse(sessionStorage.getItem('bd_world') || 'null');
    if (o && o.key === key && Date.now() - o.t < 30000) { MP.say("Could not load the room's railroad.", true); return; }
    sessionStorage.setItem('bd_world', JSON.stringify({ key, t: Date.now() }));
  } catch (e) {}
  const name = mpText(r.nm, 32) || 'the room\'s railroad';
  MP.say(`This room runs on ${name}. Loading it…`); toast(`This room runs on ${name}. Loading it…`, '', 4000);
  // a room on a built-in railroad names it, so a browser that last drove the other one doesn't load that
  const q = new URLSearchParams(); if (id) q.set('layout', id); else q.set('route', route || 'ohio'); q.set('room', MP.code);
  setTimeout(() => { location.href = location.pathname + '?' + q.toString(); }, 1200);
};

/* a free stretch of a custom layout for a new train in a room */
MP.layoutSlot = function (need) {
  for (const p of MP.peers.values()) if (p.rt && p.rt.tp && !p.rt.placed) p.rt.frame(0, p.st, camera.position, true);
  const others = [];
  for (const p of MP.peers.values()) if (p.rt && p.rt.placed) for (let i = 0; i < p.rt.polyN; i++) others.push(p.rt.poly[i]);
  const cands = [];
  const st = layoutStart(PLAY_LAYOUT); cands.push(new TrackPos(st.edge, st.s, st.o));
  for (const e of [...NET.edges].sort((a, b) => b.len - a.len)) for (let s = e.len - 20; s > 20; s -= 80) { cands.push(new TrackPos(e, s, 1)); cands.push(new TrackPos(e, e.len - s, -1)); }
  for (const c of cands) {
    const tp = layoutFit(c, need); if (!tp) continue;
    const w = tp.clone(); w.advance(30, null);
    let clear = true;
    for (let d = 0; d < need + 60 && clear; d += 6) {
      w.pose(FR); for (const q of others) if (q.distanceTo(FR.p) < 3.4) { clear = false; break; }
      if (w.advance(-6, null) !== 0) break;
    }
    if (clear) return tp;
  }
  return null;
};
/* the driving room for a shared build: the same for everyone driving the same version of the layout */
function driveCode(buildCode, m) {
  let h = mpHash(buildCode + ':' + layoutHash(m)), c = '';
  for (let i = 0; i < 6; i++) { c += MP_CODE[h % MP_CODE.length]; h = Math.floor(h / MP_CODE.length) ^ (i * 2654435761 >>> 0); h >>>= 0; }
  return c;
}
