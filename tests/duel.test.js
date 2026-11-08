// Tests für die Online-Seeschlacht: zweites Schiff von einem Menschen gesteuert, kein Fliehen, Schnappschuss
// (Gastgeber → Freund, gespiegelt), Schutz vor kaputten Angaben, Raum-Codes und die lokale Verbindung (zwei Tabs).
const { assert, load } = require('./setup');
load('format', 'state', 'rank', 'figure', 'ships', 'battle', 'crew', 'cosmetics', 'net', 'duel');
const D = SF.duel;
SF.state = SF.createDefaultState();
SF.state.captain = { name: 'Gastgeberin', fig: '3.0.0.0.1.4.4' };

const start = {
  seed: 4242, wind: { x: 1, y: 0, s: 0.4 },
  host: D.cleanShip({ name: 'Anna', type: 'frigate', maxHp: 130, cannons: 6, speed: 68, colors: { sail: '#c0392b' } }),
  guest: D.cleanShip({ name: 'Ben', type: 'brig', maxHp: 90, cannons: 4, speed: 60 }),
};

// ---------- Das zweite Schiff steuert ein Mensch ----------
{
  const b = D.createBattle(start);
  assert(b.duel && b.player.colors.sail === '#c0392b', 'Duell-Schlacht mit Farben des Gastgebers');
  const e = b.enemy;
  const h0 = [e.hx, e.hy];
  for (let i = 0; i < 60; i++) SF.battle.step(b, 1 / 30, {}, {});
  assert(Math.abs(e.hx - h0[0]) < 1e-9 && Math.abs(e.hy - h0[1]) < 1e-9, 'Ohne Eingabe fährt der Freund geradeaus (kein Computer)');
  for (let i = 0; i < 90; i++) SF.battle.step(b, 1 / 30, {}, { tx: e.x, ty: e.y + 500 });
  assert(e.hy > 0.9, 'Der Freund lenkt sein Schiff');
  const ev = SF.battle.step(b, 1 / 30, {}, { fire: 'port' });
  assert(ev.some(x => x.type === 'fire' && x.by === 'enemy'), 'Der Freund feuert');
  b.player.x = 61; b.enemy.x = 1700;
  SF.battle.step(b, 1 / 30, { tx: -100, ty: b.player.y }, {});
  assert(!b.over, 'Im Duell kann man nicht fliehen');
  b.enemy.hp = 0;
  SF.battle.step(b, 1 / 30, {}, {});
  assert(b.over === 'sunk', 'Gastgeber gewinnt, wenn der Freund sinkt');
}

// ---------- Schnappschuss: Gastgeber → Freund (gespiegelt) ----------
{
  const host = D.createBattle(start);
  for (let i = 0; i < 30; i++) SF.battle.step(host, 1 / 30, { tx: 900, ty: 300 }, { tx: 400, ty: 800 });
  const ev = SF.battle.step(host, 1 / 30, { fire: 'star' }, {});
  const snap = JSON.parse(JSON.stringify(D.pack(host, ev)));
  const guest = D.createBattle({ seed: start.seed, wind: start.wind, host: start.guest, guest: start.host });
  const gev = D.apply(guest, snap);
  assert(Math.abs(guest.player.x - host.enemy.x) < 0.1 && Math.abs(guest.enemy.y - host.player.y) < 0.1, 'Freund sieht sich selbst als „player“');
  assert(guest.balls.length === host.balls.length && guest.balls.every(x => x.from === 'enemy'), 'Kugeln des Gastgebers kommen beim Freund vom Gegner');
  assert(gev.some(x => x.type === 'fire' && x.by === 'enemy'), 'Ereignisse aus Sicht des Freundes');
  assert(JSON.stringify(snap).length < 2000, `Schnappschuss ist klein (${JSON.stringify(snap).length} Zeichen)`);
  host.over = 'sunk';
  D.apply(guest, D.pack(host, []));
  assert(guest.over === 'lost', 'Gastgeber gewinnt = Freund verliert');
  host.over = 'lost';
  guest.over = '';
  D.apply(guest, D.pack(host, []));
  assert(guest.over === 'sunk', 'Gastgeber verliert = Freund gewinnt');
}

// ---------- Kaputte oder freche Angaben ----------
{
  const c = D.cleanShip({ name: '<b>Hacker</b>"', type: 'kanonenboot', maxHp: 99999, cannons: 50, speed: 9999, reloadMul: 0.01,
    colors: { sail: 'url(javascript:alert(1))', head: 'gibt-es-nicht', hull: '#123456' }, fig: '99.99' });
  assert(c.type === 'sloop' && c.maxHp === 400 && c.cannons === 2 && c.speed === 100 && c.reloadMul === 0.8, 'Werte werden begrenzt');
  assert(!/[<>"]/.test(c.name) && !c.colors.sail && !c.colors.head && c.colors.hull === '#123456', 'Name und Farben bereinigt');
  assert(c.fig === SF.figure.DEFAULT, 'Kaputte Figur → Standard');
  assert(D.cleanShip(null).name === 'Freund', 'Gar nichts → Freund mit Schaluppe');
  const me = D.myShip();
  assert(me.hp === me.maxHp && me.name === 'Gastgeberin', 'Im Duell immer mit heilem Rumpf');
}

// ---------- Raum-Codes ----------
{
  for (let i = 0; i < 50; i++) {
    const code = SF.net.newCode();
    assert(SF.net.validCode(code) && !/[01OI]/.test(code), 'Code ohne verwechselbare Zeichen');
  }
  assert(SF.net.cleanCode(' k7-qx ') === 'K7QX' && SF.net.validCode('K7QX'), 'Code eintippen: Kleinbuchstaben und Striche egal');
  assert(!SF.net.validCode('K7Q') && !SF.net.validCode('K7Q0'), 'Zu kurz oder mit 0: ungültig');
}

// ---------- Lokale Verbindung (zwei Tabs, hier: zwei Kanäle im selben Programm) ----------
(async () => {
  if (typeof BroadcastChannel === 'undefined') { assert(true, 'BroadcastChannel fehlt – übersprungen'); return; }
  window.SF_DUEL_LOCAL = true;
  const got = [];
  let hostChan = null;
  let guestChan = null;
  const h = await SF.net.host('TEST', ch => { hostChan = ch; ch.onMessage(m => got.push(['host', m])); }, () => {});
  await SF.net.join('TEST', ch => { guestChan = ch; ch.onMessage(m => got.push(['guest', m])); }, () => got.push(['fehler']));
  await new Promise(r => setTimeout(r, 200));
  assert(hostChan && guestChan, 'Gastgeber und Freund verbunden');
  if (hostChan && guestChan) {
    guestChan.send({ t: 'hello' });
    hostChan.send({ t: 'start' });
    await new Promise(r => setTimeout(r, 100));
    assert(got.some(([w, m]) => w === 'host' && m.t === 'hello') && got.some(([w, m]) => w === 'guest' && m.t === 'start'), 'Nachrichten in beide Richtungen');
    let gone = false;
    hostChan.onClose(() => { gone = true; });
    guestChan.close();
    await new Promise(r => setTimeout(r, 100));
    assert(gone, 'Verlässt der Freund den Raum, merkt es der Gastgeber');
    hostChan.close();
  }
  void h;
})();
