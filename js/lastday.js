// Prolog „Der letzte Tag der Dublone“: 60 Sekunden einkaufen, die Preise verdoppeln sich alle 5 Sekunden.
// Die Preise richten sich nach dem eigenen Startgeld M (wer reich ist, für den ist alles teurer):
//   Preis = Anteil × M × 2^(t / 5) ÷ (1 + v),  Vorsprung v = log10(M) ÷ 90 (höchstens 0,5)
// So hat jemand mit Septilliarden nur gut eine halbe Verdopplung (etwa 3 Sekunden) Vorsprung vor jemandem mit 10.000.
// Am Abend tauscht die Hafenbank 1 Billion Dublonen gegen 1 Bernstein (höchstens 25). Mindestausstattung für alle:
// Schaluppe, 3 Fässer Proviant, 30 Bernstein.
window.SF = window.SF || {};

(function () {
  const DOUBLING = 5;          // Sekunden bis zur nächsten Verdopplung
  const DURATION = 60;         // Sekunden
  const START_MONEY = 10000;   // Erspartes ohne Gamble Klicker (und Mindestgeld)
  const MAX_MONEY = 1e300;     // größer wird nicht gerechnet (sonst Unendlich)
  const MIN_FOOD = 3;
  const BASE_AMBER = 30;
  const EXCHANGE_RATE = 1e12;  // 1 Billion Dublonen = 1 Bernstein
  const EXCHANGE_MAX = 25;
  const SHIP_ORDER = ['sloop', 'brig', 'frigate'];

  // share: Anteil am Startgeld zu Beginn (vor dem Vorsprung)
  const ITEMS = [
    { id: 'frigate', icon: 'ship', name: 'Fregatte', share: 0.55, kind: 'ship', text: '16 Kisten · 6 Kanonen · schnell' },
    { id: 'brig', icon: 'ship', name: 'Brigg', share: 0.12, kind: 'ship', text: '12 Kisten · 4 Kanonen' },
    { id: 'cannon', icon: 'cannon', name: 'Kanone', share: 0.03, kind: 'cannon', text: 'Für Seeschlachten' },
    { id: 'food', icon: 'barrel', name: 'Fass Proviant', share: 0.01, kind: 'food', text: 'Ohne Proviant murrt die Crew' },
    { id: 'cloth', icon: 'cloth', name: 'Kiste Tuch', share: 0.02, kind: 'cargo', good: 'cloth', text: 'Verkaufen gegen Bernstein' },
    { id: 'bread', icon: 'bread', name: 'Brot', share: 0.0003, kind: 'bread', text: '10 Brote = 1 Fass Proviant' },
  ];
  const byId = Object.fromEntries(ITEMS.map(x => [x.id, x]));

  // ---------- Regeln (ohne Bildschirm, testbar) ----------

  const clampMoney = m => Math.min(MAX_MONEY, Math.max(START_MONEY, typeof m === 'number' && isFinite(m) ? m : (m === Infinity ? MAX_MONEY : 0)));
  const HEAD_MAX = 0.5;        // größter Vorsprung (Preise ÷ 1,5)
  const headStart = M => Math.min(HEAD_MAX, Math.max(0, Math.log10(Math.max(M, 1)) / 90));
  const mult = t => Math.pow(2, Math.max(0, t) / DOUBLING);

  function create(money) {
    const M = clampMoney(money);
    const bought = {};
    ITEMS.forEach(x => { bought[x.id] = 0; });
    return { M, money: M, t: 0, ship: 'sloop', bought, over: false };
  }

  function price(s, id, t = s.t) {
    return Math.ceil(byId[id].share * s.M * mult(t) / (1 + headStart(s.M)));
  }

  const shipType = s => SF.ships.byId[s.ship];
  const foodUnits = s => s.bought.food + s.bought.bread / 10;

  // Wie viele passen noch? (Schiffe: 1 oder 0)
  function room(s, id) {
    const item = byId[id];
    const t = shipType(s);
    switch (item.kind) {
      case 'ship': return SHIP_ORDER.indexOf(id) > SHIP_ORDER.indexOf(s.ship) ? 1 : 0;
      case 'cannon': return Math.max(0, t.cannons - s.bought.cannon);
      case 'food': return Math.max(0, Math.floor(t.food - foodUnits(s) + 1e-9));
      case 'bread': return Math.max(0, Math.floor((t.food - foodUnits(s)) * 10 + 1e-9));
      case 'cargo': return Math.max(0, t.hold - s.bought.cloth);
      default: return 0;
    }
  }

  // Warum kann man das gerade nicht kaufen? ('' = man kann)
  function whyNot(s, id) {
    if (s.over) return 'Vorbei';
    const item = byId[id];
    if (!item) return 'Gibt es nicht';
    if (room(s, id) <= 0) {
      if (item.kind === 'ship') return s.ship === id ? 'Gekauft' : 'Du hast ein besseres Schiff';
      return item.kind === 'cannon' ? 'Alle Plätze voll' : 'Kein Platz mehr';
    }
    if (price(s, id) > s.money) return 'Zu teuer';
    return '';
  }

  function buy(s, id) {
    if (whyNot(s, id)) return false;
    s.money -= price(s, id);
    s.bought[id]++;
    if (byId[id].kind === 'ship') s.ship = id;
    return true;
  }

  // Kann man überhaupt noch etwas kaufen?
  const anythingLeft = s => ITEMS.some(x => !whyNot(s, x.id));

  function result(s) {
    const t = shipType(s);
    const exchange = Math.min(EXCHANGE_MAX, Math.floor(s.money / EXCHANGE_RATE));
    return {
      ship: s.ship,
      cannons: s.bought.cannon,
      food: Math.min(t.food, Math.max(MIN_FOOD, foodUnits(s))),
      cargo: s.bought.cloth > 0 ? { cloth: s.bought.cloth } : {},
      bread: s.bought.bread,
      leftover: s.money,
      start: s.M,
      exchange,
      amber: BASE_AMBER + exchange,
      seconds: Math.min(DURATION, Math.round(s.t)),
    };
  }

  // Ergebnis in den Spielstand übernehmen (alte Ausrüstung wird ersetzt)
  function apply(r) {
    const st = SF.state;
    st.ship = { type: r.ship, sails: 0, hold: 0, pantry: 0, cannons: r.cannons };
    st.food = r.food;
    st.cargo = Object.assign({}, r.cargo);
    st.amber = 0;
    SF.amber.add(r.amber);
    st.lastDay = { ship: r.ship, cannons: r.cannons, food: r.food, cloth: r.cargo.cloth || 0, bread: r.bread, leftover: r.leftover, start: r.start, exchange: r.exchange, amber: r.amber };
  }

  // ---------- Bildschirm ----------

  let session = null;
  let startedAt = 0;
  let raf = 0;
  let lastDoubling = 0;
  let stuckSince = 0;
  let ending = false;
  const $ = id => document.getElementById(id);

  function start() {
    const gk = SF.state.gk;
    session = create(gk ? gk.money : START_MONEY);
    ending = false;
    SF.ui.show('lastday');
    $('ld-intro').hidden = false;
    $('ld-intro-money').innerHTML = SF.dublonenHTML(session.M);
    buildGrid();
    update(true);
    SF.track('seefahrer-letzter-tag');
  }

  function go() {
    $('ld-intro').hidden = true;
    startedAt = performance.now();
    lastDoubling = 0;
    stuckSince = 0;
    SF.sound.play('horn');
    loop();
  }

  function buildGrid() {
    $('ld-grid').innerHTML = ITEMS.map(x => `<button type="button" class="ld-item ld-kind-${x.kind}" data-id="${x.id}">
      <span class="ld-icon">${x.kind === 'ship' ? SF.ships.sideSVG(x.id) : SF.icon(x.icon)}</span>
      <span class="ld-name">${x.name}</span>
      <span class="ld-text">${x.text}</span>
      <span class="ld-price"></span>
      <span class="ld-count"></span>
    </button>`).join('');
  }

  function loop() {
    cancelAnimationFrame(raf);
    const frame = now => {
      if (!session || session.over) return;
      session.t = Math.min(DURATION, (now - startedAt) / 1000);
      const d = Math.floor(session.t / DOUBLING);
      if (d > lastDoubling) {
        lastDoubling = d;
        SF.sound.play('alarm');
        const g = $('ld-grid');
        g.classList.remove('doubled');
        void g.offsetWidth;
        g.classList.add('doubled');
      }
      // Ende: Zeit um, oder seit 1,5 Sekunden ist nichts mehr bezahlbar
      if (!anythingLeft(session)) stuckSince = stuckSince || now;
      else stuckSince = 0;
      if (session.t >= DURATION || (stuckSince && now - stuckSince > 1500)) {
        finish();
        return;
      }
      update();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  function update() {
    const s = session;
    SF.setText($('ld-time'), Math.max(0, Math.ceil(DURATION - s.t)));
    const into = (s.t % DOUBLING) / DOUBLING;
    $('ld-bar-fill').style.transform = `scaleX(${into.toFixed(3)})`;
    SF.setText($('ld-bar-text'), `Preise ×2 in ${SF.formatDecimal(Math.max(0, DOUBLING - s.t % DOUBLING), 1, 1)} s`);
    SF.setHTML($('ld-money'), SF.dublonenHTML(s.money));
    SF.setHTML($('ld-bread'), `${SF.icon('bread')} Ein Brot kostet gerade <b>${SF.formatLong(price(s, 'bread'))}</b> Dublonen`);
    $('ld-grid').querySelectorAll('.ld-item').forEach(btn => {
      const id = btn.dataset.id;
      const why = whyNot(s, id);
      const item = byId[id];
      btn.classList.toggle('off', !!why);
      btn.classList.toggle('done', why === 'Gekauft');
      SF.setHTML(btn.querySelector('.ld-price'), why && why !== 'Zu teuer' ? why : SF.dublonenHTML(price(s, id)));
      const t = shipType(s);
      const count = item.kind === 'ship' ? '' : item.kind === 'cannon' ? `${s.bought.cannon} / ${t.cannons}`
        : item.kind === 'food' ? `${SF.formatDecimal(foodUnits(s), 0, 1)} / ${t.food} Fässer`
          : item.kind === 'bread' ? (s.bought.bread ? `${s.bought.bread} Brote` : '')
            : `${s.bought.cloth} / ${t.hold}`;
      SF.setText(btn.querySelector('.ld-count'), count);
    });
    SF.setHTML($('ld-myship'), `${SF.ships.sideSVG(s.ship)}<span>${SF.ships.byId[s.ship].name}</span>`);
  }

  function tapItem(btn) {
    if (!session || session.over || !$('ld-intro').hidden) return;
    const id = btn.dataset.id;
    if (buy(session, id)) {
      SF.sound.play(byId[id].kind === 'ship' ? 'buy' : 'coin');
      btn.classList.remove('bought');
      void btn.offsetWidth;
      btn.classList.add('bought');
      update();
    } else {
      SF.sound.play('denied');
    }
  }

  function finish() {
    if (!session || ending) return;
    ending = true;
    session.over = true;
    cancelAnimationFrame(raf);
    const r = result(session);
    apply(r);
    SF.story.setStep('evening', 'Der letzte Tag der Dublone: Mit dem alten Geld ein Schiff und Vorräte gekauft.');
    SF.sound.play('fanfare');
    const s = SF.ships.byId[r.ship];
    $('ld-result').innerHTML = `<div class="dialog ld-result-box">
      <h2>Ausgerüstet!</h2>
      <div class="ld-result-ship">${SF.ships.sideSVG(r.ship)}</div>
      <ul class="ld-result-list">
        <li>${s.name}${r.ship === 'sloop' && !session.bought.brig ? ' <span class="muted">(eine alte Schaluppe vom Klabautermann)</span>' : ''}</li>
        <li>${SF.icon('cannon')} ${r.cannons} Kanonen</li>
        <li>${SF.icon('barrel')} ${SF.formatDecimal(r.food, 0, 1)} Fässer Proviant${r.bread ? ` <span class="muted">(davon ${r.bread} Brote)</span>` : ''}</li>
        <li>${SF.icon('cloth')} ${r.cargo.cloth || 0} Kisten Tuch</li>
      </ul>
      <button type="button" class="btn btn-primary" id="ld-result-next">Weiter</button>
    </div>`;
    $('ld-result').hidden = false;
    $('ld-result-next').addEventListener('click', () => {
      $('ld-result').hidden = true;
      session = null;
      SF.main.evening();
    }, { once: true });
  }

  function bind() {
    $('ld-go').addEventListener('click', () => go());
    $('ld-grid').addEventListener('click', e => {
      const btn = e.target.closest('.ld-item');
      if (btn) tapItem(btn);
    });
    $('ld-done').addEventListener('click', async () => {
      if (!session || session.over || !$('ld-intro').hidden) return;
      const ok = await SF.ui.confirm('Schon fertig?', '<p>Die Dublonen, die übrig bleiben, sind heute Abend fast nichts mehr wert.</p>', 'Ablegen', 'Weiter einkaufen');
      if (ok) finish();
    });
  }

  SF.lastday = { DOUBLING, DURATION, START_MONEY, MIN_FOOD, BASE_AMBER, EXCHANGE_RATE, EXCHANGE_MAX, ITEMS, create, price, headStart, room, whyNot, buy, anythingLeft, result, apply, start, bind, finish };
})();
