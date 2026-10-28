/* ============================================================================
   Building together. Players in a build room edit one layout over the same
   public MQTT relays the driving rooms use (topic bdiv/v1/b/<code>).

   Every edit goes out as the change it made (pieces added, removed, altered),
   which is applied by piece id, so edits made at the same moment by different
   people both land. A newcomer asks for the whole layout and the member with
   the lowest id answers. Each member also reports a fingerprint of the layout
   every few seconds; anyone who has drifted from that member asks again, so the
   room always settles on one layout.
   ========================================================================== */
const BT = { on: false, code: '', topic: '', links: [], peers: new Map(), seen: new Set(), seq: 0, synced: false, cursor: null, sentP: 0, drift: 0 };

BT.send = function (ch) { if (BT.on) BT.pub({ t: 'ch', ch }); };
BT.pub = function (o) {
  o.id = MP.id; o.n = ++BT.seq;
  const txt = JSON.stringify(o);
  for (const l of BT.links) l.publish(BT.topic, txt);
};
BT.hash = function () { return layoutHash(ED.map); };
BT.connect = function (code, creator, keep) {
  if (BT.on) BT.leave(true);
  BT.on = true; BT.code = code; BT.topic = 'bdiv/v1/b/' + code; BT.synced = creator; BT.peers.clear(); BT.seen.clear(); BT.drift = 0;
  const will = { topic: BT.topic, payload: JSON.stringify({ id: MP.id, n: 0, t: 'bye' }) };
  BT.links = MP.brokers.map((url, i) => { const l = new MiniMQTT(url, 'bb-' + MP.id + '-' + i, will, (t, txt) => BT.onText(txt), () => BT.ui()); l.subscribe(BT.topic); return l; });
  if (!creator) {
    // our screen becomes the shared layout, kept as its own saved copy; if the room is empty we carry on with that copy
    if (!keep) { const m = edBlank('Shared layout ' + code); m.id = 'B' + code; m.shared = code; const old = LAYOUTS.get(m.id); edLoad(old ? Object.assign(old, { shared: code }) : m); }
    let asks = 0;
    BT.askT = setInterval(() => {
      if (BT.synced || !BT.links.some(l => l.ok)) return;
      if (++asks > 3 && !BT.peers.size) { BT.synced = true; clearInterval(BT.askT); BT.ui(); return; }
      BT.pub({ t: 'req' });
    }, 1500);
  } else { ED.map.shared = code; edSave(); }
  try { history.replaceState(null, '', location.pathname + '?build=' + code); } catch (e) {}
  BT.ui(); edPanels();
};
BT.leave = function (quiet) {
  if (!BT.on) return;
  BT.pub({ t: 'bye' });
  for (const l of BT.links) l.close();
  clearInterval(BT.askT);
  BT.on = false; BT.links = []; BT.peers.clear(); BT.code = '';
  try { history.replaceState(null, '', location.pathname + location.search.replace(/[?&]build=[A-Z0-9]+/, '').replace(/^&/, '?')); } catch (e) {}
  if (!quiet) edMsg('Left the build. The layout stays saved on this device.');
  BT.ui(); ED.dirty = true;
};
BT.onText = function (txt) {
  if (!BT.on || txt.length > 2e6) return;
  let r; try { r = JSON.parse(txt); } catch (e) { return; }
  if (!r || typeof r.id !== 'string' || !/^[a-z0-9]{6,16}$/.test(r.id) || r.id === MP.id) return;
  const key = r.id + ':' + r.n; if (BT.seen.has(key)) return;   // both relays deliver everything
  BT.seen.add(key); if (BT.seen.size > 4000) BT.seen = new Set([...BT.seen].slice(-2000));
  let p = BT.peers.get(r.id);
  if (r.t === 'bye') { if (p) { BT.peers.delete(r.id); edMsg(`${p.nm} left the build.`); BT.ui(); ED.dirty = true; } return; }
  if (!p) {
    if (BT.peers.size >= 12) return;
    p = { id: r.id, nm: 'Builder', color: MP_COLORS[mpHash(r.id) % MP_COLORS.length], at: 0, x: null, a: null, h: '' };
    BT.peers.set(r.id, p);
  }
  p.at = performance.now();
  if (r.t === 'p') {
    const nm = mpText(r.nm, 16) || 'Builder'; if (p.nm !== nm) { const first = p.nm === 'Builder' && !p.named; p.nm = nm; p.named = true; if (first) edMsg(`${nm} is building with you.`, 'good'); BT.ui(); }
    p.x = Array.isArray(r.x) && r.x.length === 2 && r.x.every(v => typeof v === 'number' && isFinite(v)) ? r.x : null;
    p.a = r.a && typeof r.a.pid === 'number' && typeof r.a.j === 'number' ? { pid: r.a.pid, j: r.a.j } : null;
    p.h = typeof r.h === 'string' ? r.h.slice(0, 16) : '';
    p.synced = !!r.s;
    ED.dirty = true;
    return;
  }
  if (r.t === 'req') { if (BT.synced && BT.leader() === MP.id) BT.pub({ t: 'snap', to: r.id, map: { name: ED.map.name, pieces: ED.map.pieces, start: ED.map.start || null } }); return; }
  if (r.t === 'snap') {
    if (r.to !== MP.id) return;
    const m = edValidImport(r.map); if (!m) return;
    ED.map.name = m.name; ED.map.pieces = m.pieces; ED.map.start = m.start;
    ED.undo = []; ED.redo = []; ED.active = null; ED.sel = null;
    const first = !BT.synced; BT.synced = true; BT.drift = 0; clearInterval(BT.askT);
    edRebuild(); edSave(); if (first) { edFit(); edMsg(`Building ${m.name} together.`, 'good'); }
    return;
  }
  if (r.t === 'ch' && BT.synced) {
    const ch = BT.clean(r.ch); if (!ch) return;
    edApply(ch); edRebuild(); edSave();
  }
};
/* a change from someone else, checked piece by piece like an imported file */
BT.clean = function (ch) {
  if (!ch || typeof ch !== 'object') return null;
  const list = a => { if (!Array.isArray(a)) return []; const m = edValidImport({ pieces: a }); return m ? m.pieces : null; };
  const add = list(ch.add), del = list(ch.del);
  const setN = list((ch.set || []).map(x => Array.isArray(x) ? x[1] : null)), setO = list((ch.set || []).map(x => Array.isArray(x) ? x[0] : null));
  if (!add || !del || !setN || !setO) return null;
  const out = { add, del, set: setN.map((n, i) => [setO[i], n]) };
  if (Array.isArray(ch.name)) out.name = [String(ch.name[0]).slice(0, 32), mpText(String(ch.name[1]), 32) || 'Shared layout'];
  if (Array.isArray(ch.start)) { const s = ch.start[1]; out.start = [null, s && typeof s.id === 'number' ? { id: s.id | 0, dir: s.dir < 0 ? -1 : 1 } : null]; }
  return out;
};
BT.leader = function () { let id = BT.synced ? MP.id : ''; for (const p of BT.peers.values()) if (p.synced && (!id || p.id < id)) id = p.id; return id; };
BT.tick = function () {
  if (!BT.on) return;
  const now = performance.now();
  for (const p of [...BT.peers.values()]) if (now - p.at > 15000) { BT.peers.delete(p.id); BT.ui(); ED.dirty = true; }
  const moved = BT.cursorDirty && now - BT.sentP > 150;
  if (moved || now - BT.sentP > 2500) {
    BT.sentP = now; BT.cursorDirty = false;
    BT.pub({ t: 'p', nm: MP.name, x: BT.cursor, a: ED.active, h: BT.synced ? BT.hash() : '', s: BT.synced ? 1 : 0 });
    // drifted from the leader's layout for two reports running: fetch it again
    const L = BT.peers.get(BT.leader());
    if (BT.synced && L && L.h && L.h !== BT.hash()) { if (++BT.drift >= 3) { BT.synced = false; BT.pub({ t: 'req' }); BT.askT = setInterval(() => { if (!BT.synced) BT.pub({ t: 'req' }); }, 2500); } }
    else BT.drift = 0;
  }
};
setInterval(BT.tick, 100);
BT.pointer = function (x, y) { if (!BT.on) return; BT.cursor = [Math.round(edWX(x) * 10) / 10, Math.round(edWN(y) * 10) / 10]; BT.cursorDirty = true; };
BT.drawPeers = function (g) {
  if (!BT.on) return;
  g.font = '600 12px "IBM Plex Sans Condensed", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
  for (const p of BT.peers.values()) {
    if (p.a) { const q = edPort(p.a); if (q) { g.strokeStyle = p.color; g.lineWidth = 3; g.beginPath(); g.arc(edTX(q.X), edTY(q.N), 11, 0, TAU); g.stroke(); } }
    if (!p.x) continue;
    const x = edTX(p.x[0]), y = edTY(p.x[1]);
    g.fillStyle = p.color; g.strokeStyle = '#000'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 11, y + 4); g.lineTo(x + 4, y + 11); g.closePath(); g.fill(); g.stroke();
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(p.nm, x + 12, y + 14); g.fillText(p.nm, x + 12, y + 14);
  }
};
BT.ui = function () {
  const b = $('edTogBtn'); if (!b) return;
  const n = BT.peers.size;
  b.classList.toggle('on', BT.on); b.textContent = BT.on ? (n ? `Building with ${n}` : `Room ${BT.code}`) : 'Build together';
  $('btSolo').hidden = BT.on; $('btIn').hidden = !BT.on; $('btCodeBig').textContent = BT.code;
  const ok = BT.links.some(l => l.ok), dead = BT.links.length && BT.links.every(l => l.dead);
  $('btStatus').textContent = !BT.on ? 'Start a build and send your friends the code, or type theirs.'
    : dead ? "Couldn't reach the room server. Check your connection, then try again."
    : !ok ? `Connecting to ${BT.code}…` : !BT.synced ? 'Fetching the shared layout…'
    : n ? `Building with ${n} other${n > 1 ? 's' : ''}. Tap Drive it and you all meet in the same room.` : 'Nobody else yet: send your friends the link or the code.';
  const list = $('btList'); list.textContent = '';
  const chip = (c, t) => { const s = document.createElement('span'); const i = document.createElement('i'); i.style.background = c; s.appendChild(i); s.appendChild(document.createTextNode(t)); list.appendChild(s); };
  if (BT.on) { chip(MP_ME, MP.name + ' (you)'); for (const p of BT.peers.values()) chip(p.color, p.nm); }
};
BT.share = function () {
  const url = location.origin + location.pathname + '?build=' + BT.code;
  if (navigator.share) { navigator.share({ title: 'Berkshire Division', text: `Build a railroad with me. Code ${BT.code}`, url }).catch(() => {}); return; }
  try { navigator.clipboard.writeText(url).then(() => edMsg('Link copied. Send it to your friends.', 'good'), () => edMsg('Build code: ' + BT.code)); } catch (e) { edMsg('Build code: ' + BT.code); }
};
function btInit() {
  const nm = $('btName'), code = $('btCode');
  $('edTogBtn').addEventListener('click', () => { nm.value = MP.name; $('edTog').hidden = false; BT.ui(); });
  $('btClose').addEventListener('click', () => { $('edTog').hidden = true; });
  nm.addEventListener('input', () => { MP.name = mpText(nm.value, 16) || 'Engineer'; try { localStorage.setItem('bd_name', MP.name); } catch (e) {} $('mpName').value = MP.name; BT.cursorDirty = true; });
  code.addEventListener('input', () => { const v = code.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); if (v !== code.value) code.value = v; });
  $('btCreate').addEventListener('click', () => { let c = ''; for (let i = 0; i < 5; i++) c += MP_CODE[(Math.random() * MP_CODE.length) | 0]; BT.connect(c, true); });
  $('btJoin').addEventListener('click', () => { const c = code.value; if (c.length < 4) { $('btStatus').textContent = 'Type the code your friend sent you.'; code.focus(); return; } BT.connect(c, false); });
  $('btLeave').addEventListener('click', () => BT.leave());
  $('btShare').addEventListener('click', BT.share);
  addEventListener('pagehide', () => { if (BT.on) BT.pub({ t: 'bye' }); });
  $('edCanvas').addEventListener('pointermove', e => BT.pointer(e.clientX, e.clientY));
  $('edCanvas').addEventListener('pointerdown', e => BT.pointer(e.clientX, e.clientY));
  // ?build=CODE opens the editor straight into that build
  let c = ''; try { c = (new URLSearchParams(location.search).get('build') || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); } catch (e) {}
  if (c.length >= 4 && c.length <= 6) { edOpen(); const own = Object.values(LAYOUTS.all()).find(m => m.shared === c); if (own) edLoad(own); BT.connect(c, false, !!own); }
}
btInit();
