// Die Welt: Inseln (aus Kreisen zusammengesetzt), Orte (Häfen und Ziele aus Gamble Klicker), Land und Wasser,
// der Nebel der Seekarte (aufgedeckte Felder als Bitfeld) und die Wegsuche um Inseln herum.
// Alles ohne Bildschirm – gezeichnet wird in js/sea.js.
window.SF = window.SF || {};

(function () {
  const W = 3200;          // Breite der Welt in Karteneinheiten
  const H = 2400;          // Höhe
  const EDGE = 30;         // so nah darf man an den Rand
  const FOG_CELL = 40;     // Größe eines Nebelfelds
  const FOG_W = W / FOG_CELL;
  const FOG_H = H / FOG_CELL;
  const SIGHT = 260;       // so weit sieht man vom Schiff aus
  const NAV_CELL = 40;     // Raster der Wegsuche
  const SHIP_PAD = 12;     // Abstand des Schiffs zur Küste

  // Fester Zufall (immer dieselbe Welt): einfacher Zahlengenerator mit Startwert
  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // Insel als Klecks aus Kreisen um einen Mittelpunkt
  function blob(cx, cy, r, seed, lobes = 5) {
    const rnd = seeded(seed);
    const circles = [[cx, cy, r]];
    for (let i = 0; i < lobes; i++) {
      const a = (i / lobes) * Math.PI * 2 + rnd() * 0.9;
      const d = r * (0.45 + rnd() * 0.4);
      circles.push([Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), Math.round(r * (0.45 + rnd() * 0.3))]);
    }
    return circles;
  }

  // kind: Aussehen (green, sand, volcano, ice, reef, dragon) · town: Häuser · palms: Palmen
  const ISLANDS = [
    { id: 'dublone', name: 'Dublonen-Insel', kind: 'green', town: true, circles: blob(700, 1350, 210, 11, 7) },
    { id: 'bay', name: 'Buchtinsel', kind: 'sand', palms: true, circles: blob(470, 930, 95, 23, 5) },
    { id: 'amber', name: 'Bernsteinküste', kind: 'green', town: true, amber: true, circles: blob(1810, 560, 170, 37, 6) },
    { id: 'smuggler', name: 'Schmugglerinsel', kind: 'sand', town: true, palms: true, circles: blob(2390, 1590, 150, 41, 6) },
    { id: 'volcano', name: 'Vulkaninsel', kind: 'volcano', circles: blob(2700, 820, 140, 53, 5) },
    { id: 'dragon', name: 'Drachenküste', kind: 'dragon', circles: blob(3200, 2360, 420, 67, 8) },
  ];

  // Korallenriff: Ring aus kleinen Felsen mit Lagune
  (function reef() {
    const rnd = seeded(71);
    const circles = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      if (i === 3 || i === 4) continue; // Einfahrt in die Lagune
      const d = 150 + rnd() * 25;
      circles.push([Math.round(1380 + Math.cos(a) * d), Math.round(1820 + Math.sin(a) * d * 0.8), Math.round(18 + rnd() * 14)]);
    }
    ISLANDS.push({ id: 'reef', name: 'Korallenriff', kind: 'reef', circles });
  })();

  // Eismeer: Eisschollen im Norden
  (function ice() {
    const rnd = seeded(83);
    for (let i = 0; i < 26; i++) {
      const x = 950 + rnd() * 1400;
      const y = 40 + rnd() * 250;
      if (Math.abs(x - 1500) < 110 && y > 140) continue; // freie Fahrt zum Eismeer-Ziel
      ISLANDS.push({ id: 'ice' + i, kind: 'ice', circles: blob(Math.round(x), Math.round(y), Math.round(22 + rnd() * 30), 100 + i, 3) });
    }
  })();

  // Kleine namenlose Inseln
  const FILLER = [[1150, 1000, 60], [1300, 520, 45], [980, 1900, 70], [1700, 1250, 55], [2050, 1100, 50], [2000, 2050, 80],
    [300, 1800, 90], [250, 500, 70], [1500, 2250, 40], [2650, 1300, 45], [2900, 400, 70], [2200, 300, 40], [600, 2150, 60],
    [1950, 1550, 35], [1050, 700, 40], [2500, 2000, 50]];
  FILLER.forEach(([x, y, r], i) => ISLANDS.push({ id: 'isle' + i, kind: i % 3 ? 'green' : 'sand', palms: i % 2 === 0, circles: blob(x, y, r, 200 + i, 4) }));

  ISLANDS.forEach(isle => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    isle.circles.forEach(([x, y, r]) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); });
    isle.box = [x0, y0, x1, y1];
  });

  // ---------- Land und Wasser ----------

  function isLand(x, y, pad = 0) {
    for (const isle of ISLANDS) {
      const b = isle.box;
      if (x < b[0] - pad || x > b[2] + pad || y < b[1] - pad || y > b[3] + pad) continue;
      for (const c of isle.circles) {
        const dx = x - c[0];
        const dy = y - c[1];
        const r = c[2] + pad;
        if (dx * dx + dy * dy < r * r) return true;
      }
    }
    return false;
  }

  const inWorld = (x, y) => x >= EDGE && y >= EDGE && x <= W - EDGE && y <= H - EDGE;
  const isWater = (x, y, pad = SHIP_PAD) => inWorld(x, y) && !isLand(x, y, pad);

  // Ist die Strecke frei? (Proben alle step Einheiten)
  function segmentClear(x0, y0, x1, y1, pad = SHIP_PAD, step = 10) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    const n = Math.max(1, Math.ceil(len / step));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (!isWater(x0 + dx * t, y0 + dy * t, pad)) return false;
    }
    return true;
  }

  // Letzter freier Punkt auf einer Strecke (für Kurse, die auf Land zeigen)
  function lastFree(x0, y0, x1, y1, pad = SHIP_PAD, step = 8) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    const n = Math.max(1, Math.ceil(len / step));
    let fx = x0, fy = y0;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = x0 + dx * t;
      const y = y0 + dy * t;
      if (!isWater(x, y, pad)) return { x: fx, y: fy, blocked: true };
      fx = x;
      fy = y;
    }
    return { x: x1, y: y1, blocked: false };
  }

  // Punkt im Wasser vor der Küste einer Insel, von der Mitte aus in Richtung (dx, dy)
  function coast(isleId, dx, dy, out = 40) {
    const isle = ISLANDS.find(i => i.id === isleId);
    const [cx, cy] = isle.circles[0];
    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len;
    dy /= len;
    for (let d = 0; d < 1200; d += 4) {
      const x = cx + dx * d;
      const y = cy + dy * d;
      if (!isLand(x, y, SHIP_PAD + 4)) return { x: Math.round(x + dx * out), y: Math.round(y + dy * out) };
    }
    return { x: cx, y: cy };
  }

  // ---------- Orte ----------

  // harbor: Hafen zum Anlegen · gk: Ziel aus der Flotte von Gamble Klicker · reward: Bernstein beim Entdecken
  const PLACES = [
    Object.assign({ id: 'dublone', name: 'Port Dublone', icon: '⚓', harbor: true }, coast('dublone', 1, 0.15)),
    Object.assign({ id: 'amberbay', name: 'Bernsteinbucht', icon: '⚓', harbor: true }, coast('amber', -0.55, 0.85)),
    Object.assign({ id: 'smuggler', name: 'Schmugglerinsel', icon: '🏴‍☠️', harbor: true, gk: true }, coast('smuggler', -1, -0.25)),
    Object.assign({ id: 'bay', name: 'Nahe Bucht', icon: '🏝️', gk: true, reward: 15 }, coast('bay', 0.7, 0.75, 30)),
    { id: 'reef', name: 'Korallenriff', icon: '🐚', gk: true, reward: 20, x: 1380, y: 1820 },
    Object.assign({ id: 'volcano', name: 'Vulkaninsel', icon: '🌋', gk: true, reward: 30 }, coast('volcano', -0.85, 0.5)),
    { id: 'ice', name: 'Eismeer', icon: '🧊', gk: true, reward: 40, x: 1500, y: 330 },
    Object.assign({ id: 'dragon', name: 'Drachenküste', icon: '🐉', gk: true, reward: 50 }, coast('dragon', -0.75, -0.65)),
  ];
  const placeById = Object.fromEntries(PLACES.map(p => [p.id, p]));
  const START = placeById.dublone;

  // Nächster Ort in Reichweite (oder null)
  function placeNear(x, y, range = 110, filter) {
    let best = null;
    let bestD = range * range;
    for (const p of PLACES) {
      if (filter && !filter(p)) continue;
      const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (d <= bestD) { best = p; bestD = d; }
    }
    return best;
  }

  // ---------- Nebel der Seekarte ----------

  let fog = new Uint8Array(Math.ceil(FOG_W * FOG_H / 8)); // 1 Bit je Feld: 1 = aufgedeckt
  let fogVersion = 0; // steigt bei jeder Änderung (Zeichnen nur bei Änderung)

  const fogIndex = (cx, cy) => cy * FOG_W + cx;
  const known = (cx, cy) => cx >= 0 && cy >= 0 && cx < FOG_W && cy < FOG_H && (fog[fogIndex(cx, cy) >> 3] & (1 << (fogIndex(cx, cy) & 7))) !== 0;
  const knownAt = (x, y) => known(Math.floor(x / FOG_CELL), Math.floor(y / FOG_CELL));

  // Felder im Umkreis aufdecken; gibt die Anzahl neuer Felder zurück
  function reveal(x, y, radius = SIGHT) {
    let added = 0;
    const c0 = Math.max(0, Math.floor((x - radius) / FOG_CELL));
    const c1 = Math.min(FOG_W - 1, Math.floor((x + radius) / FOG_CELL));
    const r0 = Math.max(0, Math.floor((y - radius) / FOG_CELL));
    const r1 = Math.min(FOG_H - 1, Math.floor((y + radius) / FOG_CELL));
    const rr = radius * radius;
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const mx = (cx + 0.5) * FOG_CELL - x;
        const my = (cy + 0.5) * FOG_CELL - y;
        if (mx * mx + my * my > rr) continue;
        const i = fogIndex(cx, cy);
        if (!(fog[i >> 3] & (1 << (i & 7)))) {
          fog[i >> 3] |= 1 << (i & 7);
          added++;
        }
      }
    }
    if (added) fogVersion++;
    return added;
  }

  // Anteil der aufgedeckten Karte (0 … 1)
  function explored() {
    let n = 0;
    for (let i = 0; i < FOG_W * FOG_H; i++) if (fog[i >> 3] & (1 << (i & 7))) n++;
    return n / (FOG_W * FOG_H);
  }

  function fogToString() {
    let bin = '';
    for (let i = 0; i < fog.length; i++) bin += String.fromCharCode(fog[i]);
    return btoa(bin);
  }

  function fogFromString(text) {
    fog = new Uint8Array(Math.ceil(FOG_W * FOG_H / 8));
    fogVersion++;
    if (!text) return false;
    try {
      const bin = atob(text);
      for (let i = 0; i < Math.min(bin.length, fog.length); i++) fog[i] = bin.charCodeAt(i);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- Wegsuche (A* auf einem Raster, danach Ecken abschneiden) ----------

  const NAV_W = W / NAV_CELL;
  const NAV_H = H / NAV_CELL;
  let nav = null; // 1 = befahrbar

  function buildNav() {
    nav = new Uint8Array(NAV_W * NAV_H);
    for (let cy = 0; cy < NAV_H; cy++) {
      for (let cx = 0; cx < NAV_W; cx++) {
        nav[cy * NAV_W + cx] = isWater((cx + 0.5) * NAV_CELL, (cy + 0.5) * NAV_CELL, SHIP_PAD + 6) ? 1 : 0;
      }
    }
  }

  // Nächstes befahrbares Feld zu einem Punkt
  function navCell(x, y) {
    const cx = Math.min(NAV_W - 1, Math.max(0, Math.floor(x / NAV_CELL)));
    const cy = Math.min(NAV_H - 1, Math.max(0, Math.floor(y / NAV_CELL)));
    if (nav[cy * NAV_W + cx]) return cy * NAV_W + cx;
    for (let r = 1; r < 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && ny >= 0 && nx < NAV_W && ny < NAV_H && nav[ny * NAV_W + nx]) return ny * NAV_W + nx;
        }
      }
    }
    return -1;
  }

  // Kurs von (x0, y0) nach (x1, y1) als flache Liste [x, y, x, y, …] (ohne Startpunkt) oder null
  function route(x0, y0, x1, y1) {
    if (!nav) buildNav();
    if (segmentClear(x0, y0, x1, y1)) return [x1, y1];
    const start = navCell(x0, y0);
    const goal = navCell(x1, y1);
    if (start < 0 || goal < 0) return null;
    const n = NAV_W * NAV_H;
    const g = new Float64Array(n).fill(Infinity);
    const from = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const open = [start];
    const f = new Float64Array(n).fill(Infinity);
    const gx = goal % NAV_W;
    const gy = Math.floor(goal / NAV_W);
    const h = i => {
      const dx = Math.abs(i % NAV_W - gx);
      const dy = Math.abs(Math.floor(i / NAV_W) - gy);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    g[start] = 0;
    f[start] = h(start);
    while (open.length) {
      // kleinstes f suchen (die Liste bleibt klein genug)
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % NAV_W;
      const cy = Math.floor(cur / NAV_W);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= NAV_W || ny >= NAV_H) continue;
          const ni = ny * NAV_W + nx;
          if (!nav[ni] || closed[ni]) continue;
          if (dx && dy && (!nav[cy * NAV_W + nx] || !nav[ny * NAV_W + cx])) continue; // keine Ecken schneiden
          const cost = g[cur] + (dx && dy ? 1.414 : 1);
          if (cost < g[ni]) {
            g[ni] = cost;
            f[ni] = cost + h(ni);
            from[ni] = cur;
            open.push(ni);
          }
        }
      }
    }
    if (from[goal] < 0 && goal !== start) return null;
    // Weg zurückverfolgen
    const cells = [];
    for (let i = goal; i >= 0 && i !== start; i = from[i]) cells.push(i);
    cells.reverse();
    const pts = [[x0, y0]];
    cells.forEach(i => pts.push([(i % NAV_W + 0.5) * NAV_CELL, (Math.floor(i / NAV_W) + 0.5) * NAV_CELL]));
    pts.push([x1, y1]);
    // Ecken abschneiden: von jedem Punkt aus so weit wie möglich geradeaus
    const out = [];
    let a = 0;
    while (a < pts.length - 1) {
      let b = pts.length - 1;
      while (b > a + 1 && !segmentClear(pts[a][0], pts[a][1], pts[b][0], pts[b][1], SHIP_PAD)) b--;
      out.push(pts[b][0], pts[b][1]);
      a = b;
    }
    return out;
  }

  SF.world = {
    W, H, EDGE, FOG_CELL, FOG_W, FOG_H, SIGHT, SHIP_PAD, ISLANDS, PLACES, placeById, START,
    isLand, isWater, inWorld, segmentClear, lastFree, placeNear, route,
    reveal, known, knownAt, explored, fogToString, fogFromString,
    fogVersion: () => fogVersion,
    fogBits: () => fog,
    seeded,
  };
})();
