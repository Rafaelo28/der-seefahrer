// Tests für „Der letzte Tag der Dublone“: Preise, Verdopplung, Plätze, Ausgleich zwischen arm und reich, Ergebnis.
const { assert, load } = require('./setup');
load('format', 'state', 'ships', 'lastday');
const L = SF.lastday;

// ---------- Preise ----------
{
  const s = L.create(1e6);
  const p0 = L.price(s, 'brig', 0);
  assert(L.price(s, 'brig', 5) >= 2 * p0 - 1 && L.price(s, 'brig', 5) <= 2 * p0 + 1, 'Nach 5 Sekunden doppelt so teuer');
  assert(Math.abs(L.price(s, 'brig', 60) / p0 - 4096) < 1, 'Nach 60 Sekunden 4096-mal so teuer');
  assert(L.price(s, 'frigate', 0) > L.price(s, 'brig', 0), 'Fregatte teurer als Brigg');
  const rich = L.create(7e45);
  assert(L.price(rich, 'bread', 0) > 1e39, 'Für Reiche kostet ein Brot eine Sextilliarde und mehr');
  assert(L.create(5).M === L.START_MONEY, 'Mindestens 10.000 Dublonen');
  assert(L.create(Infinity).M === 1e300 && isFinite(L.price(L.create(Infinity), 'frigate', 60)), 'Unendlich wird begrenzt');
  assert(L.create(NaN).M === L.START_MONEY, 'Kaputte Zahl → Erspartes');
  assert(L.headStart(1e4) < 0.05 && L.headStart(1e45) === 0.5 && L.headStart(1e300) === 0.5, 'Vorsprung höchstens 0,5');
}

// ---------- Kaufen und Plätze ----------
{
  const s = L.create(1e6);
  assert(L.room(s, 'cannon') === 2 && L.room(s, 'cloth') === 8 && L.room(s, 'food') === 6, 'Schaluppe: 2 Kanonen, 8 Kisten, 6 Fässer');
  assert(L.buy(s, 'cannon') && L.buy(s, 'cannon') && !L.buy(s, 'cannon'), 'Nur 2 Kanonen auf der Schaluppe');
  assert(L.whyNot(s, 'cannon') === 'Alle Plätze voll', 'Grund: Plätze voll');
  assert(L.buy(s, 'brig') && s.ship === 'brig', 'Brigg gekauft');
  assert(L.room(s, 'cannon') === 2 && L.room(s, 'cloth') === 12, 'Brigg: 4 Kanonen, 12 Kisten');
  assert(L.whyNot(s, 'brig') === 'Gekauft', 'Brigg nur einmal');
  assert(L.buy(s, 'frigate') && s.ship === 'frigate', 'Aufrüsten zur Fregatte geht');
  assert(L.whyNot(s, 'brig') === 'Du hast ein besseres Schiff', 'Danach keine Brigg mehr');
  // Proviant und Brot teilen sich die Vorratskammer
  for (let i = 0; i < 9; i++) L.buy(s, 'food');
  assert(L.room(s, 'food') === 1 && L.room(s, 'bread') === 10, 'Platz für 1 Fass oder 10 Brote');
  for (let i = 0; i < 5; i++) L.buy(s, 'bread');
  assert(L.room(s, 'food') === 0 && L.room(s, 'bread') === 5, 'Halbes Fass Brot: kein ganzes Fass mehr');
  const money = s.money;
  s.t = 59;
  assert(L.whyNot(s, 'frigate') !== '' && !L.buy(s, 'cannon') || s.money < money, 'Spät ist alles teuer');
}

// ---------- Ergebnis ----------
{
  const s = L.create(1e4);
  const r = L.result(s);
  assert(r.ship === 'sloop' && r.food === L.MIN_FOOD && r.amber === L.BASE_AMBER && r.exchange === 0, 'Ohne Einkauf: Schaluppe, 3 Fässer, 30 Bernstein');
  const rich = L.create(1e45);
  const rr = L.result(rich);
  assert(rr.exchange === L.EXCHANGE_MAX && rr.amber === L.BASE_AMBER + L.EXCHANGE_MAX, 'Umtausch höchstens 25 Bernstein');
  const mid = L.create(5e13);
  assert(L.result(mid).exchange === 50 || L.result(mid).exchange === 25, 'Umtausch begrenzt');
  const s2 = L.create(3e12);
  s2.money = 3.5e12;
  assert(L.result(s2).exchange === 3, '3,5 Billionen → 3 Bernstein');
  // Übernehmen in den Spielstand
  SF.state = SF.createDefaultState();
  const s3 = L.create(1e9);
  L.buy(s3, 'brig');
  L.buy(s3, 'cannon');
  for (let i = 0; i < 4; i++) L.buy(s3, 'cloth');
  L.apply(L.result(s3));
  assert(SF.state.ship.type === 'brig' && SF.state.ship.cannons === 1 && SF.state.cargo.cloth === 4, 'Schiff, Kanonen und Tuch übernommen');
  assert(SF.state.food === L.MIN_FOOD && SF.state.amber === L.BASE_AMBER, 'Mindest-Proviant und Notgroschen');
}

// ---------- Ausgleich: arm und reich spielen gleich schnell ----------
// Ein Computer-Spieler tippt alle 0,3 Sekunden und kauft nach einer festen Reihenfolge.
function bot(money, order, tap = 0.3) {
  const s = L.create(money);
  let t = 0;
  for (const id of order) {
    while (t <= L.DURATION) {
      s.t = t;
      t += tap;
      if (!L.buy(s, id)) break;
      if (SF.lastday.ITEMS.find(x => x.id === id).kind === 'ship') break;
    }
  }
  return L.result(s);
}
// Wert in Bernstein (ungefähr): Schiff + Kanonen + Proviant + Tuch
const value = r => SF.ships.byId[r.ship].price + r.cannons * 40 + r.food * 4 + (r.cargo.cloth || 0) * 22 + r.exchange;
{
  const greedy = ['frigate', 'cannon', 'food', 'cloth', 'bread'];
  const poor = bot(1e4, greedy);
  const rich = bot(7e45, greedy);
  assert(poor.ship === 'frigate' && rich.ship === 'frigate', 'Wer sofort zugreift, bekommt die Fregatte');
  assert(value(rich) >= value(poor), `Reiche haben einen Vorsprung (${value(rich)} ≥ ${value(poor)})`);
  assert(value(rich) <= value(poor) * 1.35, `… aber nur einen kleinen (${value(rich)} ≤ 1,35 × ${value(poor)})`);
  const full = r => r.ship === 'frigate' && r.cannons === 6 && r.food >= 10 && r.cargo.cloth === 16;
  assert(!full(poor) && !full(rich), 'Niemand bekommt alles – man muss sich entscheiden');
  const slow = bot(1e4, greedy, 2.5);
  assert(value(slow) < value(poor), 'Langsames Tippen bringt weniger');
  const brig = bot(1e4, ['brig', 'cloth', 'food', 'cannon', 'bread']);
  assert(brig.ship === 'brig' && (brig.cargo.cloth || 0) >= 8, 'Brigg mit vollem Laderaum ist auch drin');
  console.log('  Wert arm:', value(poor), 'reich:', value(rich), 'langsam:', value(slow), 'Brigg-Plan:', value(brig), JSON.stringify(brig));
}
