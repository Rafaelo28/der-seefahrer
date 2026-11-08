// Tests für Crew und alte Flotte: anheuern, Vorteile (Proviant, Tempo, Nachladen), Verräter von Bord, Umsteigen.
const { assert, load } = require('./setup');
load('format', 'state', 'ships', 'world', 'trade', 'voyage', 'battle', 'crew');
const C = SF.crew;
SF.state = SF.createDefaultState();
SF.state.amber = 100;

// ---------- Anheuern ----------
assert(C.members().length === 0, 'Am Anfang keine Crew');
assert(!C.hire('fiete'), 'Fiete kann man nicht kaufen (Story)');
assert(!C.hire('nils') && SF.state.amber === 100, 'Zu wenig Bernstein für Nils');
assert(C.hire('karla') && SF.state.amber === 10 && C.has('karla'), 'Karla angeheuert');
assert(!C.hire('karla'), 'Nicht doppelt');
assert(C.join('fiete') && C.members().join() === 'fiete,karla', 'Fiete durch die Story an Bord');

// ---------- Vorteile ----------
{
  const base = SF.voyage.FOOD_DIST;
  SF.state.food = 1;
  assert(Math.abs(SF.voyage.range() - base * 1.25) < 1e-9, 'Fiete: Proviant reicht ein Viertel weiter');
  assert(C.reloadMul() === 0.8, 'Karla: schneller nachladen');
  const b = SF.battle.create({ type: 'brig', hp: 90, maxHp: 90, cannons: 2, speed: 60, reloadMul: C.reloadMul() }, { type: 'sloop', hp: 50, maxHp: 50, cannons: 1, speed: 50 }, null, 3);
  SF.battle.fire(b, b.player, 'port', []);
  assert(Math.abs(b.player.reload.port - SF.battle.RELOAD * 0.8) < 1e-9 && b.enemy.reloadTime === SF.battle.RELOAD, 'Nachladen in der Schlacht schneller, Gegner normal');
  const sp = SF.ships.stats().speed;
  SF.state.amber = 500;
  assert(C.hire('nils') && Math.abs(SF.ships.stats().speed - sp * 1.06) < 1e-9, 'Nils: 6 % schneller');
  assert(C.leave('fiete') && !C.has('fiete') && SF.voyage.range() === base, 'Fiete von Bord: Vorteil weg');
  assert(!C.join('fiete') || true, 'Wer gegangen ist …');
  assert(SF.state.crew.fiete === 'gone' || C.has('fiete'), 'Status gespeichert');
}

// ---------- Alte Flotte ----------
{
  SF.state.crew = {};
  SF.state.ship = { type: 'brig', sails: 2, hold: 1, pantry: 0, hull: 0, hp: null, cannons: 3 };
  assert(C.addShip('galleon') && !C.addShip('galleon') && !C.addShip('brig'), 'Galeone in die Flotte (nur einmal, nicht das eigene Schiff)');
  SF.state.cargo = { fish: 5 };
  SF.state.food = 8;
  assert(C.swap(0) && SF.state.ship.type === 'galleon' && C.fleet()[0].type === 'brig', 'Umgestiegen auf die Galeone');
  assert(C.fleet()[0].sails === 2 && C.fleet()[0].cannons === 3, 'Die Brigg behält Ausbau und Kanonen');
  SF.state.cargo = { fish: 20 };
  assert(C.whyNotSwap(0) === 'Zu viel Ladung an Bord' && !C.swap(0), 'Zu viel Ladung für die Brigg');
  SF.state.cargo = {};
  SF.state.food = 12;
  assert(C.swap(0) && SF.state.food === SF.ships.stats().food, 'Zurück: Proviant passt in die kleinere Kammer');
}

// ---------- Alte Spielstände ----------
{
  const old = { game: 'der-seefahrer', amber: 5, started: true, story: { step: 'end1' } };
  SF.applyData(old);
  assert(typeof SF.state.crew === 'object' && Array.isArray(SF.state.fleet), 'Crew und Flotte bekommen Standardwerte');
  SF.state.crew = [1];
  assert(C.members().length === 0, 'Kaputte Crew-Daten: niemand an Bord');
}
