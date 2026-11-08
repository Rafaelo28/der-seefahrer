// Tests für den Spielstand: Standardwerte, Speichern/Laden, alte und kaputte Spielstände, Export/Import, Bernstein.
const { assert, load, store } = require('./setup');
load('format', 'state', 'rank', 'figure', 'gk-import');

// ---------- Standardwerte ----------
{
  const s = SF.createDefaultState();
  assert(s.game === 'der-seefahrer' && s.amber === 0 && !s.started, 'Neuer Spielstand: nicht gestartet, kein Bernstein');
  assert(s.ship.type === 'sloop' && s.story.step === 'new', 'Schaluppe und Story am Anfang');
}

// ---------- Bernstein ----------
{
  SF.state = SF.createDefaultState();
  assert(SF.amber.add(10.7) === 10 && SF.state.amber === 10, 'Nur ganze Bernstein');
  assert(SF.amber.add(-5) === 0 && SF.amber.add(NaN) === 0 && SF.state.amber === 10, 'Negative und kaputte Beträge zählen nicht');
  assert(!SF.amber.spend(11) && SF.state.amber === 10, 'Zu wenig: nichts abgebucht');
  assert(SF.amber.spend(4) && SF.state.amber === 6, 'Abbuchen');
  assert(SF.state.stats.amberEarned === 10, 'Statistik: verdienter Bernstein');
}

// ---------- Speichern und Laden ----------
{
  SF.state = SF.createDefaultState();
  SF.state.started = true;
  SF.state.captain.name = 'Ännchen <b>';
  SF.state.amber = 123;
  SF.state.cargo = { fish: 2 };
  assert(SF.save(), 'Speichern klappt');
  SF.state = SF.createDefaultState();
  assert(SF.load() && SF.state.amber === 123 && SF.state.cargo.fish === 2 && SF.state.captain.name === 'Ännchen <b>', 'Laden: alles wieder da');
}

// ---------- Alte Spielstände bekommen Standardwerte ----------
{
  const old = { game: 'der-seefahrer', version: 1, amber: 50, started: true, ship: { type: 'brig' }, story: { step: 'find-amberbay' } };
  store[SF.SAVE_KEY] = JSON.stringify(old);
  assert(SF.load(), 'Alter Spielstand lädt');
  const s = SF.state;
  assert(s.ship.type === 'brig' && s.ship.sails === 0 && s.ship.cannons === 0, 'Schiff mit Standard-Ausbau');
  assert(Array.isArray(s.story.log) && typeof s.story.flags === 'object' && s.story.step === 'find-amberbay', 'Story ergänzt');
  assert(s.stats.distance === 0 && s.settings.sound === true && typeof s.ui.tips === 'object', 'Statistik, Einstellungen, Tipps ergänzt');
  assert(Array.isArray(s.course) && s.pos === null && s.fog === '', 'Kurs, Position und Karte ergänzt');
  // Kaputte Werte
  store[SF.SAVE_KEY] = JSON.stringify(Object.assign({}, old, { cargo: [1, 2], pos: { x: 'a' }, food: -3, amber: 12.6, course: 'x' }));
  assert(SF.load() && !Array.isArray(SF.state.cargo) && SF.state.pos === null && SF.state.food === 0 && SF.state.amber === 12 && Array.isArray(SF.state.course), 'Kaputte Felder repariert');
  store[SF.SAVE_KEY] = '{kaputt';
  const warn = console.warn;
  console.warn = () => {}; // die erwartete Warnung nicht ausgeben
  assert(!SF.load(), 'Kaputter Text: neu anfangen');
  console.warn = warn;
  store[SF.SAVE_KEY] = JSON.stringify({ money: 5, casino: {} });
  assert(!SF.load(), 'Gamble-Klicker-Daten sind kein Seefahrer-Spielstand');
}

// ---------- Export und Import ----------
{
  SF.state = SF.createDefaultState();
  SF.state.started = true;
  SF.state.captain.name = 'Jörg 🐸';
  SF.state.amber = 777;
  const code = SF.exportSave();
  assert(typeof code === 'string' && /^[A-Za-z0-9+/=]+$/.test(code), 'Code ist Base64');
  SF.state = SF.createDefaultState();
  assert(SF.importSave(code) === 'ok' && SF.state.amber === 777 && SF.state.captain.name === 'Jörg 🐸', 'Import mit Umlauten und Emoji');
  assert(SF.importSave(code.slice(0, 40) + '\n' + code.slice(40) + '  ') === 'ok', 'Zeilenumbrüche und Leerzeichen stören nicht');
  assert(SF.importSave('Quatsch!') === 'bad' && SF.state.amber === 777, 'Kaputter Code ändert nichts');
  const gkCode = SF.toCode({ money: 1e40, allTimeEarned: 1e41, casino: {} });
  assert(SF.importSave(gkCode) === 'gk', 'Gamble-Klicker-Code wird erkannt');
}
