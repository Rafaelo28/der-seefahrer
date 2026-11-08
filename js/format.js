// Zahlen- und Zeitformate (deutsche Schreibweise) und Anzeigen, die nur bei Änderung geschrieben werden.
// Teilweise aus Gamble Klicker übernommen (js/format.js).
window.SF = window.SF || {};

(function () {
  // Große Zahlen (lange Skala) für die alten Dublonen im Prolog: kurz und ausgeschrieben
  const BIG_UNITS = [
    { value: 1e63, short: 'Dezd.', one: 'Dezilliarde', many: 'Dezilliarden' },
    { value: 1e60, short: 'Dez.', one: 'Dezillion', many: 'Dezillionen' },
    { value: 1e57, short: 'Nond.', one: 'Nonilliarde', many: 'Nonilliarden' },
    { value: 1e54, short: 'Non.', one: 'Nonillion', many: 'Nonillionen' },
    { value: 1e51, short: 'Oktd.', one: 'Oktilliarde', many: 'Oktilliarden' },
    { value: 1e48, short: 'Okt.', one: 'Oktillion', many: 'Oktillionen' },
    { value: 1e45, short: 'Septd.', one: 'Septilliarde', many: 'Septilliarden' },
    { value: 1e42, short: 'Sept.', one: 'Septillion', many: 'Septillionen' },
    { value: 1e39, short: 'Sextd.', one: 'Sextilliarde', many: 'Sextilliarden' },
    { value: 1e36, short: 'Sext.', one: 'Sextillion', many: 'Sextillionen' },
    { value: 1e33, short: 'Quintd.', one: 'Quintilliarde', many: 'Quintilliarden' },
    { value: 1e30, short: 'Quint.', one: 'Quintillion', many: 'Quintillionen' },
    { value: 1e27, short: 'Quadrd.', one: 'Quadrilliarde', many: 'Quadrilliarden' },
    { value: 1e24, short: 'Quadr.', one: 'Quadrillion', many: 'Quadrillionen' },
    { value: 1e21, short: 'Trd.', one: 'Trilliarde', many: 'Trilliarden' },
    { value: 1e18, short: 'Trio.', one: 'Trillion', many: 'Trillionen' },
    { value: 1e15, short: 'Brd.', one: 'Billiarde', many: 'Billiarden' },
    { value: 1e12, short: 'Bio.', one: 'Billion', many: 'Billionen' },
    { value: 1e9, short: 'Mrd.', one: 'Milliarde', many: 'Milliarden' },
    { value: 1e6, short: 'Mio.', one: 'Million', many: 'Millionen' },
  ];

  const intFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  const bigFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const longFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

  // 1.234 / 12,35 Mio. / 7,00 Septd. – geschütztes Leerzeichen, damit nichts umbricht
  SF.formatNumber = function (n) {
    if (!isFinite(n)) return '∞';
    const abs = Math.abs(n);
    for (const unit of BIG_UNITS) {
      if (abs >= unit.value) return bigFormat.format(n / unit.value) + ' ' + unit.short;
    }
    return intFormat.format(Math.floor(n));
  };

  // Ausgeschrieben für die Geschichte: „1,5 Sextilliarden“, „eine Billion“, „12.000“
  SF.formatLong = function (n) {
    if (!isFinite(n)) return 'unendlich viele';
    const abs = Math.abs(n);
    for (const unit of BIG_UNITS) {
      if (abs >= unit.value) {
        const q = n / unit.value;
        if (q >= 1000) break; // über der größten Einheit: Zehnerpotenz
        const text = longFormat.format(q);
        return text === '1' ? 'eine ' + unit.one : text + ' ' + unit.many;
      }
    }
    if (abs >= 1e66) return '10^' + Math.floor(Math.log10(abs));
    return intFormat.format(Math.floor(n));
  };

  // Kleine Zahlen (Bernstein, Waren): immer ganze Zahlen mit Tausenderpunkt
  SF.formatInt = n => intFormat.format(Math.round(n));

  // Dezimalzahl auf Deutsch, Formate zwischengespeichert (toLocaleString legt sonst jedes Mal neue an)
  const decimalFormats = {};
  SF.formatDecimal = function (n, minDigits, maxDigits) {
    const key = minDigits + '|' + maxDigits;
    const f = decimalFormats[key] || (decimalFormats[key] = new Intl.NumberFormat('de-DE', { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits }));
    return f.format(n);
  };

  // Zeitspanne: „45 s“, „3 min“, „2 h 05 min“
  SF.formatDuration = function (seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    if (seconds < 60) return seconds + ' s';
    const m = Math.floor(seconds / 60);
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min';
  };

  // Bernstein mit Symbol (als HTML)
  SF.AMBER = '<i class="amber" aria-hidden="true"></i>';
  SF.amberHTML = n => `<span class="money">${SF.formatInt(n)} ${SF.AMBER}</span>`;
  SF.DUBLONE = '<i class="dublone" aria-hidden="true"></i>';
  SF.dublonenHTML = n => `<span class="money">${SF.formatNumber(n)} ${SF.DUBLONE}</span>`;

  // Inhalt nur schreiben, wenn er sich ändert (spart Layout und Neuzeichnen auf dem iPad).
  // Wer ein Element so pflegt, schreibt es immer über SF.setHTML.
  SF.setHTML = function (el, html) {
    if (el && el._html !== html) {
      el.innerHTML = html;
      el._html = html;
    }
  };

  SF.setText = function (el, text) {
    text = String(text);
    if (el && el.textContent !== text) el.textContent = text;
  };

  // Text für HTML sicher machen (Namen aus Spielständen!)
  SF.escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Zufall, für Tests austauschbar
  SF.rng = {
    float: () => Math.random(),
    int(n) { return Math.floor(SF.rng.float() * n); },
    pick(list) { return list[SF.rng.int(list.length)]; },
  };
})();
