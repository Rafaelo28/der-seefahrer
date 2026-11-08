// Online-Seeschlacht mit Freunden (Stufe 5): Einer öffnet einen Raum und bekommt einen Code, der andere tritt bei.
// Der Gastgeber rechnet die Schlacht (js/battle.js mit b.duel) und schickt etwa 15-mal pro Sekunde einen
// Schnappschuss; der Freund schickt seine Lenkung und Schüsse. Beide segeln ihr eigenes Schiff mit voller Ausrüstung,
// Crew und Cosmetics. Kein Einsatz, kein Verlust – es geht um die Ehre (Siege werden gezählt).
window.SF = window.SF || {};

(function () {
  const SNAP_EVERY = 1 / 15;   // Sekunden zwischen zwei Schnappschüssen
  const INPUT_EVERY = 1 / 20;  // Sekunden zwischen zwei Eingaben des Freundes
  const r1 = v => Math.round(v * 10) / 10;
  const r3 = v => Math.round(v * 1000) / 1000;

  // ---------- Das eigene Schiff für das Duell ----------

  function myShip() {
    const s = SF.state;
    const st = SF.ships.stats();
    const maxHp = SF.battle.maxHull();
    return {
      name: String(s.captain.name || 'Kapitän').slice(0, 16),
      fig: SF.figure.mine(),
      type: s.ship.type,
      hp: maxHp, maxHp,                  // im Duell immer mit heilem Rumpf
      cannons: st.cannons,
      speed: st.speed,
      reloadMul: SF.crew ? SF.crew.reloadMul() : 1,
      colors: SF.cosmetics ? SF.cosmetics.shipColors() : null,
    };
  }

  // Angaben vom Freund prüfen (nur bekannte Werte, sinnvolle Grenzen)
  function cleanShip(o) {
    o = o && typeof o === 'object' ? o : {};
    const t = SF.ships.byId[o.type] ? o.type : 'sloop';
    const lim = (v, a, b, d) => (typeof v === 'number' && isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
    const maxHp = Math.round(lim(o.maxHp, 30, 400, 60));
    const colors = {};
    if (o.colors && typeof o.colors === 'object') {
      ['sail', 'hull', 'flag'].forEach(k => { if (typeof o.colors[k] === 'string' && /^#[0-9a-f]{6}$/i.test(o.colors[k])) colors[k] = o.colors[k]; });
      if (typeof o.colors.head === 'string' && SF.icons && SF.icons.ICONS[o.colors.head]) colors.head = o.colors.head;
    }
    return {
      name: String(o.name || 'Freund').replace(/[<>&"']/g, '').slice(0, 16) || 'Freund',
      fig: SF.figure.valid(o.fig) || SF.figure.DEFAULT,
      type: t, hp: maxHp, maxHp,
      cannons: Math.round(lim(o.cannons, 0, SF.ships.byId[t].cannons, 0)),
      speed: lim(o.speed, 30, 100, SF.ships.byId[t].speed),
      reloadMul: lim(o.reloadMul, 0.8, 1, 1),
      colors,
    };
  }

  // Schlacht aus Sicht des Gastgebers (player = Gastgeber, enemy = Freund)
  function createBattle(start) {
    const b = SF.battle.create(start.host, start.guest, start.wind, start.seed);
    b.duel = true;
    b.player.colors = start.host.colors;
    b.enemy.colors = start.guest.colors;
    return b;
  }

  // ---------- Schnappschuss ----------

  const packShip = s => [r1(s.x), r1(s.y), r3(s.hx), r3(s.hy), Math.round(s.hp), r1(s.reload.port), r1(s.reload.star)];

  function pack(b, events) {
    return {
      t: 'snap',
      p: packShip(b.player),
      e: packShip(b.enemy),
      balls: b.balls.map(x => [r1(x.x), r1(x.y), x.from === 'player' ? 1 : 0]),
      ev: events.map(e => Object.assign({}, e, { x: r1(e.x || 0), y: r1(e.y || 0) })),
      over: b.over || '',
    };
  }

  const setShip = (s, a) => {
    if (!Array.isArray(a) || a.length < 7) return;
    [s.x, s.y, s.hx, s.hy, s.hp] = a;
    s.reload.port = a[5];
    s.reload.star = a[6];
  };

  // Schnappschuss beim Freund anwenden: Seine Schlacht ist gespiegelt (player = er selbst, enemy = Gastgeber).
  // Gibt die Ereignisse aus seiner Sicht zurück.
  function apply(b, snap) {
    setShip(b.enemy, snap.p);
    setShip(b.player, snap.e);
    b.balls = (snap.balls || []).map(x => ({ x: x[0], y: x[1], from: x[2] ? 'enemy' : 'player' }));
    const swap = side => (side === 'player' ? 'enemy' : side === 'enemy' ? 'player' : side);
    const events = (snap.ev || []).map(e => Object.assign({}, e, { by: swap(e.by), on: swap(e.on) }));
    if (snap.over) b.over = snap.over === 'sunk' ? 'lost' : snap.over === 'lost' ? 'sunk' : snap.over;
    return events;
  }

  // ---------- Lobby ----------

  let pending = null;   // offener Raum bzw. Beitritt (zum Abbrechen)

  function stats() {
    const s = SF.state.stats;
    s.duels = s.duels || 0;
    s.duelWins = s.duelWins || 0;
    return s;
  }

  async function createRoom() {
    const code = SF.net.newCode();
    SF.track('seefahrer-duell');
    const waiting = SF.ui.dialog({
      title: `${SF.icon('swords')} Raum geöffnet`,
      html: `<p>Sag deinem Freund diesen Code:</p><p class="duel-code">${code}</p>
        <p class="muted small">Er tippt in seiner Kajüte auf „Raum beitreten“ und gibt den Code ein. Ihr segelt mit euren eigenen Schiffen –
        es geht nur um die Ehre, niemand verliert etwas.</p><p class="duel-wait">Warte auf deinen Freund …</p>`,
      buttons: [{ label: 'Abbrechen', value: 'cancel' }],
    });
    try {
      pending = await SF.net.host(code, chan => {
        pending = null;
        chan.onMessage(msg => {
          if (!msg || msg.t !== 'hello') return;
          const guest = cleanShip(msg.ship);
          const host = myShip();
          const w = SF.state.wind || { x: 1, y: 0, s: 0.5 };
          const start = { t: 'start', seed: Math.floor(SF.rng.float() * 4294967295), wind: { x: r3(w.x), y: r3(w.y), s: r3(w.s) }, host, guest,
            rec: SF.friends ? SF.friends.myRecord() : null };
          chan.send(start);
          SF.ui.closeDialog('connected');
          SF.battleView.startDuel({ role: 'host', chan, start, me: host, other: guest, rec: msg.rec });
        });
      }, err => {
        SF.ui.closeDialog('error');
        SF.ui.toast(err === 'taken' ? 'Dieser Code ist gerade besetzt – versuch es noch einmal.' : 'Keine Verbindung zum Online-Dienst. Bist du im Internet?', 4000);
      });
    } catch (e) {
      SF.ui.closeDialog('error');
      SF.ui.toast('Keine Verbindung zum Online-Dienst. Bist du im Internet?', 4000);
    }
    const res = await waiting;
    if (res === 'cancel' && pending) { pending.close(); pending = null; }
  }

  async function joinRoom() {
    const res = await SF.ui.dialog({
      title: `${SF.icon('swords')} Raum beitreten`,
      html: '<p>Gib den Code deines Freundes ein:</p>',
      input: true, rows: 1, placeholder: 'z. B. K7QX',
      buttons: [{ label: 'Abbrechen', value: false }, { label: 'Beitreten', value: true, kind: 'primary' }],
    });
    if (!res.value) return;
    const code = SF.net.cleanCode(res.text);
    if (!SF.net.validCode(code)) {
      SF.sound.play('denied');
      SF.ui.toast('Der Code hat 4 Zeichen, z. B. K7QX.');
      return;
    }
    SF.track('seefahrer-duell');
    const waiting = SF.ui.dialog({ title: 'Verbinde …', html: '<p class="duel-wait">Suche den Raum deines Freundes …</p>', buttons: [{ label: 'Abbrechen', value: 'cancel' }] });
    try {
      pending = await SF.net.join(code, chan => {
        pending = null;
        chan.onMessage(msg => {
          if (!msg || msg.t !== 'start') return;
          const start = { seed: msg.seed >>> 0, wind: msg.wind, host: cleanShip(msg.host), guest: myShip() };
          SF.ui.closeDialog('connected');
          SF.battleView.startDuel({ role: 'guest', chan, start, me: start.guest, other: start.host, rec: msg.rec });
        });
        chan.send({ t: 'hello', ship: myShip(), rec: SF.friends ? SF.friends.myRecord() : null });
      }, err => {
        SF.ui.closeDialog('error');
        SF.ui.toast(err === 'notfound' ? 'Kein Raum mit diesem Code gefunden.' : 'Keine Verbindung zum Online-Dienst. Bist du im Internet?', 4000);
      });
    } catch (e) {
      SF.ui.closeDialog('error');
      SF.ui.toast('Keine Verbindung zum Online-Dienst. Bist du im Internet?', 4000);
    }
    const r = await waiting;
    if (r === 'cancel' && pending) { pending.close(); pending = null; }
  }

  SF.duel = { SNAP_EVERY, INPUT_EVERY, myShip, cleanShip, createBattle, pack, apply, stats, createRoom, joinRoom };
})();
