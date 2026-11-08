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
assert(C.shipColors().sail === '#c0392b' && C.shipColors().head === 'pig', 'Farben und Galionsfigur beim Zeichnen');
assert(SF.ships.sideSVG('brig', C.shipColors()).includes('ic-pig') && SF.ships.sideSVG('brig').indexOf('ic-pig') < 0, 'Seitenansicht mit und ohne Cosmetics');
// Alter Spielstand ohne Cosmetics, kaputte Werte
SF.state.cosmetics = { owned: 'x', on: { sail: 'gibt-es-nicht', hull: 'hull-gold' } };
C.data();
assert(Array.isArray(SF.state.cosmetics.owned) && SF.state.cosmetics.on.sail === 'sail-white' && SF.state.cosmetics.on.hull === 'hull-wood', 'Kaputte oder nicht gekaufte Werte → Standard');

// ---------- Symbole statt Emojis ----------
{
  const fs = require('fs');
  const path = require('path');
  const root = path.join(__dirname, '..');
  const files = fs.readdirSync(path.join(root, 'js')).map(f => path.join(root, 'js', f)).concat([path.join(root, 'index.html')]);
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{23E9}-\u{23FA}]/u;
  const found = files.filter(f => emoji.test(fs.readFileSync(f, 'utf8'))).map(f => path.basename(f));
  assert(found.length === 0, `Keine Emojis im Spiel – gezeichnete Symbole aus js/icons.js benutzen (${found.join(', ')})`);
  const used = new Set();
  files.forEach(f => {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/SF\.icon\('([a-z]+)'\)|data-ic="([a-z]+)"|icons\.draw\(ctx, '([a-z]+)'/g)) used.add(m[1] || m[2] || m[3]);
  });
  const missing = [...used].filter(n => !SF.icons.ICONS[n]);
  assert(missing.length === 0, `Alle benutzten Symbole gibt es (${missing.join(', ')})`);
  ['fish', 'salt', 'rum', 'cloth', 'spice'].forEach(n => assert(!!SF.icons.ICONS[n], `Symbol für Ware ${n}`));
  assert(SF.icon('anchor').startsWith('<svg') && SF.icon('gibt-es-nicht') === '', 'SF.icon liefert SVG bzw. nichts');
}
