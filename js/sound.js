// Soundeffekte – werden live im Browser erzeugt (Web Audio), es gibt keine Sounddateien.
// Bausteine aus Gamble Klicker (js/sound.js) übernommen. iPad/iPhone erlauben Ton erst nach der ersten
// Berührung: unlock() wird dann automatisch aufgerufen.
window.SF = window.SF || {};

(function () {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let unlocked = false;
  const lastPlayed = {};

  // Mindestabstand (ms) zwischen zwei gleichen Sounds, damit es nicht knattert
  const THROTTLE = { tap: 40, coin: 50, tick: 25, page: 120, splash: 120, amber: 60, cannon: 60, hit: 50, hurt: 80, jump: 80 };

  const settings = () => SF.state.settings;

  function ensureContext() {
    if (ctx) return ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.connect(ctx.destination);
    applyVolume();
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  // Muss in einem Tipp aufgerufen werden (Vorgabe von Safari auf dem iPad)
  function unlock() {
    if (!ensureContext()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (unlocked) return;
    unlocked = true;
    const silent = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = silent;
    src.connect(ctx.destination);
    src.start(0);
  }

  function applyVolume() {
    if (master) master.gain.value = settings().sound ? settings().volume * 0.6 : 0;
  }

  // ---------- Bausteine ----------

  function tone(freq, start, duration, opts = {}) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, start + duration);
    const peak = opts.gain || 0.2;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + (opts.attack || 0.005));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  function noise(start, duration, opts = {}) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filter || 'bandpass';
    filter.frequency.setValueAtTime(opts.freq || 2000, start);
    if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(opts.sweepTo, start + duration);
    filter.Q.value = opts.q || 1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(opts.gain || 0.2, start + (opts.attack || 0.005));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter).connect(gain).connect(master);
    src.start(start, Math.random() * 0.5);
    src.stop(start + duration + 0.05);
  }

  function ping(start, pitch = 1, gain = 0.12) {
    tone(1568 * pitch, start, 0.18, { type: 'triangle', gain });
    tone(2637 * pitch, start + 0.02, 0.25, { type: 'sine', gain: gain * 0.7 });
  }

  function jingle(start, duration, count) {
    for (let i = 0; i < count; i++) ping(start + Math.random() * duration, 0.85 + Math.random() * 0.5, 0.05 + Math.random() * 0.06);
  }

  function arpeggio(start, notes, step, opts) {
    notes.forEach((f, i) => tone(f, start + i * step, opts.duration || 0.25, opts));
  }

  // ---------- Die Sounds ----------

  const SOUNDS = {
    tap(t) {
      noise(t, 0.03, { filter: 'highpass', freq: 2500, gain: 0.18 });
    },
    coin(t) {
      ping(t, 1, 0.12);
    },
    buy(t) {
      noise(t, 0.06, { freq: 3500, q: 2, gain: 0.25 });
      tone(1318, t + 0.04, 0.35, { type: 'triangle', gain: 0.12 });
      ping(t + 0.1, 1.2, 0.08);
    },
    sell(t) {
      jingle(t, 0.25, 5);
    },
    denied(t) {
      tone(180, t, 0.12, { type: 'square', gain: 0.06 });
      tone(140, t + 0.1, 0.15, { type: 'square', gain: 0.06 });
    },
    tick(t) {
      noise(t, 0.025, { filter: 'highpass', freq: 3000, gain: 0.12 });
    },
    // Umblättern in der Bildergeschichte
    page(t) {
      noise(t, 0.18, { freq: 1200, sweepTo: 4000, q: 0.6, gain: 0.12 });
    },
    // Preise verdoppeln sich: kurzer Alarm
    alarm(t) {
      tone(660, t, 0.12, { type: 'square', gain: 0.05 });
      tone(880, t + 0.12, 0.16, { type: 'square', gain: 0.05 });
    },
    // Bernstein eingesammelt: warmes Glitzern
    amber(t) {
      tone(988, t, 0.3, { type: 'triangle', gain: 0.1 });
      tone(1480, t + 0.06, 0.35, { type: 'sine', gain: 0.07 });
      tone(1976, t + 0.12, 0.4, { type: 'sine', gain: 0.05 });
    },
    // Etwas aus dem Wasser gefischt
    splash(t) {
      noise(t, 0.35, { freq: 700, sweepTo: 2500, q: 0.5, gain: 0.25 });
    },
    // Hafenglocke
    bell(t) {
      [0, 0.45].forEach(d => {
        tone(660, t + d, 1.4, { type: 'sine', gain: 0.18 });
        tone(1650, t + d, 0.9, { type: 'sine', gain: 0.05 });
        tone(2310, t + d, 0.6, { type: 'sine', gain: 0.03 });
      });
    },
    // Schiffshorn (Ablegen)
    horn(t) {
      tone(147, t, 1.1, { type: 'sawtooth', gain: 0.07 });
      tone(220, t, 1.1, { type: 'sawtooth', gain: 0.05 });
      tone(110, t, 1.1, { type: 'sine', gain: 0.2 });
    },
    // Neuer Ort entdeckt / Story-Schritt
    discover(t) {
      arpeggio(t, [523, 659, 784, 1047, 1319], 0.08, { type: 'triangle', gain: 0.09, duration: 0.4 });
    },
    // Ausbau in der Werft
    upgrade(t) {
      noise(t, 0.08, { freq: 500, q: 1, gain: 0.3 });
      noise(t + 0.18, 0.08, { freq: 500, q: 1, gain: 0.3 });
      arpeggio(t + 0.3, [1047, 1319, 1568, 2093], 0.06, { type: 'triangle', gain: 0.1, duration: 0.3 });
    },
    // Unheimlich (Dieb, Tresor leer)
    sinister(t) {
      tone(110, t, 1.2, { type: 'sawtooth', gain: 0.05, slideTo: 82 });
      tone(116, t, 1.2, { type: 'sawtooth', gain: 0.04, slideTo: 87 });
    },
    // Crew murrt (kein Proviant)
    grumble(t) {
      noise(t, 0.5, { freq: 300, q: 2, gain: 0.25, attack: 0.1 });
      tone(95, t, 0.5, { type: 'sawtooth', gain: 0.03, slideTo: 80 });
    },
    // Kanone feuert
    cannon(t) {
      tone(90, t, 0.35, { type: 'sine', gain: 0.4, slideTo: 40 });
      noise(t, 0.3, { filter: 'lowpass', freq: 900, sweepTo: 200, gain: 0.5 });
    },
    // Treffer beim Gegner: Holz splittert
    hit(t) {
      noise(t, 0.12, { freq: 1800, q: 0.8, gain: 0.35 });
      tone(160, t, 0.18, { type: 'square', gain: 0.06, slideTo: 90 });
    },
    // Treffer am eigenen Schiff: dumpfer Schlag
    hurt(t) {
      tone(70, t, 0.4, { type: 'sine', gain: 0.45, slideTo: 35 });
      noise(t, 0.2, { filter: 'lowpass', freq: 600, gain: 0.4 });
    },
    // Verloren
    lose(t) {
      tone(330, t, 0.25, { type: 'sawtooth', gain: 0.05, slideTo: 220 });
      tone(220, t + 0.22, 0.4, { type: 'sawtooth', gain: 0.05, slideTo: 130 });
    },
    // Springen (Entern)
    jump(t) {
      tone(300, t, 0.15, { type: 'square', gain: 0.05, slideTo: 600 });
    },
    // Fanfare
    fanfare(t) {
      arpeggio(t, [523, 659, 784, 1047], 0.09, { type: 'square', gain: 0.06, duration: 0.3 });
      [784, 1047, 1319].forEach(f => tone(f, t + 0.4, 0.8, { type: 'triangle', gain: 0.07 }));
    },
  };

  function play(name, ...args) {
    if (!settings().sound || !SOUNDS[name]) return;
    if (!ensureContext() || ctx.state !== 'running') return;
    const now = performance.now();
    if (THROTTLE[name] && now - (lastPlayed[name] || 0) < THROTTLE[name]) return;
    lastPlayed[name] = now;
    try {
      SOUNDS[name](ctx.currentTime + 0.01, ...args);
    } catch (e) {
      console.warn('Sound fehlgeschlagen:', e);
    }
  }

  function setEnabled(on) {
    settings().sound = !!on;
    if (on) unlock();
    applyVolume();
    SF.save();
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    ['pointerdown', 'touchend', 'keydown'].forEach(type => {
      document.addEventListener(type, unlock, { capture: true, passive: true });
    });
  }

  SF.sound = { play, unlock, setEnabled, applyVolume };
})();
