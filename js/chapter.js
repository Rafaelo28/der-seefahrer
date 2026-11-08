// Kapitel 1 „Die Spur“: Leute in den Kneipen der Häfen, der Salz-Auftrag von Einauge Ede und das verlassene Lager
// an der Vulkaninsel (Ende von Stufe 1). Jede Person sagt je nach Story-Schritt etwas anderes.
window.SF = window.SF || {};

(function () {
  // Figuren-Codes wie in Gamble Klicker (js/figure.js)
  const PEOPLE = {
    hinnerk: { name: 'Hafenmeister Hinnerk', fig: '0.3.7.3.7.0.5' },
    berta: { name: 'Bäckerin Berta', fig: '2.10.0.0.4.7.0' },
    frieda: { name: 'Fischerin Frieda', fig: '1.2.0.0.0.8.0' },
    ede: { name: 'Einauge Ede', fig: '0.2.1.4.2.4.3' },
  };

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
    if (h === 'amberbay') {
      if (step() === 'find-amberbay') {
        out.push({ who: 'frieda', text: `Ein Schiff mit <b>schwarzen Segeln</b>? Ja! Das lag vor drei Tagen hier und hat Proviant geholt.
          Bezahlt hat der Kapitän mit einer <b>goldenen Münze, so groß wie ein Teller</b>! Dann ist es nach <b>Südosten</b> gesegelt – zur Schmugglerinsel.`,
          action: { id: 'frieda-thanks', label: 'Danke, Frieda!' } });
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
      } else {
        out.push({ who: 'ede', text: 'Rum und Gewürze, billig wie nirgends. Frag nicht, woher. Und erzähl keinem, dass du mich kennst.' });
      }
    }
    const r = rumor();
    if (r) out.push({ who: 'klabauter', text: r });
    return out;
  }

  // Aktion in der Kneipe; gibt einen Text für die Meldung zurück (oder '')
  function act(h, id) {
    const s = SF.state;
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
      SF.story.setStep('end1', 'An der Vulkaninsel: ein verlassenes Lager, ein Fetzen schwarzes Segel und eine Karte mit einem Kreuz im Eismeer.');
      SF.sound.play('fanfare');
      SF.track('seefahrer-stufe1-geschafft');
      setTimeout(() => SF.ui.dialog({
        title: 'Das verlassene Lager',
        html: `<p>An der Vulkaninsel findest du ein <b>verlassenes Lager</b>. Die Feuerstelle ist noch warm. An einem Felsen hängt ein Fetzen
          <b>schwarzes Segel</b>, daneben liegt eine zerrissene Karte – mit einem Kreuz mitten im <b>Eismeer</b>.</p>
          <p>Im Sand findest du ${SF.amberHTML(n)}, die der Schatten wohl verloren hat.</p>
          <p>„Wir sind ihm auf den Fersen!“, flüstert der Klabautermann.</p>
          <p class="muted"><b>Ende von Stufe 1 – Fortsetzung folgt!</b> Bis dahin: Handle, erkunde die ganze Karte und rüste dein Schiff aus.</p>`,
        buttons: [{ label: 'Weiter segeln', value: true, kind: 'primary' }],
      }), 300);
    }
  }

  SF.chapter = { PEOPLE, tavern, act, onDiscover, rumor };
})();
