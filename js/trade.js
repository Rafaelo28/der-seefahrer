// Handel (ohne Bildschirm, testbar): Waren, Preise je Hafen (Angebot und Nachfrage, Tagesschwankung),
// Kaufen und Verkaufen, Proviant. Billig kaufen, woanders teuer verkaufen – an einem Ort allein verliert man.
window.SF = window.SF || {};

(function () {
  const GOODS = [
    { id: 'fish', icon: '🐟', name: 'Fisch', base: 6 },
    { id: 'salt', icon: '🧂', name: 'Salz', base: 10 },
    { id: 'rum', icon: '🥃', name: 'Rum', base: 18 },
    { id: 'cloth', icon: '🧵', name: 'Tuch', base: 26 },
    { id: 'spice', icon: '🌶️', name: 'Gewürze', base: 40 },
  ];
  const byId = Object.fromEntries(GOODS.map(g => [g.id, g]));

  // Preisfaktoren je Hafen (unter 1 = gibt es dort viel, billig) und Preis für ein Fass Proviant
  const MARKETS = {
    dublone: { fish: 1.0, salt: 0.75, rum: 1.3, cloth: 0.8, spice: 1.4, food: 4,
      text: 'In Port Dublone wird Tuch gewebt und Salz gesiedet. Rum und Gewürze sind hier teuer.' },
    amberbay: { fish: 0.6, salt: 1.35, rum: 1.2, cloth: 1.25, spice: 1.15, food: 3,
      text: 'Die Fischer der Bernsteinbucht fangen viel Fisch – und brauchen Salz, um ihn haltbar zu machen.' },
    smuggler: { fish: 1.35, salt: 1.0, rum: 0.65, cloth: 1.45, spice: 0.7, food: 5,
      text: 'Auf der Schmugglerinsel gibt es Rum und Gewürze billig. Woher? Frag lieber nicht.' },
  };

  const SPREAD = 0.85;       // Verkaufspreis = 85 % vom Kaufpreis
  const PRESSURE = 0.03;     // jede gekaufte Kiste macht die nächste 3 % teurer (verkauft: billiger)
  const RELAX = 30;          // Sekunden auf See, bis sich der Markt um eine Kiste erholt
  const WAVE = 0.12;         // Tagesschwankung ±12 %
  const DAY = 120;           // Sekunden auf See je Tag

  // Fester Zufall aus Hafen, Ware und Tag (−0,5 … 0,5)
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h / 4294967296 - 0.5;
  }

  const day = () => Math.floor((SF.state.seaTime || 0) / DAY);
  const wave = (h, g, d = day()) => hash(`${h}|${g}|${d}`) * 2 * WAVE;

  // Markt eines Hafens mit erholtem Druck (Druck: + gekauft, − verkauft)
  function market(h) {
    const all = SF.state.market;
    if (!all[h] || typeof all[h] !== 'object') all[h] = { p: {}, t: SF.state.seaTime };
    const m = all[h];
    if (!m.p || typeof m.p !== 'object') m.p = {};
    const relax = Math.max(0, (SF.state.seaTime - (m.t || 0)) / RELAX);
    if (relax > 0) {
      Object.keys(m.p).forEach(g => {
        const v = m.p[g];
        m.p[g] = Math.abs(v) <= relax ? 0 : v - Math.sign(v) * relax;
      });
    }
    m.t = SF.state.seaTime;
    return m;
  }

  const mult = p => Math.min(1.6, Math.max(0.55, 1 + PRESSURE * p));
  const value = (h, g) => byId[g].base * MARKETS[h][g] * (1 + wave(h, g)) * mult(market(h).p[g] || 0);

  const buyPrice = (h, g) => Math.max(1, Math.round(value(h, g)));
  const sellPrice = (h, g) => Math.max(1, Math.floor(value(h, g) * SPREAD));
  const foodPrice = h => Math.max(1, Math.round(MARKETS[h].food * (1 + wave(h, 'food'))));

  // Warum kann man nicht kaufen? ('' = man kann)
  function whyNotBuy(h, g) {
    if (!MARKETS[h] || !byId[g]) return 'Gibt es hier nicht';
    if (SF.ships.freeHold() <= 0) return 'Laderaum voll';
    if (!SF.amber.can(buyPrice(h, g))) return 'Zu wenig Bernstein';
    return '';
  }

  function buy(h, g) {
    if (whyNotBuy(h, g)) return false;
    const price = buyPrice(h, g);
    SF.amber.spend(price);
    const s = SF.state;
    s.cargo[g] = (s.cargo[g] || 0) + 1;
    market(h).p[g] = (market(h).p[g] || 0) + 1;
    s.stats.trades++;
    s.stats.profit -= price;
    return price;
  }

  function sell(h, g) {
    const s = SF.state;
    if (!MARKETS[h] || !(s.cargo[g] > 0)) return false;
    const price = sellPrice(h, g);
    s.cargo[g]--;
    if (!s.cargo[g]) delete s.cargo[g];
    market(h).p[g] = (market(h).p[g] || 0) - 1;
    SF.amber.add(price);
    s.stats.trades++;
    s.stats.profit += price;
    return price;
  }

  // Proviant kaufen: n Fässer (bis die Vorratskammer voll ist); gibt die Anzahl gekaufter Fässer zurück
  function buyFood(h, n = 1) {
    const s = SF.state;
    let bought = 0;
    while (bought < n) {
      const space = SF.ships.stats().food - s.food;
      if (space <= 0.001) break;
      // angebrochene Fässer zählen anteilig
      const part = Math.min(1, space);
      const price = Math.max(1, Math.ceil(foodPrice(h) * part));
      if (!SF.amber.spend(price)) break;
      s.food = Math.min(SF.ships.stats().food, s.food + part);
      bought++;
    }
    return bought;
  }

  // Wo ist eine Ware gerade am günstigsten bzw. am teuersten? (für Gerüchte in der Kneipe)
  function best(g) {
    const hs = Object.keys(MARKETS);
    const prices = hs.map(h => ({ h, buy: buyPrice(h, g), sell: sellPrice(h, g) }));
    return {
      cheap: prices.reduce((a, b) => (b.buy < a.buy ? b : a)),
      dear: prices.reduce((a, b) => (b.sell > a.sell ? b : a)),
    };
  }

  SF.trade = { GOODS, byId, MARKETS, SPREAD, DAY, market, buyPrice, sellPrice, foodPrice, whyNotBuy, buy, sell, buyFood, best, wave, day };
})();
