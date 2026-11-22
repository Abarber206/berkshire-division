/* ============================================================================
   Career: what the jobs pay, and the engines and routes the money opens up.
   Free play, the default, has every engine and route open and the jobs still
   pay, so the money keeps adding up. Switch to Career and only the two
   Berkshires, the diesel and the Berkshire Division are open at first; the
   rest open as your earnings (all time, never spent) pass their price.
   Earnings live with the switching money in localStorage bd_ind (11k_industry.js).
   ========================================================================== */
const CAREER_PRICE = {
  loco: { '765': [0, 'NKP 765'], '1225': [0, 'PM 1225'], diesel: [0, 'the wide-cab diesel'], '1308': [5000, 'C&O 1308'], '18': [10000, 'UP 18 gas turbine'],
    '4014': [20000, 'UP 4014 Big Boy'], acela: [25000, 'the Acela Express'], e5: [35000, 'the E5 Shinkansen'] },
  route: { ohio: [0, 'the Berkshire Division'], laurel: [4000, 'Laurel Mountain'], frost: [12000, 'Raven Lake'] },
};
const CAREER = {};
CAREER.on = () => GAME.settings.career === 'career';
CAREER.earned = () => (IND.career && IND.career.cash) || 0;
CAREER.price = (kind, k) => ((CAREER_PRICE[kind] || {})[k] || [0])[0];
CAREER.open = (kind, k) => !CAREER.on() || CAREER.earned() >= CAREER.price(kind, k);
/* a job pays its rate in full at 100 points, less for a lower score, nothing for a failed run */
CAREER.jobPay = (def, score) => def && def.pay ? Math.round(def.pay * clamp(score, 0, 100) / 100 / 10) * 10 : 0;
/* everything priced above a and up to b: what earning from a to b opened */
CAREER.between = function (a, b) {
  const out = [];
  for (const kind in CAREER_PRICE) for (const k in CAREER_PRICE[kind]) { const [p, name] = CAREER_PRICE[kind][k]; if (p > a && p <= b) out.push({ kind, k, p, name }); }
  return out.sort((x, y) => x.p - y.p);
};
/* the next thing still to earn */
CAREER.next = function () {
  const e = CAREER.earned(); let best = null;
  for (const kind in CAREER_PRICE) for (const k in CAREER_PRICE[kind]) { const [p, name] = CAREER_PRICE[kind][k]; if (p > e && (!best || p < best.p)) best = { kind, k, p, name }; }
  return best;
};
CAREER.payJob = function (def, score) {
  const amt = CAREER.jobPay(def, score); if (!amt) return 0;
  const before = CAREER.earned();
  IND.cash += amt; IND.career.cash += amt; IND.save();
  if (CAREER.on()) CAREER.between(before, CAREER.earned()).forEach((u, i) =>
    setTimeout(() => toast(`Unlocked ${u.name}! Pick ${u.kind === 'route' ? 'it under Railroad' : 'it on the Train tab'}.`, 'good', 6000, 'unlock' + u.k), 5000 + i * 2500));
  CAREER.paint();
  return amt;
};

/* ---------------- the menu ---------------- */
CAREER.note = function () {
  const el = $('careerNote'); if (!el) return;
  const e = CAREER.earned(), nx = CAREER.next(), money = `$${e.toLocaleString()}`;
  el.textContent = CAREER.on()
    ? `Earned ${money} so far.${nx ? ` Next: ${nx.name} at $${nx.p.toLocaleString()}.` : ' Everything is open.'}${CAREER.open('route', ROUTE_KEY) ? '' : ' This route is not earned yet, but its jobs still pay.'}`
    : `Every engine and route is open. Jobs still pay (${money} so far): pick Career to earn the engines and routes one at a time.`;
};
/* lock badges on the engine cards and the routes */
CAREER.paint = function () {
  if (typeof document === 'undefined' || !document.querySelector) return;
  const mark = (b, kind, k) => {
    if (!b) return;
    const locked = !CAREER.open(kind, k);
    b.classList.toggle('locked', locked);
    let em = b.querySelector('em.lock');
    if (locked && !em) { em = document.createElement('em'); em.className = 'lock'; b.appendChild(em); }
    if (em) { if (locked) em.textContent = `🔒 $${CAREER.price(kind, k).toLocaleString()}`; else em.remove(); }
  };
  const L = $('optLoco'); if (L) for (const b of L.children) mark(b, 'loco', b.id.slice('optLoco_'.length));
  const R = $('optRail'); if (R) for (const b of R.children) if (b.dataset.route) mark(b, 'route', b.dataset.route);
  CAREER.note();
};
/* a tap on a locked card says what it costs instead of picking it (capture phase: before the card's own handler) */
function careerGuard(e) {
  const b = e.target.closest && e.target.closest('button'); if (!b || !b.classList.contains('locked')) return;
  e.stopPropagation(); e.preventDefault();
  const host = e.currentTarget.id, kind = host === 'optRail' ? 'route' : 'loco', k = kind === 'route' ? b.dataset.route : b.id.slice('optLoco_'.length);
  const need = CAREER.price(kind, k) - CAREER.earned();
  toast(`${CAREER_PRICE[kind][k][1]} opens at $${CAREER.price(kind, k).toLocaleString()} earned: $${need.toLocaleString()} to go. Jobs pay; so does spotting cars for customers.`, 'warn', 5200, 'locked');
}
/* starting a career on an engine it has not earned: back to the Berkshire */
CAREER.check = function (quiet) {
  if (!CAREER.on() || CAREER.open('loco', GAME.settings.loco)) return;
  const b = $('optLoco_765');
  if (b && !quiet) b.click();
  else { GAME.settings.loco = '765'; if (b) [...b.parentElement.children].forEach(c => c.setAttribute('aria-pressed', String(c === b))); }
  if (quiet) return;
  toast('Career mode: back to NKP 765. Earn the other engines with jobs.', '', 4200, 'career');
};
CAREER.setup = function () {
  if (GAME.settings.career !== 'career') GAME.settings.career = 'free';
  segButtons('optCareer', { free: { name: 'Free play', sub: 'Every engine and route open' }, career: { name: 'Career', sub: 'Earn them with jobs' } }, 'career', () => { CAREER.check(); CAREER.paint(); saveSettings(); });
  for (const id of ['optLoco', 'optRail']) { const h = $(id); if (h) h.addEventListener('click', careerGuard, true); }
  CAREER.check(true);
  CAREER.paint();
};
