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

  let fx = [];            // Glitzern und Zahlen beim Pflücken
  let shipImg = null;     // das eigene Schiff an der Oberfläche
  const INK = '#2a1d10';

  // Zierde am Grund (feste Plätze): Korallen [x, Art, Farbe, Größe], Felsen, Seegras, Fischschwärme
  const CORALS = [[90, 'ast', '#f0707e', 1.1], [230, 'faecher', '#f0a030', 1], [390, 'rohr', '#b866d8', 1], [540, 'ast', '#ff9a5a', 0.9],
    [760, 'faecher', '#e85a8a', 1.2], [900, 'hirn', '#f2c14e', 1], [1340, 'ast', '#f0707e', 1.2], [640, 'rohr', '#4ac0b0', 0.8], [1210, 'hirn', '#e88a5a', 0.8]];
  const ROCKS = [[560, 823, 96, 60], [260, 932, 76, 48], [1180, 878, 86, 54], [70, 1235, 70, 40], [1330, 1228, 60, 34],
    [610, 1040, 50, 34], [840, 1166, 46, 30], [330, 1186, 44, 30], [1120, 1096, 40, 30]]; // die kleinen tragen einzelne Muscheln
  const WEEDS = [40, 160, 300, 450, 590, 720, 860, 1000, 1150, 1290, 1380];
  const SCHOOLS = [{ y: 260, n: 7, v: 46, c: '#ffb347', s: 1 }, { y: 520, n: 5, v: -34, c: '#ffe066', s: 1.2 }, { y: 760, n: 6, v: 28, c: '#9ad8f0', s: 0.9 }, { y: 1010, n: 4, v: -22, c: '#ff8a70', s: 1.3 }];

  function start(site = 'reef') {
    D = create(site, Math.floor(Math.random() * 1e9));
    input = {};
    ending = false;
    bubbles = [];
    fx = [];
    figImg = new Image();
    figImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SF.figure.svg(SF.figure.mine()));
    shipImg = new Image();
    shipImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SF.ships.sideSVG(SF.state.ship.type, SF.cosmetics ? SF.cosmetics.shipColors() : null)
      .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="184" '));
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
      if (e.type === 'pearl') {
        SF.sound.play('amber');
        const c = D.clams[e.id];
        fx.push({ k: 'text', text: `+${e.n}`, x: c.x, y: c.y - 30, vx: 0, vy: -50, t: 0, life: 1 });
        for (let i = 0; i < 9; i++) fx.push({ k: 'spark', x: c.x, y: c.y - 8, vx: (Math.random() - 0.5) * 200, vy: -40 - Math.random() * 160, t: 0, life: 0.8 });
      } else if (e.type === 'sting') { SF.sound.play('hurt'); SF.ui.toast('Qualle! −3 Sekunden Luft', 1200); }
    });
    // Luftblasen: aus dem Helm und ab und zu vom Grund
    if (Math.random() < dt * 5) bubbles.push({ x: D.x + D.face * 8, y: D.y - 34, t: 0, r: 2 + Math.random() * 3, life: 2.6 });
    if (Math.random() < dt * 1.5) bubbles.push({ x: Math.random() * W, y: H - 50, t: 0, r: 2 + Math.random() * 2, life: 5 });
    bubbles = bubbles.filter(b => (b.t += dt) < b.life && b.y - b.t * 70 > SURFACE);
    fx = fx.filter(f => {
      f.t += dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.k === 'spark') f.vy += 260 * dt;
      return f.t < f.life;
    });
    const sc = scale();
    const hw = vw / 2 / sc;
    const hh = vh / 2 / sc;
    cam.x += (Math.max(hw, Math.min(W - hw, D.x)) - cam.x) * Math.min(1, dt * 4);
    cam.y += (Math.max(hh - 90, Math.min(H - hh, D.y)) - cam.y) * Math.min(1, dt * 4);
    draw();
    $('dv-air-fill').style.transform = `scaleX(${(D.air / AIR).toFixed(3)})`;
    $('dv-air').classList.toggle('low', D.air < 8);
    SF.setText($('dv-pearls'), D.pearls);
    if (D.over && !ending) {
      ending = true;
      const ok = D.over === 'surfaced';
      const found = D.pearls;
      const keep = finish(D);
      const story = SF.chapter && SF.chapter.onDive ? SF.chapter.onDive(D.site, ok) : ''; // Story: das Codebuch im Wrack
      SF.save();
      SF.sound.play(ok ? (keep || story ? 'fanfare' : 'splash') : 'lose');
      setTimeout(async () => {
        await SF.ui.dialog({
          title: ok ? `${SF.icon('diver')} Aufgetaucht!` : `${SF.icon('bubbles')} Keine Luft mehr!`,
          html: (ok
            ? `<p>${keep ? `Du bringst <b>${keep} Perle${keep > 1 ? 'n' : ''}</b> ${SF.icon('pearl')} mit an Bord.` : 'Diesmal keine Perlen – die Muscheln waren zu.'}</p>`
            : `<p>Die Crew zieht dich an der Leine hoch. Dabei fällt die Hälfte der Perlen ins Meer: Du behältst <b>${keep}</b> von ${found}.</p>`) + story,
          buttons: [{ label: 'Zurück aufs Schiff', value: true, kind: 'primary' }],
        });
        if (keep) SF.story.log(`Am Korallenriff getaucht: ${keep} Perlen.`);
        SF.ui.tipOnce('pearls', '<b>Perlen</b> sind etwas Besonderes: Dafür gibt es bald Segel, Flaggen und Galionsfiguren für dein Schiff!', 8000);
        D = null;
        SF.sea.open();
      }, 400);
    }
  }

  // ---------- Zeichnen ----------

  const fillStroke = (fill, lw = 2.5) => { ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke(); };

  // Wie weit ist die Muschel gerade offen (0 bis 1, weich auf und zu)?
  function openAmount(c) {
    if (c.taken) return 0.6;
    const t = (D.t + c.phase) % CYCLE;
    if (t >= OPEN) return 0;
    return Math.min(1, t / 0.25, (OPEN - t) / 0.25);
  }

  function drawCoral(x, y, kind, color, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (kind === 'ast') {
      // Astkoralle: dicke Äste mit Umriss und hellem Kern
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -46);
        ctx.moveTo(0, -24); ctx.quadraticCurveTo(-22, -34, -26, -62);
        ctx.moveTo(0, -34); ctx.quadraticCurveTo(22, -44, 24, -74);
        ctx.moveTo(-18, -46); ctx.lineTo(-38, -56);
        ctx.moveTo(18, -56); ctx.lineTo(38, -62);
        ctx.moveTo(0, -46); ctx.lineTo(-4, -84);
      };
      path(); ctx.strokeStyle = INK; ctx.lineWidth = 15; ctx.stroke();
      path(); ctx.strokeStyle = color; ctx.lineWidth = 10; ctx.stroke();
      path(); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 3; ctx.stroke();
    } else if (kind === 'faecher') {
      // Fächerkoralle
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, -8, 52, Math.PI * 1.08, Math.PI * 1.92);
      ctx.closePath();
      fillStroke(color);
      ctx.strokeStyle = 'rgba(42,29,16,.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = -3; i <= 3; i++) { ctx.moveTo(0, -4); ctx.lineTo(i * 15, -56 + Math.abs(i) * 5); }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -8, 30, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
    } else if (kind === 'rohr') {
      // Röhrenschwämme
      [[-18, 44], [0, 64], [18, 38]].forEach(([dx, h]) => {
        ctx.beginPath();
        ctx.moveTo(dx - 9, 0);
        ctx.lineTo(dx - 10, -h);
        ctx.quadraticCurveTo(dx, -h - 8, dx + 10, -h);
        ctx.lineTo(dx + 9, 0);
        ctx.closePath();
        fillStroke(color);
        ctx.fillStyle = 'rgba(42,29,16,.55)';
        ctx.beginPath();
        ctx.ellipse(dx, -h, 7, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        ctx.fillRect(dx - 6, -h + 8, 3, h - 14);
      });
    } else {
      // Hirnkoralle
      ctx.beginPath();
      ctx.arc(0, -4, 30, Math.PI, 0);
      ctx.closePath();
      fillStroke(color);
      ctx.strokeStyle = 'rgba(42,29,16,.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        ctx.moveTo(-22 + i * 6, -8 - i * 7);
        ctx.bezierCurveTo(-8, -18 - i * 7, 6, -2 - i * 7, 22 - i * 6, -10 - i * 7);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawClam(c) {
    const r = c.big ? 26 : 19;
    const a = openAmount(c);
    const shell = c.taken ? '#8d857c' : c.big ? '#f0b8c8' : '#e6a6b8';
    const dark = c.taken ? '#6a625a' : '#b8788e';
    // Leuchten, solange die Perle zu holen ist
    if (!c.taken && a > 0) {
      const g = ctx.createRadialGradient(c.x, c.y - 6, 2, c.x, c.y - 6, r * 2.4);
      g.addColorStop(0, `rgba(255,250,220,${0.5 * a})`);
      g.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y - 6, r * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // obere Schale (klappt nach hinten auf)
    ctx.save();
    ctx.translate(c.x - r, c.y);
    ctx.rotate(-a * 0.95);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(r * 0.3, -r * 0.95, r * 1.7, -r * 0.95, r * 2, 0);
    ctx.closePath();
    fillStroke(shell);
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 1; i <= 4; i++) { ctx.moveTo(r * 0.1, -1); ctx.quadraticCurveTo(r * (0.2 + i * 0.3), -r * (0.95 - i * 0.12), r * (0.4 + i * 0.36), -2); }
    ctx.stroke();
    ctx.restore();
    // Perle
    if (!c.taken && a > 0.3) {
      const pr = c.big ? 9 : 6.5;
      ctx.beginPath();
      ctx.arc(c.x + 2, c.y - pr * 0.7, pr, 0, Math.PI * 2);
      fillStroke(c.big ? '#ffe9a8' : '#fffaf0', 1.5);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(c.x - 0.5, c.y - pr * 0.95, pr * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    // untere Schale
    ctx.beginPath();
    ctx.moveTo(c.x - r, c.y);
    ctx.bezierCurveTo(c.x - r * 0.7, c.y + r * 0.75, c.x + r * 0.7, c.y + r * 0.75, c.x + r, c.y);
    ctx.closePath();
    fillStroke(shell);
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) { ctx.moveTo(c.x + i * r * 0.32, c.y + 2); ctx.lineTo(c.x + i * r * 0.24, c.y + r * (0.5 - Math.abs(i) * 0.08)); }
    ctx.stroke();
  }

  function drawJelly(j) {
    const pulse = Math.sin(time * 2.4 + j.ph);
    const rx = j.r * (1 + pulse * 0.08);
    const ry = j.r * (0.9 - pulse * 0.08);
    const halo = ctx.createRadialGradient(j.x, j.y, 2, j.x, j.y, j.r * 2.2);
    halo.addColorStop(0, 'rgba(255,170,240,.28)');
    halo.addColorStop(1, 'rgba(255,170,240,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(j.x, j.y, j.r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    // Tentakel
    ctx.lineCap = 'round';
    for (let k = -2; k <= 2; k++) {
      const x0 = j.x + k * rx * 0.36;
      const sway = Math.sin(time * 2.6 + k * 1.3 + j.ph) * 9;
      ctx.strokeStyle = k % 2 ? 'rgba(255,190,240,.75)' : 'rgba(200,140,250,.75)';
      ctx.lineWidth = k % 2 ? 2.5 : 3.5;
      ctx.beginPath();
      ctx.moveTo(x0, j.y + 2);
      ctx.bezierCurveTo(x0 + sway, j.y + j.r * 0.7, x0 - sway, j.y + j.r * 1.3, x0 + sway * 0.6, j.y + j.r * (1.8 + (k % 2 ? 0 : 0.4)));
      ctx.stroke();
    }
    // Schirm
    const g = ctx.createRadialGradient(j.x - rx * 0.3, j.y - ry * 0.6, 2, j.x, j.y - ry * 0.2, rx * 1.2);
    g.addColorStop(0, 'rgba(255,225,250,.95)');
    g.addColorStop(0.55, 'rgba(240,140,225,.85)');
    g.addColorStop(1, 'rgba(160,90,220,.8)');
    ctx.beginPath();
    ctx.moveTo(j.x - rx, j.y);
    ctx.bezierCurveTo(j.x - rx, j.y - ry * 1.5, j.x + rx, j.y - ry * 1.5, j.x + rx, j.y);
    ctx.quadraticCurveTo(j.x + rx * 0.5, j.y + 7, j.x, j.y + 2);
    ctx.quadraticCurveTo(j.x - rx * 0.5, j.y + 7, j.x - rx, j.y);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,60,170,.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(j.x - rx * 0.25, j.y - ry * 0.45, rx * 0.4, Math.PI * 1.05, Math.PI * 1.5);
    ctx.stroke();
  }

  function drawFish(x, y, s, dir, color, wag) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir * s, s);
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(-17, -6 + wag * 3);
    ctx.lineTo(-17, 6 + wag * 3);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath();
    ctx.ellipse(1, -2, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(6, -1, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawWreck() {
    // Rumpf mit Planken, Spanten, gebrochenem Mast und zerfetztem Segel
    ctx.beginPath();
    ctx.moveTo(930, 1256); ctx.lineTo(1318, 1206); ctx.quadraticCurveTo(1326, 1140, 1276, 1092); ctx.lineTo(1150, 1118); ctx.lineTo(1120, 1146);
    ctx.lineTo(990, 1162); ctx.quadraticCurveTo(940, 1200, 930, 1256);
    ctx.closePath();
    fillStroke('#4a3020', 3);
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) { ctx.moveTo(960 + i * 6, 1232 - i * 26); ctx.lineTo(1312 - i * 10, 1186 - i * 26); }
    ctx.stroke();
    ctx.strokeStyle = '#2e1c10';
    ctx.lineWidth = 6;
    ctx.beginPath();
    [1020, 1080, 1200, 1250].forEach((x, i) => { ctx.moveTo(x, 1158 - i * 9); ctx.lineTo(x + 8, 1118 - i * 12); });
    ctx.stroke();
    // Bullaugen
    [[1040, 1200], [1130, 1188], [1230, 1172]].forEach(([x, y], i) => {
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      fillStroke(i === 1 ? 'rgba(255,214,120,.6)' : '#17100a', 3);
    });
    // Mast und Segelfetzen
    ctx.strokeStyle = INK;
    ctx.lineWidth = 15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(1104, 1140); ctx.lineTo(1086, 940);
    ctx.stroke();
    ctx.strokeStyle = '#5a3c26';
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(1040, 968); ctx.lineTo(1136, 956);
    ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.stroke();
    ctx.strokeStyle = '#5a3c26'; ctx.lineWidth = 7; ctx.stroke();
    const sw = Math.sin(time * 1.2) * 6;
    ctx.beginPath();
    ctx.moveTo(1046, 970);
    ctx.lineTo(1130, 960);
    ctx.quadraticCurveTo(1136 + sw, 1010, 1118 + sw, 1050);
    ctx.lineTo(1100 + sw, 1024); ctx.lineTo(1082 + sw, 1062); ctx.lineTo(1066 + sw, 1020); ctx.lineTo(1050 + sw, 1040);
    ctx.closePath();
    ctx.globalAlpha = 0.8;
    fillStroke('#c9c2ae', 2.5);
    ctx.globalAlpha = 1;
  }

  function drawDiver() {
    const tilt = Math.max(-0.5, Math.min(0.5, D.vx / 320)) * 1;
    const kick = Math.sin(time * (6 + Math.min(6, (Math.abs(D.vx) + Math.abs(D.vy)) / 40)));
    ctx.save();
    ctx.translate(D.x, D.y);
    ctx.rotate(tilt);
    // Beine mit Flossen
    [-1, 1].forEach(side => {
      const a = kick * side * 0.35;
      ctx.save();
      ctx.translate(side * 7, 16);
      ctx.rotate(a);
      ctx.fillStyle = '#2f3e52';
      ctx.fillRect(-5, 0, 10, 20);
      ctx.beginPath();
      ctx.moveTo(-6, 18); ctx.lineTo(6, 18); ctx.lineTo(11, 38); ctx.lineTo(-11, 38);
      ctx.closePath();
      fillStroke('#f0a030', 2);
      ctx.restore();
    });
    // Oberkörper: die eigene Figur
    if (figImg && figImg.complete && figImg.naturalWidth) {
      ctx.save();
      ctx.scale(D.face, 1);
      ctx.drawImage(figImg, -32, -40, 64, 64);
      ctx.restore();
    }
    // Taucherhelm aus Messing mit Glas
    ctx.beginPath();
    ctx.arc(0, -16, 23, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(170,220,250,.28)';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -16, 16, Math.PI * 1.1, Math.PI * 1.45);
    ctx.stroke();
    ctx.fillStyle = '#d4a017';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-6, -46, 12, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    const sc = scale();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#06202e';
    ctx.fillRect(0, 0, vw, vh);
    const ox = vw / 2 - cam.x * sc;
    const oy = vh / 2 - cam.y * sc;
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
    const x0 = cam.x - vw / 2 / sc - 20;
    const x1 = cam.x + vw / 2 / sc + 20;
    // Himmel mit Sonne
    const sky = ctx.createLinearGradient(0, -260, 0, SURFACE);
    sky.addColorStop(0, '#5aaee8');
    sky.addColorStop(1, '#d6eefa');
    ctx.fillStyle = sky;
    ctx.fillRect(-300, -500, W + 600, SURFACE + 500);
    ctx.fillStyle = 'rgba(255,244,190,.5)';
    ctx.beginPath();
    ctx.arc(1040, -40, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6c2';
    ctx.beginPath();
    ctx.arc(1040, -40, 40, 0, Math.PI * 2);
    ctx.fill();
    // Wasser: oben hell, unten dunkel
    const water = ctx.createLinearGradient(0, SURFACE, 0, H);
    water.addColorStop(0, '#48b4d2');
    water.addColorStop(0.3, '#2284ae');
    water.addColorStop(0.7, '#0f4f74');
    water.addColorStop(1, '#083049');
    ctx.fillStyle = water;
    ctx.fillRect(-300, SURFACE, W + 600, H - SURFACE + 300);
    // Sonnenstrahlen im Wasser
    for (let i = 0; i < 7; i++) {
      const rx = 80 + i * 210 + Math.sin(time * 0.4 + i * 1.7) * 30;
      const wTop = 30 + (i % 3) * 16;
      const g = ctx.createLinearGradient(0, SURFACE, 0, SURFACE + 640);
      g.addColorStop(0, 'rgba(255,255,230,.16)');
      g.addColorStop(1, 'rgba(255,255,230,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(rx, SURFACE);
      ctx.lineTo(rx + wTop, SURFACE);
      ctx.lineTo(rx + wTop - 150, SURFACE + 640);
      ctx.lineTo(rx - 260, SURFACE + 640);
      ctx.closePath();
      ctx.fill();
    }
    // ferne Riffe (verschieben sich langsamer)
    const par = cam.x * 0.35;
    ctx.fillStyle = 'rgba(8,48,72,.55)';
    ctx.beginPath();
    ctx.moveTo(-300 + par, H);
    for (let x = -300; x <= W + 300; x += 120) ctx.lineTo(x + par, 900 + Math.sin(x * 0.011) * 90 + Math.sin(x * 0.037) * 40);
    ctx.lineTo(W + 300 + par, H);
    ctx.closePath();
    ctx.fill();
    // Fischschwärme
    SCHOOLS.forEach((f, si) => {
      const span = W + 400;
      const base = ((time * f.v + si * 370) % span + span) % span - 200;
      const dir = f.v > 0 ? 1 : -1;
      for (let i = 0; i < f.n; i++) {
        const fx0 = base - dir * (i % 3) * 34 - dir * Math.floor(i / 3) * 22;
        const fy = f.y + ((i * 37) % 50) - 25 + Math.sin(time * 2 + i) * 5;
        if (fx0 > x0 - 30 && fx0 < x1 + 30) drawFish(fx0, fy, f.s, dir, f.c, Math.sin(time * 9 + i * 2));
      }
    });
    // Grund: Sand mit hellem Rand und Rippeln
    const sandY = x => H - 52 + Math.sin(x * 0.02) * 18 + Math.sin(x * 0.007 + 1) * 10;
    const sand = ctx.createLinearGradient(0, H - 80, 0, H + 80);
    sand.addColorStop(0, '#e9d49a');
    sand.addColorStop(1, '#a88c58');
    ctx.fillStyle = sand;
    ctx.beginPath();
    ctx.moveTo(-300, H + 300);
    for (let x = -300; x <= W + 300; x += 40) ctx.lineTo(x, sandY(x));
    ctx.lineTo(W + 300, H + 300);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,246,210,.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = -300; x <= W + 300; x += 40) ctx[x === -300 ? 'moveTo' : 'lineTo'](x, sandY(x));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,96,50,.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 30; x < W; x += 90) { const y = sandY(x) + 22 + (x % 3) * 9; ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 14, y - 5, x + 28, y); }
    ctx.stroke();
    // Seesterne und Kiesel
    [[150, '#f08a4a'], [520, '#e85a7a'], [820, '#f0b040'], [1270, '#f08a4a']].forEach(([x, c]) => {
      const y = sandY(x) + 16;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = k * Math.PI / 5 - Math.PI / 2;
        const rr = k % 2 ? 5 : 13;
        ctx[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7);
      }
      ctx.closePath();
      fillStroke(c, 2);
    });
    // Felsen (darauf sitzen Muscheln)
    ROCKS.forEach(([x, y, rw, rh]) => {
      ctx.beginPath();
      ctx.moveTo(x - rw, y + rh);
      ctx.bezierCurveTo(x - rw * 1.05, y - rh * 0.4, x - rw * 0.4, y - rh, x, y - rh * 0.92);
      ctx.bezierCurveTo(x + rw * 0.6, y - rh * 0.9, x + rw * 1.05, y - rh * 0.2, x + rw, y + rh);
      ctx.closePath();
      fillStroke('#566a78', 3);
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.beginPath();
      ctx.ellipse(x - rw * 0.3, y - rh * 0.45, rw * 0.35, rh * 0.22, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f8a5a';
      ctx.beginPath();
      ctx.ellipse(x + rw * 0.35, y - rh * 0.55, rw * 0.3, rh * 0.16, 0.3, 0, Math.PI * 2);
      ctx.fill();
    });
    drawWreck();
    // Seegras: Bänder, die in der Strömung wehen
    ctx.lineCap = 'round';
    WEEDS.forEach((x, i) => {
      const y = sandY(x) + 6;
      const h = 110 + (i % 4) * 34;
      for (let b = 0; b < 2; b++) {
        const sway = Math.sin(time * 1.4 + x * 0.05 + b * 1.6) * (14 + b * 6);
        ctx.strokeStyle = b ? '#2f9a5e' : '#1f7a48';
        ctx.lineWidth = 9 - b * 3;
        ctx.beginPath();
        ctx.moveTo(x + b * 12, y);
        ctx.bezierCurveTo(x + b * 12 - sway, y - h * 0.35, x + b * 12 + sway, y - h * 0.7, x + b * 12 + sway * 0.6, y - h + b * 26);
        ctx.stroke();
      }
    });
    CORALS.forEach(([x, k, c, s]) => drawCoral(x, sandY(x) + 8, k, c, s));
    D.clams.forEach(drawClam);
    D.jellies.forEach(drawJelly);
    // Luftschlauch vom Boot zum Taucher
    const bx = W / 2;
    ctx.strokeStyle = 'rgba(230,214,150,.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx - 30, SURFACE - 4);
    ctx.quadraticCurveTo((bx + D.x) / 2 - 40, (SURFACE + D.y) / 2 + 30, D.x, D.y - 44);
    ctx.stroke();
    // Blasen
    bubbles.forEach(b => {
      const y = b.y - b.t * 70;
      const x = b.x + Math.sin(b.t * 5 + b.r) * 5;
      const r = b.r + b.t * 1.2;
      ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    });
    if (!(D.hurt > 0 && Math.floor(time * 12) % 2)) drawDiver();
    // Glitzern und Zahlen
    fx.forEach(f => {
      const a = 1 - f.t / f.life;
      if (f.k === 'spark') {
        ctx.fillStyle = `rgba(255,250,210,${a})`;
        ctx.fillRect(f.x - 2.5, f.y - 2.5, 5, 5);
      } else {
        ctx.font = '900 26px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.lineWidth = 5;
        ctx.strokeStyle = INK;
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = '#fffaf0';
        ctx.fillText(f.text, f.x, f.y);
        ctx.globalAlpha = 1;
      }
    });
    // Oberfläche: Wellenlinie, das eigene Schiff von unten
    if (shipImg && shipImg.complete && shipImg.naturalWidth) ctx.drawImage(shipImg, bx - 120, SURFACE - 150 + Math.sin(time * 1.6) * 3, 240, 184);
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = Math.floor(x0 / 30) * 30; x <= x1 + 30; x += 30) ctx[x <= x0 + 30 ? 'moveTo' : 'lineTo'](x, SURFACE + Math.sin(x * 0.03 + time * 2) * 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(72,180,210,.45)';
    ctx.fillRect(x0, SURFACE + 4, x1 - x0, 26);
    // Dunkelheit: je tiefer, desto dunkler – ums Licht des Tauchers bleibt es hell
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const depth = Math.max(0, Math.min(1, (D.y - SURFACE) / (H - SURFACE)));
    const dark = depth * 0.62;
    if (dark > 0.02) {
      const sx = ox + D.x * sc;
      const sy = oy + D.y * sc;
      const R = 300 * sc;
      const g = ctx.createRadialGradient(sx, sy, R * 0.4, sx, sy, R);
      g.addColorStop(0, 'rgba(2,14,26,0)');
      g.addColorStop(1, `rgba(2,14,26,${dark.toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
    }
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
