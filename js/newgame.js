// Titelbild und neues Spiel: Gamble-Klicker-Spielstand finden (automatisch oder per Code), Kapitän anlegen
// (Name und Figur), dann beginnt der Prolog. Übernommen wird einmal pro neuem Spielstand.
window.SF = window.SF || {};

(function () {
  const $ = id => document.getElementById(id);
  let found = null;   // Zusammenfassung des gefundenen Gamble-Klicker-Spielstands
  let figCode = '';
  let pending = null; // gewählte Übernahme (Zusammenfassung oder null = ohne)

  // ---------- Titelbild ----------

  function showTitle() {
    SF.ui.show('title');
    const started = SF.state.started;
    $('title-continue').hidden = !started;
    $('title-new').classList.toggle('btn-primary', !started);
    $('title-continue').classList.toggle('btn-primary', started);
    SF.setHTML($('title-info'), started
      ? `Kapitän ${SF.escape(SF.state.captain.name)} · ${SF.amberHTML(SF.state.amber)}`
      : '');
  }

  // ---------- Neues Spiel ----------

  async function newGame() {
    if (SF.state.started) {
      const ok = await SF.ui.confirm('Neues Abenteuer?', '<p>Dein jetziger Spielstand im Seefahrer wird dabei <b>überschrieben</b>. Sichere ihn vorher in der Kajüte als Code, wenn du ihn behalten willst.</p><p class="muted">Gamble Klicker bleibt, wie es ist.</p>', 'Neu anfangen', 'Abbrechen', 'danger');
      if (!ok) return;
    }
    found = SF.gk.summarize(SF.gk.readLocal(), 'auto');
    SF.ui.show('newgame');
    renderImport();
    SF.track('seefahrer-neues-spiel');
  }

  function gkCard(g) {
    const t = SF.gk.trophies(g.bossLevel);
    const trophies = [t.kraken ? `Kraken-König ×${t.kraken}` : '', t.dragon ? `Seedrache ×${t.dragon}` : ''].filter(Boolean).join(' · ');
    return `<div class="gk-card">
      <div class="gk-fig">${SF.figure.svg(g.fig || SF.figure.DEFAULT)}</div>
      <div class="gk-facts">
        <div class="gk-name">${SF.escape(g.name || 'Namenlos')}</div>
        <div class="gk-title">${SF.rank.name(g.rank)}</div>
        <ul>
          <li>${SF.icon('coin')} ${SF.dublonenHTML(g.money)} <span class="muted">(${SF.formatLong(g.money)})</span></li>
          ${g.ships.length ? `<li>${SF.icon('ship')} Flotte: ${g.ships.map(SF.gk.shipName).join(', ')}</li>` : ''}
          ${g.bossLevel ? `<li>${SF.icon('trophy')} Boss-Stufe ${SF.formatInt(g.bossLevel)}${trophies ? ` · ${trophies}` : ''}</li>` : ''}
          ${g.maps ? `<li>${SF.icon('map')} ${SF.formatNumber(g.maps)} Schatzkarten</li>` : ''}
        </ul>
      </div>
    </div>`;
  }

  function renderImport() {
    const box = $('ng-import');
    if (found) {
      box.innerHTML = `<h2>Spielstand aus Gamble Klicker gefunden!</h2>
        ${gkCard(found)}
        <p class="muted small">Deine Figur wird zum Kapitän, dein Rang zum Titel, deine Dublonen zum Startgeld für den letzten Tag der Dublone.
          Gamble Klicker selbst bleibt unverändert.</p>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" data-act="take">Übernehmen</button>
          <button type="button" class="btn" data-act="code">Anderen Code einfügen</button>
          <button type="button" class="btn" data-act="none">Ohne Gamble Klicker</button>
        </div>`;
    } else {
      box.innerHTML = `<h2>Hast du Gamble Klicker gespielt?</h2>
        <p>Auf diesem Gerät ist kein Spielstand von Gamble Klicker im Browser. Spielst du Gamble Klicker als App vom Home-Bildschirm?
          Dann kopiere dort unter <b>Statistiken → Einstellungen → Exportieren</b> deinen Code und füge ihn hier ein.</p>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" data-act="code">Code einfügen</button>
          <button type="button" class="btn" data-act="none">Ohne Gamble Klicker spielen</button>
        </div>
        <p class="muted small">Ohne alten Spielstand startest du mit 10.000 Dublonen Erspartem – und einer alten Schaluppe gibt es auf jeden Fall.</p>`;
    }
    $('ng-import').hidden = false;
    $('ng-captain').hidden = true;
  }

  async function askCode() {
    const res = await SF.ui.dialog({
      title: 'Code aus Gamble Klicker',
      html: '<p>Füge hier den Export-Code aus Gamble Klicker ein (Statistiken → Einstellungen → Exportieren).</p>',
      input: true,
      placeholder: 'Code einfügen …',
      buttons: [{ label: 'Abbrechen', value: false }, { label: 'Übernehmen', value: true, kind: 'primary' }],
    });
    if (!res.value) return;
    const data = SF.gk.readCode(res.text);
    if (!data) {
      const ours = SF.fromCode(res.text);
      SF.sound.play('denied');
      SF.ui.toast(ours && ours.game === 'der-seefahrer'
        ? 'Das ist ein Code vom Seefahrer – den lädst du auf dem Titelbild unter „Spielstand laden“.'
        : 'Der Code passt nicht. Hast du ihn ganz kopiert?');
      return;
    }
    found = SF.gk.summarize(data, 'code');
    SF.sound.play('discover');
    renderImport();
  }

  // ---------- Kapitän anlegen ----------

  function captain(gk) {
    pending = gk;
    // Figur aus Gamble Klicker (Teile, die man dort hatte, sind frei) oder Käpt'n-Vorlage
    figCode = gk && gk.fig ? SF.figure.allowed(gk.fig, gk) : SF.figure.PRESETS[1].code;
    $('ng-name').value = gk && gk.name ? gk.name : '';
    $('ng-import').hidden = true;
    $('ng-captain').hidden = false;
    $('ng-title').textContent = gk ? SF.rank.title(gk.rank) : 'Landratte';
    renderFigure();
  }

  function renderFigure() {
    $('ng-fig').innerHTML = SF.figure.svg(figCode);
    const p = SF.figure.parse(figCode);
    $('ng-slots').innerHTML = SF.figure.SLOTS.map((slot, i) => `<div class="ng-slot">
      <button type="button" class="btn btn-icon" data-slot="${i}" data-dir="-1" aria-label="${slot.name} zurück">‹</button>
      <span><span class="muted small">${slot.name}</span><br>${slot.parts[p[i]].name}</span>
      <button type="button" class="btn btn-icon" data-slot="${i}" data-dir="1" aria-label="${slot.name} weiter">›</button>
    </div>`).join('');
  }

  async function start() {
    const name = $('ng-name').value.replace(/\s+/g, ' ').trim().slice(0, 16);
    if (!name) {
      SF.sound.play('denied');
      SF.ui.toast('Wie heißt du, Kapitän?');
      $('ng-name').focus();
      return;
    }
    // Nach dem ersten Durchspielen: normal oder schwer?
    let hard = false;
    if (SF.meta && SF.meta.hardUnlocked()) {
      hard = await SF.ui.dialog({
        title: 'Wie schwer soll es werden?',
        html: `<p><b>Schwer-Modus:</b> stärkere Piraten (mehr Rumpf, zielen besser), Proviant reicht kürzer, weniger Zeit an Land und beim Entern.</p>`,
        buttons: [{ label: 'Normal', value: false }, { label: `${SF.icon('skull')} Schwer`, value: true, kind: 'danger' }],
      });
    }
    const keep = { settings: SF.state.settings };
    SF.state = SF.createDefaultState();
    SF.state.settings = keep.settings;
    SF.state.gk = pending;
    SF.state.started = true;
    SF.state.hard = !!hard;
    SF.state.captain = { name, fig: SF.figure.allowed(figCode, pending) };
    SF.story.setStep('prolog', pending
      ? `Kapitän ${name} (${SF.rank.title(pending.rank)}) kommt aus Gamble Klicker nach Port Dublone.`
      : `Kapitän ${name} kommt mit 10.000 Dublonen Erspartem nach Port Dublone.`);
    SF.track(pending ? 'seefahrer-mit-gamble-klicker' : 'seefahrer-ohne-gamble-klicker');
    SF.main.prolog();
  }

  function bind() {
    $('title-new').addEventListener('click', () => { SF.sound.play('tap'); newGame(); });
    $('title-continue').addEventListener('click', () => { SF.sound.play('tap'); SF.main.resume(); });
    $('title-load').addEventListener('click', async () => {
      const res = await SF.ui.dialog({
        title: 'Spielstand laden',
        html: '<p>Füge hier einen Spielstand-Code vom Seefahrer ein (Kajüte → Spielstand).</p>',
        input: true, placeholder: 'Code einfügen …',
        buttons: [{ label: 'Abbrechen', value: false }, { label: 'Laden', value: true, kind: 'primary' }],
      });
      if (!res.value) return;
      const r = SF.importSave(res.text);
      if (r === 'ok') {
        SF.ui.toast('Spielstand geladen!');
        SF.main.resume();
      } else {
        SF.sound.play('denied');
        SF.ui.toast(r === 'gk' ? 'Das ist ein Code aus Gamble Klicker – den fügst du bei „Neues Abenteuer“ ein.' : 'Der Code passt nicht.');
      }
    });
    $('title-sound').addEventListener('click', () => {
      SF.sound.setEnabled(!SF.state.settings.sound);
      SF.main.syncSoundButtons();
    });
    $('ng-import').addEventListener('click', e => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      SF.sound.play('tap');
      if (act.dataset.act === 'take') captain(found);
      else if (act.dataset.act === 'none') captain(null);
      else askCode();
    });
    $('ng-back').addEventListener('click', () => { SF.sound.play('tap'); renderImport(); });
    $('ng-slots').addEventListener('click', e => {
      const b = e.target.closest('[data-slot]');
      if (!b) return;
      SF.sound.play('tap');
      figCode = SF.figure.step(figCode, Number(b.dataset.slot), Number(b.dataset.dir), pending);
      renderFigure();
    });
    $('ng-presets').innerHTML = SF.figure.PRESETS.map((p, i) => `<button type="button" class="btn btn-small" data-preset="${i}">${p.name}</button>`).join('') +
      `<button type="button" class="btn btn-small" data-preset="gk">Aus Gamble Klicker</button><button type="button" class="btn btn-small" data-preset="rnd">${SF.icon('dice')} Zufall</button>`;
    $('ng-presets').addEventListener('click', e => {
      const b = e.target.closest('[data-preset]');
      if (!b) return;
      SF.sound.play('tap');
      const v = b.dataset.preset;
      if (v === 'rnd') figCode = SF.figure.randomCode(pending);
      else if (v === 'gk') {
        if (!pending || !pending.fig) { SF.ui.toast('Ohne Gamble-Klicker-Spielstand gibt es keine alte Figur.'); return; }
        figCode = SF.figure.allowed(pending.fig, pending);
      } else figCode = SF.figure.allowed(SF.figure.PRESETS[Number(v)].code, pending);
      renderFigure();
    });
    $('ng-start').addEventListener('click', () => { SF.sound.play('tap'); start(); });
    $('ng-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('ng-name').blur(); } });
  }

  SF.newgame = { showTitle, newGame, bind };
})();
