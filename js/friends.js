// Freunde (Stufe 5): Rangliste und Flaschenpost.
// Rangliste: Bei jeder Online-Seeschlacht tauschen beide ihre Rekorde aus (Duell-Siege, Bestzeiten der Inseln,
// Geheimnisse, Titel) – die Kajüte zeigt eine kleine Rangliste mit allen Freunden, gegen die man gesegelt ist.
// Flaschenpost: Bernstein oder Perlen mit einer Nachricht als Code verschicken – Beute teilen wie die Likedeeler.
// Wer verschickt, gibt es sofort ab; jede Flasche lässt sich pro Spielstand nur einmal öffnen.
window.SF = window.SF || {};

(function () {
  const MAX_FRIENDS = 20;
  const MAX_AMBER = 200;
  const MAX_PEARLS = 20;
  const MAX_TEXT = 80;
  const ISLES = ['bay', 'volcano', 'ice', 'dragon'];

  const clean = t => String(t || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim();

  // ---------- Rangliste ----------

  // Eigene Rekorde (werden beim Duell mitgeschickt)
  function myRecord() {
    const s = SF.state;
    const best = {};
    ISLES.forEach(id => { const r = (s.islands || {})[id]; if (r && r.best) best[id] = r.best; });
    return {
      name: clean(s.captain.name).slice(0, 16) || 'Kapitän',
      fig: SF.figure.mine(),
      title: s.gk ? SF.rank.title(s.gk.rank) : 'Landratte',
      wins: s.stats.duelWins || 0,
      duels: s.stats.duels || 0,
      best,
      secrets: SF.finale ? SF.finale.percent() : 0,
      done: SF.story.reached('done'),
    };
  }

  // Rekord vom Freund prüfen
  function cleanRecord(r) {
    r = r && typeof r === 'object' ? r : {};
    const num = (v, max) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.min(max, v) : 0);
    const best = {};
    ISLES.forEach(id => { const v = r.best && r.best[id]; if (typeof v === 'number' && v > 1 && v < 999) best[id] = Math.round(v * 10) / 10; });
    return {
      name: clean(r.name).slice(0, 16) || 'Freund',
      fig: SF.figure.valid(r.fig) || SF.figure.DEFAULT,
      title: clean(r.title).slice(0, 32),
      wins: Math.floor(num(r.wins, 1e6)),
      duels: Math.floor(num(r.duels, 1e6)),
      best,
      secrets: Math.round(num(r.secrets, 100)),
      done: !!r.done,
    };
  }

  function list() {
    const s = SF.state;
    if (!s.friends || typeof s.friends !== 'object' || Array.isArray(s.friends)) s.friends = {};
    return s.friends;
  }

  // Rekord eines Freundes speichern (nach Name); result: 'won' | 'lost' | '' (Duell gegen ihn)
  function remember(rec, result) {
    const r = cleanRecord(rec);
    const key = r.name.toLowerCase();
    const old = list()[key] || {};
    r.vsWon = (old.vsWon || 0) + (result === 'won' ? 1 : 0);
    r.vsLost = (old.vsLost || 0) + (result === 'lost' ? 1 : 0);
    r.seen = Date.now();
    list()[key] = r;
    // nur die letzten MAX_FRIENDS behalten
    const keys = Object.keys(list()).sort((a, b) => list()[b].seen - list()[a].seen);
    keys.slice(MAX_FRIENDS).forEach(k => delete list()[k]);
    return r;
  }

  // Rangliste: ich und alle Freunde, sortiert nach Duell-Siegen, dann Geheimnissen
  function board() {
    const me = Object.assign(myRecord(), { me: true });
    return [me].concat(Object.values(list())).sort((a, b) => b.wins - a.wins || b.secrets - a.secrets || a.name.localeCompare(b.name));
  }

  // ---------- Flaschenpost ----------

  function bottles() {
    const s = SF.state;
    if (!s.bottles || typeof s.bottles !== 'object' || Array.isArray(s.bottles)) s.bottles = {};
    if (!Array.isArray(s.bottles.opened)) s.bottles.opened = [];
    return s.bottles;
  }

  // Kleine Prüfsumme, damit vertippte Codes auffallen (kein Schutz gegen Absicht – es ist Spielgeld)
  function sum(o) {
    const t = `${o.id}|${o.from}|${o.amber}|${o.pearls}|${o.text}`;
    let h = 7;
    for (let i = 0; i < t.length; i++) h = (Math.imul(h, 31) + t.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  // Flaschenpost schreiben: gibt den Code zurück oder einen Fehlertext ({ code } | { error })
  function write(amber, pearls, text) {
    const s = SF.state;
    amber = Math.floor(Number(amber) || 0);
    pearls = Math.floor(Number(pearls) || 0);
    if (amber < 0 || pearls < 0 || amber > MAX_AMBER || pearls > MAX_PEARLS) return { error: `Höchstens ${MAX_AMBER} Bernstein und ${MAX_PEARLS} Perlen pro Flasche.` };
    if (!amber && !pearls && !clean(text)) return { error: 'Eine leere Flasche? Leg etwas hinein oder schreib eine Nachricht.' };
    if (s.amber < amber) return { error: 'So viel Bernstein hast du nicht.' };
    if ((s.pearls || 0) < pearls) return { error: 'So viele Perlen hast du nicht.' };
    if (amber) SF.amber.spend(amber);
    if (pearls) s.pearls -= pearls;
    const o = { bottle: 1, id: Date.now().toString(36) + SF.rng.int(1e9).toString(36), from: clean(s.captain.name).slice(0, 16) || 'Kapitän', amber, pearls, text: clean(text).slice(0, MAX_TEXT) };
    o.sum = sum(o);
    s.stats.bottlesSent = (s.stats.bottlesSent || 0) + 1;
    return { code: 'FP' + SF.toCode(o) };
  }

  // Flaschenpost öffnen: { ok, from, amber, pearls, text } oder { error }
  function open(code) {
    const raw = String(code || '').replace(/\s+/g, '');
    const o = raw.startsWith('FP') ? SF.fromCode(raw.slice(2)) : null;
    if (!o || o.bottle !== 1 || typeof o.id !== 'string' || o.sum !== sum(o)) return { error: 'Das ist keine Flaschenpost – oder der Code ist nicht ganz kopiert.' };
    const amber = Math.floor(Number(o.amber) || 0);
    const pearls = Math.floor(Number(o.pearls) || 0);
    if (amber < 0 || pearls < 0 || amber > MAX_AMBER || pearls > MAX_PEARLS) return { error: 'Mit dieser Flasche stimmt etwas nicht.' };
    const b = bottles();
    if (b.opened.includes(o.id)) return { error: 'Diese Flaschenpost hast du schon geöffnet.' };
    b.opened.push(o.id);
    if (b.opened.length > 200) b.opened.splice(0, b.opened.length - 200);
    if (amber) SF.amber.add(amber);
    if (pearls) { SF.state.pearls = (SF.state.pearls || 0) + pearls; }
    SF.state.stats.bottlesOpened = (SF.state.stats.bottlesOpened || 0) + 1;
    return { ok: true, from: clean(o.from).slice(0, 16) || 'Jemand', amber, pearls, text: clean(o.text).slice(0, MAX_TEXT) };
  }

  SF.friends = { MAX_AMBER, MAX_PEARLS, MAX_TEXT, ISLES, myRecord, cleanRecord, list, remember, board, write, open };
})();
