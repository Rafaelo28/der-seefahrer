// Schlacht-Bildschirm: Seeschlacht gegen einen Computer-Piraten. Finger aufs Wasser = dorthin steuern (der Zielpunkt
// bleibt unter dem Finger, auch wenn die Kamera mitfährt), große Knöpfe für die Breitseiten nach Backbord (rot, links
// vom Schiff) und Steuerbord (grün, rechts vom Schiff). Liegt der Gegner vor einer geladenen Seite, leuchten Bereich und
// Knopf. „Entern!“, wenn der Gegner schwer beschädigt und nah ist. „Fliehen“ nur mit Knopf (am Rand, Gegner weit weg).
// Rechnung: js/battle.js.
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
  let finger = null;       // Bildschirm-Punkt des lenkenden Fingers (wird jedes Bild in die Welt umgerechnet)
  const SIDE_COLOR = { port: '220,70,55', star: '60,190,110' }; // Backbord rot, Steuerbord grün (wie die Positionslichter)
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
    if (p.kind === 'dutchman') {
      await SF.ui.dialog({
        title: `${SF.icon('skull')} Der Fliegende Holländer!`,
        html: `<p>Aus dem Nebel gleitet ein Schiff mit zerfetzten, bleichen Segeln. ${SF.state.gk && SF.state.gk.ships.includes('ghost')
          ? 'Das ist <b>dein altes Geisterschiff aus Gamble Klicker</b>!' : 'Ein Geisterschiff!'} An Deck steht <b>Long John</b> und lacht.</p>
          <p>„Den Holländer kann man nicht versenken, Landratte!“</p>
          <p class="muted small">Das stimmt: Schieß ihn schwer an, dann <b>entere</b> ihn und besiege Long John.</p>`,
        buttons: [{ label: `${SF.icon('swords')} Auf ihn!`, value: true, kind: 'primary' }],
      });
    } else await SF.ui.dialog({
      title: `${SF.icon('skull')} ${SF.escape(p.name)} greift an!`,
      html: `<p>${k.name === p.name ? '' : `Ein ${k.name} in einer ${SF.ships.byId[k.ship].name}. `}Kopfgeld: ${SF.amberHTML(k.bounty)}</p>
        <p class="muted small">Steuern: Finger aufs Wasser halten – dein Schiff fährt dorthin. Feuern: <b class="side-port">Backbord</b> (rot, links vom
        Schiff) und <b class="side-star">Steuerbord</b> (grün, rechts vom Schiff). Leuchtet ein Knopf, liegt der Gegner genau davor.
        Ist er schwer getroffen und nah, kannst du <b>entern</b>. Fliehen: weit weg vom Gegner an den Rand des Meeres segeln und auf
        <b>Fliehen</b> tippen.</p>`,
      buttons: [{ label: `${SF.icon('swords')} Zum Kampf!`, value: true, kind: 'primary' }],
    });
    starting = false;
    const s = SF.state;
    const st = SF.ships.stats();
    const maxHp = SF.battle.maxHull();
    if (s.ship.hp == null || s.ship.hp > maxHp) s.ship.hp = maxHp;
    const w = s.wind || { x: 1, y: 0, s: 0.5 };
    b = SF.battle.create(
      { type: s.ship.type, hp: s.ship.hp, maxHp, cannons: st.cannons, speed: st.speed, reloadMul: SF.crew ? SF.crew.reloadMul() : 1 },
      SF.pirates.enemyFor(p),
      { x: w.x, y: w.y, s: w.s },
      Math.floor(SF.rng.float() * 4294967295),
    );
    if (SF.cosmetics) b.player.colors = SF.cosmetics.shipColors();
    input = {};
    finger = null;
    steerPointer = null;
    time = 0;
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
    $('bt-flee').hidden = true;
    hudClock = 1;
    updateHud();
    SF.track('seefahrer-schlacht');
    SF.ui.tipOnce('battle', 'Halte den Finger aufs Wasser – dein Schiff fährt dorthin. Dreh dich <b>seitlich</b> zum Gegner: Leuchtet ein Knopf, feuern!', 7000);
  }

  // ---------- Spielschleife ----------

  function frame(dt) {
    if (!b || !canvas) return;
    time += dt;
    if (finger) {
      const w = toWorld(finger.x, finger.y);
      input.tx = w.x;
      input.ty = w.y;
    }
    const fire = input.fire;
    input.fire = null;
    let events;
    if (duel && duel.role === 'guest') {
      events = duelGuestStep(dt, fire);
    } else if (duel) {
      const remoteFire = duel.remote.fire;
      duel.remote.fire = null;
      events = SF.battle.step(b, dt, { tx: input.tx, ty: input.ty, fire }, { tx: duel.remote.tx, ty: duel.remote.ty, fire: remoteFire });
      duelHostSend(dt, events);
    } else {
      events = SF.battle.step(b, dt, { tx: input.tx, ty: input.ty, fire });
    }
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
        if (duel) { duelOver(e.result); break; }
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
    if (pirate.kind === 'dutchman') {
      SF.finale.afterBattle(result);
      if (result === 'boarded') {
        // Long John besiegt: weiter mit dem Ende (Bildergeschichte und Abspann)
        SF.save();
        setTimeout(() => { b = null; SF.finale.ending(); }, 700);
        return;
      }
    }
    const k = SF.pirates.KINDS[pirate.kind];
    const goods = o => Object.entries(o).map(([g, n]) => `${n}× ${SF.icon(SF.trade.byId[g].icon)} ${SF.trade.byId[g].name}`).join(', ');
    let title = '';
    let html = '';
    if (result === 'boarded') {
      SF.sound.play('fanfare');
      title = `${SF.icon('hook')} Geentert!`;
      html = `<p>Du hast das Schiff von <b>${SF.escape(pirate.name)}</b> geentert! Das Kopfgeld gehört dir: ${SF.amberHTML(out.amber)}.</p>
        ${Object.keys(out.cargo).length ? `<p>Erbeutet: ${goods(out.cargo)}</p>` : '<p class="muted small">Für die Ladung der Piraten war kein Platz mehr.</p>'}`;
      SF.story.log(`${pirate.name} geentert – ${out.amber} Bernstein Kopfgeld.`);
    } else if (result === 'sunk') {
      SF.sound.play('fanfare');
      title = `${SF.icon('blast')} Versenkt!`;
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
      if (SF.finale) SF.finale.check();
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

    // Schussbereich der eigenen Breitseiten: Backbord rot, Steuerbord grün; hell, wenn der Gegner davor liegt
    const p = b.player;
    ['port', 'star'].forEach(side => {
      const n = SF.battle.sideNormal(p, side);
      const loaded = p.reload[side] <= 0;
      const hot = loaded && aimed(side);
      const half = p.len * 0.35;
      const R = SF.battle.BALL_RANGE;
      const c = SIDE_COLOR[side];
      ctx.fillStyle = !loaded ? 'rgba(0,0,0,.08)' : `rgba(${c},${hot ? 0.42 : 0.16})`;
      ctx.beginPath();
      ctx.moveTo(p.x + p.hx * half, p.y + p.hy * half);
      ctx.lineTo(p.x + p.hx * half + n.x * R + p.hx * R * 0.25, p.y + p.hy * half + n.y * R + p.hy * R * 0.25);
      ctx.lineTo(p.x - p.hx * half + n.x * R - p.hx * R * 0.25, p.y - p.hy * half + n.y * R - p.hy * R * 0.25);
      ctx.lineTo(p.x - p.hx * half, p.y - p.hy * half);
      ctx.closePath();
      ctx.fill();
      if (loaded) {
        ctx.strokeStyle = `rgba(${c},${hot ? 0.9 : 0.4})`;
        ctx.lineWidth = (hot ? 4 : 2) / z;
        ctx.stroke();
      }
    });
    // Zielpunkt des Fingers mit gestrichelter Linie vom Bug
    if (input.tx != null) {
      const dx = input.tx - p.x;
      const dy = input.ty - p.y;
      const far = dx * dx + dy * dy > (p.len * SF.battle.STEER_DEAD) * (p.len * SF.battle.STEER_DEAD);
      if (far) {
        ctx.strokeStyle = 'rgba(255,255,255,.55)';
        ctx.lineWidth = 3 / z;
        ctx.setLineDash([12 / z, 10 / z]);
        ctx.beginPath();
        ctx.moveTo(p.x + p.hx * p.len * 0.5, p.y + p.hy * p.len * 0.5);
        ctx.lineTo(input.tx, input.ty);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

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
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.lineWidth = 3 / z;
      ctx.beginPath();
      ctx.arc(input.tx, input.ty, 22 / z, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Am Anfang die Namen der Seiten an die Schussbereiche schreiben (zum Merken: Backbord rot, Steuerbord grün)
    if (time < 8) {
      const a = time < 7 ? 1 : 8 - time;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = '800 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ['port', 'star'].forEach(side => {
        const n = SF.battle.sideNormal(p, side);
        const wx = p.x + n.x * SF.battle.BALL_RANGE * 0.88;
        const wy = p.y + n.y * SF.battle.BALL_RANGE * 0.88;
        const sx = (wx - cam.x) * z + vw / 2;
        const sy = (wy - cam.y) * z + vh / 2;
        const label = side === 'port' ? 'Backbord' : 'Steuerbord';
        const w = ctx.measureText(label).width + 20;
        ctx.globalAlpha = a;
        ctx.fillStyle = `rgb(${SIDE_COLOR[side]})`;
        ctx.beginPath();
        ctx.moveTo(sx - w / 2 + 12, sy - 14);
        ctx.arcTo(sx + w / 2, sy - 14, sx + w / 2, sy + 14, 12);
        ctx.arcTo(sx + w / 2, sy + 14, sx - w / 2, sy + 14, 12);
        ctx.arcTo(sx - w / 2, sy + 14, sx - w / 2, sy - 14, 12);
        ctx.arcTo(sx - w / 2, sy - 14, sx + w / 2, sy - 14, 12);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(label, sx, sy + 1);
      });
      ctx.globalAlpha = 1;
    }
  }

  // Liegt der Gegner vor dieser Breitseite und in Reichweite? (dann leuchten Bereich und Knopf)
  const aimed = side => !!SF.battle.inArc(b, b.player, side, SF.battle.AIM_CONE, 1);

  // ---------- Anzeigen ----------

  function updateHud() {
    if (!b) return;
    const p = b.player;
    const e = b.enemy;
    $('bt-hp-me').style.transform = `scaleX(${(p.hp / p.maxHp).toFixed(3)})`;
    $('bt-hp-enemy').style.transform = `scaleX(${(e.hp / e.maxHp).toFixed(3)})`;
    SF.setText($('bt-hp-me-text'), `${Math.ceil(p.hp)} / ${p.maxHp}`);
    SF.setText($('bt-hp-enemy-text'), `${Math.ceil(e.hp)} / ${e.maxHp}`);
    let ready = '';
    ['port', 'star'].forEach(side => {
      const r = p.reload[side] / p.reloadTime;
      const hot = r <= 0 && aimed(side);
      if (hot) ready = side;
      $(`bt-${side}`).classList.toggle('loading', r > 0);
      $(`bt-${side}`).classList.toggle('ready', hot);
      $(`bt-${side}-load`).style.transform = `scaleX(${(1 - r).toFixed(3)})`;
    });
    $('bt-board').hidden = !!duel || !SF.battle.canBoard(b);
    $('bt-flee').hidden = !!duel || !SF.battle.canFlee(b);
    const info = ready ? `Feuer frei: ${ready === 'port' ? 'Backbord' : 'Steuerbord'}!`
      : duel ? 'Online-Seeschlacht' : `${p.cannons} Kanone${p.cannons === 1 ? '' : 'n'} je Breitseite`;
    SF.setText($('bt-info'), info);
    $('bt-info').classList.toggle('ready', !!ready);
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
    // Lenken: der Punkt unter dem Finger zählt (jedes Bild neu umgerechnet, die Kamera fährt ja mit).
    // Ein neuer Finger auf dem Wasser übernimmt das Lenken.
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* kein echter Finger (z. B. im Test) */ }
      steerPointer = e.pointerId;
      finger = local(e);
      const w = toWorld(finger.x, finger.y);
      input.tx = w.x;
      input.ty = w.y;
    });
    canvas.addEventListener('pointermove', e => {
      if (e.pointerId !== steerPointer) return;
      finger = local(e);
    });
    const up = e => {
      if (e.pointerId !== steerPointer) return;
      steerPointer = null;
      finger = null;
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
    // Fliehen nur mit Absicht: Knopf erscheint am Rand, wenn der Gegner außer Schussweite ist
    $('bt-flee').addEventListener('click', () => {
      if (!b || duel || !SF.battle.flee(b)) return;
      SF.sound.play('tap');
      finish('fled');
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

  // ---------- Online-Seeschlacht mit Freunden (js/duel.js) ----------

  let duel = null;  // { role, chan, me, other, remote, snap, clock }

  function startDuel(d) {
    const st = d.start;
    // Gastgeber: player = er selbst. Freund: gespiegelt, player = er selbst (bekommt Schnappschüsse vom Gastgeber)
    b = d.role === 'host' ? SF.duel.createBattle(st) : SF.duel.createBattle({ seed: st.seed, wind: st.wind, host: st.guest, guest: st.host });
    duel = { role: d.role, chan: d.chan, me: d.me, other: d.other, rec: d.rec, remote: {}, snap: null, clock: 0, sentAt: 0, lastIn: '', events: [], ended: false };
    d.chan.onMessage(msg => {
      if (!msg || !duel) return;
      if (msg.t === 'in' && duel.role === 'host') {
        duel.remote.tx = typeof msg.tx === 'number' ? msg.tx : null;
        duel.remote.ty = typeof msg.ty === 'number' ? msg.ty : null;
        if (msg.fire === 'port' || msg.fire === 'star') duel.remote.fire = msg.fire;
      } else if (msg.t === 'snap' && duel.role === 'guest') {
        duel.snap = msg;
      }
    });
    d.chan.onClose(() => {
      if (duel && !duel.ended) duelOver('gone');
    });
    pirate = null;
    input = {};
    finger = null;
    steerPointer = null;
    time = 0;
    fx = [];
    wakes.player = [];
    wakes.enemy = [];
    ending = false;
    SF.ui.show('battle');
    resize();
    cam.x = (b.player.x + b.enemy.x) / 2;
    cam.y = (b.player.y + b.enemy.y) / 2;
    $('bt-enemy-name').textContent = d.other.name;
    $('bt-board').hidden = true;
    $('bt-flee').hidden = true;
    hudClock = 1;
    updateHud();
    SF.sound.play('horn');
    SF.ui.toast(`${SF.icon('swords')} Seeschlacht gegen <b>${SF.escape(d.other.name)}</b>!`, 2500);
  }

  // Gastgeber: Schnappschüsse an den Freund
  function duelHostSend(dt, events) {
    duel.events.push(...events.filter(e => e.type !== 'over'));
    duel.clock += dt;
    if (duel.clock < SF.duel.SNAP_EVERY && !b.over) return;
    duel.clock = 0;
    duel.chan.send(SF.duel.pack(b, duel.events));
    duel.events = [];
  }

  // Freund: Eingaben senden, neuesten Schnappschuss anwenden
  function duelGuestStep(dt, fire) {
    duel.clock += dt;
    const sig = `${Math.round(input.tx || 0)}|${Math.round(input.ty || 0)}|${input.tx == null}`;
    if (fire || (duel.clock >= SF.duel.INPUT_EVERY && sig !== duel.lastIn)) {
      duel.clock = 0;
      duel.lastIn = sig;
      duel.chan.send({ t: 'in', tx: input.tx == null ? null : Math.round(input.tx), ty: input.ty == null ? null : Math.round(input.ty), fire: fire || null });
    }
    if (!duel.snap) return [];
    const snap = duel.snap;
    duel.snap = null;
    const events = SF.duel.apply(b, snap);
    if (b.over && !duel.ended) events.push({ type: 'over', result: b.over });
    return events;
  }

  // Ende des Duells: result aus eigener Sicht ('sunk' = gewonnen, 'lost' = verloren, 'gone' = Verbindung weg)
  function duelOver(result) {
    if (!duel || duel.ended) return;
    duel.ended = true;
    const d = duel;
    const s = SF.duel.stats();
    if (result === 'sunk' || result === 'lost') {
      s.duels++;
      if (result === 'sunk') s.duelWins++;
    }
    // Rekorde des Freundes für die Rangliste merken
    if (SF.friends && d.rec) SF.friends.remember(Object.assign({}, d.rec, { name: d.other.name }), result === 'sunk' ? 'won' : result === 'lost' ? 'lost' : '');
    if (result === 'sunk') SF.sound.play('fanfare');
    else if (result === 'lost') SF.sound.play('lose');
    SF.save();
    setTimeout(async () => {
      if (d.role === 'host' && result !== 'gone') d.chan.send(SF.duel.pack(b, [])); // letzter Stand mit Ergebnis
      await SF.ui.dialog({
        title: result === 'sunk' ? `${SF.icon('trophy')} Gewonnen!` : result === 'lost' ? 'Versenkt!' : 'Verbindung weg',
        html: result === 'sunk' ? `<p>Du hast <b>${SF.escape(d.other.name)}</b> besiegt! Ruhm und Ehre gehören dir.</p>`
          : result === 'lost' ? `<p><b>${SF.escape(d.other.name)}</b> hat gewonnen. Nächstes Mal!</p>`
            : '<p>Die Verbindung zu deinem Freund ist abgerissen.</p>',
        buttons: [{ label: 'Zurück', value: true, kind: 'primary' }],
      });
      setTimeout(() => d.chan.close(), 300);
      duel = null;
      b = null;
      if (SF.state.docked) SF.harbor.open(SF.state.docked);
      else SF.sea.open();
    }, result === 'gone' ? 0 : 900);
  }

  SF.battleView = { start, startDuel, frame, bind, resize, current: () => b, duel: () => duel, busy: () => starting || !!b };
})();
