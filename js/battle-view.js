// Schlacht-Bildschirm: Seeschlacht gegen einen Computer-Piraten. Finger aufs Wasser = dorthin steuern,
// große Knöpfe für die Breitseiten nach Backbord (links) und Steuerbord (rechts), „Entern!“ wenn der Gegner
// schwer beschädigt und nah ist. An den Rand segeln = fliehen. Die Rechnung steckt in js/battle.js.
window.SF = window.SF || {};

(function () {
  const $ = id => document.getElementById(id);
  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let vw = 0;
  let vh = 0;
  let b = null;            // laufende Schlacht
  let pirate = null;       // Pirat von der Seekarte
  let input = {};
  let steerPointer = null;
  let fx = [];             // Effekte: Rauch, Spritzer, Treffer
  let time = 0;
  let hudClock = 0;
  let ending = false;
  let starting = false;   // Angriffs-Fenster ist offen (nicht noch einmal starten)
  const cam = { x: 0, y: 0, z: 0.6 };
  const wakes = { player: [], enemy: [] };

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = canvas.clientWidth || window.innerWidth;
    vh = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    $('bt-rotate').hidden = !(vh > vw * 1.05) || !!SF.state.ui.tips['battle-portrait'];
  }

  // ---------- Start ----------

  async function start(p) {
    if (starting || b) return;
    starting = true;
    pirate = p;
    const k = SF.pirates.KINDS[p.kind];
    SF.voyage.setCourse([]);
    SF.sound.play('alarm');
    await SF.ui.dialog({
      title: `☠️ ${SF.escape(p.name)} greift an!`,
      html: `<p>${k.name === p.name ? '' : `Ein ${k.name} in einer ${SF.ships.byId[k.ship].name}. `}Kopfgeld: ${SF.amberHTML(k.bounty)}</p>
        <p class="muted small">Steuern: Finger aufs Wasser halten. Feuern: Backbord (links) und Steuerbord (rechts), wenn der Gegner neben dir ist.
        Ist er schwer getroffen und nah, kannst du <b>entern</b>. Fliehen: an den Rand des Meeres segeln.</p>`,
      buttons: [{ label: '⚔️ Zum Kampf!', value: true, kind: 'primary' }],
    });
    starting = false;
    const s = SF.state;
    const st = SF.ships.stats();
    const maxHp = SF.battle.maxHull();
    if (s.ship.hp == null || s.ship.hp > maxHp) s.ship.hp = maxHp;
    const w = s.wind || { x: 1, y: 0, s: 0.5 };
    b = SF.battle.create(
      { type: s.ship.type, hp: s.ship.hp, maxHp, cannons: st.cannons, speed: st.speed },
      SF.pirates.enemyFor(p),
      { x: w.x, y: w.y, s: w.s },
      Math.floor(SF.rng.float() * 4294967295),
    );
    if (SF.cosmetics) b.player.colors = SF.cosmetics.shipColors();
    input = {};
    fx = [];
    wakes.player = [];
    wakes.enemy = [];
    ending = false;
    SF.ui.show('battle');
    resize();
    cam.x = (b.player.x + b.enemy.x) / 2;
    cam.y = (b.player.y + b.enemy.y) / 2;
    $('bt-enemy-name').textContent = p.name;
    $('bt-board').hidden = true;
    hudClock = 1;
    updateHud();
    SF.track('seefahrer-schlacht');
    SF.ui.tipOnce('battle', 'Halte den Finger aufs Wasser – dein Schiff steuert dorthin. Dreh dich <b>seitlich</b> zum Gegner und feuere!', 7000);
  }

  // ---------- Spielschleife ----------

  function frame(dt) {
    if (!b || !canvas) return;
    time += dt;
    const fire = input.fire;
    input.fire = null;
    const events = SF.battle.step(b, dt, { tx: input.tx, ty: input.ty, fire });
    events.forEach(handle);
    // Kielwasser
    ['player', 'enemy'].forEach(side => {
      const s = b[side];
      const list = wakes[side];
      list.push({ x: s.x - s.hx * s.len * 0.45, y: s.y - s.hy * s.len * 0.45 });
      if (list.length > 40) list.shift();
    });
    fx = fx.filter(f => (f.t += dt) < f.life);
    // Kamera: beide Schiffe im Bild
    const d = SF.battle.distance(b);
    const want = Math.max(0.32, Math.min(0.95, Math.min(vw, vh) / (d + 520)));
    cam.z += (want - cam.z) * Math.min(1, dt * 2);
    cam.x += ((b.player.x + b.enemy.x) / 2 - cam.x) * Math.min(1, dt * 3);
    cam.y += ((b.player.y + b.enemy.y) / 2 - cam.y) * Math.min(1, dt * 3);
    draw();
    hudClock += dt;
    if (hudClock > 0.1) {
      hudClock = 0;
      updateHud();
    }
  }

  function handle(e) {
    switch (e.type) {
      case 'fire':
        SF.sound.play('cannon');
        for (let i = 0; i < Math.min(e.count, 6); i++) {
          fx.push({ k: 'smoke', c: e.by === 'player' && SF.cosmetics ? SF.cosmetics.value('smoke') : '230,230,230', x: e.x + e.nx * 30 + (Math.random() - 0.5) * 40, y: e.y + e.ny * 30 + (Math.random() - 0.5) * 40, t: 0, life: 1.1, vx: e.nx * 30, vy: e.ny * 30 });
        }
        break;
      case 'hit':
        SF.sound.play(e.on === 'player' ? 'hurt' : 'hit');
        fx.push({ k: 'hit', x: e.x, y: e.y, t: 0, life: 0.6 });
        if (e.on === 'player') shake();
        break;
      case 'splash':
        fx.push({ k: 'splash', x: e.x, y: e.y, t: 0, life: 0.8 });
        break;
      case 'over':
        finish(e.result);
        break;
      default:
        break;
    }
  }

  function shake() {
    canvas.classList.remove('shake');
    void canvas.offsetWidth;
    canvas.classList.add('shake');
  }

  // ---------- Ende ----------

  async function finish(result) {
    if (ending) return;
    ending = true;
    const out = SF.pirates.resolve(pirate, result, b.player.hp);
    const k = SF.pirates.KINDS[pirate.kind];
    const goods = o => Object.entries(o).map(([g, n]) => `${n}× ${SF.trade.byId[g].icon} ${SF.trade.byId[g].name}`).join(', ');
    let title = '';
    let html = '';
    if (result === 'boarded') {
      SF.sound.play('fanfare');
      title = '🏴‍☠️ Geentert!';
      html = `<p>Du hast das Schiff von <b>${SF.escape(pirate.name)}</b> geentert! Das Kopfgeld gehört dir: ${SF.amberHTML(out.amber)}.</p>
        ${Object.keys(out.cargo).length ? `<p>Erbeutet: ${goods(out.cargo)}</p>` : '<p class="muted small">Für die Ladung der Piraten war kein Platz mehr.</p>'}`;
      SF.story.log(`${pirate.name} geentert – ${out.amber} Bernstein Kopfgeld.`);
    } else if (result === 'sunk') {
      SF.sound.play('fanfare');
      title = '💥 Versenkt!';
      html = `<p>Das Schiff von <b>${SF.escape(pirate.name)}</b> versinkt. Für einen versenkten Piraten gibt es das halbe Kopfgeld: ${SF.amberHTML(out.amber)}.</p>
        <p class="muted small">Tipp: Wer <b>entert</b>, bekommt das ganze Kopfgeld und die Ladung.</p>`;
      SF.story.log(`${pirate.name} versenkt – ${out.amber} Bernstein.`);
    } else if (result === 'lost') {
      SF.sound.play('lose');
      const harbor = SF.world.placeById[out.harbor];
      title = 'Besiegt …';
      html = `<p>${SF.escape(pirate.name)} plündert dein Schiff${Object.keys(out.lost).length ? `: ${goods(out.lost)}` : ''}${out.lostAmber ? ` und ${SF.amberHTML(out.lostAmber)}` : ''}.</p>
        <p>Ein Fischer schleppt dich nach <b>${harbor.name}</b>. In der Werft kannst du den Rumpf reparieren.</p>`;
      SF.story.log(`Gegen ${pirate.name} verloren und nach ${harbor.name} geschleppt.`);
    } else if (result === 'repelled') {
      title = 'Davongesegelt';
      html = `<p>${SF.escape(pirate.name)} hat dich zurückgeschlagen und segelt davon. Beim nächsten Mal schneller zur Kajüte!</p>`;
    } else {
      SF.sound.play('horn');
      title = 'Entkommen!';
      html = `<p>Du bist ${SF.escape(pirate.name)} entkommen.</p>`;
    }
    SF.save();
    setTimeout(async () => {
      await SF.ui.dialog({ title, html, buttons: [{ label: 'Weiter', value: true, kind: 'primary' }] });
      b = null;
      if (out.harbor) SF.harbor.open(out.harbor);
      else SF.sea.open();
    }, result === 'fled' || result === 'repelled' ? 200 : 900);
    void k;
  }

  // ---------- Zeichnen ----------

  function draw() {
    const z = cam.z;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1f4a63';
    ctx.fillRect(0, 0, vw, vh);
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (vw / 2 - cam.x * z), dpr * (vh / 2 - cam.y * z));
    const W = SF.battle.ARENA_W;
    const H = SF.battle.ARENA_H;
    ctx.fillStyle = '#2f6f8f';
    ctx.fillRect(0, 0, W, H);
    // Wellen
    const x0 = cam.x - vw / 2 / z;
    const y0 = cam.y - vh / 2 / z;
    const x1 = cam.x + vw / 2 / z;
    const y1 = cam.y + vh / 2 / z;
    const G = 140;
    ctx.beginPath();
    for (let gx = Math.floor(x0 / G); gx <= Math.ceil(x1 / G); gx++) {
      for (let gy = Math.floor(y0 / G); gy <= Math.ceil(y1 / G); gy++) {
        const wx = gx * G + (gy % 2 ? G / 2 : 0) + Math.sin(time + gy) * 8;
        const wy = gy * G + Math.sin(time * 1.4 + gx * 1.3) * 5;
        ctx.moveTo(wx - 12, wy);
        ctx.quadraticCurveTo(wx, wy - 8, wx + 12, wy);
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    // Rand: Nebelbank
    ctx.strokeStyle = 'rgba(220,230,240,.35)';
    ctx.lineWidth = 40;
    ctx.strokeRect(-20, -20, W + 40, H + 40);

    // Kielwasser
    ['player', 'enemy'].forEach(side => {
      const list = wakes[side];
      for (let i = 1; i < list.length; i++) {
        ctx.strokeStyle = `rgba(${side === 'player' && SF.cosmetics ? SF.cosmetics.value('wake') : '255,255,255'},${(i / list.length) * 0.45})`;
        ctx.lineWidth = 3 + (i / list.length) * 8;
        ctx.beginPath();
        ctx.moveTo(list[i - 1].x, list[i - 1].y);
        ctx.lineTo(list[i].x, list[i].y);
        ctx.stroke();
      }
    });

    // Schussbereich der eigenen Breitseiten (Zielhilfe)
    const p = b.player;
    ['port', 'star'].forEach(side => {
      const n = SF.battle.sideNormal(p, side);
      const ready = p.reload[side] <= 0;
      const ex = b.enemy.x - p.x;
      const ey = b.enemy.y - p.y;
      const ed = Math.sqrt(ex * ex + ey * ey) || 1;
      const inLine = (ex * n.x + ey * n.y) / ed > 0.86 && ed < SF.battle.BALL_RANGE;
      const half = p.len * 0.35;
      const R = SF.battle.BALL_RANGE;
      ctx.fillStyle = ready ? (inLine ? 'rgba(255,210,122,.32)' : 'rgba(255,255,255,.12)') : 'rgba(0,0,0,.08)';
      ctx.beginPath();
      ctx.moveTo(p.x + p.hx * half, p.y + p.hy * half);
      ctx.lineTo(p.x + p.hx * half + n.x * R + p.hx * R * 0.25, p.y + p.hy * half + n.y * R + p.hy * R * 0.25);
      ctx.lineTo(p.x - p.hx * half + n.x * R - p.hx * R * 0.25, p.y - p.hy * half + n.y * R - p.hy * R * 0.25);
      ctx.lineTo(p.x - p.hx * half, p.y - p.hy * half);
      ctx.closePath();
      ctx.fill();
    });

    // Schiffe
    const sway = (Math.sin(time * 2.2) + 1) / 2;
    [b.enemy, b.player].forEach(s => {
      SF.ships.drawTop(ctx, s.type, s.x, s.y, s.hx, s.hy, SF.battle.SCALE, sway, s.colors);
      if (s.hp < s.maxHp * 0.5) {
        // Rauch aus dem beschädigten Rumpf
        const t = (time * 0.7) % 1;
        ctx.fillStyle = `rgba(60,60,60,${0.4 * (1 - t)})`;
        ctx.beginPath();
        ctx.arc(s.x - s.hx * 10, s.y - s.hy * 10 - t * 40, 10 + t * 20, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Kugeln
    ctx.fillStyle = '#111';
    b.balls.forEach(ball => {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Effekte
    fx.forEach(f => {
      const a = 1 - f.t / f.life;
      if (f.k === 'smoke') {
        ctx.fillStyle = `rgba(${f.c || '230,230,230'},${0.6 * a})`;
        ctx.beginPath();
        ctx.arc(f.x + f.vx * f.t, f.y + f.vy * f.t, 14 + f.t * 30, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.k === 'splash') {
        ctx.strokeStyle = `rgba(255,255,255,${0.8 * a})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 6 + f.t * 30, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(255,160,40,${a})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 8 + f.t * 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(110,70,30,${a})`;
        for (let i = 0; i < 5; i++) {
          ctx.fillRect(f.x + (i - 2) * 9 * (1 + f.t * 3), f.y - 10 * f.t * (i % 3 + 1), 4, 9);
        }
      }
    });

    // Zielpunkt des Fingers
    if (input.tx != null) {
      ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.lineWidth = 3 / z;
      ctx.beginPath();
      ctx.arc(input.tx, input.ty, 16 / z, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ---------- Anzeigen ----------

  function updateHud() {
    if (!b) return;
    const p = b.player;
    const e = b.enemy;
    $('bt-hp-me').style.transform = `scaleX(${(p.hp / p.maxHp).toFixed(3)})`;
    $('bt-hp-enemy').style.transform = `scaleX(${(e.hp / e.maxHp).toFixed(3)})`;
    SF.setText($('bt-hp-me-text'), `${Math.ceil(p.hp)} / ${p.maxHp}`);
    SF.setText($('bt-hp-enemy-text'), `${Math.ceil(e.hp)} / ${e.maxHp}`);
    ['port', 'star'].forEach(side => {
      const r = p.reload[side] / SF.battle.RELOAD;
      $(`bt-${side}`).classList.toggle('loading', r > 0);
      $(`bt-${side}-load`).style.transform = `scaleX(${(1 - r).toFixed(3)})`;
    });
    $('bt-board').hidden = !SF.battle.canBoard(b);
    const d = SF.battle.distance(b);
    const near = p.x < 200 || p.y < 200 || p.x > SF.battle.ARENA_W - 200 || p.y > SF.battle.ARENA_H - 200;
    SF.setText($('bt-info'), near && d > SF.battle.FLEE_EDGE ? '🏃 Zum Rand: fliehen' : `💣 ${p.cannons} Kanone${p.cannons === 1 ? '' : 'n'} je Breitseite`);
  }

  // ---------- Bedienung ----------

  function toWorld(sx, sy) {
    return { x: (sx - vw / 2) / cam.z + cam.x, y: (sy - vh / 2) / cam.z + cam.y };
  }

  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function bind() {
    canvas = $('battle-canvas');
    ctx = canvas.getContext('2d');
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* kein echter Finger (z. B. im Test) */ }
      steerPointer = e.pointerId;
      const w = toWorld(local(e).x, local(e).y);
      input.tx = w.x;
      input.ty = w.y;
    });
    canvas.addEventListener('pointermove', e => {
      if (e.pointerId !== steerPointer) return;
      const w = toWorld(local(e).x, local(e).y);
      input.tx = w.x;
      input.ty = w.y;
    });
    const up = e => {
      if (e.pointerId !== steerPointer) return;
      steerPointer = null;
      input.tx = null;
      input.ty = null;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    // Feuern beim Berühren (nicht erst beim Loslassen): schneller und mit zweitem Finger möglich
    ['port', 'star'].forEach(side => {
      $(`bt-${side}`).addEventListener('pointerdown', e => {
        e.preventDefault();
        if (!b || b.over) return;
        if (b.player.reload[side] > 0) { SF.sound.play('denied'); return; }
        input.fire = side;
      });
    });
    $('bt-board').addEventListener('click', () => {
      if (!b || !SF.battle.canBoard(b)) return;
      SF.sound.play('tap');
      board();
    });
    $('bt-rotate-ok').addEventListener('click', () => {
      SF.state.ui.tips['battle-portrait'] = 1;
      $('bt-rotate').hidden = true;
    });
    window.addEventListener('resize', resize);
  }

  // Entern: das Jump'n'Run auf dem Deck (js/boarding.js), sonst sofort geschafft
  function board() {
    const battle = b;
    battle.over = 'boarding';
    if (SF.boarding) {
      SF.boarding.start(pirate, ok => {
        battle.over = '';
        ending = false;
        if (ok) finish('boarded');
        else finish('repelled'); // nicht geschafft: zurück aufs eigene Schiff, der Gegner segelt davon
      });
    } else {
      battle.over = '';
      finish('boarded');
    }
  }

  SF.battleView = { start, frame, bind, resize, current: () => b, busy: () => starting || !!b };
})();
