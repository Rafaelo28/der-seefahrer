// Piraten auf der Seekarte: Computer-Piraten mit Kopfgeld kreuzen in ihren Gebieten (nicht rund um Port Dublone),
// jagen das Schiff, wenn sie es sehen, und greifen an. Nach der Schlacht: Beute, Kopfgeld oder Verlust
// (nie „Game Over“). Besiegte Piraten tauchen nach einer Weile woanders in ihrem Gebiet wieder auf.
window.SF = window.SF || {};

(function () {
  // Gegnertypen: Schiff, Rumpf, Kanonen, Zielgenauigkeit (Streuung), Zögern vor dem Schuss, Tempo, Kopfgeld, Ladung
  const KINDS = {
    raider: { name: 'Seeräuber', ship: 'sloop', hp: 50, cannons: 2, aim: 0.12, delay: 0.8, speed: 50, bounty: 30, cargo: 2,
      sail: '#3a3a3a', names: ['Rattenzahn-Rudi', 'Krumme Kalle', 'Grätenfrieda', 'Schrubber-Sepp', 'Flossen-Fiete'] },
    shark: { name: 'Hai-Pirat', ship: 'brig', hp: 90, cannons: 4, aim: 0.08, delay: 0.55, speed: 54, bounty: 70, cargo: 4,
      sail: '#7a1f1f', names: ['Haifisch-Hein', 'Säbel-Svenja', 'Eisenhaken-Ole'] },
    bluebeard: { name: 'Käpt’n Blaubart', ship: 'frigate', hp: 150, cannons: 6, aim: 0.05, delay: 0.35, speed: 60, bounty: 160, cargo: 6,
      sail: '#1f3a7a', names: ['Käpt’n Blaubart'], boss: true },
    // Finale: der Fliegende Holländer (Long Johns Geisterschiff) – sinkt nicht, man muss ihn entern
    dutchman: { name: 'Der Fliegende Holländer', ship: 'ghost', hp: 240, cannons: 8, aim: 0.05, delay: 0.3, speed: 66, bounty: 300, cargo: 0,
      sail: '#9ab8d8', names: ['Der Fliegende Holländer'], boss: true, noSink: true },
  };

  // Gebiete: Mittelpunkt, Radius, welche Piraten, wie viele gleichzeitig
  const ZONES = [
    { id: 'smugglers', x: 2250, y: 1500, r: 420, kinds: ['raider', 'raider', 'shark'], max: 2 },
    { id: 'reef', x: 1620, y: 2060, r: 330, kinds: ['raider'], max: 1 },
    { id: 'north', x: 2350, y: 650, r: 400, kinds: ['raider', 'shark'], max: 2 },
    { id: 'west', x: 380, y: 2000, r: 330, kinds: ['raider', 'shark'], max: 1 },
    { id: 'dragon', x: 2750, y: 1950, r: 380, kinds: ['bluebeard'], max: 1 },
  ];

  const SIGHT = 280;       // so weit sehen Piraten
  const ENCOUNTER = 70;    // so nah = Angriff
  const COOLDOWN = 25;     // Sekunden Ruhe nach Flucht oder Niederlage
  const SAFE = 650;        // so weit um Port Dublone kommen keine Piraten hin
  const RESPAWN = 150;     // Sekunden auf See, bis ein besiegter Pirat ersetzt wird

  const st = () => SF.state;
  let nextId = 1;

  function list() {
    const s = st();
    if (!Array.isArray(s.pirates)) s.pirates = [];
    return s.pirates;
  }

  // Zufälliger Punkt im Wasser eines Gebiets (weit genug weg vom Schiff)
  function spot(zone, awayFrom) {
    const home = SF.world.START;
    for (let i = 0; i < 80; i++) {
      const x = zone.x + (SF.rng.float() * 2 - 1) * zone.r;
      const y = zone.y + (SF.rng.float() * 2 - 1) * zone.r;
      if ((x - zone.x) * (x - zone.x) + (y - zone.y) * (y - zone.y) > zone.r * zone.r) continue;
      if ((x - home.x) * (x - home.x) + (y - home.y) * (y - home.y) < SAFE * SAFE) continue;
      if (!SF.world.isWater(x, y, SF.world.PLAN_PAD)) continue;
      if (awayFrom && (x - awayFrom.x) * (x - awayFrom.x) + (y - awayFrom.y) * (y - awayFrom.y) < 500 * 500) continue;
      return { x: Math.round(x), y: Math.round(y) };
    }
    return null;
  }

  function spawn(zone) {
    const kind = SF.rng.pick(zone.kinds);
    const k = KINDS[kind];
    const p = spot(zone, st().pos);
    if (!p) return null;
    const pirate = { id: nextId++ + '-' + Math.floor(SF.rng.float() * 1e6), kind, zone: zone.id, name: SF.rng.pick(k.names), x: p.x, y: p.y, tx: p.x, ty: p.y, dx: 1, dy: 0, cool: 0 };
    list().push(pirate);
    return pirate;
  }

  // Gebiete auffüllen (besiegte Piraten werden nach RESPAWN Sekunden ersetzt)
  function refill() {
    const s = st();
    if (!s.pirateClock || typeof s.pirateClock !== 'object') s.pirateClock = {};
    ZONES.forEach(z => {
      const here = list().filter(p => p.zone === z.id).length;
      if (here >= z.max) return;
      const due = s.pirateClock[z.id] || 0;
      if (s.seaTime < due) return;
      if (spawn(z)) s.pirateClock[z.id] = s.seaTime + (here + 1 < z.max ? 20 : 0);
    });
  }

  // Piraten bewegen; gibt einen Piraten zurück, der jetzt angreift (oder null)
  function step(dt) {
    const s = st();
    if (!s.pos) return null;
    refill();
    let attacker = null;
    for (const p of list()) {
      const k = KINDS[p.kind];
      p.cool = Math.max(0, (p.cool || 0) - dt);
      const ddx = s.pos.x - p.x;
      const ddy = s.pos.y - p.y;
      const d2 = ddx * ddx + ddy * ddy;
      const zone = ZONES.find(z => z.id === p.zone);
      let speed = k.speed * 0.6;
      if (d2 < SIGHT * SIGHT && !p.cool && !s.docked) {
        p.tx = s.pos.x; // jagen
        p.ty = s.pos.y;
        speed = k.speed * 0.85;
      } else if ((p.tx - p.x) * (p.tx - p.x) + (p.ty - p.y) * (p.ty - p.y) < 400) {
        const t = spot(zone);
        if (t) { p.tx = t.x; p.ty = t.y; }
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        const nx = p.x + dx / dist * Math.min(dist, speed * dt);
        const ny = p.y + dy / dist * Math.min(dist, speed * dt);
        if (SF.world.isWater(nx, ny)) {
          p.x = nx;
          p.y = ny;
          p.dx += (dx / dist - p.dx) * Math.min(1, dt * 3);
          p.dy += (dy / dist - p.dy) * Math.min(1, dt * 3);
          const l = Math.sqrt(p.dx * p.dx + p.dy * p.dy) || 1;
          p.dx /= l;
          p.dy /= l;
        } else {
          const t = spot(zone); // Land im Weg: neues Ziel
          if (t) { p.tx = t.x; p.ty = t.y; }
        }
      }
      if (!attacker && !p.cool && !s.docked && d2 < ENCOUNTER * ENCOUNTER) attacker = p;
    }
    return attacker;
  }

  // Gegner-Angaben für die Schlacht
  function enemyFor(p) {
    const k = KINDS[p.kind];
    const hard = SF.state.hard ? 1.5 : 1; // Schwer-Modus: stärkere Gegner
    const hp = Math.round(k.hp * hard);
    return { type: k.ship, hp, maxHp: hp, cannons: k.cannons, aim: k.aim / hard, delay: k.delay / hard, speed: k.speed, colors: { sail: k.sail }, noSink: !!k.noSink };
  }

  // Ergebnis der Schlacht anwenden; gibt eine Beschreibung zurück
  // loot: was man beim Entern auf dem Deck geplündert hat ({ amber, chests }, js/boarding.js) – ohne Angabe gibt es
  // die Ladung des Piraten wie früher pauschal
  function resolve(p, result, playerHp, loot) {
    const s = st();
    const k = KINDS[p.kind];
    const out = { result, amber: 0, bounty: 0, looted: 0, chests: 0, cargo: {}, lost: {}, lostAmber: 0, harbor: '' };
    s.ship.hp = Math.max(1, Math.round(playerHp));
    s.stats.battles = (s.stats.battles || 0) + 1;
    if (result === 'sunk' || result === 'boarded') {
      const i = list().indexOf(p);
      if (i >= 0) list().splice(i, 1);
      s.pirateClock = s.pirateClock || {};
      if (p.zone) s.pirateClock[p.zone] = s.seaTime + RESPAWN;
      s.stats.wins = (s.stats.wins || 0) + 1;
      if (result === 'boarded') {
        out.bounty = SF.amber.add(k.bounty);
        out.looted = loot && loot.amber > 0 ? SF.amber.add(Math.min(200, Math.round(loot.amber))) : 0;
        out.amber = out.bounty + out.looted;
        out.chests = loot ? Math.max(0, Math.min(12, Math.round(loot.chests) || 0)) : 0;
        // Ladung der Piraten (eine Kiste je Schatzkiste), so viel in den Laderaum passt
        const crates = loot ? out.chests : k.cargo;
        for (let i = 0; i < crates && SF.ships.freeHold() > 0; i++) {
          const g = SF.rng.pick(SF.trade.GOODS).id;
          s.cargo[g] = (s.cargo[g] || 0) + 1;
          out.cargo[g] = (out.cargo[g] || 0) + 1;
        }
      } else {
        out.amber = SF.amber.add(Math.round(k.bounty / 2)); // Kopfgeld halb: das Schiff ist versunken
      }
      s.stats.bounty = (s.stats.bounty || 0) + out.amber;
      if (k.boss) s.story.flags['beat-' + p.kind] = (s.story.flags['beat-' + p.kind] || 0) + 1;
    } else if (result === 'lost') {
      // Die Hälfte der Ladung und etwas Bernstein sind weg, das Schiff wird in den nächsten Hafen geschleppt
      Object.keys(s.cargo).forEach(g => {
        const n = Math.floor(s.cargo[g] / 2);
        if (n > 0) {
          s.cargo[g] -= n;
          out.lost[g] = n;
          if (!s.cargo[g]) delete s.cargo[g];
        }
      });
      out.lostAmber = Math.min(50, Math.floor(s.amber * 0.1));
      SF.amber.spend(out.lostAmber);
      s.ship.hp = Math.max(1, Math.round(maxHp() * 0.25));
      const harbor = nearestHarbor();
      s.pos = Object.assign(s.pos, { x: harbor.x, y: harbor.y });
      s.course = [];
      out.harbor = harbor.id;
      p.cool = COOLDOWN;
    } else {
      p.cool = COOLDOWN; // geflohen
    }
    return out;
  }

  const maxHp = () => SF.battle.maxHull();

  function nearestHarbor() {
    const s = st();
    let best = SF.world.START;
    let bd = Infinity;
    SF.world.PLACES.forEach(pl => {
      if (!pl.harbor) return;
      const d = (pl.x - s.pos.x) * (pl.x - s.pos.x) + (pl.y - s.pos.y) * (pl.y - s.pos.y);
      if (d < bd) { bd = d; best = pl; }
    });
    return best;
  }

  SF.pirates = { KINDS, ZONES, SIGHT, ENCOUNTER, COOLDOWN, RESPAWN, list, spawn, refill, step, enemyFor, resolve, nearestHarbor };
})();
