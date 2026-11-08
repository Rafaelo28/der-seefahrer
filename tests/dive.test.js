// Tests für das Tauchen: Schwimmen zum Finger, Luft, Muscheln (nur offen), Quallen, Auftauchen, Perlen, Nachwachsen.
const { assert, load } = require('./setup');
load('format', 'state', 'world', 'trade', 'dive');
const Dv = SF.dive;
SF.state = SF.createDefaultState();
const run = (D, secs, input) => { const ev = []; for (let t = 0; t < secs && !D.over; t += 1 / 60) ev.push(...Dv.step(D, 1 / 60, typeof input === 'function' ? input(D) : input)); return ev; };

{
  const D = Dv.create('reef', 5);
  D.jellies = [];
  run(D, 2, { tx: D.x, ty: 600 });
  assert(D.y > 300, 'Taucher schwimmt zum Finger nach unten');
  assert(D.air < Dv.AIR - 1.9, 'Luft wird verbraucht');
  // Muschel nur offen pflückbar
  const c = D.clams[0];
  D.x = c.x; D.y = c.y;
  c.phase = Dv.CYCLE - (D.t % Dv.CYCLE) + Dv.OPEN + 0.1; // gerade zu
  Dv.step(D, 0.01, {});
  assert(!c.taken && D.pearls === 0, 'Geschlossene Muschel: keine Perle');
  c.phase = Dv.CYCLE - (D.t % Dv.CYCLE); // gerade auf
  const ev = Dv.step(D, 0.01, { tx: c.x, ty: c.y });
  assert(c.taken && D.pearls === 1 && ev.some(e => e.type === 'pearl'), 'Offene Muschel: Perle');
  const big = D.clams.find(x => x.big);
  big.phase = Dv.CYCLE - (D.t % Dv.CYCLE);
  D.x = big.x; D.y = big.y;
  Dv.step(D, 0.01, { tx: big.x, ty: big.y });
  assert(D.pearls === 4, 'Große Muschel: 3 Perlen');
  // Qualle kostet Luft
  D.jellies = [{ x: D.x, y: D.y, y0: D.y, r: 20, vx: 0, ph: 0 }];
  const air = D.air;
  run(D, 0.05, {});
  assert(D.air < air - Dv.STING + 0.1, 'Qualle: Luft weg');
  // Auftauchen
  D.jellies = [];
  run(D, 15, { tx: D.x, ty: 0 });
  assert(D.over === 'surfaced', 'Aufgetaucht');
  const keep = Dv.finish(D);
  assert(keep === 4 && SF.state.pearls === 4, 'Alle Perlen behalten');
}

// Keine Luft mehr: die Hälfte der Perlen
{
  const D = Dv.create('reef', 6);
  D.jellies = [];
  D.pearls = 5;
  run(D, Dv.AIR + 1, { tx: 700, ty: 1100 });
  assert(D.over === 'air', 'Luft alle');
  const before = SF.state.pearls;
  assert(Dv.finish(D) === 2 && SF.state.pearls === before + 2, 'Ohne Luft: halbe Perlen (abgerundet)');
}

// Gepflückte Muscheln wachsen erst nach zwei Tagen nach
{
  SF.state.seaTime = 0;
  SF.state.dives = {};
  const D = Dv.create('reef', 7);
  D.clams[3].taken = true;
  D.over = 'surfaced';
  Dv.finish(D);
  assert(Dv.create('reef', 8).clams[3].taken, 'Am selben Tag bleibt die Muschel leer');
  SF.state.seaTime = SF.trade.DAY * 2 + 1;
  assert(!Dv.create('reef', 9).clams[3].taken, 'Nach zwei Tagen ist sie nachgewachsen');
}

// Ein Taucher, der die nächste offene Muschel ansteuert und rechtzeitig auftaucht, findet Perlen
{
  SF.state.dives = {};
  const D = Dv.create('reef', 10);
  run(D, 60, d => {
    if (d.air < 9) return { tx: d.x, ty: 0 };
    const open = d.clams.filter(c => !c.taken).sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
    return open ? { tx: open.x, ty: open.y } : { tx: d.x, ty: 0 };
  });
  assert(D.over === 'surfaced' && D.pearls >= 3, `Geschickter Taucher: aufgetaucht mit ${D.pearls} Perlen`);
}
