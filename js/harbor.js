// Hafen-Bildschirm: Markt (Waren kaufen und verkaufen), Proviant, Werft (Ausbau, Kanonen, neue Schiffe) und
// Kneipe (Leute, Story, Gerüchte). Ablegen führt zurück auf die Seekarte.
window.SF = window.SF || {};

(function () {
  const $ = id => document.getElementById(id);
  let harbor = '';
  let tab = 'market';

  const HARBOR_ART = {
    dublone: { icon: 'anchor', scene: 'hafen', text: 'Der Hafen von Gamble Klicker. Seit dem Raub ist die Dublone nichts mehr wert – hier zahlt man jetzt mit Bernstein.' },
    amberbay: { icon: 'fish', scene: 'fischer', text: 'Ein Fischerdorf an der Bernsteinküste. Nach Stürmen glänzt der Strand golden vom angespülten Bernstein.' },
    smuggler: { icon: 'skull', scene: 'schmuggler', text: 'Ein Nest aus Holzhütten und Spelunken. Wer hier fragt, woher die Ware kommt, bekommt keine Antwort.' },
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
    // Kapitel 3: Aus der Schiffskasse fehlt etwas
    const theft = SF.chapter ? SF.chapter.onDock(id) : '';
    if (theft) {
      SF.save();
      setTimeout(() => SF.ui.dialog({ title: `${SF.icon('chest')} Die Schiffskasse!`, html: theft, buttons: [{ label: 'Ich finde den Dieb!', value: true, kind: 'primary' }] }), 300);
    }
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
    SF.setHTML($('harbor-icon'), SF.icon(art.icon || 'anchor'));
    SF.setHTML($('harbor-banner'), SF.story.ART[art.scene || 'hafen']());
    SF.setText($('harbor-name'), p.name);
    SF.setHTML($('harbor-text'), art.text || '');
    SF.setHTML($('harbor-stats'), `<span>${SF.amberHTML(s.amber)}</span>
      <span>${SF.icon('barrel')}${SF.formatDecimal(s.food, 1, 1)} / ${st.food}</span>
      <span>${SF.icon('crate')}${SF.ships.cargoCount()} / ${st.hold}</span>
      <span>${SF.icon('shield')}${SF.ships.hullNow()} / ${SF.ships.hullMax()}</span>
      <span class="muted">Tag ${SF.story.day()}</span>`);
    document.querySelectorAll('.harbor-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    const goal = SF.story.goal() === harbor;
    $('harbor-tab-tavern').classList.toggle('story', goal);
    const panel = $('harbor-panel');
    if (tab === 'market') panel.innerHTML = market();
    else if (tab === 'food') panel.innerHTML = food();
    else if (tab === 'yard') panel.innerHTML = yard();
    else if (tab === 'shop') panel.innerHTML = shop();
    else panel.innerHTML = tavernHTML();
  }

  function market() {
    const s = SF.state;
    const T = SF.trade;
    const rows = T.GOODS.map(g => {
      const have = s.cargo[g.id] || 0;
      const why = T.whyNotBuy(harbor, g.id);
      return `<div class="good">
        <div class="good-name"><span class="good-icon">${SF.icon(g.icon)}</span><b>${g.name}</b><span class="muted small">an Bord: ${have}</span></div>
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
        <span class="yard-icon">${SF.icon(u.icon)}</span>
        <div class="yard-info"><b>${u.name}</b> <span class="muted small">Stufe ${lvl} / ${u.max}</span><br><span class="small">${u.text}</span></div>
        <button type="button" class="btn btn-small" data-up="${u.id}" ${cost != null && SF.amber.can(cost) ? '' : 'disabled'}>${cost == null ? 'Voll' : SF.amberHTML(cost)}</button>
      </div>`;
    }).join('');
    const hullNow = SF.ships.hullNow();
    const hullMax = SF.ships.hullMax();
    const rc = SF.ships.repairCost();
    const repair = `<div class="yard-row">
        <span class="yard-icon">${SF.icon('hammer')}</span>
        <div class="yard-info"><b>Rumpf reparieren</b> <span class="muted small">${hullNow} / ${hullMax}</span>
          <div class="hp-bar small-bar"><i style="transform:scaleX(${(hullNow / hullMax).toFixed(3)})"></i></div></div>
        <button type="button" class="btn btn-small" data-repair="1" ${rc > 0 && SF.amber.can(rc) ? '' : 'disabled'}>${rc > 0 ? SF.amberHTML(rc) : 'Heil'}</button>
      </div>`;
    const cannonFull = s.ship.cannons >= st.cannonSlots;
    const cannons = `<div class="yard-row">
        <span class="yard-icon">${SF.icon('cannon')}</span>
        <div class="yard-info"><b>Kanone</b> <span class="muted small">${st.cannons} / ${st.cannonSlots}</span><br><span class="small">Jede Kanone feuert bei jeder Breitseite mit</span></div>
        <button type="button" class="btn btn-small" data-cannon="1" ${!cannonFull && SF.amber.can(SF.ships.CANNON_PRICE) ? '' : 'disabled'}>${cannonFull ? 'Voll' : SF.amberHTML(SF.ships.CANNON_PRICE)}</button>
      </div>`;
    const ships = SF.ships.TYPES.map(x => {
      const mine = x.id === t.id;
      const stolen = x.story && s.gk && s.gk.ships.includes(x.id);
      const inFleet = SF.crew.fleet().some(f => f.type === x.id);
      const why = SF.ships.whyNot(x.id);
      let btn;
      if (mine) btn = '<span class="tag">Dein Schiff</span>';
      else if (inFleet) btn = '<span class="tag">In deiner Flotte</span>';
      else if (x.story) btn = `<span class="muted small">${stolen ? 'Gestohlen – vielleicht findest du es wieder!' : 'Gibt es in keiner Werft'}</span>`;
      else btn = `<button type="button" class="btn btn-small" data-ship="${x.id}" ${why ? 'disabled' : ''} title="${why}">${SF.amberHTML(SF.ships.tradeInPrice(x.id))}</button>`;
      return `<div class="ship-card ${mine ? 'mine' : ''}">
        ${SF.ships.sideSVG(x.id)}
        <div><b>${x.name}</b><br><span class="small stat-line">${SF.icon('crate')}${x.hold} ${SF.icon('barrel')}${x.food} ${SF.icon('cannon')}${x.cannons} ${SF.icon('wind')}${x.speed}</span></div>
        ${btn}
      </div>`;
    }).join('');
    return `<h3>Werft</h3>
      <div class="yard-ship">${SF.ships.sideSVG(t.id, SF.cosmetics.shipColors())}<div><b>${t.name}</b><br>
        <span class="small">Tempo ${Math.round(st.speed)} · Laderaum ${st.hold} · Proviant ${st.food} · Kanonen ${st.cannons}/${st.cannonSlots}</span></div></div>
      ${repair}${ups}${cannons}
      ${fleetHTML()}
      <h3>Neues Schiff</h3>
      <p class="muted small">Dein altes Schiff nimmt die Werft für die Hälfte in Zahlung. Der Ausbau bleibt beim alten Schiff.</p>
      <div class="ship-list">${ships}</div>`;
  }

  // Deine Flotte: wiedergefundene Schiffe liegen hier, Umsteigen kostet nichts
  function fleetHTML() {
    const list = SF.crew.fleet();
    if (!list.length) return '';
    return `<h3>${SF.icon('anchor')} Deine Flotte</h3>
      <p class="muted small">Diese Schiffe liegen hier in der Werft. Umsteigen kostet nichts – jedes Schiff behält seinen Ausbau und seine Kanonen.</p>
      <div class="ship-list">${list.map((f, i) => {
        const t = SF.ships.byId[f.type];
        const st = SF.ships.stats(f);
        const why = SF.crew.whyNotSwap(i);
        return `<div class="ship-card">${SF.ships.sideSVG(f.type)}
          <div><b>${t.name}</b><br><span class="small stat-line">${SF.icon('crate')}${st.hold} ${SF.icon('barrel')}${st.food} ${SF.icon('cannon')}${st.cannons}/${st.cannonSlots} ${SF.icon('wind')}${Math.round(st.speed)}</span></div>
          <button type="button" class="btn btn-small" data-swap="${i}" ${why ? 'disabled' : ''} title="${why}">Umsteigen</button></div>`;
      }).join('')}</div>`;
  }

  // Laden: Cosmetics für Perlen
  function shop() {
    const C = SF.cosmetics;
    const pearls = SF.state.pearls || 0;
    const on = C.data().on;
    const swatch = x => {
      if (x.slot === 'head') return `<span class="cos-swatch">${x.value ? SF.icon(x.value) : '–'}</span>`;
      if (x.slot === 'wake' || x.slot === 'smoke') return `<span class="cos-swatch" style="background:rgb(${x.value})"></span>`;
      const def = x.slot === 'sail' ? SF.ships.type().sail : x.slot === 'hull' ? SF.ships.type().hull : '#16181d';
      return `<span class="cos-swatch" style="background:${x.value || def}"></span>`;
    };
    const rows = C.SLOTS.map(sl => `<div class="cos-slot"><div class="cos-slot-name">${sl.name}</div><div class="cos-items">${
      C.ITEMS.filter(x => x.slot === sl.id).map(x => {
        const owned = C.owns(x.id);
        const active = on[sl.id] === x.id;
        const label = active ? `${SF.icon('check')} an` : owned ? 'Anlegen' : `${SF.icon('pearl')} ${x.price}`;
        return `<button type="button" class="cos-item ${active ? 'active' : ''}" data-cos="${x.id}" ${!owned && pearls < x.price ? 'disabled' : ''}>
          ${swatch(x)}<span class="cos-name">${x.name}</span><span class="cos-price">${label}</span></button>`;
      }).join('')}</div></div>`).join('');
    return `<h3>Laden</h3>
      <div class="yard-ship">${SF.ships.sideSVG(SF.ships.type().id, C.shipColors())}<div><b>Dein Schiff</b><br>
        <span class="small">Du hast <b>${SF.icon('pearl')} ${pearls} Perlen</b>. Perlen findest du beim Tauchen am Korallenriff.</span></div></div>
      ${rows}`;
  }

  function person(who) {
    if (who === 'klabauter') return { name: 'Klabautermann', svg: SF.ui.KLABAUTER };
    const p = SF.chapter.who(who);
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
    } else if (d.swap != null) {
      const before = SF.ships.type().name;
      ok = SF.crew.swap(Number(d.swap));
      if (ok) { SF.sound.play('horn'); SF.ui.toast(`Umgestiegen: Deine ${SF.ships.type().name} ist bereit, die ${before} wartet in der Werft.`); }
    } else if (d.repair) {
      ok = SF.ships.repair();
      if (ok) SF.sound.play('upgrade');
    } else if (d.cannon) {
      ok = SF.ships.buyCannon();
      if (ok) SF.sound.play('buy');
    } else if (d.ship) {
      buyShip(d.ship);
      return;
    } else if (d.cos) {
      const C = SF.cosmetics;
      if (C.owns(d.cos)) { ok = C.equip(d.cos); if (ok) SF.sound.play('tap'); }
      else { ok = C.buy(d.cos); if (ok) { SF.sound.play('fanfare'); SF.ui.toast(`Gekauft: ${C.byId[d.cos].name}`); SF.track('seefahrer-cosmetic'); } }
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
