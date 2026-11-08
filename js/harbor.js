// Hafen-Bildschirm: Markt (Waren kaufen und verkaufen), Proviant, Werft (Ausbau, Kanonen, neue Schiffe) und
// Kneipe (Leute, Story, Gerüchte). Ablegen führt zurück auf die Seekarte.
window.SF = window.SF || {};

(function () {
  const $ = id => document.getElementById(id);
  let harbor = '';
  let tab = 'market';

  const HARBOR_ART = {
    dublone: { icon: '🏛️', text: 'Der Hafen von Gamble Klicker. Seit dem Raub ist die Dublone nichts mehr wert – hier zahlt man jetzt mit Bernstein.' },
    amberbay: { icon: '🐟', text: 'Ein Fischerdorf an der Bernsteinküste. Nach Stürmen glänzt der Strand golden vom angespülten Bernstein.' },
    smuggler: { icon: '🏴‍☠️', text: 'Ein Nest aus Holzhütten und Spelunken. Wer hier fragt, woher die Ware kommt, bekommt keine Antwort.' },
  };

  function open(id) {
    const s = SF.state;
    const p = SF.world.placeById[id];
    if (!p || !p.harbor) return;
    harbor = id;
    s.docked = id;
    s.course = [];
    s.pos = Object.assign(s.pos || {}, { x: p.x, y: p.y });
    if (!s.visited[id]) {
      s.visited[id] = Date.now();
      s.stats.places = Object.keys(s.visited).length;
      SF.story.log(`Zum ersten Mal in ${p.name} angelegt.`);
    }
    // Hier wartet die Story? Dann gleich in die Kneipe
    tab = SF.story.goal() === id ? 'tavern' : 'market';
    SF.ui.show('harbor');
    render();
    SF.save();
    SF.track('seefahrer-hafen-' + id);
    if (s.food < 1.5) setTimeout(() => SF.ui.tip('Dein Proviant ist knapp – kauf unter <b>Proviant</b> neue Fässer, bevor du ablegst.', 6000), 300);
    else SF.ui.tipOnce('harbor-first', 'Im <b>Markt</b> kaufst du Waren billig ein und verkaufst sie in einem anderen Hafen teurer. In der <b>Kneipe</b> hört man Neuigkeiten!', 8000);
  }

  function leave() {
    SF.sound.play('horn');
    SF.ui.hideTip();
    if (SF.state.food <= 0) SF.ui.toast('Ohne Proviant ist die Crew langsam und mürrisch!');
    SF.sea.open();
  }

  // ---------- Anzeigen ----------

  function render() {
    const s = SF.state;
    const p = SF.world.placeById[harbor];
    const art = HARBOR_ART[harbor] || {};
    const st = SF.ships.stats();
    SF.setText($('harbor-icon'), art.icon || '⚓');
    SF.setText($('harbor-name'), p.name);
    SF.setHTML($('harbor-text'), art.text || '');
    SF.setHTML($('harbor-stats'), `<span>${SF.amberHTML(s.amber)}</span>
      <span>🛢️ ${SF.formatDecimal(s.food, 1, 1)} / ${st.food}</span>
      <span>📦 ${SF.ships.cargoCount()} / ${st.hold}</span>
      <span class="muted">Tag ${SF.story.day()}</span>`);
    document.querySelectorAll('.harbor-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    const goal = SF.story.goal() === harbor;
    $('harbor-tab-tavern').classList.toggle('story', goal);
    const panel = $('harbor-panel');
    if (tab === 'market') panel.innerHTML = market();
    else if (tab === 'food') panel.innerHTML = food();
    else if (tab === 'yard') panel.innerHTML = yard();
    else panel.innerHTML = tavernHTML();
  }

  function market() {
    const s = SF.state;
    const T = SF.trade;
    const rows = T.GOODS.map(g => {
      const have = s.cargo[g.id] || 0;
      const why = T.whyNotBuy(harbor, g.id);
      return `<div class="good">
        <div class="good-name"><span class="good-icon">${g.icon}</span><b>${g.name}</b><span class="muted small">an Bord: ${have}</span></div>
        <button type="button" class="btn good-buy" data-buy="${g.id}" ${why ? 'disabled' : ''} title="${why}">Kaufen<br>${SF.amberHTML(T.buyPrice(harbor, g.id))}</button>
        <button type="button" class="btn good-sell" data-sell="${g.id}" ${have ? '' : 'disabled'}>Verkaufen<br>${SF.amberHTML(T.sellPrice(harbor, g.id))}</button>
      </div>`;
    }).join('');
    return `<h3>Markt</h3>
      <p class="muted small">${T.MARKETS[harbor].text} Jede Kiste, die du kaufst, macht die nächste etwas teurer – verkaufen macht sie billiger.</p>
      <div class="goods">${rows}</div>
      ${SF.ships.cargoCount() ? '<div class="btn-row"><button type="button" class="btn btn-small" data-sell-all="1">Alles verkaufen</button></div>' : ''}`;
  }

  function food() {
    const s = SF.state;
    const st = SF.ships.stats();
    const price = SF.trade.foodPrice(harbor);
    const space = Math.max(0, st.food - s.food);
    const fillCost = Math.ceil(space) * price;
    const pct = Math.round(Math.min(1, s.food / st.food) * 100);
    return `<h3>Proviant</h3>
      <div class="food-bar big"><i style="transform:scaleX(${(pct / 100).toFixed(3)})"></i><span>${SF.formatDecimal(s.food, 1, 1)} / ${st.food} Fässer</span></div>
      <p class="muted small">Ein Fass reicht für ein gutes Stück Seeweg. Ohne Proviant wird das Schiff langsamer und die Crew murrt.
        Hier kostet ein Fass ${SF.amberHTML(price)}.</p>
      <div class="btn-row">
        <button type="button" class="btn" data-food="1" ${space > 0.001 && SF.amber.can(price) ? '' : 'disabled'}>+1 Fass</button>
        <button type="button" class="btn btn-primary" data-food="99" ${space > 0.001 && SF.amber.can(price) ? '' : 'disabled'}>Auffüllen (${SF.amberHTML(fillCost)})</button>
      </div>`;
  }

  function yard() {
    const s = SF.state;
    const t = SF.ships.type();
    const st = SF.ships.stats();
    const ups = SF.ships.UPGRADES.map(u => {
      const lvl = s.ship[u.id] || 0;
      const cost = SF.ships.upgradeCost(u.id);
      return `<div class="yard-row">
        <span class="yard-icon">${u.icon}</span>
        <div class="yard-info"><b>${u.name}</b> <span class="muted small">Stufe ${lvl} / ${u.max}</span><br><span class="small">${u.text}</span></div>
        <button type="button" class="btn btn-small" data-up="${u.id}" ${cost != null && SF.amber.can(cost) ? '' : 'disabled'}>${cost == null ? 'Voll' : SF.amberHTML(cost)}</button>
      </div>`;
    }).join('');
    const cannonFull = s.ship.cannons >= st.cannonSlots;
    const cannons = `<div class="yard-row">
        <span class="yard-icon">💣</span>
        <div class="yard-info"><b>Kanone</b> <span class="muted small">${st.cannons} / ${st.cannonSlots}</span><br><span class="small">Für Seeschlachten (kommen in Stufe 2)</span></div>
        <button type="button" class="btn btn-small" data-cannon="1" ${!cannonFull && SF.amber.can(SF.ships.CANNON_PRICE) ? '' : 'disabled'}>${cannonFull ? 'Voll' : SF.amberHTML(SF.ships.CANNON_PRICE)}</button>
      </div>`;
    const ships = SF.ships.TYPES.map(x => {
      const mine = x.id === t.id;
      const stolen = x.story && s.gk && s.gk.ships.includes(x.id);
      const why = SF.ships.whyNot(x.id);
      let btn;
      if (mine) btn = '<span class="tag">Dein Schiff</span>';
      else if (x.story) btn = `<span class="muted small">${stolen ? 'Gestohlen – vielleicht findest du es wieder!' : 'Gibt es in keiner Werft'}</span>`;
      else btn = `<button type="button" class="btn btn-small" data-ship="${x.id}" ${why ? 'disabled' : ''} title="${why}">${SF.amberHTML(SF.ships.tradeInPrice(x.id))}</button>`;
      return `<div class="ship-card ${mine ? 'mine' : ''}">
        ${SF.ships.sideSVG(x.id)}
        <div><b>${x.name}</b><br><span class="small">📦 ${x.hold} · 🛢️ ${x.food} · 💣 ${x.cannons} · ⛵ ${x.speed}</span></div>
        ${btn}
      </div>`;
    }).join('');
    return `<h3>Werft</h3>
      <div class="yard-ship">${SF.ships.sideSVG(t.id)}<div><b>${t.name}</b><br>
        <span class="small">Tempo ${Math.round(st.speed)} · Laderaum ${st.hold} · Proviant ${st.food} · Kanonen ${st.cannons}/${st.cannonSlots}</span></div></div>
      ${ups}${cannons}
      <h3>Neues Schiff</h3>
      <p class="muted small">Dein altes Schiff nimmt die Werft für die Hälfte in Zahlung. Der Ausbau bleibt beim alten Schiff.</p>
      <div class="ship-list">${ships}</div>`;
  }

  function person(who) {
    if (who === 'klabauter') return { name: 'Klabautermann', svg: SF.ui.KLABAUTER };
    const p = SF.chapter.PEOPLE[who];
    return { name: p.name, svg: SF.figure.svg(p.fig) };
  }

  function tavernHTML() {
    const list = SF.chapter.tavern(harbor);
    return `<h3>Kneipe</h3>` + list.map(e => {
      const p = person(e.who);
      return `<div class="talk">
        <div class="talk-fig">${p.svg}</div>
        <div class="talk-body"><b>${p.name}</b><p>${e.text}</p>
          ${e.action ? `<button type="button" class="btn btn-small ${e.action.disabled ? '' : 'btn-primary'}" data-act="${e.action.id}" ${e.action.disabled ? 'disabled' : ''}>${e.action.label}</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  // ---------- Bedienung ----------

  function onClick(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const d = b.dataset;
    const T = SF.trade;
    let ok = true;
    if (d.buy) {
      ok = !!T.buy(harbor, d.buy);
      if (ok) SF.sound.play('coin');
    } else if (d.sell) {
      ok = !!T.sell(harbor, d.sell);
      if (ok) SF.sound.play('sell');
    } else if (d.sellAll) {
      let sum = 0;
      Object.keys(SF.state.cargo).forEach(g => { while (SF.state.cargo[g] > 0) sum += T.sell(harbor, g) || 0; });
      SF.sound.play('sell');
      SF.ui.toast(`Alles verkauft für ${SF.amberHTML(sum)}`);
    } else if (d.food) {
      ok = T.buyFood(harbor, Number(d.food)) > 0;
      if (ok) SF.sound.play('buy');
    } else if (d.up) {
      ok = SF.ships.buyUpgrade(d.up);
      if (ok) { SF.sound.play('upgrade'); SF.story.log(`Werft: ${SF.ships.UPGRADES.find(u => u.id === d.up).name} ausgebaut.`); }
    } else if (d.cannon) {
      ok = SF.ships.buyCannon();
      if (ok) SF.sound.play('buy');
    } else if (d.ship) {
      buyShip(d.ship);
      return;
    } else if (d.act) {
      const text = SF.chapter.act(harbor, d.act);
      if (text) SF.ui.toast(text, 3500);
    } else {
      return;
    }
    if (!ok) SF.sound.play('denied');
    SF.save();
    render();
  }

  async function buyShip(id) {
    const t = SF.ships.byId[id];
    const price = SF.ships.tradeInPrice(id);
    const ok = await SF.ui.confirm(`${t.name} kaufen?`, `<p>${SF.ships.sideSVG(id)}</p><p>Die Werft nimmt deine ${SF.ships.type().name} in Zahlung.
      Du zahlst ${SF.amberHTML(price)}. Der Ausbau deines alten Schiffs geht mit ihm.</p>`, 'Kaufen');
    if (!ok) return;
    if (SF.ships.buyShip(id)) {
      SF.sound.play('fanfare');
      SF.story.log(`Neues Schiff gekauft: ${t.name}.`);
      SF.ui.toast(`Deine neue ${t.name} liegt im Hafen!`);
      SF.track('seefahrer-schiff-' + id);
      SF.save();
    } else {
      SF.sound.play('denied');
    }
    render();
  }

  function bind() {
    $('harbor-panel').addEventListener('click', onClick);
    document.querySelectorAll('.harbor-tab').forEach(b => b.addEventListener('click', () => {
      tab = b.dataset.tab;
      SF.sound.play('tap');
      render();
    }));
    $('harbor-leave').addEventListener('click', leave);
    $('harbor-cabin').addEventListener('click', () => { SF.sound.play('tap'); SF.cabin.open(); });
  }

  SF.harbor = { open, leave, render, bind, current: () => harbor };
})();
