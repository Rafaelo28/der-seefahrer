// Tests für die Übernahme aus Gamble Klicker: lesen (nie schreiben!), Code, Zusammenfassung, Titel, Trophäen, Figur.
const { assert, load, store, written } = require('./setup');
load('format', 'state', 'rank', 'figure', 'gk-import');
const G = SF.gk;

const save = {
  version: 1, money: 7.3e45, totalEarned: 1e46, allTimeEarned: 2.5e47, buildings: {}, casino: {},
  player: { name: '  Pork   Kapitän\u0007 ', avatar: '🐸', fig: '3.0.0.0.1.4.4', figOn: true },
  boss: { level: 37 }, fleet: { ships: { sloop: 5, brig: 0, ghost: 2 } }, prestige: { points: 7e6, journeys: 12 },
};

// ---------- Nur lesen ----------
{
  assert(G.readLocal() === null, 'Ohne Spielstand: nichts gefunden');
  store['gamble-klicker-save'] = JSON.stringify(save);
  const before = store['gamble-klicker-save'];
  written.length = 0;
  const data = G.readLocal();
  assert(data && data.money === 7.3e45, 'Spielstand aus dem gemeinsamen Speicher gelesen');
  SF.state = SF.createDefaultState();
  SF.state.gk = G.summarize(data, 'auto');
  SF.save();
  assert(!written.includes('gamble-klicker-save') && store['gamble-klicker-save'] === before, 'Gamble-Klicker-Spielstand nie geschrieben');
  store['gamble-klicker-save'] = '{kaputt';
  assert(G.readLocal() === null, 'Kaputter Spielstand wird ignoriert');
  store['gamble-klicker-save'] = JSON.stringify({ game: 'der-seefahrer', amber: 5, money: 3 });
  assert(G.readLocal() === null, 'Eigener Spielstand ist kein Gamble Klicker');
}

// ---------- Code ----------
{
  const code = SF.toCode(save);
  assert(G.readCode(code).player.fig === '3.0.0.0.1.4.4', 'Export-Code aus Gamble Klicker gelesen');
  assert(G.readCode(code.replace(/(.{60})/g, '$1\n')) !== null, 'Code mit Zeilenumbrüchen');
  assert(G.readCode('abc') === null && G.readCode('') === null, 'Kaputter Code: null');
  assert(G.readCode(SF.toCode({ money: 'viel' })) === null, 'Ohne Zahl: kein Spielstand');
}

// ---------- Zusammenfassung ----------
{
  const g = G.summarize(save, 'code');
  assert(g.name === 'Pork Kapitän', `Name bereinigt (${g.name})`);
  assert(g.fig === '3.0.0.0.1.4.4', 'Figur übernommen (John Pork)');
  assert(g.rank === 15 && SF.rank.name(g.rank) === 'Legende III', `Rang aus „insgesamt verdient“ (${g.rank})`);
  assert(SF.rank.title(g.rank) === 'ehem. Legende III', 'Titel: ehemalige Legende');
  assert(SF.rank.title(0) === 'Landratte' && SF.rank.title(12) === 'ehem. Herrscher der Meere', 'Titel für Landratte und Herrscher');
  assert(g.bossLevel === 37 && g.ships.join() === 'sloop,ghost' && g.maps === 7e6 && g.source === 'code', 'Bosse, Schiffe, Schatzkarten');
  const t = G.trophies(37);
  assert(t.kraken === 2 && t.dragon === 1, 'Trophäen: Stufe 10 und 30 Kraken-König, 20 Seedrache');
  assert(G.trophies(0).kraken === 0 && G.trophies(9).kraken === 0 && G.trophies(10).kraken === 1, 'Erste Trophäe bei Stufe 10');
  // Seltsame Spielstände
  const odd = G.summarize({ money: 5, totalEarned: 3e6, player: { fig: '99.1.1.1.1.1.1' }, boss: { level: -3 }, fleet: { ships: [] } });
  assert(odd && odd.fig === '' && odd.bossLevel === 0 && odd.ships.length === 0 && odd.rank === 2 && odd.name === '', 'Ungültige Teile werden ignoriert');
  const inf = G.summarize({ money: 1e300, allTimeEarned: null, casino: {} });
  assert(inf.rank > 12 && isFinite(inf.money), 'Unendlich verdient (null) → sehr hoher Rang');
  assert(G.summarize(null) === null && G.summarize({ money: NaN, casino: {} }) === null, 'Kein Spielstand → null');
}

// ---------- Figur: freie Teile ----------
{
  const g = G.summarize(save);
  // Teil 8 bei „Kopf“ ist der Roboter (in Gamble Klicker erst ab 100.000 Klicks)
  assert(!SF.figure.unlocked(0, 8, null), 'Roboterkopf ohne Gamble Klicker gesperrt');
  assert(SF.figure.unlocked(0, 11, g), 'Geisterkopf ab Rang 10 frei');
  assert(SF.figure.unlocked(0, 12, null) === false && SF.figure.unlocked(0, 12, Object.assign({}, g, { bossLevel: 100 })), 'Krakenkopf ab Boss-Stufe 100');
  const robot = Object.assign({}, g, { fig: '8.0.0.0.0.0.0' });
  assert(SF.figure.unlocked(0, 8, robot), 'Teile aus der eigenen Figur sind frei');
  assert(SF.figure.allowed('8.0.0.0.0.0.0', null) === '0.0.0.0.0.0.0', 'Gesperrte Teile werden ersetzt');
  let code = SF.figure.DEFAULT;
  for (let i = 0; i < 30; i++) {
    code = SF.figure.step(code, 0, 1, null);
    assert(SF.figure.unlocked(0, SF.figure.parse(code)[0], null), 'Blättern überspringt gesperrte Teile');
  }
  assert(SF.figure.svg('3.0.0.0.1.4.4').startsWith('<svg'), 'Figur wird gezeichnet');
}
