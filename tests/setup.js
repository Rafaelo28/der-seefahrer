// Gemeinsame Vorbereitung für die Tests mit node: ein kleiner Ersatz für Browser-Dinge und die Spieldateien laden.
// Benutzung: const { SF, assert, load } = require('./setup'); load('format', 'state', …);
global.window = global;
global.document = {
  addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  getElementById() { return null; }, visibilityState: 'visible',
};
global.location = { search: '', pathname: '/', origin: '', hash: '', protocol: 'file:', hostname: '' };
global.history = { replaceState() {} };
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};

// localStorage als einfache Tabelle; schreibt mit, welche Schlüssel geschrieben wurden
const store = {};
const written = [];
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); written.push(k); },
  removeItem: k => { delete store[k]; written.push(k); },
};

const path = require('path');
const R = path.join(__dirname, '..', 'js') + '/';
const load = (...names) => names.forEach(n => require(R + n + '.js'));
// Symbole braucht fast jede Anzeige: immer mitladen
require(R + 'icons.js');

let failed = 0;
let passed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log('FEHLER:', msg);
    process.exitCode = 1;
  }
}
process.on('exit', () => {
  console.log(`${path.basename(process.argv[1])}: ${passed} bestanden${failed ? `, ${failed} FEHLGESCHLAGEN` : ''}`);
});

module.exports = { assert, load, store, written, get SF() { return global.SF; } };
