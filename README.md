# Heidi - Die Welt bekommt Worte

Browserbasierter Prototyp eines Partnerspiels zu Johanna Spyris `Heidi`. Im Zentrum steht nicht Wissensabfrage, sondern Spracherwerb: wahrnehmen, deuten, Woerter finden, Fragen stellen, Absichten verstehen, erklaeren, schreiben und ueberarbeiten.

## Phase 1: Spiel- und Lernkonzept

Die Spielwelt wird in dem Mass verstaendlicher und beeinflussbarer, wie die Spielenden Sprache aufbauen. Die Alp kommuniziert ueber Naturzeichen, Tierverhalten, Geraeusche, Gesten und Schweigen; Frankfurt ist sprachlich dichter, aber sozial missverstaendlicher.

Die Aufgaben sind sprachlernwirksam, weil:

- Rolle A und Rolle B nur Teilinformationen erhalten und muendlich aushandeln muessen.
- erste Fassungen nicht abgewertet, sondern durch Hinweise, Rueckfragen und Beispiele ueberarbeitet werden.
- das Lernjournal erste Fassung, Revision, Fragen, Wortschatz und Reflexion sichtbar nebeneinanderstellt.
- die Kapitel einen Progressionsbogen bilden: Zeichen deuten, Wortschatz praezisieren, offene Fragen stellen, soziale Absichten verstehen, Lernwege erklaeren, eigene Weitererzaehlung schreiben.

## Phase 2: Benutzerfuehrung

- Partnermodus: Der Laptop eroeffnet einen Raum, zeigt Raumcode, Beitrittsadresse, Kapitelstand und die gemeinsame Aufgabe. Die Aufgabe bleibt gesperrt, bis beide Handys ihre Rolleninformationen ausgetauscht haben.
- Handy A: zeigt nur `Wahrnehmen`, also Beobachtung, Zeichen und konkrete Szene.
- Handy B: zeigt nur `Versprachlichen`, also Woerter, Bedeutungen, Satzstarter oder soziale Hinweise.
- Mikrofon-Quests: In ausgewaehlten Kapiteln muss eine Rolle zuerst einen muendlichen Beitrag ueber das Handy-Mikrofon erfassen, bevor sie den Austausch bestaetigen kann.
- Desktopmodus: Zwei Personen spielen an einem Bildschirm. Rollenkarten werden nacheinander geoeffnet; erst danach erscheint die gemeinsame Schreibaufgabe.
- Demomodus: simuliert Laptop, Handy A und Handy B auf einem Desktop, bietet Beispielantworten, direkte Kapitelwahl, Hinweise und Reset.
- Lehrpersonenansicht: stellt Einstellungen, Kapiteluebersicht, Datenmodell und Export bereit.

## Phase 3: Architektur und Datenmodell

Die App ist bewusst klein gehalten:

- `server.mjs` startet Express.
- `src/app.mjs` stellt statische Dateien und Raum-APIs bereit.
- `src/services/heidi-room-manager.mjs` enthaelt die zentrale Spiellogik.
- `public/heidi-game/app.js` enthaelt die clientseitige Benutzerfuehrung.
- `public/heidi-game/styles.css` enthaelt das responsive Design.
- `public/heidi-game/assets/` enthaelt weboptimierte Medien wie kurze Loop-Videos.
- `data/heidi-game-content.json` enthaelt alle Kapitel, Rolleninformationen, Hinweise und Beispiele.

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
    "label": "Haus der Grossmutter",
    "caption": "Ruhige Szenenbeschreibung",
    "hasAudio": true,
    "audio": {
      "src": "/heidi-game/assets/alpsegen.mp3",
      "label": "Alpsegen anhoeren"
    }
  },
  "teamTask": "Gemeinsame Aufgabe",
  "voiceQuest": {
    "required": true,
    "roles": ["A"],
    "prompt": "Sprich deine Beobachtung zuerst laut ins Handy.",
    "minWords": 6
  },
  "hint": "Rueckmeldung ohne Richtig-falsch-Logik",
  "revisionPrompt": "Ueberarbeitungsauftrag",
  "example": "Beispielvariante",
  "reflection": "Reflexionsfrage"
}
```

## Phase 4-6: Spielbarer Prototyp

Der Prototyp enthaelt alle sechs Kapitel:

1. Die Alp spricht
2. Woerter fuer Wahrnehmungen
3. Mit dem Almoehi sprechen
4. Frankfurter Stimmen
5. Peter lernt anders
6. Heidi schreibt weiter

Kapitel 6 ist ausdruecklich als offene Weitererzaehlung gekennzeichnet, weil Heidi in Spyris urspruenglichen Baenden nicht ausdruecklich Schriftstellerin wird.

## Installation und lokaler Start

```bash
npm install
npm start
```

Standardadresse:

```text
http://127.0.0.1:3018
```

Fuer Entwicklung:

```bash
npm run dev
```

## Publikation ohne einschlafenden Server

Empfohlene Gratisloesung: **Cloudflare Workers + Static Assets + Durable Objects**.

Warum nicht nur GitHub Pages?

- GitHub Pages kann die statische Oberflaeche hosten, aber keine temporaeren Spielraeume mit synchronisiertem Rollenstatus bereitstellen.
- Das Spiel braucht API-Endpunkte fuer Raumcode, Rollenbelegung, Kapitelwechsel, Wiederverbindung und Lernspur.

Warum nicht Render oder Koyeb Free als Hauptloesung?

- Render Free Web Services schlafen nach Inaktivitaet ein.
- Koyeb Free Instances skalieren ebenfalls automatisch auf null.
- Fuer ein Klassenzimmer ist ein kalter Start genau dann stoerend, wenn die Lernenden beitreten wollen.

Cloudflare Workers schlafen nicht als einzelner Node-Server ein. Die App wird als statische Assets am Edge ausgeliefert; die Raumlogik laeuft serverlos in einem Durable Object. Durable Objects sind fuer koordinierte, zustandsbehaftete Anwendungen wie kleine Multiplayer-/Kollaborationsraeume geeignet.

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

Die Cloudflare-Konfiguration liegt in `wrangler.jsonc`. Der Worker liegt in `worker/index.mjs`. `npm run build:cloudflare` erzeugt vor dem Deploy einen schlanken Ordner `dist-cloudflare/`, der nur `index.html`, `heidi-game/` und `data/heidi-game-content.json` enthaelt. So werden alte Projektdateien nicht mitveroeffentlicht.

Wichtig fuer die Assets:

- Einzelne Cloudflare-Static-Asset-Dateien sollten unter 25 MiB bleiben. Die aktuellen Video-Loops liegen darunter.
- Videos laufen stumm im Loop; Ton wird per Button aktiviert.
- Fuer schulischen Produktiveinsatz sollten die genutzten Film-/Tonrechte geklaert sein.

## Nutzung im selben WLAN

Starte den Server fuer andere Geraete sichtbar:

```bash
HOST=0.0.0.0 npm start
```

Oeffne auf dem Laptop die lokale Netzwerkadresse, zum Beispiel:

```text
http://192.168.1.23:3018
```

Im Partnermodus zeigt der Laptop einen Raumcode und eine Beitrittsadresse. Beide Handys oeffnen diese Adresse und treten als Rolle A oder B bei. Es werden keine Namen erfasst.

## Bedienung der Modi

- Startseite: Modus auswaehlen.
- Partnermodus: Raum eroeffnen, Handys verbinden, Rolleninformationen austauschen, geforderte Mikrofon-Beitraege auf dem Handy aufnehmen, Aufgabe auf dem Laptop bearbeiten.
- Desktopmodus: Rollenkarten nacheinander oeffnen, danach gemeinsam schreiben.
- Demomodus: Kapitel direkt anwählen, beide Handyansichten simulieren, Beispielantworten einsetzen, didaktische Hinweise ein- oder ausblenden.
- Lehrpersonenansicht: Sprachniveau, Kapitelzahl, Spielzeit, Hilfen und Anzeigeoptionen verwalten.

## Lernjournal und Export

Die Lernspur speichert:

- erste Formulierungen
- ueberarbeitete Fassungen
- Reflexionen
- gesammelte Woerter
- Kapitelbezug

Im Partnermodus liegt die Lernspur temporaer im Serverprozess. In Desktop-, Demo- und Lehrpersonenmodus liegt sie im Browser-`localStorage`. Der Export erzeugt eine lokale JSON-Datei; die Druckfunktion nutzt die Browser-Druckansicht.

## Bearbeitung der Aufgabendaten

Lehrpersonen koennen `data/heidi-game-content.json` bearbeiten. Nach dem Speichern den Server neu starten oder die Seite neu laden. Programmlogik muss fuer neue Formulierungen, Hinweise oder Beispielantworten nicht geaendert werden.

Mikrofon-Aufgaben werden pro Kapitel mit `voiceQuest` gesteuert. `required: true` sperrt die Rollenbestaetigung, bis ein Transkript mit mindestens `minWords` Woertern vorliegt. `roles` legt fest, welche Handyrolle die Spracheingabe erhaelt. Browser ohne Web-Speech-Unterstuetzung zeigen ein Ersatzfeld, damit die muendliche Aufgabe trotzdem dokumentiert werden kann.

Videos koennen ueber das optionale Feld `media` pro Kapitel eingebunden werden. Sie laufen stumm im Loop; bei vorhandener Tonspur zeigt die App einen Button zum Einschalten, weil Browser Autoplay mit Ton meistens blockieren. Zusaetzliche Hoerimpulse wie der Alpsegen koennen als `media.audio` hinterlegt werden.

Wenn ein Kapitel mehrere Szenen braucht, kann statt eines einzelnen `media`-Objekts `mediaItems` verwendet werden. Kapitel 1 nutzt das fuer Ziegenverhalten und Gewitterzeichen nebeneinander. Kapitel 4 nutzt `frankfurt-dorfschule-loop.m4v` als Frankfurter Schul- und Regelraum; Kapitel 5 nutzt `dorfschule-loop.m4v` als eigentliche Dorfschule.

Historische Kontextualisierungen koennen mit `historicalNote` im Kapitel hinterlegt werden. Kapitel 4 nutzt das, um Spyris Frankfurt mit einer rekonstruierten Stadtszene und der Kriegszerstoerung zu verbinden und kenntlich zu machen, dass dieses Frankfurt heute so nicht mehr existiert.

## Tests

```bash
npm test
```

Getestet werden insbesondere:

- Raum-Erstellung
- Rollenvergabe und Doppelbelegung
- Wiederverbindung mit gleicher Client-ID
- Speichern von Lernjournal-Eintraegen
- Kapitelwechsel mit Reset der Rollenbereitschaft

## Hinweise fuer spaeteren Produktiveinsatz

Der Prototyp ist fuer lokale Tests und schulische Erprobung ohne Registrierung gebaut. Fuer produktive Nutzung waeren sinnvoll:

- persistente, automatisch geloeschte Raumdaten
- echte QR-Code-Erzeugung
- robuster Mehrgeraete-Betrieb ueber WebSockets
- Administrationsoberflaeche fuer Inhaltsbearbeitung
- Datenschutzkonzept mit definierter Speicherdauer
- optionaler PDF-/Druckexport des Lernjournals
