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
    { id: 'sails',  icon: 'ship', name: 'Bessere Segel',  max: 3, costs: [60, 140, 260], text: '+8 % Tempo je Stufe' },
    { id: 'hold',   icon: 'crate', name: 'Größerer Laderaum', max: 3, costs: [80, 170, 300], text: '+3 Kisten je Stufe' },
    { id: 'pantry', icon: 'barrel', name: 'Vorratskammer',  max: 2, costs: [50, 120], text: '+2 Fässer Proviant je Stufe' },
    { id: 'hull',   icon: 'shield', name: 'Rumpf verstärken', max: 3, costs: [90, 190, 320], text: '+25 Rumpf für Seeschlachten' },
  ];
  const REPAIR = 0.8; // Bernstein je Rumpfpunkt
  const upgradeById = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
  const CANNON_PRICE = 40;
  const SELL_BACK = 0.5; // altes Schiff in Zahlung geben: Hälfte des Werftpreises

  const type = (id = SF.state.ship.type) => byId[id] || byId.sloop;

  // Werte des Schiffs mit Ausbau
  function stats(ship = SF.state.ship) {
    const t = type(ship.type);
    return {
      name: t.name,
      speed: t.speed * (1 + 0.08 * (ship.sails || 0)) * (SF.crew ? SF.crew.speedMul() : 1),
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
    if (id === 'hull' && SF.state.ship.hp != null) SF.state.ship.hp += SF.battle ? SF.battle.HULL_UP : 25;
    return true;
  }

  // Rumpf: jetzt und höchstens (Lebenspunkte für Seeschlachten)
  const hullMax = () => (SF.battle ? SF.battle.maxHull() : 60);
  const hullNow = () => (SF.state.ship.hp == null ? hullMax() : Math.min(hullMax(), SF.state.ship.hp));
  const repairCost = () => Math.ceil((hullMax() - hullNow()) * REPAIR);

  function repair() {
    const cost = repairCost();
    if (cost <= 0 || !SF.amber.spend(cost)) return false;
    SF.state.ship.hp = null;
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
    SF.state.ship = { type: id, sails: 0, hold: 0, pantry: 0, hull: 0, hp: null, cannons: keep };
    SF.state.food = Math.min(SF.state.food, stats().food);
    return true;
  }

  // ---------- Zeichnen ----------

  // Von der Seite als SVG (aus Gamble Klicker übernommen), ohne IDs
  const svgCache = {};
  // colors: { sail, hull, flag, head } aus den Cosmetics (fehlende Werte = Farben des Schiffstyps)
  function sideSVG(id, colors) {
    const key = id + (colors ? JSON.stringify(colors) : '');
    if (svgCache[key]) return svgCache[key];
    const s = colors ? Object.assign({}, type(id), colors) : type(id);
    const xs = s.masts === 1 ? [60] : s.masts === 2 ? [46, 76] : [36, 60, 84];
    const line = 'stroke="#2a1a0c" stroke-width="1.5" stroke-linejoin="round"';
    let out = '<svg class="ship-svg" viewBox="0 0 120 92" aria-hidden="true">';
    xs.forEach((x, i) => {
      const top = i === Math.floor(xs.length / 2) ? 8 : 16;
      out += `<path d="M${x} 60 L${x} ${top}" stroke="#2a1a0c" stroke-width="3.6" stroke-linecap="round"/><path d="M${x} 60 L${x} ${top}" stroke="#6b4423" stroke-width="2" stroke-linecap="round"/>`;
      const sail = (y, w, h) => {
        const bottom = s.ghost
          ? `L${x + w - 2} ${y + h} L${x + 4} ${y + h - 4} L${x} ${y + h + 1} L${x - 5} ${y + h - 4} L${x - w + 2} ${y + h}`
          : `Q${x} ${y + h + 4} ${x - w + 2} ${y + h}`;
        // Segel mit Schatten auf der abgewandten Seite und einer Naht
        return `<path d="M${x - w} ${y} Q${x} ${y - 4} ${x + w} ${y} L${x + w - 2} ${y + h} ${bottom} Z" fill="${s.sail}" ${s.ghost ? 'fill-opacity="0.8"' : ''} ${line}/>
          <path d="M${x + w * 0.3} ${y - 1.6} Q${x + w * 0.7} ${y - 1.2} ${x + w - 0.8} ${y + 0.6} L${x + w - 2.6} ${y + h - 0.6} Q${x + w * 0.6} ${y + h + 1.4} ${x + w * 0.25} ${y + h + (s.ghost ? -2 : 1.8)} Z" fill="rgba(0,0,0,.13)"/>
          <path d="M${x - w + 2.5} ${y + h * 0.5} Q${x} ${y + h * 0.5 - 2.5} ${x + w - 2.5} ${y + h * 0.5}" fill="none" stroke="rgba(42,26,12,.25)" stroke-width="0.8"/>`;
      };
      out += sail(top + 5, s.masts === 1 ? 18 : 13, s.masts === 3 ? 13 : 18);
      if (s.masts > 1) out += sail(top + (s.masts === 3 ? 22 : 27), s.masts === 3 ? 11 : 12, s.masts === 3 ? 13 : 14);
      if (s.masts === 1) out += `<path d="M${x + 2} ${top + 30} L${x + 28} 54 L${x + 2} 54 Z" fill="${s.sail}" ${line}/>`;
    });
    const main = xs[Math.floor(xs.length / 2)];
    const fore = xs[xs.length - 1];
    // Klüver am Bugspriet (bei mehreren Masten), wehende Flagge
    if (s.masts > 1) out += `<path d="M${fore + 2.5} 20 L116 52 L${fore + 2.5} 55 Z" fill="${s.sail}" ${s.ghost ? 'fill-opacity="0.8"' : ''} ${line}/>`;
    out += `<path d="M${main} 7 q4 -2.4 7.5 0 t7.5 0 l-1.5 6.4 q-3.5 -2.2 -6.5 0 t-7 0 Z" fill="${s.flag || (s.ghost ? '#cfe0f0' : '#16181d')}" stroke="#2a1a0c" stroke-width="0.8"/>`;
    // Rumpf: hochgezogenes Heck (links) mit Fenster, Bug mit Bugspriet (rechts), dunklerer Kiel, Planken
    out += `<path d="M7 49 L27 49 L29 58 L104 58 Q110 58 114 54.5 L102 80 Q60 86 20 80 Q10 68 7 49 Z" fill="${s.hull}" ${line}/>`;
    out += '<path d="M12.4 68 L107.4 68 L102 80 Q60 86 20 80 Q15 75 12.4 68 Z" fill="rgba(0,0,0,.2)"/>';
    out += '<path d="M10.5 62.5 L110 62.5 M15 74.5 L104.6 74.5" stroke="rgba(0,0,0,.22)" stroke-width="0.9" fill="none"/>';
    out += `<path d="M9 53.2 L28 53.2 L29.6 61 L110.6 61" stroke="${s.gold ? '#f5c542' : 'rgba(255,255,255,.28)'}" stroke-width="${s.gold ? 2.2 : 1.2}" fill="none" stroke-linejoin="round"/>`;
    out += `<rect x="13" y="55.5" width="7" height="6" rx="1.4" fill="${s.ghost ? '#8fe0c0' : '#ffd27a'}" stroke="#2a1a0c" stroke-width="1"/>`;
    out += '<path d="M8 47 L26.5 47 M10.5 47 v-3.4 M16.5 47 v-3.4 M22.5 47 v-3.4 M8 43.6 L26.5 43.6" stroke="#4a2d14" stroke-width="1.3" fill="none"/>';
    if (s.ports) [36, 50, 64, 78, 92].forEach(x => { out += `<circle cx="${x}" cy="67.5" r="2.6" fill="#1a1008" stroke="${s.gold ? '#f5c542' : '#8a6a4a'}" stroke-width="0.8"/>`; });
    out += '<path d="M103 58.5 L117 51.5" stroke="#2a1a0c" stroke-width="3.4" stroke-linecap="round"/><path d="M103 58.5 L117 51.5" stroke="#6b4423" stroke-width="1.8" stroke-linecap="round"/>';
    if (s.head && SF.icon) out += SF.icon(s.head).replace('<svg ', '<svg x="103" y="56" width="16" height="16" ');
    out += '</svg>';
    svgCache[key] = out;
    return out;
  }

  // Von oben auf dem Canvas: Bug zeigt in Richtung (dx, dy) – gedreht über den Richtungsvektor, ohne Winkel.
  // sway: leichtes Schaukeln (0 … 1) · colors: { sail, hull, flag, head } aus den Cosmetics
  function drawTop(ctx, id, x, y, dx, dy, scale = 1, sway = 0, colors = null) {
    const s = colors ? Object.assign({}, type(id), colors) : type(id);
    const L = s.len * scale;
    const B = L * 0.36;
    const line = Math.max(1, 1.4 * scale);
    ctx.save();
    ctx.transform(dx, dy, -dy, dx, x, y);
    ctx.lineJoin = 'round';
    // Schatten im Wasser
    ctx.fillStyle = 'rgba(10, 30, 50, 0.28)';
    ctx.beginPath();
    ctx.ellipse(2.5 * scale, 4 * scale, L * 0.56, B * 0.66, 0, 0, Math.PI * 2);
    ctx.fill();
    // Rumpf
    const hull = () => {
      ctx.beginPath();
      ctx.moveTo(L * 0.56, 0);
      ctx.bezierCurveTo(L * 0.42, -B * 0.62, L * 0.05, -B * 0.62, -L * 0.3, -B * 0.52);
      ctx.lineTo(-L * 0.46, -B * 0.4);
      ctx.lineTo(-L * 0.46, B * 0.4);
      ctx.lineTo(-L * 0.3, B * 0.52);
      ctx.bezierCurveTo(L * 0.05, B * 0.62, L * 0.42, B * 0.62, L * 0.56, 0);
      ctx.closePath();
    };
    hull();
    ctx.fillStyle = s.hull;
    ctx.fill();
    ctx.strokeStyle = '#2a1a0c';
    ctx.lineWidth = line;
    ctx.stroke();
    // Deck mit Planken
    ctx.save();
    ctx.scale(0.8, 0.74);
    hull();
    ctx.restore();
    ctx.fillStyle = s.ghost ? '#4a5564' : '#c79a5b';
    ctx.fill();
    ctx.strokeStyle = s.ghost ? 'rgba(0,0,0,.25)' : 'rgba(110, 70, 30, .45)';
    ctx.lineWidth = Math.max(0.6, 0.7 * scale);
    ctx.beginPath();
    for (let k = -2; k <= 2; k++) {
      ctx.moveTo(-L * 0.34, k * B * 0.12);
      ctx.lineTo(L * 0.36 - Math.abs(k) * L * 0.05, k * B * 0.12);
    }
    ctx.stroke();
    // Stückpforten an den Seiten
    if (s.ports || s.cannons >= 4) {
      const n = Math.max(2, Math.round(s.cannons / 2));
      ctx.fillStyle = '#1a1008';
      for (let i = 0; i < n; i++) {
        const px = -L * 0.22 + (i / Math.max(1, n - 1)) * L * 0.4;
        ctx.fillRect(px - L * 0.025, -B * 0.56, L * 0.05, B * 0.1);
        ctx.fillRect(px - L * 0.025, B * 0.46, L * 0.05, B * 0.1);
      }
    }
    // Masten mit geblähten Segeln (vom Wind nach vorn gewölbt)
    const masts = s.masts === 1 ? [0.06] : s.masts === 2 ? [-0.12, 0.17] : [-0.23, 0.02, 0.25];
    const mid = Math.floor(masts.length / 2);
    masts.forEach((m, i) => {
      const mx = m * L;
      const w = B * (i === mid ? 1.12 : 0.95);
      const depth = L * (0.075 + 0.015 * sway);
      ctx.beginPath();
      ctx.moveTo(mx - L * 0.03, -w);
      ctx.quadraticCurveTo(mx + depth * 3.2, 0, mx - L * 0.03, w);
      ctx.lineTo(mx - L * 0.06, w * 0.9);
      ctx.quadraticCurveTo(mx + depth * 0.9, 0, mx - L * 0.06, -w * 0.9);
      ctx.closePath();
      ctx.globalAlpha = s.ghost ? 0.82 : 1;
      ctx.fillStyle = s.sail;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(42, 26, 12, .85)';
      ctx.lineWidth = line;
      ctx.stroke();
      // Rah (Querbalken) und Mast
      ctx.strokeStyle = '#4a2d14';
      ctx.lineWidth = Math.max(1, 1.6 * scale);
      ctx.beginPath();
      ctx.moveTo(mx - L * 0.035, -w * 0.96);
      ctx.lineTo(mx - L * 0.035, w * 0.96);
      ctx.stroke();
      ctx.fillStyle = '#4a2d14';
      ctx.beginPath();
      ctx.arc(mx - L * 0.035, 0, Math.max(1.2, L * 0.035), 0, Math.PI * 2);
      ctx.fill();
    });
    // Flagge am Heck
    ctx.fillStyle = s.flag || (s.ghost ? '#cfe0f0' : '#16181d');
    ctx.strokeStyle = 'rgba(0,0,0,.4)';
    ctx.lineWidth = Math.max(0.6, 0.8 * scale);
    ctx.beginPath();
    ctx.moveTo(-L * 0.44, 0);
    ctx.lineTo(-L * 0.66, -B * 0.2 + sway * B * 0.12);
    ctx.lineTo(-L * 0.62, B * 0.02 + sway * B * 0.06);
    ctx.lineTo(-L * 0.66, B * 0.2 + sway * B * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Galionsfigur am Bug
    if (s.head && SF.icons) SF.icons.draw(ctx, s.head, L * 0.62, 0, L * 0.36);
    ctx.restore();
  }

  SF.ships = { TYPES, byId, UPGRADES, CANNON_PRICE, REPAIR, hullMax, hullNow, repairCost, repair, SELL_BACK, type, stats, cargoCount, freeHold, upgradeCost, buyUpgrade, buyCannon, tradeInPrice, whyNot, buyShip, sideSVG, drawTop };
})();
