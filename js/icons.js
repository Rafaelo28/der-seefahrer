// Eigene Symbole statt Emojis: gezeichnet im Stil des Spiels (Holz, Messing, Pergament, Tinte) auf einem
// 24 × 24-Raster. Dieselben Pfade gehen als SVG ins HTML (SF.icon) und auf den Canvas (SF.icons.draw).
// Jedes Symbol ist eine Liste von Teilen: [Pfad, Füllung, Linienfarbe, Linienbreite]. 'cur' = Textfarbe.
window.SF = window.SF || {};

(function () {
  const INK = '#2a1d10';
  const WOOD = '#8a5a2b';
  const WOOD_D = '#5a3416';
  const BRASS = '#d4a017';
  const GOLD = '#f5c542';
  const AMBER = '#f0a030';
  const RED = '#c0392b';
  const BLUE = '#2c5d8a';
  const SEA = '#3d8ab0';
  const GREEN = '#2e8b57';
  const PARCH = '#f3e6c4';
  const WHITE = '#fffaf0';
  const GREY = '#8a8f96';
  const DARK = '#34363b';
  const PINK = '#f2a3b5';
  const PURPLE = '#8a5ac8';
  const SAND = '#e8d39a';
  const O = [INK, 1.3]; // Umriss für gefüllte Teile

  const f = (d, fill, line = O) => [d, fill, line ? line[0] : null, line ? line[1] : 0];
  const s = (d, color, width = 2) => [d, 'none', color, width];
  const circle = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

  const ICONS = {
    barrel: [f('M7 3h10c2 3 2 15 0 18H7C5 18 5 6 7 3z', WOOD), s('M5.7 8h12.6M5.7 16h12.6', WOOD_D, 1.6)],
    crate: [f('M3.5 5.5h17v13h-17z', '#b8863f'), s('M3.5 10h17M3.5 14h17M6 5.5l12 13', WOOD_D, 1.3)],
    cannon: [f('M2.5 9.2l12.5-3 3.2 1.4v5.8l-3.2 1.4-12.5-3z', DARK), f(circle(10.5, 16.5, 3.5), WOOD), f(circle(10.5, 16.5, 0.9), INK, null)],
    shield: [f('M12 2.5l8 3v6.2c0 5.3-3.6 8.6-8 9.8-4.4-1.2-8-4.5-8-9.8V5.5z', WOOD), s('M12 3v18.5M4.5 10h15', BRASS, 1.7)],
    pearl: [f('M2.5 14c0 3.5 4.3 6 9.5 6s9.5-2.5 9.5-6z', '#d8a8b8'), f(circle(12, 11.5, 4), WHITE), f(circle(10.6, 10.2, 1.1), '#ffffff', null)],
    anchor: [s(circle(12, 4.6, 2), 'cur', 2), s('M12 6.6v14M8 9.6h8M4 13.8c0 4 3.6 7 8 7s8-3 8-7', 'cur', 2.2), s('M2.6 15.2L4 12.8l2.3 1.9M21.4 15.2L20 12.8l-2.3 1.9', 'cur', 2)],
    menu: [s('M4 6.5h16M4 12h16M4 17.5h16', 'cur', 2.4)],
    sound: [f('M3 9.5h4l5-4.5v14l-5-4.5H3z', 'cur', null), s('M15.5 9c1.6 1.8 1.6 4.2 0 6M18.5 6.2c3.2 3.4 3.2 8.2 0 11.6', 'cur', 2)],
    mute: [f('M3 9.5h4l5-4.5v14l-5-4.5H3z', 'cur', null), s('M16 9l6 6M22 9l-6 6', 'cur', 2.2)],
    compass: [f(circle(12, 12, 9), PARCH), f('M12 4.5l2.6 7.5H9.4z', RED, null), f('M12 19.5l2.6-7.5H9.4z', DARK, null), f(circle(12, 12, 1.2), BRASS, null)],
    market: [f('M4.5 9.5h15V20h-15z', PARCH), f('M3 9.5L5 4h14l2 5.5z', RED), s('M8.5 4l-1 5.5M12 4v5.5M15.5 4l1 5.5', WHITE, 1.4), f('M7 15h3v5H7zM13 13h4v7h-4z', WOOD, null)],
    hammer: [s('M9.8 11.2l9.4 9.4', WOOD, 3), f('M3.5 7.5l5-5 2.5 2.5-1.5 1.5 3.5 3.5-2 2-3.5-3.5-1.5 1.5z', GREY)],
    mug: [f('M5 7h10v12.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 19.5z', AMBER), s('M15 10h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2', INK, 2), f('M4.5 7.8c0-2.6 2-3.6 3.5-3.1 1-1.6 4-1.6 5 0 1.5-.5 2.5.5 2.5 3.1z', WHITE)],
    palette: [f('M12 3C6.8 3 3 6.6 3 11.2 3 15.8 6.4 20 10.2 20c1.6 0 2.1-1.2 1.5-2.2-.7-1.2.1-2.6 1.6-2.6h3.2c2.9 0 4.5-2 4.5-4.6C21 6.4 17 3 12 3z', PARCH),
      f(circle(8.4, 10.6, 1.6), RED, null), f(circle(11.6, 7, 1.6), BLUE, null), f(circle(16, 8, 1.6), GREEN, null), f(circle(17.2, 12.2, 1.4), AMBER, null)],
    wind: [s('M3 12h15M12.5 6.5L18.5 12l-6 5.5', 'cur', 2.6)],
    hourglass: [s('M6 3h12M6 21h12', WOOD, 2.4), s('M7.5 3.5c0 5 9 5.5 9 8.5s-9 3.5-9 8.5M16.5 3.5c0 5-9 5.5-9 8.5s9 3.5 9 8.5', INK, 1.6), f('M9.6 19.6c.5-2 2.4-3 2.4-4.4 0 1.4 1.9 2.4 2.4 4.4z', AMBER, null)],
    skull: [f('M12 3C7.3 3 4.5 6 4.5 10c0 2.6 1.5 4 2.5 4.8V18h10v-3.2c1-.8 2.5-2.2 2.5-4.8 0-4-2.8-7-7.5-7z', WHITE), f(circle(9.6, 10.6, 1.9) + circle(14.4, 10.6, 1.9), INK, null), s('M10 15.5v2.5M12 15.5v2.5M14 15.5v2.5', INK, 1.2)],
    scroll: [f('M7 3.5h10.5a2 2 0 0 1 2 2V18H7z', PARCH), f('M4.5 18h13c0 1.7-1 2.5-2.5 2.5H7c-1.5 0-2.5-.8-2.5-2.5z', '#e2cf9c'), s('M9.5 8h7M9.5 11h7M9.5 14h5', '#6b5434', 1.3)],
    trophy: [s('M7 5.5H4.5c0 3 1 4.5 3 4.8M17 5.5h2.5c0 3-1 4.5-3 4.8', INK, 1.6), f('M7 3.5h10V9a5 5 0 0 1-10 0z', GOLD), f('M11 14h2v3.5h-2z', GOLD), f('M7.5 17.5h9v3h-9z', WOOD)],
    chart: [f('M4.5 13H8v7H4.5zM10.2 8h3.5v12h-3.5zM16 4.5h3.5V20H16z', BLUE), s('M3 20.5h18', INK, 1.6)],
    wheel: [s(circle(12, 12, 6.5), WOOD, 2.6), s('M12 2.5v19M2.5 12h19M5.3 5.3l13.4 13.4M18.7 5.3L5.3 18.7', WOOD, 1.8), f(circle(12, 12, 2), BRASS)],
    palm: [s('M1.5 19.8c3-1.5 5-1.5 7 0s4 1.5 7 0 5-1.5 7 0', SEA, 1.6), f('M4 19c2-3 14-3 16 0z', SAND), s('M12 18.2c.2-4 1.3-7 3.2-9.3', WOOD, 2),
      f('M15 8.5c-2-2.5-6-2.5-8-.5 2.5-.5 5 0 8 .5zM15 8.5c1-3 4-4.5 6.5-3.5-2.5.5-4.5 1.5-6.5 3.5zM15 8.5c2.5-.5 5 .5 6 3-2-1-4-1.5-6-3z', GREEN)],
    diver: [f('M12 3a8 8 0 0 0-8 8v6h16v-6a8 8 0 0 0-8-8z', BRASS), f(circle(12, 10.5, 3.6), '#a8d8f0'), f('M3 17h18v3.5H3z', WOOD), f(circle(6.2, 12.5, 0.9) + circle(17.8, 12.5, 0.9), INK, null)],
    hook: [s(circle(12, 3.6, 1.6), DARK, 1.8), s('M12 5.2v7.3M12 12.5c0 4-3 6.5-6 6.5M12 12.5c0 4 3 6.5 6 6.5M12 12.5v8', DARK, 2.2), s('M4.6 17.4l1.3 2.2 2.1-.9M19.4 17.4l-1.3 2.2-2.1-.9', DARK, 1.8)],
    swords: [s('M4 4l12 12M20 4L8 16', GREY, 2.4), s('M13.3 17.8l4.5-4.5M6.2 13.3l4.5 4.5', BRASS, 2.4), s('M17 17l3 3M7 17l-3 3', WOOD, 2.8)],
    fish: [f('M15.5 12l6-4.5v9z', '#4a8ab8'), f('M2.5 12c3.5-5 10-5.5 13.5 0-3.5 5.5-10 5-13.5 0z', '#5a9ac8'), f(circle(6.8, 11.2, 1), INK, null), s('M10.5 9.5c1 1.5 1 3.5 0 5', '#3a6a98', 1.2)],
    salt: [f('M6 7.5c0-1 1-2 2-2.5L7 3h10l-1 2c1 .5 2 1.5 2 2.5l1 10.5c0 2-2 3.5-7 3.5s-7-1.5-7-3.5z', '#f4f0e6'), s('M7.6 5.4h8.8', WOOD, 1.6), f('M10 13.2l2-2 2 2-2 2z', '#a8c8da')],
    rum: [f('M10 2.5h4v4.2l2.2 3V20a1 1 0 0 1-1 1H8.8a1 1 0 0 1-1-1V9.7l2.2-3z', '#6a3a1a'), f('M8 12.5h8V17H8z', PARCH), f('M10 2.5h4v2h-4z', WOOD)],
    cloth: [f('M6 6.5h11a2.5 5.5 0 0 1 0 11H6a2.5 5.5 0 0 1 0-11z', '#4a6ad0'), s('M8.5 6.8v10.4M12 6.8v10.4', '#c8d4f8', 1.1), f('M17 6.5a2.5 5.5 0 0 1 0 11a2.5 5.5 0 0 1 0-11z', '#7a96e8')],
    spice: [f('M3.5 18c3 3 9.5 2 13-2.5 2-2.6 2.6-5.6 2.2-7.8-1.8 2.6-4.2 4.6-7.2 6.1-2.6 1.3-5.3 2.1-8 4.2z', RED), f('M16 8.3l2.8-2.3 1.8 2.2-2.8 1.7z', GREEN), s('M19.6 6.6c.4-1.5 1.3-2.6 2.5-3.1', GREEN, 1.8)],
    bread: [f('M3.5 15c0-5.5 4-8.5 8.5-8.5s8.5 3 8.5 8.5v2.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z', '#c8862a'), s('M8 10l1.5 3M11.5 9.5l1.5 3M15 10l1.5 3', '#f0c070', 1.6)],
    kraken: [s('M7.5 13.5c-1.5 2-3.5 2.5-5 2M9.5 14c-.5 2.5-2 4.5-4 5.5M12 14v6.5M14.5 14c.5 2.5 2 4.5 4 5.5M16.5 13.5c1.5 2 3.5 2.5 5 2', PURPLE, 2.3),
      f('M12 3c-4 0-6.5 3-6.5 6.5 0 2 .8 3.5 2 4.5h9c1.2-1 2-2.5 2-4.5C18.5 6 16 3 12 3z', PURPLE), f(circle(9.8, 9, 1.2) + circle(14.2, 9, 1.2), WHITE, null)],
    dragon: [s('M2 17.5c2.5-5 5-5 7 0s4.5 5 7 0', GREEN, 3.4), f('M15.5 17c0-4.5 2.3-7.4 5.4-7.9l.6 2.6-2 1 1.6 1.6c-1 2.1-3.2 2.7-5.6 2.7z', GREEN), f(circle(19, 12, 0.8), WHITE, null), f('M4.2 13.3l1.2-2.3 1.2 2.3zM11 21.2l1-2.2 1.2 2.1z', '#1e6a3e', null)],
    monster: [s('M1.5 19.2c2.5-1.2 4.5-1.2 7 0s4.5 1.2 7 0 4.5-1.2 7 0', SEA, 1.8), f('M3 18.5h18c-4-1.5-7-6.5-8-14-2.5 4.5-6.5 10-10 14z', '#7a8a9a')],
    star: [f('M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z', GOLD)],
    check: [s('M4.5 12.5l4.5 4.5 10.5-10.5', 'cur', 3)],
    lock: [s('M8 10.5V8a4 4 0 0 1 8 0v2.5', GREY, 2.2), f('M5.5 10.5h13v10h-13z', BRASS), f(circle(12, 14.5, 1.4), INK, null)],
    flag: [s('M5.5 2.5v19', WOOD, 2.2), f('M6 3.5h12l-3 4 3 4H6z', RED)],
    map: [f('M3 5.5l6-2 6 2 6-2v15l-6 2-6-2-6 2z', PARCH), s('M9 3.6v15M15 5.6v15', '#a08860', 1.1), s('M5.3 15.4c2-3 4 0 6-3s4-1 5.6-4.2', RED, 1.4), s('M16 6.5l2 2M18 6.5l-2 2', RED, 1.4)],
    ship: [s('M12 2.5v13', WOOD_D, 1.8), f('M12.8 3.5c4.2 2.6 5.3 7.2 4.2 11.2h-4.2zM11.2 5c-3.2 2.6-4.3 6.2-3.7 9.7h3.7z', PARCH), f('M2.5 15h19l-2.7 5.5H5.2z', WOOD)],
    chest: [f('M3.5 11h17v9h-17z', WOOD), f('M3.5 11c0-4 3-6 8.5-6s8.5 2 8.5 6z', '#a8742f'), s('M3.5 11h17', BRASS, 1.8), f('M10.5 10h3v4h-3z', GOLD)],
    left: [f('M15.5 4.5L6 12l9.5 7.5z', 'cur', null)],
    right: [f('M8.5 4.5L18 12l-9.5 7.5z', 'cur', null)],
    jump: [f('M12 3l7.5 8.5H15V20H9v-8.5H4.5z', 'cur', null)],
    pause: [f('M6.5 5h4v14h-4zM13.5 5h4v14h-4z', 'cur', null)],
    back: [s('M10 5L3.5 11.5 10 18M4 11.5h11a5 5 0 0 1 5 5v2', 'cur', 2.4)],
    volcano: [s('M10.5 6.8c-1.2-1.4-.4-3.2 1.3-3.2.6-1.5 2.4-2 3.6-1', GREY, 1.6), f('M2.5 20l6.5-11h6l6.5 11z', '#5a4a3e'), f('M9 9h6l-1.4 2.6h-3.2z', '#e0502a', null)],
    ice: [s('M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2L3.8 16.8', '#4a98c8', 2.2), s('M9.8 4.3L12 6.5l2.2-2.2M9.8 19.7L12 17.5l2.2 2.2', '#4a98c8', 1.6)],
    coral: [f('M6 21h12c0-1.5-2-2.5-6-2.5S6 19.5 6 21z', GREY), s('M12 19v-6M12 13c0-3-2-4-4-6M12 13c0-3 2-4.5 4.5-6M8 7c-1-1.5-1-3 0-4M16.5 7c1-1.5 1-3 0-4M12 16c-2-1-4-1.5-6-1M12 16c2-1 4-1.5 6-1', '#e86a7a', 2.4)],
    mermaid: [f('M12 2.5c-3.4 4-3.9 8.6-1.2 12.6-2 1.8-4.6 3-7.3 3.3 2.6 1.2 5.8 2.8 8.5 2.8s5.9-1.6 8.5-2.8c-2.7-.3-5.3-1.5-7.3-3.3 2.7-4 2.2-8.6-1.2-12.6z', '#2aa8a0'), s('M10 7.5c1.3.8 2.7.8 4 0M9.8 10.8c1.4.8 3 .8 4.4 0', '#1a7a74', 1.2)],
    pig: [f('M5 5.5l3 4L4 9.5zM19 5.5l-3 4 4 0z', PINK), f(circle(12, 12.5, 7.5), PINK), f('M9 14a3 2.2 0 1 0 6 0a3 2.2 0 1 0-6 0z', '#ec8aa3'), f(circle(10.9, 14, 0.6) + circle(13.1, 14, 0.6) + circle(9.3, 10.2, 0.9) + circle(14.7, 10.2, 0.9), INK, null)],
    blast: [f('M12 2l2 6 6-3-3 6 6 2-6 2 3 6-6-3-2 6-2-6-6 3 3-6-6-2 6-2-3-6 6 3z', AMBER), f(circle(12, 12, 3), GOLD, null)],
    bubbles: [s(circle(8, 15, 4) + circle(15.5, 8.5, 3) + circle(17, 16.5, 2), '#5ab0e0', 1.8)],
    coin: [f(circle(12, 12, 8.5), GOLD), s(circle(12, 12, 5.8), '#c38d12', 1.2)],
    dice: [f('M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', WHITE), f(circle(8.5, 8.5, 1.4) + circle(15.5, 15.5, 1.4) + circle(12, 12, 1.4) + circle(15.5, 8.5, 1.4) + circle(8.5, 15.5, 1.4), INK, null)],
    tablet: [f('M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', DARK), f('M7 5.5h10v12H7z', '#a8d8f0', null)],
    warning: [f('M12 3l9.5 17h-19z', AMBER), s('M12 9v5.5', INK, 2.2), f(circle(12, 17.2, 1.1), INK, null)],
    bottle: [f('M10 2.5h4v3.6c2.4 1 3.5 3 3.5 5.4v8a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-8c0-2.4 1.1-4.4 3.5-5.4z', '#8fd0c4'),
      f('M9.6 11.5h4.8v6.5H9.6z', PARCH, [INK, 0.9]), s('M10.6 13.5h2.8M10.6 15.8h2.8', '#6b5434', 1), f('M9.7 2h4.6v2.4H9.7z', WOOD)],
    crew: [f('M2.5 19.5c0-4 2.5-6.6 5.5-6.6s5.5 2.6 5.5 6.6z', BLUE), f(circle(8, 8.2, 3.1), '#f2c9a0'), s('M4.9 6.6h6.2', RED, 1.8),
      f('M11.6 19.5c.3-3.7 2.3-5.8 4.9-5.8s4.6 2.1 4.9 5.8z', RED), f(circle(16.5, 9.4, 2.7), '#c68a5a')],
    wrench: [s('M14.5 9.5L5 19', GREY, 3.2), f('M14 4.5a4.5 4.5 0 0 0 5.5 5.5l-2-2v-2.5h-2.5z', GREY)],
  };

  // ---------- HTML (SVG) ----------

  const svgCache = {};
  function icon(name, cls = '') {
    const key = name + '|' + cls;
    if (svgCache[key]) return svgCache[key];
    const parts = ICONS[name];
    if (!parts) return '';
    const body = parts.map(([d, fill, line, w]) => {
      const fl = fill === 'cur' ? 'currentColor' : fill;
      const st = line ? ` stroke="${line === 'cur' ? 'currentColor' : line}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"` : '';
      return `<path d="${d}" fill="${fl}"${st}/>`;
    }).join('');
    const out = `<svg class="ic ic-${name}${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
    svgCache[key] = out;
    return out;
  }

  // ---------- Canvas ----------

  const pathCache = {};
  // Symbol mittig bei (x, y) in der Größe size zeichnen; color ersetzt 'cur'
  function draw(ctx, name, x, y, size, color = INK) {
    const parts = ICONS[name];
    if (!parts || typeof Path2D === 'undefined') return;
    ctx.save();
    ctx.translate(x - size / 2, y - size / 2);
    ctx.scale(size / 24, size / 24);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    parts.forEach(([d, fill, line, w], i) => {
      const key = name + i;
      const p = pathCache[key] || (pathCache[key] = new Path2D(d));
      if (fill !== 'none') {
        ctx.fillStyle = fill === 'cur' ? color : fill;
        ctx.fill(p);
      }
      if (line) {
        ctx.strokeStyle = line === 'cur' ? color : line;
        ctx.lineWidth = w;
        ctx.stroke(p);
      }
    });
    ctx.restore();
  }

  SF.icon = icon;
  SF.icons = { ICONS, icon, draw };
})();
