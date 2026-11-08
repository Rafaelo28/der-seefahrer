// Tests fürs Finale: der Fliegende Holländer (sinkt nicht, entern), Long John bewacht die Kajüte, das Ende,
// Geheimnisse für 100 %, Bermuda-Dreieck, Schwer-Modus und was über Spielstände hinweg bleibt.
const { assert, load, store } = require('./setup');
load('format', 'state', 'meta', 'rank', 'figure', 'gk-import', 'ships', 'world', 'trade', 'voyage', 'battle', 'pirates', 'crew', 'boarding', 'island');
SF.ui = { dialog: () => Promise.resolve(true), toast() {}, tip() {}, KLABAUTER: '<svg></svg>' };
SF.sound = { play() {} };
SF.track = () => {};
global.setTimeout = fn => fn();
load('story', 'chapter', 'finale');
const F = SF.finale;
let played = null;
SF.story.play = (scenes, done) => { played = scenes; };

SF.state = SF.createDefaultState();
SF.state.started = true;

// ---------- Der Holländer sinkt nicht ----------
{
  const e = SF.pirates.enemyFor({ kind: 'dutchman' });
  assert(e.noSink && e.type === 'ghost' && e.hp === 240, 'Holländer: Geisterschiff, 240 Rumpf, sinkt nicht');
  const b = SF.battle.create({ type: 'galleon', hp: 180, maxHp: 180, cannons: 8, speed: 56 }, e, null, 9);
  b.enemy.hp = 5;
  b.enemy.x = b.player.x; b.enemy.y = b.player.y + 160; b.enemy.delay = 99; b.enemy.speed = 0;
  b.player.hx = 1; b.player.hy = 0; b.player.speed = 0;
  for (let i = 0; i < 400 && !b.over; i++) SF.battle.step(b, 1 / 30, { fire: i % 80 === 0 ? 'star' : null });
  assert(b.enemy.hp === 1 && b.over === '' && b.hits.player > 0, `Treffer, aber kein Versinken (Rumpf ${b.enemy.hp})`);
  assert(SF.battle.canBoard(b), 'Nur noch entern');
}

// ---------- Long John bewacht die Kajüte ----------
{
  const L = SF.boarding.create('dutchman', 3);
  const lj = L.enemies.find(x => x.longjohn);
  assert(lj && lj.lives === 3 && L.locked && L.time === 60, 'Long John mit drei Leben, 60 Sekunden');
  for (let t = 0; t < 1; t += 1 / 60) SF.boarding.step(L, 1 / 60, {});
  L.enemies.forEach(x => { if (!x.longjohn) x.alive = false; });
  L.p.x = L.door.x - 5; L.p.y = L.door.y + 20;
  SF.boarding.step(L, 1 / 60, {});
  assert(!L.over, 'Tür zu, solange Long John steht');
  // dreimal von oben
  for (let k = 0; k < 3; k++) {
    lj.vx = 0;
    L.p.x = lj.x; L.p.y = lj.y - SF.boarding.PH - 10; L.p.vy = 400;
    for (let t = 0; t < 0.2; t += 1 / 60) SF.boarding.step(L, 1 / 60, {});
  }
  assert(!lj.alive, 'Long John nach drei Treffern besiegt');
  L.p.x = L.door.x - 5; L.p.y = L.door.y + 20; L.p.vy = 0;
  SF.boarding.step(L, 1 / 60, {});
  assert(L.over === 'won', 'Jetzt geht die Tür auf');
}

// ---------- Wann taucht der Holländer auf? ----------
{
  const m = SF.world.placeById.mist;
  SF.state.pos = { x: m.x, y: m.y, dx: 1, dy: 0 };
  SF.state.story.step = 'traitor';
  assert(!F.ready(), 'Vor dem Finale nicht');
  SF.state.story.step = 'finale';
  assert(F.ready() && SF.story.goal() === 'mist', 'Im Finale am Nebelmeer: Angriff');
  F.afterBattle('lost');
  assert(!F.ready(), 'Nach einer Niederlage nicht sofort wieder');
  SF.state.pos.x = m.x - 600;
  F.ready();
  SF.state.pos.x = m.x;
  assert(F.ready(), 'Wieder hin, nachdem man weg war');
  SF.state.docked = 'dublone';
  assert(!F.ready(), 'Nicht im Hafen');
  SF.state.docked = '';
}

// ---------- Das Ende ----------
{
  store[SF.meta.KEY] = undefined;
  delete store[SF.meta.KEY];
  SF.meta._reset();
  assert(!SF.meta.hardUnlocked(), 'Schwer-Modus am Anfang gesperrt');
  const doc = global.document.getElementById;
  F.ending();
  assert(played && played.length === 4 && played.every(sc => SF.story.ART[sc.art]), 'Ende: vier Bilder, alle gezeichnet');
  assert(played[0].text.includes('Goldene Dublone'), 'Die Goldene Dublone ist zurück');
  assert(SF.story.step() === 'done' && SF.crew.fleet().some(f => f.type === 'ghost'), 'Durchgespielt: das Geisterschiff gehört dir');
  assert(SF.meta.hardUnlocked() && F.has('dublone'), 'Schwer-Modus frei, erstes Geheimnis');
  SF.meta._reset();
  assert(SF.meta.hardUnlocked(), 'Freischaltung bleibt im eigenen Speicher (auch für neue Spielstände)');
  SF.state = SF.createDefaultState();
  assert(SF.meta.hardUnlocked() && !F.has('dublone'), 'Neuer Spielstand: Geheimnisse leer, Schwer-Modus weiter frei');
  void doc;
}

// ---------- Geheimnisse ----------
{
  SF.state = SF.createDefaultState();
  assert(F.SECRETS.length === 10 && F.count() === 0 && F.percent() === 0, '10 Geheimnisse, am Anfang keins');
  SF.state.amber = 2500;
  const fresh = F.check(true);
  assert(fresh.includes('rich') && F.count() === 1 && F.percent() === 10, 'Reich: 10 %');
  assert(F.check(true).length === 0, 'Nur einmal gemeldet');
  const p0 = SF.state.pearls;
  assert(F.onBermuda().includes('10 Perlen') && SF.state.pearls === p0 + 10, 'Bermuda-Dreieck: 10 Perlen');
  SF.state.visited.bermuda = 1;
  assert(F.check(true).includes('bermuda'), 'Bermuda-Dreieck ist ein Geheimnis');
  const b = SF.world.placeById.bermuda;
  SF.state.pos = { x: b.x + 200, y: b.y, dx: 1, dy: 0 };
  assert(F.compassCrazy(), 'Nahe am Dreieck spinnt der Kompass');
  SF.state.pos.x = b.x + 1000;
  assert(!F.compassCrazy(), 'Weiter weg nicht');
  assert(b.hidden, 'Das Dreieck ist versteckt');
}

// ---------- Schwer-Modus ----------
{
  SF.state = SF.createDefaultState();
  const normal = SF.pirates.enemyFor({ kind: 'raider' });
  SF.state.food = 1;
  const range = SF.voyage.range();
  const time = SF.island.create('bay').time;
  SF.state.hard = true;
  const hard = SF.pirates.enemyFor({ kind: 'raider' });
  assert(hard.hp === Math.round(normal.hp * 1.5) && hard.aim < normal.aim, 'Schwer: Piraten haben mehr Rumpf und zielen besser');
  assert(Math.abs(SF.voyage.range() - range * 0.8) < 1e-9, 'Schwer: Proviant reicht kürzer');
  assert(Math.abs(SF.island.create('bay').time - time * 0.8) < 1e-9, 'Schwer: weniger Zeit an Land');
  const old = { game: 'der-seefahrer', amber: 5, started: true };
  SF.applyData(old);
  assert(SF.state.hard === false && typeof SF.state.secrets === 'object', 'Alte Spielstände: normal, keine Geheimnisse');
}
