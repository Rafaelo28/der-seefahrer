// Kajüte: Kapitän mit Titel, Schiff, Trophäen aus Gamble Klicker, gestohlene Flotte, Logbuch, Statistik,
// Einstellungen und Spielstand (Code sichern und laden).
window.SF = window.SF || {};

(function () {
  const $ = id => document.getElementById(id);

  function open() {
    SF.ui.show('cabin');
    render();
  }

  function back() {
    SF.sound.play('tap');
    if (SF.state.docked) SF.harbor.open(SF.state.docked);
    else SF.sea.open();
  }

  function render() {
    const s = SF.state;
    const gk = s.gk;
    const st = SF.ships.stats();
    const t = SF.ships.type();
    const title = gk ? SF.rank.title(gk.rank) : 'Landratte';
    let trophies = '<p class="muted small">Noch keine Trophäen. In Gamble Klicker gab es sie für besiegte Bosse.</p>';
    if (gk && gk.bossLevel) {
      const tr = SF.gk.trophies(gk.bossLevel);
      trophies = `<div class="trophies">
        ${tr.kraken ? `<div class="trophy"><span>🐙</span>Kraken-König${tr.kraken > 1 ? ` ×${tr.kraken}` : ''}</div>` : ''}
        ${tr.dragon ? `<div class="trophy"><span>🐉</span>Seedrache${tr.dragon > 1 ? ` ×${tr.dragon}` : ''}</div>` : ''}
        <div class="trophy"><span>🦑</span>${SF.formatInt(tr.monsters)} Seeungeheuer</div>
      </div><p class="muted small">Aus Gamble Klicker: Boss-Stufe ${SF.formatInt(gk.bossLevel)} besiegt.</p>`;
    }
    const fleet = gk && gk.ships.length
      ? `<ul class="fleet-list">${gk.ships.map(id => `<li>${SF.ships.sideSVG(id)}<span>${SF.gk.shipName(id)}<br><span class="muted small">gestohlen</span></span></li>`).join('')}</ul>
        <p class="muted small">Der Schatten hat deine alte Flotte aus Gamble Klicker gestohlen. Halte die Augen offen!</p>`
      : '<p class="muted small">Du hattest keine Flotte in Gamble Klicker.</p>';
    const wallpaper = s.lastDay && s.lastDay.leftover > 0
      ? `<p class="small">🖼️ Die Wände sind mit alten Dublonen-Scheinen tapeziert: ${SF.dublonenHTML(s.lastDay.leftover)} – nichts mehr wert, aber hübsch.</p>` : '';
    const log = s.story.log.slice().reverse().map(e => `<li><span class="muted small">Tag ${e.day}</span> ${SF.escape(e.text)}</li>`).join('');
    const known = Math.round(SF.world.explored() * 100);
    $('cabin-body').innerHTML = `
      <div class="card cabin-captain">
        <div class="cabin-fig">${SF.figure.svg(SF.figure.mine())}</div>
        <div>
          <h2>Kapitän ${SF.escape(s.captain.name)}</h2>
          <div class="cabin-title">${gk ? SF.rank.icon(gk.rank) + ' ' : ''}${title}</div>
          <div class="cabin-ship">${SF.ships.sideSVG(t.id, SF.cosmetics.shipColors())}<span><b>${t.name}</b><br>
            <span class="small">Tempo ${Math.round(st.speed)} · 📦 ${SF.ships.cargoCount()}/${st.hold} · 🛢️ ${SF.formatDecimal(s.food, 1, 1)}/${st.food} · 💣 ${st.cannons}/${st.cannonSlots}</span></span></div>
          <div>${SF.amberHTML(s.amber)}${s.pearls ? ` · 🦪 ${SF.formatInt(s.pearls)} Perlen` : ''}</div>
          ${wallpaper}
        </div>
      </div>
      <div class="card"><h3>🧭 Auftrag</h3><p>${SF.story.goalText() || 'Folge der Spur des Diebes!'}</p></div>
      <div class="cabin-grid">
        <div class="card"><h3>🏆 Trophäen</h3>${trophies}</div>
        <div class="card"><h3>⛵ Alte Flotte</h3>${fleet}</div>
      </div>
      <div class="card"><h3>📜 Logbuch</h3><ul class="logbook">${log || '<li class="muted">Noch leer.</li>'}</ul></div>
      <div class="card"><h3>📊 Statistik</h3>
        <dl class="stats">
          <dt>Gesegelt</dt><dd>${SF.formatInt(s.stats.distance / 10)} Seemeilen</dd>
          <dt>Karte aufgedeckt</dt><dd>${known} %</dd>
          <dt>Orte entdeckt</dt><dd>${Object.keys(s.visited).length} / ${SF.world.PLACES.length}</dd>
          <dt>Handel</dt><dd>${SF.formatInt(s.stats.trades)} Kisten · Gewinn ${SF.amberHTML(s.stats.profit)}</dd>
          <dt>Treibgut</dt><dd>${SF.formatInt(s.stats.flotsam)}</dd>
          <dt>Seeschlachten</dt><dd>${SF.formatInt(s.stats.wins || 0)} gewonnen von ${SF.formatInt(s.stats.battles || 0)} · Kopfgeld ${SF.amberHTML(s.stats.bounty || 0)}</dd>
          <dt>Tauchgänge</dt><dd>${SF.formatInt(s.stats.dives || 0)} · ${SF.formatInt(s.stats.pearls || 0)} Perlen</dd>
          <dt>Inseln</dt><dd>${Object.entries(s.islands || {}).map(([id, r]) => `${SF.island.LEVELS[id].name}: Bestzeit ${SF.formatDecimal(r.best, 1, 1)} s`).join(' · ') || '–'}</dd>
          <dt>Bernstein verdient</dt><dd>${SF.amberHTML(s.stats.amberEarned)}</dd>
          <dt>Spielzeit</dt><dd>${SF.formatDuration(s.playTime)}</dd>
        </dl>
      </div>
      <div class="card"><h3>⚙️ Einstellungen und Spielstand</h3>
        <label class="setting"><span>🔊 Ton</span><input type="checkbox" class="switch" id="cabin-sound" ${s.settings.sound ? 'checked' : ''}></label>
        <p class="muted small">Dein Spielstand wird automatisch im Browser gespeichert. Sichere ihn ab und zu als Code –
          damit kannst du auch auf einem anderen Gerät weiterspielen.</p>
        <div class="btn-row">
          <button type="button" class="btn" id="cabin-export">Spielstand als Code</button>
          <button type="button" class="btn" id="cabin-import">Code laden</button>
          <button type="button" class="btn" id="cabin-title">Zum Titelbild</button>
        </div>
      </div>`;
    $('cabin-sound').addEventListener('change', e => SF.sound.setEnabled(e.target.checked));
    $('cabin-export').addEventListener('click', exportCode);
    $('cabin-import').addEventListener('click', importCode);
    $('cabin-title').addEventListener('click', () => { SF.save(); SF.newgame.showTitle(); });
  }

  async function exportCode() {
    SF.save();
    const code = SF.exportSave();
    const copied = await SF.ui.copy(code);
    SF.ui.dialog({
      title: 'Dein Spielstand',
      html: `<p>${copied ? '✅ Der Code ist kopiert.' : 'Kopiere diesen Code'} und bewahre ihn gut auf (z. B. in den Notizen).</p>`,
      input: true, value: code, readonly: true, rows: 6,
      buttons: [{ label: 'Fertig', value: true, kind: 'primary' }],
    });
  }

  async function importCode() {
    const res = await SF.ui.dialog({
      title: 'Spielstand laden',
      html: '<p>Füge einen Spielstand-Code vom Seefahrer ein. <b>Dein jetziger Spielstand wird ersetzt.</b></p>',
      input: true, placeholder: 'Code einfügen …',
      buttons: [{ label: 'Abbrechen', value: false }, { label: 'Laden', value: true, kind: 'danger' }],
    });
    if (!res.value) return;
    const r = SF.importSave(res.text);
    if (r === 'ok') {
      SF.ui.toast('Spielstand geladen!');
      SF.main.resume();
    } else {
      SF.sound.play('denied');
      SF.ui.toast(r === 'gk' ? 'Das ist ein Code aus Gamble Klicker – den gibt es nur beim neuen Abenteuer.' : 'Der Code passt nicht.');
    }
  }

  function bind() {
    $('cabin-back').addEventListener('click', back);
  }

  SF.cabin = { open, render, bind };
})();
