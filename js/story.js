// Story: Bildergeschichten (SVG-Bilder mit Text, Antippen = weiter), Story-Schritte mit Ziel und das Logbuch.
// Die Schritte aller Kapitel stehen in STEPS (in der Reihenfolge der Geschichte, siehe SF.story.reached).
// Stufe 1: Prolog „Der Raub“, „Der letzte Tag der Dublone“ (js/lastday.js), Abend in Port Dublone und die erste
// Spur des Diebes: Bernsteinbucht → Schmugglerinsel → Vulkaninsel.
window.SF = window.SF || {};

(function () {
  // ---------- Story-Schritte ----------

  // goal: Ort, zu dem man segeln soll (Markierung auf der Karte) · text: Anzeige oben auf der Seekarte
  const STEPS = {
    new: {},
    prolog: {},
    lastday: {},
    evening: {},
    'find-amberbay': { goal: 'amberbay', text: 'Segle zur Bernsteinbucht im Nordosten und frag in der Kneipe nach dem Dieb.' },
    'find-smuggler': { goal: 'smuggler', text: 'Segle zur Schmugglerinsel im Südosten. Dort hat jemand das schwarze Schiff gesehen.' },
    'salt-quest': { goal: 'smuggler', text: 'Einauge Ede will 3 Kisten Salz, dann erzählt er mehr. Bring sie ihm in die Kneipe der Schmugglerinsel.' },
    'find-volcano': { goal: 'volcano', text: 'Das schwarze Schiff ist zur Vulkaninsel gesegelt. Folge ihm!' },
    end1: { text: 'Die Spur führt ins Eismeer …' }, // alte Spielstände: wird zu 'hire-cook' (SF.chapter.migrate)
    'hire-cook': { goal: 'dublone', text: 'Im Eismeer erfriert man ohne warmes Essen. In der Kneipe von Port Dublone sucht ein Schiffskoch Arbeit.' },
    'find-ice': { goal: 'ice', text: 'Folge der Karte mit dem Kreuz ins Eismeer im Norden und geh dort an Land.' },
    traitor: { text: () => `Jemand an Bord verrät deinen Kurs an Long John! Hinweise: ${SF.chapter ? SF.chapter.clueCount() : 0} von 3 – frag in den Kneipen herum. Anklagen kannst du in der Kajüte.` },
    'find-dragon': { goal: 'dragon', text: 'Fiete hat geredet: Long Johns Versteck liegt an der Drachenküste im Südosten. Geh dort an Land!' },
    finale: { goal: 'mist', text: 'Long John ist mit dem Fliegenden Holländer ins Nebelmeer im Osten geflohen. Segle hinterher!' },
    done: { text: '' }, // Long John besiegt – geht gleich mit Kapitel 4 weiter (SF.chapter.migrate)
    // Kapitel 4 „Der Auftraggeber“ und Kapitel 5 „Die Bernsteinfestung“ (js/chapter.js)
    jail: { goal: 'dublone', text: 'Post aus Port Dublone: Long John sitzt im Hafenkerker und will auspacken. Besuch ihn – der Kerker liegt gleich neben der Kneipe.' },
    couriers: { text: () => `Der Bernstein-Baron steckt hinter allem! Seine Kuriere mit den goldenen Segeln kreuzen mitten auf der See, weit östlich von Port Dublone. Entere sie und erbeute ihre Briefe: ${SF.chapter ? SF.chapter.letters() : 0} von 3.` },
    decode: { goal: 'smuggler', text: 'Die Briefe des Barons sind in Geheimschrift geschrieben. Einauge Ede auf der Schmugglerinsel kennt sich mit so etwas aus.' },
    codebook: { goal: 'reef', text: 'Das Codebuch des Barons liegt in einem gesunkenen Kurierschiff am Korallenriff. Tauche danach und komm heil wieder hoch!' },
    'find-fort': { goal: 'fort', text: 'Die Briefe sind entschlüsselt: Der Baron sitzt in der Bernsteinfestung im Nordwesten. Segle hin und geh an Land!' },
    baron: { goal: 'fort', text: 'Der Bernstein-Baron flieht mit seinem Flaggschiff „Goldene Gier“! Stell ihn vor der Festung – und entere ihn.' },
    done2: { text: '' }, // ganz durchgespielt: freies Segeln, Geheimnisse für 100 %
  };
  const ORDER = Object.keys(STEPS);

  const step = () => SF.state.story.step;
  // Ist die Story schon bei diesem Schritt angekommen (oder weiter)?
  const reached = id => ORDER.indexOf(step()) >= ORDER.indexOf(id);
  const goal = () => (STEPS[step()] || {}).goal || '';
  const goalText = () => {
    const t = (STEPS[step()] || {}).text || '';
    return typeof t === 'function' ? t() : t;
  };

  function setStep(id, logText) {
    SF.state.story.step = id;
    if (logText) log(logText);
    SF.save();
  }

  // Eintrag ins Logbuch (neueste zuerst angezeigt, höchstens 60)
  function log(text) {
    const list = SF.state.story.log;
    list.push({ day: day(), text });
    if (list.length > 60) list.splice(0, list.length - 60);
  }

  // Tag auf See: alle 2 Minuten Segelzeit ein neuer Tag
  const day = () => 1 + Math.floor((SF.state.seaTime || 0) / 120);

  const flag = id => !!SF.state.story.flags[id];
  const setFlag = (id, value = true) => { SF.state.story.flags[id] = value; };

  // ---------- Bilder ----------

  // Fremdes SVG an eine Stelle setzen (verschachteltes <svg> mit Position und Größe)
  const embed = (svg, x, y, w, h) => svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${h}" `);
  const ship = (id, x, y, w, recolor) => {
    let s = SF.ships.sideSVG(id);
    if (recolor) Object.entries(recolor).forEach(([a, b]) => { s = s.split(a).join(b); });
    return embed(s, x, y, w, w * 92 / 120);
  };
  const fig = (code, x, y, w) => embed(SF.figure.svg(code), x, y, w, w);
  const klabauter = (x, y, w) => embed(SF.ui.KLABAUTER, x, y, w, w * 72 / 64);

  const waves = (y, color = 'rgba(255,255,255,.35)') => {
    let d = '';
    for (let row = 0; row < 3; row++) {
      for (let x = -20 + row * 23; x < 420; x += 70) d += `M${x} ${y + row * 18} q8 -6 16 0 `;
    }
    return `<g class="sc-bob"><path d="${d}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/></g>`;
  };

  const coin = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#f5c542" stroke="#8a6508" stroke-width="${r / 8}"/>
    <circle cx="${x}" cy="${y}" r="${r * 0.72}" fill="none" stroke="#c38d12" stroke-width="${r / 14}"/>
    <text x="${x}" y="${y + r * 0.36}" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="900" font-size="${r}" fill="#8a6508">D</text>`;

  const svgOpen = '<svg class="scene-svg" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">';

  const LINE = 'stroke="#2a1d10" stroke-width="1.5" stroke-linejoin="round"';
  // Wolken und Möwen für die Hafenbilder
  const clouds = (list, color = '#ffffff', op = 0.85) => list.map(([x, y, k]) => `<g class="sc-drift" opacity="${op}" fill="${color}">
      <ellipse cx="${x}" cy="${y}" rx="${22 * k}" ry="${9 * k}"/><ellipse cx="${x - 10 * k}" cy="${y - 6 * k}" rx="${11 * k}" ry="${8 * k}"/><ellipse cx="${x + 8 * k}" cy="${y - 8 * k}" rx="${13 * k}" ry="${10 * k}"/></g>`).join('');
  const gulls = list => `<g class="sc-bob" fill="none" stroke="#2a1d10" stroke-width="1.8" stroke-linecap="round">${list.map(([x, y]) => `<path d="M${x} ${y} q5 -6 10 0 q5 -6 10 0"/>`).join('')}</g>`;

  function houses(y, gold) {
    const list = [[0, 50, 46], [44, 38, 60], [78, 46, 40], [262, 44, 52], [302, 40, 38], [338, 62, 56]];
    return list.map(([x, w, h], i) => `<rect x="${x + w * 0.68}" y="${y - h - 22}" width="7" height="16" fill="#5a4a42" ${LINE}/>
      <rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="${['#8a5444', '#66788a', '#9a7852', '#7a5678', '#56786a', '#8a6844'][i]}" ${LINE}/>
      <path d="M${x - 4} ${y - h} L${x + w / 2} ${y - h - 19} L${x + w + 4} ${y - h} Z" fill="${gold ? '#d4a017' : '#6a3420'}" ${LINE}/>
      <rect x="${x + 6}" y="${y - h + 9}" width="11" height="11" fill="#ffd27a" ${LINE} class="flicker" style="animation-delay:${i * 0.4}s"/>
      <path d="M${x + 11.5} ${y - h + 9} v11 M${x + 6} ${y - h + 14.5} h11" stroke="#2a1d10" stroke-width="1"/>
      <rect x="${x + w - 17}" y="${y - 17}" width="10" height="17" rx="2" fill="#4a2d14" ${LINE}/>`).join('');
  }

  const ART = {
    // Port Dublone am Abend
    hafen: () => `${svgOpen}
      <defs><linearGradient id="sc-h-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2350"/><stop offset=".6" stop-color="#c8556b"/><stop offset="1" stop-color="#f6b25e"/></linearGradient></defs>
      <rect width="400" height="240" fill="url(#sc-h-sky)"/>
      <circle cx="330" cy="150" r="40" fill="#ffd27a" opacity=".3"/>
      <circle cx="330" cy="150" r="26" fill="#ffd27a" opacity=".95"/>
      ${clouds([[70, 44, 1.1], [300, 30, 0.8]], '#f6b8a0', 0.55)}
      ${gulls([[110, 70], [140, 56]])}
      ${houses(172, true)}
      <rect x="140" y="104" width="120" height="68" fill="#e6d3a8"/>
      <path d="M132 104 L200 72 L268 104 Z" fill="#d4a017" stroke="#8a6508" stroke-width="2"/>
      ${[150, 175, 200, 225, 250].map(x => `<rect x="${x - 5}" y="112" width="10" height="56" fill="#f4ead0" stroke="#b8a070"/>`).join('')}
      ${coin(200, 92, 13)}
      <text x="200" y="125" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="9" fill="#5a3a10">HAFENBANK</text>
      <rect x="0" y="172" width="400" height="68" fill="#1d4e6e"/>
      <rect x="120" y="168" width="160" height="8" fill="#6b4a2a"/>
      ${waves(190)}
      <g class="sc-bob" style="animation-delay:-1s">${ship('brig', 10, 108, 110)}</g>
      <g class="sc-bob" style="animation-delay:-2s">${ship('galleon', 286, 112, 106)}</g>
    </svg>`,

    // Die Goldene Dublone im Tresor
    tresor: () => `${svgOpen}
      <defs><radialGradient id="sc-t-glow"><stop offset="0" stop-color="#ffe58a" stop-opacity=".9"/><stop offset="1" stop-color="#ffe58a" stop-opacity="0"/></radialGradient></defs>
      <rect width="400" height="240" fill="#2a2622"/>
      ${[0, 1, 2, 3, 4, 5].map(r => `<path d="M0 ${r * 40} H400" stroke="#1d1a17" stroke-width="2"/>`).join('')}
      ${[0, 1, 2, 3, 4, 5].map(r => [0, 1, 2, 3, 4, 5].map(c => `<path d="M${c * 80 + (r % 2) * 40} ${r * 40} V${r * 40 + 40}" stroke="#1d1a17" stroke-width="2"/>`).join('')).join('')}
      <circle cx="60" cy="120" r="52" fill="#5d5a55" stroke="#2d2a25" stroke-width="6"/>
      <circle cx="60" cy="120" r="34" fill="none" stroke="#3d3a35" stroke-width="4"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<circle cx="${60 + 44 * Math.cos(i * Math.PI / 4)}" cy="${120 + 44 * Math.sin(i * Math.PI / 4)}" r="3" fill="#8a8580"/>`).join('')}
      <path d="M60 100 V140 M40 120 H80" stroke="#8a8580" stroke-width="5" stroke-linecap="round"/>
      <path d="M200 0 L150 190 L250 190 Z" fill="#ffe58a" opacity=".12"/>
      <circle cx="200" cy="130" r="70" fill="url(#sc-t-glow)" class="sc-glow"/>
      <rect x="170" y="168" width="60" height="50" fill="#8a7a6a" stroke="#4a3a2a" stroke-width="2"/>
      <rect x="160" y="160" width="80" height="12" fill="#a89888" stroke="#4a3a2a" stroke-width="2"/>
      <g class="sc-bob">${coin(200, 128, 26)}</g>
    </svg>`,

    // Nacht: das Schiff mit den schwarzen Segeln
    nacht: () => `${svgOpen}
      <defs><linearGradient id="sc-n-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05070f"/><stop offset="1" stop-color="#1a2a44"/></linearGradient></defs>
      <rect width="400" height="240" fill="url(#sc-n-sky)"/>
      ${[[30, 20], [80, 50], [130, 15], [190, 40], [240, 12], [300, 35], [360, 18], [380, 60], [20, 70], [160, 70]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#fff" class="sc-twinkle" style="animation-delay:${i * 0.37}s"/>`).join('')}
      <circle cx="330" cy="50" r="20" fill="#f4f1d0"/><circle cx="340" cy="44" r="18" fill="#0b1020"/>
      ${houses(176, false)}
      <rect x="0" y="176" width="400" height="64" fill="#0d2236"/>
      ${waves(196, 'rgba(160,200,255,.25)')}
      <g class="sc-bob">${ship('frigate', 230, 96, 150, { '#ece4cc': '#141418', '#3b2a1a': '#101014', '#16181d': '#c0392b' })}</g>
      <g class="sc-drift"><ellipse cx="120" cy="150" rx="140" ry="14" fill="#cfd8e8" opacity=".14"/><ellipse cx="300" cy="170" rx="120" ry="10" fill="#cfd8e8" opacity=".12"/></g>
      <path d="M120 186 L170 186 L164 196 L126 196 Z" fill="#2a1a0c"/>
      <path d="M140 186 C138 170 142 160 148 158 C154 160 157 170 155 186 Z" fill="#050505"/>
      <circle cx="148" cy="154" r="7" fill="#050505"/>
      <path d="M152 170 C160 166 168 168 170 176 C168 184 158 184 154 180 Z" fill="#3a2a1a"/>
      <circle cx="164" cy="170" r="2.2" fill="#ffe58a" class="sc-twinkle"/>
    </svg>`,

    // Morgen: der Tresor ist leer
    morgen: (s) => `${svgOpen}
      <rect width="400" height="240" fill="#4a443c"/>
      <path d="M200 0 L140 170 L260 170 Z" fill="#fff6d0" opacity=".1"/>
      <rect x="170" y="128" width="60" height="50" fill="#8a7a6a" stroke="#4a3a2a" stroke-width="2"/>
      <rect x="160" y="120" width="80" height="12" fill="#a89888" stroke="#4a3a2a" stroke-width="2"/>
      <text x="200" y="104" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="900" font-size="46" fill="#f5c542" class="sc-bob">?</text>
      ${[['0.1.1.2.2.1.1', 4], ['4.2.0.1.0.0.3', 82], ['5.5.6.0.1.2.7', 250], ['1.6.3.6.3.8.5', 326]].map(([c, x]) => fig(c, x, 168, 70)).join('')}
      ${fig(SF.figure.mine(), 165, 166, 72)}
      ${[40, 120, 280, 360].map((x, i) => `<text x="${x}" y="166" text-anchor="middle" font-size="22" font-weight="900" fill="#ff6b5a" class="sc-twinkle" style="animation-delay:${i * 0.2}s">!</text>`).join('')}
    </svg>`,

    // Hyperinflation: Bäckerei und Türme aus Geldsäcken
    inflation: () => `${svgOpen}
      <rect width="400" height="240" fill="#d8c9a8"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${i * 52 - 10}" y="${(i % 3) * 14}" width="44" height="22" fill="#b9d3a0" stroke="#7a9a6a" transform="rotate(${(i % 2 ? 6 : -5)} ${i * 52 + 12} ${(i % 3) * 14 + 11})"/>`).join('')}
      <rect x="20" y="60" width="200" height="150" fill="#8a5a3a" stroke="#4a2a1a" stroke-width="3"/>
      <rect x="40" y="70" width="160" height="26" fill="#f4ead0" stroke="#4a2a1a" stroke-width="2"/>
      <text x="120" y="89" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="900" font-size="17" fill="#5a2a1a">BÄCKEREI</text>
      <rect x="40" y="108" width="84" height="62" fill="#ffe9b0" stroke="#4a2a1a" stroke-width="2"/>
      ${[0, 1, 2].map(i => `<ellipse cx="${58 + i * 24}" cy="152" rx="11" ry="7" fill="#c8862a" stroke="#7a4a10"/>`).join('')}
      <rect x="134" y="104" width="74" height="74" fill="#26302a" stroke="#6b4a2a" stroke-width="4"/>
      <text x="171" y="120" text-anchor="middle" font-size="10" fill="#fff" font-weight="700">BROT</text>
      <text x="171" y="134" text-anchor="middle" font-size="8" fill="#cfd" text-decoration="line-through">1 Milliarde</text>
      <text x="171" y="146" text-anchor="middle" font-size="8" fill="#cfd" text-decoration="line-through">1 Billion</text>
      <text x="171" y="162" text-anchor="middle" font-size="8.5" fill="#ffe58a" font-weight="700" class="sc-twinkle">1 Sextilliarde</text>
      ${[0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="${262 + (i % 2) * 4}" y="${206 - i * 20}" width="56" height="18" rx="3" fill="#a8c890" stroke="#5a7a4a" stroke-width="1.5"/><rect x="${286 + (i % 2) * 4}" y="${206 - i * 20}" width="8" height="18" fill="#e8d9a8"/>`).join('')}
      ${fig('3.0.0.0.1.4.4', 320, 168, 62)}${fig('5.5.6.0.1.2.7', 224, 172, 56)}
      <g class="sc-drift"><rect x="300" y="40" width="30" height="16" fill="#b9d3a0" stroke="#7a9a6a" transform="rotate(-18 315 48)"/><rect x="350" y="80" width="30" height="16" fill="#b9d3a0" stroke="#7a9a6a" transform="rotate(14 365 88)"/></g>
      <rect x="0" y="210" width="400" height="30" fill="#8a7a6a"/>
    </svg>`,

    // Der Klabautermann erscheint
    klabauter: () => `${svgOpen}
      <defs><radialGradient id="sc-k-glow"><stop offset="0" stop-color="#ffd25e" stop-opacity=".55"/><stop offset="1" stop-color="#ffd25e" stop-opacity="0"/></radialGradient></defs>
      <rect width="400" height="240" fill="#141c2c"/>
      ${[0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="0" y="${150 + i * 13}" width="400" height="12" fill="${i % 2 ? '#6b4a2a' : '#7a5632'}"/>`).join('')}
      <rect x="40" y="0" width="16" height="160" fill="#4a3520"/>
      <path d="M0 140 L400 140" stroke="#3a2a18" stroke-width="6"/>
      <circle cx="232" cy="150" r="90" fill="url(#sc-k-glow)" class="sc-glow"/>
      <g class="sc-bob">${klabauter(150, 60, 140)}</g>
    </svg>`,

    // Abend: Umtausch in der Hafenbank
    abend: () => `${svgOpen}
      <defs><linearGradient id="sc-a-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a5a"/><stop offset="1" stop-color="#e8794a"/></linearGradient></defs>
      <rect width="400" height="240" fill="url(#sc-a-sky)"/>
      ${houses(180, true)}
      <rect x="130" y="96" width="140" height="84" fill="#e6d3a8"/>
      <path d="M122 96 L200 62 L278 96 Z" fill="#9a8a6a" stroke="#5a4a2a" stroke-width="2"/>
      <rect x="146" y="108" width="108" height="40" fill="#f4ead0" stroke="#5a3a10" stroke-width="2"/>
      <text x="200" y="122" text-anchor="middle" font-size="9" font-weight="700" fill="#5a3a10">UMTAUSCH</text>
      <text x="200" y="138" text-anchor="middle" font-size="8" fill="#5a3a10">1 Billion D = 1 Bernstein</text>
      <rect x="0" y="180" width="400" height="60" fill="#c8a870"/>
      ${[[60, 206], [96, 222], [310, 212], [344, 200], [250, 226]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="6" fill="#f0a030" stroke="#a05a10" stroke-width="1.5" class="sc-twinkle" style="animation-delay:${i * 0.3}s"/>`).join('')}
      ${[0, 1, 2, 3].map(i => `<rect x="${150 + i * 26}" y="${196 + (i % 2) * 8}" width="22" height="12" fill="#b9d3a0" stroke="#7a9a6a" transform="rotate(${i * 9 - 12} ${161 + i * 26} ${202 + (i % 2) * 8})"/>`).join('')}
    </svg>`,

    // Bernsteinbucht: Fischerdorf am Strand, Netze, Bernstein im Sand
    fischer: () => `${svgOpen}
      <defs><linearGradient id="sc-f-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a8ac8"/><stop offset="1" stop-color="#f4c890"/></linearGradient></defs>
      <rect width="400" height="240" fill="url(#sc-f-sky)"/>
      <circle cx="320" cy="120" r="38" fill="#ffe0a0" opacity=".3"/>
      <circle cx="320" cy="120" r="24" fill="#ffe0a0" opacity=".95"/>
      ${clouds([[80, 50, 1.2], [220, 34, 0.9]])}
      ${gulls([[150, 84], [185, 72]])}
      <rect x="0" y="150" width="400" height="90" fill="#2a6a8e"/>
      ${waves(166)}
      <path d="M0 196 C90 170 200 178 400 204 L400 240 L0 240 Z" fill="#e8d39a"/>
      ${[[30, 44, '#7a4a3a'], [86, 36, '#5d6b7a'], [130, 40, '#8a6a4a']].map(([x, h, c]) => `<rect x="${x}" y="${190 - h}" width="40" height="${h}" fill="${c}" ${LINE}/>
        <path d="M${x - 4} ${190 - h} L${x + 20} ${170 - h} L${x + 44} ${190 - h} Z" fill="#b8402e" ${LINE}/>
        <rect x="${x + 6}" y="${198 - h}" width="10" height="10" fill="#ffe9a8" ${LINE}/>
        <rect x="${x + 24}" y="${190 - 16}" width="9" height="16" rx="2" fill="#4a2d14" ${LINE}/>`).join('')}
      <path d="M210 168 L222 140 L234 168 M216 156 L230 156" stroke="#6b4a2a" stroke-width="3" fill="none"/>
      <path d="M180 192 q20 -24 40 0 q20 -24 40 0" stroke="#c8b48a" stroke-width="2" fill="none"/>
      <g class="sc-bob">${ship('sloop', 280, 120, 80)}</g>
      ${[[60, 214], [150, 222], [240, 216], [330, 226]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="8" ry="5" fill="#f0a030" stroke="#a05a10" stroke-width="1.5" class="sc-twinkle" style="animation-delay:${i * 0.4}s"/>`).join('')}
    </svg>`,

    // Schmugglerinsel: Hütten auf Pfählen in einer Bucht bei Nacht, Laternen
    schmuggler: () => `${svgOpen}
      <defs><linearGradient id="sc-s-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101830"/><stop offset="1" stop-color="#3a4a6a"/></linearGradient></defs>
      <rect width="400" height="240" fill="url(#sc-s-sky)"/>
      ${[[40, 30], [120, 18], [200, 40], [290, 22], [360, 50]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#fff" class="sc-twinkle" style="animation-delay:${i * 0.5}s"/>`).join('')}
      <circle cx="70" cy="56" r="16" fill="#f4f1d0"/>
      <path d="M260 160 C280 90 330 70 400 80 L400 170 Z" fill="#1e2a22"/>
      <rect x="0" y="160" width="400" height="80" fill="#14304a"/>
      ${waves(178, 'rgba(160,200,255,.25)')}
      ${[[40, 120], [120, 110], [200, 124]].map(([x, y]) => `<path d="M${x + 6} ${y + 30} V176 M${x + 44} ${y + 30} V176" stroke="#3a2a1a" stroke-width="4"/>
        <rect x="${x}" y="${y}" width="50" height="32" fill="#5a3a22"/><path d="M${x - 6} ${y} L${x + 25} ${y - 20} L${x + 56} ${y} Z" fill="#3a2a1a"/>
        <rect x="${x + 18}" y="${y + 10}" width="12" height="12" fill="#ffd25e" class="flicker"/>`).join('')}
      <path d="M30 150 H250" stroke="#4a3520" stroke-width="5"/>
      <g class="sc-bob">${ship('brig', 290, 110, 90, { '#f4efe0': '#4a4a4a' })}</g>
      ${[[90, 146], [170, 146]].map(([x, y]) => `<path d="M${x} ${y - 14} v14" stroke="#4a3520" stroke-width="2"/><circle cx="${x}" cy="${y - 16}" r="5" fill="#ffd25e" class="flicker"/>`).join('')}
    </svg>`,

    // Finale: Long John besiegt auf dem Deck des Holländers, die Goldene Dublone leuchtet
    sieg: () => `${svgOpen}
      <defs><radialGradient id="sc-v-glow"><stop offset="0" stop-color="#ffe58a" stop-opacity=".9"/><stop offset="1" stop-color="#ffe58a" stop-opacity="0"/></radialGradient></defs>
      <rect width="400" height="240" fill="#1a2430"/>
      <g class="sc-drift"><ellipse cx="100" cy="60" rx="160" ry="20" fill="#cfd8e8" opacity=".12"/><ellipse cx="320" cy="90" rx="140" ry="16" fill="#cfd8e8" opacity=".1"/></g>
      ${[0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="0" y="${150 + i * 13}" width="400" height="12" fill="${i % 2 ? '#3a4450' : '#44505c'}"/>`).join('')}
      <rect x="320" y="0" width="14" height="160" fill="#2a3440"/>
      <path d="M250 10 Q320 30 390 14 L384 120 Q320 104 256 126 Z" fill="#9ab8d8" opacity=".55"/>
      ${fig('1.1.3.3.2.4.1', 70, 120, 90)}
      ${fig(SF.figure.mine(), 210, 108, 100)}
      <circle cx="150" cy="120" r="44" fill="url(#sc-v-glow)" class="sc-glow"/>
      <g class="sc-bob">${coin(150, 118, 18)}</g>
    </svg>`,

    // Fest in Port Dublone mit Feuerwerk
    fest: () => `${svgOpen}
      <rect width="400" height="240" fill="#141c34"/>
      ${[[80, 50, '#f5c542'], [200, 34, '#e86a7a'], [320, 56, '#6ad0e8'], [140, 80, '#9ae86a'], [270, 90, '#f0a030']].map(([x, y, c], i) => `<g class="sc-twinkle" style="animation-delay:${i * 0.35}s">
        ${[0, 1, 2, 3, 4, 5, 6, 7].map(k => `<path d="M${x} ${y} l${Math.round(Math.cos(k * 0.785) * 22)} ${Math.round(Math.sin(k * 0.785) * 22)}" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`).join('')}</g>`).join('')}
      ${houses(176, true)}
      <rect x="140" y="110" width="120" height="66" fill="#e6d3a8"/>
      <path d="M132 110 L200 80 L268 110 Z" fill="#d4a017" stroke="#8a6508" stroke-width="2"/>
      ${coin(200, 98, 12)}
      <rect x="0" y="176" width="400" height="64" fill="#1d4e6e"/>
      ${[['0.3.7.3.7.0.5', 20], ['2.10.0.0.4.7.0', 90], ['1.6.0.1.0.7.0', 250], ['1.2.0.0.0.8.0', 320]].map(([c, x]) => fig(c, x, 172, 66)).join('')}
      ${fig(SF.figure.mine(), 160, 160, 80)}
    </svg>`,

    // Ablegen: das eigene Schiff auf See, der Klabautermann am Bug
    ablegen: () => `${svgOpen}
      <defs><linearGradient id="sc-b-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7ab8e0"/><stop offset="1" stop-color="#f4e0b0"/></linearGradient></defs>
      <rect width="400" height="240" fill="url(#sc-b-sky)"/>
      <circle cx="80" cy="150" r="30" fill="#ffd27a" opacity=".85"/>
      <rect x="0" y="150" width="400" height="90" fill="#2a6a8e"/>
      ${waves(172)}
      <g class="sc-bob">${embed(SF.ships.sideSVG(SF.state.ship.type, SF.cosmetics ? SF.cosmetics.shipColors() : null), 120, 74, 170, 170 * 92 / 120)}${klabauter(268, 120, 30)}</g>
      <g transform="translate(350 60)"><circle r="30" fill="#f4ead0" stroke="#5a3a10" stroke-width="2"/>
        <path d="M0 -24 L5 0 L0 24 L-5 0 Z" fill="#5a3a10"/><path d="M-24 0 L0 -5 L24 0 L0 5 Z" fill="#8a6a4a"/>
        <path d="M0 0 L17 -17" stroke="#c0392b" stroke-width="4" stroke-linecap="round" class="sc-twinkle"/>
        <text y="-31" text-anchor="middle" font-size="9" font-weight="700" fill="#5a3a10">N</text></g>
    </svg>`,
  };

  // ---------- Bildergeschichte abspielen ----------

  let queue = [];
  let index = 0;
  let onDone = null;

  // scenes: [{ art: 'hafen', text: 'HTML' }] – done wird nach dem letzten Bild (oder Überspringen) aufgerufen
  function play(scenes, done) {
    queue = scenes;
    index = 0;
    onDone = done;
    SF.ui.show('story');
    render();
  }

  function render() {
    const scene = queue[index];
    const pic = SF.ui.$('story-picture');
    const text = SF.ui.$('story-text');
    pic.innerHTML = (ART[scene.art] || ART.hafen)();
    text.innerHTML = scene.text;
    SF.ui.$('story-count').textContent = `${index + 1} / ${queue.length}`;
    SF.ui.$('story-next').textContent = index === queue.length - 1 ? (scene.last || 'Weiter') : 'Weiter ›';
    const box = SF.ui.$('story-card');
    box.classList.remove('turn');
    void box.offsetWidth;
    box.classList.add('turn');
    if (scene.sound && SF.sound) SF.sound.play(scene.sound);
  }

  function next() {
    if (!queue.length) return;
    SF.sound.play('page');
    if (index < queue.length - 1) {
      index++;
      render();
    } else {
      finish();
    }
  }

  function finish() {
    const done = onDone;
    queue = [];
    onDone = null;
    if (done) done();
  }

  function bind() {
    SF.ui.$('story-next').addEventListener('click', e => { e.stopPropagation(); next(); });
    SF.ui.$('story-picture').addEventListener('click', next);
    SF.ui.$('story-skip').addEventListener('click', e => {
      e.stopPropagation();
      SF.sound.play('tap');
      finish();
    });
  }

  // ---------- Texte des Prologs ----------

  function prologScenes() {
    const gk = SF.state.gk;
    const name = SF.escape(SF.state.captain.name || 'Kapitän');
    const scenes = [
      { art: 'hafen', sound: 'bell', text: `<p><b>Port Dublone</b> – der reichste Hafen aller Meere. Seit dem großen Dublonen-Urknall hat hier jeder
        Septilliarden in der Tasche.</p>` + (gk
        ? `<p>Auch du, <b>${name}</b>: <b>${SF.formatLong(gk.money)}</b> Dublonen!</p>`
        : '<p>Nur du nicht: Du bist gerade erst angekommen, mit <b>10.000 Dublonen</b> Erspartem.</p>') },
      { art: 'tresor', text: '<p>Im Tresor der Hafenbank liegt die <b>Goldene Dublone</b>. Solange sie dort liegt, ist jede Dublone etwas wert.</p>' },
      { art: 'nacht', sound: 'sinister', text: '<p>Doch in einer nebligen Nacht gleitet ein Schiff mit <b>schwarzen Segeln</b> in den Hafen. Ein Schatten schleicht in den Tresor …</p>' },
      { art: 'morgen', sound: 'sinister', text: '<p>Am Morgen ist der Tresor leer. <b>Die Goldene Dublone ist gestohlen!</b></p>' + (gk && gk.ships.length
        ? `<p>Und noch schlimmer: Deine Flotte – ${gk.ships.map(SF.gk.shipName).join(', ')} – ist auch verschwunden!</p>` : '') },
      { art: 'inflation', text: `<p>Ohne die Goldene Dublone ist das Geld nichts mehr wert. Die Preise <b>verdoppeln sich alle paar Sekunden</b>.
        Ein Brot kostet schon eine Sextilliarde! Kinder bauen Türme aus Geldsäcken.</p>` },
      { art: 'klabauter', last: 'Los geht’s!', text: `<p>„Psst! Ich bin der <b>Klabautermann</b>. Ich wohne auf jedem guten Schiff – bald auf deinem!
        Kauf schnell ein Schiff und Vorräte, solange deine Dublonen noch etwas wert sind. Dann holen wir uns die Goldene Dublone zurück!“</p>` },
    ];
    return scenes;
  }

  function eveningScenes(result) {
    const rest = result.leftover > 0 ? `<p>Übrig sind ${SF.dublonenHTML(result.leftover)} – damit kannst du deine Kajüte tapezieren.</p>` : '';
    return [
      { art: 'abend', sound: 'bell', text: `<p>Am Abend sind die alten Dublonen nur noch Papier. Die Hafenbank tauscht:
        <b>1 Billion Dublonen gegen 1 Bernstein</b> – höchstens 25 pro Person. Ab jetzt zählt <b>Bernstein</b>, das Gold des Nordens.</p>
        <p>Du bekommst ${SF.amberHTML(result.exchange)} aus dem Umtausch und ${SF.amberHTML(result.amber - result.exchange)} Notgroschen vom Klabautermann.</p>${rest}` },
      { art: 'ablegen', sound: 'horn', last: 'Leinen los!', text: `<p>„Der Dieb ist mit schwarzen Segeln nach <b>Nordosten</b> gesegelt“, flüstert der Klabautermann.
        „In der <b>Bernsteinbucht</b> hat ihn vielleicht jemand gesehen. Leinen los!“</p>` },
    ];
  }

  SF.story = { STEPS, step, reached, goal, goalText, setStep, log, day, flag, setFlag, play, next, bind, prologScenes, eveningScenes, ART };
})();
