// Story-Kapitel: Leute in den Kneipen der Häfen, die je nach Story-Schritt etwas anderes sagen.
// Kapitel 1 „Die Spur“: Frieda, Einauge Ede mit dem Salz-Auftrag, das verlassene Lager an der Vulkaninsel.
// Kapitel 2 „Kalte Spur“: Smutje Fiete kommt an Bord, im Eismeer steckt eine Galeone im Eis – mit dem Logbuch von „L. J.“.
// Kapitel 3 „Der Verräter“ und das Finale (js/finale.js). Nach dem ersten Ende geht es weiter:
// Kapitel 4 „Der Auftraggeber“: Long John packt im Kerker aus – hinter allem steckt der Bernstein-Baron. Seine Kuriere
// entern, die Briefe mit dem Codebuch aus dem Wrack am Riff entschlüsseln.
// Kapitel 5 „Die Bernsteinfestung“: über den Burggraben in die Festung, dann das Flaggschiff „Goldene Gier“ entern.
// Kapitel 6 „Der lange Winter“: Das Eismeer wächst, Port Dublone friert zu. Vorräte sammeln und die Flotte durch das
// Sturmtor im Süden führen – in eine neue Karte.
// Kapitel 7 „Die Smaragdsee“: Neu-Dublone gründen, die Quelle auf der Quelleninsel finden, den Krakenkönig versenken.
// Außerdem: Crew zum Anheuern (Kanonierin Karla, Navigator Nils).
window.SF = window.SF || {};

(function () {
  // Figuren-Codes wie in Gamble Klicker (js/figure.js)
  const PEOPLE = {
    hinnerk: { name: 'Hafenmeister Hinnerk', fig: '0.3.7.3.7.0.5' },
    berta: { name: 'Bäckerin Berta', fig: '2.10.0.0.4.7.0' },
    frieda: { name: 'Fischerin Frieda', fig: '1.2.0.0.0.8.0' },
    ede: { name: 'Einauge Ede', fig: '0.2.1.4.2.4.3' },
    bruno: { name: 'Bootsmann Bruno', role: 'Bootsmann', fig: '2.9.0.2.0.0.0' },
    jan: { name: 'Schiffsjunge Jan', role: 'Schiffsjunge', fig: '0.6.6.5.4.6.0' },
    longjohn: { name: 'Long John', fig: '1.1.3.3.2.4.1' }, // Dreispitz, Monokel, Schnurrbart, Papagei
    mira: { name: 'Perlentaucherin Mira', fig: '2.10.6.0.4.8.0' },
    baron: { name: 'Der Bernstein-Baron', fig: '0.5.3.3.1.6.2' }, // Zylinder, Monokel, Schnurrbart, Anzug in Gold, Goldkette
  };

  // Crew-Mitglieder sprechen auch in den Kneipen (js/crew.js)
  const who = id => PEOPLE[id] || (SF.crew && SF.crew.CREW[id]);

  const step = () => SF.story.step();
  const name = () => SF.escape(SF.state.captain.name || 'Kapitän');

  // Gerücht des Tages: wo eine Ware billig ist und wo man sie gut verkauft
  function rumor() {
    const goods = SF.trade.GOODS;
    const g = goods[(SF.trade.day() + 2) % goods.length];
    const b = SF.trade.best(g.id);
    if (b.cheap.h === b.dear.h) return '';
    const P = SF.world.placeById;
    return `Man erzählt sich: ${SF.icon(g.icon)} <b>${g.name}</b> gibt es gerade in <b>${P[b.cheap.h].name}</b> für ${SF.amberHTML(b.cheap.buy)} –
      in <b>${P[b.dear.h].name}</b> zahlen sie ${SF.amberHTML(b.dear.sell)} dafür.`;
  }

  // Wer sitzt in der Kneipe und was sagt er? → [{ who, text, action: { id, label, disabled } }]
  function tavern(h) {
    const out = [];
    const s = SF.state;
    if (h === 'dublone') {
      const before = ['find-amberbay', 'find-smuggler', 'salt-quest'].includes(step());
      out.push({ who: 'hinnerk', text: before
        ? 'Die Bernsteinbucht liegt im <b>Nordosten</b>. Kleiner Tipp vom Hafenmeister: Die Fischer dort brauchen <b>Salz</b> – und Salz ist bei uns billig!'
        : 'Seit die Dublone nichts mehr wert ist, zahlen alle mit Bernstein. Verrückte Zeiten, Käpt’n!' });
      out.push({ who: 'berta', text: s.lastDay && s.lastDay.bread
        ? `Du hast gestern ${s.lastDay.bread} Brote gekauft – für ${SF.formatLong(s.lastDay.start * 0.0003 * s.lastDay.bread)} Dublonen oder so. Heute kostet eins 1 Bernstein. Ha!`
        : 'Gestern kostete ein Brot eine Sextilliarde. Heute einen Bernstein. Ich komm nicht mehr mit!' });
    }
    if (h === 'dublone' && step() === 'jail') {
      const rum = s.cargo.rum || 0;
      out.unshift({ who: 'longjohn', text: `<span class="muted small">(Im Hafenkerker, durch das Gitter.)</span> Na, ${name()}? Du denkst, ich hätte mir das alles
        allein ausgedacht? Ha! Ich war nur die Hand. Der <b>Kopf</b> sitzt woanders und lacht sich reich. Aber im Kerker gibt es nur Wasser …
        Bring mir <b>2 Kisten Rum</b>, dann erzähl ich dir alles. Du hast ${rum}.`,
        action: { id: 'lj-rum', label: `${SF.icon('rum')} 2 Kisten Rum geben`, disabled: rum < 2 } });
    } else if (h === 'dublone' && SF.story.reached('couriers') && !SF.story.reached('done2')) {
      out.unshift({ who: 'longjohn', text: '<span class="muted small">(Im Hafenkerker.)</span> Der Baron hat mir ein eigenes Schiff versprochen. Bekommen hab ich ein Gitter. Hol ihn dir, Käpt’n – und grüß ihn von mir!' });
    } else if (h === 'dublone' && SF.story.reached('done2')) {
      out.unshift({ who: 'longjohn', text: '<span class="muted small">(Im Hafenkerker.)</span> Der Baron sitzt jetzt in der Zelle nebenan und zählt den ganzen Tag Kieselsteine. Wenigstens hab ich jemanden zum Würfeln – und diesmal gewinne ich!' });
    }
    // Kapitel 6: der lange Winter
    if (h === 'dublone' && step() === 'winter') {
      out.unshift({ who: 'hinnerk', text: `${name()}, sieh dir den Hafen an: <b>Eis an den Pollern</b>, mitten im Sommer! Das Eismeer wächst jeden Tag ein Stück
        nach Süden. In ein paar Wochen sitzt hier jedes Schiff fest. Wir müssen <b>fort</b> – alle. Die alten Karten zeigen ganz im Süden ein
        <b>Sturmtor</b>, und dahinter eine warme See. Aber niemand hat sich je hindurchgewagt. Führst du uns?`,
        action: { id: 'exodus-plan', label: 'Ich führe die Flotte!' } });
    } else if (h === 'dublone' && step() === 'supplies') {
      const n = supplies();
      const give = Math.min(NEED.fish - n.fish, s.cargo.fish || 0) + Math.min(NEED.cloth - n.cloth, s.cargo.cloth || 0);
      out.unshift({ who: 'hinnerk', text: `Für die große Fahrt brauchen wir <b>6 Kisten Fisch</b> (Proviant für alle) und <b>4 Kisten Tuch</b> (neue Segel).
        Bisher: Fisch ${n.fish} von ${NEED.fish}, Tuch ${n.cloth} von ${NEED.cloth}. Fisch gibt es billig in der Bernsteinbucht, Tuch hier bei uns.`,
        action: { id: 'give-supplies', label: `${SF.icon('crate')} Vorräte abgeben`, disabled: give <= 0 } });
    } else if (h === 'dublone' && step() === 'exodus') {
      out.unshift({ who: 'hinnerk', text: 'Alle Schiffe sind beladen, ganz Port Dublone ist an Bord. Wir folgen deinem Kielwasser zum <b>Sturmtor im Süden</b>. Wenn du durch bist, gibt es kein schnelles Zurück – erledige vorher, was du hier noch erledigen willst!' });
    }
    // Kapitel 7: die Smaragdsee
    if (h === 'haven') {
      out.push({ who: 'hinnerk', text: step() === 'water'
        ? 'Hütten bauen wir im Nu – aber ohne <b>Trinkwasser</b> hält es hier keiner aus. Die Perlentaucher erzählen von einer <b>Quelleninsel im Südwesten</b>. Geh dort an Land und finde die Quelle!'
        : step() === 'kraken'
          ? 'Wasser haben wir, Fisch gäbe es genug – aber kein Boot traut sich hinaus. Am <b>Krakengrund im Nordwesten</b> haust der Krakenkönig. Kanonen, Käpt’n. Viele Kanonen.'
          : 'Neu-Dublone! Der Wegweiser steht schon, die Hafenbank bekommt gerade ihr Dach. Und kein einziges Stück Eis weit und breit.' });
      out.push({ who: 'berta', text: 'Kokosbrot! Hab ich hier erfunden. Kostet einen Bernstein – wie daheim. Nur wärmer.' });
    }
    if (h === 'pearlport') {
      out.push({ who: 'mira', text: step() === 'kraken'
        ? 'Der Krakenkönig? Den kann man nicht entern – der hat kein Deck! Bleib in Bewegung, zeig ihm die Breitseite und halt Abstand von seinen Fangarmen. Wenn er Tinte spuckt: ausweichen!'
        : 'Willkommen im Perlenhafen! In der <b>Türkislagune</b> im Norden liegen die schönsten Muscheln der Smaragdsee. Und im Süden und Osten kreuzen Korsaren mit grünen Segeln – die entert man am besten, die haben volle Laderäume.' });
    }
    if (h === 'dublone' && step() === 'hire-cook' && !SF.crew.has('fiete')) {
      out.push({ who: 'fiete', text: `Moin, ${name()}! Ich bin <b>Fiete</b>, Smutje. Ich hab gehört, du willst ins <b>Eismeer</b>? Ohne warme Suppe
        erfriert deine Crew da oben! Nimm mich mit – mit mir hält der Proviant ein Viertel länger. Und ich will nicht mal Heuer.`,
        action: { id: 'fiete-join', label: 'Willkommen an Bord, Fiete!' } });
    }
    hireable(h).forEach(id => {
      const c = SF.crew.CREW[id];
      out.push({ who: id, text: `Ich bin ${c.role === 'Kanonierin' ? 'die beste Kanonierin' : 'der beste Navigator'} zwischen hier und dem Eismeer.
        Für ${SF.amberHTML(c.price)} Heuer komme ich mit. <span class="muted small">(${c.bonus})</span>`,
        action: { id: 'hire-' + id, label: `Anheuern für ${SF.amberHTML(c.price)}`, disabled: !SF.amber.can(c.price) } });
    });
    if (h === 'amberbay') {
      if (step() === 'find-amberbay') {
        out.push({ who: 'frieda', text: `Ein Schiff mit <b>schwarzen Segeln</b>? Ja! Das lag vor drei Tagen hier und hat Proviant geholt.
          Bezahlt hat der Kapitän mit einer <b>goldenen Münze, so groß wie ein Teller</b>! Dann ist es nach <b>Südosten</b> gesegelt – zur Schmugglerinsel.`,
          action: { id: 'frieda-thanks', label: 'Danke, Frieda!' } });
      } else if (step() === 'traitor' && !clue('bottle')) {
        out.push({ who: 'frieda', text: `Du suchst jemanden, der heimlich Nachrichten verschickt? Neulich nachts hat einer von <b>deinem Schiff</b>
          eine <b>Flaschenpost</b> ins Meer geworfen. Wer? Ich hab nur gesehen, dass er eine <b>Schürze</b> trug – und nach Zwiebeln roch.`,
          action: { id: 'clue-bottle', label: 'Das merke ich mir!' } });
      } else {
        out.push({ who: 'frieda', text: 'Bei uns gibt es Fisch, so viel du willst. Nur Salz fehlt immer, um ihn haltbar zu machen. Und nach Stürmen findet man Bernstein am Strand!' });
      }
    }
    if (h === 'smuggler') {
      if (step() === 'find-smuggler' || step() === 'find-amberbay') {
        out.push({ who: 'ede', text: `Das schwarze Schiff? Vielleicht weiß ich was … Aber Reden macht durstig. Und mein Fisch verdirbt, mir ist das Salz ausgegangen.
          Bring mir <b>3 Kisten Salz</b>, dann erzähl ich dir alles.`, action: { id: 'ede-quest', label: 'Abgemacht!' } });
      } else if (step() === 'salt-quest') {
        const have = s.cargo.salt || 0;
        out.push({ who: 'ede', text: have >= 3
          ? 'Ist das … Salz? Drei Kisten? Her damit!'
          : `Na, ${name()}? Wo bleibt mein Salz? <b>3 Kisten</b> will ich sehen. Du hast ${have}. In Port Dublone ist Salz billig.`,
          action: { id: 'ede-salt', label: `${SF.icon('salt')} 3 Kisten Salz geben`, disabled: have < 3 } });
      } else if (step() === 'decode') {
        out.push({ who: 'ede', text: `Zeig her … Das ist die <b>Geheimschrift des Barons</b>! Die liest keiner ohne sein Codebuch.
          Aber ich weiß, wo eins liegt: Letzten Winter ist einer seiner Kuriere am <b>Korallenriff</b> auf Grund gelaufen. Das Wrack liegt noch da unten –
          und das Codebuch steckt in einer wasserdichten Kapsel. Du musst nur <b>tauchen</b>.`,
          action: { id: 'ede-code', label: 'Auf zum Korallenriff!' } });
      } else if (step() === 'traitor' && !clue('cook')) {
        const fish = s.cargo.fish || 0;
        out.push({ who: 'ede', text: `Ein Verräter auf deinem Schiff? Ich kenne jeden, der je für Long John gearbeitet hat …
          Aber umsonst rede ich nicht. Bring mir <b>2 Kisten Fisch</b> – du hast ${fish}. Die Bernsteinbucht hat Fisch genug.`,
          action: { id: 'clue-cook', label: `${SF.icon('fish')} 2 Kisten Fisch geben`, disabled: fish < 2 } });
      } else {
        out.push({ who: 'ede', text: 'Rum und Gewürze, billig wie nirgends. Frag nicht, woher. Und erzähl keinem, dass du mich kennst.' });
      }
    }
    const r = rumor();
    if (r) out.push({ who: 'klabauter', text: r });
    return out;
  }

  // Wer lässt sich hier anheuern? (erst ab Kapitel 2, damit es am Anfang übersichtlich bleibt)
  function hireable(h) {
    if (!chapter2()) return [];
    return Object.keys(SF.crew.CREW).filter(id => {
      const c = SF.crew.CREW[id];
      return c.price && c.harbor === h && !SF.crew.has(id) && SF.crew.data()[id] !== 'gone';
    });
  }

  const chapter2 = () => SF.story.reached('hire-cook') || !!SF.state.story.flags.chapter2;

  // Aktion in der Kneipe; gibt einen Text für die Meldung zurück (oder '')
  function act(h, id) {
    const s = SF.state;
    if (id === 'fiete-join' && h === 'dublone' && step() === 'hire-cook') {
      SF.crew.join('fiete');
      SF.story.setStep('find-ice', 'Smutje Fiete ist an Bord. Mit warmer Suppe geht es ins Eismeer!');
      SF.sound.play('fanfare');
      return 'Fiete ist an Bord! Neues Ziel: das Eismeer im Norden.';
    }
    if (id === 'exodus-plan' && h === 'dublone' && step() === 'winter') {
      s.story.flags.supplies = { fish: 0, cloth: 0 };
      SF.story.setStep('supplies', 'Hafenmeister Hinnerk: Port Dublone muss fort, bevor der Hafen zufriert. Die Flotte braucht Fisch und Tuch.');
      SF.sound.play('discover');
      SF.track('seefahrer-kapitel6-begonnen');
      return 'Sammle 6 Kisten Fisch und 4 Kisten Tuch für die große Fahrt.';
    }
    if (id === 'give-supplies' && h === 'dublone' && step() === 'supplies') {
      const n = supplies();
      let given = 0;
      ['fish', 'cloth'].forEach(g => {
        const k = Math.min(NEED[g] - n[g], s.cargo[g] || 0);
        if (k <= 0) return;
        s.cargo[g] -= k;
        if (!s.cargo[g]) delete s.cargo[g];
        n[g] += k;
        given += k;
      });
      if (!given) return '';
      SF.sound.play('coin');
      if (n.fish >= NEED.fish && n.cloth >= NEED.cloth) {
        const a = SF.amber.add(120);
        SF.story.setStep('exodus', 'Die Vorräte sind an Bord. Die Flotte von Port Dublone folgt mir zum Sturmtor im Süden.');
        SF.sound.play('fanfare');
        setTimeout(() => SF.ui.dialog({
          title: `${SF.icon('ship')} Die Flotte ist bereit`,
          html: `<p>Die letzten Kisten verschwinden in den Laderäumen. Ganz Port Dublone hat zusammengelegt: ${SF.amberHTML(a)} für dich, „für die Lotsenarbeit“.</p>
            <p>Bäckerin Berta nagelt den Wegweiser <b>„Port Dublone“</b> vom Steg ab und klemmt ihn unter den Arm. „Den nehmen wir mit“, sagt sie.</p>
            <p><b>Neues Ziel: das Sturmtor ganz im Süden.</b> <span class="muted small">Dahinter liegt eine neue Karte – erst später gibt es einen Weg zurück.</span></p>`,
          buttons: [{ label: 'Leinen los!', value: true, kind: 'primary' }],
        }), 200);
        return '';
      }
      SF.save();
      return `${given} Kiste${given > 1 ? 'n' : ''} abgegeben. Noch: Fisch ${NEED.fish - n.fish}, Tuch ${NEED.cloth - n.cloth}.`;
    }
    if (id === 'lj-rum' && h === 'dublone' && step() === 'jail' && (s.cargo.rum || 0) >= 2) {
      s.cargo.rum -= 2;
      if (!s.cargo.rum) delete s.cargo.rum;
      s.story.flags.letters = 0;
      SF.story.setStep('couriers', 'Long John hat ausgepackt: Der Bernstein-Baron hat den Raub bestellt. Seine Kuriere tragen seine Befehle über das Meer.');
      SF.sound.play('fanfare');
      SF.track('seefahrer-kapitel4-begonnen');
      setTimeout(() => SF.ui.dialog({
        title: 'Long John packt aus',
        html: `<p>Long John nimmt einen tiefen Schluck. „Der Mann heißt <b>Bernstein-Baron</b>. Vor dem Raub hat er heimlich
          <b>allen Bernstein</b> zwischen hier und dem Eismeer aufgekauft – für ein paar Dublonen. Dann hat er mich bezahlt, damit ich die
          Goldene Dublone stehle.“</p>
          <p>„Verstehst du? Die Dublone wird wertlos, alle müssen mit Bernstein zahlen – und <b>ihm gehört der ganze Bernstein</b>.
          Der reichste Mann der Welt, über Nacht!“</p>
          <p>„Wo er wohnt, weiß keiner. Aber seine Befehle schickt er mit <b>Kurierschiffen</b> – schnelle Briggs mit <b>goldenen Segeln</b>,
          östlich von hier. Versenken nützt dir nichts, dann sinken die Briefe mit. <b>Entern</b> musst du sie!“</p>`,
        buttons: [{ label: 'Den Baron hole ich mir!', value: true, kind: 'primary' }],
      }), 200);
      return '';
    }
    if (id === 'ede-code' && h === 'smuggler' && step() === 'decode') {
      SF.story.setStep('codebook', 'Einauge Ede: Das Codebuch des Barons liegt in einem Wrack am Korallenriff.');
      SF.sound.play('discover');
      return 'Neues Ziel: am Korallenriff nach dem Codebuch tauchen!';
    }
    if (id === 'clue-bottle' && h === 'amberbay' && step() === 'traitor') {
      addClue('bottle');
      return 'Hinweis: Jemand mit Schürze wirft Flaschenpost ins Meer.';
    }
    if (id === 'clue-cook' && h === 'smuggler' && step() === 'traitor' && (s.cargo.fish || 0) >= 2) {
      s.cargo.fish -= 2;
      if (!s.cargo.fish) delete s.cargo.fish;
      addClue('cook');
      setTimeout(() => SF.ui.dialog({
        title: 'Einauge Ede packt aus',
        html: `<p>„Long Johns alter Schiffskoch? Na klar kenn ich den! Ein freundlicher Kerl, kocht die beste Fischsuppe der sieben Meere …
          heißt <b>Fiete</b>. Hat jahrelang auf Long Johns Schiff gekocht. Wieso fragst du?“</p>`,
        buttons: [{ label: 'Fiete …?!', value: true, kind: 'primary' }],
      }), 200);
      return '';
    }
    if (id.startsWith('hire-')) {
      const c = id.slice(5);
      if (!hireable(h).includes(c)) return '';
      if (!SF.crew.hire(c)) { SF.sound.play('denied'); return 'Zu wenig Bernstein für die Heuer.'; }
      SF.story.log(`${SF.crew.CREW[c].name} angeheuert.`);
      SF.sound.play('fanfare');
      return `${SF.crew.CREW[c].name} ist an Bord!`;
    }
    if (id === 'frieda-thanks' && h === 'amberbay' && step() === 'find-amberbay') {
      SF.story.setStep('find-smuggler', 'Fischerin Frieda in der Bernsteinbucht: Das schwarze Schiff ist zur Schmugglerinsel im Südosten gesegelt.');
      SF.sound.play('discover');
      return 'Neues Ziel: die Schmugglerinsel im Südosten!';
    }
    if (id === 'ede-quest' && h === 'smuggler' && (step() === 'find-smuggler' || step() === 'find-amberbay')) {
      SF.story.setStep('salt-quest', 'Einauge Ede auf der Schmugglerinsel will 3 Kisten Salz – dann erzählt er vom schwarzen Schiff.');
      SF.sound.play('tap');
      return (s.cargo.salt || 0) >= 3 ? 'Du hast ja schon Salz an Bord!' : 'Salz gibt es billig in Port Dublone.';
    }
    if (id === 'ede-salt' && h === 'smuggler' && step() === 'salt-quest' && (s.cargo.salt || 0) >= 3) {
      s.cargo.salt -= 3;
      if (!s.cargo.salt) delete s.cargo.salt;
      const n = SF.amber.add(40);
      SF.story.setStep('find-volcano', 'Einauge Ede: Die Crew des schwarzen Schiffs hat geprahlt – sie segeln zur Vulkaninsel im Norden.');
      SF.sound.play('fanfare');
      setTimeout(() => SF.ui.dialog({
        title: 'Einauge Ede erzählt',
        html: `<p>„Die Crew von dem schwarzen Schiff hat hier getrunken und geprahlt. Ihr Kapitän hätte <b>ganz Port Dublone</b> arm gemacht –
          und jetzt wollten sie zur <b>Vulkaninsel</b> im Norden, ihr Lager abbrechen.“</p>
          <p>„Wie der Kapitän heißt? Das sagt keiner. Sie nennen ihn nur <b>den Schatten</b>.“</p>
          <p>Ede gibt dir ${SF.amberHTML(n)} für das Salz.</p>`,
      }), 200);
      return '';
    }
    return '';
  }

  // Ort entdeckt (auf See)
  function onDiscover(id) {
    if (id === 'volcano' && step() === 'find-volcano') {
      const n = SF.amber.add(50);
      SF.story.setStep('hire-cook', 'An der Vulkaninsel: ein verlassenes Lager, ein Fetzen schwarzes Segel und eine Karte mit einem Kreuz im Eismeer.');
      SF.state.story.flags.chapter2 = true;
      SF.sound.play('fanfare');
      SF.track('seefahrer-stufe1-geschafft');
      setTimeout(() => SF.ui.dialog({
        title: 'Das verlassene Lager',
        html: `<p>An der Vulkaninsel findest du ein <b>verlassenes Lager</b>. Die Feuerstelle ist noch warm. An einem Felsen hängt ein Fetzen
          <b>schwarzes Segel</b>, daneben liegt eine zerrissene Karte – mit einem Kreuz mitten im <b>Eismeer</b>.</p>
          <p>Im Sand findest du ${SF.amberHTML(n)}, die der Schatten wohl verloren hat.</p>
          <p>„Wir sind ihm auf den Fersen!“, flüstert der Klabautermann. „Aber im Eismeer erfrieren wir ohne warmes Essen.
          In Port Dublone sucht ein Schiffskoch Arbeit – den holen wir uns!“</p>`,
        buttons: [{ label: 'Weiter segeln', value: true, kind: 'primary' }],
      }), 300);
    }
  }

  // Insel geschafft (js/island.js); gibt Text für das Fenster zurück oder ''
  function onIsland(id) {
    const s = SF.state;
    if (id === 'ice' && step() === 'find-ice') {
      const mine = s.gk && s.gk.ships.includes('galleon');
      SF.crew.addShip('galleon');
      s.story.flags.longjohn = true;
      SF.story.setStep('traitor', 'Im Eismeer: eine Galeone im Eis und das Logbuch von „L. J.“ – Long John! Jemand an Bord verrät uns.');
      SF.track('seefahrer-kapitel2-geschafft');
      return `<p>Hinter der Schatzkiste ragt ein Mast aus dem Eis: Da steckt eine <b>Galeone</b> fest! ${mine
        ? 'Das ist <b>deine alte Galeone aus Gamble Klicker</b>!'
        : 'Der Schatten hat sie wohl gestohlen und hier zurückgelassen.'} Die Crew hackt sie frei – sie liegt jetzt in der Werft, du kannst jederzeit umsteigen.</p>
        <p>In der Kajüte liegt ein gefrorenes Logbuch: <i>„Beute zur Drachenküste. Der Holländer wartet im Nebel.
        Unser Mann an Bord des Kapitäns verrät uns jeden Kurs. – L. J.“</i></p>
        <p>L. J.? Das kann nur <b>Long John</b> sein – ${s.gk ? 'der Computer-Gegner, der in Gamble Klicker immer gegen dich verloren hat' : 'der Pirat, der in Port Dublone beim Würfeln immer verloren hat'}!
        Und „unser Mann an Bord“ … <b>Jemand aus deiner Crew ist ein Verräter!</b></p>`;
    }
    if (id === 'dragon' && step() === 'find-dragon') {
      // Zweites Schiff der alten Flotte: das beste aus Gamble Klicker, das man noch nicht hat (sonst Bernstein)
      const order = ['frigate', 'brig', 'sloop'];
      const want = s.gk ? order.find(t => s.gk.ships.includes(t) && s.ship.type !== t && !SF.crew.fleet().some(f => f.type === t)) : null;
      const ship = want && SF.crew.addShip(want) ? want : '';
      const amber = ship ? 0 : SF.amber.add(120);
      SF.story.setStep('finale', 'An der Drachenküste: Long Johns Versteck ist leer – er ist mit dem Fliegenden Holländer ins Nebelmeer geflohen.');
      SF.track('seefahrer-kapitel3-geschafft');
      return `<p>Hinter dem Lavastrom liegt <b>Long Johns Höhle</b>. Kisten voller Beute aus Port Dublone –
        ${ship ? `und im Wasser davor schaukelt <b>deine alte ${SF.ships.byId[ship].name} aus Gamble Klicker</b>! Sie liegt jetzt in deiner Werft.` : `und ${SF.amberHTML(amber)} gehören jetzt dir.`}</p>
        <p>Aber Long John ist weg. An der Wand hängt ein Zettel: <i>„Zu spät, Landratte! Der Holländer bringt mich und die Goldene Dublone ins
        <b>Nebelmeer</b>. Dort findet mich niemand. – L. J.“</i></p>`;
    }
    if (id === 'spring' && step() === 'water') {
      const n = SF.amber.add(80);
      s.story.flags.lairLeft = true;
      SF.story.setStep('kraken', 'Die Quelle auf der Quelleninsel ist gefunden! Aber vor Neu-Dublone lauert der Krakenkönig.');
      SF.track('seefahrer-quelle-gefunden');
      return `<p>Hinter der Truhe plätschert es: eine <b>Quelle</b>, klar und kalt, mitten im Dschungel! Die Siedler von Neu-Dublone legen eine
        Wasserleitung aus Bambus – und schenken dir zum Dank ${SF.amberHTML(n)}.</p>
        <p>Am Strand wartet eine Perlentaucherin. „Wasser habt ihr jetzt. Aber fischen könnt ihr hier nicht: Am <b>Krakengrund im Nordwesten</b>
        haust der <b>Krakenkönig</b>. Er zieht jedes Boot in die Tiefe.“</p>
        ${s.gk ? '<p class="muted small">Der Krakenkönig … den kennst du doch aus Gamble Klicker!</p>' : ''}`;
    }
    if (id === 'fort' && step() === 'find-fort') {
      const n = SF.amber.add(150);
      s.story.flags.fortLeft = true;
      SF.story.setStep('baron', 'In der Bernsteinfestung: Die Schatzkammer ist halb leer – der Baron flieht mit seinem Flaggschiff „Goldene Gier“!');
      SF.track('seefahrer-festung-geschafft');
      return `<p>Hinter der letzten Mauer liegt die <b>Schatzkammer des Barons</b>: Bernstein bis unter die Decke! Du steckst ein, was du tragen kannst:
        ${SF.amberHTML(n)}.</p>
        <p>Auf dem Schreibtisch liegt ein Hauptbuch: <i>„Bernstein gekauft: alles. Bezahlt an L. J.: 1 Schiff (nie geliefert).
        Nächster Schritt: die Goldene Dublone einschmelzen.“</i></p>
        <p>Da dröhnt ein Horn vom Hafen: Der Baron hat dich bemerkt und läuft mit seinem Flaggschiff aus. <b>Zurück aufs Schiff – hinterher!</b></p>`;
    }
    if (id === 'fort' && !SF.story.reached('find-fort')) {
      return '<p class="muted small">Hinter der Truhe geht es nicht weiter: ein schweres Tor mit einem Wappen aus Bernstein. Wer hier wohl wohnt?</p>';
    }
    if (id === 'ice' && step() === 'hire-cook') {
      return '<p class="muted small">Im Eis steckt irgendetwas Großes fest – aber ohne warmes Essen hält es deine Crew hier nicht lange aus. Hol erst den Schiffskoch aus Port Dublone.</p>';
    }
    return '';
  }

  // ---------- Kapitel 3: Der Verräter ----------

  const CLUES = {
    flour: 'Weißer Staub an der Schiffskasse – Mehl?',
    bottle: 'Frieda sah jemanden mit Schürze nachts eine Flaschenpost werfen.',
    cook: 'Einauge Ede: Long Johns alter Schiffskoch heißt Fiete.',
  };
  const clues = () => {
    const f = SF.state.story.flags;
    if (!f.clues || typeof f.clues !== 'object') f.clues = {};
    return f.clues;
  };
  const clue = id => !!clues()[id];
  const clueCount = () => Object.keys(CLUES).filter(clue).length;
  function addClue(id) {
    if (clue(id)) return false;
    clues()[id] = true;
    SF.story.log(`Hinweis: ${CLUES[id]}`);
    SF.sound.play('discover');
    return true;
  }

  // Wer steht unter Verdacht? Die Crew an Bord und zwei Matrosen
  const suspects = () => ['fiete', 'bruno', 'jan'].concat(SF.crew.members().filter(id => id !== 'fiete'));

  // Beim Anlegen: Aus der Schiffskasse fehlt Bernstein (höchstens einmal am Tag); gibt Text fürs Fenster zurück
  function onDock() {
    const s = SF.state;
    const f = s.story.flags;
    if (step() !== 'traitor' || !SF.crew.has('fiete')) return '';
    const day = SF.trade.day();
    if (f.theftDay === day && f.thefts) return '';
    const n = Math.min(30, Math.floor(s.amber * 0.1));
    if (n < 3) return '';
    SF.amber.spend(n);
    f.theftDay = day;
    f.thefts = (f.thefts || 0) + 1;
    f.stolen = (f.stolen || 0) + n;
    const first = addClue('flour');
    return `<p>Die Schiffskasse ist leichter als gestern: Es fehlen ${SF.amberHTML(n)}!</p>${first
      ? '<p>Auf dem Deckel liegt feiner <b>weißer Staub</b>. Mehl? Wer an Bord hat mit Mehl zu tun …?</p>' : ''}
      <p class="muted small">Sammle Hinweise in den Kneipen. In der Kajüte kannst du den Verräter anklagen.</p>`;
  }

  // Anklage in der Kajüte: { ok, html }
  function accuse(id) {
    const s = SF.state;
    if (step() !== 'traitor' || !suspects().includes(id)) return { ok: false, html: '' };
    const p = who(id);
    if (id !== 'fiete') {
      s.story.flags.wrong = (s.story.flags.wrong || 0) + 1;
      return { ok: false, html: `<p><b>${p.name}</b> ist empört: „Ich? Niemals, Käpt’n!“ Und tatsächlich – in der Koje findest du nichts.</p>
        <p class="muted small">Der Verräter ist noch an Bord. Sammle weitere Hinweise.</p>` };
    }
    const back = s.story.flags.stolen || 0;
    if (back) SF.amber.add(back);
    SF.crew.leave('fiete');
    SF.story.setStep('find-dragon', 'Fiete war der Verräter! Er hat gestanden: Long Johns Versteck ist an der Drachenküste.');
    SF.track('seefahrer-verraeter-gefunden');
    return { ok: true, html: `<p>In Fietes Kombüse, unter einem Sack Mehl: <b>der gestohlene Bernstein</b>${back ? ` – ${SF.amberHTML(back)}` : ''} und ein Stapel
      Flaschenpost-Zettel an „L. J.“. Fiete wird kreidebleich.</p>
      <p>„Es tut mir leid, Käpt’n! Long John hat mir versprochen, ich bekomme ein eigenes Gasthaus, wenn ich ihm jeden Kurs verrate …
      Sein Versteck ist an der <b>Drachenküste</b>, in einer Höhle hinter dem Lavastrom. Dort wartet er auf den <b>Fliegenden Holländer</b>!“</p>
      <p>Fiete muss im nächsten Hafen von Bord. Der Proviant hält jetzt wieder normal – aber die Schiffskasse ist sicher.</p>` };
  }

  // ---------- Kapitel 4: Der Auftraggeber ----------

  const LETTERS = 3;
  const letters = () => Math.max(0, Math.min(LETTERS, Math.floor(SF.state.story.flags.letters || 0)));

  // Nach einer Schlacht: Zusatz für das Ergebnis-Fenster (Briefe der Kuriere)
  function onBattle(p, result) {
    if (p && p.kind === 'baron' && step() === 'baron' && result !== 'boarded') {
      return `<p class="muted small">Die „Goldene Gier“ zieht sich in den Hafen der Festung zurück. Neuer Versuch: Fahr vor die
        <b>Bernsteinfestung</b> und tippe auf <b>„Goldene Gier herausfordern“</b>.</p>`;
    }
    if (!p || p.kind !== 'courier' || step() !== 'couriers') return '';
    if (result === 'sunk') return '<p class="muted small">Der Brief des Barons ist mit dem Schiff versunken. Kuriere musst du <b>entern</b>!</p>';
    if (result !== 'boarded') return '';
    const f = SF.state.story.flags;
    f.letters = letters() + 1;
    const n = letters();
    const texts = [
      '„… die Lieferung Bernstein geht wie immer an die <b>Festung</b>. Zahlt den Fischern die Hälfte, mehr nicht.“',
      '„… haltet euch von Port Dublone fern, seit dieser Kapitän die Dublone zurückgebracht hat. Ich hole sie mir <b>ein zweites Mal</b>.“',
      '„… die <b>Goldene Gier</b> liegt bereit. Wenn die Dublone erst eingeschmolzen ist, gibt es nur noch <b>mein</b> Geld.“',
    ];
    let html = `<p>In der Kajüte des Kuriers: ein versiegelter <b>Brief des Barons</b> (${n} von ${LETTERS}). Das meiste ist in Geheimschrift, nur ein Satz ist lesbar:</p>
      <p><i>${texts[n - 1]}</i></p>`;
    if (n >= LETTERS) {
      SF.story.setStep('decode', 'Drei Briefe des Barons erbeutet – aber wo die Festung liegt, steht dort in Geheimschrift.');
      html += '<p>Drei Briefe – aber <b>wo</b> die Festung liegt, steht in Geheimschrift da. „Einauge Ede kennt jede Schmuggler-Schrift“, sagt der Klabautermann. „Auf zur Schmugglerinsel!“</p>';
    } else SF.story.log(`Brief des Barons erbeutet (${n} von ${LETTERS}).`);
    return html;
  }

  // Nach dem Tauchen: das Codebuch aus dem Wrack (nur wenn man heil wieder oben ist)
  function onDive(site, ok) {
    if (site !== 'reef' || step() !== 'codebook') return '';
    if (!ok) return '<p class="muted small">Das Wrack hast du gesehen – aber ohne Luft kommst du nicht an das Codebuch. Tauche noch einmal und tauch rechtzeitig auf!</p>';
    SF.story.setStep('find-fort', 'Das Codebuch aus dem Wrack am Riff: Die Bernsteinfestung liegt auf einer Insel im Nordwesten.');
    SF.track('seefahrer-kapitel4-geschafft');
    return `<p>Zwischen den Korallen liegt das Wrack des Kuriers – und in der Kajüte eine Messingkapsel: <b>das Codebuch des Barons</b>!</p>
      <p>Der Klabautermann entschlüsselt die Briefe: <i>„… die Festung liegt auf der Insel im <b>Nordwesten</b>, nördlich der Nahen Bucht.
      Das Tor zum Hafen ist mit einer Kette gesperrt – nur der Burggraben an der Rückseite ist unbewacht.“</i></p>
      <p><b>Neues Ziel: die Bernsteinfestung!</b></p>`;
  }

  // ---------- Kapitel 5: Die Bernsteinfestung ----------

  const BARON_RANGE = 200;
  const BARON_LEAVE = 280; // nach einer Niederlage: so weit weg und wieder heran – oder vor der Festung herausfordern

  function baronShip() {
    const f = SF.world.placeById.fort;
    return { id: 'baron', kind: 'baron', name: 'Die Goldene Gier', x: f.x, y: f.y, cool: 0 };
  }

  // Läuft das Flaggschiff jetzt aus? (nach Niederlage oder Flucht erst wieder, wenn man weit weg war)
  function baronReady() {
    const s = SF.state;
    if (step() !== 'baron' || !s.pos || s.docked || SF.world.map() !== 'old') return false;
    const f = SF.world.placeById.fort;
    const d = Math.hypot(s.pos.x - f.x, s.pos.y - f.y);
    if (d > BARON_LEAVE) s.story.flags.fortLeft = true;
    return d <= BARON_RANGE && s.story.flags.fortLeft !== false;
  }

  function afterBaron(result) {
    if (result !== 'boarded') SF.state.story.flags.fortLeft = false;
  }

  // Hat sich die „Goldene Gier“ nach einem verlorenen Kampf in den Festungshafen zurückgezogen?
  function baronWaiting() {
    return step() === 'baron' && SF.state.story.flags.fortLeft === false;
  }

  // Vor der Festung herausfordern: die „Goldene Gier“ läuft sofort wieder aus (neuer Versuch)
  function challengeBaron() {
    if (step() !== 'baron') return false;
    SF.state.story.flags.fortLeft = true;
    return true;
  }

  function ending2Scenes() {
    return [
      { art: 'sieg', sound: 'fanfare', text: `<p>Der Zylinder des Barons rollt über das Deck der „Goldenen Gier“. „Das … das war alles ganz legal!“, stottert er.
        „Ich habe den Bernstein <b>gekauft</b>!“</p><p>„Und die Goldene Dublone <b>stehlen lassen</b>“, sagt Kapitän ${name()}.</p>` },
      { art: 'tresor', text: `<p>Im Bauch der Galeone liegt der Bernstein von der ganzen Küste. Du bringst ihn zurück: zu den Fischern der
        <b>Bernsteinbucht</b>, zu den Händlern von <b>Port Dublone</b> – sogar Einauge Ede bekommt einen Beutel.</p>
        <p>Die Hafenbank beschließt: Ab heute gilt beides, <b>Dublone und Bernstein</b>. Und niemand darf je wieder alles davon besitzen.</p>` },
      { art: 'fest', sound: 'bell', text: `<p>Der Baron zieht in den Hafenkerker – in die Zelle neben Long John. „Würfeln wir um deinen Zylinder?“, fragt der.</p>
        <p>Port Dublone feiert zum zweiten Mal. Diesmal backt Berta ein Brot, das so groß ist wie ein Beiboot.</p>` },
      { art: 'klabauter', last: 'Zum Abspann', text: `<p>„Zwei Schurken, ein Käpt’n“, grinst der Klabautermann. „Jetzt kennt dich jedes Kind zwischen Eismeer und Drachenküste.
        Und das Meer? Das ist immer noch groß …“</p>` },
    ];
  }

  // Zweites Ende: Belohnung, Bildergeschichte, Abspann, danach freies Segeln
  function ending2() {
    if (step() === 'baron') {
      SF.story.setStep('done2', 'Der Bernstein-Baron ist besiegt! Der Bernstein geht zurück an die Küste.');
      SF.meta.set('finished2', true);
      SF.track('seefahrer-baron-besiegt');
      SF.save();
    }
    SF.story.play(ending2Scenes(), () => SF.finale.credits());
  }

  // ---------- Kapitel 6 und 7: der lange Winter, die Smaragdsee ----------

  const NEED = { fish: 6, cloth: 4 }; // Vorräte für die große Fahrt
  function supplies() {
    const f = SF.state.story.flags;
    if (!f.supplies || typeof f.supplies !== 'object') f.supplies = { fish: 0, cloth: 0 };
    f.supplies.fish = Math.max(0, Math.min(NEED.fish, Math.floor(f.supplies.fish) || 0));
    f.supplies.cloth = Math.max(0, Math.min(NEED.cloth, Math.floor(f.supplies.cloth) || 0));
    return f.supplies;
  }

  // Auf die andere Karte wechseln: Nebel der alten Karte merken, am Sturmtor der neuen Karte ankommen
  function travel(id) {
    const s = SF.state;
    const from = SF.world.map();
    if (!SF.world.MAPS[id] || id === from) return false;
    if (!s.fogs || typeof s.fogs !== 'object') s.fogs = {};
    s.fogs[from] = SF.world.fogToString();
    SF.world.use(id);
    s.map = id;
    s.fog = s.fogs[id] || '';
    SF.world.fogFromString(s.fog);
    const gate = SF.world.placesOf(id).find(p => p.gate === from);
    s.pos = { x: gate.x, y: gate.y + (gate.y < SF.world.H / 2 ? 80 : -80), dx: 0, dy: gate.y < SF.world.H / 2 ? 1 : -1 };
    s.course = [];
    s.docked = '';
    s.pirates = [];
    s.flotsam = [];
    s.pirateClock = {};
    s.visited[gate.id] = s.visited[gate.id] || Date.now();
    SF.world.reveal(s.pos.x, s.pos.y);
    s.fog = SF.world.fogToString();
    return true;
  }

  // Darf man hier durch das Sturmtor? Beim Auszug (einmal, hin) und nach dem Krakenkönig jederzeit in beide Richtungen
  function gateOpen(p) {
    if (!p || !p.gate) return false;
    return (step() === 'exodus' && p.id === 'stormgate') || SF.story.reached('done3');
  }

  function crossingScenes() {
    return [
      { art: 'eis', text: `<p>Hinter euch knackt das Eis im Hafenbecken von <b>Port Dublone</b>. Dreißig Schiffe folgen deinem Kielwasser nach Süden –
        Fischerboote, Kähne, sogar Bertas schwimmender Backofen.</p>` },
      { art: 'nacht', sound: 'alarm', text: `<p>Dann das <b>Sturmtor</b>: eine Wand aus Wolken, Blitze von Horizont zu Horizont. „Segel reffen! Alle Mann an die Taue!“</p>
        <p>Drei Tage und drei Nächte tanzt die Flotte auf den Wellen. Niemand schläft. Der Klabautermann steht am Bug und singt gegen den Donner an.</p>` },
      { art: 'smaragd', sound: 'fanfare', last: 'Land in Sicht!', text: `<p>Am vierten Morgen reißt der Himmel auf. Das Wasser ist grün wie Glas, die Luft riecht nach Blüten,
        und am Horizont liegen Inseln voller Palmen.</p><p>„Die <b>Smaragdsee</b>“, flüstert der Klabautermann. „Es gibt sie wirklich.“</p>
        <p class="muted small">Kapitel 7: Die Smaragdsee</p>` },
    ];
  }

  // Durch das Sturmtor segeln (Knopf auf der Seekarte); done: danach (zurück zur Seekarte)
  function passGate(p, done) {
    if (!gateOpen(p)) return false;
    const first = step() === 'exodus';
    travel(p.gate);
    if (first) {
      SF.story.setStep('landfall', 'Durch das Sturmtor! Hinter dem Sturm liegt die Smaragdsee.');
      SF.track('seefahrer-smaragdsee-erreicht');
      SF.story.play(crossingScenes(), done);
    } else {
      SF.story.log(`Durch das Sturmtor in die ${SF.world.MAPS[p.gate].name}.`);
      SF.save();
      done();
    }
    return true;
  }

  // Ankunft in einem Hafen: { title, html } für ein Fenster (oder null)
  function onArrive(h) {
    if (h === 'haven' && step() === 'landfall') {
      SF.story.setStep('water', 'Neu-Dublone ist gegründet! Die Siedler brauchen Trinkwasser.');
      SF.sound.play('fanfare');
      return {
        title: `${SF.icon('flag')} Neu-Dublone`,
        html: `<p>Der Anker fällt in glasklares Wasser. Ein Schiff nach dem anderen läuft in die Bucht ein, und am Abend brennen dreißig Lagerfeuer am Strand.</p>
          <p>Bäckerin Berta rammt den alten Wegweiser in den Sand, malt vier Buchstaben davor und tritt zurück: <b>„Neu-Port Dublone“</b>.
          „Zu lang“, brummt Hinnerk. Also: <b>Neu-Dublone</b>.</p>
          <p>Nur eins fehlt: <b>Trinkwasser</b>. Die Fässer reichen noch ein paar Tage.</p>`,
      };
    }
    return null;
  }

  const KRAKEN_RANGE = 200;
  const KRAKEN_LEAVE = 300;

  function krakenShip() {
    const k = SF.world.placeById.krakenlair;
    return { id: 'kraken', kind: 'kraken', name: 'Der Krakenkönig', x: k.x, y: k.y, cool: 0 };
  }

  // Taucht der Krakenkönig auf? (nach einer Niederlage erst wieder, wenn man ein Stück weg war)
  function krakenReady() {
    const s = SF.state;
    if (step() !== 'kraken' || !s.pos || s.docked || SF.world.map() !== 'emerald') return false;
    const k = SF.world.placeById.krakenlair;
    const d = Math.hypot(s.pos.x - k.x, s.pos.y - k.y);
    if (d > KRAKEN_LEAVE) s.story.flags.lairLeft = true;
    return d <= KRAKEN_RANGE && s.story.flags.lairLeft !== false;
  }

  function afterKraken(result) {
    if (result !== 'sunk') SF.state.story.flags.lairLeft = false;
  }

  function ending3Scenes() {
    return [
      { art: 'sieg', sound: 'fanfare', text: `<p>Mit einem letzten Gurgeln versinkt der <b>Krakenkönig</b> in der Tiefe. Eine einzige Luftblase steigt auf –
        und darin, kaum zu glauben, seine winzige goldene Krone. Du fischst sie mit dem Enterhaken heraus.</p>` },
      { art: 'smaragd', text: `<p>Am nächsten Morgen fahren die Fischer von <b>Neu-Dublone</b> zum ersten Mal hinaus. Am Abend sind die Netze so voll,
        dass Berta Fischbrötchen für die ganze Insel backt.</p>` },
      { art: 'fest', sound: 'bell', text: `<p>Die neue Hafenbank bekommt ein Dach, die Kneipe einen Namen („Zum krummen Kraken“), und Hinnerk hält die längste Rede seines Lebens.</p>
        <p>„Ein Hoch auf Kapitän ${name()} – der uns <b>eine neue Heimat</b> gefunden hat!“</p>` },
      { art: 'klabauter', last: 'Zum Abspann', text: `<p>„Hörst du das?“, fragt der Klabautermann. „Das Sturmtor ist ruhiger geworden. Ich glaube, wir kommen jetzt
        <b>hin und zurück</b>. Zwei Meere, Käpt’n. Und beide gehören ein bisschen dir.“</p>` },
    ];
  }

  // Drittes Ende: Bildergeschichte, Abspann, danach freies Segeln zwischen beiden Seen
  function ending3() {
    if (step() === 'kraken') {
      SF.story.setStep('done3', 'Der Krakenkönig ist besiegt! Neu-Dublone kann fischen – und das Sturmtor ist jetzt in beide Richtungen offen.');
      SF.meta.set('finished3', true);
      SF.track('seefahrer-kraken-besiegt');
      SF.save();
    }
    SF.story.play(ending3Scenes(), () => SF.finale.credits());
  }

  // Neuigkeit, die beim nächsten Blick auf die Seekarte als Fenster erscheint (einmal)
  function news() {
    const f = SF.state.story.flags;
    if (f.news === 'winter') {
      delete f.news;
      return {
        title: `${SF.icon('ice')} Das Eis kommt`,
        html: `<p>Am Morgen knirscht es am Rumpf: <b>Eisschollen</b> – mitten in der Alten See! Der Klabautermann hält den Finger in den Wind.</p>
          <p>„Das Eismeer wächst, Käpt’n. Jeden Tag ein Stück weiter nach Süden. Wenn das so weitergeht, friert <b>Port Dublone</b> zu –
          und wir alle mit.“</p>
          <p>Eine Möwe bringt eine Nachricht von Hafenmeister Hinnerk: <i>„Komm sofort. Ich habe einen Plan. Er wird dir nicht gefallen.“</i></p>
          <p class="muted small">Kapitel 6: Der lange Winter</p>`,
      };
    }
    if (f.news !== 'jail') return null;
    delete f.news;
    return {
      title: `${SF.icon('scroll')} Post aus Port Dublone`,
      html: `<p>Eine Möwe landet auf der Reling, am Bein eine Nachricht von Hafenmeister Hinnerk:</p>
        <p><i>„Käpt’n ${name()}! Long John sitzt bei uns im <b>Hafenkerker</b> und redet wirres Zeug – er sei nur ‚die Hand‘ gewesen, und der ‚Kopf‘ laufe
        noch frei herum. Er will nur mit <b>dir</b> sprechen. Komm schnell!“</i></p>
        <p class="muted small">Kapitel 4: Der Auftraggeber</p>`,
    };
  }

  // Alte Spielstände: „Ende von Stufe 1“ wird zum Anfang von Kapitel 2, „durchgespielt“ zum Anfang von Kapitel 4
  function migrate() {
    const st = SF.state.story;
    if (st.step === 'end1') {
      st.step = 'hire-cook';
      st.flags.chapter2 = true;
    }
    if (st.step === 'done2') {
      st.step = 'winter';
      st.flags.news = 'winter';
      SF.story.log('Eisschollen in der Alten See: Das Eismeer wächst nach Süden.');
    }
    if (st.step === 'done') {
      st.step = 'jail';
      st.flags.news = 'jail';
      SF.story.log('Post aus Port Dublone: Long John will im Hafenkerker auspacken.');
    }
  }

  SF.chapter = { PEOPLE, CLUES, LETTERS, BARON_RANGE, BARON_LEAVE, tavern, act, onDiscover, onIsland, onDock, accuse, suspects, clue, clueCount, addClue, migrate, rumor, who, hireable,
    letters, onBattle, onDive, baronShip, baronReady, afterBaron, baronWaiting, challengeBaron, ending2, ending2Scenes, news,
    NEED, supplies, travel, gateOpen, passGate, crossingScenes, onArrive, krakenShip, krakenReady, afterKraken, ending3, ending3Scenes, KRAKEN_RANGE, KRAKEN_LEAVE };
})();
