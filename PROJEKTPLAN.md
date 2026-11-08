# Projektplan: Der Seefahrer

> Ein Seefahrer-Abenteuer mit Story, Seekarte, Häfen, Seeschlachten und Jump'n'Run-Teilen –
> gemacht für das **iPad 8. Generation**. Nachfolger von **Gamble Klicker**.
> **Es gibt kein echtes Geld – alles ist Spielgeld.**
>
> Entwickler: **[Rafaelo28](https://github.com/Rafaelo28)** ·
> Spielen: https://rafaelo28.github.io/der-seefahrer/

---

## 1. Ausgangslage

Rafaelo28 hat das Browserspiel **Gamble Klicker** gebaut: ein Klickspiel im Stil von Cookie Clicker
plus ein großes Piraten-Casino, alles mit Spielgeld (Dublonen).

- Spielen: https://rafaelo28.github.io/Gamble-Klicker/ · Repo: `Rafaelo28/Gamble-Klicker`
- Es ist ein voller Erfolg im Freundeskreis. Irgendwann ist es aber ausgespielt: Man hat alles und
  Septilliarden Dublonen (ein Freund hatte 7 Millionen Schatzkarten).
- Darum entsteht ein neues Spiel: **„Der Seefahrer“** (Repo `der-seefahrer`).
- Was Rafaelo28 an Gamble Klicker besonders gefallen hat: **die Schifffahrt** (Flotte & Expeditionen).

Was Gamble Klicker schon hat und im neuen Spiel vorkommen kann:

- Figuren: Käpt'n Blaubart und Long John als Computer-Gegner, der Kraken
- Bosse: Seeungeheuer, Kraken-König und Seedrache
- Eigene Figur aus Teilen, mit Vorlagen wie John Pork, Käpt'n, Skelett-Pirat und Frosch-Gentleman
- Ränge: von der Landratte bis „Legende I, II, III …“
- Flotte aus 5 Schiffen: Schaluppe, Brigg, Fregatte, Galeone, Geisterschiff
- 6 Ziele der Flotte: Nahe Bucht, Korallenriff, Schmugglerinsel, Vulkaninsel, Eismeer, Drachenküste
- Spiele mit Freunden über Raum-Codes (PeerJS)

## 2. Die Idee

Ein Seefahrer-Abenteuer mit Story und Jump'n'Run-Teilen. Es soll **nicht zu komplex** werden.
Man segelt über eine Seekarte, läuft Häfen an, liefert sich Seeschlachten und kämpft gegen andere.
Fürs Schiff gibt es Cosmetics. Der alte Spielstand aus Gamble Klicker kann übernommen werden.

## 3. Story

**Prolog: Der Raub.** Port Dublone, der Hafen von Gamble Klicker, wird ausgeraubt. Der Dieb stiehlt die
Goldreserve, also die **Goldene Dublone** aus dem Tresor. Danach ist die Dublone nichts mehr wert – es gibt
eine Hyperinflation. Das passt zu Gamble Klicker: Alle hatten Septilliarden, der Dublonen-Urknall hat zu viel
Geld gemacht, und am Ende kostet ein Brot eine Sextilliarde.

**Gespielter Prolog: „Der letzte Tag der Dublone“.** Die Preise verdoppeln sich alle paar Sekunden. Man hat
etwa 60 Sekunden, um mit dem alten Geld ein Schiff und Vorräte zu kaufen. Danach ist das alte Geld weg.
Das gleicht sich von selbst aus: Sehr reiche Spieler haben einen kleinen Vorsprung, machen das Spiel aber
nicht kaputt (Rechnung siehe Abschnitt 10, Schritt 1.5).

**Hauptziel:** den Dieb finden und die Goldene Dublone zurückholen.

**Wendung in der Mitte (der Verräter):** Auf dem eigenen Schiff verschwindet Geld aus der Schiffskasse.
Jemand aus der eigenen Crew ist der Verräter. Man findet über Hinweise heraus, wer.

**Die alte Flotte:** Der Dieb hat auch die Flotte aus Gamble Klicker gestohlen. Die Schiffe findet man im Lauf
der Story wieder.

**Ende:** Das Spiel hat ein richtiges Ende mit Abspann. Danach gibt es einen Schwer-Modus und Geheimnisse,
die man für 100 % finden muss.

## 4. Währungen (entschieden)

- **Bernstein** ist die Hauptwährung. Man verdient ihn mit Handel, Kopfgeld, Schätzen und Aufträgen.
- **Perlen** gibt es nur für Cosmetics. Sie kommen erst später dazu, z. B. beim Tauchen an Riffen und Wracks.
- **Die Zahlen bleiben klein.** Ein Schiff kostet ein paar hundert Bernstein und nicht 10³⁰. Fortschritt kommt
  über Schiffe, Crew, Karte und Story, nicht über immer größere Zahlen. Das ist die Lehre aus Gamble Klicker.
- Inspiration: Bernstein gilt als „Gold des Nordens“ und wird nach Stürmen am Strand angespült.

## 5. Spielstand aus Gamble Klicker übernehmen

**Automatisch:** Beide Spiele liegen unter `rafaelo28.github.io` und haben damit denselben Speicher im
Browser. Das neue Spiel liest den Gamble-Klicker-Spielstand direkt aus `localStorage`
(Schlüssel `gamble-klicker-save`, JSON).

**Per Code:** Wer Gamble Klicker als App vom Home-Bildschirm spielt, hat dort einen eigenen Speicher. Diese
Spieler fügen den Export-Code ein (Gamble Klicker → Statistiken → Einstellungen). Der Code ist Base64 aus
UTF-8-JSON (siehe `GK.exportSave` in `js/state.js` von Gamble Klicker).

**Den Gamble-Klicker-Spielstand niemals ändern oder löschen.** Das alte Geld ist nur in der Story weg,
Gamble Klicker spielt sich normal weiter.

| Feld | Inhalt |
|---|---|
| `money` | Dublonen jetzt |
| `allTimeEarned` | insgesamt verdient → Rang (je 1.000-mal mehr ein Rang, `js/rank.js`) |
| `player.name` | Name |
| `player.fig` | Code der Figur, z. B. `3.0.0.0.1.4.4` = John Pork |
| `boss.level` | höchste besiegte Boss-Stufe |
| `fleet.ships` | Schiffe der Flotte (`{ sloop: 3, brig: 1, … }`) |
| `prestige.points` | Schatzkarten |

**Was mitkommt:**
- Die Figur wird zum Kapitän.
- Der Rang wird zum Titel, z. B. „ehem. Herrscher der Meere“.
- Die Boss-Trophäen hängen in der Kajüte.
- Die alten Schiffe sind gestohlen und lassen sich wiederfinden (Story, Stufe 4).
- Die Dublonen sind das Startgeld für „Der letzte Tag der Dublone“.

**Ohne Gamble Klicker:** Neue Spieler bekommen eine einfache Start-Schaluppe mit Vorräten, damit auch
Freunde ohne alten Spielstand mitspielen können.

## 6. Bausteine des Spiels

- **Seekarte:** Am Anfang leer, sie entsteht erst beim Segeln. Die Ziele der Flotte aus Gamble Klicker werden
  echte Orte. Man zeichnet den Kurs mit dem Finger, und das Schiff folgt ihm. Fetzen von Schatzkarten zeigen,
  wo Schätze liegen.
- **Häfen:** Handel (billig kaufen, teuer verkaufen), Vorräte, Werft für Upgrades, Laden für Cosmetics,
  Aufträge und Story-Figuren.
- **Seeschlachten:** Computer-Piraten mit Kopfgeld. Mit dem Finger lenken, zwei große Knöpfe für die
  Breitseite nach Backbord und Steuerbord.
- **Entern:** Mit dem Enterhaken zum feindlichen Schiff schwingen, auf dem Deck geht es als Jump'n'Run weiter.
- **Inseln:** Jump'n'Run-Level mit Enterhaken: auf einen Punkt tippen, der Haken fliegt hin, man schwingt.
- **Tauchen:** An Riffen und Wracks. Mit dem Finger ziehen, der Taucher schwimmt hin. Luft und Licht sind
  knapp. Hier findet man Perlen.
- **Vorräte:** Ein einziger Balken für Proviant. Ist er leer, wird das Schiff langsamer und die Crew murrt.
  Kein „Game Over“.
- **Kämpfe gegen andere:** Online-Seeschlacht mit Freunden über Raum-Code. Die Physik muss auf allen Geräten
  gleich rechnen (Regel in `CLAUDE.md`).
- **Cosmetics fürs Schiff:** Segel (Farben, Muster), Flagge, Rumpffarbe, Galionsfigur (z. B. John Pork),
  Spur im Kielwasser, Farbe vom Kanonenrauch. Die anderen sehen alles in Seeschlachten.
- **Wetter:** Rückenwind, Sturm, Nebel.

## 7. Inspiration

- **Hyperinflation 1923:** Ein Brot kostete Milliarden Mark. Kinder bauten Türme aus Geldbündeln, Geldscheine
  wurden als Tapete benutzt. Am Ende tauschte man 1 Billion alte Mark gegen 1 Rentenmark.
  → Vorlage für die Bilder im Prolog und den Umtausch am Abend.
- **Der Klabautermann:** kleiner Schiffsgeist aus alten Seemannsgeschichten, der der Crew hilft → Begleiter,
  der Tipps gibt.
- **Klaus Störtebeker und die Likedeeler („Gleichteiler“):** Beute gerecht teilen → Beute mit Freunden teilen.
- **Der Fliegende Holländer:** das Geisterschiff als möglicher Endboss.
- **Besondere Meeresgebiete:** Sargassosee (Algen, Schiffe bleiben stecken), Bermuda-Dreieck (Kompass dreht sich).
- **Flaschenpost:** Freunden Geschenke oder Nachrichten als Code schicken.
- **Gegen „ausgespielt“:** Bestzeiten und Ranglisten mit Freunden, später vielleicht ein Level-Editor
  (Level als Code teilen).

## 8. Technik

| Thema | Entscheidung |
|---|---|
| Sprache | HTML, CSS, JavaScript ohne Framework und ohne Build-Schritt – `index.html` öffnen genügt |
| Spielszenen | Canvas (Seekarte, Schlacht, Jump'n'Run, Tauchen); Bildergeschichten als SVG |
| Speichern | `localStorage` (`der-seefahrer-save`), dazu Export/Import als Code |
| Veröffentlichung | GitHub Pages aus `main`: https://rafaelo28.github.io/der-seefahrer/ |
| Multiplayer | PeerJS 1.5.4 von cdnjs, direkte Verbindung ohne eigenen Server |
| Namensraum | Alles hängt an `window.SF` (Seefahrer) |

### Ordnerstruktur

```
index.html            Einstieg: alle Bildschirme (Titel, Geschichte, Laden, Seekarte, Hafen, Kajüte)
css/style.css         Aussehen (Seekarte, Pergament, Bernstein)
js/format.js          Zahlen und Zeiten auf Deutsch, Anzeigen nur bei Änderung schreiben
js/state.js           Spielstand: Standardwerte, Speichern, Laden, Export/Import, Bernstein
js/rank.js            Ränge aus Gamble Klicker (für den Titel)
js/figure.js          Figur aus Gamble Klicker zeichnen und Code prüfen
js/gk-import.js       Spielstand aus Gamble Klicker lesen (nie ändern!) und zusammenfassen
js/sound.js           Sounds, im Browser erzeugt
js/ui.js              Bildschirme, Meldungen, Fenster, Klabautermann
js/analytics.js       Besucherzählung (GoatCounter)
js/story.js           Story: Bildergeschichten, Kapitel, Logbuch
js/lastday.js         Prolog „Der letzte Tag der Dublone“ (Regeln + Laden)
js/ships.js           Schiffstypen, Upgrades, Schiff zeichnen
js/world.js           Welt: Inseln, Orte, Land/Wasser, Nebel der Karte, Wegsuche
js/voyage.js          Segeln: Kurs folgen, Wind, Proviant, Treibgut (ohne Bildschirm, testbar)
js/sea.js             Seekarte auf dem Canvas: Zeichnen, Kurs mit dem Finger, Kamera
js/trade.js           Waren, Preise, Handel, Werft (ohne Bildschirm, testbar)
js/harbor.js          Hafen-Bildschirm: Markt, Proviant, Werft, Kneipe
js/cabin.js           Kajüte: Kapitän, Trophäen, Logbuch, Einstellungen, Spielstand
js/main.js            Start, Spielschleife, automatisches Speichern
tests/*.test.js       Tests mit node (Regeln, Physik, Spielstände) und Playwright (Browser)
```

## 9. Entscheidungen (mit Rafaelo28 abgestimmt)

| Frage | Vorschlag (so umgesetzt) |
|---|---|
| Name des ausgeraubten Hafens | **Port Dublone** (entschieden) |
| Alten Spielstand einmal oder öfter übernehmen? | **Einmal pro neuem Spielstand** (entschieden) |
| Hochkant oder quer? | Seekarte, Häfen, Kajüte und Geschichte **hoch und quer**; Schlacht und Jump'n'Run **nur quer** (Hinweis „Bitte drehen“) |
| Gestaltung | **Keine Emojis** (Wunsch von Rafaelo28): eigene gezeichnete Symbole aus `js/icons.js`, im Stil des Spiels |
| Ab wann Perlen und Cosmetics? | Perlen mit dem Tauchen am Korallenriff (Stufe 3), Cosmetics-Laden gleich danach |
| Wer ist der Dieb? | **Long John** (entschieden): Er hat in Gamble Klicker immer gegen dich verloren und will Rache. Im Spiel heißt er zuerst nur „der Schatten“. |
| Wer ist der Verräter? | Jemand aus der eigenen Crew (entschieden). Umsetzung: **Smutje Fiete**, der freundliche Schiffskoch, der in Kapitel 2 an Bord kommt – früher Koch bei Long John. Hinweise: Mehlspuren an der Schiffskasse, er weiß immer, wo Long John gerade ist. |
| Wie endet das Spiel? | **Endkampf gegen den Fliegenden Holländer** (entschieden): Long John flieht auf das Geisterschiff, man besiegt es, holt die Goldene Dublone zurück und bringt sie nach Port Dublone. Danach Abspann, Schwer-Modus und Geheimnisse. |
| Besucherzählung | Zählt vorerst bei `gamble-klicker.goatcounter.com` mit (Pfad `/der-seefahrer/`); eigene Seite später möglich |

---

## 10. Ausbaustufen – Schritt für Schritt

Nach jeder Stufe (und möglichst nach jedem Schritt) ist das Spiel spielbar. Jeder Schritt endet mit
grünen Tests, einem Pull Request nach `main` und dem Merge.

### Stufe 1 – Prolog und Segeln

- [x] **1.0 Grundgerüst:** `index.html`, `css/style.css`, `js/`-Ordner, `CLAUDE.md`, `PROJEKTPLAN.md`,
      `.nojekyll`, App-Symbol und `manifest.webmanifest` (als App auf dem Home-Bildschirm), Test-Gerüst
      (`node tests/…`) und Browser-Test mit Playwright (iPad hoch und quer, keine Konsolenfehler, kein
      seitliches Scrollen).
- [x] **1.1 Spielstand:** `SF.state` mit Standardwerten, Speichern alle 5 Sekunden, nach Käufen und beim
      Verlassen; Export/Import als Code; alte Spielstände laden weiter (Standardwerte für neue Felder).
- [x] **1.2 Übernahme aus Gamble Klicker:** automatisch aus `localStorage` und per Code. Nur lesen, nie
      schreiben. Zusammenfassung: Name, Figur, Rang → Titel, Dublonen, Boss-Stufe → Trophäen, Schiffe,
      Schatzkarten. Tests mit echten Spielstand-Formen (auch kaputte Codes, `Infinity`, fehlende Felder).
- [x] **1.3 Titelbild und neues Spiel:** „Neues Abenteuer“ / „Weiterspielen“. Gefundener Gamble-Klicker-
      Spielstand wird gezeigt („Übernehmen“ / „Code einfügen“ / „Ohne Gamble Klicker“). Kapitän anlegen:
      Name und Figur (aus Gamble Klicker oder Vorlagen wie John Pork).
- [x] **1.4 Prolog „Der Raub“:** Bildergeschichte in 6 Bildern (SVG, leicht animiert), Antippen = weiter,
      „Überspringen“ jederzeit. Gamble-Klicker-Spieler sehen ihren Namen, ihr Vermögen und ihre gestohlene Flotte.
- [x] **1.5 „Der letzte Tag der Dublone“:** 60 Sekunden einkaufen, Preise verdoppeln sich alle 5 Sekunden.
      Preise richten sich nach dem eigenen Startgeld M: Preis = Grundanteil × M × 2^(t/5) ÷ (1 + v),
      Vorsprung v = log10(M) ÷ 90 (höchstens 0,5). Wer Septilliarden hat, bekommt so nur etwa 3 Sekunden
      Vorsprung (im Test: reich ≈ 1,16-mal so gute Ausrüstung wie arm, niemand bekommt alles). Zu kaufen: Brigg oder Fregatte, Kanonen, Proviant, Kisten Tuch, Brot.
      Am Abend tauscht die Hafenbank 1 Billion Dublonen gegen 1 Bernstein (höchstens 25).
      Mindestausstattung für alle: Schaluppe, 3 Fässer Proviant, 30 Bernstein.
- [x] **1.6 Seekarte:** Welt mit Inseln, Pergament-Nebel (die Karte entsteht beim Segeln), Kurs mit dem Finger
      vom Schiff aus zeichnen, Antippen eines bekannten Orts = Kurs dorthin (Wegsuche um Inseln herum),
      Karte verschieben und zoomen, Wind mit Rückenwind, Proviant-Balken (leer = langsamer, Crew murrt),
      Treibgut (Bernstein, Kisten, Fässer). Tests: Kurs folgen, Land, Nebel, Proviant, Wind, Wegsuche.
- [x] **1.7 Häfen:** Port Dublone, Bernsteinbucht, Schmugglerinsel. Markt mit 5 Waren (Fisch, Salz, Rum,
      Tuch, Gewürze) und eigenen Preisen je Hafen (Angebot und Nachfrage, Tagesschwankung), Proviant
      auffüllen, Werft (Segel, Laderaum, Vorratskammer, Kanonen, neue Schiffe), Kneipe mit Gerüchten.
      Tests: Preise, Kaufen/Verkaufen, Werft, keine Endlos-Gewinne an einem Ort.
- [x] **1.8 Orte und erste Spur:** Die 6 Ziele aus Gamble Klicker als Orte auf der Karte (Entdecker-Belohnung),
      Spur des Diebes über Bernsteinbucht → Schmugglerinsel → Vulkaninsel (Ende von Stufe 1: „Fortsetzung
      folgt“), Logbuch, Kajüte (Kapitän, Titel, Trophäen, gestohlene Flotte, Einstellungen, Spielstand-Code).
- [x] **1.9 Feinschliff:** Sounds, Klabautermann-Tipps, Prüfung auf dem iPad (hoch/quer), Merge. Kurse werden mit
      Sicherheitsabstand zur Küste geplant (Test fährt alle Routen zwischen allen Orten ab).

### Stufe 2 – Seeschlacht gegen Computer-Piraten, mit Entern

- [x] **2.1 Gegner auf der Karte:** Piratenschiffe mit Kopfgeld kreuzen in 5 Gebieten (nie rund um Port Dublone),
      jagen das Schiff, wenn sie es sehen; Zusammenstoß = Schlacht. Besiegte Piraten kommen nach einer Weile wieder.
- [x] **2.2 Schlacht-Bildschirm (quer, Hinweis „Bitte drehen“ hochkant):** Schiff mit dem Finger lenken, Knöpfe „Backbord“ und „Steuerbord“
      für Breitseiten, Nachladen, Rumpf-Punkte, Wind beeinflusst Tempo. Physik nur mit + − × ÷ und `Math.sqrt`
      (für die Online-Schlacht in Stufe 5 wiederverwendbar), eigener Zufall aus einem Startwert. Fliehen: an den Rand
      der Arena segeln, wenn der Gegner nicht zu nah ist. Zielhilfe: Schussbereich der Breitseiten wird angezeigt.
- [x] **2.3 Computer-Piraten:** Seeräuber (Schaluppe), Hai-Piraten (Brigg) und Käpt'n Blaubart (Fregatte, an der
      Drachenküste) in drei Stärken. *Long John bleibt frei, bis feststeht, wer der Dieb ist.*
- [x] **2.4 Entern:** Ist der Gegner schwer beschädigt, erscheint „Entern!“: Enterhaken-Schwung hinüber, dann
      kurzes Jump'n'Run auf dem Deck bis zur Kapitänskajüte (45 Sekunden, Piraten von oben besiegen, offene Luken,
      Blaubart braucht zwei Treffer). Die Spielfigur ist die eigene Figur aus Gamble Klicker.
- [x] **2.5 Beute und Kopfgeld:** Bernstein, Waren, Karten-Fetzen; verlorene Schlacht = etwas Ladung weg,
      kein „Game Over“ (Hälfte der Ladung, höchstens 50 Bernstein weg, in den nächsten Hafen geschleppt).
      Versenkt = halbes Kopfgeld, geentert = ganzes Kopfgeld und Ladung.
- [x] **2.6 Kanonen und Rumpf in der Werft** (reparieren, „Rumpf verstärken“), Tests für Treffer, Schaden,
      Gegner-Verhalten (ein Spieler-Bot mit Fregatte schlägt Seeräuber meistens), Entern (ein Bot schafft jedes Deck).

### Stufe 3 – Inseln (Jump'n'Run mit Enterhaken), Tauchen und Perlen

- [x] **3.1 Jump'n'Run-Grundlage (quer):** Laufen, Springen, Enterhaken (Hakenring antippen = Haken fliegt hin,
      das Seil zieht straff, Schwingen über Pendel-Physik, loslassen mit „Springen“). Level als kleine Daten-Tabellen.
- [x] **3.2 Insel-Level:** Nahe Bucht (Wasser, Krabben) und Vulkaninsel (Lava) mit Schatzkiste und Bestzeit;
      „An Land gehen“, wenn das Schiff dort steht. Ein Bot im Test schafft beide. *Eismeer und Drachenküste folgen
      mit Stufe 4.*
- [x] **3.3 Tauchen** am Korallenriff: Finger ziehen = Taucher schwimmt hin; Luft knapp, je tiefer desto dunkler;
      Muscheln öffnen sich nur zeitweise, Quallen kosten Luft, Wrack mit Muscheln; Muscheln wachsen nach 2 Tagen nach.
- [x] **3.4 Perlen** als zweite Währung (nur für Cosmetics; ohne Luft nur die Hälfte). Bestzeiten je Insel.

### Stufe 4 – Story-Kapitel, Verräter, alte Flotte, Cosmetics, Ende

- [x] **4.1a Kapitel 2 „Kalte Spur“:** Nach der Vulkaninsel holt man **Smutje Fiete** aus Port Dublone an Bord
      (Proviant hält ein Viertel länger), segelt ins **Eismeer** und geht dort an Land (Insel mit rutschigem Eis).
      Dort steckt eine **Galeone im Eis** und ein Logbuch von „L. J.“ – **Long John** – mit dem Satz „Unser Mann an Bord
      verrät uns jeden Kurs“. Ein Bot im Test schafft die Eisinsel.
- [x] **4.1b Crew:** Kanonierin Karla (Schmugglerinsel, schneller nachladen) und Navigator Nils (Bernsteinbucht,
      schneller segeln) lassen sich ab Kapitel 2 anheuern. Crew in der Kajüte.
- [x] **4.2 Kapitel 3 „Der Verräter“:** Nach dem Eismeer fehlt beim Anlegen Bernstein in der Schiffskasse (höchstens
      einmal am Tag). Drei Hinweise: Mehlspuren an der Kasse, Frieda sah jemanden mit Schürze eine Flaschenpost werfen,
      Ede kennt (gegen 2 Kisten Fisch) Long Johns alten Koch. In der Kajüte den Verräter anklagen (Crew plus Bootsmann
      Bruno und Schiffsjunge Jan). Fiete gesteht, der gestohlene Bernstein kommt zurück. Danach an der **Drachenküste**
      an Land (Insel mit vier Lava-Schluchten): Long Johns Versteck ist leer, ein Schiff der alten Flotte wartet, und
      der Zettel verrät: Long John ist mit dem Fliegenden Holländer ins **Nebelmeer** geflohen.
- [x] **4.3a Die alte Flotte:** Wiedergefundene Schiffe liegen in der Werft, Umsteigen kostet nichts (jedes Schiff
      behält Ausbau und Kanonen). Die Galeone aus dem Eis ist das erste. *Weitere Schiffe in Kapitel 3 und im Finale
      (das Geisterschiff ist der Fliegende Holländer).*
- [x] **4.4 Cosmetics-Laden** (vorgezogen, damit Perlen gleich etwas wert sind): Segel, Rumpf, Flagge, Galionsfigur
      (Meerjungfrau, John Pork, Drache, Krake), Kielwasser, Kanonenrauch – für Perlen, im Laden jedes Hafens.
      Zu sehen auf der Seekarte, in der Schlacht, in Werft und Kajüte. *Später: Muster für Segel.*
- [x] **4.5 Finale:** Im **Nebelmeer** im Osten (Nebelbänke auf der Karte) taucht der **Fliegende Holländer** auf – Long
      Johns Geisterschiff. Er sinkt nicht, man muss ihn entern; auf dem nächtlichen Deck kämpft eine Skelett-Crew, vor der
      Kajüte steht **Long John** (drei Treffer), erst dann geht die Tür auf. Ende als Bildergeschichte (Long John gibt
      auf, die Goldene Dublone kommt zurück in den Tresor, Fest in Port Dublone), danach **Abspann** mit der eigenen
      Statistik. Das Geisterschiff gehört dir.
- [x] **4.6 Nach dem Ende:** **Schwer-Modus** (stärkere Piraten, Proviant reicht kürzer, weniger Zeit an Land und beim
      Entern) – wählbar beim nächsten neuen Abenteuer (gemerkt in `der-seefahrer-meta`). **10 Geheimnisse für 100 %**
      in der Kajüte, darunter das versteckte **Bermuda-Dreieck** im Südwesten (der Kompass dreht sich, 10 Perlen).

### Stufe 5 – Online mit Freunden

- [x] **5.1 Online-Seeschlacht** über Raum-Code (4 Zeichen, in der Kajüte): Der Gastgeber rechnet die Schlacht
      (gleiche Physik wie gegen Computer-Piraten) und schickt 15-mal pro Sekunde einen Schnappschuss, der Freund schickt
      Lenkung und Schüsse. Beide segeln ihr eigenes Schiff mit Crew und Cosmetics, mit heilem Rumpf. Kein Einsatz,
      Siege werden gezählt. Verbindung über PeerJS (wie Gamble Klicker), zum Testen lokal zwischen zwei Tabs (`?lokal=1`).
- [ ] **5.2 Flaschenpost:** Geschenke und Nachrichten als Code.
- [ ] **5.3 Bestzeiten und Ranglisten** mit Freunden, Beute teilen wie die Likedeeler.

---

## 11. Arbeitsweise

Siehe `CLAUDE.md`: Arbeits-Branch → Pull Request nach `main` → selbst mergen, sobald alle Tests grün sind →
prüfen, dass GitHub Pages die neue Version zeigt → Rafaelo28 den Link zum Pull Request geben → Arbeits-Branch
auf den neuen Stand von `main` setzen.
