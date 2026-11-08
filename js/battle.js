// Seeschlacht (ohne Bildschirm, testbar): zwei Schiffe, Breitseiten nach Backbord und Steuerbord, Kanonenkugeln,
// Treffer am Rumpf, Wind, Computer-Gegner. Gerechnet wird NUR mit + − × ÷ und Math.sqrt (keine Winkelfunktionen)
// und mit eigenem Zufall aus einem Startwert – so rechnet die Schlacht auf jedem Gerät gleich (wichtig für die
// Online-Schlacht in Stufe 5). Gezeichnet wird in js/battle-view.js.
window.SF = window.SF || {};

(function () {
  const ARENA_W = 1800;
  const ARENA_H = 1100;
  const SCALE = 1.6;          // Schiffe sind in der Schlacht größer und schneller als auf der Karte
  const BALL_SPEED = 340;
  const BALL_RANGE = 400;
  const BALL_DAMAGE = 8;
  const RELOAD = 2.6;         // Sekunden je Seite
  const WIND = 0.2;           // Rückenwind ±20 %
  const FLEE_DIST = 760;      // so weit weg = entkommen …
  const FLEE_EDGE = 340;      // … oder am Rand der Arena, wenn der Gegner mindestens so weit weg ist
  const BOARD_HP = 0.35;      // Entern ab 35 % Rumpf des Gegners …
  const BOARD_DIST = 190;     // … und so nah
  const EDGE = 60;

  // Wendigkeit je Schiffstyp (Drehung pro Sekunde, als Anteil des Richtungsvektors)
  const TURN = { sloop: 1.25, brig: 1.05, frigate: 0.9, galleon: 0.72, ghost: 1.0 };
  // Rumpf je Schiffstyp (Lebenspunkte)
  const HULL = { sloop: 60, brig: 90, frigate: 130, galleon: 180, ghost: 150 };
  const HULL_UP = 25;         // je Stufe „Rumpf verstärken“

  // Fester Zufall (gleiche Zahlenfolge auf allen Geräten)
  function rand(b) {
    b.seed = (Math.imul(b.seed, 1664525) + 1013904223) >>> 0;
    return b.seed / 4294967296;
  }

  function norm(x, y) {
    const l = Math.sqrt(x * x + y * y);
    return l > 1e-9 ? { x: x / l, y: y / l } : { x: 1, y: 0 };
  }

  // Schiff für die Schlacht. o: { type, hp, maxHp, cannons, speed, side, x, y, hx, hy, aim, delay }
  function makeShip(o) {
    const t = SF.ships.byId[o.type] || SF.ships.byId.sloop;
    const h = norm(o.hx == null ? 1 : o.hx, o.hy == null ? 0 : o.hy);
    return {
      side: o.side,
      type: t.id,
      x: o.x, y: o.y, hx: h.x, hy: h.y,
      len: t.len * SCALE,
      speed: o.speed * SCALE,
      turn: TURN[t.id] || 1,
      hp: o.hp, maxHp: o.maxHp,
      cannons: Math.max(1, o.cannons || 0), // ein Drehbassen-Geschütz hat jedes Schiff
      reload: { port: 0, star: 0 },
      aim: o.aim || 0, delay: o.delay || 0, aimClock: 0,
      colors: o.colors || null,
    };
  }

  // Maximaler Rumpf des eigenen Schiffs (mit Ausbau)
  const maxHull = (ship = SF.state.ship) => (HULL[ship.type] || 60) + HULL_UP * (ship.hull || 0);

  // Neue Schlacht. player/enemy: Angaben für makeShip; seed: Startwert für den Zufall
  function create(player, enemy, wind, seed = 1) {
    const b = {
      t: 0,
      seed: seed >>> 0 || 1,
      wind: wind ? { x: wind.x, y: wind.y, s: wind.s } : { x: 1, y: 0, s: 0 },
      player: makeShip(Object.assign({ side: 'player', x: ARENA_W * 0.36, y: ARENA_H * 0.6, hx: 1, hy: -0.3 }, player)),
      enemy: makeShip(Object.assign({ side: 'enemy', x: ARENA_W * 0.64, y: ARENA_H * 0.4, hx: -1, hy: 0.3 }, enemy)),
      balls: [],
      over: '',      // '' | 'sunk' | 'lost' | 'fled' | 'boarded'
      hits: { player: 0, enemy: 0 }, // Treffer, die das jeweilige Schiff gelandet hat
    };
    return b;
  }

  // Richtung (dx, dy) ansteuern: kleine Drehung des Richtungsvektors, ohne Winkel
  function steer(s, dx, dy, dt) {
    const d = norm(dx, dy);
    const cross = s.hx * d.y - s.hy * d.x;
    const dot = s.hx * d.x + s.hy * d.y;
    if (dot > 0.9995 && cross * cross < 1e-6) return;
    let k = s.turn * dt;
    // nicht über das Ziel hinausdrehen
    if (dot > 0 && (cross < 0 ? -cross : cross) < k) k = cross < 0 ? -cross : cross;
    const sign = cross >= 0 || dot < -0.99 ? 1 : -1;
    const n = norm(s.hx + -s.hy * k * sign, s.hy + s.hx * k * sign);
    s.hx = n.x;
    s.hy = n.y;
  }

  // Seiten: Steuerbord (rechts) = (-hy, hx), Backbord (links) = (hy, -hx) – bei y nach unten
  const sideNormal = (s, side) => (side === 'star' ? { x: -s.hy, y: s.hx } : { x: s.hy, y: -s.hx });

  function fire(b, s, side, events) {
    if (s.reload[side] > 0 || b.over) return false;
    s.reload[side] = RELOAD;
    const n = sideNormal(s, side);
    const spread = s.side === 'enemy' ? s.aim : 0.04;
    const v = s.speed * windFactor(b, s);
    for (let i = 0; i < s.cannons; i++) {
      const along = s.cannons === 1 ? 0 : (i / (s.cannons - 1) - 0.5) * s.len * 0.6;
      const jitter = (rand(b) - 0.5) * 2 * spread;
      const d = norm(n.x + s.hx * jitter, n.y + s.hy * jitter);
      b.balls.push({
        from: s.side,
        x: s.x + s.hx * along + n.x * s.len * 0.2,
        y: s.y + s.hy * along + n.y * s.len * 0.2,
        vx: d.x * BALL_SPEED + s.hx * v * 0.5,
        vy: d.y * BALL_SPEED + s.hy * v * 0.5,
        life: BALL_RANGE / BALL_SPEED,
      });
    }
    events.push({ type: 'fire', by: s.side, side, x: s.x, y: s.y, nx: n.x, ny: n.y, count: s.cannons });
    return true;
  }

  function windFactor(b, s) {
    return 1 + WIND * b.wind.s * (s.hx * b.wind.x + s.hy * b.wind.y);
  }

  // Liegt der Punkt im Rumpf (Ellipse entlang der Fahrtrichtung)?
  function inHull(s, x, y) {
    const dx = x - s.x;
    const dy = y - s.y;
    const along = dx * s.hx + dy * s.hy;
    const across = -dx * s.hy + dy * s.hx;
    const a = s.len * 0.5;
    const c = s.len * 0.2;
    return (along * along) / (a * a) + (across * across) / (c * c) <= 1;
  }

  // Computer-Gegner: Abstand halten, seitlich kreisen, feuern, wenn der Spieler vor einer Breitseite liegt
  function ai(b, e, p, dt, events) {
    const tx = p.x - e.x;
    const ty = p.y - e.y;
    const dist = Math.sqrt(tx * tx + ty * ty) || 1;
    const ux = tx / dist;
    const uy = ty / dist;
    let dx;
    let dy;
    if (dist > 330) {
      dx = ux; dy = uy;
    } else {
      // seitlich: die Querrichtung, die näher an der jetzigen Fahrtrichtung liegt
      let px = -uy;
      let py = ux;
      if (px * e.hx + py * e.hy < 0) { px = -px; py = -py; }
      const pull = (dist - 230) / 160; // zu weit: hin, zu nah: weg
      dx = px + ux * pull;
      dy = py + uy * pull;
    }
    // vom Rand weg
    if (e.x < EDGE * 3) dx += 1.5;
    if (e.x > ARENA_W - EDGE * 3) dx -= 1.5;
    if (e.y < EDGE * 3) dy += 1.5;
    if (e.y > ARENA_H - EDGE * 3) dy -= 1.5;
    steer(e, dx, dy, dt);
    // Feuern
    if (dist < BALL_RANGE * 0.92) {
      const port = sideNormal(e, 'port');
      const dotPort = port.x * ux + port.y * uy;
      const side = dotPort > 0.86 ? 'port' : dotPort < -0.86 ? 'star' : '';
      if (side && e.reload[side] <= 0) {
        e.aimClock += dt;
        if (e.aimClock >= e.delay) {
          e.aimClock = 0;
          fire(b, e, side, events);
        }
      } else {
        e.aimClock = 0;
      }
    }
  }

  // Ein Schritt. input: { tx, ty } (Finger: dorthin lenken) und fire: 'port' | 'star'
  function step(b, dt, input = {}) {
    const events = [];
    if (b.over) return events;
    b.t += dt;
    const p = b.player;
    const e = b.enemy;
    if (input.tx != null) steer(p, input.tx - p.x, input.ty - p.y, dt);
    if (input.fire) fire(b, p, input.fire, events);
    ai(b, e, p, dt, events);
    [p, e].forEach(s => {
      s.reload.port = Math.max(0, s.reload.port - dt);
      s.reload.star = Math.max(0, s.reload.star - dt);
      const v = s.speed * windFactor(b, s) * dt;
      s.x += s.hx * v;
      s.y += s.hy * v;
      // Rand der Arena: festhalten (der Spieler gleitet am Rand entlang)
      s.x = Math.min(ARENA_W - EDGE, Math.max(EDGE, s.x));
      s.y = Math.min(ARENA_H - EDGE, Math.max(EDGE, s.y));
    });
    // Schiffe stoßen sich ab
    const ddx = e.x - p.x;
    const ddy = e.y - p.y;
    const dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
    const minD = (p.len + e.len) * 0.32;
    if (dd < minD) {
      const push = (minD - dd) / 2;
      p.x -= ddx / dd * push; p.y -= ddy / dd * push;
      e.x += ddx / dd * push; e.y += ddy / dd * push;
    }
    // Kugeln
    for (let i = b.balls.length - 1; i >= 0; i--) {
      const ball = b.balls[i];
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.life -= dt;
      const target = ball.from === 'player' ? e : p;
      if (inHull(target, ball.x, ball.y)) {
        target.hp = Math.max(0, target.hp - BALL_DAMAGE);
        b.hits[ball.from]++;
        events.push({ type: 'hit', on: target.side, x: ball.x, y: ball.y });
        b.balls.splice(i, 1);
      } else if (ball.life <= 0) {
        events.push({ type: 'splash', x: ball.x, y: ball.y });
        b.balls.splice(i, 1);
      }
    }
    // Ausgang
    if (e.hp <= 0) b.over = 'sunk';
    else if (p.hp <= 0) b.over = 'lost';
    else if (dd > FLEE_DIST || (dd > FLEE_EDGE && atEdge(p))) b.over = 'fled';
    if (b.over) events.push({ type: 'over', result: b.over });
    return events;
  }

  // Steht das Schiff am Rand der Arena?
  const atEdge = s => s.x <= EDGE + 1 || s.y <= EDGE + 1 || s.x >= ARENA_W - EDGE - 1 || s.y >= ARENA_H - EDGE - 1;

  // Kann man entern?
  function canBoard(b) {
    if (b.over) return false;
    const p = b.player;
    const e = b.enemy;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    return e.hp <= e.maxHp * BOARD_HP && dx * dx + dy * dy <= BOARD_DIST * BOARD_DIST;
  }

  function distance(b) {
    const dx = b.enemy.x - b.player.x;
    const dy = b.enemy.y - b.player.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  SF.battle = {
    ARENA_W, ARENA_H, SCALE, BALL_SPEED, BALL_RANGE, BALL_DAMAGE, RELOAD, FLEE_DIST, FLEE_EDGE, BOARD_HP, BOARD_DIST, HULL, HULL_UP,
    create, step, fire, steer, canBoard, distance, atEdge, inHull, sideNormal, maxHull, rand,
  };
})();
