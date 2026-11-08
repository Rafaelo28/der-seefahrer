// Oberfläche: Bildschirme wechseln, Meldungen (Toast), Fenster (Dialog) und der Klabautermann als Tipp-Geber.
window.SF = window.SF || {};

(function () {
  const $ = id => document.getElementById(id);
  let current = '';
  const onShow = {}; // Bildschirm-ID → Funktion beim Öffnen
  const onHide = {};

  // Bildschirm zeigen (alle anderen verstecken)
  function show(id) {
    if (current === id) return;
    if (current && onHide[current]) onHide[current]();
    document.querySelectorAll('.screen').forEach(el => { el.hidden = el.id !== 'screen-' + id; });
    current = id;
    document.body.dataset.screen = id;
    hideTip();
    window.scrollTo(0, 0);
    if (onShow[id]) onShow[id]();
  }

  function register(id, show, hide) {
    if (show) onShow[id] = show;
    if (hide) onHide[id] = hide;
  }

  // ---------- Meldungen ----------

  let toastTimer = null;
  function toast(html, ms = 2600) {
    const box = $('toast');
    if (!box) return;
    box.innerHTML = html;
    box.classList.remove('show');
    void box.offsetWidth; // Animation neu starten
    box.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('show'), ms);
  }

  // ---------- Fenster ----------

  // dialog({ title, html, buttons: [{ label, value, kind }] }) → Promise mit dem value des gedrückten Knopfs.
  // Mit input: true gibt es ein Textfeld (Ergebnis: { value, text }).
  function dialog(opts) {
    return new Promise(resolve => {
      const layer = $('dialog-layer');
      const buttons = opts.buttons || [{ label: 'OK', value: true, kind: 'primary' }];
      layer.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        ${opts.title ? `<h2 id="dialog-title">${opts.title}</h2>` : ''}
        <div class="dialog-body">${opts.html || ''}</div>
        ${opts.input ? `<textarea class="dialog-input" rows="${opts.rows || 4}" placeholder="${opts.placeholder || ''}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"${opts.readonly ? ' readonly' : ''}>${opts.value || ''}</textarea>` : ''}
        <div class="dialog-buttons">${buttons.map((b, i) => `<button type="button" class="btn ${b.kind === 'primary' ? 'btn-primary' : b.kind === 'danger' ? 'btn-danger' : ''}" data-i="${i}">${b.label}</button>`).join('')}</div>
      </div>`;
      layer.hidden = false;
      const input = layer.querySelector('.dialog-input');
      if (input && opts.readonly) input.addEventListener('focus', () => input.select());
      const close = value => {
        if (openClose === close) openClose = null;
        layer.hidden = true;
        layer.innerHTML = '';
        resolve(opts.input ? { value, text: input ? input.value : '' } : value);
      };
      openClose = close;
      layer.querySelectorAll('[data-i]').forEach(btn => btn.addEventListener('click', () => {
        if (SF.sound) SF.sound.play('tap');
        close(buttons[Number(btn.dataset.i)].value);
      }));
      if (opts.onOpen) opts.onOpen(layer);
    });
  }

  // Offenes Fenster von außen schließen (z. B. „Warte auf deinen Freund …“, sobald er da ist)
  let openClose = null;
  function closeDialog(value) {
    if (openClose) openClose(value);
  }

  const confirm = (title, html, yes = 'Ja', no = 'Abbrechen', kind = 'primary') =>
    dialog({ title, html, buttons: [{ label: no, value: false }, { label: yes, value: true, kind }] });

  // Text in die Zwischenablage (für Spielstand-Codes); false, wenn der Browser es nicht erlaubt
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- Klabautermann ----------

  // Kleiner Schiffsgeist mit Südwester, rotem Bart und Laterne (SVG, ohne IDs)
  const KLABAUTER = `<svg class="klabauter-svg" viewBox="0 0 64 72" aria-hidden="true">
    <ellipse cx="32" cy="68" rx="16" ry="3" fill="rgba(0,0,0,.25)"/>
    <path d="M18 66 C18 50 22 44 32 44 C42 44 46 50 46 66 Z" fill="#2c5d8a" stroke="rgba(0,0,0,.5)" stroke-width="1.2"/>
    <path d="M30 46 L32 60 L34 46" fill="#e8d9a8"/>
    <circle cx="32" cy="32" r="13" fill="#f2c9a0" stroke="rgba(0,0,0,.5)" stroke-width="1.2"/>
    <path d="M19 34 C19 50 26 54 32 56 C38 54 45 50 45 34 C41 40 36 41 32 41 C28 41 23 40 19 34 Z" fill="#c8552d" stroke="rgba(0,0,0,.45)" stroke-width="1"/>
    <path d="M27 40 C30 42 34 42 37 40" stroke="#7a2a12" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <circle cx="27" cy="31" r="2" fill="#1d1d1d"/><circle cx="37" cy="31" r="2" fill="#1d1d1d"/>
    <circle cx="27.7" cy="30.3" r=".6" fill="#fff"/><circle cx="37.7" cy="30.3" r=".6" fill="#fff"/>
    <ellipse cx="32" cy="35.5" rx="2.6" ry="2" fill="#e0a07a"/>
    <path d="M12 24 C14 14 22 8 32 8 C42 8 50 14 52 24 C46 21 40 20 32 20 C24 20 18 21 12 24 Z" fill="#f2c230" stroke="rgba(0,0,0,.5)" stroke-width="1.2"/>
    <path d="M10 25 C20 21 44 21 54 25 C50 28 14 28 10 25 Z" fill="#e0ad1a" stroke="rgba(0,0,0,.5)" stroke-width="1"/>
    <path d="M50 46 L50 52" stroke="#4a3520" stroke-width="1.6"/>
    <rect x="45" y="52" width="10" height="12" rx="2" fill="#3a2a18" stroke="#1a1008" stroke-width="1"/>
    <rect x="47" y="54" width="6" height="8" rx="1" fill="#ffd25e" class="flicker"/>
    <path d="M44 50 C46 47 48 46 50 46" stroke="#f2c9a0" stroke-width="3" stroke-linecap="round" fill="none"/>
  </svg>`;

  // Tipp vom Klabautermann unten auf dem Bildschirm (verschwindet nach ms oder beim Antippen)
  let tipTimer = null;
  function tip(html, ms = 7000) {
    const box = $('klabauter-tip');
    if (!box) return;
    box.innerHTML = `<div class="klabauter-figure">${KLABAUTER}</div><div class="bubble">${html}</div>`;
    box.hidden = false;
    box.classList.remove('show');
    void box.offsetWidth;
    box.classList.add('show');
    clearTimeout(tipTimer);
    if (ms) tipTimer = setTimeout(hideTip, ms);
  }

  function hideTip() {
    const box = $('klabauter-tip');
    if (box) {
      box.classList.remove('show');
      box.hidden = true;
    }
  }

  // Tipp nur einmal pro Spielstand zeigen
  function tipOnce(key, html, ms) {
    const tips = SF.state.ui.tips;
    if (tips[key]) return false;
    tips[key] = 1;
    tip(html, ms);
    return true;
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', e => {
      if (e.target.closest && e.target.closest('#klabauter-tip')) hideTip();
    });
  }

  SF.ui = { $, show, register, current: () => current, toast, dialog, closeDialog, confirm, copy, KLABAUTER, tip, tipOnce, hideTip };
  SF.toast = toast;
})();
