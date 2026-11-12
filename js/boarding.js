// Entern: Jump'n'Run auf dem Deck des Piratenschiffs (von der Seite). Man läuft über das Deck bis zur Kapitänskajüte
// und plündert unterwegs: Bernstein-Beutel und Schatzkisten liegen auf Kisten, hängenden Planken und über offenen
// Luken. Die Crew wehrt sich – Läufer, Säbel-Piraten (stürmen los), Flaschenwerfer, Kanonen und rollende Fässer.
// Piraten besiegt man mit einem Sprung auf den Kopf. Drei Herzen und eine Sanduhr; die Beute zählt nur, wenn man die
// Kajüte erreicht. Regeln ohne Bildschirm (create/step, testbar, rechnen überall gleich) und Bildschirm in einer Datei.
window.SF = window.SF || {};

(function () {
  const DECK = 480;        // Höhe der Deck-Oberfläche (y nach unten)
  const QUARTER = 390;     // erhöhtes Achterdeck
  const GRAVITY = 1900;
  const JUMP = 760;
  const RUN = 280;
  const PW = 30;           // Spielfigur: Breite …
  const PH = 46;           // … und Höhe
  const HEARTS = 3;
  const COYOTE = 0.09;     // so lange nach der Kante darf man noch abspringen
  const BUFFER = 0.12;     // so lange vor dem Landen zählt ein Sprung-Tipp schon
  const SEC = 540;         // Länge eines Deck-Abschnitts
  const LEAD = 280;        // freies Stück am Anfang
  const AFT = 660;         // Länge des Achterdecks
  const BOTTLE_G = 1000;

  // Je Schiff: Abschnitte, Zeit, Wert eines Bernstein-Beutels, welche Abschnitte vorkommen dürfen
  const SHIPS = {
    raider: { n: 4, time: 60, amber: 2, pool: ['kisten', 'luke', 'planken', 'saebel', 'kanone'] },
    shark: { n: 5, time: 75, amber: 3, pool: ['kisten', 'luke', 'planken', 'saebel', 'kanone', 'werfer', 'doppelluke', 'netz'] },
    bluebeard: { n: 6, time: 90, amber: 4, pool: ['planken', 'saebel', 'kanone', 'werfer', 'doppelluke', 'netz', 'kanonenluke', 'werferplanke'] },
    dutchman: { n: 6, time: 100, amber: 5, pool: ['planken', 'saebel', 'kanone', 'werfer', 'doppelluke', 'netz', 'kanonenluke', 'werferplanke'] },
    // Kapitel 4 und 5: Kurier des Barons und sein Flaggschiff
    courier: { n: 5, time: 75, amber: 3, pool: ['kisten', 'planken', 'saebel', 'kanone', 'werfer', 'doppelluke', 'netz'] },
    baron: { n: 6, time: 105, amber: 6, pool: ['planken', 'saebel', 'kanone', 'werfer', 'doppelluke', 'netz', 'kanonenluke', 'werferplanke'] },
  };

  // Fester Zufall (gleiche Zahlenfolge auf allen Geräten); der Stand steckt im Level
  function rand(L) {
    L.seed = (Math.imul(L.seed, 1664525) + 1013904223) >>> 0;
    return L.seed / 4294967296;
  }

  // Level bauen: Deck mit Luken, Kisten und Fässer, hängende Planken, Piraten, Kanonen, Beute, Tür
  function create(kind = 'raider', seed = 7) {
    const def = SHIPS[kind] || SHIPS.raider;
    const hard = !!(SF.state && SF.state.hard);
    const QX = LEAD + def.n * SEC;       // hier beginnt das Achterdeck
    const W = QX + AFT;
    const L = {
      kind, w: W, qx: QX, seed: (Math.imul(seed, 0x9e3779b1) + kind.length * 101) >>> 0 || 1,
      t: 0, time: def.time * (hard ? 0.8 : 1), over: '', why: '',
      hearts: hard ? HEARTS - 1 : HEARTS, maxHearts: hard ? HEARTS - 1 : HEARTS,
      p: { x: 60, y: 200, vx: 0, vy: 0, ground: false, face: 1, hurt: 0, lock: 0, coyote: 0, buf: 0, safeX: 60 },
      solids: [], plats: [], hatches: [], enemies: [], cannons: [], shots: [], loot: [],
      roller: null, locked: false, sections: [],
      door: { x: W - 150, y: QUARTER - 92, w: 60, h: 92 },
      stomps: 0, got: { amber: 0, chests: 0 },
    };
    const A = def.amber;
    const add = {
      crate(x, n = 1) { for (let i = 0; i < n; i++) L.solids.push({ x, y: DECK - 60 * (i + 1), w: 60, h: 60, k: 'crate' }); },
      barrel(x) { L.solids.push({ x, y: DECK - 56, w: 44, h: 56, k: 'barrel' }); },
      hatch(x, w) { L.hatches.push({ x, w }); },
      plank(x, up, w) { L.plats.push({ x, y: DECK - up, w, k: 'plank' }); },
      amber(x, up) { L.loot.push({ k: 'amber', x: x - 13, y: DECK - up - 13, w: 26, h: 26, v: A, taken: false }); },
      chest(x, up) { L.loot.push({ k: 'chest', x: x - 22, y: DECK - up - 34, w: 44, h: 34, v: 1, taken: false }); },
      walker(x0, x1, up = 0) { L.enemies.push({ type: 'walker', x: x0, y: DECK - up - 44, w: 30, h: 44, vx: 70 + rand(L) * 30, x0, x1, alive: true, lives: 1 }); },
      saber(x0, x1, up = 0) { L.enemies.push({ type: 'saber', x: x1, y: DECK - up - 46, w: 32, h: 46, vx: -55, x0, x1, alive: true, lives: 1, mode: 'walk', clock: 0 }); },
      thrower(x, up) { L.enemies.push({ type: 'thrower', x, y: DECK - up - 44, w: 30, h: 44, vx: 0, x0: x, x1: x, alive: true, lives: 1, clock: 1 + rand(L), period: 2.4 }); },
      cannon(x, period = 2.3) { L.solids.push({ x, y: DECK - 38, w: 58, h: 38, k: 'cannon' }); L.cannons.push({ x, y: DECK - 24, period, clock: 0.8 + rand(L) * 0.8, warn: 0 }); },
    };
    // Abschnitte (o = linker Rand); jeder ist für sich schaffbar und hat Beute an einer kniffligen Stelle
    const SECTIONS = {
      kisten(o) { add.crate(o + 110); add.crate(o + 290, 2); add.amber(o + 140, 82); add.amber(o + 320, 142); add.amber(o + 215, 30); add.walker(o + 380, o + 500); },
      luke(o) { add.barrel(o + 50); add.hatch(o + 190, 96); add.amber(o + 238, 120); add.amber(o + 238, 30 + 150); add.walker(o + 320, o + 500); },
      planken(o) { add.plank(o + 110, 125, 150); add.plank(o + 300, 240, 150); add.amber(o + 150, 150); add.amber(o + 230, 150); add.chest(o + 375, 240); add.saber(o + 120, o + 480); },
      saebel(o) { add.crate(o + 30); add.saber(o + 120, o + 420); add.amber(o + 200, 30); add.amber(o + 270, 110); add.amber(o + 340, 30); add.crate(o + 460); },
      kanone(o) { add.barrel(o + 30); add.amber(o + 150, 26); add.amber(o + 250, 26); add.amber(o + 350, 26); add.cannon(o + 450); },
      werfer(o) { add.crate(o + 220); add.crate(o + 280, 2); add.thrower(o + 295, 120); add.amber(o + 250, 82); add.amber(o + 420, 30); add.amber(o + 480, 30); },
      doppelluke(o) { add.hatch(o + 100, 90); add.amber(o + 145, 120); add.barrel(o + 240); add.hatch(o + 330, 90); add.amber(o + 375, 120); add.walker(o + 440, o + 510); },
      netz(o) { add.hatch(o + 120, 210); add.plank(o + 175, 70, 110); add.amber(o + 230, 96); add.plank(o + 330, 190, 120); add.chest(o + 390, 190); add.walker(o + 370, o + 510); },
      kanonenluke(o) { add.amber(o + 90, 26); add.hatch(o + 200, 90); add.amber(o + 245, 120); add.amber(o + 360, 26); add.cannon(o + 460, 2); },
      werferplanke(o) { add.hatch(o + 50, 80); add.crate(o + 190); add.plank(o + 280, 150, 130); add.thrower(o + 330, 150); add.chest(o + 385, 150); add.walker(o + 300, o + 510); },
    };
    let last = '';
    for (let i = 0; i < def.n; i++) {
      let id = def.pool[Math.floor(rand(L) * def.pool.length)];
      if (id === last) id = def.pool[(def.pool.indexOf(id) + 1) % def.pool.length];
      last = id;
      L.sections.push(id);
      SECTIONS[id](LEAD + i * SEC);
    }
    // Deck: durchgehend, nur an den Luken offen
    let x = 0;
    L.hatches.sort((a, b) => a.x - b.x).forEach(h => {
      L.solids.push({ x, y: DECK, w: h.x - x, h: 140, k: 'deck' });
      x = h.x + h.w;
    });
    L.solids.push({ x, y: DECK, w: QX - x, h: 140, k: 'deck' });
    L.solids.push({ x: QX, y: QUARTER, w: AFT, h: 230, k: 'deck' });
    L.solids.push({ x: W - 60, y: QUARTER - 260, w: 60, h: 260, k: 'cabin' }); // Rückwand der Kajüte
    // Achterdeck: Wachen oder der Kapitän, die Truhe des Kapitäns vor der Tür
    const up = DECK - QUARTER;
    add.chest(W - 215, up);
    add.amber(QX + 190, up + 110);
    add.amber(QX + 290, up + 110);
    if (kind === 'raider') add.walker(QX + 120, QX + 420, up);
    else if (kind === 'shark' || kind === 'courier') { add.saber(QX + 110, QX + 440, up); add.walker(QX + 60, QX + 200, up); }
    else {
      const lj = kind === 'dutchman';
      const baron = kind === 'baron';
      // Kapitän: mehrere Treffer, stürmt los wie ein Säbel-Pirat; die Tür ist erst offen, wenn er besiegt ist.
      // Long John und der Baron werfen außerdem Flaschen, wenn man Abstand hält.
      L.enemies.push({ type: 'boss', boss: true, longjohn: lj, baron, throws: lj || baron, x: QX + 380, y: QUARTER - 60, w: 40, h: 60, vx: -80, x0: QX + 90, x1: QX + 450,
        alive: true, lives: lj || baron ? 3 : 2, mode: 'walk', clock: 0, stun: 0, tclock: 2.5, period: baron ? 2.6 : 3 });
      L.locked = true;
      if (!lj) L.roller = { x: QX - 30, period: baron ? 3.2 : 3.6, clock: 2 }; // die Crew rollt Fässer über das Deck
      else add.walker(QX + 60, QX + 200, up);
    }
    return L;
  }

  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const doorOpen = L => !L.locked || !L.enemies.some(e => e.boss && e.alive);

  // Treffer: ein Herz weg, kurz unverwundbar
  function damage(L, ev, by, dirX) {
    const p = L.p;
    if (p.hurt > 0 && by !== 'fall') return false;
    L.hearts--;
    p.hurt = 1.3;
    if (by !== 'fall') {
      p.lock = 0.3;
      p.vx = dirX * 300;
      p.vy = -380;
      p.ground = false;
    }
    ev.push({ type: by === 'fall' ? 'fall' : 'hurt', by });
    if (L.hearts <= 0) {
      L.hearts = 0;
      L.over = 'lost';
      L.why = 'hearts';
      ev.push({ type: 'lost', why: 'hearts' });
    }
    return true;
  }

  // Flasche werfen: so, dass sie nach T Sekunden beim Spieler landet
  function throwBottle(L, e, ev) {
    const p = L.p;
    const T = 0.85;
    const sx = e.x + e.w / 2;
    const sy = e.y + 6;
    let vx = (p.x + PW / 2 - sx) / T;
    vx = Math.max(-460, Math.min(460, vx));
    const vy = (p.y + PH / 2 - sy) / T - 0.5 * BOTTLE_G * T;
    L.shots.push({ k: 'bottle', x: sx, y: sy, vx, vy, r: 9, life: 3 });
    ev.push({ type: 'throw', x: sx, y: sy });
  }

  function stepEnemy(L, e, dt, ev) {
    const p = L.p;
    const dx = p.x + PW / 2 - (e.x + e.w / 2);
    const adx = dx < 0 ? -dx : dx;
    const level = p.y + PH - (e.y + e.h);
    const sameLevel = (level < 0 ? -level : level) < 70;
    if (e.stun > 0) { e.stun -= dt; return; }
    if (e.type === 'thrower' || (e.throws && adx > 190)) {
      const c = e.type === 'thrower' ? 'clock' : 'tclock';
      e[c] -= dt;
      if (e[c] <= 0 && adx < 560 && !L.p.hurt) {
        e[c] = e.period;
        throwBottle(L, e, ev);
      }
      if (e.type === 'thrower') { e.face = dx < 0 ? -1 : 1; return; }
    }
    if (e.type === 'saber' || e.type === 'boss') {
      // Säbel-Pirat und Kapitän: sehen, warnen, losstürmen, verschnaufen
      e.clock -= dt;
      if (e.mode === 'walk' && adx < 240 && sameLevel) {
        e.mode = 'warn';
        e.clock = 0.42;
        e.vx = 0;
        e.face = dx < 0 ? -1 : 1;
        ev.push({ type: 'warn', x: e.x, y: e.y });
      } else if (e.mode === 'warn' && e.clock <= 0) {
        e.mode = 'charge';
        e.clock = 0.95;
        e.vx = e.face * (e.type === 'boss' ? 250 + (e.throws ? 30 : 0) : 230);
      } else if (e.mode === 'charge' && e.clock <= 0) {
        e.mode = 'rest';
        e.clock = e.type === 'boss' ? 0.9 : 1.2;
        e.vx = 0;
      } else if (e.mode === 'rest' && e.clock <= 0) {
        e.mode = 'walk';
        e.vx = (dx < 0 ? -1 : 1) * (e.type === 'boss' ? 85 : 55);
      }
    }
    e.x += e.vx * dt;
    if (e.x < e.x0) { e.x = e.x0; e.vx = e.mode === 'charge' ? 0 : -e.vx; }
    if (e.x > e.x1) { e.x = e.x1; e.vx = e.mode === 'charge' ? 0 : -e.vx; }
    if (e.vx) e.face = e.vx < 0 ? -1 : 1;
  }

  // Ein Schritt. input: { left, right, jump }; gibt Ereignisse zurück
  function step(L, dt, input = {}) {
    const ev = [];
    if (L.over) return ev;
    L.t += dt;
    L.time -= dt;
    const p = L.p;
    p.hurt = Math.max(0, p.hurt - dt);
    p.lock = Math.max(0, p.lock - dt);
    p.coyote = p.ground ? COYOTE : Math.max(0, p.coyote - dt);
    p.buf = input.jump ? BUFFER : Math.max(0, p.buf - dt);
    // Laufen (nach einem Treffer kurz keine Kontrolle)
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (p.lock <= 0) {
      p.vx = dir * RUN;
      if (dir) p.face = dir;
    }
    if (p.buf > 0 && p.coyote > 0) {
      p.vy = -JUMP;
      p.ground = false;
      p.coyote = 0;
      p.buf = 0;
      ev.push({ type: 'jump' });
    }
    p.vy = Math.min(1400, p.vy + GRAVITY * dt);
    // waagerecht bewegen und an Hindernissen stoppen
    p.x += p.vx * dt;
    p.x = Math.max(0, Math.min(L.w - PW, p.x));
    let box = { x: p.x, y: p.y, w: PW, h: PH };
    for (const s of L.solids) {
      if (!overlap(box, s)) continue;
      if (p.vx > 0) p.x = s.x - PW;
      else if (p.vx < 0) p.x = s.x + s.w;
      box.x = p.x;
    }
    // senkrecht bewegen
    const bottom0 = p.y + PH;
    const wasGround = p.ground;
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
    // hängende Planken: nur von oben fest (von unten springt man hindurch)
    if (p.vy > 0 && !p.ground) {
      for (const pl of L.plats) {
        if (p.x + PW <= pl.x || p.x >= pl.x + pl.w) continue;
        if (bottom0 <= pl.y + 2 && p.y + PH >= pl.y) {
          p.y = pl.y - PH;
          p.vy = 0;
          p.ground = true;
          break;
        }
      }
    }
    if (p.ground && !wasGround) ev.push({ type: 'land', x: p.x + PW / 2, y: p.y + PH });
    // In eine Luke gefallen: ein Herz weg, zurück an den Rand
    if (p.y > DECK + 150) {
      const h = L.hatches.find(q => p.x + PW > q.x - 40 && p.x < q.x + q.w + 40);
      damage(L, ev, 'fall', 0);
      p.x = h ? h.x - PW - 24 : p.safeX;
      p.y = DECK - PH - 110;
      p.vx = 0;
      p.vy = 0;
    }
    // Piraten
    for (const e of L.enemies) {
      if (!e.alive) continue;
      stepEnemy(L, e, dt, ev);
      const pb = { x: p.x, y: p.y, w: PW, h: PH };
      if (!overlap(pb, e)) continue;
      if (p.vy > 0 && p.y + PH - e.y < 26) {
        // von oben draufgesprungen
        p.vy = -JUMP * 0.62;
        if (!(e.stun > 0)) {
          e.lives--;
          L.stomps++;
          if (e.lives <= 0) e.alive = false;
          else { e.stun = 0.7; e.mode = 'rest'; e.clock = 0.5; e.vx = 0; }
          ev.push({ type: 'stomp', boss: !!e.boss, dead: !e.alive, x: e.x + e.w / 2, y: e.y });
        }
      } else if (!(e.stun > 0)) {
        damage(L, ev, e.type, p.x + PW / 2 < e.x + e.w / 2 ? -1 : 1);
      }
    }
    // Kanonen: Lunte glimmt, dann fliegt eine Kugel flach über das Deck (nach links)
    for (const c of L.cannons) {
      const near = c.x - p.x < 900 && c.x - p.x > -200;
      c.clock -= dt;
      c.warn = c.clock < 0.5 && near ? 1 : 0;
      if (c.clock <= 0) {
        c.clock = c.period;
        if (near) {
          L.shots.push({ k: 'ball', x: c.x - 8, y: c.y, vx: -340, vy: 0, r: 11, life: 2.4 });
          ev.push({ type: 'shot', x: c.x, y: c.y });
        }
      }
    }
    // Blaubarts Crew rollt Fässer vom Achterdeck
    if (L.roller) {
      const r = L.roller;
      r.clock -= dt;
      if (r.clock <= 0) {
        r.clock = r.period;
        if (r.x - p.x < 1000 && L.enemies.some(e => e.boss && e.alive)) L.shots.push({ k: 'barrel', x: r.x, y: DECK - 20, vx: -200, vy: 0, r: 20, life: 9 });
      }
    }
    // Geschosse: Kugeln, Flaschen, rollende Fässer
    for (let i = L.shots.length - 1; i >= 0; i--) {
      const q = L.shots[i];
      q.life -= dt;
      if (q.k === 'bottle') q.vy += BOTTLE_G * dt;
      if (q.k === 'barrel' && q.fall) q.vy += GRAVITY * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      const qb = { x: q.x - q.r, y: q.y - q.r, w: q.r * 2, h: q.r * 2 };
      let gone = q.life <= 0 || q.x < -40 || q.y > DECK + 200;
      if (!gone && q.k === 'barrel' && !q.fall && L.hatches.some(h => q.x > h.x + 6 && q.x < h.x + h.w - 6)) { q.fall = true; q.vx *= 0.4; }
      if (!gone && !q.fall && L.solids.some(s => (q.k !== 'barrel' || s.k !== 'deck') && overlap(qb, s))) {
        gone = true;
        ev.push({ type: 'break', k: q.k, x: q.x, y: q.y });
      }
      if (!gone && overlap({ x: p.x, y: p.y, w: PW, h: PH }, qb)) {
        if (q.k === 'barrel' && p.vy > 0 && p.y + PH < q.y + 4) {
          p.vy = -JUMP * 0.62; // auf das Fass gesprungen: es zerbricht
          ev.push({ type: 'break', k: q.k, x: q.x, y: q.y });
          gone = true;
        } else if (damage(L, ev, q.k, q.vx < 0 ? -1 : 1)) {
          gone = q.k !== 'barrel';
          if (gone) ev.push({ type: 'break', k: q.k, x: q.x, y: q.y });
        }
      }
      if (gone) L.shots.splice(i, 1);
    }
    // Beute einsammeln
    const pb = { x: p.x, y: p.y, w: PW, h: PH };
    for (const l of L.loot) {
      if (l.taken || !overlap(pb, l)) continue;
      l.taken = true;
      if (l.k === 'amber') L.got.amber += l.v;
      else L.got.chests++;
      ev.push({ type: 'loot', k: l.k, v: l.v, x: l.x + l.w / 2, y: l.y });
    }
    if (L.over) return ev;
    // Tür der Kapitänskajüte (bei Blaubart und Long John erst, wenn der Kapitän besiegt ist)
    if (doorOpen(L) && overlap(pb, L.door)) {
      L.over = 'won';
      ev.push({ type: 'won' });
    } else if (L.time <= 0) {
      L.time = 0;
      L.over = 'lost';
      L.why = 'time';
      ev.push({ type: 'lost', why: 'time' });
    }
    return ev;
  }

  // Was es auf diesem Deck höchstens zu holen gibt
  const lootMax = L => ({ amber: L.loot.filter(l => l.k === 'amber').reduce((a, l) => a + l.v, 0), chests: L.loot.filter(l => l.k === 'chest').length });

  // ---------- Bildschirm ----------

  const $ = id => document.getElementById(id);
  const INK = '#2a1d10';
  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let vw = 0;
  let vh = 0;
  let L = null;
  let done = null;
  let camX = 0;
  let time = 0;
  let ending = false;
  let flash = 0;          // roter Rand nach einem Treffer
  let fx = [];            // Effekte: Staub, Sterne, Splitter, Zahlen
  let shipImg = null;     // das eigene Schiff im Hintergrund
  const imgs = {};        // Figuren als Bilder
  const keys = { left: false, right: false, jump: false };
  let jumpQueued = false;

  // Aussehen der Piraten: Figuren wie die eigene (js/figure.js) – Kopf.Hut.Augen.Mund.Kleidung.Farbe.Extra
  const LOOKS = {
    walker: ['0.2.1.1.4.1.0', '1.2.0.4.0.9.0', '2.9.0.1.4.2.0'],
    saber: ['1.2.1.2.2.4.0', '0.1.1.1.2.1.0'],
    thrower: ['0.9.6.5.3.2.0', '2.2.6.5.3.8.0'],
    boss: ['0.3.1.2.2.0.0'],
    longjohn: ['1.1.3.3.2.4.1'],
    baron: ['0.5.3.3.1.6.2'], // Zylinder, Monokel, Schnurrbart, Anzug in Gold, Goldkette
    ghost: { walker: ['4.2.0.1.2.5.0', '4.9.0.0.0.5.0'], saber: ['4.1.0.1.2.5.0'], thrower: ['4.9.0.5.3.5.0'] },
  };

  // Stimmung je Gegner: Tag, Abendrot, Sturm, Geisternacht
  const THEMES = {
    raider: { sky: ['#4f9fe0', '#b9e0f5', '#fdeec6'], sea: ['#3a94bd', '#1d5f85'], wood: '#a9743c', light: '#cf9a58', dark: '#6f4521', hull: '#5d3a1d', orb: '#fff6c2', glow: 'rgba(255,240,170,.35)', cloud: 'rgba(255,255,255,.92)' },
    shark: { sky: ['#3b2a5e', '#d9655a', '#fbc56e'], sea: ['#8a5f8e', '#3a2f5e'], wood: '#a26a38', light: '#c88c50', dark: '#6a3f1f', hull: '#57341a', orb: '#ffd98a', glow: 'rgba(255,190,110,.4)', cloud: 'rgba(255,196,160,.8)' },
    bluebeard: { sky: ['#182238', '#3a5270', '#8fa4b2'], sea: ['#2c5068', '#132a38'], wood: '#8f6a44', light: '#b08a5c', dark: '#5a3e24', hull: '#4a321c', orb: '', glow: '', cloud: 'rgba(58,72,94,.95)', storm: true },
    courier: 'raider',
    baron: 'shark',
    dutchman: { sky: ['#05080f', '#111c2e', '#2c4256'], sea: ['#143040', '#08131b'], wood: '#66727c', light: '#8996a0', dark: '#3d474f', hull: '#2f383f', orb: '#eaf2ff', glow: 'rgba(170,220,235,.28)', cloud: 'rgba(120,150,170,.28)', ghost: true },
  };

  function figure(code) {
    if (!imgs[code]) {
      const im = new Image();
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SF.figure.svg(code));
      imgs[code] = im;
    }
    return imgs[code];
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = canvas.clientWidth || window.innerWidth;
    vh = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
  }

  function start(pirate, onDone) {
    L = create(pirate.kind, (pirate.name || '').length * 13 + 5 + Math.floor(Math.random() * 50));
    done = onDone;
    ending = false;
    flash = 0;
    fx = [];
    keys.left = keys.right = keys.jump = false;
    jumpQueued = false;
    // jedem Piraten ein Gesicht geben
    const ghost = L.kind === 'dutchman';
    L.enemies.forEach((e, i) => {
      const set = e.longjohn ? LOOKS.longjohn : e.baron ? LOOKS.baron : e.boss ? LOOKS.boss : (ghost ? LOOKS.ghost : LOOKS)[e.type];
      e.look = set[i % set.length];
      figure(e.look);
    });
    figure(SF.figure.mine());
    shipImg = new Image();
    shipImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SF.ships.sideSVG(SF.state.ship.type, SF.cosmetics ? SF.cosmetics.shipColors() : null).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="184" '));
    SF.ui.show('boarding');
    resize();
    camX = 0;
    hud();
    SF.sound.play('jump');
    SF.track('seefahrer-entern');
    SF.ui.tipOnce('boarding2', 'Plündere das Deck: Sammle <b>Bernstein</b> und <b>Schatzkisten</b> und lauf zur <b>Kapitänskajüte</b>! Spring den Piraten <b>auf den Kopf</b> – du hast nur drei Herzen.', 7000);
  }

  function hud() {
    let h = '';
    for (let i = 0; i < L.maxHearts; i++) h += SF.icon('heart', i < L.hearts ? '' : 'lost');
    SF.setHTML($('bd-hearts'), h);
    SF.setText($('bd-time'), Math.ceil(L.time));
    SF.setText($('bd-loot'), L.got.amber);
    SF.setText($('bd-chests'), L.got.chests);
    $('bd-time-box').classList.toggle('low', L.time < 10);
  }

  const puff = (x, y, n = 3, c = '235,225,205') => { for (let i = 0; i < n; i++) fx.push({ k: 'puff', x: x + (Math.random() - 0.5) * 24, y: y - Math.random() * 8, vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 30, t: 0, life: 0.5, c }); };
  const burst = (x, y, n, k, c) => { for (let i = 0; i < n; i++) fx.push({ k, x, y, vx: (Math.random() - 0.5) * 320, vy: -120 - Math.random() * 220, t: 0, life: 0.7, c }); };

  function handle(e) {
    switch (e.type) {
      case 'jump': SF.sound.play('jump'); break;
      case 'land': puff(e.x, e.y, 2); break;
      case 'stomp':
        SF.sound.play('hit');
        burst(e.x, e.y, e.dead ? 7 : 4, 'star');
        if (e.dead) puff(e.x, e.y + 20, 5);
        break;
      case 'hurt':
        SF.sound.play('hurt');
        flash = 0.5;
        canvas.classList.remove('shake');
        void canvas.offsetWidth;
        canvas.classList.add('shake');
        break;
      case 'fall': SF.sound.play('splash'); flash = 0.5; SF.ui.toast('In die Luke gefallen!', 1200); break;
      case 'loot':
        SF.sound.play(e.k === 'chest' ? 'discover' : 'coin');
        fx.push({ k: 'text', text: e.k === 'chest' ? 'Schatzkiste!' : '+' + e.v, x: e.x, y: e.y, vx: 0, vy: -70, t: 0, life: 0.9 });
        burst(e.x, e.y + 10, e.k === 'chest' ? 8 : 4, 'spark');
        break;
      case 'shot': SF.sound.play('cannon'); puff(e.x - 14, e.y, 5, '225,225,225'); break;
      case 'warn': SF.sound.play('tick'); break;
      case 'break':
        if (e.k !== 'ball') burst(e.x, e.y, 6, 'shard', e.k === 'bottle' ? '120,200,150' : '150,100,50');
        else puff(e.x, e.y, 3, '225,225,225');
        break;
      default: break;
    }
  }

  function frame(dt) {
    if (!L || !canvas) return;
    time += dt;
    flash = Math.max(0, flash - dt);
    const ev = step(L, dt, { left: keys.left, right: keys.right, jump: jumpQueued || keys.jump });
    jumpQueued = false;
    ev.forEach(handle);
    fx = fx.filter(f => {
      f.t += dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.k !== 'text' && f.k !== 'puff') f.vy += 700 * dt;
      return f.t < f.life;
    });
    // Kamera folgt der Figur (etwas voraus in Laufrichtung)
    const scale = Math.min(vh / 600, vw / 900);
    const viewW = vw / scale;
    camX += (Math.max(0, Math.min(L.w - viewW, L.p.x - viewW * (L.p.face > 0 ? 0.34 : 0.5))) - camX) * Math.min(1, dt * 5);
    draw(scale);
    hud();
    if (L.over && !ending) {
      ending = true;
      const ok = L.over === 'won';
      const why = L.why;
      const got = L.got;
      SF.sound.play(ok ? 'fanfare' : 'lose');
      setTimeout(async () => {
        if (!ok) {
          await SF.ui.dialog({ title: 'Zurückgeschlagen!', html: why === 'hearts'
            ? '<p>Das war ein Treffer zu viel – die Piraten werfen dich über Bord, und ihr Schiff segelt davon. Die Beute bleibt an Deck.</p>'
            : '<p>Die Zeit ist um – die Piraten werfen dich über Bord, und ihr Schiff segelt davon. Die Beute bleibt an Deck.</p>',
            buttons: [{ label: 'Weiter', value: true, kind: 'primary' }] });
        }
        const cb = done;
        L = null;
        done = null;
        if (cb) cb(ok, ok ? got : null);
      }, ok ? 500 : 300);
    }
  }

  // ---------- Zeichnen ----------

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fillStroke(fill, lw = 3) {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  function drawBackdrop(T, scale) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, vh * 0.8);
    sky.addColorStop(0, T.sky[0]);
    sky.addColorStop(0.6, T.sky[1]);
    sky.addColorStop(1, T.sky[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, vw, vh);
    // Sonne oder Mond
    if (T.orb) {
      const sx = vw * 0.74 - camX * 0.02;
      const sy = vh * (T.ghost ? 0.16 : 0.24);
      ctx.fillStyle = T.glow;
      ctx.beginPath();
      ctx.arc(sx, sy, 86, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx, sy, 58, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = T.orb;
      ctx.beginPath();
      ctx.arc(sx, sy, 38, 0, Math.PI * 2);
      ctx.fill();
      if (T.ghost) {
        ctx.fillStyle = 'rgba(160,180,200,.5)';
        ctx.beginPath();
        ctx.arc(sx - 12, sy - 8, 8, 0, Math.PI * 2);
        ctx.arc(sx + 12, sy + 10, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Sterne in der Geisternacht
    if (T.ghost) {
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      for (let i = 0; i < 26; i++) ctx.fillRect((i * 173 + 40) % vw, (i * 97 + 20) % (vh * 0.45), 2, 2);
    }
    // Wolken (ziehen langsam, verschieben sich wenig mit der Kamera)
    ctx.fillStyle = T.cloud;
    const span = vw + 360;
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 310 + time * (6 + i * 2) - camX * 0.1) % span + span) % span - 180;
      const cy = vh * (0.08 + (i % 3) * 0.1) + (T.storm ? -10 : 0);
      const r = (T.storm ? 46 : 30) + (i % 2) * 10;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.arc(cx + r * 1.1, cy + 6, r * 0.8, 0, Math.PI * 2);
      ctx.arc(cx - r * 1.1, cy + 8, r * 0.7, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.3, cy - r * 0.5, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
    void scale;
  }

  function drawSea(T, x0, x1) {
    const g = ctx.createLinearGradient(0, 330, 0, 620);
    g.addColorStop(0, T.sea[0]);
    g.addColorStop(1, T.sea[1]);
    ctx.fillStyle = g;
    ctx.fillRect(x0 - 10, 330, x1 - x0 + 20, 900);
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let row = 0; row < 4; row++) {
      const y = 348 + row * 26;
      const off = (time * (10 + row * 6) + row * 37) % 90;
      for (let x = Math.floor(x0 / 90) * 90 - 90 + off; x < x1 + 90; x += 90) {
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 11, y - 6, x + 22, y);
      }
    }
    ctx.stroke();
  }

  // Mast mit Rahen, Segel, Wanten und Mastkorb
  function drawMast(T, mx, sail) {
    // Wanten (Strickleitern) zum Schanzkleid
    ctx.strokeStyle = 'rgba(42,29,16,.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    [-1, 1].forEach(d => {
      for (let i = 0; i < 3; i++) { ctx.moveTo(mx, 60); ctx.lineTo(mx + d * (120 + i * 34), DECK - 44); }
      for (let k = 1; k <= 6; k++) {
        const t = k / 7;
        const y = 60 + (DECK - 104) * t;
        ctx.moveTo(mx + d * 120 * t, y);
        ctx.lineTo(mx + d * 188 * t, y);
      }
    });
    ctx.stroke();
    // Segel: oben an der Rah, unten gebläht
    const bil = Math.sin(time * 1.3 + mx) * 6;
    ctx.beginPath();
    ctx.moveTo(mx - 150, 66);
    ctx.lineTo(mx + 150, 66);
    ctx.quadraticCurveTo(mx + 168 + bil, 160, mx + 142, 258);
    if (T.ghost) {
      // zerfetzter Saum
      for (let i = 0; i < 7; i++) ctx.lineTo(mx + 142 - (i + 0.5) * 40.5, 258 + (i % 2 ? 26 : -4) + bil);
      ctx.lineTo(mx - 142, 258);
    } else ctx.quadraticCurveTo(mx, 286 + bil, mx - 142, 258);
    ctx.quadraticCurveTo(mx - 168 + bil, 160, mx - 150, 66);
    ctx.closePath();
    ctx.globalAlpha = T.ghost ? 0.78 : 0.96;
    fillStroke(sail, 3);
    ctx.globalAlpha = 1;
    // Nähte und Schatten
    ctx.strokeStyle = 'rgba(0,0,0,.14)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) { ctx.moveTo(mx + i * 52, 70); ctx.quadraticCurveTo(mx + i * 58 + bil * 0.5, 160, mx + i * 50, 262); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.beginPath();
    ctx.moveTo(mx + 40, 68);
    ctx.lineTo(mx + 150, 68);
    ctx.quadraticCurveTo(mx + 166 + bil, 160, mx + 142, 256);
    ctx.lineTo(mx + 60, 262);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.85;
    SF.icons.draw(ctx, 'skull', mx, 160, 96);
    ctx.globalAlpha = 1;
    // Mast
    ctx.fillStyle = T.dark;
    ctx.fillRect(mx - 11, -140, 22, DECK + 140);
    ctx.fillStyle = T.wood;
    ctx.fillRect(mx - 11, -140, 12, DECK + 140);
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.fillRect(mx - 8, -140, 4, DECK + 140);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(mx - 11, -140, 22, DECK + 140);
    // Eisenbänder
    ctx.fillStyle = '#3a3c40';
    [300, 400].forEach(y => ctx.fillRect(mx - 13, y, 26, 7));
    // Rahen
    [60, 258].forEach((y, i) => {
      rr(mx - 162 + i * 8, y - 7, 324 - i * 16, 13, 6);
      fillStroke(T.wood, 2.5);
    });
    // Mastkorb
    ctx.beginPath();
    ctx.moveTo(mx - 34, 14);
    ctx.lineTo(mx + 34, 14);
    ctx.lineTo(mx + 26, 44);
    ctx.lineTo(mx - 26, 44);
    ctx.closePath();
    fillStroke(T.light, 2.5);
  }

  // Reling: Pfosten und zwei Holme (hinter den Figuren)
  function drawRail(T, a, b, y, x0, x1) {
    const from = Math.max(a, Math.floor(x0 / 54) * 54);
    ctx.fillStyle = T.dark;
    for (let x = from; x < Math.min(b, x1); x += 54) if (x >= a) ctx.fillRect(x + 22, y - 40, 7, 40);
    ctx.fillRect(a, y - 24, b - a, 4);
    rr(a - 2, y - 48, b - a + 4, 10, 4);
    fillStroke(T.wood, 2.5);
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.fillRect(a, y - 46, b - a, 3);
  }

  function drawDeck(T, s, x0, x1) {
    const a = Math.max(s.x, x0 - 4);
    const b = Math.min(s.x + s.w, x1 + 4);
    if (b <= a) return;
    ctx.fillStyle = T.hull;
    ctx.fillRect(s.x, s.y + 14, s.w, 760);
    ctx.strokeStyle = 'rgba(0,0,0,.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = s.y + 44; y < 640; y += 30) { ctx.moveTo(a, y); ctx.lineTo(b, y); }
    ctx.stroke();
    // Stückpforten im Rumpf
    if (s.y === DECK) {
      for (let x = Math.ceil(a / 260) * 260; x < b - 50; x += 260) {
        if (x < s.x + 12) continue;
        rr(x, DECK + 46, 40, 30, 4);
        fillStroke('#1a120a', 2.5);
        ctx.fillStyle = '#3a3c40';
        ctx.beginPath();
        ctx.arc(x + 20, DECK + 61, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Deckplanken
    ctx.fillStyle = T.wood;
    ctx.fillRect(s.x, s.y, s.w, 16);
    ctx.fillStyle = T.light;
    ctx.fillRect(s.x, s.y, s.w, 5);
    ctx.fillStyle = 'rgba(42,29,16,.45)';
    for (let x = Math.ceil(a / 64) * 64; x < b; x += 64) ctx.fillRect(x, s.y + 1, 2, 15);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y + 16);
    ctx.lineTo(s.x + s.w, s.y + 16);
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + s.w, s.y);
    ctx.lineTo(s.x + s.w, s.y + 16);
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x, s.y + 16);
    ctx.stroke();
  }

  function drawHatch(h) {
    const g = ctx.createLinearGradient(0, DECK, 0, DECK + 130);
    g.addColorStop(0, '#2a1a0c');
    g.addColorStop(1, '#070403');
    ctx.fillStyle = g;
    ctx.fillRect(h.x, DECK, h.w, 760);
    // Leiter nach unten
    ctx.strokeStyle = 'rgba(160,110,60,.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    const lx = h.x + h.w - 34;
    ctx.moveTo(lx, DECK + 4); ctx.lineTo(lx, DECK + 130);
    ctx.moveTo(lx + 22, DECK + 4); ctx.lineTo(lx + 22, DECK + 130);
    for (let y = DECK + 20; y < DECK + 130; y += 22) { ctx.moveTo(lx, y); ctx.lineTo(lx + 22, y); }
    ctx.stroke();
  }

  function drawCrate(T, s) {
    rr(s.x, s.y, s.w, s.h, 4);
    fillStroke(T.ghost ? '#8a949c' : '#c9954a', 3);
    ctx.strokeStyle = T.ghost ? '#4f5960' : '#7a4f22';
    ctx.lineWidth = 5;
    ctx.strokeRect(s.x + 7, s.y + 7, s.w - 14, s.h - 14);
    ctx.beginPath();
    ctx.moveTo(s.x + 9, s.y + 9);
    ctx.lineTo(s.x + s.w - 9, s.y + s.h - 9);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fillRect(s.x + 3, s.y + 3, s.w - 6, 4);
    ctx.fillStyle = INK;
    [[6, 6], [s.w - 9, 6], [6, s.h - 9], [s.w - 9, s.h - 9]].forEach(([dx, dy]) => ctx.fillRect(s.x + dx, s.y + dy, 3, 3));
  }

  function drawBarrel(T, x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x + 6, y);
    ctx.lineTo(x + w - 6, y);
    ctx.quadraticCurveTo(x + w + 5, y + h / 2, x + w - 6, y + h);
    ctx.lineTo(x + 6, y + h);
    ctx.quadraticCurveTo(x - 5, y + h / 2, x + 6, y);
    ctx.closePath();
    fillStroke(T.ghost ? '#737d86' : '#a66d34', 3);
    ctx.strokeStyle = 'rgba(42,29,16,.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.36, y + 2); ctx.quadraticCurveTo(x + w * 0.3, y + h / 2, x + w * 0.36, y + h - 2);
    ctx.moveTo(x + w * 0.64, y + 2); ctx.quadraticCurveTo(x + w * 0.7, y + h / 2, x + w * 0.64, y + h - 2);
    ctx.stroke();
    ctx.fillStyle = '#3a3c40';
    ctx.fillRect(x + 1, y + h * 0.2, w - 2, 5);
    ctx.fillRect(x + 1, y + h * 0.74, w - 2, 5);
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.fillRect(x + 8, y + 5, 4, h - 10);
  }

  function drawCannon(s, warn) {
    // Lafette mit Rädern
    rr(s.x + 14, s.y + 20, s.w - 14, 14, 3);
    fillStroke('#8a5a2b', 2.5);
    [s.x + 24, s.x + s.w - 10].forEach(wx => {
      ctx.beginPath();
      ctx.arc(wx, s.y + s.h - 8, 8, 0, Math.PI * 2);
      fillStroke('#6b4423', 2.5);
    });
    // Rohr (zeigt nach links)
    rr(s.x - 12, s.y + 2, s.w + 6, 20, 9);
    fillStroke('#34363b', 3);
    rr(s.x - 16, s.y, 10, 24, 4);
    fillStroke('#4a4d52', 2.5);
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.fillRect(s.x - 2, s.y + 5, s.w - 12, 3);
    if (warn) {
      // die Lunte glimmt: gleich knallt es
      const f = 5 + Math.sin(time * 40) * 3;
      ctx.fillStyle = '#ffd27a';
      ctx.beginPath();
      ctx.arc(s.x + s.w - 6, s.y - 4, f + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff7a30';
      ctx.beginPath();
      ctx.arc(s.x + s.w - 6, s.y - 4, f, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Hängende Planke an zwei Seilen
  function drawPlank(T, pl, top) {
    ctx.strokeStyle = '#b89a6a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pl.x + 12, pl.y); ctx.lineTo(pl.x + 12, top);
    ctx.moveTo(pl.x + pl.w - 12, pl.y); ctx.lineTo(pl.x + pl.w - 12, top);
    ctx.stroke();
    rr(pl.x, pl.y, pl.w, 14, 5);
    fillStroke(T.light, 3);
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.fillRect(pl.x + 5, pl.y + 2, pl.w - 10, 3);
    ctx.fillStyle = INK;
    ctx.fillRect(pl.x + 10, pl.y + 6, 4, 4);
    ctx.fillRect(pl.x + pl.w - 14, pl.y + 6, 4, 4);
  }

  // Kapitänskajüte am Heck mit Tür
  function drawCabin(T) {
    const x = L.w - 270;
    const y = QUARTER - 190;
    ctx.fillStyle = T.dark;
    ctx.fillRect(x, y, 270, 190);
    ctx.strokeStyle = 'rgba(0,0,0,.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = x + 30; px < L.w; px += 30) { ctx.moveTo(px, y); ctx.lineTo(px, QUARTER); }
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, 270, 190);
    // Dach
    rr(x - 16, y - 16, 300, 20, 6);
    fillStroke(T.wood, 3);
    // Fenster
    const lit = T.ghost ? '#8fe0c0' : '#ffd27a';
    [x + 26, x + 196].forEach(wx => {
      rr(wx, y + 46, 44, 54, 20);
      fillStroke(lit, 3);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wx + 22, y + 46); ctx.lineTo(wx + 22, y + 100);
      ctx.moveTo(wx, y + 74); ctx.lineTo(wx + 44, y + 74);
      ctx.stroke();
    });
    // Tür
    const d = L.door;
    const open = doorOpen(L);
    rr(d.x - 8, d.y - 10, d.w + 16, d.h + 10, 26);
    fillStroke(T.light, 3);
    rr(d.x, d.y, d.w, d.h, 22);
    fillStroke(open ? (T.ghost ? '#3f8a78' : '#f0b860') : '#4a2d14', 3);
    if (open) {
      // offen: Licht aus der Kajüte, Pfeil hüpft darüber
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      rr(d.x + 8, d.y + 10, d.w - 16, d.h - 10, 14);
      ctx.fill();
      SF.icons.draw(ctx, 'chest', d.x + d.w / 2, d.y - 34 + Math.sin(time * 5) * 5, 38);
    } else {
      ctx.strokeStyle = '#8a8f96';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(d.x + 4, d.y + 22); ctx.lineTo(d.x + d.w - 4, d.y + d.h - 22);
      ctx.moveTo(d.x + d.w - 4, d.y + 22); ctx.lineTo(d.x + 4, d.y + d.h - 22);
      ctx.stroke();
      SF.icons.draw(ctx, 'lock', d.x + d.w / 2, d.y + d.h / 2, 34);
    }
  }

  // Figur mit Beinen: Oberkörper aus js/figure.js, darunter Hose und Stiefel, die beim Laufen wippen
  function drawChar(code, cx, by, face, size, walking, air) {
    const ph = time * 14 + cx * 0.05;
    const a = air ? 0.9 : walking ? Math.sin(ph) : 0;
    const lift = walking && !air ? Math.max(0, Math.cos(ph)) * 4 : 0;
    const bob = walking && !air ? Math.abs(Math.sin(ph)) * 2 : 0;
    const k = size / 64;
    ctx.fillStyle = '#3d2e22';
    ctx.fillRect(cx - 9 * k, by - 20 * k, 18 * k, 12 * k);
    ctx.fillStyle = INK;
    rr(cx - 11 * k + a * 6 * k, by - 9 * k - lift, 11 * k, 9 * k, 3);
    ctx.fill();
    rr(cx - a * 6 * k, by - 9 * k - (walking && !air ? Math.max(0, -Math.cos(ph)) * 4 : 0), 11 * k, 9 * k, 3);
    ctx.fill();
    const im = figure(code);
    if (im.complete && im.naturalWidth) {
      ctx.save();
      ctx.translate(cx, by - 12 * k - bob);
      ctx.scale(face, 1);
      ctx.drawImage(im, -size / 2, -size + 2, size, size);
      ctx.restore();
    } else {
      ctx.fillStyle = '#7a1f1f';
      ctx.fillRect(cx - 14, by - 50, 28, 34);
    }
  }

  function drawSaber(x, y, ang, face) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face, 1);
    ctx.rotate(ang);
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.quadraticCurveTo(22, -6, 36, 0);
    ctx.stroke();
    ctx.strokeStyle = '#d6dadf';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(0, -6, 5, 12);
    ctx.restore();
  }

  function drawEnemy(e) {
    const cx = e.x + e.w / 2;
    const by = e.y + e.h;
    const face = e.face || (e.vx < 0 ? -1 : 1);
    const size = e.boss ? 80 : 62;
    if (e.stun > 0 && Math.floor(time * 16) % 2) return;
    drawChar(e.look || LOOKS.walker[0], cx, by, face, size, !!e.vx, false);
    if (e.type === 'saber' || e.boss) {
      const ang = e.mode === 'warn' ? -1.3 : e.mode === 'charge' ? 0.05 : -0.55 + Math.sin(time * 3 + e.x) * 0.1;
      drawSaber(cx + face * 16, by - (e.boss ? 34 : 26), ang, face);
    }
    if (e.type === 'thrower' && e.clock < 0.6) {
      ctx.save();
      ctx.translate(cx + face * 16, by - 50);
      ctx.rotate(-0.5 * face);
      rr(-5, -12, 10, 18, 3);
      fillStroke('#6cc08a', 2);
      ctx.fillRect(-2, -18, 4, 7);
      ctx.restore();
    }
    if (e.mode === 'warn') {
      // Achtung: gleich stürmt er los
      rr(cx - 13, e.y - 52, 26, 30, 8);
      fillStroke('#ffd24a', 2.5);
      ctx.fillStyle = INK;
      ctx.font = '900 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', cx, e.y - 36);
    }
    if (e.boss) for (let k = 0; k < e.lives; k++) SF.icons.draw(ctx, 'heart', cx + (k - (e.lives - 1) / 2) * 20, e.y - 62, 18);
  }

  function drawLoot(l) {
    const cx = l.x + l.w / 2;
    const bob = Math.sin(time * 4 + l.x * 0.05) * 3;
    if (l.k === 'chest') {
      ctx.fillStyle = 'rgba(255,220,120,.3)';
      ctx.beginPath();
      ctx.arc(cx, l.y + 16, 30 + Math.sin(time * 5) * 3, 0, Math.PI * 2);
      ctx.fill();
      SF.icons.draw(ctx, 'chest', cx, l.y + 12, 50);
      return;
    }
    const cy = l.y + l.h / 2 + bob;
    const g = ctx.createRadialGradient(cx - 4, cy - 4, 1, cx, cy, 12);
    g.addColorStop(0, '#fff1c0');
    g.addColorStop(0.45, '#ffc04a');
    g.addColorStop(1, '#d87a08');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 10, 12, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,40,0,.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (Math.sin(time * 6 + l.x) > 0.6) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx + 6, cy - 10, 2, 8);
      ctx.fillRect(cx + 3, cy - 7, 8, 2);
    }
  }

  function drawShot(T, q) {
    if (q.k === 'ball') {
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      fillStroke('#2b2d31', 2.5);
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.beginPath();
      ctx.arc(q.x - 3, q.y - 4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(230,230,230,.35)';
      for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(q.x + i * 16, q.y, 9 - i * 2, 0, Math.PI * 2); ctx.fill(); }
    } else if (q.k === 'bottle') {
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(time * 9);
      rr(-5, -8, 10, 17, 3);
      fillStroke('#6cc08a', 2);
      ctx.fillStyle = '#6cc08a';
      ctx.fillRect(-2, -14, 4, 7);
      ctx.strokeRect(-2, -14, 4, 7);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(-q.x / q.r);
      ctx.beginPath();
      ctx.arc(0, 0, q.r, 0, Math.PI * 2);
      fillStroke(T.ghost ? '#737d86' : '#a66d34', 3);
      ctx.strokeStyle = '#3a3c40';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, q.r * 0.62, 0, Math.PI * 2);
      ctx.moveTo(-q.r, 0); ctx.lineTo(q.r, 0);
      ctx.moveTo(0, -q.r); ctx.lineTo(0, q.r);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFx() {
    fx.forEach(f => {
      const a = 1 - f.t / f.life;
      if (f.k === 'puff') {
        ctx.fillStyle = `rgba(${f.c},${0.55 * a})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 6 + f.t * 30, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.k === 'star') {
        ctx.globalAlpha = a;
        SF.icons.draw(ctx, 'star', f.x, f.y, 18);
        ctx.globalAlpha = 1;
      } else if (f.k === 'spark') {
        ctx.fillStyle = `rgba(255,214,90,${a})`;
        ctx.fillRect(f.x - 3, f.y - 3, 6, 6);
      } else if (f.k === 'shard') {
        ctx.fillStyle = `rgba(${f.c},${a})`;
        ctx.fillRect(f.x - 4, f.y - 3, 8, 6);
      } else if (f.k === 'text') {
        ctx.font = '900 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.lineWidth = 5;
        ctx.strokeStyle = INK;
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = '#ffd24a';
        ctx.fillText(f.text, f.x, f.y);
        ctx.globalAlpha = 1;
      }
    });
  }

  function draw(scale) {
    let T = THEMES[L.kind] || THEMES.raider;
    if (typeof T === 'string') T = THEMES[T];
    drawBackdrop(T, scale);
    const oy = vh - 600 * scale;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -camX * scale * dpr, dpr * oy);
    const x0 = camX;
    const x1 = camX + vw / scale;
    const top = -oy / scale - 10;
    drawSea(T, x0, x1);
    // das eigene Schiff liegt längsseits (wandert langsamer mit)
    if (shipImg && shipImg.complete && shipImg.naturalWidth) {
      const sx = -70 + camX * 0.72;
      ctx.globalAlpha = T.ghost ? 0.75 : 1;
      ctx.drawImage(shipImg, sx, 150 + Math.sin(time * 1.6) * 4, 310, 238);
      ctx.globalAlpha = 1;
    }
    // Enterhaken mit Seil an der Reling
    ctx.strokeStyle = '#b89a6a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-40, 250);
    ctx.quadraticCurveTo(10, 400, 36, DECK - 46);
    ctx.stroke();
    SF.icons.draw(ctx, 'hook', 38, DECK - 52, 30);
    const sail = SF.pirates ? SF.pirates.KINDS[L.kind].sail : '#3a3a3a';
    for (let mx = 430; mx < L.qx - 120; mx += 800) if (mx > x0 - 260 && mx < x1 + 260) drawMast(T, mx, sail);
    drawRail(T, 0, L.qx, DECK, x0, x1);
    drawRail(T, L.qx, L.w - 270, QUARTER, x0, x1);
    if (x1 > L.w - 320) drawCabin(T);
    L.plats.forEach(pl => { if (pl.x < x1 && pl.x + pl.w > x0) drawPlank(T, pl, top); });
    L.hatches.forEach(h => { if (h.x < x1 && h.x + h.w > x0) drawHatch(h); });
    L.solids.forEach(s => { if (s.k === 'deck' && s.x < x1 && s.x + s.w > x0) drawDeck(T, s, x0, x1); });
    // Treppe zum Achterdeck (nur Zierde: man springt hinauf)
    ctx.fillStyle = T.light;
    ctx.fillRect(L.qx - 4, QUARTER, 8, DECK - QUARTER);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(L.qx - 4, QUARTER, 8, DECK - QUARTER);
    L.solids.forEach(s => {
      if (s.x > x1 || s.x + s.w < x0) return;
      if (s.k === 'crate') drawCrate(T, s);
      else if (s.k === 'barrel') drawBarrel(T, s.x, s.y, s.w, s.h);
    });
    L.cannons.forEach(c => {
      const s = L.solids.find(q => q.k === 'cannon' && q.x === c.x);
      if (s && s.x < x1 + 30 && s.x + s.w > x0 - 30) drawCannon(s, c.warn);
    });
    // Blaubarts Fass-Roller steht oben an der Kante
    if (L.roller && L.enemies.some(e => e.boss && e.alive)) drawBarrel(T, L.roller.x - 4, QUARTER - 56, 44, 56);
    L.loot.forEach(l => { if (!l.taken && l.x < x1 && l.x + l.w > x0) drawLoot(l); });
    L.enemies.forEach(e => { if (e.alive && e.x < x1 + 60 && e.x > x0 - 60) drawEnemy(e); });
    L.shots.forEach(q => drawShot(T, q));
    // Spielfigur (blinkt nach einem Treffer)
    const p = L.p;
    if (!(p.hurt > 0 && Math.floor(time * 14) % 2)) drawChar(SF.figure.mine(), p.x + PW / 2, p.y + PH, p.face, 64, !!p.vx && p.ground, !p.ground);
    drawFx();
    // Wellen vorne am Rumpf
    ctx.fillStyle = T.sea[1];
    ctx.beginPath();
    ctx.moveTo(x0 - 10, 640);
    for (let x = Math.floor(x0 / 80) * 80 - 80; x < x1 + 80; x += 80) {
      const y = 592 + Math.sin(time * 2 + x * 0.02) * 4;
      ctx.lineTo(x, y);
      ctx.quadraticCurveTo(x + 20, y - 12, x + 40, y);
      ctx.quadraticCurveTo(x + 60, y + 10, x + 80, y);
    }
    ctx.lineTo(x1 + 10, 640);
    ctx.closePath();
    ctx.fill();
    // Wetter und Treffer (über dem ganzen Bild)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (T.storm) {
      ctx.strokeStyle = 'rgba(210,225,240,.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 46; i++) {
        const rx = ((i * 137 + time * 420) % (vw + 200)) - 100;
        const ry = ((i * 89 + time * 900) % (vh + 100)) - 50;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 8, ry + 26);
      }
      ctx.stroke();
      if (time % 9 < 0.1) { ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(0, 0, vw, vh); }
    }
    if (T.ghost) {
      for (let i = 0; i < 3; i++) {
        const fxx = ((i * 520 + time * (18 + i * 7)) % (vw + 600)) - 300;
        const g = ctx.createRadialGradient(fxx, vh * (0.62 + i * 0.1), 10, fxx, vh * (0.62 + i * 0.1), 320);
        g.addColorStop(0, 'rgba(190,225,235,.16)');
        g.addColorStop(1, 'rgba(190,225,235,0)');
        ctx.fillStyle = g;
        ctx.fillRect(fxx - 320, 0, 640, vh);
      }
    }
    if (flash > 0) {
      const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.3, vw / 2, vh / 2, Math.max(vw, vh) * 0.7);
      g.addColorStop(0, 'rgba(200,30,20,0)');
      g.addColorStop(1, `rgba(200,30,20,${flash})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
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

  SF.boarding = { DECK, QUARTER, PW, PH, HEARTS, SHIPS, create, step, doorOpen, lootMax, start, frame, bind, resize, _level: () => L };
})();
