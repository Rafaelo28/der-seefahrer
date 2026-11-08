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
};
