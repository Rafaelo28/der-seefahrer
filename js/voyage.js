// Segeln (ohne Bildschirm, testbar): dem gezeichneten Kurs folgen, an der Küste anhalten, Wind und Rückenwind,
// Proviant verbrauchen (leer = langsamer, die Crew murrt – aber kein „Game Over“), Treibgut einsammeln,
// Karte aufdecken und Orte entdecken. step() liefert Ereignisse, die der Bildschirm (js/sea.js) anzeigt.
window.SF = window.SF || {};

(function () {
  const FOOD_DIST = 700;       // so viele Karteneinheiten reicht ein Fass Proviant
  const HUNGRY_SPEED = 0.6;    // Tempo ohne Proviant
  const WIND_MAX = 0.3;        // Rückenwind: bis +30 %, Gegenwind bis −30 %
  const TURN = 4;              // wie schnell das Schiff sich dreht (für die Anzeige)
  const ARRIVE = 4;            // Kurspunkt erreicht
  const FLOTSAM_MAX = 4;
  const FLOTSAM_EVERY = 12;    // Sekunden zwischen neuem Treibgut
  const FLOTSAM_PICK = 30;     // so nah muss man heran
  const DISCOVER = 150;        // so nah muss man an einen Ort, um ihn zu entdecken
  const GRUMBLE_EVERY = 25;    // Sekunden zwischen zwei Meldungen „Die Crew murrt“

  let flotsamClock = 0;
  let grumbleClock = 0;

  const st = () => SF.state;

  // Schiff an den Start setzen (Port Dublone), falls es noch keine Position hat
  function ensurePos() {
    const s = st();
    if (!s.pos) {
      const p = SF.world.placeById[s.docked] || SF.world.START;
      s.pos = { x: p.x, y: p.y, dx: 1, dy: 0 };
      if (!s.visited[p.id]) s.visited[p.id] = Date.now(); // den Starthafen kennt man schon
    }
    if (!s.wind) newWind(true);
    SF.world.fogFromString(s.fog);
    if (SF.world.reveal(s.pos.x, s.pos.y)) s.fog = SF.world.fogToString();
  }

  // ---------- Wind ----------

  // Neue Windrichtung auslosen (als Vektor, ohne Winkel)
  function newWind(now) {
    const s = st();
    let x = SF.rng.float() * 2 - 1;
    let y = SF.rng.float() * 2 - 1;
    const len = Math.sqrt(x * x + y * y) || 1;
    x /= len;
    y /= len;
    const strength = 0.35 + SF.rng.float() * 0.65;
    const next = 60 + SF.rng.float() * 60;
    if (now || !s.wind) s.wind = { x, y, s: strength, tx: x, ty: y, ts: strength, next };
    else Object.assign(s.wind, { tx: x, ty: y, ts: strength, next });
  }

  function updateWind(dt) {
    const w = st().wind;
    w.next -= dt;
    if (w.next <= 0) newWind(false);
    // langsam zur neuen Richtung drehen
    const k = Math.min(1, dt * 0.15);
    w.x += (w.tx - w.x) * k;
    w.y += (w.ty - w.y) * k;
    const len = Math.sqrt(w.x * w.x + w.y * w.y) || 1;
    w.x /= len;
    w.y /= len;
    w.s += (w.ts - w.s) * k;
  }

  // Tempo-Faktor für die Fahrtrichtung (dx, dy): Rückenwind schneller, Gegenwind langsamer
  function windFactor(dx, dy) {
    const w = st().wind;
    if (!w) return 1;
    return 1 + WIND_MAX * w.s * (dx * w.x + dy * w.y);
  }

  // ---------- Tempo und Proviant ----------

  function speed(dx = st().pos.dx, dy = st().pos.dy) {
    const base = SF.ships.stats().speed;
    const hungry = st().food <= 0 ? HUNGRY_SPEED : 1;
    return base * windFactor(dx, dy) * hungry;
  }

  // Wie weit reicht der Proviant noch? (Karteneinheiten)
  // Wie weit ein Fass reicht (Smutje Fiete kocht sparsamer)
  const foodDist = () => FOOD_DIST * (SF.crew ? SF.crew.foodMul() : 1) * (st().hard ? 0.8 : 1);
  const range = () => st().food * foodDist();

  // ---------- Kurs ----------

  function setCourse(points) {
    st().course = points ? points.slice() : [];
    st().docked = '';
  }

  const moving = () => st().course.length >= 2;

  // ---------- Treibgut ----------

  // Was schwimmt da? amber: Bernstein · crate: Kiste Ware · barrel: Fass Proviant
  function spawnFlotsam() {
    const s = st();
    for (let tries = 0; tries < 12; tries++) {
      let x = SF.rng.float() * 2 - 1;
      let y = SF.rng.float() * 2 - 1;
      const len = Math.sqrt(x * x + y * y) || 1;
      const d = 250 + SF.rng.float() * 350;
      x = s.pos.x + x / len * d;
      y = s.pos.y + y / len * d;
      if (!SF.world.isWater(x, y, 30)) continue;
      const r = SF.rng.float();
      const kind = r < 0.55 ? 'amber' : r < 0.8 ? 'barrel' : 'crate';
      s.flotsam.push({ x: Math.round(x), y: Math.round(y), kind });
      return true;
    }
    return false;
  }

  function pickFlotsam(item) {
    const s = st();
    if (item.kind === 'amber') {
      const n = SF.amber.add(2 + SF.rng.int(5));
      return { type: 'flotsam', kind: 'amber', amount: n, text: `+${n} Bernstein aus dem Wasser gefischt` };
    }
    if (item.kind === 'barrel') {
      const max = SF.ships.stats().food;
      if (s.food >= max) {
        const n = SF.amber.add(2);
        return { type: 'flotsam', kind: 'amber', amount: n, text: `Ein Fass Proviant – kein Platz mehr. Du verkaufst es dem Klabautermann für ${n} Bernstein.` };
      }
      s.food = Math.min(max, s.food + 1);
      return { type: 'flotsam', kind: 'barrel', amount: 1, text: '+1 Fass Proviant aus dem Wasser gefischt' };
    }
    // Kiste mit einer zufälligen Ware
    const good = SF.trade ? SF.rng.pick(SF.trade.GOODS) : null;
    if (good && SF.ships.freeHold() > 0) {
      s.cargo[good.id] = (s.cargo[good.id] || 0) + 1;
      return { type: 'flotsam', kind: 'crate', amount: 1, good: good.id, text: `+1 Kiste ${good.name} aus dem Wasser gefischt` };
    }
    const n = SF.amber.add(3);
    return { type: 'flotsam', kind: 'amber', amount: n, text: `Eine Kiste – aber der Laderaum ist voll. Darin: ${n} Bernstein.` };
  }

  // ---------- Ein Schritt ----------

  // dt in Sekunden; gibt eine Liste von Ereignissen zurück
  function step(dt) {
    const s = st();
    const events = [];
    if (!s.pos) ensurePos();
    updateWind(dt);
    const p = s.pos;

    if (moving()) {
      let budget = speed() * dt; // so weit kommt das Schiff in diesem Schritt
      let tx = s.course[0];
      let ty = s.course[1];
      let moved = 0;
      while (budget > 0 && s.course.length >= 2) {
        tx = s.course[0];
        ty = s.course[1];
        const dx = tx - p.x;
        const dy = ty - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= ARRIVE) {
          s.course.splice(0, 2);
          continue;
        }
        const stepLen = Math.min(budget, dist, 12); // kleine Schritte, damit keine Küste übersprungen wird
        const nx = p.x + dx / dist * stepLen;
        const ny = p.y + dy / dist * stepLen;
        if (!SF.world.isWater(nx, ny)) {
          s.course = [];
          events.push({ type: 'land' });
          break;
        }
        p.x = nx;
        p.y = ny;
        budget -= stepLen;
        moved += stepLen;
        // Blickrichtung (für die Anzeige) weich nachdrehen
        const k = Math.min(1, dt * TURN);
        let hx = p.dx + (dx / dist - p.dx) * k;
        let hy = p.dy + (dy / dist - p.dy) * k;
        const hl = Math.sqrt(hx * hx + hy * hy) || 1;
        p.dx = hx / hl;
        p.dy = hy / hl;
      }
      if (moved > 0) {
        s.seaTime += dt;
        s.stats.distance += moved;
        const before = s.food;
        s.food = Math.max(0, s.food - moved / foodDist());
        if (before > 0 && s.food <= 0) events.push({ type: 'nofood' });
        if (s.food <= 0) {
          grumbleClock += dt;
          if (grumbleClock >= GRUMBLE_EVERY) {
            grumbleClock = 0;
            events.push({ type: 'grumble' });
          }
        } else if (before >= 1 && s.food < 1) {
          events.push({ type: 'lowfood' });
        }
        if (SF.world.reveal(p.x, p.y)) {
          s.fog = SF.world.fogToString();
          events.push({ type: 'reveal' });
        }
      }
      if (s.course.length < 2) {
        s.course = [];
        events.push({ type: 'stop' });
        const near = SF.world.placeNear(p.x, p.y, 90, x => x.harbor);
        if (near) events.push({ type: 'arrive', place: near.id });
      }
    }

    // Orte entdecken
    const place = SF.world.placeNear(p.x, p.y, DISCOVER);
    if (place && !s.visited[place.id]) {
      s.visited[place.id] = Date.now();
      s.stats.places = Object.keys(s.visited).length;
      const reward = place.reward ? SF.amber.add(place.reward) : 0;
      events.push({ type: 'discover', place: place.id, reward });
    }

    // Treibgut
    flotsamClock += dt;
    if (flotsamClock >= FLOTSAM_EVERY) {
      flotsamClock = 0;
      // weit entferntes Treibgut versinkt
      s.flotsam = s.flotsam.filter(f => (f.x - p.x) * (f.x - p.x) + (f.y - p.y) * (f.y - p.y) < 1200 * 1200);
      if (s.flotsam.length < FLOTSAM_MAX && moving()) spawnFlotsam();
    }
    for (let i = s.flotsam.length - 1; i >= 0; i--) {
      const f = s.flotsam[i];
      if ((f.x - p.x) * (f.x - p.x) + (f.y - p.y) * (f.y - p.y) <= FLOTSAM_PICK * FLOTSAM_PICK) {
        s.flotsam.splice(i, 1);
        s.stats.flotsam++;
        events.push(pickFlotsam(f));
      }
    }
    return events;
  }

  SF.voyage = {
    FOOD_DIST, HUNGRY_SPEED, WIND_MAX, FLOTSAM_PICK, DISCOVER,
    ensurePos, newWind, windFactor, speed, range, setCourse, moving, spawnFlotsam, step,
    _resetClocks() { flotsamClock = 0; grumbleClock = 0; },
  };
})();
