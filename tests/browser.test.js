// Browser-Test mit Playwright (Chromium ist vorinstalliert): iPad hoch und quer, keine Konsolenfehler, kein
// seitliches Scrollen, Prolog bis aufs Meer durchspielen – einmal ohne und einmal mit Gamble-Klicker-Spielstand.
// Ausführen mit: node tests/browser.test.js   (Bildschirmfotos landen in tests/shots/, wenn SHOTS=1 gesetzt ist)
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHOTS = process.env.SHOTS ? path.join(__dirname, 'shots') : '';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };

let failed = 0;
let passed = 0;
function assert(cond, msg) {
  if (cond) passed++;
  else { failed++; console.log('FEHLER:', msg); }
}

// Kleiner Server für die Spieldateien (wie GitHub Pages: alles statisch)
function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Gamble-Klicker-Spielstand wie im echten Spiel (gekürzt)
const GK_SAVE = {
  version: 1, money: 7.3e45, totalEarned: 1e46, allTimeEarned: 2.5e47, buildings: { finger: 10 }, casino: { games: {} },
  player: { name: 'Pork-Kapitän', avatar: '🐸', fig: '3.0.0.0.1.4.4', figOn: true },
  boss: { level: 37, kills: 40, fights: 50 }, fleet: { ships: { sloop: 5, brig: 3, frigate: 1 }, voyages: {} },
  prestige: { points: 7e6, journeys: 12 },
};

async function checkPage(page, label) {
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(scroll <= 0, `${label}: kein seitliches Scrollen (${scroll} px zu breit)`);
}

async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
}

async function run(browser, base, device, landscape, withGK) {
  const label = `${landscape ? 'quer' : 'hoch'}${withGK ? ' mit GK' : ''}`;
  const opts = Object.assign({}, devices['iPad (gen 7)']);
  if (landscape) opts.viewport = { width: opts.viewport.height, height: opts.viewport.width };
  const context = await browser.newContext(opts);
  // Nichts von außen laden (Schriften, Zählung) – der Test soll ohne Internet laufen
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.fulfill({ status: 200, body: '' }));
  if (withGK) {
    await context.addInitScript(save => {
      if (!localStorage.getItem('gamble-klicker-save')) localStorage.setItem('gamble-klicker-save', save);
    }, JSON.stringify(GK_SAVE));
  }
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto(base + '/index.html');
  await page.waitForSelector('#screen-title:not([hidden])');
  await checkPage(page, label + ' Titel');
  await shot(page, `titel-${label}`);

  // Neues Abenteuer
  await page.click('#title-new');
  await page.waitForSelector('#ng-import:not([hidden])');
  if (withGK) {
    assert(await page.isVisible('.gk-card'), `${label}: Gamble-Klicker-Spielstand wird gezeigt`);
    assert((await page.textContent('.gk-card')).includes('Pork-Kapitän'), `${label}: Name aus Gamble Klicker`);
    await shot(page, `uebernahme-${label}`);
    await page.click('[data-act="take"]');
    assert((await page.inputValue('#ng-name')) === 'Pork-Kapitän', `${label}: Name übernommen`);
  } else {
    await shot(page, `uebernahme-${label}`);
    await page.click('[data-act="none"]');
    await page.fill('#ng-name', 'Testkapitän');
  }
  await page.waitForSelector('#ng-captain:not([hidden])');
  await page.click('#ng-slots [data-slot="1"][data-dir="1"]');
  await checkPage(page, label + ' Kapitän');
  await shot(page, `kapitaen-${label}`);
  await page.click('#ng-start');

  // Prolog: zwei Bilder anschauen, dann überspringen
  await page.waitForSelector('#screen-story:not([hidden])');
  await page.waitForTimeout(400);
  await shot(page, `prolog-1-${label}`);
  await page.click('#story-next');
  await page.click('#story-next');
  await page.click('#story-next');
  await shot(page, `prolog-4-${label}`);
  await checkPage(page, label + ' Prolog');
  await page.click('#story-skip');

  // Der letzte Tag der Dublone
  await page.waitForSelector('#screen-lastday:not([hidden])');
  await page.click('#ld-go');
  await page.click('.ld-item[data-id="frigate"]');
  for (let i = 0; i < 3; i++) await page.click('.ld-item[data-id="cannon"]');
  for (let i = 0; i < 4; i++) await page.click('.ld-item[data-id="food"]');
  for (let i = 0; i < 3; i++) await page.click('.ld-item[data-id="cloth"]');
  await page.waitForTimeout(300);
  await shot(page, `letzter-tag-${label}`);
  await checkPage(page, label + ' Laden');
  const ship = await page.evaluate(() => SF.ships && document.querySelector('#ld-myship').textContent);
  assert(ship && ship.includes('Fregatte'), `${label}: Fregatte gekauft (${ship})`);
  await page.click('#ld-done');
  await page.click('#dialog-layer .btn-primary');
  await page.waitForSelector('#ld-result:not([hidden])');
  await shot(page, `ergebnis-${label}`);
  await page.click('#ld-result-next');

  // Abend und Ablegen
  await page.waitForSelector('#screen-story:not([hidden])');
  await shot(page, `abend-${label}`);
  await page.click('#story-skip');
  const state = await page.evaluate(() => ({ ship: SF.state.ship.type, cannons: SF.state.ship.cannons, cloth: SF.state.cargo.cloth, amber: SF.state.amber, step: SF.state.story.step }));
  assert(state.ship === 'frigate' && state.cannons === 3 && state.cloth === 3, `${label}: Ausrüstung im Spielstand ${JSON.stringify(state)}`);
  assert(state.amber === (withGK ? 55 : 30), `${label}: Bernstein nach dem Umtausch (${state.amber})`);
  assert(state.step === 'find-amberbay', `${label}: Story-Schritt ${state.step}`);
  await page.waitForTimeout(300);
  await shot(page, `see-${label}`);
  await checkPage(page, label + ' See');

  // Neu laden: Spielstand bleibt, Weiterspielen führt zurück
  await page.reload();
  await page.waitForSelector('#title-continue:not([hidden])');
  await page.click('#title-continue');
  await page.waitForTimeout(300);
  assert(await page.evaluate(() => SF.state.started && SF.state.ship.type === 'frigate'), `${label}: Spielstand nach Neuladen`);

  if (withGK) {
    const gk = await page.evaluate(() => localStorage.getItem('gamble-klicker-save'));
    assert(gk === JSON.stringify(GK_SAVE), `${label}: Gamble-Klicker-Spielstand unverändert`);
  }
  if (SF_EXTRA) await SF_EXTRA(page, label, assert, shot);
  assert(errors.length === 0, `${label}: keine Konsolenfehler ${errors.join(' | ')}`);
  await context.close();
}

// Platz für weitere Prüfungen späterer Schritte (Seekarte, Hafen)
let SF_EXTRA = null;
try { SF_EXTRA = require('./browser-extra.js'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; SF_EXTRA = null; }

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    for (const landscape of [false, true]) {
      for (const withGK of [false, true]) await run(browser, base, 'iPad (gen 7)', landscape, withGK);
    }
  } catch (e) {
    failed++;
    console.log('FEHLER: Ablauf abgebrochen:', e.message);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`browser.test.js: ${passed} bestanden${failed ? `, ${failed} FEHLGESCHLAGEN` : ''}`);
  process.exitCode = failed ? 1 : 0;
})();
