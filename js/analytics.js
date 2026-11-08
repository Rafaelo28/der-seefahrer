// Anonyme Besucherzählung mit GoatCounter (wie bei Gamble Klicker, gleiche Auswertungsseite, Pfad /der-seefahrer/).
// Gezählt werden Seitenaufrufe und Ereignisse wie „seefahrer-prolog“ – ohne Cookies und ohne persönliche Daten.
// Niemals Namen, Raum-Codes, Spieler-IDs oder Spielstände mitsenden! Lokal geöffnet wird nichts gezählt.
window.SF = window.SF || {};

(function () {
  const ENDPOINT = 'https://gamble-klicker.goatcounter.com/count';
  // Feste Version mit Prüfsumme: der Browser führt das Skript nur aus, wenn es genau diese Datei ist
  const SCRIPT = 'https://gc.zgo.at/count.v5.js';
  const INTEGRITY = 'sha384-atnOLvQb9t+jTSipvd75X2yginT4PjVbqDdlJAmxMm+wYElFmeR6EmLP5bYeoRVQ';
  const local = location.protocol === 'file:' || /^(localhost|127\.|10\.|192\.168\.|\[::1\])/.test(location.hostname);
  const seen = new Set();
  const queue = [];
  let loaded = false;

  function send(vars) {
    try {
      window.goatcounter.count(Object.assign({ referrer: r => String(r || '').split('?')[0] }, vars));
    } catch (e) {
      // Zählen ist nicht wichtig genug für eine Fehlermeldung
    }
  }

  function count(vars) {
    if (loaded) send(vars);
    else queue.push(vars);
  }

  // Ereignis zählen – jedes höchstens einmal pro Besuch
  SF.track = function (path, title) {
    if (local || seen.has(path)) return;
    seen.add(path);
    count({ path, title: title || path, event: true });
  };

  if (local) return;
  const countPage = () => {
    if (document.visibilityState === 'hidden') {
      document.addEventListener('visibilitychange', countPage, { once: true });
      return;
    }
    count({ path: location.pathname, title: 'Der Seefahrer' });
  };
  document.addEventListener('DOMContentLoaded', () => setTimeout(countPage, 0));

  window.goatcounter = { no_onload: true };
  const script = document.createElement('script');
  script.async = true;
  script.src = SCRIPT;
  script.integrity = INTEGRITY;
  script.crossOrigin = 'anonymous';
  script.dataset.goatcounter = ENDPOINT;
  script.onload = () => {
    loaded = true;
    queue.splice(0).forEach(send);
  };
  document.head.appendChild(script);
})();
