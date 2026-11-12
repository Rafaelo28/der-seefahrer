// Tests für das Entern (Jump'n'Run): Deck aus Abschnitten, Herzen, Beute plündern, Säbel-Piraten, Flaschenwerfer,
// Kanonen, rollende Fässer, hängende Planken, Luken, Tür, Zeit. Ein Planer-Bot prüft, dass jedes Deck schaffbar ist.
const { assert, load } = require('./setup');
const fs = require('fs');
const path = require('path');
load('format', 'state', 'boarding');
const Bo = SF.boarding;
const KINDS = ['raider', 'shark', 'bluebeard', 'dutchman', 'courier', 'baron'];
const run = (L, secs, input) => { const ev = []; for (let t = 0; t < secs && !L.over; t += 1 / 60) ev.push(...Bo.step(L, 1 / 60, typeof input === 'function' ? input(L) : input)); return ev; };
// leeres Deck zum Ausprobieren einzelner Dinge
const empty = (kind = 'raider') => {
  const L = Bo.create(kind, 3);
  L.enemies = []; L.cannons = []; L.shots = []; L.loot = []; L.plats = []; L.hatches = []; L.roller = null; L.locked = false;
  L.solids = [{ x: 0, y: Bo.DECK, w: L.qx, h: 140, k: 'deck' }, { x: L.qx, y: Bo.QUARTER, w: L.w - L.qx, h: 230, k: 'deck' }];
  run(L, 1, {});
  return L;
};

// ---------- Aufbau ----------
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'boarding.js'), 'utf8');
  const rules = src.slice(0, src.indexOf('// ---------- Bildschirm ----------')).replace(/\/\/.*$/gm, '');
  assert(!/Math\.(sin|cos|tan|atan2?|random)\b/.test(rules), 'Regeln rechnen ohne Winkelfunktionen und ohne Zufall von außen');
  const L = Bo.create('raider', 3);
  run(L, 1.5, {});
  assert(L.p.ground && Math.abs(L.p.y + Bo.PH - Bo.DECK) < 1, 'Landet auf dem Deck');
  assert(JSON.stringify(Bo.create('shark', 5)) === JSON.stringify(Bo.create('shark', 5)), 'Gleicher Startwert = gleiches Deck');
  assert(JSON.stringify(Bo.create('shark', 5).sections) !== JSON.stringify(Bo.create('shark', 6).sections) || JSON.stringify(Bo.create('shark', 5).sections) !== JSON.stringify(Bo.create('shark', 8).sections), 'Anderer Startwert = anderes Deck');
  KINDS.forEach(k => {
    for (let seed = 1; seed <= 12; seed++) {
      const M = Bo.create(k, seed);
      const bad = M.enemies.filter(e => e.y + e.h === Bo.DECK && M.hatches.some(h => e.x0 < h.x + h.w && e.x1 + e.w > h.x));
      assert(bad.length === 0, `${k} ${seed}: Piraten laufen nicht über Luken`);
      assert(M.sections.length === Bo.SHIPS[k].n && M.sections.every((s, i) => i === 0 || s !== M.sections[i - 1]), `${k} ${seed}: Abschnitte ohne Wiederholung direkt hintereinander`);
      const max = Bo.lootMax(M);
      assert(max.amber >= 10 && max.chests >= 1 && max.amber <= 120, `${k} ${seed}: Beute liegt bereit (${max.amber} Bernstein, ${max.chests} Kisten)`);
    }
  });
  const lens = KINDS.map(k => Bo.create(k, 1).w);
  assert(lens[0] < lens[1] && lens[1] < lens[2] && lens[4] === lens[1] && lens[5] === lens[2], 'Größere Schiffe haben längere Decks');
  assert(Bo.create('bluebeard', 1).locked && Bo.create('dutchman', 1).locked && !Bo.create('shark', 1).locked, 'Tür zu, solange ein Kapitän an Bord ist');
  SF.state.hard = true;
  const H = Bo.create('raider', 1);
  SF.state.hard = false;
  assert(H.hearts === Bo.HEARTS - 1 && H.time < Bo.SHIPS.raider.time, 'Schwer-Modus: ein Herz und Zeit weniger');
}

// ---------- Laufen, Springen, Planken ----------
{
  const L = empty();
  L.solids.push({ x: 300, y: Bo.DECK - 60, w: 60, h: 60, k: 'crate' });
  run(L, 2, { right: true });
  assert(Math.abs(L.p.x - (300 - Bo.PW)) < 1, 'Kiste hält auf');
  run(L, 1, { right: true, jump: true });
  assert(L.p.x > 360, 'Mit Sprung über die Kiste');
  // hängende Planke: von unten hindurch, von oben fest
  const M = empty();
  M.plats.push({ x: 150, y: Bo.DECK - 120, w: 200, k: 'plank' });
  M.p.x = 240;
  run(M, 0.05, { jump: true });
  run(M, 1.2, {});
  assert(M.p.ground && Math.abs(M.p.y + Bo.PH - (Bo.DECK - 120)) < 1, 'Von unten durch die Planke gesprungen und oben gelandet');
  run(M, 1.5, { right: true });
  assert(Math.abs(M.p.y + Bo.PH - Bo.DECK) < 1, 'Von der Planke wieder aufs Deck');
  // Sprung kurz vor dem Landen zählt (Puffer)
  const N = empty();
  N.p.y -= 6; N.p.ground = false; N.p.vy = 100; N.p.coyote = 0;
  Bo.step(N, 1 / 60, { jump: true });
  const ev = run(N, 0.2, {});
  assert(ev.some(e => e.type === 'jump'), 'Sprung-Tipp kurz vor dem Landen wird gemerkt');
}

// ---------- Piraten ----------
{
  const L = empty();
  const e = { type: 'walker', x: L.p.x, y: Bo.DECK - 44, w: 30, h: 44, vx: 0, x0: L.p.x, x1: L.p.x, alive: true, lives: 1 };
  L.enemies.push(e);
  L.p.y = e.y - Bo.PH - 30; L.p.vy = 300; L.p.ground = false;
  const ev = run(L, 0.3, {});
  assert(ev.some(x => x.type === 'stomp') && !e.alive && L.stomps === 1 && L.hearts === Bo.HEARTS, 'Von oben: Pirat besiegt');
  const f = { type: 'walker', x: L.p.x + 40, y: Bo.DECK - 44, w: 30, h: 44, vx: 0, x0: L.p.x + 40, x1: L.p.x + 40, alive: true, lives: 1 };
  L.enemies.push(f);
  run(L, 1, {});
  const ev2 = run(L, 0.5, { right: true });
  assert(ev2.some(x => x.type === 'hurt') && L.hearts === Bo.HEARTS - 1, 'Von der Seite: ein Herz weg');
  run(L, 0.3, { right: true });
  assert(L.hearts === Bo.HEARTS - 1, 'Kurz danach unverwundbar');
  // drei Treffer: zurückgeschlagen
  const M = empty();
  M.p.x = 300;
  [500, 1100, 1700].forEach(x => M.shots.push({ k: 'ball', x, y: Bo.DECK - 24, vx: -340, vy: 0, r: 11, life: 9 }));
  run(M, 8, {});
  assert(M.over === 'lost' && M.why === 'hearts' && M.hearts === 0, 'Alle Herzen weg: zurückgeschlagen');
  // Säbel-Pirat: warnt und stürmt los
  const S = empty();
  S.p.x = 300;
  const sab = { type: 'saber', x: 480, y: Bo.DECK - 46, w: 32, h: 46, vx: -55, x0: 100, x1: 600, alive: true, lives: 1, mode: 'walk', clock: 0 };
  S.enemies.push(sab);
  const evs = run(S, 0.3, {});
  assert(evs.some(x => x.type === 'warn') && sab.mode === 'warn' && sab.vx === 0, 'Säbel-Pirat sieht den Spieler und warnt');
  run(S, 0.25, {});
  assert(sab.mode === 'charge' && sab.vx < -200, 'Dann stürmt er los');
  S.p.y -= 200; S.p.ground = false; // Spieler springt hoch: der Pirat rennt darunter durch
  run(S, 0.4, {});
  assert(S.hearts === Bo.HEARTS, 'Drüberspringen: kein Treffer');
  // Flaschenwerfer trifft, wenn man stehen bleibt
  const T = empty();
  T.p.x = 300;
  T.enemies.push({ type: 'thrower', x: 600, y: Bo.DECK - 164, w: 30, h: 44, vx: 0, x0: 600, x1: 600, alive: true, lives: 1, clock: 0.1, period: 2.4 });
  const evt = run(T, 1.4, {});
  assert(evt.some(x => x.type === 'throw') && evt.some(x => x.type === 'hurt' && x.by === 'bottle'), 'Flasche trifft, wenn man stehen bleibt');
  const U = empty();
  U.p.x = 300;
  U.enemies.push({ type: 'thrower', x: 600, y: Bo.DECK - 164, w: 30, h: 44, vx: 0, x0: 600, x1: 600, alive: true, lives: 1, clock: 0.1, period: 9 });
  run(U, 1.4, { left: true });
  assert(U.hearts === Bo.HEARTS, 'Weglaufen: die Flasche zerschellt auf dem Deck');
}

// ---------- Kanone, Fässer, Luke ----------
{
  const L = empty();
  L.p.x = 300;
  L.solids.push({ x: 700, y: Bo.DECK - 38, w: 58, h: 38, k: 'cannon' });
  L.cannons.push({ x: 700, y: Bo.DECK - 24, period: 9, clock: 0.6, warn: 0 });
  run(L, 0.3, {});
  assert(L.cannons[0].warn === 1 && L.shots.length === 0, 'Die Lunte glimmt, bevor es knallt');
  const ev = run(L, 2, {});
  assert(ev.some(x => x.type === 'shot') && ev.some(x => x.type === 'hurt' && x.by === 'ball'), 'Kanonenkugel trifft, wenn man stehen bleibt');
  const M = empty();
  M.p.x = 300;
  M.solids.push({ x: 420, y: Bo.DECK - 60, w: 60, h: 60, k: 'crate' });
  M.shots.push({ k: 'ball', x: 700, y: Bo.DECK - 24, vx: -340, vy: 0, r: 11, life: 2.4 });
  run(M, 2, {});
  assert(M.hearts === Bo.HEARTS && M.shots.length === 0, 'Hinter einer Kiste ist man sicher');
  // rollendes Fass: fällt in die Luke, zerbricht beim Draufspringen
  const R = empty();
  R.hatches.push({ x: 500, w: 90 });
  R.solids = [{ x: 0, y: Bo.DECK, w: 500, h: 140, k: 'deck' }, { x: 590, y: Bo.DECK, w: 2000, h: 140, k: 'deck' }];
  R.p.x = 200;
  R.shots.push({ k: 'barrel', x: 800, y: Bo.DECK - 20, vx: -200, vy: 0, r: 20, life: 9 });
  run(R, 4, {});
  assert(R.hearts === Bo.HEARTS && R.shots.length === 0, 'Rollendes Fass fällt in die Luke');
  const Q = empty();
  Q.p.x = 300;
  Q.shots.push({ k: 'barrel', x: 310, y: Bo.DECK - 20, vx: 0, vy: 0, r: 20, life: 9 });
  Q.p.y -= 80; Q.p.ground = false; Q.p.vy = 200;
  const evq = run(Q, 0.2, {});
  assert(evq.some(x => x.type === 'break') && Q.hearts === Bo.HEARTS && Q.p.vy < 0, 'Auf das Fass gesprungen: es zerbricht');
  // Luke: ein Herz weg, zurück an den Rand
  const H = empty();
  H.hatches.push({ x: 500, w: 90 });
  H.solids = [{ x: 0, y: Bo.DECK, w: 500, h: 140, k: 'deck' }, { x: 590, y: Bo.DECK, w: 2000, h: 140, k: 'deck' }];
  H.p.x = 530;
  const evh = run(H, 2, {});
  assert(evh.some(x => x.type === 'fall') && H.hearts === Bo.HEARTS - 1 && H.p.x < 500 && H.p.ground, 'In die Luke: ein Herz weg, zurück an den Rand');
}

// ---------- Beute, Tür, Zeit ----------
{
  const L = empty();
  L.p.x = 300;
  L.loot.push({ k: 'amber', x: 380, y: Bo.DECK - 40, w: 26, h: 26, v: 3, taken: false });
  L.loot.push({ k: 'chest', x: 460, y: Bo.DECK - 34, w: 44, h: 34, v: 1, taken: false });
  L.loot.push({ k: 'amber', x: 380, y: Bo.DECK - 400, w: 26, h: 26, v: 3, taken: false });
  const ev = run(L, 1, { right: true });
  assert(ev.filter(x => x.type === 'loot').length === 2 && L.got.amber === 3 && L.got.chests === 1, 'Beute eingesammelt (was zu hoch hängt, bleibt)');
  L.p.x = L.door.x - 5; L.p.y = L.door.y + 20;
  run(L, 0.2, { right: true });
  assert(L.over === 'won', 'Tür der Kapitänskajüte erreicht');
  const M = Bo.create('raider', 3);
  run(M, Bo.SHIPS.raider.time + 1, {});
  assert(M.over === 'lost' && M.why === 'time' && M.time === 0, 'Zeit um: zurückgeschlagen');
  // Kapitän: Tür zu, mehrere Treffer, dazwischen kurz geschützt
  const B = Bo.create('bluebeard', 3);
  run(B, 1, {});
  const boss = B.enemies.find(e => e.boss);
  B.enemies = [boss]; B.roller = null; B.cannons = [];
  B.p.x = B.door.x - 5; B.p.y = B.door.y + 20; B.p.vy = 0;
  boss.x = boss.x0; boss.mode = 'rest'; boss.clock = 9; boss.vx = 0;
  run(B, 0.2, {});
  assert(!B.over && !Bo.doorOpen(B), 'Tür zu, solange der Kapitän steht');
  const stomp = () => { B.p.x = boss.x; B.p.y = boss.y - Bo.PH - 10; B.p.vy = 400; B.p.ground = false; run(B, 0.12, {}); };
  stomp();
  assert(boss.alive && boss.lives === 1 && boss.stun > 0, 'Erster Treffer: Kapitän taumelt');
  stomp();
  assert(boss.alive && boss.lives === 1, 'Solange er taumelt, zählt kein zweiter Treffer');
  boss.stun = 0;
  stomp();
  assert(!boss.alive && Bo.doorOpen(B), 'Zweiter Treffer: Kapitän besiegt, Tür offen');
}

// ---------- Schwieriger als früher: Wer nur rennt und hüpft, schafft die großen Schiffe nicht ----------
{
  let won = 0;
  ['shark', 'bluebeard', 'dutchman'].forEach(k => {
    for (let seed = 1; seed <= 4; seed++) {
      const L = Bo.create(k, seed);
      run(L, 200, M => ({ right: true, jump: Math.floor(M.t * 2) % 2 === 0 }));
      if (L.over === 'won') won++;
    }
  });
  assert(won <= 2, `Einfach nur rennen und hüpfen reicht nicht mehr (${won} von 12 geschafft)`);
}

// ---------- Jedes Deck ist schaffbar: Ein Planer-Bot probiert Eingaben an einer Kopie aus und nimmt die beste ----------
{
  const ACTS = [{ right: true }, { right: true, jump: true }, {}, { jump: true }, { left: true }, { left: true, jump: true }];
  const plan = L => {
    let best = null;
    let bs = -Infinity;
    for (const a of ACTS) {
      for (const b of ACTS) {
        const C = structuredClone(L);
        const h0 = C.hearts;
        const st0 = C.stomps;
        for (let i = 0; i < 66 && !C.over; i++) Bo.step(C, 1 / 60, i < 15 ? a : b);
        const boss = C.enemies.find(e => e.boss && e.alive);
        const tx = boss && C.locked ? boss.x : C.door.x;
        const sc = -Math.abs(C.p.x - tx) - 2000 * (h0 - C.hearts) + 400 * (C.stomps - st0) + (C.over === 'won' ? 5000 : 0) - (C.p.y + Bo.PH > Bo.DECK + 4 ? 1500 : 0);
        if (sc > bs) { bs = sc; best = a; }
      }
    }
    return best;
  };
  const seen = new Set();
  KINDS.forEach((k, i) => {
    [2, 5].forEach(seed => {
      const L = Bo.create(k, seed + i);
      L.sections.forEach(s => seen.add(s));
      let a = {};
      let n = 0;
      while (!L.over) {
        if (n++ % 6 === 0) a = plan(L);
        Bo.step(L, 1 / 60, a);
      }
      assert(L.over === 'won', `${k} ${seed + i}: Deck ist schaffbar (${L.sections.join(', ')}; ${L.over} ${L.why}, ${L.hearts} Herzen)`);
    });
  });
  const all = new Set(KINDS.flatMap(k => Bo.SHIPS[k].pool));
  assert([...all].every(s => seen.has(s)), `Jeder Abschnitt kam im Bot-Test vor (fehlt: ${[...all].filter(s => !seen.has(s)).join(', ') || '–'})`);
}
