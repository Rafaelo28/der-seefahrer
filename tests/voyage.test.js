// Tests für das Segeln: Kurs folgen, Küste, Wind, Proviant (leer = langsamer, kein Game Over), Treibgut, Entdecken.
const { assert, load } = require('./setup');
load('format', 'state', 'ships', 'world', 'trade', 'voyage');
const V = SF.voyage;
const Wo = SF.world;

function fresh() {
  SF.state = SF.createDefaultState();
  SF.state.started = true;
  SF.state.docked = 'dublone';
  SF.state.food = 6;
  V._resetClocks();
  V.ensurePos();
  // Windstille für berechenbare Tests
  SF.state.wind = { x: 1, y: 0, s: 0, tx: 1, ty: 0, ts: 0, next: 1e9 };
  return SF.state;
}
const run = (secs, dt = 0.05) => { const ev = []; for (let t = 0; t < secs; t += dt) ev.push(...V.step(dt)); return ev; };

// ---------- Start ----------
{
  const s = fresh();
  assert(s.pos.x === Wo.START.x && s.pos.y === Wo.START.y, 'Start in Port Dublone');
  assert(Wo.knownAt(s.pos.x, s.pos.y) && s.fog.length > 0, 'Karte rund um den Start aufgedeckt');
  assert(!V.moving() && run(1).length === 0, 'Ohne Kurs passiert nichts');
}

// ---------- Kurs folgen ----------
{
  const s = fresh();
  const tx = s.pos.x + 300;
  const ty = s.pos.y;
  assert(Wo.segmentClear(s.pos.x, s.pos.y, tx, ty), 'Testkurs ist frei');
  V.setCourse([tx, ty]);
  assert(s.docked === '' && V.moving(), 'Kurs gesetzt, abgelegt');
  const speed = SF.ships.stats().speed;
  const ev = run(2);
  assert(Math.abs(s.pos.x - (Wo.START.x + speed * 2)) < 3, `Tempo stimmt (${Math.round(s.pos.x - Wo.START.x)} ≈ ${speed * 2})`);
  run(10);
  assert(Math.abs(s.pos.x - tx) < 5 && !V.moving(), 'Am Ziel angehalten');
  assert(s.stats.distance > 290 && s.food < 6 && s.food > 5.4, `Strecke und Proviant (${s.food.toFixed(2)})`);
  assert(ev.every(e => e.type !== 'land'), 'Keine Küste im Weg');
}

// ---------- Küste ----------
{
  const s = fresh();
  V.setCourse([700, 1350]); // Mitte der Insel
  const ev = run(20);
  assert(ev.some(e => e.type === 'land') && !V.moving(), 'An der Küste angehalten');
  assert(Wo.isWater(s.pos.x, s.pos.y), 'Schiff bleibt im Wasser');
}

// ---------- Wind ----------
{
  const s = fresh();
  s.wind = { x: 1, y: 0, s: 1, tx: 1, ty: 0, ts: 1, next: 1e9 };
  const base = SF.ships.stats().speed;
  assert(Math.abs(V.speed(1, 0) - base * 1.3) < 1e-9, 'Rückenwind +30 %');
  assert(Math.abs(V.speed(-1, 0) - base * 0.7) < 1e-9, 'Gegenwind −30 %');
  assert(Math.abs(V.speed(0, 1) - base) < 1e-9, 'Seitenwind: normal');
  s.wind.next = 0;
  V.step(0.01);
  assert(s.wind.next > 50, 'Neuer Wind wird ausgelost');
  const len = Math.hypot(s.wind.x, s.wind.y);
  assert(Math.abs(len - 1) < 1e-6, 'Windrichtung bleibt ein Einheitsvektor');
}

// ---------- Proviant ----------
{
  const s = fresh();
  s.food = 0.05;
  const full = V.speed(1, 0);
  V.setCourse([s.pos.x + 300, s.pos.y]);
  const ev = run(3);
  assert(s.food === 0 && ev.some(e => e.type === 'nofood'), 'Proviant alle → Meldung');
  assert(Math.abs(V.speed(1, 0) - full * V.HUNGRY_SPEED) < 1e-9, 'Ohne Proviant langsamer');
  const x0 = s.pos.x;
  V.setCourse([x0 + 200, s.pos.y, x0, s.pos.y, x0 + 200, s.pos.y, x0, s.pos.y]);
  const ev2 = run(60);
  assert(ev2.some(e => e.type === 'grumble'), 'Crew murrt');
  assert(!V.moving() && Math.abs(s.pos.x - x0) < 5, 'Das Schiff kommt trotzdem an (kein Game Over)');
}

// ---------- Treibgut ----------
{
  const s = fresh();
  s.flotsam = [{ x: s.pos.x + 10, y: s.pos.y, kind: 'amber' }];
  const a0 = s.amber;
  const ev = V.step(0.01);
  assert(ev.some(e => e.type === 'flotsam') && s.amber > a0 && s.flotsam.length === 0, 'Bernstein aus dem Wasser gefischt');
  s.food = SF.ships.stats().food - 0.5;
  s.flotsam = [{ x: s.pos.x, y: s.pos.y + 5, kind: 'barrel' }];
  V.step(0.01);
  assert(s.food === SF.ships.stats().food, 'Fass Proviant (bis die Kammer voll ist)');
  s.flotsam = [{ x: s.pos.x, y: s.pos.y + 5, kind: 'crate' }];
  const c0 = SF.ships.cargoCount();
  V.step(0.01);
  assert(SF.ships.cargoCount() === c0 + 1, 'Kiste mit Ware an Bord');
  s.cargo = { fish: SF.ships.stats().hold };
  s.flotsam = [{ x: s.pos.x, y: s.pos.y + 5, kind: 'crate' }];
  const a1 = s.amber;
  V.step(0.01);
  assert(SF.ships.cargoCount() === SF.ships.stats().hold && s.amber > a1, 'Laderaum voll: Bernstein statt Kiste');
  // Neues Treibgut erscheint nur im Wasser
  s.flotsam = [];
  for (let i = 0; i < 20; i++) V.spawnFlotsam();
  assert(s.flotsam.length > 10 && s.flotsam.every(f => Wo.isWater(f.x, f.y, 20)), 'Treibgut schwimmt im Wasser');
}

// ---------- Orte entdecken und ankommen ----------
{
  const s = fresh();
  const bay = Wo.placeById.bay;
  s.pos.x = bay.x;
  s.pos.y = bay.y;
  const a0 = s.amber;
  const ev = V.step(0.01);
  assert(ev.some(e => e.type === 'discover' && e.place === 'bay') && s.amber === a0 + bay.reward, 'Nahe Bucht entdeckt, Belohnung');
  assert(!V.step(0.01).some(e => e.type === 'discover'), 'Nur einmal entdeckt');
  const amber = Wo.placeById.amberbay;
  s.pos.x = amber.x + 60;
  s.pos.y = amber.y;
  V.setCourse([amber.x, amber.y]);
  const ev2 = run(3);
  assert(ev2.some(e => e.type === 'arrive' && e.place === 'amberbay'), 'Am Hafen angekommen');
}
