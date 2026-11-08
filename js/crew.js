// Crew: Mannschaft, die man an Bord holt. Jedes Mitglied bringt einen kleinen Vorteil. Smutje Fiete kommt durch die
// Story an Bord (Kapitel 2) – und ist in Wahrheit der Verräter (Kapitel 3). Die anderen heuert man in Kneipen an.
// Außerdem die alte Flotte: wiedergefundene Schiffe liegen in der Werft, man kann kostenlos umsteigen.
window.SF = window.SF || {};

(function () {
  // fig: Figuren-Code (js/figure.js) · harbor: wo man sie anheuert · price: Heuer in Bernstein (0 = Story)
  const CREW = {
    fiete: { name: 'Smutje Fiete', role: 'Schiffskoch', fig: '1.6.0.1.0.7.0', harbor: 'dublone', price: 0,
      bonus: 'Proviant hält ein Viertel länger' },
    karla: { name: 'Kanonierin Karla', role: 'Kanonierin', fig: '2.2.1.1.4.1.12', harbor: 'smuggler', price: 90,
      bonus: 'Kanonen laden ein Fünftel schneller nach' },
    nils: { name: 'Navigator Nils', role: 'Navigator', fig: '0.3.7.0.0.8.5', harbor: 'amberbay', price: 120,
      bonus: 'Segelt 6 % schneller' },
  };

  function data() {
    const s = SF.state;
    if (!s.crew || typeof s.crew !== 'object' || Array.isArray(s.crew)) s.crew = {};
    return s.crew;
  }

  // Ist jemand an Bord? (gegangen = false)
  const has = id => data()[id] === 'aboard';
  const members = () => Object.keys(CREW).filter(has);

  function join(id) {
    if (!CREW[id] || has(id)) return false;
    data()[id] = 'aboard';
    return true;
  }

  // Anheuern gegen Bernstein (nur, wer einen Preis hat)
  function hire(id) {
    const c = CREW[id];
    if (!c || !c.price || has(id) || data()[id] === 'gone') return false;
    if (!SF.amber.spend(c.price)) return false;
    return join(id);
  }

  // Von Bord schicken (z. B. der Verräter)
  function leave(id) {
    if (!has(id)) return false;
    data()[id] = 'gone';
    return true;
  }

  // Vorteile
  const foodMul = () => (has('fiete') ? 1.25 : 1);   // Proviant reicht weiter
  const reloadMul = () => (has('karla') ? 0.8 : 1);  // schneller nachladen
  const speedMul = () => (has('nils') ? 1.06 : 1);   // schneller segeln

  // ---------- Alte Flotte ----------

  function fleet() {
    const s = SF.state;
    if (!Array.isArray(s.fleet)) s.fleet = [];
    return s.fleet;
  }

  // Ein Schiff in die Flotte aufnehmen (wiedergefunden); gibt false zurück, wenn es schon da ist
  function addShip(type) {
    if (!SF.ships.byId[type]) return false;
    if (SF.state.ship.type === type || fleet().some(x => x.type === type)) return false;
    fleet().push({ type, sails: 0, hold: 0, pantry: 0, hull: 0, hp: null, cannons: 0 });
    return true;
  }

  // Umsteigen: das gewählte Schiff wird das eigene, das bisherige liegt in der Werft (jedes behält Ausbau und Kanonen)
  function whyNotSwap(i) {
    const next = fleet()[i];
    if (!next) return 'Gibt es nicht';
    if (SF.ships.cargoCount() > SF.ships.stats(next).hold) return 'Zu viel Ladung an Bord';
    return '';
  }

  function swap(i) {
    if (whyNotSwap(i)) return false;
    const s = SF.state;
    const next = fleet()[i];
    fleet()[i] = s.ship;
    s.ship = next;
    s.food = Math.min(s.food, SF.ships.stats().food);
    return true;
  }

  SF.crew = { CREW, data, has, members, join, hire, leave, foodMul, reloadMul, speedMul, fleet, addShip, whyNotSwap, swap };
})();
