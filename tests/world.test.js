// Tests für die Welt: Orte liegen im Wasser und sind erreichbar, Land/Wasser, Nebel der Karte, Wegsuche.
const { assert, load } = require('./setup');
load('format', 'state', 'world');
const Wo = SF.world;

// ---------- Orte ----------
{
  assert(Wo.PLACES.length === 11, '11 Orte: 3 Häfen, die Ziele aus Gamble Klicker, Bernsteinfestung, Nebelmeer und Bermuda-Dreieck');
  ['bay', 'reef', 'smuggler', 'volcano', 'ice', 'dragon'].forEach(id => assert(Wo.placeById[id] && Wo.placeById[id].gk, `Ziel aus Gamble Klicker: ${id}`));
  assert(Wo.PLACES.filter(p => p.harbor).length === 3, 'Drei Häfen');
  Wo.PLACES.forEach(p => {
    assert(Wo.isWater(p.x, p.y), `${p.name} liegt im Wasser (${p.x}, ${p.y})`);
    assert(Wo.isLand(p.x, p.y, 90) || p.id === 'ice' || p.id === 'reef' || p.open, `${p.name} liegt an einer Küste`);
  });
  assert(Wo.placeNear(Wo.START.x + 20, Wo.START.y - 10).id === 'dublone', 'Ort in der Nähe finden');
  assert(Wo.placeNear(1600, 1500, 50) === null, 'Kein Ort in der Nähe');
}

// ---------- Wegsuche: alle Orte von Port Dublone aus erreichbar ----------
{
  const s = Wo.START;
  Wo.PLACES.forEach(p => {
    if (p === s) return;
    const r = Wo.route(s.x, s.y, p.x, p.y);
    assert(r && r.length >= 2, `Weg nach ${p.name}`);
    if (!r) return;
    let x = s.x, y = s.y, len = 0;
    let ok = true;
    for (let i = 0; i < r.length; i += 2) {
      if (!Wo.segmentClear(x, y, r[i], r[i + 1])) ok = false;
      len += Math.hypot(r[i] - x, r[i + 1] - y);
      x = r[i];
      y = r[i + 1];
    }
    assert(ok, `Weg nach ${p.name} geht nicht über Land`);
    assert(x === p.x && y === p.y, `Weg endet am Ort ${p.name}`);
    assert(len < Math.hypot(p.x - s.x, p.y - s.y) * 1.6, `Weg nach ${p.name} ist kein Umweg (${Math.round(len)})`);
  });
  assert(Wo.route(s.x, s.y, 700, 1350) === null || true, 'Ziel an Land: kein Absturz');
}

// ---------- Land und Wasser ----------
{
  assert(Wo.isLand(700, 1350), 'Mitte der Dublonen-Insel ist Land');
  assert(!Wo.isWater(5, 500) && !Wo.isWater(1600, Wo.H - 2), 'Rand der Welt ist kein Wasser');
  const free = Wo.lastFree(Wo.START.x, Wo.START.y, 700, 1350);
  assert(free.blocked && Wo.isWater(free.x, free.y), 'Strecke auf Land endet an der Küste');
  assert(!Wo.lastFree(Wo.START.x, Wo.START.y, Wo.START.x + 100, Wo.START.y).blocked, 'Freie Strecke');
}

// ---------- Nebel ----------
{
  Wo.fogFromString('');
  assert(!Wo.knownAt(Wo.START.x, Wo.START.y) && Wo.explored() === 0, 'Am Anfang ist die Karte leer');
  const v = Wo.fogVersion();
  const n = Wo.reveal(Wo.START.x, Wo.START.y);
  assert(n > 100 && Wo.knownAt(Wo.START.x, Wo.START.y) && Wo.fogVersion() > v, `Rund ums Schiff aufgedeckt (${n} Felder)`);
  assert(!Wo.knownAt(Wo.START.x + 400, Wo.START.y), 'Weiter weg noch unbekannt');
  assert(Wo.reveal(Wo.START.x, Wo.START.y) === 0, 'Zweites Mal: nichts Neues');
  const text = Wo.fogToString();
  Wo.fogFromString('');
  assert(!Wo.knownAt(Wo.START.x, Wo.START.y), 'Leeren');
  assert(Wo.fogFromString(text) && Wo.knownAt(Wo.START.x, Wo.START.y), 'Aus Text wiederhergestellt');
  assert(!Wo.fogFromString('%%%') && Wo.explored() === 0, 'Kaputter Text: leere Karte');
  Wo.reveal(-500, -500);
  Wo.reveal(99999, 99999);
  assert(true, 'Aufdecken außerhalb der Welt stürzt nicht ab');
}
