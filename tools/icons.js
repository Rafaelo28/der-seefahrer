// Webseiten-Icons erzeugen: node tools/icons.js
// Rendert die Vorlagen icons/icon.svg (iPad-Startbildschirm, App) und icons/favicon.svg (Browser-Tab)
// mit Playwright in die PNG-Größen, die index.html und manifest.webmanifest brauchen.
// Nur nötig, wenn sich eine der beiden SVG-Dateien ändert – das Spiel selbst braucht keinen Build-Schritt.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIR = path.join(__dirname, '..', 'icons');
const JOBS = [
  { svg: 'icon.svg', out: 'icon-180.png', size: 180 },
  { svg: 'icon.svg', out: 'icon-192.png', size: 192 },
  { svg: 'icon.svg', out: 'icon-512.png', size: 512 },
  { svg: 'favicon.svg', out: 'favicon-32.png', size: 32, clear: true },
];

(async () => {
  const browser = await chromium.launch();
  for (const job of JOBS) {
    const data = fs.readFileSync(path.join(DIR, job.svg)).toString('base64');
    const page = await browser.newPage({ viewport: { width: job.size, height: job.size }, deviceScaleFactor: 1 });
    await page.setContent(`<html><body style="margin:0;background:transparent">
      <img src="data:image/svg+xml;base64,${data}" width="${job.size}" height="${job.size}" style="display:block"></body></html>`);
    await page.waitForFunction(() => document.images[0].complete);
    await page.screenshot({ path: path.join(DIR, job.out), omitBackground: !!job.clear });
    await page.close();
    console.log('  ' + job.out);
  }
  await browser.close();
})();
