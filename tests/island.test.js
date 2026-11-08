// Tests für die Inseln (Jump'n'Run mit Enterhaken): Seil und Pendel, Haken nur an Ringen in Reichweite, Gefahren,
// Krabben, Bernstein, Truhe, Zeit – und ein Bot schafft beide Inseln (die Levels sind lösbar).
const { assert, load } = require('./setup');
load('format', 'state', 'island');
const I = SF.island;
const run = (L, secs, input) => { const ev = []; for (let t = 0; t < secs && !L.over; t += 1 / 60) ev.push(...I.step(L, 1 / 60, typeof input === 'function' ? input(L) : input)); return ev; };

// ---------- Haken und Seil ----------
{
  const L = I.create('bay');
  run(L, 1, {});
  assert(L.p.ground, 'Landet am Start');
  assert(I.tap(L, 2000, 100) === 'miss' && !L.hook, 'Ins Leere: kein Haken');
  L.p.x = 580;
  assert(I.tap(L, 795, 185) === 'hook' && L.hook && L.hook.x === 790, 'Ring in Reichweite: Haken hängt');
  assert(L.hook.len <= I.ROPE_MAX, 'Seil nicht länger als erlaubt');
  // Pendel: Abstand zum Ring bleibt höchstens die Seillänge
  let maxD = 0;
  for (let i = 0; i < 120; i++) {
    I.step(L, 1 / 60, {});
    if (!L.hook) break;
    const d = Math.hypot(L.p.x + I.PW / 2 - L.hook.x, L.p.y + 10 - L.hook.y);
    maxD = Math.max(maxD, d - L.hook.len);
  }
  assert(maxD < 1, `Seil hält die Länge (${maxD.toFixed(2)})`);
  assert(L.p.x > 620, 'Am Seil über das Wasser geschwungen');
  const M = I.create('bay');
  M.p.x = 80; M.p.y = 434;
  assert(I.tap(M, 790, 190) === 'miss', 'Ring zu weit weg: kein Haken');
  M.p.x = 580; M.p.y = 434;
  I.tap(M, 790, 190);
  assert(I.tap(M, 0, 0) === 'release' && !M.hook, 'Zweiter Tipp: loslassen');
}

// ---------- Gefahren, Krabben, Bernstein, Ende ----------
{
  const L = I.create('volcano');
  run(L, 1, {});
  const t0 = L.time;
  L.p.x = 600; L.p.y = 470;
  const ev = run(L, 0.2, {});
  assert(ev.some(e => e.type === 'penalty' && e.kind === 'lava') && L.time < t0 - I.PENALTY + 0.3, 'Lava kostet Zeit');
  assert(L.p.x < 480, 'Zurück an den sicheren Rand');
  const c = L.crabs[0];
  L.p.x = c.x; L.p.y = c.y - I.PH - 20; L.p.vy = 300;
  c.vx = 0;
  assert(run(L, 0.3, {}).some(e => e.type === 'stomp') && !c.alive, 'Krabbe von oben besiegt');
  const a = L.amber[0];
  L.p.x = a.x - 15; L.p.y = a.y - 20; L.p.vy = 0; L.hook = null;
  run(L, 0.05, {});
  assert(a.taken && L.got === 1, 'Bernstein eingesammelt');
  L.p.x = L.chest.x; L.p.y = L.chest.y;
  run(L, 0.05, {});
  assert(L.over === 'won', 'Schatzkiste erreicht');
  SF.state = SF.createDefaultState();
  const r1 = I.reward(L);
  assert(r1.first && r1.amber === L.d.reward + 3 && r1.best, 'Erste Truhe: volle Belohnung und Bestzeit');
  const r2 = I.reward(L);
  assert(!r2.first && r2.amber === Math.round(L.d.reward / 4) + 3, 'Danach weniger in der Truhe (kein Endlos-Bernstein)');
  const T = I.create('bay');
  run(T, T.d.time + 1, {});
  assert(T.over === 'lost', 'Zeit um');
}

// ---------- Ein Bot schafft beide Inseln ----------
function bot(L) {
  const p = L.p;
  const cx = p.x + I.PW / 2;
  if (L.hook) {
    // loslassen, wenn man am Ring vorbei ist und nach vorn schwingt
    if (cx > L.hook.x + 140 && p.vx > 0) return { right: true, jump: true };
    return { right: true };
  }
  const ahead = x => x > p.x + I.PW - 4 && x < p.x + I.PW + 60;
  const gap = L.hazards.some(h => ahead(h.x)) && p.ground;
  if (gap) {
    const a = L.d.anchors.find(([ax, ay]) => ax > cx && Math.hypot(ax - cx, ay - (p.y + 10)) <= I.ROPE_MAX);
    if (a) { I.tap(L, a[0], a[1]); return { right: true }; }
    return { right: true, jump: true };
  }
  const wall = L.solids.some(s => ahead(s.x) && s.y < p.y + I.PH - 2 && s.y > p.y - 100);
  const crab = L.crabs.some(c => c.alive && c.x > p.x && c.x < p.x + 90);
  return { right: true, jump: p.ground && (wall || crab) };
}
['bay', 'volcano', 'ice'].forEach(id => {
  const L = I.create(id);
  const ev = run(L, L.d.time, bot);
  const pen = ev.filter(e => e.type === 'penalty' || e.type === 'pinch').length;
  assert(L.over === 'won', `${L.d.name}: vom Bot geschafft (${L.over || 'läuft noch'}, x=${Math.round(L.p.x)}, Zeit übrig ${Math.round(L.time)} s, Strafen ${pen})`);
});

// ---------- Eis ist rutschig ----------
{
  const L = I.create('ice');
  run(L, 1, {});
  run(L, 0.15, { right: true });
  const iceSpeed = L.p.vx;
  const M = I.create('bay');
  run(M, 1, {});
  run(M, 0.15, { right: true });
  assert(iceSpeed < M.p.vx * 0.7, `Auf Eis läuft man langsamer an (${Math.round(iceSpeed)} < ${Math.round(M.p.vx)})`);
  run(L, 0.5, {});
  assert(Math.abs(L.p.vx) > 5, 'Auf Eis rutscht man nach');
}
