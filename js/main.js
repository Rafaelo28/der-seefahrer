// Start, Ablauf der Story-Abschnitte, Spielschleife und automatisches Speichern.
window.SF = window.SF || {};

(function () {
  const $ = id => document.getElementById(id);
  let lastFrame = 0;
  let saveClock = 0;

  // ---------- Ablauf ----------

  function prolog() {
    SF.track('seefahrer-prolog');
    SF.story.play(SF.story.prologScenes(), () => {
      SF.story.setStep('lastday');
      SF.lastday.start();
    });
  }

  function evening() {
    const r = SF.state.lastDay || { leftover: 0, exchange: 0, amber: SF.lastday.BASE_AMBER };
    SF.story.play(SF.story.eveningScenes(r), () => {
      if (SF.story.step() === 'evening') {
        SF.story.setStep('find-amberbay', 'Der Klabautermann flüstert: Der Dieb ist mit schwarzen Segeln nach Nordosten gesegelt. In der Bernsteinbucht fragen!');
      }
      toSea();
    });
  }

  // Auf See (bzw. im Hafen, in dem das Schiff liegt)
  function toSea() {
    if (SF.sea) {
      if (SF.state.docked && SF.harbor) SF.harbor.open(SF.state.docked);
      else SF.sea.open();
      return;
    }
    $('soon-text').innerHTML = `<p>Du hast abgelegt! Die <b>Seekarte</b>, die Häfen und die Jagd nach dem Dieb kommen im nächsten Schritt.</p>
      <p>Dein Schiff: <b>${SF.ships.type().name}</b> · ${SF.formatDecimal(SF.state.food, 0, 1)} Fässer Proviant · ${SF.amberHTML(SF.state.amber)}</p>`;
    SF.ui.show('soon');
  }

  // Weiterspielen: dort einsteigen, wo die Story steht
  function resume() {
    if (SF.chapter) SF.chapter.migrate();
    if (!SF.state.started) {
      SF.newgame.showTitle();
      return;
    }
    switch (SF.story.step()) {
      case 'new':
      case 'prolog': prolog(); break;
      case 'lastday': SF.lastday.start(); break;
      case 'evening': evening(); break;
      default: toSea();
    }
  }

  function syncSoundButtons() {
    document.querySelectorAll('.sound-toggle').forEach(b => { b.innerHTML = SF.icon(SF.state.settings.sound ? 'sound' : 'mute'); });
  }

  // ---------- Spielschleife ----------

  function frame(now) {
    const dt = Math.min(0.1, Math.max(0, (now - (lastFrame || now)) / 1000));
    lastFrame = now;
    if (SF.state.started && document.visibilityState !== 'hidden') {
      SF.state.playTime += dt;
      saveClock += dt;
      if (saveClock >= 5) {
        saveClock = 0;
        SF.save();
      }
    }
    if (SF.sea && SF.ui.current() === 'sea') SF.sea.frame(dt, now);
    if (SF.battleView && SF.ui.current() === 'battle') SF.battleView.frame(dt);
    if (SF.boarding && SF.ui.current() === 'boarding') SF.boarding.frame(dt);
    if (SF.island && SF.ui.current() === 'island') SF.island.frame(dt);
    if (SF.dive && SF.ui.current() === 'dive') SF.dive.frame(dt);
    requestAnimationFrame(frame);
  }

  function boot() {
    // Symbole in die Platzhalter im HTML setzen (<i data-ic="…">)
    document.querySelectorAll('[data-ic]').forEach(el => { el.outerHTML = SF.icon(el.dataset.ic); });
    SF.load();
    if (SF.chapter) SF.chapter.migrate();
    SF.story.bind();
    SF.lastday.bind();
    SF.newgame.bind();
    if (SF.sea) SF.sea.bind();
    if (SF.harbor) SF.harbor.bind();
    if (SF.cabin) SF.cabin.bind();
    if (SF.battleView) SF.battleView.bind();
    if (SF.boarding) SF.boarding.bind();
    if (SF.island) SF.island.bind();
    if (SF.dive) SF.dive.bind();
    $('soon-title').addEventListener('click', () => SF.newgame.showTitle());
    syncSoundButtons();
    // Speichern beim Verlassen (Tab wechseln, App schließen, Neuladen)
    const saveNow = () => { if (SF.state.started) SF.save(); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
    window.addEventListener('pagehide', saveNow);
    // Doppeltipp-Zoom verhindert das CSS (touch-action: manipulation) – schnelles Tippen bleibt so möglich
    if (!SF.storageAvailable) SF.ui.toast(SF.icon('warning') + ' Dieser Browser erlaubt kein Speichern – sichere deinen Spielstand als Code!', 6000);
    SF.newgame.showTitle();
    requestAnimationFrame(frame);
  }

  SF.main = { prolog, evening, toSea, resume, syncSoundButtons };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
