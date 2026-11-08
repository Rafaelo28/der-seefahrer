// Tests für die Story von Stufe 1: Schritte, Ziele, Logbuch, Kneipen-Gespräche, Salz-Auftrag, Vulkaninsel.
const { assert, load } = require('./setup');
load('format', 'state', 'rank', 'figure', 'gk-import', 'ships', 'world', 'trade');
// Oberfläche, Ton und Zählung braucht der Test nicht
SF.ui = { dialog: () => Promise.resolve(true), toast() {}, tip() {}, KLABAUTER: '<svg></svg>' };
SF.sound = { play() {} };
SF.track = () => {};
global.setTimeout = fn => fn();
load('story', 'chapter');
const St = SF.story;
const C = SF.chapter;

SF.state = SF.createDefaultState();
SF.state.started = true;
SF.state.captain.name = 'Testkapitän';

// ---------- Schritte und Ziele ----------
{
  Object.entries(St.STEPS).forEach(([id, step]) => {
    if (step.goal) assert(!!SF.world.placeById[step.goal], `Ziel von ${id} ist ein Ort auf der Karte`);
  });
  St.setStep('find-amberbay', 'Los geht’s');
  assert(St.goal() === 'amberbay' && St.goalText().includes('Bernsteinbucht'), 'Erstes Ziel: Bernsteinbucht');
  assert(SF.state.story.log.length === 1 && SF.state.story.log[0].day === 1, 'Logbuch-Eintrag an Tag 1');
  SF.state.seaTime = 250;
  St.log('später');
  assert(SF.state.story.log[1].day === 3, 'Tag zählt mit der Zeit auf See');
  for (let i = 0; i < 80; i++) St.log('x' + i);
  assert(SF.state.story.log.length === 60, 'Logbuch höchstens 60 Einträge');
}

// ---------- Kneipen ----------
{
  const talk = h => C.tavern(h);
  assert(talk('dublone').some(t => t.who === 'hinnerk' && t.text.includes('Salz')), 'Hafenmeister gibt den Salz-Tipp');
  const frieda = talk('amberbay').find(t => t.who === 'frieda');
  assert(frieda && frieda.action && frieda.action.id === 'frieda-thanks', 'Frieda weiß etwas über das schwarze Schiff');
  assert(C.act('dublone', 'frieda-thanks') === '' && St.step() === 'find-amberbay', 'Aktion nur im richtigen Hafen');
  C.act('amberbay', 'frieda-thanks');
  assert(St.step() === 'find-smuggler' && St.goal() === 'smuggler', 'Weiter zur Schmugglerinsel');
  const ede = talk('smuggler').find(t => t.who === 'ede');
  assert(ede.action.id === 'ede-quest', 'Ede will etwas');
  C.act('smuggler', 'ede-quest');
  assert(St.step() === 'salt-quest', 'Salz-Auftrag angenommen');
  const ede2 = talk('smuggler').find(t => t.who === 'ede');
  assert(ede2.action.disabled, 'Ohne Salz kann man nichts geben');
  assert(C.act('smuggler', 'ede-salt') === '' && St.step() === 'salt-quest', 'Ohne Salz geht es nicht weiter');
  SF.state.cargo = { salt: 4 };
  const a0 = SF.state.amber;
  C.act('smuggler', 'ede-salt');
  assert(St.step() === 'find-volcano' && SF.state.cargo.salt === 1 && SF.state.amber === a0 + 40, '3 Salz abgegeben, Bernstein bekommen, weiter zur Vulkaninsel');
  assert(St.goal() === 'volcano', 'Ziel: Vulkaninsel');
}

// ---------- Vulkaninsel ----------
{
  C.onDiscover('bay');
  assert(St.step() === 'find-volcano', 'Andere Orte ändern nichts');
  const a0 = SF.state.amber;
  C.onDiscover('volcano');
  assert(St.step() === 'end1' && SF.state.amber === a0 + 50 && St.goal() === '', 'Ende von Stufe 1');
  C.onDiscover('volcano');
  assert(SF.state.amber === a0 + 50, 'Belohnung nur einmal');
}

// ---------- Gerüchte ----------
{
  SF.state.seaTime = 0;
  const r = C.rumor();
  assert(typeof r === 'string', 'Gerücht ist Text');
}

// ---------- Bildergeschichten ----------
{
  SF.state.gk = { name: 'X', money: 7e45, ships: ['brig'], rank: 13, bossLevel: 0, fig: '' };
  const p = St.prologScenes();
  assert(p.length === 6 && p.every(sc => St.ART[sc.art]), 'Prolog: 6 Bilder, alle gezeichnet');
  assert(p[0].text.includes('Septilliarden') && p[3].text.includes('Brigg'), 'Prolog nennt Vermögen und gestohlene Flotte');
  const e = St.eveningScenes({ leftover: 5e40, exchange: 25, amber: 55 });
  assert(e.length === 2 && e[0].text.includes('25'), 'Abend: Umtausch');
}
