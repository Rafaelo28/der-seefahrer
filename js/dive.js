// Tauchen am Korallenriff (von der Seite): Mit dem Finger ziehen – der Taucher schwimmt dorthin. Luft und Licht sind
// knapp: je tiefer, desto dunkler. Muscheln öffnen sich nur zeitweise – dann kann man die Perle nehmen. Quallen
// kosten Luft. Wer rechtzeitig auftaucht, behält alle Perlen; wem die Luft ausgeht, der wird hochgezogen und
// verliert die Hälfte. Gepflückte Muscheln wachsen nach zwei Tagen nach. Perlen sind nur für Cosmetics.
window.SF = window.SF || {};

(function () {
  const W = 1400;
  const H = 1300;
  const SURFACE = 70;      // Wasseroberfläche (darüber: Boot)
  const AIR = 32;          // Sekunden Luft
  const SPEED = 190;
  const STING = 3;         // Sekunden Luft weg bei einer Qualle
  const PICK = 38;         // so nah muss man an eine offene Muschel
  const REGROW = 2;        // Tage, bis Muscheln nachwachsen
  const CYCLE = 4;         // Sekunden: Muschel auf und zu
  const OPEN = 2.2;        // davon offen

  // Muscheln: [x, y, groß] – auf dem Grund, an Felsen und im Wrack
  const CLAMS = [[180, 1210, 0], [330, 1150, 0], [470, 1235, 1], [610, 1000, 0], [700, 1220, 0], [840, 1130, 0],
    [1020, 1180, 1], [1120, 1060, 0], [1240, 1225, 0], [560, 760, 0], [260, 880, 0], [1180, 820, 1]];
  const JELLIES = [[400, 520, 40], [900, 700, 55], [650, 950, 45], [1150, 450, 35]];

  function seededRand(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // Welche Muscheln sind heute schon gepflückt?
  function taken(site = 'reef', day = SF.trade ? SF.trade.day() : 0) {
    const s = SF.state;
    if (!s.dives || typeof s.dives !== 'object') s.dives = {};
    const d = s.dives[site];
    if (!d || day - d.day >= REGROW) s.dives[site] = { day, taken: [] };
    return s.dives[site];
  }

  function create(site = 'reef', seed = 1) {
    const rnd = seededRand(seed);
    const gone = taken(site).taken;
    return {
      site, t: 0, air: AIR, over: '',
      x: W / 2, y: SURFACE + 20, vx: 0, vy: 0, face: 1, hurt: 0,
      pearls: 0,
      clams: CLAMS.map((c, i) => ({ id: i, x: c[0], y: c[1], big: !!c[2], phase: rnd() * CYCLE, taken: gone.includes(i) })),
      jellies: JELLIES.map(j => ({ x: j[0], y: j[1], y0: j[1], r: j[2] * 0.5, vx: (rnd() < 0.5 ? -1 : 1) * (30 + rnd() * 30), ph: rnd() * 6 })),
    };
  }

  const isOpen = (D, c) => ((D.t + c.phase) % CYCLE) < OPEN;

  // Ein Schritt. input: { tx, ty } – dorthin schwimmen (null = treiben lassen)
  function step(D, dt, input = {}) {
    const ev = [];
    if (D.over) return ev;
    D.t += dt;
    D.air -= dt;
    D.hurt = Math.max(0, D.hurt - dt);
    if (input.tx != null) {
      const dx = input.tx - D.x;
      const dy = input.ty - D.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const sp = Math.min(SPEED, d * 3);
      const k = Math.min(1, dt * 5);
      D.vx += ((d > 1 ? dx / d * sp : 0) - D.vx) * k;
      D.vy += ((d > 1 ? dy / d * sp : 0) - D.vy) * k;
      if (dx > 4) D.face = 1; else if (dx < -4) D.face = -1;
    } else {
      D.vx *= 1 - Math.min(1, dt * 2);
      D.vy += (-12 - D.vy) * Math.min(1, dt * 2); // treibt langsam nach oben
    }
    D.x = Math.max(20, Math.min(W - 20, D.x + D.vx * dt));
    D.y = Math.max(SURFACE - 10, Math.min(H - 30, D.y + D.vy * dt));
    // Quallen
    D.jellies.forEach(j => {
      j.x += j.vx * dt;
      if (j.x < 60 || j.x > W - 60) j.vx = -j.vx;
      j.y = j.y0 + Math.sin(D.t * 1.3 + j.ph) * 40;
      const dx = D.x - j.x;
      const dy = D.y - j.y;
      if (D.hurt <= 0 && dx * dx + dy * dy < (j.r + 18) * (j.r + 18)) {
        D.air -= STING;
        D.hurt = 1.2;
        D.vx = dx > 0 ? 160 : -160;
        ev.push({ type: 'sting' });
      }
    });
    // Muscheln
    D.clams.forEach(c => {
      if (c.taken || !isOpen(D, c)) return;
      const dx = D.x - c.x;
      const dy = D.y - c.y;
      if (dx * dx + dy * dy < PICK * PICK) {
        c.taken = true;
        const n = c.big ? 3 : 1;
        D.pearls += n;
        ev.push({ type: 'pearl', n, id: c.id });
      }
    });
    // Auftauchen oder keine Luft mehr
    if (D.y <= SURFACE && D.t > 1.5) {
      D.over = 'surfaced';
      ev.push({ type: 'surfaced' });
    } else if (D.air <= 0) {
      D.air = 0;
      D.over = 'air';
      ev.push({ type: 'air' });
    }
    return ev;
  }

  // Ergebnis: Perlen gutschreiben (ohne Luft nur die Hälfte), gepflückte Muscheln merken
  function finish(D) {
    const s = SF.state;
    const keep = D.over === 'air' ? Math.floor(D.pearls / 2) : D.pearls;
    s.pearls = (s.pearls || 0) + keep;
    s.stats.pearls = (s.stats.pearls || 0) + keep;
    s.stats.dives = (s.stats.dives || 0) + 1;
    const rec = taken(D.site);
    D.clams.forEach(c => { if (c.taken && !rec.taken.includes(c.id)) rec.taken.push(c.id); });
    return keep;
  }

  // ---------- Bildschirm ----------

  const $ = id => document.getElementById(id);
  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let vw = 0;
  let vh = 0;
  let D = null;
  let input = {};
  let pointer = null;
  let time = 0;
  let ending = false;
  let figImg = null;
  const cam = { x: 0, y: 0 };
  let bubbles = [];

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = canvas.clientWidth || window.innerWidth;
    vh = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
  }

  const scale = () => Math.max(vw / W, vh / 700);

  function start(site = 'reef') {
    D = create(site, Math.floor(Math.random() * 1e9));
    input = {};
    ending = false;
    bubbles = [];
    figImg = new Image();
    figImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SF.figure.svg(SF.figure.mine()));
    SF.ui.show('dive');
    resize();
    cam.x = D.x;
    cam.y = D.y;
    SF.track('seefahrer-tauchen');
    SF.ui.tipOnce('dive', 'Halte den Finger aufs Wasser – der Taucher schwimmt dorthin. Pflück die Perlen, wenn die <b>Muscheln offen</b> sind, und tauch <b>rechtzeitig auf</b>!', 9000);
  }

  function frame(dt) {
    if (!D || !canvas) return;
    time += dt;
    step(D, dt, input).forEach(e => {
      if (e.type === 'pearl') { SF.sound.play('amber'); SF.ui.toast(`+${e.n} Perle${e.n > 1 ? 'n' : ''}`, 900); }
      else if (e.type === 'sting') { SF.sound.play('hurt'); SF.ui.toast('Qualle! −3 Sekunden Luft', 1200); }
    });
    if (Math.random() < dt * 4) bubbles.push({ x: D.x + D.face * 10, y: D.y - 20, t: 0 });
    bubbles = bubbles.filter(b => (b.t += dt) < 2.5);
    const sc = scale();
    const hw = vw / 2 / sc;
    const hh = vh / 2 / sc;
    cam.x += (Math.max(hw, Math.min(W - hw, D.x)) - cam.x) * Math.min(1, dt * 4);
    cam.y += (Math.max(hh - 40, Math.min(H - hh, D.y)) - cam.y) * Math.min(1, dt * 4);
    draw();
    $('dv-air-fill').style.transform = `scaleX(${(D.air / AIR).toFixed(3)})`;
    $('dv-air').classList.toggle('low', D.air < 8);
    SF.setText($('dv-pearls'), D.pearls);
    if (D.over && !ending) {
      ending = true;
      const ok = D.over === 'surfaced';
      const found = D.pearls;
      const keep = finish(D);
      SF.save();
      SF.sound.play(ok ? (keep ? 'fanfare' : 'splash') : 'lose');
      setTimeout(async () => {
        await SF.ui.dialog({
          title: ok ? `${SF.icon('diver')} Aufgetaucht!` : `${SF.icon('bubbles')} Keine Luft mehr!`,
          html: ok
            ? `<p>${keep ? `Du bringst <b>${keep} Perle${keep > 1 ? 'n' : ''}</b> ${SF.icon('pearl')} mit an Bord.` : 'Diesmal keine Perlen – die Muscheln waren zu.'}</p>`
            : `<p>Die Crew zieht dich an der Leine hoch. Dabei fällt die Hälfte der Perlen ins Meer: Du behältst <b>${keep}</b> von ${found}.</p>`,
          buttons: [{ label: 'Zurück aufs Schiff', value: true, kind: 'primary' }],
        });
        if (keep) SF.story.log(`Am Korallenriff getaucht: ${keep} Perlen.`);
        SF.ui.tipOnce('pearls', '<b>Perlen</b> sind etwas Besonderes: Dafür gibt es bald Segel, Flaggen und Galionsfiguren für dein Schiff!', 8000);
        D = null;
        SF.sea.open();
      }, 400);
    }
  }

  function draw() {
    const sc = scale();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0a2a3a';
    ctx.fillRect(0, 0, vw, vh);
    const ox = vw / 2 - cam.x * sc;
    const oy = vh / 2 - cam.y * sc;
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
    // Himmel, Boot, Wasser (heller oben, dunkler unten)
    ctx.fillStyle = '#9ad0f0';
    ctx.fillRect(-200, -400, W + 400, SURFACE + 400);
    const water = ctx.createLinearGradient(0, SURFACE, 0, H);
    water.addColorStop(0, '#2f8fb0');
    water.addColorStop(1, '#06202e');
    ctx.fillStyle = water;
    ctx.fillRect(-200, SURFACE, W + 400, H - SURFACE + 200);
    ctx.fillStyle = SF.ships.type().hull;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 120, SURFACE - 30);
    ctx.lineTo(W / 2 + 120, SURFACE - 30);
    ctx.lineTo(W / 2 + 90, SURFACE + 10);
    ctx.lineTo(W / 2 - 90, SURFACE + 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 60, SURFACE - 10);
    ctx.lineTo(D.x, D.y - 20);
    ctx.stroke();
    // Grund mit Sand, Felsen, Korallen und Seegras
    ctx.fillStyle = '#c8b07a';
    ctx.beginPath();
    ctx.moveTo(-200, H + 200);
    for (let x = -200; x <= W + 200; x += 100) ctx.lineTo(x, H - 50 + Math.sin(x * 0.02) * 20);
    ctx.lineTo(W + 200, H + 200);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4a5a62';
    [[560, 800, 90], [260, 920, 70], [1180, 860, 80]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y + 40, r, Math.PI, 0); ctx.fill(); });
    // Wrack
    ctx.fillStyle = '#2a1a10';
    ctx.beginPath();
    ctx.moveTo(950, 1250); ctx.lineTo(1300, 1200); ctx.lineTo(1260, 1100); ctx.lineTo(980, 1150); ctx.closePath();
    ctx.fill();
    ctx.fillRect(1100, 960, 10, 180);
    [[120, '#e86a7a'], [400, '#f0a030'], [760, '#c060d0'], [1300, '#e86a7a']].forEach(([x, c], i) => {
      ctx.strokeStyle = c;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(x, H - 50);
      ctx.lineTo(x - 20, H - 120 - i * 5);
      ctx.moveTo(x, H - 70);
      ctx.lineTo(x + 25, H - 130);
      ctx.stroke();
    });
    ctx.strokeStyle = '#2e7a3a';
    ctx.lineWidth = 5;
    for (let x = 60; x < W; x += 140) {
      ctx.beginPath();
      ctx.moveTo(x, H - 40);
      for (let k = 1; k <= 5; k++) ctx.lineTo(x + Math.sin(time * 1.5 + x + k) * 10, H - 40 - k * 28);
      ctx.stroke();
    }
    // Muscheln
    D.clams.forEach(c => {
      const open = !c.taken && isOpen(D, c);
      const r = c.big ? 24 : 17;
      ctx.fillStyle = c.taken ? '#7a6a5a' : '#b88a9a';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, r, r * 0.45, 0, 0, Math.PI);
      ctx.fill();
      ctx.save();
      ctx.translate(c.x - r, c.y);
      ctx.rotate(open ? -0.7 : 0);
      ctx.beginPath();
      ctx.ellipse(r, 0, r, r * 0.45, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (open) {
        ctx.fillStyle = '#fffaf0';
        ctx.beginPath();
        ctx.arc(c.x, c.y - 4, c.big ? 9 : 6, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    // Quallen
    D.jellies.forEach(j => {
      ctx.fillStyle = 'rgba(230,140,220,.75)';
      ctx.beginPath();
      ctx.arc(j.x, j.y, j.r, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(230,140,220,.6)';
      ctx.lineWidth = 3;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(j.x + k * j.r * 0.35, j.y);
        ctx.lineTo(j.x + k * j.r * 0.35 + Math.sin(time * 3 + k) * 6, j.y + j.r * 1.4);
        ctx.stroke();
      }
    });
    // Blasen
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 1.5;
    bubbles.forEach(b => { ctx.beginPath(); ctx.arc(b.x + Math.sin(b.t * 5) * 4, b.y - b.t * 70, 3 + b.t * 1.5, 0, Math.PI * 2); ctx.stroke(); });
    // Taucher: eigene Figur mit Taucherhelm
    if (!(D.hurt > 0 && Math.floor(time * 12) % 2)) {
      if (figImg && figImg.complete && figImg.naturalWidth) {
        ctx.save();
        ctx.translate(D.x, D.y);
        ctx.scale(D.face, 1);
        ctx.drawImage(figImg, -32, -40, 64, 64);
        ctx.restore();
      }
      ctx.strokeStyle = '#d4a017';
      ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(200,230,255,.3)';
      ctx.beginPath();
      ctx.arc(D.x, D.y - 16, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // Dunkelheit: je tiefer, desto dunkler – nur ums Licht des Tauchers hell
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const depth = Math.max(0, Math.min(1, (D.y - SURFACE) / (H - SURFACE)));
    const dark = 0.15 + depth * 0.8;
    const sx = ox + D.x * sc;
    const sy = oy + D.y * sc;
    const R = 230 * sc;
    const g = ctx.createRadialGradient(sx, sy, R * 0.35, sx, sy, R);
    g.addColorStop(0, 'rgba(2,10,18,0)');
    g.addColorStop(1, `rgba(2,10,18,${dark.toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
  }

  function bind() {
    canvas = $('dive-canvas');
    ctx = canvas.getContext('2d');
    const toWorld = e => {
      const r = canvas.getBoundingClientRect();
      const sc = scale();
      return { x: (e.clientX - r.left - vw / 2) / sc + cam.x, y: (e.clientY - r.top - vh / 2) / sc + cam.y };
    };
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* kein echter Finger (z. B. im Test) */ }
      pointer = e.pointerId;
      const w = toWorld(e);
      input.tx = w.x;
      input.ty = w.y;
    });
    canvas.addEventListener('pointermove', e => {
      if (e.pointerId !== pointer) return;
      const w = toWorld(e);
      input.tx = w.x;
      input.ty = w.y;
    });
    const up = e => { if (e.pointerId === pointer) { pointer = null; input.tx = null; input.ty = null; } };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    window.addEventListener('resize', resize);
  }

  SF.dive = { W, H, SURFACE, AIR, STING, PICK, REGROW, CYCLE, OPEN, CLAMS, create, step, finish, isOpen, taken, start, frame, bind, resize, _state: () => D };
})();
