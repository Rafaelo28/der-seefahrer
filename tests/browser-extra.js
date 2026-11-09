// Zusätzliche Browser-Prüfungen (wird von tests/browser.test.js aufgerufen): Seekarte, Kurs, Hafen, Kneipe, Kajüte.
const fs = require('fs');
const path = require('path');

module.exports = async function (page, label, assert, shot) {
  const noScroll = async where => {
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(over <= 0, `${label} ${where}: kein seitliches Scrollen (${over} px)`);
  };

  // Seekarte
  await page.waitForSelector('#screen-sea:not([hidden])');
  await page.waitForTimeout(500);
  await shot(page, `seekarte-${label}`);
  const start = await page.evaluate(() => ({ x: SF.state.pos.x, y: SF.state.pos.y }));
  // Antippen aufs Wasser rechts vom Schiff: Kurs dorthin
  const target = await page.evaluate(() => {
    const p = SF.state.pos;
    for (let d = 300; d > 60; d -= 20) {
      for (const [dx, dy] of [[1, 0], [0, -1], [1, -1], [0, 1], [-1, 0]]) {
        const x = p.x + dx * d, y = p.y + dy * d;
        if (SF.world.segmentClear(p.x, p.y, x, y)) return SF.sea.toScreen(x, y);
      }
    }
    return null;
  });
  assert(!!target, `${label}: freies Wasser zum Antippen`);
  if (target) {
    await page.mouse.click(target.x, target.y);
    assert(await page.evaluate(() => SF.state.course.length >= 2), `${label}: Antippen setzt einen Kurs`);
    await page.waitForTimeout(1500);
    const moved = await page.evaluate(s => Math.hypot(SF.state.pos.x - s.x, SF.state.pos.y - s.y), start);
    assert(moved > 20, `${label}: Schiff segelt (${Math.round(moved)})`);
  }
  // Kurs vom Schiff aus mit dem Finger zeichnen
  const drawn = await page.evaluate(() => {
    const p = SF.state.pos;
    const a = SF.sea.toScreen(p.x, p.y);
    return a;
  });
  await page.mouse.move(drawn.x, drawn.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(drawn.x + i * 12, drawn.y - i * 6);
  await page.mouse.up();
  assert(await page.evaluate(() => SF.state.course.length >= 2), `${label}: Kurs mit dem Finger gezeichnet`);
  await page.click('#sea-zoom-out');
  await page.click('#sea-zoom-in');
  await shot(page, `seekarte-kurs-${label}`);
  await noScroll('Seekarte');

  // Zur Bernsteinbucht „beamen“ und anlegen
  await page.evaluate(() => {
    const p = SF.world.placeById.amberbay;
    SF.state.pos.x = p.x;
    SF.state.pos.y = p.y;
    SF.state.course = [];
  });
  await page.waitForSelector('#sea-dock:not([hidden])', { timeout: 3000 });
  await page.click('#sea-dock');
  await page.waitForSelector('#screen-harbor:not([hidden])');
  assert((await page.textContent('#harbor-name')) === 'Bernsteinbucht', `${label}: im Hafen Bernsteinbucht`);
  // Story-Ziel: gleich in der Kneipe
  assert(await page.evaluate(() => document.querySelector('.harbor-tab.active').dataset.tab === 'tavern'), `${label}: Kneipe offen (Story)`);
  await shot(page, `kneipe-${label}`);
  await page.click('[data-act="frieda-thanks"]');
  assert(await page.evaluate(() => SF.state.story.step === 'find-smuggler'), `${label}: Frieda schickt zur Schmugglerinsel`);
  await noScroll('Kneipe');

  // Markt: Fisch kaufen, Tuch verkaufen
  await page.click('.harbor-tab[data-tab="market"]');
  const amber0 = await page.evaluate(() => SF.state.amber);
  await page.click('[data-sell="cloth"]');
  const amber1 = await page.evaluate(() => SF.state.amber);
  assert(amber1 > amber0, `${label}: Tuch verkauft (${amber0} → ${amber1})`);
  await page.click('[data-buy="fish"]');
  assert(await page.evaluate(() => SF.state.cargo.fish === 1), `${label}: Fisch gekauft`);
  await shot(page, `markt-${label}`);
  await noScroll('Markt');
  await page.click('.harbor-tab[data-tab="food"]');
  await page.click('[data-food="99"]');
  assert(await page.evaluate(() => SF.state.food > 3), `${label}: Proviant aufgefüllt`);
  await page.click('.harbor-tab[data-tab="yard"]');
  await shot(page, `werft-${label}`);
  await noScroll('Werft');

  // Kajüte
  await page.click('#harbor-cabin');
  await page.waitForSelector('#screen-cabin:not([hidden])');
  await shot(page, `kajuete-${label}`);
  await noScroll('Kajüte');
  await page.click('#cabin-back');
  await page.waitForSelector('#screen-harbor:not([hidden])');

  // Ablegen
  await page.click('#harbor-leave');
  await page.waitForSelector('#screen-sea:not([hidden])');
  await page.waitForTimeout(300);
  assert(await page.evaluate(() => SF.state.docked === ''), `${label}: abgelegt`);

  // Seeschlacht: ein Pirat taucht direkt neben dem Schiff auf
  await page.evaluate(() => {
    const p = SF.pirates.spawn(SF.pirates.ZONES[0]);
    p.kind = 'shark';
    p.x = SF.state.pos.x + 30;
    p.y = SF.state.pos.y;
  });
  await page.waitForSelector('#dialog-layer .btn-primary', { timeout: 4000 });
  await shot(page, `pirat-${label}`);
  await page.click('#dialog-layer .btn-primary');
  await page.waitForSelector('#screen-battle:not([hidden])');
  await page.waitForTimeout(300);
  const portrait = await page.evaluate(() => innerHeight > innerWidth);
  if (portrait) {
    assert(await page.isVisible('#bt-rotate-ok'), `${label}: Hinweis „Bitte quer drehen“`);
    await page.click('#bt-rotate-ok');
  }
  // steuern und feuern
  await page.mouse.move(300, 200);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  // Gegner genau an Steuerbord: Knopf und Bereich leuchten, oben steht „Feuer frei“
  await page.evaluate(() => {
    const b = SF.battleView.current();
    const n = SF.battle.sideNormal(b.player, 'star');
    b.enemy.x = b.player.x + n.x * 250;
    b.enemy.y = b.player.y + n.y * 250;
    b.enemy.speed = 0;
    b.player.speed = 0;
    b.enemy.delay = 999;
  });
  await page.waitForSelector('#bt-star.ready', { timeout: 3000 });
  assert(!(await page.$('#bt-port.ready')) && (await page.textContent('#bt-info')).includes('Steuerbord'), `${label}: Steuerbord-Knopf leuchtet, wenn der Gegner davor liegt`);
  await shot(page, `zielen-${label}`);
  // Am Rand und Gegner weit weg: Knopf „Fliehen“ – aber kein automatisches Entkommen
  assert(await page.isHidden('#bt-flee'), `${label}: mitten im Kampf kein Knopf „Fliehen“`);
  await page.evaluate(() => {
    const b = SF.battleView.current();
    b.player.x = 70; b.player.y = 550;
    b.enemy.x = 900; b.enemy.y = 550;
  });
  await page.waitForSelector('#bt-flee:not([hidden])', { timeout: 3000 });
  await page.waitForTimeout(400);
  assert(await page.evaluate(() => !SF.battleView.current().over), `${label}: am Rand kein automatisches Entkommen`);
  await shot(page, `fliehen-${label}`);
  await page.evaluate(() => {
    const b = SF.battleView.current();
    b.player.x = 700; b.player.y = 550;
    b.enemy.x = 950; b.enemy.y = 550;
  });
  await page.waitForSelector('#bt-flee', { state: 'hidden', timeout: 3000 });
  await page.dispatchEvent('#bt-port', 'pointerdown');
  await page.dispatchEvent('#bt-star', 'pointerdown');
  await page.waitForTimeout(700);
  await shot(page, `schlacht-${label}`);
  await noScroll('Schlacht');
  assert(await page.evaluate(() => SF.battleView.current() && SF.battleView.current().t > 0.5), `${label}: Schlacht läuft`);
  // Gegner schwer beschädigt und nah: entern
  await page.evaluate(() => {
    const b = SF.battleView.current();
    b.enemy.hp = 10;
    b.enemy.x = b.player.x + 100;
    b.enemy.y = b.player.y;
    b.enemy.speed = 0;
    b.player.speed = 0;
    b.enemy.delay = 999; // nicht mehr schießen
    b.balls = [];        // fliegende Kugeln weg (sonst versinkt der Gegner vor dem Entern)
  });
  await page.waitForSelector('#bt-board:not([hidden])', { timeout: 3000 });
  await page.click('#bt-board', { force: true }); // der Knopf pulsiert (Animation)
  await page.waitForSelector('#screen-boarding:not([hidden])');
  await page.dispatchEvent('#bd-right', 'pointerdown');
  await page.waitForTimeout(700);
  await page.dispatchEvent('#bd-right', 'pointerup');
  await shot(page, `entern-${label}`);
  await noScroll('Entern');
  const amberB = await page.evaluate(() => SF.state.amber);
  // direkt vor die Tür der Kajüte
  await page.evaluate(() => {
    const L = SF.boarding._level();
    L.p.x = L.door.x - 10;
    L.p.y = L.door.y + 30;
  });
  await page.waitForSelector('#dialog-layer h2', { timeout: 4000 });
  assert((await page.textContent('#dialog-layer h2')).includes('Geentert'), `${label}: geentert`);
  await shot(page, `beute-${label}`);
  await page.click('#dialog-layer .btn-primary');
  await page.waitForSelector('#screen-sea:not([hidden])');
  assert(await page.evaluate(a => SF.state.amber >= a + 70 && SF.state.stats.wins === 1, amberB), `${label}: Kopfgeld bekommen`);

  // Insel: an der Nahen Bucht an Land gehen
  await page.evaluate(() => { const p = SF.world.placeById.bay; SF.state.pos.x = p.x; SF.state.pos.y = p.y; SF.state.course = []; });
  await page.waitForSelector('#sea-land:not([hidden])', { timeout: 3000 });
  await page.click('#sea-land');
  await page.waitForSelector('#screen-island:not([hidden])');
  await page.dispatchEvent('#is-right', 'pointerdown');
  await page.waitForTimeout(900);
  await page.dispatchEvent('#is-right', 'pointerup');
  await shot(page, `insel-${label}`);
  await noScroll('Insel');
  await page.evaluate(() => { const L = SF.island._level(); L.p.x = L.chest.x; L.p.y = L.chest.y - 4; });
  await page.waitForSelector('#dialog-layer h2', { timeout: 4000 });
  assert((await page.textContent('#dialog-layer h2')).includes('Schatz'), `${label}: Schatz auf der Insel`);
  await page.click('#dialog-layer .btn-primary');
  await page.waitForSelector('#screen-sea:not([hidden])');

  // Tauchen am Korallenriff
  await page.evaluate(() => { const p = SF.world.placeById.reef; SF.state.pos.x = p.x; SF.state.pos.y = p.y; SF.state.course = []; });
  await page.waitForSelector('#sea-dive:not([hidden])', { timeout: 3000 });
  await page.click('#sea-dive');
  await page.waitForSelector('#screen-dive:not([hidden])');
  await page.evaluate(() => { const D = SF.dive._state(); D.y = 900; D.pearls = 2; });
  await page.waitForTimeout(600);
  await shot(page, `tauchen-${label}`);
  await noScroll('Tauchen');
  await page.evaluate(() => { const D = SF.dive._state(); D.t = 5; D.y = 40; });
  await page.waitForSelector('#dialog-layer h2', { timeout: 4000 });
  await page.click('#dialog-layer .btn-primary');
  await page.waitForSelector('#screen-sea:not([hidden])');
  assert(await page.evaluate(() => SF.state.pearls >= 2), `${label}: Perlen an Bord`);

  // Laden: rote Segel für Perlen
  await page.evaluate(() => { SF.state.pearls = 10; SF.harbor.open('dublone'); });
  await page.waitForSelector('#screen-harbor:not([hidden])');
  await page.click('.harbor-tab[data-tab="shop"]');
  await page.click('[data-cos="sail-red"]');
  assert(await page.evaluate(() => SF.state.pearls === 4 && SF.cosmetics.data().on.sail === 'sail-red'), `${label}: rote Segel gekauft`);
  await shot(page, `laden-${label}`);
  await noScroll('Laden');

  // Kapitel 2: Smutje Fiete in Port Dublone
  await page.evaluate(() => { SF.state.story.step = 'hire-cook'; SF.harbor.open('dublone'); });
  await page.waitForSelector('[data-act="fiete-join"]');
  await shot(page, `fiete-${label}`);
  await page.click('[data-act="fiete-join"]');
  assert(await page.evaluate(() => SF.crew.has('fiete') && SF.state.story.step === 'find-ice'), `${label}: Fiete an Bord`);
  // Eismeer: an Land gehen, Schatz und Galeone
  await page.click('#harbor-leave');
  await page.waitForSelector('#screen-sea:not([hidden])');
  await page.evaluate(() => { const p = SF.world.placeById.ice; SF.state.pos.x = p.x; SF.state.pos.y = p.y; SF.state.course = []; SF.state.pirates = []; });
  await page.waitForSelector('#sea-land:not([hidden])', { timeout: 3000 });
  await page.click('#sea-land');
  await page.waitForSelector('#screen-island:not([hidden])');
  await page.waitForTimeout(400);
  await shot(page, `eismeer-${label}`);
  await page.evaluate(() => { const L = SF.island._level(); L.p.x = L.chest.x; L.p.y = L.chest.y - 4; });
  await page.waitForSelector('#dialog-layer h2', { timeout: 4000 });
  assert((await page.textContent('#dialog-layer')).includes('Long John'), `${label}: Logbuch von Long John`);
  await page.click('#dialog-layer .btn-primary');
  await page.waitForSelector('#screen-sea:not([hidden])');
  // Umsteigen auf die Galeone in der Werft
  // (heute schon bestohlen: kein Fenster „Schiffskasse“ beim Umsteigen)
  await page.evaluate(() => { SF.state.cargo = {}; SF.state.story.flags.theftDay = SF.trade.day(); SF.state.story.flags.thefts = 1; SF.harbor.open('dublone'); });
  await page.click('.harbor-tab[data-tab="yard"]');
  await page.click('[data-swap="0"]');
  assert(await page.evaluate(() => SF.state.ship.type === 'galleon'), `${label}: auf die Galeone umgestiegen`);
  await shot(page, `flotte-${label}`);
  await page.click('#harbor-cabin');
  await page.waitForSelector('#screen-cabin:not([hidden])');
  assert((await page.textContent('#cabin-body')).includes('Smutje Fiete'), `${label}: Fiete in der Kajüte`);
  await shot(page, `crew-${label}`);
  await noScroll('Kajüte mit Crew');

  // Kapitel 3: Die Schiffskasse wird geplündert, Anklage in der Kajüte
  await page.evaluate(() => { SF.state.story.step = 'traitor'; SF.state.amber = 300; SF.state.seaTime += 999; SF.harbor.open('amberbay'); });
  await page.waitForSelector('#dialog-layer h2', { timeout: 3000 });
  assert((await page.textContent('#dialog-layer')).includes('Schiffskasse'), `${label}: Bernstein fehlt`);
  await page.click('#dialog-layer .btn-primary');
  await page.click('#harbor-cabin');
  await page.waitForSelector('[data-accuse="fiete"]');
  await shot(page, `verraeter-${label}`);
  await noScroll('Verräter');
  await page.click('[data-accuse="fiete"]');
  await page.click('#dialog-layer .btn-primary'); // „Anklagen“ trotz weniger Hinweise
  await page.waitForSelector('#dialog-layer h2');
  assert((await page.textContent('#dialog-layer h2')).includes('Erwischt'), `${label}: Fiete erwischt`);
  await page.click('#dialog-layer .btn-primary');
  assert(await page.evaluate(() => SF.state.story.step === 'find-dragon' && !SF.crew.has('fiete')), `${label}: weiter zur Drachenküste`);

  // Finale: der Fliegende Holländer im Nebelmeer
  await page.click('#cabin-back');
  await page.waitForSelector('#screen-harbor:not([hidden])');
  await page.click('#harbor-leave');
  await page.waitForSelector('#screen-sea:not([hidden])');
  await page.evaluate(() => { SF.state.story.step = 'finale'; SF.state.pirates = []; const m = SF.world.placeById.mist; SF.state.pos.x = m.x - 100; SF.state.pos.y = m.y; SF.state.course = []; });
  await page.waitForSelector('#dialog-layer h2', { timeout: 4000 });
  assert((await page.textContent('#dialog-layer h2')).includes('Holländer'), `${label}: der Holländer taucht auf`);
  await shot(page, `hollaender-${label}`);
  await page.click('#dialog-layer .btn-primary');
  await page.waitForSelector('#screen-battle:not([hidden])');
  await page.waitForTimeout(300);
  if (await page.isVisible('#bt-rotate-ok')) await page.click('#bt-rotate-ok');
  await page.evaluate(() => { const b = SF.battleView.current(); b.enemy.hp = 20; b.enemy.x = b.player.x + 100; b.enemy.y = b.player.y; b.enemy.speed = 0; b.player.speed = 0; b.enemy.delay = 999; b.balls = []; });
  await page.waitForTimeout(400);
  await shot(page, `hollaender-schlacht-${label}`);
  await page.waitForSelector('#bt-board:not([hidden])', { timeout: 3000 });
  await page.click('#bt-board', { force: true });
  await page.waitForSelector('#screen-boarding:not([hidden])');
  await page.waitForTimeout(500);
  await shot(page, `long-john-${label}`);
  await page.evaluate(() => { const L = SF.boarding._level(); L.enemies.forEach(e => { e.alive = false; }); L.p.x = L.door.x - 10; L.p.y = L.door.y + 30; });
  // Ende: Bildergeschichte, dann Abspann
  await page.waitForSelector('#screen-story:not([hidden])', { timeout: 5000 });
  await page.waitForTimeout(400);
  await shot(page, `ende-${label}`);
  assert(await page.evaluate(() => SF.state.story.step === 'done' && SF.crew.fleet().some(f => f.type === 'ghost')), `${label}: durchgespielt, Geisterschiff in der Flotte`);
  await page.click('#story-skip');
  await page.waitForSelector('#screen-credits:not([hidden])');
  await page.waitForTimeout(3000);
  await shot(page, `abspann-${label}`);
  await noScroll('Abspann');
  await page.click('#credits-done');
  await page.waitForSelector('#screen-sea:not([hidden])');
};
