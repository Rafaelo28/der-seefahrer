// Schiffe: Typen (dieselben fünf wie in der Flotte von Gamble Klicker), Werte, Ausbau in der Werft und Zeichnen
// (von der Seite als SVG, von oben auf dem Canvas der Seekarte).
// Preise in Bernstein – die Zahlen bleiben klein (siehe CLAUDE.md).
window.SF = window.SF || {};

(function () {
  // price: Preis in der Werft · hold: Laderaum (Kisten) · food: Vorratskammer (Fässer) · speed: Karteneinheiten
  // pro Sekunde · cannons: Kanonen-Plätze · story: nicht in der Werft zu kaufen (alte Flotte, Story)
  const TYPES = [
    { id: 'sloop',   name: 'Schaluppe',     price: 120,  hold: 8,  food: 6,  speed: 55, cannons: 2, masts: 1, sail: '#f4efe0', hull: '#8a5a2b', len: 30 },
    { id: 'brig',    name: 'Brigg',         price: 380,  hold: 12, food: 8,  speed: 60, cannons: 4, masts: 2, sail: '#f4efe0', hull: '#6b3f1d', len: 36 },
    { id: 'frigate', name: 'Fregatte',      price: 950,  hold: 16, food: 10, speed: 68, cannons: 6, masts: 3, sail: '#ece4cc', hull: '#3b2a1a', len: 42, ports: true },
    { id: 'galleon', name: 'Galeone',       price: 1800, hold: 24, food: 12, speed: 56, cannons: 8, masts: 3, sail: '#c0392b', hull: '#5a2d0c', len: 46, ports: true, gold: true, story: true },
    { id: 'ghost',   name: 'Geisterschiff', price: 2500, hold: 20, food: 14, speed: 76, cannons: 6, masts: 3, sail: '#a9bdd2', hull: '#2b3440', len: 44, ports: true, ghost: true, story: true },
  ];
  const byId = Object.fromEntries(TYPES.map(t => [t.id, t]));

  // Ausbau in der Werft (gilt für das aktuelle Schiff; ein neues Schiff fängt bei 0 an)
  const UPGRADES = [
    { id: 'sails',  icon: '⛵', name: 'Bessere Segel',  max: 3, costs: [60, 140, 260], text: '+8 % Tempo je Stufe' },
    { id: 'hold',   icon: '📦', name: 'Größerer Laderaum', max: 3, costs: [80, 170, 300], text: '+3 Kisten je Stufe' },
    { id: 'pantry', icon: '🛢️', name: 'Vorratskammer',  max: 2, costs: [50, 120], text: '+2 Fässer Proviant je Stufe' },
  ];
  const upgradeById = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
  const CANNON_PRICE = 40;
  const SELL_BACK = 0.5; // altes Schiff in Zahlung geben: Hälfte des Werftpreises

  const type = (id = SF.state.ship.type) => byId[id] || byId.sloop;

  // Werte des Schiffs mit Ausbau
  function stats(ship = SF.state.ship) {
    const t = type(ship.type);
    return {
      name: t.name,
      speed: t.speed * (1 + 0.08 * (ship.sails || 0)),
      hold: t.hold + 3 * (ship.hold || 0),
      food: t.food + 2 * (ship.pantry || 0),
      cannons: Math.min(ship.cannons || 0, t.cannons),
      cannonSlots: t.cannons,
    };
  }

  // Wie viele Kisten Waren sind an Bord?
  const cargoCount = (cargo = SF.state.cargo) => Object.values(cargo).reduce((a, n) => a + (n > 0 ? n : 0), 0);
  const freeHold = () => Math.max(0, stats().hold - cargoCount());

  // ---------- Werft ----------

  function upgradeCost(id, ship = SF.state.ship) {
    const u = upgradeById[id];
    const lvl = ship[id] || 0;
    return u && lvl < u.max ? u.costs[lvl] : null;
  }

  function buyUpgrade(id) {
    const cost = upgradeCost(id);
    if (cost == null || !SF.amber.spend(cost)) return false;
    SF.state.ship[id] = (SF.state.ship[id] || 0) + 1;
    return true;
  }

  function buyCannon() {
    const s = stats();
    if (SF.state.ship.cannons >= s.cannonSlots || !SF.amber.spend(CANNON_PRICE)) return false;
    SF.state.ship.cannons += 1;
    return true;
  }

  // Preis für ein neues Schiff, wenn man das alte in Zahlung gibt
  function tradeInPrice(id) {
    const now = type();
    return Math.max(0, byId[id].price - Math.floor(now.price * SELL_BACK));
  }

  // Warum kann man dieses Schiff nicht kaufen? ('' = man kann)
  function whyNot(id) {
    const t = byId[id];
    if (!t || t.story) return 'Nicht zu kaufen';
    if (SF.state.ship.type === id) return 'Dein Schiff';
    const next = stats({ type: id, sails: 0, hold: 0, pantry: 0, cannons: 0 });
    if (cargoCount() > next.hold) return 'Zu viel Ladung an Bord';
    if (!SF.amber.can(tradeInPrice(id))) return 'Zu wenig Bernstein';
    return '';
  }

  function buyShip(id) {
    if (whyNot(id)) return false;
    if (!SF.amber.spend(tradeInPrice(id))) return false;
    const keep = Math.min(SF.state.ship.cannons || 0, byId[id].cannons);
    SF.state.ship = { type: id, sails: 0, hold: 0, pantry: 0, cannons: keep };
    SF.state.food = Math.min(SF.state.food, stats().food);
    return true;
  }

  // ---------- Zeichnen ----------

  // Von der Seite als SVG (aus Gamble Klicker übernommen), ohne IDs
  const svgCache = {};
  function sideSVG(id) {
    if (svgCache[id]) return svgCache[id];
    const s = type(id);
    const xs = s.masts === 1 ? [60] : s.masts === 2 ? [46, 76] : [36, 60, 84];
    const line = 'stroke="#2a1a0c" stroke-width="1.5" stroke-linejoin="round"';
    let out = '<svg class="ship-svg" viewBox="0 0 120 92" aria-hidden="true">';
    xs.forEach((x, i) => {
      const top = i === Math.floor(xs.length / 2) ? 8 : 16;
      out += `<path d="M${x} 60 L${x} ${top}" stroke="#4a2d14" stroke-width="2.5"/>`;
      const sail = (y, w, h) => {
        const bottom = s.ghost
          ? `L${x + w - 2} ${y + h} L${x + 4} ${y + h - 4} L${x} ${y + h + 1} L${x - 5} ${y + h - 4} L${x - w + 2} ${y + h}`
          : `Q${x} ${y + h + 4} ${x - w + 2} ${y + h}`;
        return `<path d="M${x - w} ${y} Q${x} ${y - 4} ${x + w} ${y} L${x + w - 2} ${y + h} ${bottom} Z" fill="${s.sail}" ${s.ghost ? 'fill-opacity="0.8"' : ''} ${line}/>`;
      };
      out += sail(top + 5, s.masts === 1 ? 18 : 13, s.masts === 3 ? 13 : 18);
      if (s.masts > 1) out += sail(top + (s.masts === 3 ? 22 : 27), s.masts === 3 ? 11 : 12, s.masts === 3 ? 13 : 14);
      if (s.masts === 1) out += `<path d="M${x + 2} ${top + 30} L${x + 28} 54 L${x + 2} 54 Z" fill="${s.sail}" ${line}/>`;
    });
    const main = xs[Math.floor(xs.length / 2)];
    out += `<path d="M${main} 8 L${main + 14} 11 L${main} 14 Z" fill="${s.ghost ? '#cfe0f0' : '#16181d'}"/>`;
    out += `<path d="M8 58 L112 58 L100 80 Q60 86 20 80 Z" fill="${s.hull}" ${line}/>`;
    out += `<path d="M10 62 L110 62" stroke="${s.gold ? '#f5c542' : 'rgba(255,255,255,.25)'}" stroke-width="${s.gold ? 2.4 : 1.2}"/>`;
    if (s.ports) [30, 45, 60, 75, 90].forEach(x => { out += `<circle cx="${x}" cy="70" r="2.6" fill="#1a1008" stroke="${s.gold ? '#f5c542' : '#8a6a4a'}" stroke-width="0.8"/>`; });
    out += '<path d="M104 58 L116 52" stroke="#4a2d14" stroke-width="2.2"/>';
    out += '</svg>';
    svgCache[id] = out;
    return out;
  }

  // Von oben auf dem Canvas: Bug zeigt in Richtung (dx, dy) – gedreht über den Richtungsvektor, ohne Winkel.
  // sway: leichtes Schaukeln (0 … 1)
  function drawTop(ctx, id, x, y, dx, dy, scale = 1, sway = 0) {
    const s = type(id);
    const L = s.len * scale;
    const B = L * 0.36;
    ctx.save();
    ctx.transform(dx, dy, -dy, dx, x, y);
    // Schatten im Wasser
    ctx.fillStyle = 'rgba(10, 30, 50, 0.25)';
    ctx.beginPath();
    ctx.ellipse(2 * scale, 3 * scale, L * 0.55, B * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    // Rumpf
    ctx.fillStyle = s.hull;
    ctx.strokeStyle = '#2a1a0c';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(L * 0.55, 0);
    ctx.quadraticCurveTo(L * 0.25, -B * 0.62, -L * 0.2, -B * 0.5);
    ctx.lineTo(-L * 0.45, -B * 0.4);
    ctx.lineTo(-L * 0.45, B * 0.4);
    ctx.lineTo(-L * 0.2, B * 0.5);
    ctx.quadraticCurveTo(L * 0.25, B * 0.62, L * 0.55, 0);
    ctx.fill();
    ctx.stroke();
    // Deck
    ctx.fillStyle = s.ghost ? '#4a5564' : '#c79a5b';
    ctx.beginPath();
    ctx.moveTo(L * 0.42, 0);
    ctx.quadraticCurveTo(L * 0.2, -B * 0.42, -L * 0.18, -B * 0.36);
    ctx.lineTo(-L * 0.38, -B * 0.3);
    ctx.lineTo(-L * 0.38, B * 0.3);
    ctx.lineTo(-L * 0.18, B * 0.36);
    ctx.quadraticCurveTo(L * 0.2, B * 0.42, L * 0.42, 0);
    ctx.fill();
    // Segel: Bögen quer zum Schiff, vom Wind nach vorn gebläht
    const masts = s.masts === 1 ? [0.05] : s.masts === 2 ? [-0.12, 0.16] : [-0.22, 0.02, 0.24];
    ctx.fillStyle = s.sail;
    ctx.globalAlpha = s.ghost ? 0.8 : 1;
    masts.forEach((m, i) => {
      const mx = m * L;
      const w = B * (i === Math.floor(masts.length / 2) ? 1.05 : 0.9);
      const bulge = (0.16 + 0.03 * sway) * L;
      ctx.beginPath();
      ctx.moveTo(mx - 0.03 * L, -w);
      ctx.quadraticCurveTo(mx + bulge, 0, mx - 0.03 * L, w);
      ctx.quadraticCurveTo(mx + bulge * 0.4, 0, mx - 0.03 * L, -w);
      ctx.fill();
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    // Flagge am Heck
    ctx.fillStyle = s.ghost ? '#cfe0f0' : '#16181d';
    ctx.beginPath();
    ctx.moveTo(-L * 0.42, 0);
    ctx.lineTo(-L * 0.62, -B * 0.18 + sway * B * 0.1);
    ctx.lineTo(-L * 0.62, B * 0.18 + sway * B * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  SF.ships = { TYPES, byId, UPGRADES, CANNON_PRICE, SELL_BACK, type, stats, cargoCount, freeHold, upgradeCost, buyUpgrade, buyCannon, tradeInPrice, whyNot, buyShip, sideSVG, drawTop };
})();
