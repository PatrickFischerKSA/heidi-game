# Heidi - Die Welt bekommt Worte

Browserbasierter Prototyp eines Partnerspiels zu Johanna Spyris `Heidi`. Im Zentrum steht nicht Wissensabfrage, sondern Spracherwerb: wahrnehmen, deuten, Wörter finden, Fragen stellen, Absichten verstehen, erklären, schreiben und überarbeiten.

## Phase 1: Spiel- und Lernkonzept

Die Spielwelt wird in dem Maß verständlicher und beeinflussbarer, wie die Spielenden Sprache aufbauen. Die Alp kommuniziert über Naturzeichen, Tierverhalten, Geräusche, Gesten und Schweigen; Frankfurt ist sprachlich dichter, aber sozial missverständlicher.

Die Aufgaben sind sprachlernwirksam, weil:

- Rolle A und Rolle B nur Teilinformationen erhalten und mündlich aushandeln müssen.
- erste Fassungen nicht abgewertet, sondern durch Hinweise, Rückfragen und Beispiele überarbeitet werden.
- das Lernjournal erste Fassung, Revision, Fragen, Wortschatz und Reflexion sichtbar nebeneinanderstellt.
- die Kapitel einen Progressionsbogen bilden: Zeichen deuten, Wortschatz präzisieren, offene Fragen stellen, soziale Absichten verstehen, Lernwege erklären, eigene Weitererzählung schreiben.

## Phase 2: Benutzerführung

- Partnermodus: Der Laptop eröffnet einen Raum, zeigt Raumcode, Beitrittsadresse, Kapitelstand und die gemeinsame Aufgabe. Die Aufgabe bleibt gesperrt, bis beide Handys ihre Rolleninformationen ausgetauscht haben.
- Handy A: zeigt nur `Wahrnehmen`, also Beobachtung, Zeichen und konkrete Szene.
- Handy B: zeigt nur `Versprachlichen`, also Wörter, Bedeutungen, Satzstarter oder soziale Hinweise.
- Mikrofon-Quests: In ausgewählten Kapiteln muss eine Rolle zuerst einen mündlichen Beitrag über das Handy-Mikrofon erfassen, bevor sie den Austausch bestätigen kann.
- Desktopmodus: Zwei Personen spielen an einem Bildschirm. Rollenkarten werden nacheinander geöffnet; erst danach erscheint die gemeinsame Schreibaufgabe.
- Demomodus: simuliert Laptop, Handy A und Handy B auf einem Desktop, bietet Beispielantworten, direkte Kapitelwahl, Hinweise und Reset.
- Lehrpersonenansicht: stellt Einstellungen, Kapitelübersicht, Datenmodell und Export bereit.

## Phase 3: Architektur und Datenmodell

Die App ist bewusst klein gehalten:

- `server.mjs` startet Express.
- `src/app.mjs` stellt statische Dateien und Raum-APIs bereit.
- `src/services/heidi-room-manager.mjs` enthält die zentrale Spiellogik.
- `public/heidi-game/app.js` enthält die clientseitige Benutzerführung.
- `public/heidi-game/styles.css` enthält das responsive Design.
- `public/heidi-game/assets/` enthält weboptimierte Medien wie kurze Loop-Videos.
- `data/heidi-game-content.json` enthält alle Kapitel, Rolleninformationen, Hinweise und Beispiele.

Kapitel folgen diesem Modell:

```json
{
  "id": "alp-spricht",
  "title": "Die Alp spricht",
  "languageGoal": "Naturzeichen wahrnehmen und deuten.",
  "laptopFrame": "Rahmensituation auf dem Laptop",
  "roleA": { "name": "Wahrnehmen", "prompt": "...", "tokens": [] },
  "roleB": { "name": "Versprachlichen", "prompt": "...", "tokens": [] },
  "media": {
    "type": "video",
    "src": "/heidi-game/assets/heidihaus-loop.m4v",
    "label": "Haus der Großmutter",
    "caption": "Ruhige Szenenbeschreibung",
    "hasAudio": true,
    "audio": {
      "src": "/heidi-game/assets/alpsegen.mp3",
      "label": "Alpsegen anhören"
    }
  },
  "teamTask": "Gemeinsame Aufgabe",
  "voiceQuest": {
    "required": true,
    "roles": ["A"],
    "prompt": "Sprich deine Beobachtung zuerst laut ins Handy.",
    "minWords": 6
  },
  "hint": "Rückmeldung ohne Richtig-falsch-Logik",
  "revisionPrompt": "Überarbeitungsauftrag",
  "example": "Beispielvariante",
  "reflection": "Reflexionsfrage"
}
```

## Phase 4-6: Spielbarer Prototyp

Der Prototyp enthält alle sechs Kapitel:

1. Die Alp spricht
2. Wörter für Wahrnehmungen
3. Mit dem Almöhi sprechen
4. Frankfurter Stimmen
5. Peter lernt anders
6. Heidi schreibt weiter

Kapitel 6 ist ausdrücklich als offene Weitererzählung gekennzeichnet, weil Heidi in Spyris ursprünglichen Bänden nicht ausdrücklich Schriftstellerin wird.

## Installation und lokaler Start

```bash
npm install
npm start
```

Standardadresse:

```text
http://127.0.0.1:3018
```

Für Entwicklung:

```bash
npm run dev
```

## Publikation ohne einschlafenden Server

Empfohlene Gratislösung: **Cloudflare Workers + Static Assets + Durable Objects**.

Warum nicht nur GitHub Pages?

- GitHub Pages kann die statische Oberfläche hosten, aber keine temporären Spielräume mit synchronisiertem Rollenstatus bereitstellen.
- Das Spiel braucht API-Endpunkte für Raumcode, Rollenbelegung, Kapitelwechsel, Wiederverbindung und Lernspur.

Warum nicht Render oder Koyeb Free als Hauptlösung?

- Render Free Web Services schlafen nach Inaktivität ein.
- Koyeb Free Instances skalieren ebenfalls automatisch auf null.
- Für ein Klassenzimmer ist ein kalter Start genau dann störend, wenn die Lernenden beitreten wollen.

Cloudflare Workers schlafen nicht als einzelner Node-Server ein. Die App wird als statische Assets am Edge ausgeliefert; die Raumlogik läuft serverlos in einem Durable Object. Durable Objects sind für koordinierte, zustandsbehaftete Anwendungen wie kleine Multiplayer-/Kollaborationsräume geeignet.

### Cloudflare-Deploy

Einmalig:

```bash
npm install
npm run build:cloudflare
npx wrangler login
npx wrangler deploy
```

Danach bei Aenderungen:

```bash
npm run deploy:cloudflare
```

Die Cloudflare-Konfiguration liegt in `wrangler.jsonc`. Der Worker liegt in `worker/index.mjs`. `npm run build:cloudflare` erzeugt vor dem Deploy einen schlanken Ordner `dist-cloudflare/`, der nur `index.html`, `heidi-game/` und `data/heidi-game-content.json` enthält. So werden alte Projektdateien nicht mitveröffentlicht.

Wichtig für die Assets:

- Einzelne Cloudflare-Static-Asset-Dateien sollten unter 25 MiB bleiben. Die aktuellen Video-Loops liegen darunter.
- Videos laufen stumm im Loop; Ton wird per Button aktiviert.
- Für schulischen Produktiveinsatz sollten die genutzten Film-/Tonrechte geklärt sein.

## Nutzung im selben WLAN

Starte den Server für andere Geräte sichtbar:

```bash
HOST=0.0.0.0 npm start
```

Oeffne auf dem Laptop die lokale Netzwerkadresse, zum Beispiel:

```text
http://192.168.1.23:3018
```

Im Partnermodus zeigt der Laptop einen Raumcode und eine Beitrittsadresse. Beide Handys öffnen diese Adresse und treten als Rolle A oder B bei. Es werden keine Namen erfasst.

## Bedienung der Modi

- Startseite: Modus auswählen.
- Partnermodus: Raum eröffnen, Handys verbinden, Rolleninformationen austauschen, geforderte Mikrofon-Beiträge auf dem Handy aufnehmen, Aufgabe auf dem Laptop bearbeiten.
- Desktopmodus: Rollenkarten nacheinander öffnen, danach gemeinsam schreiben.
- Demomodus: Kapitel direkt anwählen, beide Handyansichten simulieren, Beispielantworten einsetzen, didaktische Hinweise ein- oder ausblenden.
- Lehrpersonenansicht: Sprachniveau, Kapitelzahl, Spielzeit, Hilfen und Anzeigeoptionen verwalten.

## Lernjournal und Export

Die Lernspur speichert:

- erste Formulierungen
- überarbeitete Fassungen
- Reflexionen
- gesammelte Wörter
- Kapitelbezug

Im Partnermodus liegt die Lernspur temporär im Serverprozess. In Desktop-, Demo- und Lehrpersonenmodus liegt sie im Browser-`localStorage`. Der Export erzeugt eine lokale JSON-Datei; die Druckfunktion nutzt die Browser-Druckansicht.

## Bearbeitung der Aufgabendaten

Lehrpersonen können `data/heidi-game-content.json` bearbeiten. Nach dem Speichern den Server neu starten oder die Seite neu laden. Programmlogik muss für neue Formulierungen, Hinweise oder Beispielantworten nicht geändert werden.

Mikrofon-Aufgaben werden pro Kapitel mit `voiceQuest` gesteuert. `required: true` sperrt die Rollenbestätigung, bis ein Transkript mit mindestens `minWords` Wörtern vorliegt. `roles` legt fest, welche Handyrolle die Spracheingabe erhält. Browser ohne Web-Speech-Unterstützung zeigen ein Ersatzfeld, damit die mündliche Aufgabe trotzdem dokumentiert werden kann.

Videos können über das optionale Feld `media` pro Kapitel eingebunden werden. Sie laufen stumm im Loop; bei vorhandener Tonspur zeigt die App einen Button zum Einschalten, weil Browser Autoplay mit Ton meistens blockieren. Zusätzliche Hörimpulse wie der Alpsegen können als `media.audio` hinterlegt werden.

Wenn ein Kapitel mehrere Szenen braucht, kann statt eines einzelnen `media`-Objekts `mediaItems` verwendet werden. Kapitel 1 nutzt das für Ziegenverhalten und Gewitterzeichen nebeneinander. Kapitel 4 nutzt `frankfurt-dorfschule-loop.m4v` als Frankfurter Schul- und Regelraum; Kapitel 5 nutzt `dorfschule-loop.m4v` als eigentliche Dorfschule.

Historische Kontextualisierungen können mit `historicalNote` im Kapitel hinterlegt werden. Kapitel 4 nutzt das, um Spyris Frankfurt mit einer rekonstruierten Stadtszene und der Kriegszerstörung zu verbinden und kenntlich zu machen, dass dieses Frankfurt heute so nicht mehr existiert.

## Tests

```bash
npm test
```

Getestet werden insbesondere:

- Raum-Erstellung
- Rollenvergabe und Doppelbelegung
- Wiederverbindung mit gleicher Client-ID
- Speichern von Lernjournal-Einträgen
- Kapitelwechsel mit Reset der Rollenbereitschaft

## Hinweise für späteren Produktiveinsatz

Der Prototyp ist für lokale Tests und schulische Erprobung ohne Registrierung gebaut. Für produktive Nutzung wären sinnvoll:

- persistente, automatisch gelöschte Raumdaten
- echte QR-Code-Erzeugung
- robuster Mehrgeräte-Betrieb über WebSockets
- Administrationsoberfläche für Inhaltsbearbeitung
- Datenschutzkonzept mit definierter Speicherdauer
- optionaler PDF-/Druckexport des Lernjournals
