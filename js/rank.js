// Ränge aus Gamble Klicker (js/rank.js): je 1.000-mal mehr insgesamt verdient ein Rang höher, ohne Ende
// („Legende I, II, III …“). Im Seefahrer wird der alte Rang zum Titel des Kapitäns, z. B. „ehem. Admiral“.
window.SF = window.SF || {};

(function () {
  const NAMED = [
    { icon: '🐀', name: 'Landratte' },
    { icon: '🧹', name: 'Schiffsjunge' },
    { icon: '⚓', name: 'Matrose' },
    { icon: '🪢', name: 'Bootsmann' },
    { icon: '🧭', name: 'Steuermann' },
    { icon: '🗝️', name: 'Quartiermeister' },
    { icon: '🎖️', name: 'Erster Offizier' },
    { icon: '🏴‍☠️', name: 'Kapitän' },
    { icon: '⭐', name: 'Kommodore' },
    { icon: '🌟', name: 'Admiral' },
    { icon: '💫', name: 'Großadmiral' },
    { icon: '👑', name: 'Piratenkönig' },
    { icon: '🔱', name: 'Herrscher der Meere' },
  ];
  const LEGEND = NAMED.length;
  const MAX = 999;

  // Ab wie viel insgesamt verdient gilt Rang r (über „1e…“, damit überall genau dieselbe Zahl herauskommt)
  const threshold = r => Number(`1e${3 * r}`);

  function of(earned) {
    if (!(earned >= 1000)) return 0;
    let r = 0;
    while (r < MAX && earned >= threshold(r + 1)) r++;
    return r;
  }

  function roman(n) {
    const table = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    table.forEach(([v, s]) => { while (n >= v) { out += s; n -= v; } });
    return out;
  }

  const valid = r => (Number.isInteger(r) && r >= 0 && r <= MAX ? r : 0);
  const name = r => (valid(r) < LEGEND ? NAMED[valid(r)].name : `Legende ${roman(valid(r) - LEGEND + 1)}`);
  const icon = r => (valid(r) < LEGEND ? NAMED[valid(r)].icon : '🐉');

  // Titel im Seefahrer: Landratten bleiben Landratten, alle anderen waren mal etwas
  const title = r => (valid(r) >= 1 ? `ehem. ${name(r)}` : 'Landratte');

  SF.rank = { NAMED, LEGEND, MAX, threshold, of, name, icon, valid, title, roman };
})();
