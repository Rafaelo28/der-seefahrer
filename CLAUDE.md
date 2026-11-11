# Der Seefahrer – Hinweise für die Entwicklung

Seefahrer-Abenteuer (Story, Seekarte, Häfen, Seeschlachten, Jump'n'Run) von **Rafaelo28**, Nachfolger von
**Gamble Klicker**. Reines HTML, CSS und JavaScript ohne Framework und ohne Build-Schritt – `index.html` im
Browser öffnen genügt. Online über GitHub Pages aus `main`: https://rafaelo28.github.io/der-seefahrer/

Der ganze Plan mit allen Ausbaustufen steht in `PROJEKTPLAN.md` (Häkchen nach jedem Schritt setzen).

## Arbeitsweise (mit Rafaelo28 abgesprochen)

- Auf dem Arbeits-Branch entwickeln, einen **Pull Request nach `main`** erstellen und ihn **selbst mergen**,
  sobald alle Tests grün sind. Rafaelo28 muss nichts tun.
- Nach dem Merge prüfen, dass GitHub Pages die neue Version zeigt (1–2 Minuten), und Rafaelo28 den Link zum
  Pull Request geben.
- Nach einem Merge den Arbeits-Branch auf den neuen Stand von `main` setzen, bevor es weitergeht.

## Regeln

- **Alles auf Deutsch**: Texte im Spiel, Code-Kommentare, Commits, Pull Requests.
- **Versionsnummer erhöhen**: Bei jeder Änderung an JS- oder CSS-Dateien in `index.html` alle `?v=…` auf einen
  neuen Wert setzen (Format `JJJJMMTTNN`), sonst mischen Browser alte und neue Dateien aus dem Zwischenspeicher.
- **Spielstände bleiben kompatibel**: Neue Felder bekommen Standardwerte in `js/state.js`
  (`createDefaultState` / `applyData`), damit alte Spielstände weiter laden.
- **Speicher**: `der-seefahrer-save` (Spielstand) und `der-seefahrer-meta` (bleibt über Spielstände hinweg, z. B.
  „durchgespielt“ → Schwer-Modus; `js/meta.js`).
- **Gamble-Klicker-Spielstand niemals ändern oder löschen** (`gamble-klicker-save` nur lesen, siehe
  `js/gk-import.js`). Das alte Geld ist nur in der Story weg.
- **Kleine Zahlen**: Bernstein-Preise bleiben im Bereich von ein paar bis ein paar tausend. Fortschritt über
  Schiffe, Crew, Karte und Story – nicht über immer größere Zahlen.
- **Bernstein** nur über `SF.amber.add` / `SF.amber.spend` bewegen.
- **Zielgerät**: iPad 8. Generation (810 × 1080 hochkant, 1080 × 810 quer, Touch). Große Tippflächen, kein
  Doppeltipp-Zoom, Hover-Effekte nur in `@media (hover: hover)`. Seekarte, Häfen und Geschichte hoch und quer;
  Schlacht und Jump'n'Run nur quer.
- **Flüssig auf dem iPad**: Dauer-Animationen nur mit `transform` oder `opacity` (kein `box-shadow`, `left`,
  `background-position` im Dauerlauf, kein `backdrop-filter`). Anzeigen, die oft aktualisiert werden, über
  `SF.setHTML` / `SF.setText` schreiben (nur bei Änderung).
- **Physik in Online-Spielen** nur mit + − × ÷ und `Math.sqrt` rechnen, keine Winkelfunktionen in der
  Simulation – sonst kommen auf verschiedenen Geräten andere Ergebnisse heraus. (Fürs Zeichnen sind
  Winkelfunktionen erlaubt; Schiffe werden mit Richtungsvektoren gedreht.)
- **Online mit Freunden** (`js/net.js`, `js/duel.js`): PeerJS 1.5.4 von cdnjs (erst beim Online-Spielen geladen),
  Kennung `der-seefahrer-duell-<CODE>`. Alles, was vom Freund kommt, mit `SF.duel.cleanShip` prüfen.
- **Besucherzählung** (`js/analytics.js`, GoatCounter): nur Seitenaufrufe und Ereignisse wie
  `SF.track('seefahrer-…')` – niemals Namen, Raum-Codes, Spieler-IDs oder Spielstände mitsenden.
- **Keine Emojis** (Wunsch von Rafaelo28): Symbole kommen aus `js/icons.js` – im HTML `SF.icon('name')` bzw.
  `<i data-ic="name"></i>`, auf dem Canvas `SF.icons.draw(ctx, 'name', x, y, größe)`. Neue Symbole dort auf dem
  24 × 24-Raster zeichnen (mit Umriss, Schatten `sh(…)` und Glanzlicht `hi(…)` wie die anderen). Ein Test
  (`cosmetics.test.js`) schlägt fehl, wenn irgendwo ein Emoji steht.
- **Webseiten-Icon**: Vorlagen sind `icons/icon.svg` (iPad-Startbildschirm, App) und `icons/favicon.svg` (Browser-Tab).
  Nach einer Änderung `node tools/icons.js` ausführen (erzeugt die PNGs) und die `?v=…` der Icons in `index.html` und
  `manifest.webmanifest` erhöhen.
- **Alles ist Spielgeld.** Es gibt keine Käufe mit echtem Geld.
- Code aus Gamble Klicker (`Rafaelo28/Gamble-Klicker`) darf übernommen und angepasst werden
  (`figure.js`, `rank.js`, `sound.js`, `format.js`, später `mp/room.js`, `mp/cannon.js`).

## Testen

- `node tests/run-all.js` – führt alle `tests/*.test.js` mit node aus (ohne Browser).
  - `state.test.js` – Spielstand: Standardwerte, alte Spielstände, Export/Import, Bernstein.
  - `gk-import.test.js` – Übernahme aus Gamble Klicker: Code lesen, Zusammenfassung, Titel, nie schreiben.
  - `lastday.test.js` – Der letzte Tag der Dublone: Preise, Verdopplung, Ausgleich arm/reich, Ergebnis.
  - `world.test.js` – Welt: Land/Wasser, Orte im Wasser erreichbar, Nebel, Wegsuche.
  - `voyage.test.js` – Segeln: Kurs folgen, Küste, Wind, Proviant, Treibgut.
  - `trade.test.js` – Handel und Werft: Preise je Hafen, Kaufen/Verkaufen, keine Endlos-Gewinne.
  - `story.test.js` – Story-Schritte, Kneipen-Gespräche, Salz-Auftrag, Vulkaninsel, Logbuch.
  - `battle.test.js` – Seeschlacht (rechnet überall gleich, keine Winkelfunktionen), Steuern, Zielhilfe, Piraten auf der
    Karte, Beute, Werft.
  - `boarding.test.js` – Entern: Herzen, Beute plündern, Säbel-Piraten, Flaschenwerfer, Kanonen, Fässer, Planken, Luken,
    Tür, Zeit; ein Planer-Bot schafft jedes Deck (und wer nur rennt und hüpft, schafft die großen Schiffe nicht).
  - `island.test.js` – Inseln: Enterhaken und Pendel, Gefahren, Krabben, Truhe, Bestzeit; ein Bot schafft jede Insel.
  - `dive.test.js` – Tauchen: Luft, Muscheln nur offen, Quallen, Auftauchen, Perlen, Nachwachsen.
  - `cosmetics.test.js` – Cosmetics: nur mit Perlen, Kaufen legt an, kaputte Werte, Farben beim Zeichnen.
  - `crew.test.js` – Crew: anheuern, Vorteile (Proviant, Tempo, Nachladen), von Bord; alte Flotte und Umsteigen.
  - `finale.test.js` – Finale: Holländer sinkt nicht, Long John bewacht die Kajüte, Ende, Geheimnisse, Bermuda, Schwer-Modus.
  - `friends.test.js` – Rangliste mit Freunden und Flaschenpost (Grenzen, nur einmal öffnen, kaputte Codes).
  - `duel.test.js` – Online-Seeschlacht: zweites Schiff vom Menschen gesteuert, Schnappschuss gespiegelt, Schutz vor
    kaputten Angaben, Raum-Codes, lokale Verbindung.
  - Neue Levels immer mit einem Bot im Test prüfen – so ist sicher, dass sie lösbar sind.
- `node tests/browser.test.js` – im Browser mit Playwright (Chromium ist vorinstalliert), in der
  iPad-Emulation `devices['iPad (gen 7)']` hoch und quer: keine Konsolenfehler, kein seitliches Scrollen,
  Prolog bis zur Seekarte durchspielen, Hafen, Kneipe, Markt, Werft, Kajüte, Seeschlacht und Entern.
  Mehrere `.dialog` liegen versteckt im HTML: Fenster im Test über `#dialog-layer …` ansprechen.
  Am Ende ein echtes Duell zwischen zwei Seiten (lokale Verbindung über `?lokal=1`, kein Internet nötig).
