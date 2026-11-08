// Tests für die Story von Stufe 1: Schritte, Ziele, Logbuch, Kneipen-Gespräche, Salz-Auftrag, Vulkaninsel.
const { assert, load } = require('./setup');
load('format', 'state', 'rank', 'figure', 'gk-import', 'ships', 'world', 'trade', 'crew');
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
  assert(St.step() === 'hire-cook' && SF.state.amber === a0 + 50 && St.goal() === 'dublone', 'Vulkaninsel: weiter mit Kapitel 2 (Schiffskoch in Port Dublone)');
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

// ---------- Kapitel 2: Smutje Fiete und das Eismeer ----------
{
  SF.state = SF.createDefaultState();
  SF.state.started = true;
  SF.state.story.step = 'end1';
  SF.chapter.migrate();
  assert(SF.story.step() === 'hire-cook' && SF.story.goal() === 'dublone', 'Alter Spielstand „Ende Stufe 1“ geht mit Kapitel 2 weiter');
  assert(SF.chapter.onIsland('ice').includes('Schiffskoch') && SF.crew.fleet().length === 0, 'Eismeer ohne Koch: noch nichts');
  const fiete = SF.chapter.tavern('dublone').find(t => t.who === 'fiete');
  assert(fiete && fiete.action.id === 'fiete-join', 'Fiete sucht Arbeit in Port Dublone');
  SF.chapter.act('dublone', 'fiete-join');
  assert(SF.crew.has('fiete') && SF.story.step() === 'find-ice' && SF.story.goal() === 'ice', 'Fiete an Bord, weiter ins Eismeer');
  assert(!SF.chapter.tavern('dublone').some(t => t.who === 'fiete'), 'Fiete sitzt nicht mehr in der Kneipe');
  // Anheuern ab Kapitel 2
  const karla = SF.chapter.tavern('smuggler').find(t => t.who === 'karla');
  assert(karla && karla.action.disabled, 'Karla in der Schmugglerinsel, aber zu teuer');
  SF.state.amber = 200;
  assert(SF.chapter.act('smuggler', 'hire-karla').includes('an Bord') && SF.crew.has('karla') && SF.state.amber === 110, 'Karla angeheuert');
  assert(SF.chapter.act('dublone', 'hire-nils') === '' && !SF.crew.has('nils'), 'Nils gibt es nur in der Bernsteinbucht');
  // Eismeer geschafft
  const text = SF.chapter.onIsland('ice');
  assert(text.includes('Long John') && text.includes('Verräter'), 'Logbuch von L. J.: Long John und ein Verräter');
  assert(SF.crew.fleet().some(f => f.type === 'galleon') && SF.story.step() === 'traitor', 'Galeone gefunden, Kapitel 3 beginnt');
  assert(SF.chapter.onIsland('ice') === '', 'Nur einmal');
}

// ---------- Kapitel 3: Der Verräter ----------
{
  const C = SF.chapter;
  assert(SF.story.step() === 'traitor' && SF.crew.has('fiete'), 'Kapitel 3 beginnt mit Fiete an Bord');
  assert(SF.story.goalText().includes('0 von 3'), 'Ziel zeigt die Hinweise');
  SF.state.amber = 200;
  SF.state.seaTime = 1000;
  const t1 = C.onDock('dublone');
  assert(t1.includes('weißer Staub') && SF.state.amber === 180 && C.clue('flour'), 'Beim Anlegen fehlt Bernstein, erster Hinweis: Mehl');
  assert(C.onDock('dublone') === '' && SF.state.amber === 180, 'Höchstens einmal am Tag');
  SF.state.seaTime += SF.trade.DAY;
  assert(C.onDock('amberbay') !== '' && SF.state.amber === 162 && SF.state.story.flags.stolen === 38, 'Am nächsten Tag wieder (gestohlen gesamt: 38)');
  // Frieda und die Flaschenpost
  const frieda = C.tavern('amberbay').find(t => t.who === 'frieda');
  assert(frieda.action && frieda.action.id === 'clue-bottle', 'Frieda hat etwas gesehen');
  C.act('amberbay', 'clue-bottle');
  assert(C.clue('bottle') && C.clueCount() === 2, 'Zweiter Hinweis: Flaschenpost');
  // Ede will Fisch
  SF.state.cargo = { fish: 1 };
  assert(C.tavern('smuggler').find(t => t.who === 'ede').action.disabled, 'Ede: zu wenig Fisch');
  SF.state.cargo = { fish: 3 };
  C.act('smuggler', 'clue-cook');
  assert(C.clue('cook') && SF.state.cargo.fish === 1 && C.clueCount() === 3, 'Dritter Hinweis gegen 2 Fisch');
  // Anklage
  assert(C.suspects().includes('bruno') && C.suspects().includes('fiete') && C.suspects().includes('karla'), 'Verdächtige: Crew und Matrosen');
  const wrong = C.accuse('bruno');
  assert(!wrong.ok && SF.crew.has('fiete') && SF.story.step() === 'traitor', 'Falscher Verdacht ändert nichts');
  const amber = SF.state.amber;
  const right = C.accuse('fiete');
  assert(right.ok && right.html.includes('Drachenküste') && !SF.crew.has('fiete'), 'Fiete war es – er muss von Bord');
  assert(SF.state.amber === amber + 38, 'Das Gestohlene kommt zurück');
  assert(SF.story.step() === 'find-dragon' && SF.story.goal() === 'dragon', 'Weiter zur Drachenküste');
  assert(C.onDock('dublone') === '', 'Ohne Verräter fehlt nichts mehr');
  // Drachenküste
  SF.state.gk = { ships: ['sloop', 'frigate'] };
  const d = C.onIsland('dragon');
  assert(d.includes('Nebelmeer') && SF.crew.fleet().some(f => f.type === 'frigate') && SF.story.step() === 'finale', 'Long Johns Versteck: alte Fregatte zurück, weiter ins Nebelmeer');
}
