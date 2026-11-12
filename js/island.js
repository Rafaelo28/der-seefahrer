// Inseln als Jump'n'Run mit Enterhaken (von der Seite, am besten quer). Laufen und Springen mit Knöpfen; den
// Enterhaken wirft man durch Antippen eines Hakenrings – dann schwingt man am Seil (Pendel) und lässt mit
// „Springen“ oder einem zweiten Tipp los. Wasser und Lava kosten Zeit, Krabben besiegt man von oben.
// Am Ende wartet eine Schatzkiste. Bestzeiten werden gespeichert. Regeln (create/step) sind testbar.
window.SF = window.SF || {};

(function () {
  const GRAVITY = 1900;
  const JUMP = 760;
  const RUN = 290;
  const PW = 30;
  const PH = 46;
  const ROPE_MAX = 340;     // so weit reicht das Seil
  const TAP_RANGE = 90;     // so nah muss man an einen Hakenring tippen
  const SWING = 520;        // Schwung mit den Pfeilknöpfen am Seil
  const PENALTY = 4;        // Sekunden Strafe für Wasser, Lava, Krabbe
  const PULL = 260;         // Ruck beim Einhaken

  // Levels: solids [x, y, w, h] · anchors [x, y] · hazards [x, y, w, h, Art] · crabs [x, links, rechts]
  // · amber [x, y] (Bernstein zum Einsammeln) · start [x, y] · chest [x, y]
  const LEVELS = {
    bay: {
      name: 'Nahe Bucht', theme: 'beach', w: 3000, time: 90, reward: 40,
      start: [80, 380],
      solids: [[0, 480, 620, 120], [960, 480, 420, 120], [1180, 380, 120, 20], [1760, 480, 380, 120], [2140, 420, 860, 180]],
      anchors: [[790, 190], [1570, 200], [1640, 170]],
      hazards: [[620, 520, 340, 80, 'water'], [1380, 520, 380, 80, 'water']],
      crabs: [[1050, 980, 1340], [1900, 1780, 2120], [2500, 2160, 2900]],
      amber: [[790, 300], [1240, 330], [1570, 300], [2300, 360], [2600, 360]],
      chest: [2880, 420],
    },
    volcano: {
      name: 'Vulkaninsel', theme: 'volcano', w: 3600, time: 100, reward: 60,
      start: [80, 380],
      solids: [[0, 480, 480, 120], [820, 480, 400, 120], [1020, 360, 120, 20], [1500, 480, 300, 120], [2160, 480, 260, 120],
        [2780, 480, 820, 120], [3000, 380, 140, 20]],
      anchors: [[650, 180], [1360, 190], [1980, 190], [2600, 190]],
      hazards: [[480, 520, 340, 80, 'lava'], [1220, 520, 280, 80, 'lava'], [1800, 520, 360, 80, 'lava'], [2420, 520, 360, 80, 'lava']],
      crabs: [[900, 830, 1210], [1620, 1510, 1790], [3200, 2800, 3400]],
      amber: [[650, 300], [1080, 320], [1360, 300], [1980, 300], [2600, 300], [3070, 340]],
      chest: [3480, 420],
    },
    ice: {
      name: 'Eismeer', theme: 'ice', slippery: true, w: 3000, time: 95, reward: 50,
      start: [80, 380],
      solids: [[0, 480, 560, 120], [900, 480, 420, 120], [1090, 370, 120, 20], [1700, 480, 360, 120], [2060, 430, 940, 170]],
      anchors: [[730, 190], [1510, 195]],
      hazards: [[560, 520, 340, 80, 'ice'], [1320, 520, 380, 80, 'ice']],
      crabs: [[1000, 920, 1300], [1850, 1720, 2050], [2400, 2080, 2900]],
      amber: [[730, 300], [1150, 320], [1510, 300], [2300, 370], [2700, 370]],
      chest: [2880, 430],
    },
    dragon: {
      name: 'Drachenküste', theme: 'dragon', w: 3800, time: 115, reward: 80,
      start: [80, 380],
      solids: [[0, 480, 520, 120], [860, 480, 380, 120], [1050, 360, 120, 20], [1620, 480, 300, 120], [2280, 480, 320, 120],
        [2960, 480, 840, 120], [3200, 380, 140, 20]],
      anchors: [[690, 185], [1430, 190], [2100, 190], [2780, 190]],
      hazards: [[520, 520, 340, 80, 'lava'], [1240, 520, 380, 80, 'lava'], [1920, 520, 360, 80, 'lava'], [2600, 520, 360, 80, 'lava']],
      crabs: [[950, 880, 1220], [1750, 1630, 1900], [2400, 2290, 2590], [3300, 2980, 3700]],
      amber: [[690, 300], [1110, 320], [1430, 300], [2100, 300], [2780, 300], [3270, 340]],
      chest: [3680, 480],
    },
    // Kapitel 5: über den Burggraben in die Bernsteinfestung
    fort: {
      name: 'Bernsteinfestung', theme: 'fort', w: 4400, time: 120, reward: 100,
      start: [80, 380],
      solids: [[0, 480, 500, 120], [840, 480, 360, 120], [1010, 370, 120, 20], [1560, 480, 340, 120], [2260, 480, 300, 120],
        [2900, 480, 320, 120], [3560, 480, 300, 120], [3860, 430, 540, 170]],
      anchors: [[670, 185], [1380, 190], [2050, 195], [2120, 170], [2730, 190], [3390, 185]],
      hazards: [[500, 520, 340, 80, 'water'], [1200, 520, 360, 80, 'water'], [1900, 520, 360, 80, 'water'], [2560, 520, 340, 80, 'water'], [3220, 520, 340, 80, 'water']],
      crabs: [[920, 850, 1180], [1680, 1580, 1780], [2990, 2920, 3080], [4000, 3880, 4200]],
      amber: [[670, 300], [1070, 330], [1380, 300], [2085, 300], [2730, 300], [3390, 300], [4100, 370]],
      chest: [4280, 430],
    },
  };

  // Farben je Insel (nur fürs Zeichnen)
  const INK = '#2a1d10';
  const THEMES = {
    beach: { sky: ['#4f9fe0', '#fbeec8'], far: '#a8d49a', near: '#7cbc7a', ground: '#e8d39a', top: '#6fa35a', plat: '#c79250', crab: '#e0503a', orb: '#fff6c2', glow: 'rgba(255,240,170,.35)', cloud: 'rgba(255,255,255,.92)' },
    volcano: { sky: ['#3a2038', '#e8794a'], far: '#2a1c26', near: '#3a2a2a', ground: '#4a3a32', top: '#2e2420', plat: '#5a4a42', crab: '#e0503a', orb: '#ffb060', glow: 'rgba(255,140,70,.3)', cloud: 'rgba(90,60,70,.7)' },
    dragon: { sky: ['#200c14', '#c84a2a'], far: '#140c10', near: '#1e1418', ground: '#3e302c', top: '#241c1a', plat: '#4a3a34', crab: '#e0503a', orb: '#ff8a4a', glow: 'rgba(255,110,60,.3)', cloud: 'rgba(60,34,40,.75)' },
    ice: { sky: ['#6fa8dc', '#eaf4fb'], far: '#cfe2f2', near: '#f4faff', ground: '#cfe4f2', top: '#ffffff', plat: '#a8d0ea', crab: '#4a8ac8', orb: '#ffffff', glow: 'rgba(255,255,255,.4)', cloud: 'rgba(255,255,255,.9)' },
    fort: { sky: ['#34466a', '#f2b866'], far: '#5a6272', near: '#4b525e', ground: '#8a8f96', top: '#b4b9c0', plat: '#a4a9b0', crab: '#d4a017', orb: '#ffe0a0', glow: 'rgba(255,200,120,.35)', cloud: 'rgba(255,214,170,.6)' },
  };

  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const rect = r => ({ x: r[0], y: r[1], w: r[2], h: r[3] });

  function create(id) {
    const d = LEVELS[id];
    return {
      id, d, t: 0, time: d.time * (SF.state && SF.state.hard ? 0.8 : 1), over: '',
      p: { x: d.start[0], y: d.start[1], vx: 0, vy: 0, ground: false, face: 1, hurt: 0, safe: { x: d.start[0], y: d.start[1] } },
      hook: null,      // { x, y, len } – Seil hängt an einem Ring
      throwFx: null,   // Wurf ins Leere (nur Anzeige)
      solids: d.solids.map(rect),
      hazards: d.hazards.map(h => Object.assign(rect(h), { kind: h[4] })),
      crabs: d.crabs.map(c => ({ x: c[0], y: 0, w: 34, h: 22, x0: c[1], x1: c[2], vx: 70, alive: true })),
      amber: d.amber.map(a => ({ x: a[0], y: a[1], taken: false })),
      chest: { x: d.chest[0] - 30, y: d.chest[1] - 44, w: 60, h: 44 },
      got: 0,
    };
  }

  // Krabben stehen auf dem Boden unter ihnen
  function placeCrabs(L) {
    L.crabs.forEach(c => {
      const ground = L.solids.filter(s => c.x + c.w > s.x && c.x < s.x + s.w).sort((a, b) => a.y - b.y)[0];
      c.y = ground ? ground.y - c.h : 460;
    });
  }

  // Antippen bei (x, y): Haken zum nächsten Ring in Reichweite werfen, oder loslassen, wenn er schon hängt
  function tap(L, x, y) {
    const p = L.p;
    if (L.hook) { release(L); return 'release'; }
    const cx = p.x + PW / 2;
    const cy = p.y + 10;
    let best = null;
    let bd = TAP_RANGE * TAP_RANGE;
    L.d.anchors.forEach(([ax, ay]) => {
      const d = (ax - x) * (ax - x) + (ay - y) * (ay - y);
      const r = (ax - cx) * (ax - cx) + (ay - cy) * (ay - cy);
      if (d < bd && r <= ROPE_MAX * ROPE_MAX) { bd = d; best = [ax, ay]; }
    });
    if (!best) {
      L.throwFx = { x, y, t: 0 };
      return 'miss';
    }
    const len = Math.sqrt((best[0] - cx) * (best[0] - cx) + (best[1] - cy) * (best[1] - cy)) || 1;
    // Das Seil zieht sich straff: etwas kürzer als der Abstand, mit einem Ruck zum Ring hin
    L.hook = { x: best[0], y: best[1], len: Math.max(60, len * 0.8), t: 0 };
    p.vx += (best[0] - cx) / len * PULL;
    p.vy = Math.min(p.vy, -PULL);
    p.ground = false;
    return 'hook';
  }

  function release(L) {
    if (!L.hook) return;
    L.hook = null;
    L.p.vy = Math.min(L.p.vy, 0) - 180; // kleiner Schwung nach oben beim Loslassen
  }

  function penalty(L, ev, kind) {
    L.time -= PENALTY;
    L.hook = null;
    L.p.x = L.p.safe.x;
    L.p.y = L.p.safe.y - 10;
    L.p.vx = 0;
    L.p.vy = 0;
    L.p.hurt = 1;
    ev.push({ type: 'penalty', kind });
  }

  // Ein Schritt. input: { left, right, jump }
  function step(L, dt, input = {}) {
    const ev = [];
    if (L.over) return ev;
    if (!L.t) placeCrabs(L);
    L.t += dt;
    L.time -= dt;
    const p = L.p;
    p.hurt = Math.max(0, p.hurt - dt);
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir) p.face = dir;
    if (L.hook) {
      L.hook.t += dt;
      p.vx += dir * SWING * dt;
      if (input.jump) { release(L); ev.push({ type: 'release' }); }
    } else {
      // am Boden sofort, in der Luft etwas träger lenken
      const target = dir * RUN;
      // auf Eis rutscht man: langsam anlaufen und bremsen
      const grip = p.ground ? (L.d.slippery ? 2.6 : 14) : 4;
      p.vx += (target - p.vx) * Math.min(1, dt * grip);
      if (input.jump && p.ground) {
        p.vy = -JUMP;
        p.ground = false;
        ev.push({ type: 'jump' });
      }
    }
    p.vy = Math.min(1400, p.vy + GRAVITY * dt);
    const ox = p.x;
    const oy = p.y;
    let nx = p.x + p.vx * dt;
    let ny = p.y + p.vy * dt;
    // Seil: nicht weiter weg als die Seillänge (Pendel)
    if (L.hook) {
      const h = L.hook;
      const cx = nx + PW / 2 - h.x;
      const cy = ny + 10 - h.y;
      const d = Math.sqrt(cx * cx + cy * cy) || 1;
      if (d > h.len) {
        const ux = cx / d;
        const uy = cy / d;
        nx = h.x + ux * h.len - PW / 2;
        ny = h.y + uy * h.len - 10;
        const vr = p.vx * ux + p.vy * uy;
        if (vr > 0) { p.vx -= vr * ux; p.vy -= vr * uy; }
      }
    }
    // Waagerecht, dann senkrecht gegen Hindernisse prüfen
    p.x = Math.max(0, Math.min(L.d.w - PW, nx));
    let box = { x: p.x, y: oy, w: PW, h: PH };
    for (const s of L.solids) {
      // nur seitlich aufhalten, wenn man wirklich vor der Kante steht (nicht 1–2 Punkte im Boden)
      if (!overlap(box, s) || box.y + PH - s.y < 3) continue;
      p.x = Math.max(0, Math.min(L.d.w - PW, p.x > ox ? s.x - PW : s.x + s.w));
      p.vx = 0;
      box.x = p.x;
    }
    p.y = ny;
    p.ground = false;
    box = { x: p.x, y: p.y, w: PW, h: PH };
    for (const s of L.solids) {
      if (!overlap(box, s)) continue;
      if (p.y > oy) {
        p.y = s.y - PH;
        p.vy = 0;
        p.ground = true;
        if (L.hook && L.hook.t > 0.3) L.hook = null; // gelandet: Seil los
        p.safe = { x: p.x, y: p.y };
      } else {
        p.y = s.y + s.h;
        p.vy = 0;
      }
      box.y = p.y;
    }
    // Gefahren und Absturz
    const pb = { x: p.x, y: p.y, w: PW, h: PH };
    const haz = L.hazards.find(h => overlap(pb, h));
    if (haz) penalty(L, ev, haz.kind);
    else if (p.y > 620) penalty(L, ev, 'water');
    // Krabben
    for (const c of L.crabs) {
      if (!c.alive) continue;
      c.x += c.vx * dt;
      if (c.x < c.x0) { c.x = c.x0; c.vx = -c.vx; }
      if (c.x + c.w > c.x1) { c.x = c.x1 - c.w; c.vx = -c.vx; }
      const b2 = { x: p.x, y: p.y, w: PW, h: PH };
      if (!overlap(b2, c)) continue;
      if (p.vy > 0 && p.y + PH - c.y < 22) {
        c.alive = false;
        p.vy = -JUMP * 0.55;
        ev.push({ type: 'stomp' });
      } else if (p.hurt <= 0) {
        L.time -= PENALTY;
        p.hurt = 1;
        p.vx = (p.x < c.x ? -1 : 1) * 300;
        p.vy = -400;
        ev.push({ type: 'pinch' });
      }
    }
    // Bernstein einsammeln
    L.amber.forEach(a => {
      if (a.taken) return;
      if (overlap({ x: p.x - 8, y: p.y - 8, w: PW + 16, h: PH + 16 }, { x: a.x - 10, y: a.y - 10, w: 20, h: 20 })) {
        a.taken = true;
        L.got++;
        ev.push({ type: 'amber' });
      }
    });
    if (L.throwFx) { L.throwFx.t += dt; if (L.throwFx.t > 0.5) L.throwFx = null; }
    // Ziel
    if (overlap({ x: p.x, y: p.y, w: PW, h: PH }, L.chest)) {
      L.over = 'won';
      ev.push({ type: 'won' });
    } else if (L.time <= 0) {
      L.time = 0;
      L.over = 'lost';
      ev.push({ type: 'timeout' });
    }
    return ev;
  }

  // Belohnung: Truhe (beim ersten Mal ganz, danach ein Viertel) plus eingesammelter Bernstein; Bestzeit
  function reward(L) {
    const s = SF.state;
    if (!s.islands || typeof s.islands !== 'object') s.islands = {};
    const rec = s.islands[L.id] || { best: 0, wins: 0 };
    const first = !rec.wins;
    const chest = first ? L.d.reward : Math.round(L.d.reward / 4);
    const amber = SF.amber.add(chest + L.got * 3);
    const secs = Math.round(L.t * 10) / 10;
    const best = !rec.best || secs < rec.best;
    rec.wins++;
    if (best) rec.best = secs;
    s.islands[L.id] = rec;
    return { amber, first, best, secs };
  }

  // ---------- Bildschirm ----------

  const $ = id => document.getElementById(id);
  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let vw = 0;
  let vh = 0;
  let L = null;
  let camX = 0;
  let time = 0;
  let figImg = null;
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

  function start(id) {
    L = create(id);
    ending = false;
    keys.left = keys.right = keys.jump = false;
    figImg = new Image();
    figImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SF.figure.svg(SF.figure.mine()));
    SF.ui.show('island');
    resize();
    camX = 0;
    SF.setText($('is-name'), L.d.name);
    const rec = (SF.state.islands || {})[id];
    SF.setText($('is-best'), rec && rec.best ? `Bestzeit ${SF.formatDecimal(rec.best, 1, 1)} s` : '');
    SF.track('seefahrer-insel-' + id);
    SF.ui.tipOnce('island', 'Tipp auf einen goldenen <b>Hakenring</b> – dein Enterhaken fliegt hin und du schwingst! Mit <b>Springen</b> lässt du los. Lauf bis zur <b>Schatzkiste</b>.', 9000);
  }

  // Maßstab: ganze Höhe (600) und mindestens 900 in der Breite sichtbar; der Boden sitzt unten am Rand
  function scale() { return Math.min(vh / 600, vw / 900); }
  const offY = () => vh - 600 * scale();

  function frame(dt) {
    if (!L || !canvas) return;
    time += dt;
    const ev = step(L, dt, { left: keys.left, right: keys.right, jump: jumpQueued || (keys.jump && !L.hook) });
    jumpQueued = false;
    ev.forEach(e => {
      if (e.type === 'jump') SF.sound.play('jump');
      else if (e.type === 'amber') SF.sound.play('amber');
      else if (e.type === 'stomp') SF.sound.play('hit');
      else if (e.type === 'pinch') { SF.sound.play('hurt'); SF.ui.toast('Zwick! −4 Sekunden', 1200); }
      else if (e.type === 'penalty') { SF.sound.play('splash'); SF.ui.toast(e.kind === 'lava' ? 'Heiß! −4 Sekunden' : e.kind === 'ice' ? 'Brrr, eiskalt! −4 Sekunden' : 'Platsch! −4 Sekunden', 1200); }
    });
    const viewW = vw / scale();
    camX += (Math.max(0, Math.min(L.d.w - viewW, L.p.x - viewW * 0.4)) - camX) * Math.min(1, dt * 5);
    draw();
    SF.setText($('is-time'), Math.ceil(L.time));
    SF.setText($('is-amber'), L.got);
    if (L.over && !ending) {
      ending = true;
      const won = L.over === 'won';
      SF.sound.play(won ? 'fanfare' : 'lose');
      const r = won ? reward(L) : null;
      const story = won && SF.chapter ? SF.chapter.onIsland(L.id) : '';
      SF.save();
      setTimeout(async () => {
        await SF.ui.dialog(won ? {
          title: `${SF.icon('chest')} Schatz gefunden!`,
          html: `<p>In der Kiste: ${SF.amberHTML(r.amber)}${r.first ? '' : ' <span class="muted small">(beim ersten Mal war mehr drin)</span>'}.</p>
            <p>Zeit: <b>${SF.formatDecimal(r.secs, 1, 1)} s</b>${r.best ? ' – <b>neue Bestzeit!</b>' : ''}</p>${story}`,
          buttons: [{ label: 'Zurück aufs Schiff', value: true, kind: 'primary' }],
        } : {
          title: 'Die Zeit ist um',
          html: '<p>Die Flut kommt! Schnell zurück aufs Schiff – versuch es noch einmal.</p>',
          buttons: [{ label: 'Zurück aufs Schiff', value: true, kind: 'primary' }],
        });
        if (won) SF.story.log(`${L.d.name}: Schatz gefunden (${SF.formatDecimal(r.secs, 1, 1)} s).`);
        if (SF.finale) setTimeout(() => SF.finale.check(), 600);
        L = null;
        SF.sea.open();
      }, 600);
    }
  }

  function draw() {
    const sc = scale();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const theme = L.d.theme;
    const T = THEMES[theme] || THEMES.beach;
    const sky = ctx.createLinearGradient(0, 0, 0, vh * 0.85);
    sky.addColorStop(0, T.sky[0]);
    sky.addColorStop(1, T.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, vw, vh);
    // Sonne (oder Glut am Himmel) und Wolken
    const sx = vw * 0.78 - camX * 0.02;
    const sy = vh * 0.2;
    ctx.fillStyle = T.glow;
    ctx.beginPath();
    ctx.arc(sx, sy, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = T.orb;
    ctx.beginPath();
    ctx.arc(sx, sy, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = T.cloud;
    const span = vw + 360;
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 330 + time * (5 + i * 2) - camX * 0.08) % span + span) % span - 180;
      const cy = vh * (0.09 + (i % 3) * 0.09);
      const r = 28 + (i % 2) * 10;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.arc(cx + r * 1.1, cy + 6, r * 0.8, 0, Math.PI * 2);
      ctx.arc(cx - r * 1.1, cy + 8, r * 0.7, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.3, cy - r * 0.5, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
    // Hintergrund in zwei Schichten (verschieben sich langsamer): Hügel, Vulkan, Eisberge oder die Festung
    const lava = theme === 'volcano' || theme === 'dragon';
    [[0.15, T.far, 250, 70, 520], [0.3, T.near, 320, 55, 380]].forEach(([par, color, base, amp, wave], layer) => {
      ctx.setTransform(dpr * sc, 0, 0, dpr * sc, -camX * par * sc * dpr, dpr * offY());
      const a = camX * par - 40;
      const e = a + vw / sc + 80;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a, 620);
      for (let x = Math.floor(a / 40) * 40; x <= e + 40; x += 40) {
        let y = base + Math.sin(x / wave * 6.28 + layer * 2) * amp + Math.sin(x / wave * 15.7 + layer) * amp * 0.25;
        if (theme === 'ice' || lava) y = base + Math.abs(((x / wave + layer * 0.37) % 1) - 0.5) * amp * 3.2 - amp * 0.6; // spitze Gipfel
        ctx.lineTo(x, y);
      }
      ctx.lineTo(e + 40, 620);
      ctx.closePath();
      ctx.fill();
      if (layer === 1) {
        for (let x = Math.floor(a / 760) * 760; x <= e; x += 760) {
          if (theme === 'beach') {
            // Palmen auf den Hügeln
            [x + 180, x + 520].forEach((px, i) => {
              const py = base + Math.sin(px / wave * 6.28 + 2) * amp + 8;
              ctx.strokeStyle = '#7a5a34';
              ctx.lineWidth = 7;
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.quadraticCurveTo(px + 10, py - 50, px + 4 + i * 6, py - 92);
              ctx.stroke();
              ctx.strokeStyle = '#3f8f4a';
              ctx.lineWidth = 8;
              ctx.beginPath();
              [-1, -0.45, 0.45, 1].forEach(d => { ctx.moveTo(px + 4 + i * 6, py - 92); ctx.quadraticCurveTo(px + d * 34, py - 112, px + d * 54, py - 78 + Math.abs(d) * 6); });
              ctx.stroke();
            });
          } else if (theme === 'fort') {
            // Mauern und Türme der Festung mit erleuchteten Fenstern
            const fy = 250;
            ctx.fillStyle = '#4b525e';
            ctx.fillRect(x + 100, fy, 420, 240);
            for (let k = 0; k < 11; k++) ctx.fillRect(x + 100 + k * 40, fy - 18, 24, 20);
            [x + 80, x + 300, x + 500].forEach((tx, i) => {
              ctx.fillRect(tx, fy - 90 - (i === 1 ? 50 : 0), 60, 330);
              for (let k = 0; k < 3; k++) ctx.fillRect(tx - 4 + k * 24, fy - 106 - (i === 1 ? 50 : 0), 16, 18);
            });
            ctx.fillStyle = '#ffd27a';
            [[x + 100, fy - 50], [x + 322, fy - 100], [x + 522, fy - 50], [x + 200, fy + 50], [x + 420, fy + 50]].forEach(([wx, wy]) => ctx.fillRect(wx, wy, 14, 22));
            ctx.fillStyle = '#f0a030';
            ctx.beginPath();
            ctx.moveTo(x + 331, fy - 196); ctx.lineTo(x + 372, fy - 184); ctx.lineTo(x + 331, fy - 172);
            ctx.closePath();
            ctx.fill();
            ctx.fillRect(x + 328, fy - 198, 3, 44);
          } else if (lava) {
            // Glut über dem Krater
            const gx = x + 190;
            const g = ctx.createRadialGradient(gx, 170, 4, gx, 170, 120);
            g.addColorStop(0, 'rgba(255,150,60,.55)');
            g.addColorStop(1, 'rgba(255,150,60,0)');
            ctx.fillStyle = g;
            ctx.fillRect(gx - 120, 50, 240, 240);
          }
        }
      }
    });
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, -camX * sc * dpr, dpr * offY());
    const x0 = camX - 20;
    const x1 = camX + vw / sc + 20;
    const stroke = (fill, lw = 3) => { ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke(); };
    // Hakenringe an Seilen
    L.d.anchors.forEach(([ax, ay]) => {
      if (ax < x0 - 30 || ax > x1 + 30) return;
      ctx.strokeStyle = '#b89a6a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ax, -400);
      ctx.lineTo(ax, ay - 14);
      ctx.stroke();
      const r = 14 + Math.sin(time * 4 + ax) * 1.5;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(ax, ay, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#f5c542';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ax, ay, r, Math.PI * 1.1, Math.PI * 1.5);
      ctx.stroke();
    });
    // Gefahren: Wasser mit Wellen, Lava mit Glut
    L.hazards.forEach(h => {
      if (h.x > x1 || h.x + h.w < x0) return;
      const hot = h.kind === 'lava';
      const top = h.y + Math.sin(time * 3 + h.x) * 3;
      const g = ctx.createLinearGradient(0, top, 0, top + 120);
      g.addColorStop(0, hot ? '#ffb040' : h.kind === 'ice' ? '#3a7aa8' : '#3d9ac8');
      g.addColorStop(1, hot ? '#c8361a' : h.kind === 'ice' ? '#143a58' : '#1d5f88');
      ctx.fillStyle = g;
      ctx.fillRect(h.x, top, h.w, h.h + 400);
      ctx.strokeStyle = hot ? 'rgba(255,240,170,.9)' : 'rgba(255,255,255,.75)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let x = h.x; x <= h.x + h.w; x += 20) ctx[x === h.x ? 'moveTo' : 'lineTo'](x, top + Math.sin(x * 0.06 + time * 3) * 3);
      ctx.stroke();
      if (hot) {
        // Blasen in der Lava
        for (let k = 0; k < 3; k++) {
          const t = (time * 0.7 + k * 0.37 + h.x * 0.01) % 1;
          ctx.fillStyle = `rgba(255,220,120,${0.8 * (1 - t)})`;
          ctx.beginPath();
          ctx.arc(h.x + h.w * (0.2 + k * 0.3), top + 26 - t * 22, 4 + t * 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
    // Boden und Plattformen
    L.solids.forEach(s => {
      if (s.x > x1 || s.x + s.w < x0) return;
      const thin = s.h <= 30;
      if (thin) {
        // schwebende Plattform: Holzbohle bzw. Steinplatte
        SF.sprite.rr(ctx, s.x, s.y, s.w, s.h, 6);
        stroke(T.plat);
        ctx.fillStyle = 'rgba(255,255,255,.22)';
        ctx.fillRect(s.x + 6, s.y + 3, s.w - 12, 3);
        return;
      }
      ctx.fillStyle = T.ground;
      ctx.fillRect(s.x, s.y, s.w, s.h + 400);
      // Muster im Boden
      ctx.strokeStyle = 'rgba(0,0,0,.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (theme === 'fort') {
        for (let y = s.y + 34; y < 620; y += 30) {
          ctx.moveTo(s.x, y); ctx.lineTo(s.x + s.w, y);
          for (let x = s.x + ((y / 30) % 2 ? 30 : 0); x < s.x + s.w; x += 60) { ctx.moveTo(x, y); ctx.lineTo(x, y + 30); }
        }
      } else {
        for (let x = s.x + 30; x < s.x + s.w - 10; x += 70) { const y = s.y + 40 + (x % 3) * 22; ctx.moveTo(x, y); ctx.lineTo(x + 18, y + 4); }
      }
      ctx.stroke();
      // Oberseite: Gras, Schnee, Stein oder Schlacke
      ctx.fillStyle = T.top;
      ctx.fillRect(s.x, s.y, s.w, 14);
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(s.x, s.y, s.w, 4);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y + 600); ctx.lineTo(s.x, s.y); ctx.lineTo(s.x + s.w, s.y); ctx.lineTo(s.x + s.w, s.y + 600);
      ctx.stroke();
      if (theme === 'beach') {
        // Grasbüschel
        ctx.strokeStyle = '#4f8f4a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = s.x + 24; x < s.x + s.w - 12; x += 58) { ctx.moveTo(x, s.y); ctx.lineTo(x - 5, s.y - 10); ctx.moveTo(x + 4, s.y); ctx.lineTo(x + 5, s.y - 13); ctx.moveTo(x + 8, s.y); ctx.lineTo(x + 14, s.y - 9); }
        ctx.stroke();
      } else if (lava) {
        ctx.fillStyle = `rgba(255,140,50,${0.5 + Math.sin(time * 3) * 0.2})`;
        for (let x = s.x + 40; x < s.x + s.w - 20; x += 110) ctx.fillRect(x, s.y + 24 + (x % 2) * 18, 26, 3);
      }
    });
    // Bernstein
    L.amber.forEach(a => { if (!a.taken && a.x > x0 && a.x < x1) SF.sprite.gem(ctx, a.x, a.y, time, a.x); });
    // Krabben: Panzer, Stielaugen, Scheren, Beine
    L.crabs.forEach(c => {
      if (!c.alive || c.x > x1 || c.x + c.w < x0) return;
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h * 0.62;
      const snap = Math.sin(time * 12 + c.x) * 3;
      const body = T.crab;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      [-1, 1].forEach(d => { for (let k = 0; k < 3; k++) { ctx.moveTo(cx + d * (6 + k * 5), cy + 4); ctx.lineTo(cx + d * (12 + k * 6), c.y + c.h + (k % 2 ? snap * 0.4 : 0)); } });
      ctx.stroke();
      [-1, 1].forEach(d => {
        ctx.beginPath();
        ctx.arc(cx + d * (c.w / 2 + 5), c.y + 4 + d * snap, 7, 0, Math.PI * 2);
        stroke(body, 2.5);
        ctx.beginPath();
        ctx.moveTo(cx + d * 8, c.y + 6); ctx.lineTo(cx + d * 8, c.y - 4);
        ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + d * 8, c.y - 6, 4, 0, Math.PI * 2);
        stroke('#fff', 2);
        ctx.fillStyle = INK;
        ctx.fillRect(cx + d * 8 - 1.5, c.y - 7.5, 3, 3);
      });
      ctx.beginPath();
      ctx.ellipse(cx, cy, c.w / 2, c.h / 2.2, 0, 0, Math.PI * 2);
      stroke(body, 3);
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.beginPath();
      ctx.ellipse(cx - 5, cy - 4, c.w * 0.22, c.h * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    // Schatzkiste mit Schimmer
    const ch = L.chest;
    ctx.fillStyle = 'rgba(255,220,120,.3)';
    ctx.beginPath();
    ctx.arc(ch.x + ch.w / 2, ch.y + ch.h / 2, 46 + Math.sin(time * 5) * 4, 0, Math.PI * 2);
    ctx.fill();
    SF.icons.draw(ctx, 'chest', ch.x + ch.w / 2, ch.y + ch.h / 2 - 6, 72);
    // Seil
    const p = L.p;
    if (L.hook) {
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(L.hook.x, L.hook.y);
      ctx.lineTo(p.x + PW / 2, p.y + 6);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = '#c8a060';
      ctx.lineWidth = 3;
      ctx.stroke();
      SF.icons.draw(ctx, 'hook', L.hook.x, L.hook.y, 26);
    } else if (L.throwFx) {
      const t = L.throwFx.t / 0.5;
      ctx.strokeStyle = `rgba(58,36,16,${1 - t})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(p.x + PW / 2, p.y + 10);
      ctx.lineTo(L.throwFx.x, L.throwFx.y + t * 80);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Figur mit Beinen (blinkt nach einem Treffer)
    if (!(p.hurt > 0 && Math.floor(time * 12) % 2)) {
      SF.sprite.char(ctx, SF.figure.mine(), p.x + PW / 2, p.y + PH, p.face, 64, Math.abs(p.vx) > 20 && !!p.ground, !p.ground, time);
    }
  }

  function bind() {
    canvas = $('island-canvas');
    ctx = canvas.getContext('2d');
    canvas.addEventListener('pointerdown', e => {
      if (!L) return;
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const sc = scale();
      const res = tap(L, (e.clientX - r.left) / sc + camX, (e.clientY - r.top - offY()) / sc);
      if (res === 'hook') SF.sound.play('tap');
      else if (res === 'miss') SF.sound.play('denied');
    });
    const hold = (id, key) => {
      const el = $(id);
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* kein echter Finger (z. B. im Test) */ }
        keys[key] = true;
        if (key === 'jump') jumpQueued = true;
      });
      const up = () => { keys[key] = false; };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
    };
    hold('is-left', 'left');
    hold('is-right', 'right');
    hold('is-jump', 'jump');
    $('is-quit').addEventListener('click', async () => {
      if (!L) return;
      const ok = await SF.ui.confirm('Zurück aufs Schiff?', '<p>Die Insel bleibt hier – du kannst es später noch einmal versuchen.</p>', 'Zurück', 'Weiter suchen');
      if (ok && L) { L = null; SF.sea.open(); }
    });
    window.addEventListener('resize', resize);
  }

  SF.island = { LEVELS, ROPE_MAX, TAP_RANGE, PENALTY, PW, PH, create, step, tap, release, reward, start, frame, bind, resize, _level: () => L };
})();
