// Was über alle Spielstände hinweg bleibt (eigener Speicher, nicht im Spielstand): z. B. ob das Spiel schon einmal
// durchgespielt wurde – dann gibt es beim neuen Abenteuer den Schwer-Modus.
window.SF = window.SF || {};

(function () {
  const KEY = 'der-seefahrer-meta';
  let cache = null;

  function data() {
    if (cache) return cache;
    cache = {};
    try {
      const raw = localStorage.getItem(KEY);
      const d = raw ? JSON.parse(raw) : null;
      if (d && typeof d === 'object' && !Array.isArray(d)) cache = d;
    } catch (e) {
      cache = {};
    }
    return cache;
  }

  function set(key, value) {
    data()[key] = value;
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch (e) {
      // ohne Speicher gilt es nur für diese Sitzung
    }
  }

  SF.meta = {
    KEY,
    get: key => data()[key],
    set,
    hardUnlocked: () => !!data().finished,
    _reset() { cache = null; },
  };
})();
