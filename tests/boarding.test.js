// Tests für das Entern (Jump'n'Run): Landen, Hindernisse, Piraten von oben besiegen, Treffer, Luken, Tür, Zeit.
const { assert, load } = require('./setup');
load('format', 'state', 'boarding');
const Bo = SF.boarding;
const run = (L, secs, input) => { const ev = []; for (let t = 0; t < secs && !L.over; t += 1 / 60) ev.push(...Bo.step(L, 1 / 60, typeof input === 'function' ? input(L) : input)); return ev; };

{
  const L = Bo.create('raider', 3);
  run(L, 1.5, {});
  assert(L.p.ground && Math.abs(L.p.y + Bo.PH - Bo.DECK) < 1, 'Landet auf dem Deck');
  ['raider', 'shark', 'bluebeard'].forEach(k => {
    const M = Bo.create(k, 9);
    assert(M.enemies.length === { raider: 2, shark: 3, bluebeard: 5 }[k], `${k}: Anzahl Piraten`);
    assert(M.enemies.every(e => !M.hatches.some(h => e.x0 < h.x + h.w && e.x1 + e.w > h.x)), `${k}: Piraten laufen nicht über Luken`);
  });
}

// Hindernis stoppt, Springen geht darüber
{
  const L = Bo.create('raider', 3);
  L.enemies = [];
  L.hatches.length = 0;
  L.solids = L.solids.filter(s => s.k === 'deck');
  L.solids.push({ x: 300, y: Bo.DECK - 60, w: 60, h: 60, k: 'crate' });
  run(L, 1, {});
  run(L, 2, { right: true });
  assert(Math.abs(L.p.x - (300 - Bo.PW)) < 1, 'Kiste hält auf');
  run(L, 1, { right: true, jump: true });
  assert(L.p.x > 360, 'Mit Sprung über die Kiste');
}

// Pirat von oben besiegen, von der Seite: Treffer
{
  const L = Bo.create('raider', 3);
  run(L, 1, {});
  const e = L.enemies[0];
  e.x = L.p.x; e.x0 = e.x; e.x1 = e.x; e.vx = 0;
  L.p.y = e.y - Bo.PH - 30; L.p.vy = 300;
  const ev = run(L, 0.3, {});
  assert(ev.some(x => x.type === 'stomp') && !e.alive && L.stomps === 1, 'Von oben: Pirat besiegt');
  const f = L.enemies[1];
  f.x = L.p.x + 40; f.x0 = f.x; f.x1 = f.x; f.vx = 0; f.y = Bo.DECK - f.h;
  L.p.y = Bo.DECK - Bo.PH; L.p.vy = 0;
  const t0 = L.time;
  const ev2 = run(L, 0.5, { right: true });
  assert(ev2.some(x => x.type === 'hurt') && L.time <= t0 - Bo.HURT, 'Von der Seite: Treffer, Zeit weg');
}

// Luke und Tür
{
  const L = Bo.create('shark', 3);
  run(L, 1, {});
  const h = L.hatches[0];
  L.enemies = [];
  L.p.x = h.x + 20; L.p.y = Bo.DECK - Bo.PH - 5;
  const t0 = L.time;
  const ev = run(L, 2, {});
  assert(ev.some(x => x.type === 'fall') && L.time < t0 - Bo.FALL + 0.1 && L.p.x < h.x, 'In die Luke: zurück an den Rand, Zeit weg');
  L.p.x = L.door.x - 5; L.p.y = L.door.y + 20;
  run(L, 0.2, { right: true });
  assert(L.over === 'won', 'Tür der Kapitänskajüte erreicht');
  const M = Bo.create('raider', 3);
  run(M, Bo.TIME + 1, {});
  assert(M.over === 'lost' && M.time === 0, 'Zeit um: zurückgeschlagen');
}

// Ein einfacher Bot (laufen, vor Hindernissen, Luken und Piraten springen) schafft das Deck
{
  let won = 0;
  ['raider', 'shark', 'bluebeard'].forEach((k, i) => {
    const L = Bo.create(k, 11 + i);
    run(L, Bo.TIME, M => {
      const p = M.p;
      const ahead = x => x > p.x + Bo.PW - 5 && x < p.x + Bo.PW + 70;
      const jump = M.solids.some(s => s.k !== 'deck' && ahead(s.x) && s.y < p.y + Bo.PH) ||
        M.hatches.some(h => ahead(h.x)) || M.enemies.some(e => e.alive && ahead(e.x) && Math.abs(e.y + e.h - p.y - Bo.PH) < 30) ||
        (p.x > 1880 && p.x < 1950);
      return { right: true, jump };
    });
    if (L.over === 'won') won++;
  });
  assert(won === 3, `Das Deck ist schaffbar (${won} von 3 mit einem einfachen Bot)`);
}
