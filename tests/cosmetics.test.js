// Tests für Cosmetics: nur mit Perlen, Kaufen legt an, Anlegen nur, was man hat, alte Spielstände, Farben beim Zeichnen.
const { assert, load } = require('./setup');
load('format', 'state', 'ships', 'cosmetics');
const C = SF.cosmetics;
SF.state = SF.createDefaultState();

assert(C.SLOTS.every(sl => C.ITEMS.filter(x => x.slot === sl.id && !x.price).length === 1), 'Jeder Platz hat genau eine kostenlose Sorte');
assert(C.ITEMS.every(x => x.price >= 0 && x.price <= 30), 'Preise bleiben klein');
assert(new Set(C.ITEMS.map(x => x.id)).size === C.ITEMS.length, 'Eindeutige IDs');
assert(Object.keys(C.shipColors()).length === 0, 'Am Anfang: Farben des Schiffstyps');
assert(!C.buy('sail-gold') && !C.owns('sail-gold'), 'Ohne Perlen nichts kaufen');
assert(!C.equip('sail-red'), 'Nicht Gekauftes kann man nicht anlegen');
SF.state.pearls = 20;
assert(C.buy('sail-red') && SF.state.pearls === 14 && C.data().on.sail === 'sail-red', 'Gekauft und angelegt');
assert(!C.buy('sail-red') && SF.state.pearls === 14, 'Nicht zweimal kaufen');
assert(C.equip('sail-white') && C.data().on.sail === 'sail-white' && C.equip('sail-red'), 'Umziehen zwischen eigenen Sorten');
SF.state.pearls += 20;
assert(C.buy('head-pork'), 'Galionsfigur John Pork gekauft');
assert(C.shipColors().sail === '#c0392b' && C.shipColors().head === '🐷', 'Farben und Galionsfigur beim Zeichnen');
assert(SF.ships.sideSVG('brig', C.shipColors()).includes('🐷') && SF.ships.sideSVG('brig').indexOf('🐷') < 0, 'Seitenansicht mit und ohne Cosmetics');
// Alter Spielstand ohne Cosmetics, kaputte Werte
SF.state.cosmetics = { owned: 'x', on: { sail: 'gibt-es-nicht', hull: 'hull-gold' } };
C.data();
assert(Array.isArray(SF.state.cosmetics.owned) && SF.state.cosmetics.on.sail === 'sail-white' && SF.state.cosmetics.on.hull === 'hull-wood', 'Kaputte oder nicht gekaufte Werte → Standard');
