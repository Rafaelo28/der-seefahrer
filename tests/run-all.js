// Führt alle Tests (tests/*.test.js außer dem Browser-Test) nacheinander mit node aus.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && f !== 'browser.test.js').sort();
let bad = 0;
for (const f of files) {
  try {
    process.stdout.write(execFileSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8' }));
  } catch (e) {
    bad++;
    process.stdout.write((e.stdout || '') + (e.stderr || ''));
  }
}
console.log(bad ? `\n${bad} Testdatei(en) mit Fehlern` : `\nAlle ${files.length} Testdateien grün`);
process.exitCode = bad ? 1 : 0;
