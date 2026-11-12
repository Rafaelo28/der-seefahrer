// Seekarte auf dem Canvas: Meer, Inseln, Orte, Treibgut, Nebel (Pergament – die Karte entsteht beim Segeln),
// Kurs mit dem Finger zeichnen (vom Schiff aus), Antippen = Kurs dorthin, Karte verschieben und zoomen
// (zwei Finger oder Knöpfe), Anzeigen für Bernstein, Proviant, Laderaum und Wind.
window.SF = window.SF || {};

(function () {
  const ZOOM_MIN = 0.35;
  const ZOOM_MAX = 1.6;
  const ZOOM_STEPS = [0.45, 0.65, 0.9, 1.25];
  const SHIP_GRAB = 70;     // so nah (Bildschirmpunkte) muss man ans Schiff tippen, um einen Kurs zu zeichnen
  const POINT_GAP = 16;     // Abstand der Kurspunkte (Karteneinheiten)
  const MAX_COURSE = 600;   // höchstens so viele Zahlen im Kurs (300 Punkte)
  const PARCHMENT = [236, 221, 178];

  const COLORS = {
    green: ['#7a5a2a', '#e8d39a', '#6fa35a'],
    sand: ['#8a6a3a', '#efdcaa', '#d7bd78'],
    volcano: ['#2e2420', '#8a7a6a', '#5a4a3e'],
    ice: ['#7aa0b8', '#d8eef8', '#ffffff'],
    reef: ['#9a4a52', '#f2a8a0', '#e07a78'],
    dragon: ['#241414', '#7a6050', '#4a3434'],
  };

  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let vw = 0;
  let vh = 0;
  const cam = { x: 0, y: 0, z: 0.8, follow: true };
  const pointers = new Map();
  let gesture = null;
  let wake = [];
  let wakeClock = 0;
  let hudClock = 1;
  let time = 0;
  let fogCanvas = null;
  let fogVer = -1;
  let deco = null;
  const $ = id => document.getElementById(id);

  // ---------- Umrechnen ----------

  const toScreen = (x, y) => ({ x: (x - cam.x) * cam.z + vw / 2, y: (y - cam.y) * cam.z + vh / 2 });
  const toWorld = (sx, sy) => ({ x: (sx - vw / 2) / cam.z + cam.x, y: (sy - vh / 2) / cam.z + cam.y });

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = canvas.clientWidth || window.innerWidth;
    vh = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
  }

  // ---------- Öffnen ----------

  function open() {
    SF.voyage.ensurePos();
    const s = SF.state;
    s.docked = '';
    SF.ui.show('sea');
    // Neuigkeiten aus der Story (z. B. Post nach dem ersten Ende)
    const news = SF.chapter ? SF.chapter.news() : null;
    if (news) setTimeout(() => SF.ui.dialog({ title: news.title, html: news.html, buttons: [{ label: 'Auf nach Port Dublone!', value: true, kind: 'primary' }] }), 500);
    resize();
    cam.x = s.pos.x;
    cam.y = s.pos.y;
    cam.follow = true;
    if (s.ui.zoom >= ZOOM_MIN && s.ui.zoom <= ZOOM_MAX) cam.z = s.ui.zoom;
    else cam.z = vw < 700 ? 0.65 : 0.9;
    wake = [];
    hudClock = 1;
    fogVer = -1;
    updateHud();
    SF.track('seefahrer-seekarte');
    setTimeout(() => {
      if (SF.ui.current() !== 'sea') return;
      SF.ui.tipOnce('sea-draw', 'Zieh mit dem Finger <b>vom Schiff aus</b> einen Kurs – dein Schiff folgt ihm. Du kannst auch einfach aufs Wasser oder auf einen bekannten Ort tippen.', 9000);
    }, 600);
  }

  // ---------- Spielschleife ----------

  function frame(dt) {
    if (!canvas) return;
    time += dt;
    const s = SF.state;
    const events = SF.voyage.step(dt);
    events.forEach(handle);
    if (SF.ui.current() !== 'sea') return; // z. B. im Hafen angekommen
    // Finale: der Fliegende Holländer im Nebelmeer
    if (SF.finale && SF.battleView && !SF.battleView.busy() && SF.finale.ready()) {
      SF.battleView.start(SF.finale.dutchman());
      return;
    }
    // Kapitel 5: das Flaggschiff des Barons vor der Festung
    if (SF.chapter && SF.battleView && !SF.battleView.busy() && SF.chapter.baronReady()) {
      SF.battleView.start(SF.chapter.baronShip());
      return;
    }
    if (SF.pirates && SF.battleView && !SF.battleView.busy()) {
      const attacker = SF.pirates.step(dt);
      if (attacker) {
        SF.battleView.start(attacker);
        return;
      }
    }
    // Kielwasser
    wakeClock += dt;
    if (wakeClock > 0.12) {
      wakeClock = 0;
      if (SF.voyage.moving()) wake.push({ x: s.pos.x - s.pos.dx * 14, y: s.pos.y - s.pos.dy * 14 });
      else if (wake.length) wake.shift();
      if (wake.length > 22) wake.shift();
    }
    // Kamera folgt dem Schiff
    if (cam.follow) {
      const k = Math.min(1, dt * 3);
      cam.x += (s.pos.x - cam.x) * k;
      cam.y += (s.pos.y - cam.y) * k;
    }
    clampCam();
    draw();
    hudClock += dt;
    if (hudClock >= 0.2) {
      hudClock = 0;
      updateHud();
    }
  }

  function clampCam() {
    const hw = vw / 2 / cam.z;
    const hh = vh / 2 / cam.z;
    const W = SF.world.W;
    const H = SF.world.H;
    cam.x = hw * 2 > W ? W / 2 : Math.min(W - hw + 60, Math.max(hw - 60, cam.x));
    cam.y = hh * 2 > H ? H / 2 : Math.min(H - hh + 60, Math.max(hh - 60, cam.y));
  }

  // ---------- Ereignisse vom Segeln ----------

  function handle(e) {
    const s = SF.state;
    switch (e.type) {
      case 'land':
        SF.sound.play('denied');
        SF.ui.toast('Land in Sicht! Hier geht es nicht weiter.');
        break;
      case 'arrive':
        dock(e.place);
        break;
      case 'reveal':
        revealFog(s.pos.x, s.pos.y);
        break;
      case 'discover':
        discover(e.place, e.reward);
        break;
      case 'flotsam':
        SF.sound.play(e.kind === 'amber' ? 'amber' : 'splash');
        SF.ui.toast(e.text);
        break;
      case 'nofood':
        SF.sound.play('grumble');
        SF.ui.tip('Der <b>Proviant ist alle</b>! Die Crew ist hungrig und rudert nur noch halb so eifrig. Kauf im nächsten Hafen neue Fässer.', 8000);
        break;
      case 'lowfood':
        SF.ui.tip('Nur noch <b>ein Fass Proviant</b>! Steuer bald einen Hafen an.', 6000);
        break;
      case 'grumble':
        SF.sound.play('grumble');
        SF.ui.toast('Die Crew murrt: „Wir haben Hunger, Käpt’n!“');
        break;
      default:
        break;
    }
    if (e.type === 'stop' && s.food > 0 && !s.ui.tips['sea-zoom'] && SF.ui.current() === 'sea') {
      SF.ui.tipOnce('sea-zoom', 'Mit <b>zwei Fingern</b> oder den Knöpfen rechts zoomst du. Mit einem Finger (nicht am Schiff) verschiebst du die Karte.', 7000);
    }
  }

  // Texte beim Entdecken der Ziele aus Gamble Klicker
  const DISCOVER_TEXT = {
    fort: 'Graue Mauern, gelbe Fahnen und kein einziges Fischerboot. Wer wohnt hier so allein?',
    bay: 'Früher ist deine Flotte nur auf Zeit hierher gefahren – jetzt bist du selbst da! Im Sand liegt eine kleine Kiste.',
    reef: 'Unter dem Schiff schimmern Korallen und Muscheln. Hier kannst du nach Perlen tauchen!',
    ice: 'Eisschollen knirschen am Rumpf. Bitterkalt ist es im Eismeer!',
    dragon: 'Rauch steigt aus den Felsen, irgendwo brüllt etwas. Besser schnell weiter …',
    volcano: 'Schwarzer Rauch steigt aus dem Vulkan, die Luft riecht nach Schwefel.',
  };

  function discover(id, reward) {
    const p = SF.world.placeById[id];
    SF.sound.play('discover');
    SF.story.log(`Entdeckt: ${p.name}`);
    if (!p.harbor) {
      SF.ui.toast(`${SF.icon(p.icon)} Entdeckt: <b>${p.name}</b>${reward ? ` · +${reward} Bernstein` : ''}`, 3500);
      if (DISCOVER_TEXT[id]) {
        const gk = SF.state.gk && p.gk ? ' (ein Ziel deiner alten Flotte aus Gamble Klicker)' : '';
        setTimeout(() => SF.ui.tip(`<b>${p.name}</b>${gk}: ${DISCOVER_TEXT[id]}`, 8000), 400);
      }
    }
    if (SF.chapter) SF.chapter.onDiscover(id);
    if (id === 'bermuda' && SF.finale) {
      const html = SF.finale.onBermuda();
      setTimeout(() => SF.ui.dialog({ title: `${SF.icon('compass')} Das Bermuda-Dreieck`, html, buttons: [{ label: 'Unglaublich!', value: true, kind: 'primary' }] }), 300);
    }
    if (SF.finale) SF.finale.check();
    SF.save();
  }

  function dock(id) {
    if (!SF.harbor) return;
    SF.voyage.setCourse([]);
    SF.sound.play('bell');
    SF.harbor.open(id);
  }

  // ---------- Zeichnen ----------

  function buildDeco() {
    deco = SF.world.ISLANDS.map(isle => {
      const rnd = SF.world.seeded(isle.circles[0][0] * 7 + isle.circles[0][1]);
      const items = [];
      if (isle.palms) {
        isle.circles.slice(0, 4).forEach(c => items.push({ t: 'palm', x: c[0] + (rnd() - 0.5) * c[2], y: c[1] + (rnd() - 0.5) * c[2], s: 0.8 + rnd() * 0.5 }));
      }
      if (isle.kind === 'green' && !isle.town) {
        isle.circles.slice(0, 3).forEach(c => items.push({ t: 'tree', x: c[0] + (rnd() - 0.5) * c[2], y: c[1] + (rnd() - 0.5) * c[2], s: 0.8 + rnd() * 0.6 }));
      }
      if (isle.town) {
        const place = SF.world.PLACES.find(p => p.harbor && Math.hypot(p.x - isle.circles[0][0], p.y - isle.circles[0][1]) < isle.circles[0][2] * 2.2);
        const [cx, cy, r] = isle.circles[0];
        const tx = place ? cx + (place.x - cx) * 0.55 : cx;
        const ty = place ? cy + (place.y - cy) * 0.55 : cy;
        for (let i = 0; i < 7; i++) items.push({ t: 'house', x: tx + (rnd() - 0.5) * r * 0.7, y: ty + (rnd() - 0.5) * r * 0.7, s: 0.8 + rnd() * 0.4, c: ['#c0392b', '#d4a017', '#2c5d8a', '#8a4a2a'][i % 4] });
        items.push({ t: 'trees', x: cx - (tx - cx) * 0.6, y: cy - (ty - cy) * 0.6 });
      }
      if (isle.kind === 'volcano' || isle.kind === 'dragon') {
        const [cx, cy, r] = isle.circles[0];
        items.push({ t: 'peak', x: isle.kind === 'dragon' ? cx - r * 0.45 : cx, y: isle.kind === 'dragon' ? cy - r * 0.45 : cy, s: isle.kind === 'dragon' ? 1.6 : 1, smoke: isle.kind === 'volcano' });
      }
      if (isle.fort) items.push({ t: 'fort', x: isle.circles[0][0], y: isle.circles[0][1] });
      if (isle.amber) {
        isle.circles.forEach(c => items.push({ t: 'amber', x: c[0] + (rnd() - 0.5) * c[2] * 1.6, y: c[1] + (rnd() - 0.5) * c[2] * 1.6 }));
      }
      return items;
    });
  }

  // Nebel als Pergament-Bild (1 Bildpunkt = FOG_RES Karteneinheiten). Aufgedeckte Stellen werden rund und weich
  // ausgestanzt: beim Öffnen alle bekannten Felder, unterwegs nur der Kreis ums Schiff.
  const FOG_RES = 8;
  function punch(fctx, x, y, r) {
    const g = fctx.createRadialGradient(x / FOG_RES, y / FOG_RES, r * 0.55 / FOG_RES, x / FOG_RES, y / FOG_RES, r / FOG_RES);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    fctx.fillStyle = g;
    fctx.beginPath();
    fctx.arc(x / FOG_RES, y / FOG_RES, r / FOG_RES, 0, Math.PI * 2);
    fctx.fill();
  }

  function buildFog() {
    const Wo = SF.world;
    if (!fogCanvas) {
      fogCanvas = document.createElement('canvas');
      fogCanvas.width = Wo.W / FOG_RES;
      fogCanvas.height = Wo.H / FOG_RES;
    }
    const fctx = fogCanvas.getContext('2d');
    fctx.globalCompositeOperation = 'source-over';
    fctx.fillStyle = `rgb(${PARCHMENT.join(',')})`;
    fctx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
    fctx.globalCompositeOperation = 'destination-out';
    const C = Wo.FOG_CELL;
    for (let cy = 0; cy < Wo.FOG_H; cy++) {
      for (let cx = 0; cx < Wo.FOG_W; cx++) {
        if (Wo.known(cx, cy)) punch(fctx, (cx + 0.5) * C, (cy + 0.5) * C, C * 1.15);
      }
    }
    fctx.globalCompositeOperation = 'source-over';
    fogVer = Wo.fogVersion();
  }

  // Unterwegs: nur den Kreis ums Schiff ausstanzen
  function revealFog(x, y) {
    if (!fogCanvas) return;
    const fctx = fogCanvas.getContext('2d');
    fctx.globalCompositeOperation = 'destination-out';
    punch(fctx, x, y, SF.world.SIGHT + SF.world.FOG_CELL * 0.4);
    fctx.globalCompositeOperation = 'source-over';
    fogVer = SF.world.fogVersion();
  }

  // Ist ein Ort auf der Karte zu sehen?
  function placeKnown(p) {
    if (p.hidden) return !!SF.state.visited[p.id]; // Geheimnis: erst nach dem Besuch auf der Karte
    return !!SF.state.visited[p.id] || SF.world.knownAt(p.x, p.y);
  }

  function draw() {
    const Wo = SF.world;
    const s = SF.state;
    const z = cam.z;
    if (!deco) buildDeco();
    if (fogVer < 0) buildFog();

    // Hintergrund: Pergament
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = `rgb(${PARCHMENT.join(',')})`;
    ctx.fillRect(0, 0, vw, vh);

    // Ab hier in Karteneinheiten
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (vw / 2 - cam.x * z), dpr * (vh / 2 - cam.y * z));
    const x0 = cam.x - vw / 2 / z;
    const y0 = cam.y - vh / 2 / z;
    const x1 = cam.x + vw / 2 / z;
    const y1 = cam.y + vh / 2 / z;

    // Meer: im Norden kühler, im Süden türkis
    const seaG = ctx.createLinearGradient(0, 0, 0, Wo.H);
    seaG.addColorStop(0, '#3f7ba6');
    seaG.addColorStop(0.5, '#4b8fae');
    seaG.addColorStop(1, '#4aa3b0');
    ctx.fillStyle = seaG;
    ctx.fillRect(0, 0, Wo.W, Wo.H);

    // Wellen
    const G = 130;
    ctx.beginPath();
    for (let gx = Math.floor(x0 / G); gx <= Math.ceil(x1 / G); gx++) {
      for (let gy = Math.floor(y0 / G); gy <= Math.ceil(y1 / G); gy++) {
        const wx = gx * G + (gy % 2 ? G / 2 : 0);
        const wy = gy * G + Math.sin(time * 1.3 + gx * 1.7 + gy) * 4;
        ctx.moveTo(wx - 10, wy);
        ctx.quadraticCurveTo(wx, wy - 7, wx + 10, wy);
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,.32)';
    ctx.lineWidth = 2.2 / Math.max(z, 0.6);
    ctx.lineCap = 'round';
    ctx.stroke();

    // Inseln (nur die sichtbaren)
    Wo.ISLANDS.forEach((isle, idx) => {
      const b = isle.box;
      if (b[2] + 20 < x0 || b[0] - 20 > x1 || b[3] + 20 < y0 || b[1] - 20 > y1) return;
      const col = COLORS[isle.kind] || COLORS.green;
      // flaches Wasser und Brandung rund um die Insel, dann Strand, Rand und Land
      const surf = 13 + Math.sin(time * 1.6 + idx) * 2.5;
      [[38, 'rgba(150,215,225,.28)'], [24, 'rgba(175,228,235,.38)'], [surf, 'rgba(255,255,255,.6)'], [9, col[0]], [6, col[1]], [-2, col[2]]].forEach(([pad, color]) => {
        ctx.beginPath();
        isle.circles.forEach(c => {
          const r = Math.max(2, c[2] + pad);
          ctx.moveTo(c[0] + r, c[1]);
          ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
        });
        ctx.fillStyle = color;
        ctx.fill();
      });
      deco[idx].forEach(d => drawDeco(d));
    });

    // Häfen: Steg
    Wo.PLACES.forEach(p => {
      if (!p.harbor || p.x < x0 - 60 || p.x > x1 + 60 || p.y < y0 - 60 || p.y > y1 + 60) return;
      const isle = Wo.ISLANDS.find(i => Math.hypot(p.x - i.circles[0][0], p.y - i.circles[0][1]) < i.circles[0][2] * 2.4 && i.town);
      if (!isle) return;
      const dx = isle.circles[0][0] - p.x;
      const dy = isle.circles[0][1] - p.y;
      const len = Math.hypot(dx, dy);
      ctx.strokeStyle = '#6b4a2a';
      ctx.lineWidth = 9;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(p.x + dx / len * 8, p.y + dy / len * 8);
      ctx.lineTo(p.x + dx / len * 48, p.y + dy / len * 48);
      ctx.stroke();
    });

    // Treibgut
    s.flotsam.forEach(f => {
      if (f.x < x0 - 20 || f.x > x1 + 20 || f.y < y0 - 20 || f.y > y1 + 20 || !Wo.knownAt(f.x, f.y)) return;
      drawFlotsam(f);
    });

    // Piraten (nur in aufgedeckten Gebieten zu sehen)
    if (SF.pirates) {
      SF.pirates.list().forEach(pr => {
        if (pr.x < x0 - 60 || pr.x > x1 + 60 || pr.y < y0 - 60 || pr.y > y1 + 60 || !Wo.knownAt(pr.x, pr.y)) return;
        const k = SF.pirates.KINDS[pr.kind];
        SF.ships.drawTop(ctx, k.ship, pr.x, pr.y, pr.dx, pr.dy, Math.max(1, 26 / (SF.ships.byId[k.ship].len * z)), (Math.sin(time * 2 + pr.x) + 1) / 2, { sail: k.sail });
      });
    }

    // Kielwasser
    const wakeColor = SF.cosmetics ? SF.cosmetics.value('wake') : '255,255,255';
    if (wake.length > 1) {
      ctx.lineCap = 'round';
      for (let i = 1; i < wake.length; i++) {
        ctx.strokeStyle = `rgba(${wakeColor},${(i / wake.length) * 0.6})`;
        ctx.lineWidth = 2 + (i / wake.length) * 5;
        ctx.beginPath();
        ctx.moveTo(wake[i - 1].x, wake[i - 1].y);
        ctx.lineTo(wake[i].x, wake[i].y);
        ctx.stroke();
      }
    }

    // Nebelbänke im Nebelmeer (ziehen langsam)
    const mist = Wo.placeById.mist;
    if (mist && mist.x > x0 - 600 && mist.x < x1 + 600 && mist.y > y0 - 600 && mist.y < y1 + 600) {
      for (let i = 0; i < 9; i++) {
        const mx = mist.x + Math.sin(i * 2.1) * 260 + Math.sin(time * 0.15 + i) * 40;
        const my = mist.y + Math.cos(i * 1.7) * 230;
        const g = ctx.createRadialGradient(mx, my, 20, mx, my, 190);
        g.addColorStop(0, 'rgba(225, 232, 240, .55)');
        g.addColorStop(1, 'rgba(225, 232, 240, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(mx - 190, my - 190, 380, 380);
      }
    }

    // Nebel (unbekannte Karte)
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fogCanvas, 0, 0, Wo.W, Wo.H);
    // Rand der Karte
    ctx.strokeStyle = '#6b5434';
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, Wo.W, Wo.H);

    // Kurs
    if (s.course.length >= 2) {
      ctx.strokeStyle = '#8a1c1c';
      ctx.lineWidth = 3.5 / z;
      ctx.setLineDash([12 / z, 8 / z]);
      ctx.lineDashOffset = -time * 30 / z;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(s.pos.x, s.pos.y);
      for (let i = 0; i < s.course.length; i += 2) ctx.lineTo(s.course[i], s.course[i + 1]);
      ctx.stroke();
      ctx.setLineDash([]);
      const ex = s.course[s.course.length - 2];
      const ey = s.course[s.course.length - 1];
      const k = 9 / z;
      ctx.lineWidth = 4 / z;
      ctx.beginPath();
      ctx.moveTo(ex - k, ey - k); ctx.lineTo(ex + k, ey + k);
      ctx.moveTo(ex + k, ey - k); ctx.lineTo(ex - k, ey + k);
      ctx.stroke();
    }

    // Schiff (mindestens gut sichtbar groß)
    const type = SF.ships.type();
    const scale = Math.max(1, 30 / (type.len * z));
    SF.ships.drawTop(ctx, type.id, s.pos.x, s.pos.y, s.pos.dx, s.pos.dy, scale, (Math.sin(time * 2.2) + 1) / 2, SF.cosmetics ? SF.cosmetics.shipColors() : null);

    // Ab hier in Bildschirmpunkten: Ortsnamen, Ziel
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const goal = SF.story.goal();
    Wo.PLACES.forEach(p => {
      const isGoal = p.id === goal;
      if (!placeKnown(p) && !isGoal) return;
      const sp = toScreen(p.x, p.y);
      if (sp.x < -80 || sp.x > vw + 80 || sp.y < -60 || sp.y > vh + 60) return;
      if (isGoal) drawGoalRing(sp.x, sp.y, placeKnown(p));
      if (placeKnown(p)) {
        ctx.fillStyle = 'rgba(243, 230, 196, .85)';
        ctx.beginPath();
        ctx.arc(sp.x, sp.y - 2, 15, 0, Math.PI * 2);
        ctx.fill();
        SF.icons.draw(ctx, p.icon, sp.x, sp.y - 2, 22, '#2a1d10');
        label(p.name, sp.x, sp.y + 24, p.harbor);
      } else {
        label('? ' + p.name, sp.x, sp.y + 30, false);
      }
    });
    if (goal) drawGoalArrow(Wo.placeById[goal]);
    // Totenkopf über sichtbaren Piraten
    if (SF.pirates) {
      SF.pirates.list().forEach(pr => {
        if (!Wo.knownAt(pr.x, pr.y)) return;
        const sp = toScreen(pr.x, pr.y);
        if (sp.x < -40 || sp.x > vw + 40 || sp.y < -40 || sp.y > vh + 40) return;
        SF.icons.draw(ctx, 'skull', sp.x, sp.y - 30, 22);
      });
    }
  }

  function label(text, x, y, strong) {
    ctx.font = `${strong ? 900 : 700} ${strong ? 15 : 13}px Cinzel, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(243, 230, 196, .9)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = '#2a1d10';
    ctx.fillText(text, x, y);
  }

  function drawGoalRing(x, y, known) {
    const r = 34 + Math.sin(time * 3) * 5;
    ctx.strokeStyle = known ? 'rgba(240, 160, 48, .95)' : 'rgba(138, 28, 28, .8)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Pfeil am Bildschirmrand, wenn das Ziel nicht zu sehen ist (unter dem Ziel-Text, über den Knöpfen)
  function drawGoalArrow(p) {
    const sp = toScreen(p.x, p.y);
    const L = 40;
    const T = 140;
    const R = vw - 90;
    const B = vh - 110;
    if (sp.x > L && sp.x < R && sp.y > T && sp.y < B) return;
    const cx = (L + R) / 2;
    const cy = (T + B) / 2;
    let dx = sp.x - cx;
    let dy = sp.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const tx = Math.abs(dx) > 1e-6 ? (R - L) / 2 / Math.abs(dx) : Infinity;
    const ty = Math.abs(dy) > 1e-6 ? (B - T) / 2 / Math.abs(dy) : Infinity;
    const t = Math.min(tx, ty);
    ctx.save();
    ctx.translate(cx + dx * t, cy + dy * t);
    ctx.transform(dx, dy, -dy, dx, 0, 0);
    ctx.fillStyle = 'rgba(138, 28, 28, .9)';
    ctx.strokeStyle = 'rgba(243, 230, 196, .9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, -14);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-12, 14);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }

  function drawDeco(d) {
    switch (d.t) {
      case 'palm': {
        const s = d.s;
        ctx.strokeStyle = '#7a5a2a';
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y + 8 * s);
        ctx.quadraticCurveTo(d.x + 4 * s, d.y, d.x, d.y - 6 * s);
        ctx.stroke();
        ctx.fillStyle = '#2e7a3a';
        for (let i = 0; i < 5; i++) {
          const a = i * 1.256;
          ctx.beginPath();
          ctx.ellipse(d.x + Math.cos(a) * 7 * s, d.y - 6 * s + Math.sin(a) * 4 * s, 8 * s, 3 * s, a, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'tree':
        ctx.fillStyle = '#3f7a3a';
        ctx.beginPath();
        ctx.arc(d.x, d.y, 9 * d.s, 0, Math.PI * 2);
        ctx.arc(d.x + 8 * d.s, d.y + 4 * d.s, 7 * d.s, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'trees':
        ctx.fillStyle = '#3f7a3a';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) ctx.arc(d.x + (i % 3) * 16 - 16, d.y + Math.floor(i / 3) * 14, 10, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'fort':
        // Bernsteinfestung: Mauer mit Zinnen, Turm und gelber Fahne
        ctx.fillStyle = '#8a8f96';
        ctx.fillRect(d.x - 34, d.y - 8, 68, 26);
        for (let i = 0; i < 5; i++) ctx.fillRect(d.x - 34 + i * 15, d.y - 15, 9, 8);
        ctx.fillStyle = '#a4a9b0';
        ctx.fillRect(d.x - 11, d.y - 40, 22, 58);
        ctx.fillStyle = '#5a5e66';
        ctx.fillRect(d.x - 14, d.y - 46, 28, 8);
        ctx.fillRect(d.x - 5, d.y + 2, 10, 16);
        ctx.fillRect(d.x - 1, d.y - 66, 2, 20);
        ctx.fillStyle = '#f0a030';
        ctx.beginPath();
        ctx.moveTo(d.x + 1, d.y - 66);
        ctx.lineTo(d.x + 19, d.y - 60);
        ctx.lineTo(d.x + 1, d.y - 54);
        ctx.closePath();
        ctx.fill();
        break;
      case 'house':
        ctx.fillStyle = '#efe3c8';
        ctx.fillRect(d.x - 7 * d.s, d.y - 5 * d.s, 14 * d.s, 10 * d.s);
        ctx.fillStyle = d.c;
        ctx.beginPath();
        ctx.moveTo(d.x - 9 * d.s, d.y - 4 * d.s);
        ctx.lineTo(d.x, d.y - 12 * d.s);
        ctx.lineTo(d.x + 9 * d.s, d.y - 4 * d.s);
        ctx.closePath();
        ctx.fill();
        break;
      case 'peak': {
        const s = d.s;
        ctx.fillStyle = '#3a2e28';
        ctx.beginPath();
        ctx.moveTo(d.x - 50 * s, d.y + 30 * s);
        ctx.lineTo(d.x - 12 * s, d.y - 30 * s);
        ctx.lineTo(d.x + 12 * s, d.y - 30 * s);
        ctx.lineTo(d.x + 50 * s, d.y + 30 * s);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#d0402a';
        ctx.beginPath();
        ctx.ellipse(d.x, d.y - 30 * s, 12 * s, 5 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        if (d.smoke) {
          for (let i = 0; i < 4; i++) {
            const t = (time * 0.4 + i / 4) % 1;
            ctx.fillStyle = `rgba(70,70,70,${0.45 * (1 - t)})`;
            ctx.beginPath();
            ctx.arc(d.x + t * 30, d.y - 40 - t * 70, 10 + t * 18, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }
      case 'amber': {
        const a = 0.5 + 0.5 * Math.sin(time * 3 + d.x);
        ctx.fillStyle = `rgba(240,160,48,${0.4 + 0.5 * a})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default:
        break;
    }
  }

  function drawFlotsam(f) {
    const bob = Math.sin(time * 2.5 + f.x) * 2;
    const x = f.x;
    const y = f.y + bob;
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 7, 15, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (f.kind === 'barrel') {
      ctx.fillStyle = '#8a5a2b';
      ctx.strokeStyle = '#3a2410';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y, 10, 8, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 7); ctx.lineTo(x - 4, y + 7);
      ctx.moveTo(x + 4, y - 7); ctx.lineTo(x + 4, y + 7);
      ctx.stroke();
    } else if (f.kind === 'crate') {
      ctx.fillStyle = '#b08040';
      ctx.strokeStyle = '#4a3010';
      ctx.lineWidth = 2;
      ctx.fillRect(x - 9, y - 9, 18, 18);
      ctx.strokeRect(x - 9, y - 9, 18, 18);
      ctx.beginPath();
      ctx.moveTo(x - 9, y - 9); ctx.lineTo(x + 9, y + 9);
      ctx.stroke();
    } else {
      const glow = 0.5 + 0.5 * Math.sin(time * 4 + f.y);
      ctx.fillStyle = `rgba(255,200,80,${0.25 + 0.35 * glow})`;
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f0a030';
      ctx.strokeStyle = '#8a4a08';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, y, 8, 6, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // ---------- Anzeigen ----------

  function updateHud() {
    const s = SF.state;
    const st = SF.ships.stats();
    SF.setHTML($('hud-amber'), SF.amberHTML(s.amber));
    const foodFrac = Math.max(0, Math.min(1, s.food / st.food));
    $('hud-food-fill').style.transform = `scaleX(${foodFrac.toFixed(3)})`;
    $('hud-food').classList.toggle('empty', s.food <= 0);
    $('hud-food').classList.toggle('low', s.food > 0 && s.food < 1.5);
    SF.setText($('hud-food-text'), `${SF.formatDecimal(s.food, 1, 1)} / ${st.food}`);
    SF.setHTML($('hud-cargo'), `${SF.icon('crate')}${SF.ships.cargoCount()} / ${st.hold}`);
    SF.setText($('hud-day'), `Tag ${SF.story.day()}`);
    // Wind: Pfeil zeigt, wohin der Wind weht
    const w = s.wind;
    if (w) {
      const crazy = SF.finale && SF.finale.compassCrazy(); // Bermuda-Dreieck: der Kompass dreht sich
      const deg = crazy ? (time * 400) % 360 : Math.atan2(w.y, w.x) * 180 / Math.PI;
      $('hud-wind-arrow').style.transform = `rotate(${deg.toFixed(1)}deg)`;
      const rel = s.pos.dx * w.x + s.pos.dy * w.y;
      SF.setText($('hud-wind-text'), crazy ? 'Kompass spinnt!' : rel > 0.35 ? 'Rückenwind' : rel < -0.35 ? 'Gegenwind' : 'Seitenwind');
    }
    SF.setHTML($('sea-goal'), SF.story.goalText() ? `${SF.icon('compass')} ${SF.story.goalText()}` : '');
    $('sea-goal').hidden = !SF.story.goalText();
    const near = SF.world.placeNear(s.pos.x, s.pos.y, 130, p => p.harbor);
    $('sea-dock').hidden = !near;
    if (near) SF.setHTML($('sea-dock'), `${SF.icon('anchor')} ${near.name} anlaufen`);
    $('sea-stop').hidden = !SF.voyage.moving();
    // Insel mit Jump'n'Run in der Nähe? (nur wenn das Schiff steht)
    const isle = SF.island && !SF.voyage.moving() ? SF.world.placeNear(s.pos.x, s.pos.y, 170, p => !!SF.island.LEVELS[p.id]) : null;
    $('sea-land').hidden = !isle || !!near;
    const reef = SF.dive && !SF.voyage.moving() ? SF.world.placeNear(s.pos.x, s.pos.y, 170, p => p.id === 'reef') : null;
    $('sea-dive').hidden = !reef;
    $('hud-pearls').hidden = !s.pearls;
    if (s.pearls) SF.setHTML($('hud-pearls'), `${SF.icon('pearl')}${s.pearls}`);
    if (isle) {
      SF.setHTML($('sea-land'), isle.id === 'fort' && SF.chapter && SF.chapter.baronWaiting()
        ? `${SF.icon('swords')} Goldene Gier herausfordern` // Kapitel 5: neuer Versuch gegen den Baron
        : `${SF.icon('palm')} ${isle.name}: an Land gehen`);
    }
  }

  // ---------- Bedienung ----------

  function zoomTo(z, sx = vw / 2, sy = vh / 2) {
    z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    // Punkt unter dem Finger bleibt stehen
    const before = toWorld(sx, sy);
    cam.z = z;
    const after = toWorld(sx, sy);
    cam.x += before.x - after.x;
    cam.y += before.y - after.y;
    SF.state.ui.zoom = z;
  }

  function zoomStep(dir) {
    const i = ZOOM_STEPS.findIndex(z => z >= cam.z - 0.01);
    const cur = i < 0 ? ZOOM_STEPS.length - 1 : i;
    const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, cur + dir))];
    zoomTo(next === cam.z ? cam.z * (dir > 0 ? 1.2 : 0.8) : next);
    SF.sound.play('tap');
  }

  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onDown(e) {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* kein echter Finger (z. B. im Test) */ }
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      gesture = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: cam.z };
      return;
    }
    if (pointers.size > 2) return;
    const s = SF.state;
    const ship = toScreen(s.pos.x, s.pos.y);
    const endIdx = s.course.length - 2;
    const end = endIdx >= 0 ? toScreen(s.course[endIdx], s.course[endIdx + 1]) : null;
    if (Math.hypot(p.x - ship.x, p.y - ship.y) < SHIP_GRAB) {
      SF.voyage.setCourse([]);
      gesture = { mode: 'draw', last: { x: s.pos.x, y: s.pos.y }, blocked: false };
      cam.follow = true;
      SF.ui.hideTip();
    } else if (end && Math.hypot(p.x - end.x, p.y - end.y) < 50) {
      gesture = { mode: 'draw', last: { x: s.course[endIdx], y: s.course[endIdx + 1] }, blocked: false };
    } else {
      gesture = { mode: 'tap', sx: p.x, sy: p.y, lx: p.x, ly: p.y };
    }
  }

  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (!gesture) return;
    if (gesture.mode === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomTo(gesture.z0 * d / gesture.d0, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (gesture.mode === 'draw') {
      addPoint(toWorld(p.x, p.y));
      return;
    }
    if (gesture.mode === 'tap' && Math.hypot(p.x - gesture.sx, p.y - gesture.sy) > 12) gesture.mode = 'pan';
    if (gesture.mode === 'pan') {
      cam.x -= (p.x - gesture.lx) / cam.z;
      cam.y -= (p.y - gesture.ly) / cam.z;
      cam.follow = false;
      gesture.lx = p.x;
      gesture.ly = p.y;
    }
  }

  function onUp(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (!gesture) return;
    if (gesture.mode === 'pinch') {
      if (pointers.size === 0) gesture = null;
      return;
    }
    if (gesture.mode === 'tap' && e.type === 'pointerup') tap(local(e));
    if (gesture.mode === 'draw' && SF.state.course.length >= 2) SF.sound.play('tap');
    gesture = null;
  }

  // Kurspunkt anhängen; über Land wird an der Küste abgeschnitten
  function addPoint(w) {
    const g = gesture;
    if (g.blocked) return;
    const s = SF.state;
    const d = Math.hypot(w.x - g.last.x, w.y - g.last.y);
    if (d < POINT_GAP) return;
    if (s.course.length >= MAX_COURSE) return;
    const free = SF.world.lastFree(g.last.x, g.last.y, w.x, w.y);
    if (Math.hypot(free.x - g.last.x, free.y - g.last.y) > 4) {
      s.course.push(Math.round(free.x), Math.round(free.y));
      g.last = { x: free.x, y: free.y };
    }
    if (free.blocked) {
      g.blocked = true;
      SF.sound.play('denied');
      SF.ui.toast('Da ist Land! Der Kurs endet an der Küste.');
    }
  }

  // Antippen: bekannter Ort = Kurs dorthin (um Inseln herum), Wasser = geradeaus dorthin
  function tap(p) {
    const s = SF.state;
    const goal = SF.story.goal();
    let hit = null;
    let best = 44;
    SF.world.PLACES.forEach(pl => {
      if (!placeKnown(pl) && pl.id !== goal) return;
      const sp = toScreen(pl.x, pl.y);
      const d = Math.hypot(sp.x - p.x, sp.y - p.y);
      if (d < best) { best = d; hit = pl; }
    });
    if (hit) {
      if (hit.harbor && Math.hypot(hit.x - s.pos.x, hit.y - s.pos.y) < 130) {
        dock(hit.id);
        return;
      }
      if (!placeKnown(hit)) {
        SF.ui.toast(`${hit.name} liegt irgendwo dort – zeichne selbst einen Kurs dorthin!`);
        return;
      }
      const r = SF.world.route(s.pos.x, s.pos.y, hit.x, hit.y);
      if (r) {
        SF.voyage.setCourse(r);
        cam.follow = true;
        SF.sound.play('tap');
        SF.ui.toast(`Kurs auf ${hit.name}`);
      } else {
        SF.sound.play('denied');
        SF.ui.toast(`Kein Weg nach ${hit.name} gefunden.`);
      }
      return;
    }
    const w = toWorld(p.x, p.y);
    const free = SF.world.lastFree(s.pos.x, s.pos.y, w.x, w.y);
    if (Math.hypot(free.x - s.pos.x, free.y - s.pos.y) < 20) {
      if (free.blocked) {
        SF.sound.play('denied');
        SF.ui.toast('Da ist Land im Weg.');
      }
      return;
    }
    SF.voyage.setCourse([Math.round(free.x), Math.round(free.y)]);
    cam.follow = true;
    SF.sound.play('tap');
    if (free.blocked) SF.ui.toast('Land im Weg – der Kurs endet an der Küste.');
  }

  function bind() {
    canvas = $('sea-canvas');
    ctx = canvas.getContext('2d');
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const p = local(e);
      zoomTo(cam.z * (e.deltaY < 0 ? 1.1 : 0.9), p.x, p.y);
    }, { passive: false });
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
    $('sea-zoom-in').addEventListener('click', () => zoomStep(1));
    $('sea-zoom-out').addEventListener('click', () => zoomStep(-1));
    $('sea-center').addEventListener('click', () => { cam.follow = true; SF.sound.play('tap'); });
    $('sea-stop').addEventListener('click', () => { SF.voyage.setCourse([]); SF.sound.play('tap'); updateHud(); });
    $('sea-dock').addEventListener('click', () => {
      const s = SF.state;
      const near = SF.world.placeNear(s.pos.x, s.pos.y, 130, p => p.harbor);
      if (near) dock(near.id);
    });
    $('sea-land').addEventListener('click', () => {
      const s = SF.state;
      const isle = SF.world.placeNear(s.pos.x, s.pos.y, 170, p => !!SF.island.LEVELS[p.id]);
      if (!isle) return;
      SF.sound.play('tap');
      SF.voyage.setCourse([]);
      // Kapitel 5: nach einem verlorenen Kampf läuft die „Goldene Gier“ hier wieder aus (statt an Land zu gehen)
      if (isle.id === 'fort' && SF.chapter && SF.chapter.baronWaiting()) {
        SF.chapter.challengeBaron();
        return;
      }
      SF.island.start(isle.id);
    });
    $('sea-dive').addEventListener('click', () => {
      SF.sound.play('splash');
      SF.voyage.setCourse([]);
      SF.dive.start('reef');
    });
    $('sea-cabin').addEventListener('click', () => { SF.sound.play('tap'); if (SF.cabin) SF.cabin.open(); });
  }

  SF.sea = { open, frame, bind, resize, cam, toScreen, toWorld, _draw: () => draw() };
})();
