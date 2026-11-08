// Cosmetics fürs Schiff – nur für Perlen (vom Tauchen): Segelfarbe, Rumpffarbe, Flagge, Galionsfigur,
// Spur im Kielwasser und Farbe vom Kanonenrauch. Zu sehen auf der Seekarte, in der Schlacht und in der Werft
// (später auch bei Freunden in der Online-Seeschlacht). Kaufen im Laden jedes Hafens.
window.SF = window.SF || {};

(function () {
  // Jede Sorte: id, Name, Platz, Wert (Farbe bzw. Zeichen), Preis in Perlen (0 = von Anfang an da)
  const ITEMS = [
    { id: 'sail-white', slot: 'sail', name: 'Leinen', value: null, price: 0 },
    { id: 'sail-red', slot: 'sail', name: 'Rot', value: '#c0392b', price: 6 },
    { id: 'sail-blue', slot: 'sail', name: 'Blau', value: '#2c5d8a', price: 6 },
    { id: 'sail-black', slot: 'sail', name: 'Schwarz', value: '#23232a', price: 10 },
    { id: 'sail-green', slot: 'sail', name: 'Grün', value: '#2e8b57', price: 8 },
    { id: 'sail-gold', slot: 'sail', name: 'Gold', value: '#e8b830', price: 25 },
    { id: 'hull-wood', slot: 'hull', name: 'Holz', value: null, price: 0 },
    { id: 'hull-dark', slot: 'hull', name: 'Ebenholz', value: '#2a1a12', price: 5 },
    { id: 'hull-red', slot: 'hull', name: 'Rot', value: '#8a1c1c', price: 8 },
    { id: 'hull-white', slot: 'hull', name: 'Weiß', value: '#e8e4da', price: 10 },
    { id: 'hull-gold', slot: 'hull', name: 'Gold', value: '#c89a20', price: 30 },
    { id: 'flag-black', slot: 'flag', name: 'Schwarz', value: null, price: 0 },
    { id: 'flag-red', slot: 'flag', name: 'Rot', value: '#d0302a', price: 4 },
    { id: 'flag-blue', slot: 'flag', name: 'Blau', value: '#2a6ad0', price: 4 },
    { id: 'flag-amber', slot: 'flag', name: 'Bernstein', value: '#f0a030', price: 12 },
    { id: 'head-none', slot: 'head', name: 'Ohne', value: '', price: 0 },
    { id: 'head-mermaid', slot: 'head', name: 'Meerjungfrau', value: '🧜', price: 15 },
    { id: 'head-pork', slot: 'head', name: 'John Pork', value: '🐷', price: 20 },
    { id: 'head-dragon', slot: 'head', name: 'Drache', value: '🐉', price: 30 },
    { id: 'head-kraken', slot: 'head', name: 'Krake', value: '🐙', price: 25 },
    { id: 'wake-white', slot: 'wake', name: 'Gischt', value: '255,255,255', price: 0 },
    { id: 'wake-cyan', slot: 'wake', name: 'Türkis', value: '120,240,230', price: 8 },
    { id: 'wake-pink', slot: 'wake', name: 'Rosa', value: '255,150,210', price: 10 },
    { id: 'wake-gold', slot: 'wake', name: 'Goldstaub', value: '255,210,90', price: 20 },
    { id: 'smoke-grey', slot: 'smoke', name: 'Grau', value: '230,230,230', price: 0 },
    { id: 'smoke-red', slot: 'smoke', name: 'Rot', value: '240,110,90', price: 10 },
    { id: 'smoke-green', slot: 'smoke', name: 'Grün', value: '120,220,120', price: 10 },
    { id: 'smoke-purple', slot: 'smoke', name: 'Lila', value: '190,130,240', price: 15 },
  ];
  const SLOTS = [
    { id: 'sail', name: 'Segel' }, { id: 'hull', name: 'Rumpf' }, { id: 'flag', name: 'Flagge' },
    { id: 'head', name: 'Galionsfigur' }, { id: 'wake', name: 'Kielwasser' }, { id: 'smoke', name: 'Kanonenrauch' },
  ];
  const byId = Object.fromEntries(ITEMS.map(x => [x.id, x]));
  const DEFAULT = Object.fromEntries(SLOTS.map(s => [s.id, ITEMS.find(x => x.slot === s.id && !x.price).id]));

  function data() {
    const s = SF.state;
    if (!s.cosmetics || typeof s.cosmetics !== 'object') s.cosmetics = {};
    const c = s.cosmetics;
    if (!Array.isArray(c.owned)) c.owned = [];
    if (!c.on || typeof c.on !== 'object') c.on = {};
    SLOTS.forEach(sl => { if (!byId[c.on[sl.id]] || !owns(c.on[sl.id], c)) c.on[sl.id] = DEFAULT[sl.id]; });
    return c;
  }

  function owns(id, c = data()) {
    const item = byId[id];
    return !!item && (!item.price || c.owned.includes(id));
  }

  // Kaufen (mit Perlen) und gleich anlegen
  function buy(id) {
    const item = byId[id];
    const s = SF.state;
    if (!item || owns(id) || (s.pearls || 0) < item.price) return false;
    s.pearls -= item.price;
    data().owned.push(id);
    data().on[item.slot] = id;
    return true;
  }

  function equip(id) {
    if (!owns(id)) return false;
    data().on[byId[id].slot] = id;
    return true;
  }

  const value = slot => byId[data().on[slot]].value;

  // Farben fürs Zeichnen des eigenen Schiffs (null = Farbe des Schiffstyps)
  function shipColors() {
    const out = {};
    if (value('sail')) out.sail = value('sail');
    if (value('hull')) out.hull = value('hull');
    if (value('flag')) out.flag = value('flag');
    if (value('head')) out.head = value('head');
    return out;
  }

  SF.cosmetics = { ITEMS, SLOTS, byId, DEFAULT, data, owns, buy, equip, value, shipColors };
})();
