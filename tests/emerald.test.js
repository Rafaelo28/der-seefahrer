// Tests für Kapitel 6 „Der lange Winter“ und Kapitel 7 „Die Smaragdsee“: weiter nach dem zweiten Ende, Vorräte für
// die Flotte, Auszug durch das Sturmtor auf eine zweite Karte (Inseln, Orte, Nebel, Piraten, Märkte je Karte),
// Neu-Dublone, Quelleninsel, Krakenkönig (nicht zu entern), drittes Ende, danach freie Fahrt zwischen beiden Seen.
const { assert, load } = require('./setup');
load('format', 'state', 'meta', 'rank', 'figure', 'gk-import', 'ships', 'world', 'trade', 'voyage', 'battle', 'pirates', 'crew', 'boarding', 'island');
SF.ui = { dialog: () => Promise.resolve(true), toast() {}, tip() {}, KLABAUTER: '<svg></svg>' };
SF.sound = { play() {} };
SF.track = () => {};
global.setTimeout = fn => fn();
load('story', 'chapter', 'finale');
const C = SF.chapter;
const W = SF.world;
let played = null;
let credits = 0;
SF.story.play = (scenes, done) => { played = scenes; done(); };
SF.finale.credits = () => { credits++; };

SF.state = SF.createDefaultState();
SF.state.started = true;
SF.state.captain.name = 'Test';
SF.voyage.ensurePos();
const step = () => SF.story.step();
const P = W.placeById;

// ---------- Die zweite Karte ----------
{
  assert(W.map() === 'old' && W.START.id === 'dublone' && W.PLACES.every(p => p.map === 'old'), 'Am Anfang ist die Alte See aktiv');
  const em = W.placesOf('emerald');
  assert(em.length === 6 && em.every(p => p.map === 'emerald' && P[p.id] === p), 'Sechs Orte in der Smaragdsee, über placeById erreichbar');
  assert(P.stormgate.gate === 'emerald' && P.northgate.gate === 'old', 'Die Sturmtore verbinden die beiden Karten');
  W.use('emerald');
  assert(W.map() === 'emerald' && W.START.id === 'haven' && W.PLACES.length === 6 && W.ISLANDS.some(i => i.id === 'haven') && !W.ISLANDS.some(i => i.id === 'dublone'), 'Karte gewechselt: Inseln, Orte und Heimathafen der Smaragdsee');
  em.forEach(p => {
    assert(W.isWater(p.x, p.y), `${p.name} liegt im Wasser`);
    assert(p.id === 'northgate' || W.route(P.northgate.x, P.northgate.y + 80, p.x, p.y).length > 0, `${p.name} ist vom Sturmtor aus erreichbar`);
  });
  assert(!W.use('emerald') && !W.use('gibtsnicht'), 'Gleiche oder unbekannte Karte: kein Wechsel');
  W.use('old');
  assert(W.PLACES.length === 12 && W.ISLANDS.some(i => i.id === 'dublone'), 'Zurück: die Alte See ist unverändert');
  assert(SF.trade.MARKETS.haven && SF.trade.MARKETS.pearlport, 'Märkte für die neuen Häfen');
  const b = SF.trade.best('fish');
  assert(P[b.cheap.h].map === 'old' && P[b.dear.h].map === 'old', 'Gerüchte nennen nur Häfen der Karte, auf der man segelt');
}

// ---------- Kapitel 6: der lange Winter ----------
{
  SF.state.story.step = 'done2';
  C.migrate();
  assert(step() === 'winter' && SF.story.goal() === 'dublone', 'Nach dem zweiten Ende: Kapitel 6 beginnt');
  const n = C.news();
  assert(n && n.title.includes('Eis') && C.news() === null, 'Die Nachricht vom Eis erscheint genau einmal');
  assert(!C.gateOpen(P.stormgate), 'Das Sturmtor ist noch zu');
  let t = C.tavern('dublone');
  assert(t[0].who === 'hinnerk' && t[0].action.id === 'exodus-plan', 'Hinnerk hat einen Plan');
  assert(t.some(x => x.who === 'longjohn' && x.text.includes('Zelle nebenan')), 'Long John sitzt weiter im Kerker');
  C.act('dublone', 'exodus-plan');
  assert(step() === 'supplies' && SF.story.goalText().includes('Fisch 0 von 6'), 'Vorräte sammeln: 6 Fisch, 4 Tuch');
  t = C.tavern('dublone');
  assert(t[0].action.id === 'give-supplies' && t[0].action.disabled, 'Ohne Ladung nichts abzugeben');
  SF.state.cargo = { fish: 4, cloth: 6, rum: 2 };
  const msg = C.act('dublone', 'give-supplies');
  assert(msg.includes('8 Kisten') && C.supplies().fish === 4 && C.supplies().cloth === 4 && SF.state.cargo.cloth === 2 && !SF.state.cargo.fish && SF.state.cargo.rum === 2, 'Abgeben: nur was gebraucht wird, der Rest bleibt an Bord');
  assert(step() === 'supplies' && C.act('dublone', 'give-supplies') === '', 'Noch nicht alles da');
  SF.state.cargo.fish = 5;
  const a0 = SF.state.amber;
  C.act('dublone', 'give-supplies');
  assert(step() === 'exodus' && SF.state.cargo.fish === 3 && SF.state.amber === a0 + 120 && SF.story.goal() === 'stormgate', 'Alles da: die Flotte ist bereit, Ziel Sturmtor');
  assert(C.gateOpen(P.stormgate) && !C.gateOpen(P.northgate) && !C.gateOpen(P.dublone), 'Jetzt ist das Sturmtor offen (nur hin)');
}

// ---------- Durch das Sturmtor ----------
{
  const s = SF.state;
  s.pos = { x: P.stormgate.x, y: P.stormgate.y - 60 };
  W.reveal(s.pos.x, s.pos.y);
  s.fog = W.fogToString();
  const oldFog = s.fog;
  s.amber = 500; s.pearls = 7;
  s.pirates = [{ id: 'x', kind: 'raider', zone: 'reef', x: 1, y: 1 }];
  let back = 0;
  assert(C.passGate(P.stormgate, () => { back++; }), 'Durch das Sturmtor gesegelt');
  assert(W.map() === 'emerald' && s.map === 'emerald' && step() === 'landfall' && back === 1 && played.length === 3, 'Neue Karte, Bildergeschichte, Kapitel 7 beginnt');
  assert(Math.abs(s.pos.x - P.northgate.x) < 1 && s.pos.y > P.northgate.y && W.isWater(s.pos.x, s.pos.y), 'Ankunft am Sturmtor der Smaragdsee');
  assert(s.fogs.old === oldFog && s.fog !== oldFog && W.knownAt(s.pos.x, s.pos.y) && !W.knownAt(P.pearlport.x, P.pearlport.y), 'Nebel der Alten See gemerkt, die neue Karte ist noch unentdeckt');
  assert(s.amber === 500 && s.pearls === 7 && s.cargo.fish === 3 && s.pirates.length === 0, 'Bernstein, Perlen und Ladung kommen mit, die alten Piraten bleiben zurück');
  assert(!C.gateOpen(P.northgate), 'Kein schneller Weg zurück');
  // Spielstand speichern und laden: die Karte bleibt
  const code = SF.toCode ? SF.toCode(s) : null;
  const copy = JSON.parse(JSON.stringify(s));
  W.use('old');
  SF.state = SF.createDefaultState();
  SF.applyData(copy);
  SF.voyage.ensurePos();
  assert(SF.state.map === 'emerald' && W.map() === 'emerald' && W.knownAt(SF.state.pos.x, SF.state.pos.y), 'Geladener Spielstand: richtige Karte, Nebel passt');
  void code;
  // Piraten der Smaragdsee
  SF.state.seaTime = 5000;
  SF.pirates.refill();
  SF.state.seaTime += 30;
  SF.pirates.refill();
  const list = SF.pirates.list();
  assert(list.length > 0 && list.every(p => ['emerald-east', 'emerald-south'].includes(p.zone) && W.isWater(p.x, p.y)), `Piraten nur in den Gebieten der Smaragdsee (${list.length})`);
  assert(list.every(p => Math.hypot(p.x - P.haven.x, p.y - P.haven.y) > 600), 'Rund um Neu-Dublone ist es sicher');
  assert(SF.finale.SECRETS.find(x => x.id === 'places').check() === false && !SF.finale.compassCrazy() && !SF.finale.ready() && !C.baronReady(), 'Orte der Alten See lösen hier nichts aus');
}

// ---------- Kapitel 7: Neu-Dublone, Quelle, Krakenkönig ----------
{
  const s = SF.state;
  assert(SF.story.goal() === 'haven' && C.onArrive('pearlport') === null, 'Ziel: die Bucht im Süden');
  const a = C.onArrive('haven');
  assert(a && a.title.includes('Neu-Dublone') && step() === 'water' && C.onArrive('haven') === null, 'Neu-Dublone gegründet (einmal), Ziel Quelleninsel');
  assert(C.tavern('haven').some(x => x.who === 'hinnerk' && x.text.includes('Quelleninsel')) && C.tavern('pearlport').some(x => x.who === 'mira'), 'Leute in den neuen Kneipen');
  assert(SF.island.LEVELS.spring && !C.krakenReady(), 'Die Quelleninsel ist eine Insel zum An-Land-Gehen');
  const a0 = s.amber;
  const html = C.onIsland('spring');
  assert(html.includes('Quelle') && step() === 'kraken' && s.amber === a0 + 80 && SF.story.goal() === 'krakenlair', 'Quelle gefunden: jetzt der Krakenkönig');
  s.pos = { x: P.krakenlair.x + 60, y: P.krakenlair.y };
  assert(C.krakenReady(), 'Am Krakengrund taucht er auf');
  const e = SF.pirates.enemyFor(C.krakenShip());
  assert(e.skin === 'kraken' && e.hp === 320 && !e.noSink, 'Krakenkönig: kein Schiff, kann versenkt werden');
  const b = SF.battle.create({ type: 'frigate', hp: 130, maxHp: 130, cannons: 6, speed: 68 }, e, null, 3);
  b.enemy.hp = 20; b.enemy.x = b.player.x + 80; b.enemy.y = b.player.y;
  assert(!SF.battle.canBoard(b), 'Entern geht nicht – er hat kein Deck');
  b.enemy.hp = 4;
  b.balls.push({ from: 'player', x: b.enemy.x, y: b.enemy.y, vx: 0, vy: 0, life: 1 });
  SF.battle.step(b, 1 / 60, {});
  assert(b.over === 'sunk', 'Aber versenken');
  C.afterKraken('lost');
  assert(!C.krakenReady(), 'Nach einer Niederlage nicht sofort wieder');
  s.pos = { x: P.krakenlair.x + 700, y: P.krakenlair.y };
  C.krakenReady();
  s.pos = { x: P.krakenlair.x + 60, y: P.krakenlair.y };
  assert(C.krakenReady(), 'Ein Stück weg gewesen: neuer Versuch');
  const out = SF.pirates.resolve(C.krakenShip(), 'sunk', 70);
  C.afterKraken('sunk');
  credits = 0;
  C.ending3();
  assert(out.amber === 300 && step() === 'done3' && played.length === 4 && credits === 1 && SF.meta.get('finished3') === true, 'Krakenkönig versenkt: Belohnung, drittes Ende, Abspann');
  assert(SF.story.goalText() === '' && !C.krakenReady() && SF.story.reached('done') && SF.story.reached('done2'), 'Danach freies Segeln');
  C.migrate();
  assert(step() === 'done3' && C.news() === null, 'Ganz durchgespielt bleibt ganz durchgespielt');
}

// ---------- Danach: das Sturmtor ist in beide Richtungen offen ----------
{
  const s = SF.state;
  assert(C.gateOpen(P.northgate) && C.gateOpen(P.stormgate), 'Beide Tore offen');
  W.reveal(P.pearlport.x, P.pearlport.y);
  s.fog = W.fogToString();
  let back = 0;
  played = null;
  C.passGate(P.northgate, () => { back++; });
  assert(W.map() === 'old' && s.map === 'old' && back === 1 && played === null && step() === 'done3', 'Zurück in die Alte See, ohne Bildergeschichte');
  assert(Math.abs(s.pos.x - P.stormgate.x) < 1 && s.pos.y < P.stormgate.y && W.isWater(s.pos.x, s.pos.y) && W.knownAt(P.stormgate.x, P.stormgate.y - 60), 'Ankunft am Sturmtor im Süden, der alte Nebel ist wieder da');
  C.passGate(P.stormgate, () => { back++; });
  assert(W.map() === 'emerald' && W.knownAt(P.pearlport.x, P.pearlport.y), 'Und wieder hin: die entdeckte Smaragdsee ist noch entdeckt');
  W.use('old');
}

// ---------- Spielstände vor Kapitel 6 bleiben, wo sie sind ----------
{
  SF.state = SF.createDefaultState();
  SF.voyage.ensurePos();
  assert(SF.state.map === 'old' && W.map() === 'old' && JSON.stringify(SF.state.fogs) === '{}', 'Neues Spiel: Alte See');
  const old = SF.createDefaultState();
  delete old.map; delete old.fogs;
  old.story.step = 'find-ice';
  SF.applyData(old);
  assert(SF.state.map === 'old' && typeof SF.state.fogs === 'object' && SF.story.step() === 'find-ice', 'Alter Spielstand ohne Karten-Felder lädt weiter');
  assert(!C.gateOpen(P.stormgate), 'Vor Kapitel 6 ist das Sturmtor zu');
  SF.pirates.refill();
  assert(!SF.pirates.list().some(p => p.kind === 'corsair'), 'Keine Korsaren in der Alten See');
}
