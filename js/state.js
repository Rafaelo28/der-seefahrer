// Zentraler Spielstand: Standardwerte, Speichern und Laden, Export/Import als Code und Bernstein.
// Neue Felder immer hier mit Standardwert eintragen – dann laden alte Spielstände weiter.
window.SF = window.SF || {};

(function () {
  const SAVE_KEY = 'der-seefahrer-save';
  const SAVE_VERSION = 1;
  const GAME = 'der-seefahrer';

  function createDefaultSettings() {
    const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return { sound: true, volume: 0.7, effects: reduceMotion ? 'reduced' : 'full' };
  }

  // Schiff: Typ und Ausbau in der Werft (Stufen), Anzahl Kanonen
  // hp: Rumpf jetzt (null = heil), hull: Stufe „Rumpf verstärken“
  const createDefaultShip = () => ({ type: 'sloop', sails: 0, hold: 0, pantry: 0, hull: 0, hp: null, cannons: 0 });
  const createDefaultStats = () => ({ distance: 0, trades: 0, profit: 0, flotsam: 0, amberEarned: 0, places: 0, battles: 0, wins: 0, bounty: 0 });
  const createDefaultStory = () => ({ step: 'new', flags: {}, log: [] });

  function createDefaultState() {
    const now = Date.now();
    return {
      game: GAME,
      version: SAVE_VERSION,
      started: false,      // Kapitän angelegt (sonst beginnt das Spiel mit dem Titelbild)
      captain: { name: '', fig: '' },
      gk: null,            // Zusammenfassung des übernommenen Gamble-Klicker-Spielstands (js/gk-import.js)
      story: createDefaultStory(),
      lastDay: null,       // Ergebnis von „Der letzte Tag der Dublone“ (js/lastday.js)
      amber: 0,            // Bernstein (nur über SF.amber bewegen)
      ship: createDefaultShip(),
      food: 0,             // Proviant in Fässern (Kommazahl, wird beim Segeln verbraucht)
      cargo: {},           // Waren an Bord: { fish: 3, rum: 2, … }
      pos: null,           // { x, y, dx, dy } – Position und Fahrtrichtung auf der Karte
      course: [],          // gezeichneter Kurs als flache Liste [x1, y1, x2, y2, …]
      docked: '',          // Hafen, in dem das Schiff liegt ('' = auf See)
      fog: '',             // aufgedeckte Karte (Bitfeld als Base64, js/world.js)
      visited: {},         // { ortId: Zeitpunkt des ersten Besuchs }
      market: {},          // Angebot und Nachfrage: { hafenId: { warenId: Druck } } (js/trade.js)
      wind: null,          // { x, y, s, next } (js/voyage.js)
      seaTime: 0,          // Sekunden auf See (für Tage und Preise)
      flotsam: [],         // Treibgut auf der Karte: [{ x, y, kind }]
      pirates: [],         // Piraten auf der Karte (js/pirates.js)
      pirateClock: {},     // ab wann ein Gebiet wieder einen Piraten bekommt (Sekunden auf See)
      stats: createDefaultStats(),
      settings: createDefaultSettings(),
      ui: { zoom: 1, tips: {} },
      playTime: 0,         // Sekunden
      createdAt: now,
      lastSaved: now,
    };
  }

  function detectStorage() {
    try {
      const testKey = SAVE_KEY + '-test';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  SF.SAVE_KEY = SAVE_KEY;
  SF.createDefaultState = createDefaultState;
  SF.state = createDefaultState();
  SF.storageAvailable = detectStorage();
  SF.onSave = null; // optional: Anzeige „gespeichert“

  // ---------- Bernstein ----------

  SF.amber = {
    get: () => SF.state.amber,
    can: n => SF.state.amber >= n,
    // Gutschreiben (nur ganze, positive Beträge)
    add(n) {
      n = Math.floor(n);
      if (!(n > 0)) return 0;
      SF.state.amber += n;
      SF.state.stats.amberEarned += n;
      return n;
    },
    // Abbuchen; false, wenn es nicht reicht
    spend(n) {
      n = Math.ceil(n);
      if (!(n >= 0) || SF.state.amber < n) return false;
      SF.state.amber -= n;
      return true;
    },
  };

  // ---------- Speichern und Laden ----------

  SF.save = function () {
    if (!SF.storageAvailable) return false;
    SF.state.lastSaved = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(SF.state));
    } catch (e) {
      console.warn('Speichern fehlgeschlagen:', e);
      return false;
    }
    if (SF.onSave) SF.onSave();
    return true;
  };

  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const num = (v, fallback) => (typeof v === 'number' && isFinite(v) ? v : fallback);

  // Ist das ein Spielstand von „Der Seefahrer“? (Gamble-Klicker-Codes erkennt SF.gk)
  function isOurs(data) {
    return isObj(data) && data.game === GAME && typeof data.amber === 'number';
  }

  // Übernimmt geladene Daten; fehlende Felder bekommen Standardwerte
  function applyData(data) {
    if (!isOurs(data)) return false;
    const d = createDefaultState();
    const s = Object.assign(d, data, { version: SAVE_VERSION, game: GAME });
    s.captain = Object.assign({ name: '', fig: '' }, isObj(data.captain) ? data.captain : {});
    s.story = Object.assign(createDefaultStory(), isObj(data.story) ? data.story : {});
    if (!isObj(s.story.flags)) s.story.flags = {};
    if (!Array.isArray(s.story.log)) s.story.log = [];
    s.ship = Object.assign(createDefaultShip(), isObj(data.ship) ? data.ship : {});
    s.stats = Object.assign(createDefaultStats(), isObj(data.stats) ? data.stats : {});
    s.settings = Object.assign(createDefaultSettings(), isObj(data.settings) ? data.settings : {});
    s.ui = Object.assign({ zoom: 1, tips: {} }, isObj(data.ui) ? data.ui : {});
    if (!isObj(s.ui.tips)) s.ui.tips = {};
    ['cargo', 'visited', 'market', 'pirateClock'].forEach(k => { if (!isObj(s[k])) s[k] = {}; });
    ['course', 'flotsam', 'pirates'].forEach(k => { if (!Array.isArray(s[k])) s[k] = []; });
    if (s.ship.hp != null && !(typeof s.ship.hp === 'number' && s.ship.hp > 0)) s.ship.hp = null;
    if (!isObj(s.pos) || !isFinite(s.pos.x) || !isFinite(s.pos.y)) s.pos = null;
    if (!isObj(s.wind)) s.wind = null;
    if (!isObj(s.gk)) s.gk = null;
    if (typeof s.fog !== 'string') s.fog = '';
    if (typeof s.docked !== 'string') s.docked = '';
    s.amber = Math.max(0, Math.floor(num(s.amber, 0)));
    s.food = Math.max(0, num(s.food, 0));
    s.seaTime = Math.max(0, num(s.seaTime, 0));
    s.playTime = Math.max(0, num(s.playTime, 0));
    SF.state = s;
    return true;
  }

  SF.applyData = applyData;

  SF.load = function () {
    if (!SF.storageAvailable) return false;
    let raw = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (e) {
      console.warn('Laden fehlgeschlagen:', e);
    }
    if (!raw) return false;
    try {
      return applyData(JSON.parse(raw));
    } catch (e) {
      console.warn('Spielstand beschädigt, starte neu:', e);
      return false;
    }
  };

  // ---------- Code (Base64 aus UTF-8-JSON, wie bei Gamble Klicker) ----------

  SF.toCode = function (obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    // In Stücken: Safari erlaubt nur begrenzt viele Argumente pro Funktionsaufruf
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  };

  // Liest einen Code; null, wenn er kaputt ist (Leerzeichen und Zeilenumbrüche vom Kopieren werden ignoriert)
  SF.fromCode = function (text) {
    try {
      const clean = String(text || '').replace(/\s+/g, '');
      if (!clean) return null;
      const bytes = Uint8Array.from(atob(clean), c => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) {
      return null;
    }
  };

  SF.exportSave = () => SF.toCode(SF.state);

  // 'ok' | 'gk' (Gamble-Klicker-Code) | 'bad'
  SF.importSave = function (text) {
    const data = SF.fromCode(text);
    if (SF.gk && SF.gk.looksLikeGK(data)) return 'gk';
    if (!applyData(data)) return 'bad';
    SF.save();
    return 'ok';
  };

  SF.resetSave = function () {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {
      // ohne Speicher gibt es nichts zu löschen
    }
    SF.state = createDefaultState();
  };

  // Den Browser bitten, die Daten nicht automatisch zu löschen
  if (SF.storageAvailable && typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
})();
