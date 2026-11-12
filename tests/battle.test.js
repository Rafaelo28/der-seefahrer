// Tests für die Seeschlacht: gleiche Rechnung überall (Startwert, keine Winkelfunktionen), Steuern, Breitseiten,
// Treffer, Computer-Gegner, Flucht, Entern, Piraten auf der Karte und Beute.
const { assert, load } = require('./setup');
const fs = require('fs');
const path = require('path');
load('format', 'state', 'ships', 'world', 'trade', 'battle', 'pirates');
const B = SF.battle;

const enemy = (kind = 'raider') => SF.pirates.enemyFor({ kind });
const player = (o = {}) => Object.assign({ type: 'frigate', hp: 130, maxHp: 130, cannons: 6, speed: 68 }, o);

// ---------- Rechnet überall gleich ----------
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle.js'), 'utf8').replace(/\/\/.*$/gm, '');
  assert(!/Math\.(sin|cos|tan|atan2?|asin|acos|pow|exp|log|random)\b/.test(src), 'Schlacht rechnet nur mit + − × ÷ und Math.sqrt (kein Zufall von außen)');
  const run = () => {
    const b = B.create(player(), enemy('shark'), { x: 0.6, y: 0.8, s: 0.7 }, 12345);
    for (let i = 0; i < 1200; i++) B.step(b, 1 / 60, { tx: 900, ty: 300 + (i % 200), fire: i % 50 === 0 ? (i % 100 ? 'port' : 'star') : null });
    return JSON.stringify([b.player, b.enemy, b.balls, b.over, b.seed]);
  };
  assert(run() === run(), 'Gleicher Startwert und gleiche Eingaben → genau gleiches Ergebnis');
}

// ---------- Steuern ----------
{
  const b = B.create(player(), enemy(), null, 1);
  const p = b.player;
  p.hx = 1; p.hy = 0;
  for (let i = 0; i < 300; i++) B.steer(p, 0, 1, 1 / 60);
  assert(p.hy > 0.99, 'Dreht zum Ziel (nach Süden)');
  assert(Math.abs(p.hx * p.hx + p.hy * p.hy - 1) < 1e-9, 'Richtung bleibt ein Einheitsvektor');
  const sloop = B.create(player({ type: 'sloop' }), enemy(), null, 1).player;
  const frig = B.create(player({ type: 'frigate' }), enemy(), null, 1).player;
  sloop.hx = frig.hx = 1; sloop.hy = frig.hy = 0;
  for (let i = 0; i < 30; i++) { B.steer(sloop, 0, 1, 1 / 60); B.steer(frig, 0, 1, 1 / 60); }
  assert(sloop.hy > frig.hy, 'Schaluppe ist wendiger als Fregatte');
  const n = B.sideNormal({ hx: 1, hy: 0 }, 'star');
  const m = B.sideNormal({ hx: 1, hy: 0 }, 'port');
  assert(n.x === -0 || n.x === 0, 'Steuerbord quer zur Fahrt');
  assert(n.y === 1 && m.y === -1, 'Fahrt nach Osten: Steuerbord = Süden, Backbord = Norden');
}

// ---------- Breitseite und Treffer ----------
{
  const b = B.create(player({ cannons: 4 }), enemy(), { x: 1, y: 0, s: 0 }, 2);
  const p = b.player;
  const e = b.enemy;
  p.x = 600; p.y = 500; p.hx = 1; p.hy = 0;
  e.x = 600; e.y = 720; e.hx = 1; e.hy = 0; e.delay = 99; // Gegner liegt steuerbord und schießt nicht
  e.speed = p.speed;
  const ev = B.step(b, 0.01, { fire: 'star' });
  assert(ev.some(x => x.type === 'fire') && b.balls.length === 4, '4 Kanonen = 4 Kugeln');
  assert(!B.fire(b, p, 'star', []), 'Nachladen: nicht sofort noch einmal');
  assert(B.fire(b, p, 'port', []), 'Die andere Seite ist geladen');
  b.balls = b.balls.filter(x => x.vy > 0);
  const hp0 = e.hp;
  for (let i = 0; i < 120; i++) B.step(b, 1 / 60, {});
  assert(e.hp < hp0 && b.hits.player > 0, `Treffer am Gegner (${hp0} → ${e.hp})`);
  assert(B.inHull(e, e.x, e.y) && !B.inHull(e, e.x, e.y + 60), 'Rumpf ist länglich');
  const one = B.create(player({ cannons: 0 }), enemy(), null, 3);
  assert(one.player.cannons === 1, 'Ohne Kanonen bleibt ein Drehbassen-Geschütz');
}

// ---------- Bessere Steuerung: Finger am Schiff, Zielhilfe ----------
{
  // Finger direkt auf dem eigenen Schiff: Kurs halten statt im Kreis drehen
  const b = B.create(player(), enemy(), null, 8);
  const p = b.player;
  p.x = 600; p.y = 500; p.hx = 1; p.hy = 0;
  b.enemy.x = 1000; b.enemy.y = 800; b.enemy.delay = 99; b.enemy.speed = 0; // nah genug (sonst gilt es als Flucht)
  for (let i = 0; i < 20; i++) B.step(b, 1 / 60, { tx: p.x - 10, ty: p.y + 15 });
  assert(!b.over && p.hx > 0.999, 'Finger direkt am Schiff: Kurs bleibt');
  for (let i = 0; i < 60; i++) B.step(b, 1 / 60, { tx: p.x, ty: p.y + 400 });
  assert(p.hy > 0.3, 'Finger weiter weg: das Schiff dreht hin');

  // Zielhilfe: Gegner fährt schräg vor der Breitseite vorbei – mit Vorhalt treffen mehr Kugeln
  const shoot = assist => {
    const g = B.create(player({ cannons: 6 }), enemy(), null, 9);
    const q = g.player;
    const e = g.enemy;
    q.x = 600; q.y = 500; q.hx = 1; q.hy = 0; q.speed = 0;
    e.x = 480; e.y = 800; e.hx = 1; e.hy = 0; e.delay = 99; e.speed = 110;
    const arc = B.inArc(g, q, 'star');
    if (!assist) q.side = 'ohne'; // zum Vergleich: so schießen wie ein Computer-Pirat (genau quer, ohne Streuung)
    q.aim = 0;
    B.fire(g, q, 'star', []);
    q.side = 'player';
    g.balls.forEach(x => { x.from = 'player'; });
    for (let i = 0; i < 90; i++) B.step(g, 1 / 60, {});
    return { hits: g.hits.player, arc };
  };
  const withAim = shoot(true);
  const without = shoot(false);
  assert(withAim.arc > 0, 'Gegner liegt im Bereich der Zielhilfe');
  assert(withAim.hits > without.hits, `Zielhilfe: Kugeln fliegen dorthin, wo der Gegner sein wird (${withAim.hits} statt ${without.hits} Treffer)`);
  // Gegner zu weit hinter der Breitseite: keine Zielhilfe
  const g2 = B.create(player(), enemy(), null, 10);
  g2.player.x = 600; g2.player.y = 500; g2.player.hx = 1; g2.player.hy = 0;
  g2.enemy.x = 300; g2.enemy.y = 560;
  assert(!B.inArc(g2, g2.player, 'star') && !B.inArc(g2, g2.player, 'port'), 'Gegner hinter dem Heck: keine Seite leuchtet');
  // Computer-Piraten bekommen keine Zielhilfe (ihre Kugeln fliegen quer zur Fahrt, mit eigener Streuung)
  const g3 = B.create(player(), enemy(), null, 11);
  const ce = g3.enemy;
  ce.x = 600; ce.y = 500; ce.hx = 1; ce.hy = 0; ce.aim = 0;
  g3.player.x = 760; g3.player.y = 760;
  B.fire(g3, ce, 'star', []);
  assert(g3.balls.every(x => Math.abs(x.vx - ce.hx * ce.speed * 0.5) < 1e-6), 'Computer-Pirat: keine Zielhilfe');
}

// ---------- Computer-Gegner, Ausgänge ----------
{
  // Wer sich nicht wehrt, verliert gegen Käpt'n Blaubart
  const b = B.create(player({ type: 'sloop', hp: 60, maxHp: 60, cannons: 2, speed: 55 }), enemy('bluebeard'), { x: 1, y: 0, s: 0.5 }, 4);
  let t = 0;
  while (!b.over && t < 240) { B.step(b, 1 / 30, { tx: 900, ty: 550 }); t += 1 / 30; }
  assert(b.over === 'lost', `Blaubart besiegt einen wehrlosen Spieler (${b.over}, ${Math.round(t)} s)`);
  // Fliehen nie aus Versehen: Wer an den Rand segelt, kämpft weiter – erst der Knopf „Fliehen“ beendet die Schlacht
  const f = B.create(player({ speed: 120 }), enemy('raider'), null, 5);
  f.player.x = 500; f.player.y = 550; f.enemy.x = 900; f.enemy.y = 550;
  f.enemy.speed = 20;
  t = 0;
  while (!f.over && t < 20 && !B.atEdge(f.player)) { B.step(f, 1 / 30, { tx: -500, ty: 550 }); t += 1 / 30; }
  for (let i = 0; i < 30; i++) B.step(f, 1 / 30, { tx: -500, ty: 550 }); // noch eine Sekunde am Rand entlang
  assert(!f.over && B.atEdge(f.player), `Am Rand: kein automatisches Entkommen (${f.over || 'kämpft weiter'})`);
  assert(B.canFlee(f), 'Am Rand und Gegner außer Schussweite: Fliehen möglich');
  assert(B.flee(f) && f.over === 'fled', 'Knopf „Fliehen“: entkommen');
  const g2 = B.create(player(), enemy('raider'), null, 5);
  g2.player.x = 70; g2.player.y = 550; g2.enemy.x = 300; g2.enemy.y = 550;
  B.step(g2, 1 / 30, { tx: -500, ty: 550 });
  assert(!g2.over && !B.canFlee(g2) && !B.flee(g2), 'Am Rand, aber Gegner in Schussweite: kein Fliehen');
  const g3 = B.create(player(), enemy('raider'), null, 5);
  g3.player.x = 900; g3.player.y = 550; g3.enemy.x = 1650; g3.enemy.y = 550;
  assert(!B.canFlee(g3), 'Gegner weit weg, aber mitten auf dem Meer: kein Fliehen');
  // Beide Schiffe weit auseinander: auch dann kein automatisches Ende
  g3.enemy.speed = 0; g3.player.speed = 0;
  for (let i = 0; i < 30; i++) B.step(g3, 1 / 30, {});
  assert(!g3.over, 'Weit auseinander: die Schlacht läuft weiter');
  // Ein einfacher Spieler-Bot (Gegner seitlich halten und feuern) besiegt Seeräuber mit einer Fregatte
  let wins = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const g = B.create(player(), enemy('raider'), { x: 0, y: 1, s: 0.4 }, seed * 977);
    t = 0;
    while (!g.over && t < 180) {
      const p = g.player;
      const e = g.enemy;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      // Zielpunkt: neben den Gegner (er liegt dann quer)
      const tx = e.x - dy / d * 220;
      const ty = e.y + dx / d * 220;
      const star = B.sideNormal(p, 'star');
      const side = (dx * star.x + dy * star.y) / d;
      const fire = d < B.BALL_RANGE * 0.9 ? (side > 0.85 ? 'star' : side < -0.85 ? 'port' : null) : null;
      B.step(g, 1 / 30, { tx, ty, fire });
      if (B.canBoard(g)) { g.over = 'boarded'; break; }
      t += 1 / 30;
    }
    if (g.over === 'sunk' || g.over === 'boarded') wins++;
  }
  assert(wins >= 4, `Fregatte gegen Seeräuber: meistens gewonnen (${wins} von 6)`);
  // Entern
  const c = B.create(player(), enemy(), null, 6);
  c.enemy.x = c.player.x + 120; c.enemy.y = c.player.y;
  assert(!B.canBoard(c), 'Unbeschädigt: kein Entern');
  c.enemy.hp = c.enemy.maxHp * 0.3;
  assert(B.canBoard(c), 'Schwer beschädigt und nah: Entern');
  c.enemy.x += 400;
  assert(!B.canBoard(c), 'Zu weit weg: kein Entern');
}

// ---------- Piraten auf der Karte ----------
{
  SF.state = SF.createDefaultState();
  SF.state.food = 10;
  SF.state.pos = { x: SF.world.START.x, y: SF.world.START.y, dx: 1, dy: 0 };
  SF.pirates.refill();
  SF.state.seaTime = 100;
  for (let i = 0; i < 10; i++) { SF.pirates.refill(); SF.state.seaTime += 30; }
  const list = SF.pirates.list();
  const max = SF.pirates.ZONES.reduce((a, z) => a + z.max, 0);
  assert(list.length > 0 && list.length <= max, `Piraten in ihren Gebieten (${list.length} von höchstens ${max})`);
  assert(list.every(p => SF.world.isWater(p.x, p.y)), 'Piraten schwimmen im Wasser');
  const start = SF.world.START;
  assert(list.every(p => Math.hypot(p.x - start.x, p.y - start.y) > 600), 'Rund um Port Dublone ist es sicher');
  assert(SF.pirates.ZONES.filter(z => !z.map).every(z => Math.hypot(z.x - start.x, z.y - start.y) > z.r + 400), 'Kein Gebiet nahe am Start');
  // Ein Pirat sieht das Schiff, jagt es und greift an
  const p = list[0];
  SF.state.pirates = [p]; // nur dieser eine Pirat, damit kein anderer zuerst angreift
  SF.state.seaTime = 0;
  SF.state.pirateClock = { smugglers: 1e9, reef: 1e9, north: 1e9, west: 1e9, dragon: 1e9 };
  // Schiff in freiem Wasser 200 Einheiten neben den Piraten setzen
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
  const free = dirs.find(([dx, dy]) => SF.world.segmentClear(p.x, p.y, p.x + dx * 200, p.y + dy * 200)) || [1, 0];
  SF.state.pos.x = p.x + free[0] * 200;
  SF.state.pos.y = p.y + free[1] * 200;
  let attacker = null;
  for (let i = 0; i < 400 && !attacker; i++) attacker = SF.pirates.step(0.05);
  assert(attacker === p, 'Pirat jagt das Schiff und greift an');
  SF.state.docked = 'smuggler';
  assert(!SF.pirates.step(0.05), 'Im Hafen ist man sicher');
  SF.state.docked = '';
  // Beute: entern
  SF.state.ship = { type: 'brig', sails: 0, hold: 0, pantry: 0, hull: 0, hp: null, cannons: 4 };
  SF.state.cargo = {};
  const a0 = SF.state.amber;
  const k = SF.pirates.KINDS[p.kind];
  const out = SF.pirates.resolve(p, 'boarded', 50);
  assert(out.amber === k.bounty && SF.state.amber === a0 + k.bounty, 'Entern: ganzes Kopfgeld');
  assert(SF.ships.cargoCount() === k.cargo && !SF.pirates.list().includes(p), 'Entern: Ladung erbeutet, Pirat weg');
  assert(SF.state.ship.hp === 50 && SF.state.stats.wins === 1, 'Rumpfschaden bleibt, Sieg gezählt');
  // Versenkt: halbes Kopfgeld
  SF.state.pos.x = SF.world.START.x;
  SF.state.pos.y = SF.world.START.y;
  const q = SF.pirates.spawn(SF.pirates.ZONES[0]);
  const a1 = SF.state.amber;
  SF.pirates.resolve(q, 'sunk', 40);
  assert(SF.state.amber === a1 + Math.round(SF.pirates.KINDS[q.kind].bounty / 2), 'Versenkt: halbes Kopfgeld');
  // Verloren: halbe Ladung, etwas Bernstein, in den nächsten Hafen
  const r = SF.pirates.spawn(SF.pirates.ZONES[0]);
  SF.state.cargo = { rum: 5, fish: 1 };
  SF.state.amber = 1000;
  SF.state.pos.x = 2300; SF.state.pos.y = 1450;
  const lost = SF.pirates.resolve(r, 'lost', 0);
  assert(SF.state.cargo.rum === 3 && SF.state.cargo.fish === 1, 'Verloren: Hälfte der Ladung weg');
  assert(lost.lostAmber === 50 && SF.state.amber === 950, 'Verloren: höchstens 50 Bernstein weg');
  assert(lost.harbor === 'smuggler' && SF.state.pos.x === SF.world.placeById.smuggler.x, 'In den nächsten Hafen geschleppt');
  assert(SF.state.ship.hp >= 1 && r.cool > 0, 'Kein Game Over, der Pirat lässt einen in Ruhe');
}

// ---------- Werft: Rumpf ----------
{
  SF.state.amber = 1000;
  SF.state.ship = { type: 'brig', sails: 0, hold: 0, pantry: 0, hull: 0, hp: 30, cannons: 4 };
  assert(SF.ships.hullMax() === 90 && SF.ships.hullNow() === 30, 'Brigg: Rumpf 90');
  const cost = SF.ships.repairCost();
  assert(cost === Math.ceil(60 * SF.ships.REPAIR) && SF.ships.repair() && SF.ships.hullNow() === 90 && SF.state.amber === 1000 - cost, 'Reparatur');
  assert(SF.ships.repairCost() === 0 && !SF.ships.repair(), 'Heil: nichts zu reparieren');
  assert(SF.ships.buyUpgrade('hull') && SF.ships.hullMax() === 115, 'Rumpf verstärkt: +25');
}
