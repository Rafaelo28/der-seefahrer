// Finale: Im Nebelmeer taucht der Fliegende Holländer auf – Long Johns Geisterschiff. Er sinkt nicht, man muss ihn
// entern und Long John besiegen (js/boarding.js). Danach: Ende mit Bildergeschichte und Abspann, das Geisterschiff
// gehört dir, der Schwer-Modus ist frei. Außerdem die Geheimnisse für 100 % (mit dem versteckten Bermuda-Dreieck).
window.SF = window.SF || {};

(function () {
  const MIST_RANGE = 170;   // so nah am Nebelmeer taucht der Holländer auf
  const LEAVE = 420;        // nach einer Niederlage oder Flucht erst wieder, wenn man so weit weg war

  const st = () => SF.state;
  const flags = () => st().story.flags;

  // ---------- Der Fliegende Holländer ----------

  // Pirat-Angaben für die Schlacht (nicht in der Liste der Piraten auf der Karte)
  function dutchman() {
    const m = SF.world.placeById.mist;
    return { id: 'dutchman', kind: 'dutchman', name: 'Der Fliegende Holländer', x: m.x, y: m.y, cool: 0 };
  }

  // Taucht der Holländer jetzt auf?
  function ready() {
    const s = st();
    if (SF.story.step() !== 'finale' || !s.pos || s.docked) return false;
    const m = SF.world.placeById.mist;
    const d = Math.hypot(s.pos.x - m.x, s.pos.y - m.y);
    if (d > LEAVE) flags().mistLeft = true;
    return d <= MIST_RANGE && flags().mistLeft !== false;
  }

  // Nach der Schlacht: bei Niederlage oder Flucht erst wieder, wenn man das Nebelmeer verlassen hat
  function afterBattle(result) {
    if (result !== 'boarded') flags().mistLeft = false;
  }

  // ---------- Ende ----------

  const name = () => SF.escape(st().captain.name || 'Kapitän');

  function endingScenes() {
    const s = st();
    return [
      { art: 'sieg', sound: 'fanfare', text: `<p>Long John sinkt auf die Planken des Holländers. „Ich hab immer gegen dich verloren … beim Würfeln, beim Poker,
        ${s.gk ? 'in Gamble Klicker' : 'in jeder Kneipe von Port Dublone'} … Ich wollte nur ein einziges Mal gewinnen!“</p>
        <p>In seiner Hand glänzt sie: <b>die Goldene Dublone</b>.</p>` },
      { art: 'tresor', text: `<p>Du bringst die Goldene Dublone zurück nach <b>Port Dublone</b>. Die Hafenbank legt sie zurück in den Tresor –
        und ab heute gilt: Dublone und Bernstein sind beide etwas wert.</p>` },
      { art: 'fest', sound: 'bell', text: `<p>Ganz Port Dublone feiert. Hafenmeister Hinnerk hält eine Rede, Bäckerin Berta backt ein Brot für genau
        <b>einen</b> Bernstein, und sogar Smutje Fiete darf in der Hafenküche wieder Fischsuppe kochen.</p><p>„Ein Hoch auf Kapitän ${name()}!“</p>` },
      { art: 'klabauter', last: 'Zum Abspann', text: `<p>„Das hast du gut gemacht, Käpt’n“, grinst der Klabautermann. „Der Holländer gehört jetzt dir.
        Aber das Meer ist groß … man erzählt sich von einem <b>Dreieck im Südwesten</b>, in dem der Kompass verrückt spielt.“</p>` },
    ];
  }

  // Ende abspielen: Belohnung, Bildergeschichte, Abspann, danach weiter segeln
  function ending() {
    const s = st();
    if (SF.story.step() === 'finale') {
      SF.crew.addShip('ghost');
      SF.story.setStep('done', 'Long John besiegt! Die Goldene Dublone ist zurück in Port Dublone.');
      SF.meta.set('finished', true);
      found('dublone');
      SF.track('seefahrer-durchgespielt');
      SF.save();
    }
    SF.story.play(endingScenes(), () => credits());
    void s;
  }

  function credits() {
    const s = st();
    const crew = ['Klabautermann'].concat(SF.crew.members().map(id => SF.crew.CREW[id].name));
    const box = document.getElementById('credits-roll');
    box.innerHTML = `
      <h1>Der Seefahrer</h1>
      <p class="cr-small">Ein Abenteuer nach Gamble Klicker</p>
      <h3>Idee und Spielleitung</h3><p>Rafaelo28</p>
      <h3>Kapitän</h3><p>${name()}${s.gk ? ` <span class="cr-small">(${SF.rank.title(s.gk.rank)})</span>` : ''}</p>
      <h3>Crew</h3><p>${crew.join('<br>')}</p>
      <h3>In weiteren Rollen</h3><p>Long John · Käpt’n Blaubart · Haifisch-Hein · Einauge Ede<br>Fischerin Frieda · Hafenmeister Hinnerk · Bäckerin Berta
        · Smutje Fiete<br>Bootsmann Bruno · Schiffsjunge Jan · der Fliegende Holländer</p>
      <h3>Deine Fahrt</h3><p>${SF.story.day()} Tage auf See · ${SF.formatInt(s.stats.distance / 10)} Seemeilen<br>
        ${SF.formatInt(s.stats.wins || 0)} Seeschlachten gewonnen · ${SF.formatInt(s.stats.pearls || 0)} Perlen gefunden<br>
        ${SF.formatInt(s.stats.amberEarned)} Bernstein verdient</p>
      <h3>Geheimnisse</h3><p>${count()} von ${SECRETS.length} gefunden – finde alle für 100 %!</p>
      <h3>Neu freigeschaltet</h3><p>Schwer-Modus beim nächsten neuen Abenteuer</p>
      <h3>Programmiert mit</h3><p>Claude</p>
      <p class="cr-end">Danke fürs Spielen!</p>`;
    SF.ui.show('credits');
    box.classList.remove('rolling');
    void box.offsetWidth;
    box.classList.add('rolling');
    SF.sound.play('fanfare');
  }

  // ---------- Geheimnisse für 100 % ----------

  const SECRETS = [
    { id: 'dublone', name: 'Die Goldene Dublone zurückgebracht', hint: 'Die ganze Geschichte', check: () => SF.story.step() === 'done' },
    { id: 'places', name: 'Alle Orte entdeckt', hint: 'Segle überall hin', check: () => SF.world.PLACES.filter(p => !p.hidden).every(p => st().visited[p.id]) },
    { id: 'islands', name: 'Alle vier Inseln geschafft', hint: 'An Land gehen', check: () => ['bay', 'volcano', 'ice', 'dragon'].every(id => st().islands && st().islands[id]) },
    { id: 'bluebeard', name: 'Käpt’n Blaubart besiegt', hint: 'An der Drachenküste kreuzt er', check: () => !!flags()['beat-bluebeard'] },
    { id: 'crew', name: 'Karla und Nils an Bord', hint: 'Kneipen', check: () => SF.crew.has('karla') && SF.crew.has('nils') },
    { id: 'pearls', name: '30 Perlen gefunden', hint: 'Tauchen', check: () => (st().stats.pearls || 0) >= 30 },
    { id: 'map', name: '70 % der Seekarte aufgedeckt', hint: 'Erkunden', check: () => SF.world.explored() >= 0.7 },
    { id: 'fleet', name: 'Drei Schiffe in deiner Flotte', hint: 'Werft und Story', check: () => SF.crew.fleet().length + 1 >= 3 },
    { id: 'bermuda', name: 'Das Bermuda-Dreieck gefunden', hint: 'Wo der Kompass verrückt spielt', check: () => !!st().visited.bermuda },
    { id: 'rich', name: '2.000 Bernstein auf einmal', hint: 'Handeln', check: () => st().amber >= 2000 },
  ];

  const secrets = () => {
    const s = st();
    if (!s.secrets || typeof s.secrets !== 'object') s.secrets = {};
    return s.secrets;
  };
  const has = id => !!secrets()[id];
  const count = () => SECRETS.filter(x => has(x.id)).length;
  const percent = () => Math.round(count() / SECRETS.length * 100);

  function found(id) {
    if (has(id)) return false;
    secrets()[id] = Date.now();
    return true;
  }

  // Neue Geheimnisse prüfen (z. B. beim Anlegen); meldet neue mit einer Meldung
  function check(quiet) {
    const fresh = SECRETS.filter(x => !has(x.id) && x.check());
    fresh.forEach(x => found(x.id));
    if (fresh.length && !quiet && SF.ui) {
      SF.sound.play('discover');
      SF.ui.toast(`${SF.icon('star')} Geheimnis gefunden: <b>${fresh[0].name}</b> (${count()} von ${SECRETS.length})`, 3500);
    }
    return fresh.map(x => x.id);
  }

  // Bermuda-Dreieck entdeckt (versteckter Ort)
  function onBermuda() {
    const s = st();
    s.pearls = (s.pearls || 0) + 10;
    s.stats.pearls = (s.stats.pearls || 0) + 10;
    return `<p>Der Kompass dreht sich wie verrückt, das Wasser wird glatt wie ein Spiegel … und dann treibt eine alte
      <b>Truhe</b> an die Oberfläche! Darin: <b>10 Perlen</b>.</p><p class="muted small">Du hast das Bermuda-Dreieck gefunden – ein Geheimnis für die 100 %.</p>`;
  }

  // Kompass spielt verrückt in der Nähe des Bermuda-Dreiecks (für die Anzeige auf der Seekarte)
  function compassCrazy() {
    const s = st();
    const b = SF.world.placeById.bermuda;
    return !!s.pos && Math.hypot(s.pos.x - b.x, s.pos.y - b.y) < 450;
  }

  SF.finale = { MIST_RANGE, LEAVE, dutchman, ready, afterBattle, ending, endingScenes, credits, SECRETS, has, count, percent, found, check, onBermuda, compassCrazy };
})();
