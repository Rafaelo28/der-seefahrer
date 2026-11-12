// Tests für Kapitel 4 „Der Auftraggeber“ und Kapitel 5 „Die Bernsteinfestung“: weiter nach dem ersten Ende,
// Long John im Kerker, Kuriere entern, Briefe, Codebuch am Riff, Festung, Flaggschiff des Barons, zweites Ende.
const { assert, load } = require('./setup');
load('format', 'state', 'meta', 'rank', 'figure', 'gk-import', 'ships', 'world', 'trade', 'voyage', 'battle', 'pirates', 'crew', 'boarding', 'island');
SF.ui = { dialog: () => Promise.resolve(true), toast() {}, tip() {}, KLABAUTER: '<svg></svg>' };
SF.sound = { play() {} };
SF.track = () => {};
global.setTimeout = fn => fn();
load('story', 'chapter', 'finale');
const C = SF.chapter;
let played = null;
let credits = 0;
SF.story.play = (scenes, done) => { played = scenes; done(); };
SF.finale.credits = () => { credits++; };

SF.state = SF.createDefaultState();
SF.state.started = true;
SF.state.captain.name = 'Test';
SF.voyage.ensurePos();
const step = () => SF.story.step();
const P = SF.world.placeById;

// ---------- Nach dem ersten Ende geht es weiter ----------
{
  SF.state.story.step = 'finale';
  assert(!SF.story.reached('done') && SF.story.reached('traitor'), 'Reihenfolge der Schritte: Finale liegt nach dem Verräter, vor dem Ende');
  SF.state.story.step = 'done';
  assert(C.news() === null, 'Ohne Umstellung noch keine Post');
  C.migrate();
  assert(step() === 'jail' && SF.story.goal() === 'dublone' && SF.story.reached('done'), 'Durchgespielter Spielstand: weiter mit Kapitel 4 (Ziel Port Dublone)');
  const n = C.news();
  assert(n && n.html.includes('Hafenkerker') && C.news() === null, 'Post aus Port Dublone erscheint genau einmal');
  assert(SF.finale.SECRETS.find(x => x.id === 'dublone').check(), 'Geheimnis „Goldene Dublone“ bleibt erfüllt');
  C.migrate();
  assert(step() === 'jail', 'Noch einmal umstellen ändert nichts');
}

// ---------- Long John im Kerker ----------
{
  let t = C.tavern('dublone');
  assert(t[0].who === 'longjohn' && t[0].action.id === 'lj-rum' && t[0].action.disabled, 'Long John will 2 Kisten Rum (noch keine an Bord)');
  assert(C.act('dublone', 'lj-rum') === '' && step() === 'jail', 'Ohne Rum redet er nicht');
  SF.state.cargo.rum = 3;
  t = C.tavern('dublone');
  assert(!t[0].action.disabled, 'Mit Rum: Knopf frei');
  C.act('dublone', 'lj-rum');
  assert(step() === 'couriers' && SF.state.cargo.rum === 1 && C.letters() === 0, 'Rum gegeben: Long John packt aus, Kuriere suchen');
  assert(SF.story.goalText().includes('0 von 3'), 'Ziel zeigt die Zahl der Briefe');
}

// ---------- Kuriere: nur in diesem Schritt, Briefe nur beim Entern ----------
{
  SF.state.pos = { x: P.dublone.x, y: P.dublone.y };
  SF.state.seaTime = 1000;
  SF.pirates.refill();
  SF.state.seaTime += 30;
  SF.pirates.refill();
  const cs = SF.pirates.list().filter(p => p.kind === 'courier');
  assert(cs.length >= 1 && cs.length <= 2 && cs.every(p => SF.world.isWater(p.x, p.y)), `Kuriere kreuzen auf der See (${cs.length})`);
  const e = SF.pirates.enemyFor(cs[0]);
  assert(e.type === 'brig' && !e.noSink, 'Kurier: eine Brigg, die sinken kann');
  // versenkt: kein Brief
  let out = SF.pirates.resolve(cs[0], 'sunk', 80);
  assert(C.onBattle(cs[0], 'sunk').includes('entern') && C.letters() === 0 && out.amber === 25, 'Versenkt: halbes Kopfgeld, aber kein Brief');
  // geentert: Briefe
  for (let i = 1; i <= 3; i++) {
    const c = { kind: 'courier', zone: 'couriers', name: 'Kurier' };
    SF.pirates.resolve(c, 'boarded', 80, { amber: 6, chests: 1 });
    const html = C.onBattle(c, 'boarded');
    assert(html.includes(`${i} von 3`) && C.letters() === i, `Brief ${i} erbeutet`);
  }
  assert(step() === 'decode' && SF.story.goal() === 'smuggler', 'Drei Briefe: weiter zu Einauge Ede');
  assert(C.onBattle({ kind: 'courier' }, 'boarded') === '', 'Danach zählen Kuriere nicht mehr');
  SF.pirates.refill();
  assert(!SF.pirates.list().some(p => p.kind === 'courier'), 'Die Kuriere ziehen ab, wenn die Briefe da sind');
  assert(C.onBattle({ kind: 'raider' }, 'boarded') === '', 'Andere Piraten haben keine Briefe');
}

// ---------- Geheimschrift, Codebuch am Riff ----------
{
  const t = C.tavern('smuggler');
  assert(t.some(x => x.who === 'ede' && x.action && x.action.id === 'ede-code'), 'Ede erkennt die Geheimschrift');
  C.act('smuggler', 'ede-code');
  assert(step() === 'codebook' && SF.story.goal() === 'reef', 'Neues Ziel: Korallenriff');
  assert(C.onDive('reef', false).includes('noch einmal') && step() === 'codebook', 'Ohne Luft aufgetaucht: kein Codebuch');
  assert(C.onDive('wrack', true) === '', 'Nur am Korallenriff');
  const html = C.onDive('reef', true);
  assert(html.includes('Codebuch') && step() === 'find-fort' && SF.story.goal() === 'fort', 'Heil aufgetaucht: Codebuch, Ziel Bernsteinfestung');
  assert(C.onDive('reef', true) === '', 'Danach ist Tauchen wieder normal');
}

// ---------- Bernsteinfestung ----------
{
  const f = P.fort;
  assert(f && SF.world.isWater(f.x, f.y) && SF.island.LEVELS.fort, 'Die Festung ist ein Ort am Wasser mit einer Insel zum An-Land-Gehen');
  assert(SF.world.route(P.dublone.x, P.dublone.y, f.x, f.y).length > 0, 'Von Port Dublone gibt es einen Weg zur Festung');
  assert(!C.baronReady(), 'Vor der Festung wartet noch niemand');
  const a0 = SF.state.amber;
  const html = C.onIsland('fort');
  assert(html.includes('Schatzkammer') && step() === 'baron' && SF.state.amber === a0 + 150, 'Festung geschafft: Schatzkammer, der Baron flieht');
  SF.state.pos = { x: f.x + 50, y: f.y };
  assert(C.baronReady(), 'Zurück auf See: das Flaggschiff läuft aus');
  const ship = C.baronShip();
  const e = SF.pirates.enemyFor(ship);
  assert(e.type === 'galleon' && e.noSink && e.hp === 280, 'Die „Goldene Gier“: eine Galeone, die nicht sinkt');
  const b = SF.battle.create({ type: 'frigate', hp: 130, maxHp: 130, cannons: 6, speed: 68 }, e, null, 3);
  b.enemy.hp = 5;
  b.balls.push({ from: 'player', x: b.enemy.x, y: b.enemy.y, vx: 0, vy: 0, life: 1 });
  SF.battle.step(b, 1 / 60, {});
  assert(!b.over && b.enemy.hp >= 1 && SF.battle.canBoard(b) === (SF.battle.distance(b) <= SF.battle.BOARD_DIST), 'Sie sinkt nicht – man muss entern');
  // verloren oder geflohen: erst wieder, wenn man weit weg war
  C.afterBaron('lost');
  assert(!C.baronReady(), 'Nach einer Niederlage wartet der Baron nicht sofort wieder');
  SF.state.pos = { x: f.x + 900, y: f.y };
  C.baronReady();
  SF.state.pos = { x: f.x + 50, y: f.y };
  assert(C.baronReady(), 'Weit weg gewesen: neuer Versuch');
  SF.state.docked = 'dublone';
  assert(!C.baronReady(), 'Im Hafen passiert nichts');
  SF.state.docked = '';
  // Beim Entern verloren (zurückgeschlagen): man bleibt vor der Festung und bekommt trotzdem einen neuen Versuch
  C.afterBaron('repelled');
  assert(!C.baronReady() && C.baronWaiting(), 'Zurückgeschlagen: die Goldene Gier wartet im Festungshafen');
  assert(SF.story.goal() === 'fort' && SF.story.goalText().includes('herausfordern'), 'Die Anzeige sagt, wie es weitergeht');
  assert(C.onBattle(ship, 'repelled').includes('herausfordern') && C.onBattle(ship, 'boarded') === '', 'Hinweis nach dem Kampf');
  SF.state.pos = { x: f.x + 30, y: f.y };
  assert(C.challengeBaron() && !C.baronWaiting() && C.baronReady(), 'Vor der Festung herausgefordert: neuer Versuch');
  C.afterBaron('repelled');
  SF.state.pos = { x: f.x + C.BARON_LEAVE + 10, y: f.y };
  C.baronReady();
  SF.state.pos = { x: f.x + 50, y: f.y };
  assert(C.baronReady(), 'Ein Stück weg und wieder heran: auch ein neuer Versuch');
  assert(C.BARON_LEAVE > C.BARON_RANGE + 50, 'Nicht sofort wieder (erst ein Stück wegsegeln)');
}

// ---------- Deck des Barons, zweites Ende ----------
{
  const L = SF.boarding.create('baron', 3);
  const boss = L.enemies.find(x => x.boss);
  assert(boss && boss.baron && boss.lives === 3 && boss.throws && L.locked && L.roller, 'Der Baron bewacht die Kajüte: drei Treffer, wirft Flaschen, Fässer rollen');
  const K = SF.boarding.create('courier', 3);
  assert(!K.locked && K.sections.length === 5, 'Kurier: fünf Abschnitte, kein Kapitän');
  SF.pirates.resolve(C.baronShip(), 'boarded', 60, { amber: 30, chests: 2 });
  C.afterBaron('boarded');
  C.ending2();
  assert(step() === 'done2' && played && played.length === 4 && credits === 1, 'Baron besiegt: zweites Ende mit Bildergeschichte und Abspann');
  assert(SF.meta.get('finished2') === true && SF.story.goalText() === '' && !C.baronReady(), 'Danach freies Segeln');
  assert(SF.story.reached('done') && SF.finale.SECRETS.find(x => x.id === 'dublone').check(), 'Erstes Ende zählt weiter');
  const t = C.tavern('dublone');
  assert(t[0].who === 'longjohn' && t[0].text.includes('Zelle nebenan'), 'Long John hat jetzt einen Nachbarn');
  C.migrate();
  assert(step() === 'winter' && C.news().title.includes('Eis'), 'Nach dem zweiten Ende geht es mit Kapitel 6 weiter (das Eis kommt)');
}

// ---------- Alte Spielstände mitten im Spiel bleiben, wo sie sind ----------
{
  SF.state = SF.createDefaultState();
  SF.state.story.step = 'find-ice';
  C.migrate();
  assert(SF.story.step() === 'find-ice' && C.news() === null, 'Spielstand mitten in Kapitel 2 bleibt unverändert');
  SF.pirates.refill();
  assert(!SF.pirates.list().some(p => p.kind === 'courier'), 'Vor Kapitel 4 gibt es keine Kuriere');
  assert(C.onIsland('fort').includes('Tor'), 'Festung zu früh besucht: verschlossenes Tor, die Story bleibt');
  assert(SF.story.step() === 'find-ice', 'Schritt unverändert');
}
