// Tests für Freunde: Rangliste aus Duellen (Rekorde austauschen, prüfen, sortieren) und Flaschenpost
// (Bernstein und Perlen verschicken, Grenzen, nur einmal öffnen, kaputte Codes).
const { assert, load } = require('./setup');
load('format', 'state', 'rank', 'figure', 'ships', 'world', 'trade', 'crew', 'island');
SF.ui = { toast() {}, dialog: () => Promise.resolve(true) };
SF.sound = { play() {} };
SF.track = () => {};
load('story', 'chapter', 'meta', 'finale', 'friends');
const Fr = SF.friends;

SF.state = SF.createDefaultState();
SF.state.captain = { name: 'Anna', fig: '3.0.0.0.1.4.4' };
SF.state.islands = { bay: { best: 41.2, wins: 1 } };
SF.state.stats.duelWins = 2;

// ---------- Rangliste ----------
{
  const me = Fr.myRecord();
  assert(me.name === 'Anna' && me.wins === 2 && me.best.bay === 41.2 && !me.best.ice, 'Eigene Rekorde');
  const bad = Fr.cleanRecord({ name: '<script>x</script>', wins: -5, best: { bay: 'schnell', ice: 0.1, dragon: 77.77 }, secrets: 500, fig: 'x' });
  assert(!/[<>]/.test(bad.name) && bad.wins === 0 && !bad.best.bay && !bad.best.ice && bad.best.dragon === 77.8 && bad.secrets === 100, 'Rekorde vom Freund werden geprüft');
  Fr.remember({ name: 'Ben', wins: 5, secrets: 30, best: { bay: 38 } }, 'lost');
  Fr.remember({ name: 'ben', wins: 6, secrets: 30 }, 'won');
  const ben = Fr.list().ben;
  assert(ben.wins === 6 && ben.vsWon === 1 && ben.vsLost === 1, 'Gleicher Freund (Groß/klein egal): Rekord aktualisiert, Duelle gegen ihn gezählt');
  Fr.remember({ name: 'Carla', wins: 0, secrets: 90 }, '');
  const board = Fr.board();
  assert(board[0].name === 'ben' || board[0].name === 'Ben', 'Rangliste: meiste Siege oben');
  assert(board.some(r => r.me && r.name === 'Anna') && board.length === 3, 'Ich stehe auch in der Rangliste');
  for (let i = 0; i < 30; i++) Fr.remember({ name: 'Freund' + i, wins: 0 }, '');
  assert(Object.keys(Fr.list()).length === 20, 'Höchstens 20 Freunde gemerkt');
}

// ---------- Flaschenpost ----------
{
  SF.state.amber = 300;
  SF.state.pearls = 5;
  assert(Fr.write(500, 0, '').error, 'Zu viel Bernstein pro Flasche');
  assert(Fr.write(0, 0, '   ').error, 'Leere Flasche geht nicht');
  assert(Fr.write(0, 9, 'x').error && SF.state.pearls === 5, 'So viele Perlen hast du nicht');
  const r = Fr.write(120, 3, 'Ahoi <b>Ben</b>!');
  assert(r.code && r.code.startsWith('FP') && SF.state.amber === 180 && SF.state.pearls === 2, 'Flasche verschlossen: Bernstein und Perlen abgegeben');
  // Ben öffnet sie (anderer Spielstand)
  SF.state = SF.createDefaultState();
  SF.state.amber = 10;
  const o = Fr.open(r.code.slice(0, 30) + '\n' + r.code.slice(30));
  assert(o.ok && o.from === 'Anna' && o.amber === 120 && o.pearls === 3 && SF.state.amber === 130 && SF.state.pearls === 3, 'Flasche geöffnet (auch mit Zeilenumbruch)');
  assert(!/[<>]/.test(o.text) && o.text.includes('Ahoi'), 'Nachricht ohne HTML');
  assert(Fr.open(r.code).error && SF.state.amber === 130, 'Nur einmal öffnen');
  assert(Fr.open('FPquatsch').error && Fr.open('').error && Fr.open(SF.toCode({ money: 5 })).error, 'Kaputte Codes');
  // Verändert (z. B. mehr Bernstein eingetragen): Prüfsumme passt nicht
  const data = SF.fromCode(r.code.slice(2));
  data.amber = 200;
  data.id = 'anders';
  assert(Fr.open('FP' + SF.toCode(data)).error, 'Veränderte Flasche fällt auf');
  const old = { game: 'der-seefahrer', amber: 5, started: true };
  SF.applyData(old);
  assert(typeof SF.state.friends === 'object' && Array.isArray(SF.state.bottles.opened || []), 'Alte Spielstände: Standardwerte');
}
