// Tests für Handel und Werft: Preise je Hafen, Kaufen/Verkaufen, Laderaum, Proviant, keine Endlos-Gewinne, Werft.
const { assert, load } = require('./setup');
load('format', 'state', 'ships', 'world', 'trade');
const T = SF.trade;
const S = SF.ships;

function fresh(amber = 1000) {
  SF.state = SF.createDefaultState();
  SF.state.amber = amber;
  SF.state.ship.type = 'brig';
  return SF.state;
}

// ---------- Preise ----------
{
  fresh();
  ['dublone', 'amberbay', 'smuggler'].forEach(h => T.GOODS.forEach(g => {
    const b = T.buyPrice(h, g.id);
    const s = T.sellPrice(h, g.id);
    assert(b >= 1 && s >= 1 && s < b, `${h}/${g.id}: Verkaufspreis unter Kaufpreis (${s} < ${b})`);
    assert(b < 100, `${h}/${g.id}: kleine Zahlen (${b})`);
  }));
  assert(T.buyPrice('amberbay', 'fish') < T.sellPrice('smuggler', 'fish'), 'Fisch: Bernsteinbucht → Schmugglerinsel lohnt sich');
  assert(T.buyPrice('smuggler', 'spice') < T.sellPrice('dublone', 'spice'), 'Gewürze: Schmugglerinsel → Port Dublone lohnt sich');
  assert(T.buyPrice('dublone', 'salt') < T.sellPrice('amberbay', 'salt'), 'Salz: Port Dublone → Bernsteinbucht lohnt sich');
  // Tagesschwankung
  const d0 = T.buyPrice('dublone', 'rum');
  SF.state.seaTime = 5 * T.DAY;
  const d5 = T.buyPrice('dublone', 'rum');
  assert(Math.abs(d5 - d0) <= Math.ceil(d0 * 0.3), 'Tagesschwankung bleibt klein');
}

// ---------- Kaufen und Verkaufen ----------
{
  const s = fresh(100);
  const p = T.buyPrice('dublone', 'salt');
  assert(T.buy('dublone', 'salt') === p && s.cargo.salt === 1 && s.amber === 100 - p, 'Salz gekauft');
  assert(T.buyPrice('dublone', 'salt') >= p, 'Nächste Kiste nicht billiger');
  const sp = T.sellPrice('dublone', 'salt');
  assert(T.sell('dublone', 'salt') === sp && !s.cargo.salt, 'Wieder verkauft');
  assert(!T.sell('dublone', 'salt'), 'Nichts zu verkaufen');
  s.amber = 0;
  assert(!T.buy('dublone', 'fish') && T.whyNotBuy('dublone', 'fish') === 'Zu wenig Bernstein', 'Ohne Bernstein kein Kauf');
  s.amber = 10000;
  s.cargo = { fish: S.stats().hold };
  assert(!T.buy('dublone', 'salt') && T.whyNotBuy('dublone', 'salt') === 'Laderaum voll', 'Laderaum voll');
}

// ---------- Keine Endlos-Gewinne an einem Ort ----------
{
  ['dublone', 'amberbay', 'smuggler'].forEach(h => T.GOODS.forEach(g => {
    const s = fresh(5000);
    for (let i = 0; i < 12; i++) T.buy(h, g.id);
    for (let i = 0; i < 12; i++) T.sell(h, g.id);
    assert(s.amber < 5000, `${h}/${g.id}: Kaufen und gleich verkaufen bringt Verlust (${s.amber})`);
  }));
  // Viel verkaufen drückt den Preis, mit der Zeit erholt sich der Markt
  const s = fresh();
  s.cargo = { rum: 12 };
  const first = T.sellPrice('dublone', 'rum');
  for (let i = 0; i < 12; i++) T.sell('dublone', 'rum');
  const after = T.sellPrice('dublone', 'rum');
  assert(after < first, `Verkaufen drückt den Preis (${first} → ${after})`);
  s.seaTime += 12 * 30 + 1;
  // gleicher Tag wäre nötig für exakten Vergleich – der Druck muss jedenfalls weg sein
  assert((T.market('dublone').p.rum || 0) === 0, 'Der Markt erholt sich auf See');
}

// ---------- Proviant ----------
{
  const s = fresh(100);
  s.food = 2.5;
  const price = T.foodPrice('dublone');
  assert(T.buyFood('dublone', 1) === 1 && s.food === 3.5 && s.amber === 100 - price, 'Ein Fass gekauft');
  const max = S.stats().food;
  T.buyFood('dublone', 99);
  assert(s.food === max, 'Auffüllen bis voll');
  assert(T.buyFood('dublone', 1) === 0, 'Voll: nichts mehr');
  s.food = 0; s.amber = 0;
  assert(T.buyFood('dublone', 3) === 0 && s.food === 0, 'Ohne Bernstein kein Proviant');
}

// ---------- Werft ----------
{
  const s = fresh(2000);
  s.ship = { type: 'sloop', sails: 0, hold: 0, pantry: 0, cannons: 0 };
  const sp = S.stats().speed;
  assert(S.buyUpgrade('sails') && S.stats().speed > sp && s.amber === 2000 - 60, 'Segel ausgebaut: schneller');
  assert(S.buyUpgrade('hold') && S.stats().hold === 11, 'Laderaum +3');
  assert(S.buyUpgrade('pantry') && S.buyUpgrade('pantry') && !S.buyUpgrade('pantry') && S.stats().food === 10, 'Vorratskammer bis Stufe 2');
  assert(S.buyCannon() && S.buyCannon() && !S.buyCannon(), 'Schaluppe: 2 Kanonen');
  // Neues Schiff: altes in Zahlung
  const price = S.tradeInPrice('brig');
  assert(price === 380 - 60, `Brigg kostet abzüglich der halben Schaluppe (${price})`);
  s.cargo = { fish: 11 };
  s.food = 10;
  assert(S.buyShip('brig') && s.ship.type === 'brig' && s.ship.sails === 0 && s.ship.cannons === 2, 'Brigg gekauft, Ausbau weg, Kanonen bleiben');
  assert(s.food === 8, 'Proviant passt in die neue Vorratskammer');
  assert(S.whyNot('galleon') === 'Nicht zu kaufen' && S.whyNot('ghost') === 'Nicht zu kaufen', 'Galeone und Geisterschiff gibt es nicht in der Werft');
  s.cargo = { fish: 13 };
  s.amber = 99999;
  assert(S.whyNot('sloop') === 'Zu viel Ladung an Bord', 'Kleineres Schiff: Ladung muss passen');
}
