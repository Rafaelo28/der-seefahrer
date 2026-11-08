// Entern: kurzes Jump'n'Run auf dem Deck des Piratenschiffs (von der Seite). Mit dem Enterhaken schwingt man hinüber,
// dann geht es über Kisten und Fässer bis zur Kapitänskajüte – Piraten kann man von oben besiegen, offene Luken
// meiden. Zeit: 45 Sekunden. Die Spielfigur ist die eigene Figur (aus Gamble Klicker).
// Regeln ohne Bildschirm (create/step, testbar) und Bildschirm (start/frame) in einer Datei.
window.SF = window.SF || {};

(function () {
  const W = 2400;          // Länge des Decks
  const DECK = 480;        // Höhe der Deck-Oberfläche (y nach unten)
  const QUARTER = 400;     // erhöhtes Achterdeck
  const GRAVITY = 1900;
  const JUMP = 760;
  const RUN = 280;
  const PW = 30;           // Spielfigur: Breite …
  const PH = 46;           // … und Höhe
  const TIME = 45;
  const HURT = 4;          // Sekunden Strafe bei Berührung
  const FALL = 3;          // Sekunden Strafe in der Luke

  // Fester Zufall für das Level (gleiches Schiff = gleiches Deck)
  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // Level bauen: feste Hindernisse (Rechtecke), Luken, Piraten, Tür
  function create(kind = 'raider', seed = 7) {
    const rnd = seeded(seed + kind.length * 101);
    const solids = [];
    const hatches = [];
    const crew = { raider: 2, shark: 3, bluebeard: 4 }[kind] || 2;
    // Deck mit Luken
    const holes = [];
    for (let i = 0; i < (kind === 'raider' ? 1 : 2); i++) holes.push(560 + i * 640 + Math.floor(rnd() * 120));
    let x = 0;
    holes.forEach(h => {
      solids.push({ x, y: DECK, w: h - x, h: 120, k: 'deck' });
      hatches.push({ x: h, w: 76 });
      x = h + 76;
    });
    solids.push({ x, y: DECK, w: 1950 - x, h: 120, k: 'deck' });
    solids.push({ x: 1950, y: QUARTER, w: W - 1950, h: 200, k: 'deck' });
    // Kisten und Fässer
    const props = [[300, 'crate'], [420, 'barrel'], [880, 'crate2'], [1100, 'barrel'], [1500, 'crate'], [1700, 'crate2']];
    props.forEach(([px, k]) => {
      const ox = px + Math.floor(rnd() * 60);
      if (hatches.some(h => ox + 70 > h.x - 30 && ox < h.x + h.w + 30)) return;
      if (k === 'barrel') solids.push({ x: ox, y: DECK - 52, w: 40, h: 52, k });
      else if (k === 'crate') solids.push({ x: ox, y: DECK - 60, w: 60, h: 60, k });
      else {
        solids.push({ x: ox, y: DECK - 60, w: 60, h: 60, k: 'crate' });
        solids.push({ x: ox + 10, y: DECK - 110, w: 50, h: 50, k: 'crate' });
      }
    });
    // Piraten: laufen zwischen zwei Punkten hin und her
    const enemies = [];
    for (let i = 0; i < crew; i++) {
      const ex = 650 + i * (1150 / crew) + Math.floor(rnd() * 80);
      const onQuarter = ex > 1950;
      enemies.push({ x: ex, y: (onQuarter ? QUARTER : DECK) - 44, w: 30, h: 44, vx: (i % 2 ? 1 : -1) * (60 + rnd() * 40), x0: ex - 110, x1: ex + 110, alive: true, boss: false });
    }
    if (kind === 'bluebeard') enemies.push({ x: 2180, y: QUARTER - 56, w: 38, h: 56, vx: -70, x0: 2010, x1: 2250, alive: true, boss: true, lives: 2 });
    // Gegner nicht über Luken laufen lassen
    enemies.forEach(e => hatches.forEach(h => {
      if (e.x0 < h.x + h.w && e.x1 > h.x) {
        if (e.x < h.x) e.x1 = Math.min(e.x1, h.x - e.w - 4);
        else e.x0 = Math.max(e.x0, h.x + h.w + 4);
      }
      e.x = Math.min(e.x1, Math.max(e.x0, e.x));
    }));
    return {
      kind, t: 0, time: TIME, over: '',
      p: { x: 60, y: 160, vx: 0, vy: 0, ground: false, face: 1, hurt: 0, safeX: 60 },
      solids, hatches, enemies,
      door: { x: W - 110, y: QUARTER - 90, w: 60, h: 90 },
      stomps: 0,
    };
  }

  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // Ein Schritt. input: { left, right, jump }; gibt Ereignisse zurück
  function step(L, dt, input = {}) {
    const ev = [];
    if (L.over) return ev;
    L.t += dt;
    L.time -= dt;
    const p = L.p;
    p.hurt = Math.max(0, p.hurt - dt);
    // Laufen
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (p.hurt > 0.25) {
      // nach einem Treffer kurz keine Kontrolle
    } else {
      p.vx = dir * RUN;
      if (dir) p.face = dir;
    }
    if (input.jump && p.ground) {
      p.vy = -JUMP;
      p.ground = false;
      ev.push({ type: 'jump' });
    }
    p.vy = Math.min(1400, p.vy + GRAVITY * dt);
    // waagerecht bewegen und an Hindernissen stoppen
    p.x += p.vx * dt;
    p.x = Math.max(0, Math.min(W - PW, p.x));
    let box = { x: p.x, y: p.y, w: PW, h: PH };
    for (const s of L.solids) {
      if (!overlap(box, s)) continue;
      if (p.vx > 0) p.x = s.x - PW;
      else if (p.vx < 0) p.x = s.x + s.w;
      box.x = p.x;
    }
    // senkrecht bewegen
    p.y += p.vy * dt;
    p.ground = false;
    box = { x: p.x, y: p.y, w: PW, h: PH };
    for (const s of L.solids) {
      if (!overlap(box, s)) continue;
      if (p.vy > 0) {
        p.y = s.y - PH;
        p.vy = 0;
        p.ground = true;
        if (s.k === 'deck') p.safeX = p.x;
      } else if (p.vy < 0) {
        p.y = s.y + s.h;
        p.vy = 0;
      }
      box.y = p.y;
    }
    // In eine Luke gefallen
    if (p.y > DECK + 140) {
      L.time -= FALL;
      const h = L.hatches.find(x => p.x + PW > x.x - 40 && p.x < x.x + x.w + 40);
      p.x = h ? h.x - PW - 10 : p.safeX;
      p.y = DECK - PH - 120;
      p.vx = 0;
      p.vy = 0;
      ev.push({ type: 'fall' });
    }
    // Piraten
    for (const e of L.enemies) {
      if (!e.alive) continue;
      e.x += e.vx * dt;
      if (e.x < e.x0) { e.x = e.x0; e.vx = -e.vx; }
      if (e.x > e.x1) { e.x = e.x1; e.vx = -e.vx; }
      const pb = { x: p.x, y: p.y, w: PW, h: PH };
      if (!overlap(pb, e)) continue;
      // von oben draufgesprungen?
      if (p.vy > 0 && p.y + PH - e.y < 24) {
        p.vy = -JUMP * 0.6;
        e.lives = (e.lives || 1) - 1;
        if (e.lives <= 0) e.alive = false;
        L.stomps++;
        ev.push({ type: 'stomp', boss: e.boss, x: e.x, y: e.y });
      } else if (p.hurt <= 0) {
        p.hurt = 0.8;
        p.vx = (p.x + PW / 2 < e.x + e.w / 2 ? -1 : 1) * 320;
        p.vy = -420;
        L.time -= HURT;
        ev.push({ type: 'hurt' });
      }
    }
    // Tür der Kapitänskajüte
    if (overlap({ x: p.x, y: p.y, w: PW, h: PH }, L.door)) {
      L.over = 'won';
      ev.push({ type: 'won' });
    } else if (L.time <= 0) {
      L.time = 0;
      L.over = 'lost';
      ev.push({ type: 'timeout' });
    }
    return ev;
  }

  // ---------- Bildschirm ----------

  const $ = id => document.getElementById(id);
  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let vw = 0;
  let vh = 0;
  let L = null;
  let done = null;
  let figImg = null;
  let camX = 0;
  let time = 0;
  let ending = false;
  const keys = { left: false, right: false, jump: false };
  let jumpQueued = false;

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = canvas.clientWidth || window.innerWidth;
    vh = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
  }

  function start(pirate, onDone) {
    L = create(pirate.kind, (pirate.name || '').length * 13 + 5);
    done = onDone;
    ending = false;
    keys.left = keys.right = false;
    jumpQueued = false;
    figImg = new Image();
    figImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SF.figure.svg(SF.figure.mine()));
    SF.ui.show('boarding');
    resize();
    camX = 0;
    SF.sound.play('jump');
    SF.track('seefahrer-entern');
    SF.ui.tipOnce('boarding', 'Lauf zur <b>Kapitänskajüte</b> am Ende des Decks! Spring den Piraten <b>auf den Kopf</b> und pass auf die offenen Luken auf.', 6000);
  }

  function frame(dt) {
    if (!L || !canvas) return;
    time += dt;
    const ev = step(L, dt, { left: keys.left, right: keys.right, jump: jumpQueued || keys.jump });
    jumpQueued = false;
    ev.forEach(e => {
      if (e.type === 'jump') SF.sound.play('jump');
      else if (e.type === 'stomp') SF.sound.play('hit');
      else if (e.type === 'hurt') { SF.sound.play('hurt'); SF.ui.toast('Autsch! −4 Sekunden', 1200); }
      else if (e.type === 'fall') { SF.sound.play('splash'); SF.ui.toast('In die Luke gefallen! −3 Sekunden', 1400); }
    });
    // Kamera folgt der Figur
    const scale = Math.min(vh / 600, vw / 900);
    const viewW = vw / scale;
    camX += (Math.max(0, Math.min(W - viewW, L.p.x - viewW * 0.35)) - camX) * Math.min(1, dt * 6);
    draw(scale);
    SF.setText($('bd-time'), Math.ceil(L.time));
    $('bd-time-box').classList.toggle('low', L.time < 10);
    if (L.over && !ending) {
      ending = true;
      const ok = L.over === 'won';
      SF.sound.play(ok ? 'fanfare' : 'lose');
      setTimeout(async () => {
        if (!ok) await SF.ui.dialog({ title: 'Zurückgeschlagen!', html: '<p>Die Zeit ist um – die Piraten werfen dich über Bord, und ihr Schiff segelt davon.</p>', buttons: [{ label: 'Weiter', value: true, kind: 'primary' }] });
        const cb = done;
        L = null;
        done = null;
        if (cb) cb(ok);
      }, ok ? 500 : 300);
    }
  }

  function draw(scale) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, vh);
    sky.addColorStop(0, '#7ab8e0');
    sky.addColorStop(1, '#f4e0b0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, vw, vh);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -camX * scale * dpr, dpr * (vh - 600 * scale));
    const viewW = vw / scale;
    // Meer im Hintergrund
    ctx.fillStyle = '#2a6a8e';
    ctx.fillRect(camX - 10, 300, viewW + 20, 800);
    // Masten mit Segeln
    [500, 1250, 1900].forEach((mx, i) => {
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(mx, 20, 16, DECK - 20);
      ctx.fillStyle = SF.pirates ? SF.pirates.KINDS[L.kind].sail : '#333';
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.moveTo(mx - 130, 50 + i * 10);
      ctx.quadraticCurveTo(mx + 8, 30, mx + 146, 50 + i * 10);
      ctx.lineTo(mx + 136, 220);
      ctx.quadraticCurveTo(mx + 8, 250, mx - 120, 220);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      // Totenkopf
      ctx.fillStyle = '#eee';
      ctx.beginPath();
      ctx.arc(mx + 8, 130, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.fillRect(mx - 2, 124, 6, 6);
      ctx.fillRect(mx + 12, 124, 6, 6);
    });
    // Deck, Kisten, Fässer
    L.solids.forEach(s => {
      if (s.k === 'deck') {
        ctx.fillStyle = '#8a5a2b';
        ctx.fillRect(s.x, s.y, s.w, s.h + 400);
        ctx.fillStyle = '#6b3f1d';
        for (let x = s.x; x < s.x + s.w; x += 48) ctx.fillRect(x, s.y, 2, 16);
        ctx.fillStyle = '#5a3416';
        ctx.fillRect(s.x, s.y + 16, s.w, s.h + 384);
      } else if (s.k === 'barrel') {
        ctx.fillStyle = '#9a6a35';
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.fillStyle = '#3a2410';
        ctx.fillRect(s.x, s.y + 10, s.w, 4);
        ctx.fillRect(s.x, s.y + s.h - 14, s.w, 4);
      } else {
        ctx.fillStyle = '#b08040';
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.strokeStyle = '#5a3a10';
        ctx.lineWidth = 3;
        ctx.strokeRect(s.x + 1.5, s.y + 1.5, s.w - 3, s.h - 3);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.w, s.y + s.h);
        ctx.stroke();
      }
    });
    // Reling
    ctx.strokeStyle = '#5a3416';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, DECK - 40);
    ctx.lineTo(1950, DECK - 40);
    ctx.moveTo(1950, QUARTER - 40);
    ctx.lineTo(W, QUARTER - 40);
    ctx.stroke();
    // Luken (dunkel)
    L.hatches.forEach(h => {
      ctx.fillStyle = '#140c06';
      ctx.fillRect(h.x, DECK, h.w, 520);
    });
    // Tür der Kapitänskajüte
    const d = L.door;
    ctx.fillStyle = '#6b3f1d';
    ctx.fillRect(d.x - 20, d.y - 30, d.w + 40, d.h + 30);
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = '#f5c542';
    ctx.beginPath();
    ctx.arc(d.x + d.w - 12, d.y + d.h / 2, 5, 0, Math.PI * 2);
    ctx.fill();
    SF.icons.draw(ctx, 'chest', d.x + d.w / 2, d.y - 22, 34);
    // Piraten
    L.enemies.forEach(e => {
      if (!e.alive) return;
      const bob = Math.sin(time * 10 + e.x) * 2;
      ctx.fillStyle = e.boss ? '#1f3a7a' : '#7a1f1f';
      ctx.fillRect(e.x, e.y + e.h * 0.4 + bob, e.w, e.h * 0.6);
      ctx.fillStyle = '#f2c9a0';
      ctx.beginPath();
      ctx.arc(e.x + e.w / 2, e.y + e.h * 0.25 + bob, e.w * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = e.boss ? '#1a2a60' : '#c0392b';
      ctx.fillRect(e.x + 2, e.y + bob, e.w - 4, e.h * 0.14);
      ctx.fillStyle = '#111';
      ctx.fillRect(e.x + e.w / 2 + (e.vx > 0 ? 2 : -8), e.y + e.h * 0.22 + bob, 6, 4);
      if (e.boss) {
        ctx.fillStyle = '#2c4a9a';
        ctx.fillRect(e.x + 4, e.y + e.h * 0.32 + bob, e.w - 8, 10); // blauer Bart
      }
    });
    // Spielfigur (blinkt nach einem Treffer)
    const p = L.p;
    if (!(p.hurt > 0 && Math.floor(time * 12) % 2)) {
      if (figImg && figImg.complete && figImg.naturalWidth) {
        ctx.save();
        ctx.translate(p.x + PW / 2, p.y + PH);
        ctx.scale(p.face, 1);
        ctx.drawImage(figImg, -32, -60, 64, 64);
        ctx.restore();
      } else {
        ctx.fillStyle = '#2c5d8a';
        ctx.fillRect(p.x, p.y, PW, PH);
      }
    }
  }

  function bind() {
    canvas = $('boarding-canvas');
    ctx = canvas.getContext('2d');
    const hold = (id, key) => {
      const el = $(id);
      el.addEventListener('pointerdown', e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (err) { /* kein echter Finger (z. B. im Test) */ } keys[key] = true; if (key === 'jump') jumpQueued = true; });
      const up = () => { keys[key] = false; };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
    };
    hold('bd-left', 'left');
    hold('bd-right', 'right');
    hold('bd-jump', 'jump');
    // Tastatur (für Rechner)
    document.addEventListener('keydown', e => {
      if (!L) return;
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { if (!keys.jump) jumpQueued = true; keys.jump = true; e.preventDefault(); }
    });
    document.addEventListener('keyup', e => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') keys.jump = false;
    });
    window.addEventListener('resize', resize);
  }

  SF.boarding = { W, DECK, QUARTER, TIME, HURT, FALL, PW, PH, create, step, start, frame, bind, resize, _level: () => L };
})();
