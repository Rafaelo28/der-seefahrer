// Spielstand aus Gamble Klicker übernehmen – NUR LESEN, niemals ändern oder löschen!
// Beide Spiele liegen unter rafaelo28.github.io und teilen sich den Speicher im Browser: der Spielstand liegt dort
// unter „gamble-klicker-save“ (JSON). Wer Gamble Klicker als App vom Home-Bildschirm spielt, hat einen eigenen
// Speicher und fügt stattdessen den Export-Code ein (Base64 aus UTF-8-JSON, GK.exportSave).
// Übernommen wird nur eine kleine Zusammenfassung (Name, Figur, Rang, Dublonen, Bosse, Schiffe, Schatzkarten).
window.SF = window.SF || {};

(function () {
  const KEY = 'gamble-klicker-save';

  // Schiffe der Flotte in Gamble Klicker (gleiche IDs wie js/ships.js)
  const GK_SHIPS = [
    { id: 'sloop', name: 'Schaluppe' },
    { id: 'brig', name: 'Brigg' },
    { id: 'frigate', name: 'Fregatte' },
    { id: 'galleon', name: 'Galeone' },
    { id: 'ghost', name: 'Geisterschiff' },
  ];

  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const finite = (v, fallback = 0) => (typeof v === 'number' && isFinite(v) ? v : fallback);

  // Sieht das aus wie ein Gamble-Klicker-Spielstand?
  function looksLikeGK(data) {
    return isObj(data) && data.game !== 'der-seefahrer' && typeof data.money === 'number' && isFinite(data.money) &&
      ('allTimeEarned' in data || 'totalEarned' in data || 'buildings' in data || 'casino' in data);
  }

  // Aus dem gemeinsamen Speicher lesen (nur getItem!)
  function readLocal() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return looksLikeGK(data) ? data : null;
    } catch (e) {
      return null;
    }
  }

  // Export-Code aus Gamble Klicker lesen: Daten oder null
  function readCode(text) {
    const data = SF.fromCode(text);
    return looksLikeGK(data) ? data : null;
  }

  function cleanName(name) {
    return String(name || '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  }

  // Boss-Trophäen: jede zehnte Stufe ein großer Boss, abwechselnd Kraken-König und Seedrache
  function trophies(level) {
    const big = Math.floor(level / 10);
    return { kraken: Math.ceil(big / 2), dragon: Math.floor(big / 2), monsters: level - big };
  }

  // Kleine Zusammenfassung für den eigenen Spielstand
  function summarize(data, source) {
    if (!looksLikeGK(data)) return null;
    const player = isObj(data.player) ? data.player : {};
    const money = Math.max(0, finite(data.money));
    // „insgesamt verdient“ kann in sehr alten Spielständen fehlen oder (als Unendlich) null sein
    let earned = data.allTimeEarned === null ? Number.MAX_VALUE : finite(data.allTimeEarned, NaN);
    if (!isFinite(earned)) earned = Math.max(money, finite(data.totalEarned));
    const boss = isObj(data.boss) && Number.isInteger(data.boss.level) && data.boss.level > 0 ? Math.min(data.boss.level, 1e6) : 0;
    const fleet = isObj(data.fleet) && isObj(data.fleet.ships) ? data.fleet.ships : {};
    const prestige = isObj(data.prestige) ? data.prestige : {};
    return {
      name: cleanName(player.name),
      fig: SF.figure ? SF.figure.valid(player.fig) : '',
      money,
      earned,
      rank: SF.rank.of(earned),
      bossLevel: boss,
      ships: GK_SHIPS.filter(x => finite(fleet[x.id]) > 0).map(x => x.id),
      maps: Math.max(0, finite(prestige.points)),
      journeys: Math.max(0, Math.floor(finite(prestige.journeys))),
      source: source === 'code' ? 'code' : 'auto',
      importedAt: Date.now(),
    };
  }

  const shipName = id => (GK_SHIPS.find(x => x.id === id) || { name: id }).name;

  SF.gk = { KEY, GK_SHIPS, looksLikeGK, readLocal, readCode, summarize, trophies, shipName };
})();
