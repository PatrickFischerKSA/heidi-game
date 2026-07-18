const app = document.querySelector("#app");
const storage = {
  clientId: "heidi.clientId",
  hostName: "heidi.hostName",
  journal: "heidi.localJournal",
  teacher: "heidi.teacherSettings"
};

const state = {
  content: null,
  mode: new URLSearchParams(location.search).get("mode") || routeMode(),
  room: null,
  role: null,
  hostName: localStorage.getItem(storage.hostName) || "",
  clientId: localStorage.getItem(storage.clientId) || crypto.randomUUID(),
  chapterIndex: 0,
  revealA: false,
  revealB: false,
  showDidactics: true,
  teacher: null,
  voiceDrafts: {},
  recognition: null,
  listeningKey: "",
  pollTimer: null,
  playSection: "cards"
};

localStorage.setItem(storage.clientId, state.clientId);

function routeMode() {
  if (location.pathname.startsWith("/join")) return "phone";
  if (location.pathname.startsWith("/desktop")) return "desktop";
  if (location.pathname.startsWith("/demo")) return "demo";
  if (location.pathname.startsWith("/teacher")) return "teacher";
  return "home";
}

function html(strings, ...values) {
  return strings.reduce((output, string, index) => output + string + (values[index] ?? ""), "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const FEEDBACK_PROFILES = {
  "alp-spricht": {
    aim: "Eine tragfähige Bauernregel entsteht aus Beobachtung, Spruchform und vorsichtiger Erklärung.",
    checks: [
      ["Beobachtung auf der Alp", ["ziege", "ziegen", "himmel", "wind", "licht", "wolke", "gras", "stein", "felsen"], "Nennt zuerst sichtbar, was Heidi wirklich bemerkt."],
      ["Spruchform", ["regel", "spruch", "reim", "wenn", "steht", "zieht", "kommt", "droht"], "Formt die Beobachtung zu einem knappen Merksatz, nicht zu einer langen Erklärung."],
      ["Vorsicht", ["vielleicht", "oft", "manchmal", "nicht immer", "kann", "könnte"], "Ergänzt, dass die Bauernregel Erfahrung ist und nicht immer stimmen muss."]
    ],
    upgrade: "Überarbeitet so: Beobachtung konkret machen, Spruch kürzen, dann mit 'oft', 'manchmal' oder 'vielleicht' einschränken."
  },
  "ziegen-ansprechen": {
    aim: "Die Tieransprache soll natürlich klingen und zugleich genau beobachten.",
    checks: [
      ["Heidis Stimme", ["heidi", "komm", "nur", "kleine", "ruhig", "ich tue", "darf"], "Gebt Heidi einen kurzen Satz, der ein Kind auf der Alp wirklich sagen könnte."],
      ["Ziegenverhalten", ["ziege", "meckert", "zupft", "trottet", "springt", "bleibt", "kommt"], "Zeigt, was die Ziege tut, statt sie menschlich denken zu lassen."],
      ["Peters praktische Antwort", ["peter", "sagt", "lacht", "zeigt", "ruft", "weiß"], "Lasst Peter mit einem einfachen, praktischen Satz reagieren."]
    ],
    upgrade: "Kürzt Heidis Satz, ersetzt eine menschliche Tierdeutung durch ein sichtbares Verhalten und gebt Peter eine knappe Reaktion."
  },
  "almoehi-sprechen": {
    aim: "Heidis Frage soll den Großvater öffnen, ohne ihn zu bedrängen.",
    checks: [
      ["Bauernregel genannt", ["morgenrot", "abendrot", "regen", "wetter", "bauernregel", "spruch"], "Nennt die Regel, auf die Heidi sich bezieht."],
      ["Offene Frage", ["was bedeutet", "woran", "warum", "gilt", "zeigst", "kannst"], "Formuliert eine Frage, auf die der Großvater mehr als Ja oder Nein antworten kann."],
      ["Respektvoller Ton", ["großvater", "darf", "bitte", "ich möchte", "verstehen"], "Macht hörbar, dass Heidi neugierig ist und nicht belehrt."]
    ],
    upgrade: "Baut die Frage nach dem Muster: 'Großvater, du hast gesagt ... Woran siehst du ...?'"
  },
  "frankfurter-stimmen": {
    aim: "Die Antwort muss wörtliche Regel, Tonfall und faire Hilfe trennen.",
    checks: [
      ["Wörtliche Aussage", ["wörtlich", "gesagt", "regel", "das macht man", "hausregel"], "Schreibt zuerst, was tatsächlich gesagt wird."],
      ["Tonfall und Macht", ["ton", "scharf", "tadel", "macht", "beschäm", "abstand"], "Erklärt, was durch Ton und Situation zusätzlich passiert."],
      ["Faire Hilfe", ["fair", "zeige", "hilft", "nächstes mal", "ohne", "beschämen"], "Formuliert eine Alternative, die Heidi lernen lässt."]
    ],
    upgrade: "Dreiteilt die Antwort klar: Satz 1 wörtlich, Satz 2 Ton/Situation, Satz 3 faire Hilfe."
  },
  "peter-lernt-anders": {
    aim: "Der Lernweg muss zu Peters Lebenswelt passen und ermutigen.",
    checks: [
      ["Peters Welt", ["ziege", "ziegen", "weg", "steg", "hang", "herde", "alp"], "Bindet Lesen an etwas, das Peter kennt."],
      ["Drei Schritte", ["1.", "2.", "3.", "zuerst", "dann", "danach"], "Ordnet den Lernweg in nachvollziehbare Schritte."],
      ["Ermutigung statt Drohung", ["ermutig", "lob", "du hast", "noch einmal", "nicht beschäm", "ohne drohung"], "Zeigt, wie Peter Rückmeldung bekommt, ohne beschämt zu werden."]
    ],
    upgrade: "Macht aus dem Plan eine kleine Unterrichtssequenz: Material, Lesesatz, Rückmeldung."
  },
  "heidi-erzaehlt-weiter": {
    aim: "Die Weitererzählung muss als möglich markiert und aus konkreter Erinnerung gebaut sein.",
    checks: [
      ["Offene Markierung", ["vielleicht", "ich stelle mir", "später könnte", "möglicherweise"], "Markiert, dass es eine Weitererzählung ist, nicht Spyris Behauptung."],
      ["Konkrete Erinnerung", ["bauernregel", "frankfurt", "großmutter", "alp", "großvater", "wind"], "Verankert Heidis Erzählen in einer konkreten Erfahrung."],
      ["Zeitliche Ordnung", ["zuerst", "dann", "später", "heute", "damals"], "Macht erkennbar, wann Heidi erinnert und wann sie erzählt."]
    ],
    upgrade: "Beginnt mit 'Vielleicht hätte Heidi später erzählt ...' und hängt eine konkrete Erinnerung daran."
  },
  "huette-einrichten": {
    aim: "Die Hütte soll über Gegenstände und Handgriffe sichtbar werden.",
    checks: [
      ["Gegenstände", ["bank", "schüssel", "decke", "heu", "tisch", "kessel"], "Nennt mindestens zwei Dinge, die in der Hütte eine Funktion haben."],
      ["Handgriff", ["legt", "stellt", "schiebt", "nimmt", "zeigt", "hält"], "Zeigt einen Handgriff statt nur zu erklären."],
      ["Höfliche Bitte", ["darf", "kann ich", "bitte", "großvater"], "Lasst Heidi vorsichtig um Erlaubnis fragen."]
    ],
    upgrade: "Ersetzt 'Ding' und 'machen' durch Gegenstände und Verben wie stellen, legen, schieben, halten."
  },
  "bett-im-heu": {
    aim: "Das Heubett soll sinnlich und ruhig beschrieben werden, ohne Kitsch.",
    checks: [
      ["Geruch", ["riecht", "geruch", "heu", "trocken", "warm"], "Fügt einen Geruch ein, nicht nur ein Gefühl."],
      ["Geräusch", ["raschelt", "wind", "still", "hört", "geräusch"], "Lasst ein leises Geräusch vorkommen."],
      ["Körperempfindung", ["müde", "warm", "kopf", "atem", "decke", "liegt"], "Zeigt, wie Heidi den Schlafplatz körperlich erlebt."]
    ],
    upgrade: "Streicht ein pauschales Adjektiv und ersetzt es durch Geruch, Geräusch oder Körperempfindung."
  },
  "peter-stellt-ziegen-vor": {
    aim: "Die Ziegen sollen durch Namen und Verhalten unterscheidbar werden.",
    checks: [
      ["Namen", ["schwänli", "bärli", "name", "heißt"], "Gebt den Ziegen Namen oder macht deutlich, wie Peter sie nennt."],
      ["Eigenheit", ["zupft", "drängt", "bleibt", "läuft", "findet", "langsam"], "Beschreibt eine sichtbare Gewohnheit jeder Ziege."],
      ["Dialog", ["heidi", "peter", "fragt", "sagt"], "Schreibt die Information als Gespräch, nicht als Liste."]
    ],
    upgrade: "Macht aus einer Eigenschaft ein Verhalten: nicht 'lieb', sondern 'bleibt beim Felsen stehen'."
  },
  "gewitter-kommt": {
    aim: "Die Gewitterquest braucht klare Warnsprache und Handlungsfolge.",
    checks: [
      ["Beobachtung", ["wolken", "wind", "gras", "herde", "dunkel", "donner"], "Beginnt mit einem sichtbaren oder hörbaren Wetterzeichen."],
      ["Entscheidung", ["zurück", "hütte", "gehen", "nicht rennen", "bevor"], "Formuliert, was jetzt entschieden wird."],
      ["Handgriff", ["hält", "sammelt", "ruft", "nimmt", "führt"], "Nennt eine konkrete Handlung mit der Herde."]
    ],
    upgrade: "Ordnet die fünf Sätze als Beobachtung, Warnung, Entscheidung, Handgriff, Rückweg."
  },
  "alpsegen-hoeren": {
    aim: "Der Alpsegen soll als Hör- und Traditionsmoment respektvoll beschrieben werden.",
    checks: [
      ["Hörbeobachtung", ["stimme", "klingt", "getragen", "lang", "wiederholung", "pause"], "Beschreibt den Klang, bevor ihr deutet."],
      ["Schutzwunsch", ["schutz", "bitte", "nacht", "mensch", "tier", "ort"], "Ordnet den Alpsegen als Bitte oder Schutzwunsch ein."],
      ["Respekt", ["tradition", "respekt", "nicht nachahmen", "vorsichtig"], "Vermeidet Spott und vorschnelle Bewertung."]
    ],
    upgrade: "Ersetzt ein Urteil durch eine Hörbeobachtung: 'Die Stimme klingt ...', 'Die Wiederholung wirkt ...'."
  },
  "grossvater-arbeitet": {
    aim: "Die Anleitung muss über genaue Verben und Reihenfolge funktionieren.",
    checks: [
      ["Reihenfolge", ["zuerst", "dann", "danach", "erst wenn", "am schluss"], "Ordnet die Arbeitsschritte klar."],
      ["Handverben", ["hält", "nimmt", "gießt", "stellt", "schiebt", "hebt"], "Verwendet Verben, die Heidi nachmachen kann."],
      ["Knappheit", ["kurz", "ruhig", "großvater"], "Lasst die Anleitung nicht wie einen langen Vortrag klingen."]
    ],
    upgrade: "Schreibt die Anleitung als drei knappe Sätze des Großvaters mit sichtbaren Handgriffen."
  },
  "ankunft-frankfurt": {
    aim: "Frankfurt soll über konkrete Kontraste zur Alp erfahrbar werden.",
    checks: [
      ["Stadtbeobachtung", ["häuser", "straße", "treppe", "kutsche", "tür", "fenster"], "Nennt Dinge der Stadt, die Heidi sieht."],
      ["Alp-Kontrast", ["alp", "weite", "luft", "himmel", "blick", "wind"], "Vergleicht vorsichtig mit der Alp."],
      ["Kein Pauschalurteil", ["nicht einfach", "anders", "fremd", "wirkt"], "Vermeidet Stadt-ist-schlecht-Sätze und bleibt bei Beobachtungen."]
    ],
    upgrade: "Ersetzt 'Frankfurt ist schlimm' durch eine Beobachtung wie 'Der Himmel ist nur als Streifen zu sehen'."
  },
  "clara-kennenlernen": {
    aim: "Heidi und Clara sollen sich gegenseitig fragen, nicht einander festlegen.",
    checks: [
      ["Heidis Frage", ["darf ich", "wie ist", "magst du", "heidi fragt"], "Lasst Heidi vorsichtig und offen fragen."],
      ["Claras eigene Welt", ["clara", "buch", "fenster", "unterricht", "zimmer"], "Gebt Clara mehr als eine Rolle als Patientin."],
      ["Gegenseitigkeit", ["danach", "ich erzähle", "zeigst du", "beide"], "Beide Kinder sollen etwas anbieten."]
    ],
    upgrade: "Prüft, ob Clara nur bemitleidet wird. Ergänzt etwas, das Clara Heidi zeigen oder fragen kann."
  },
  "rottenmeier-tisch": {
    aim: "Die Tischregel muss in verletzend, neutral und hilfreich unterschieden werden.",
    checks: [
      ["Drei Fassungen", ["verletzend", "neutral", "hilfreich"], "Schreibt wirklich alle drei Fassungen aus."],
      ["Konkrete Tischregel", ["serviette", "besteck", "tisch", "essen", "schoß"], "Nennt die konkrete Regel am Tisch."],
      ["Nächster Schritt", ["leg", "nimm", "zeige", "nächstes mal", "hierher"], "Die hilfreiche Fassung soll sagen, was Heidi tun kann."]
    ],
    upgrade: "Macht die hilfreiche Fassung handlungsnah: 'Leg ...', 'Nimm ...', 'Ich zeige dir ...'."
  },
  "sehnsucht-alp": {
    aim: "Heimweh soll gezeigt werden, ohne das Wort Heimweh zu benutzen.",
    checks: [
      ["Körperzeichen", ["isst", "schläft", "atem", "hände", "fenster", "brot"], "Zeigt Heidis Körper oder Handlung."],
      ["Erinnerungsbild", ["alp", "wind", "ziegen", "heu", "peter", "hütte"], "Lasst ein Bild der Alp in Frankfurt auftauchen."],
      ["Wortverzicht", ["heimweh"], "Falls 'Heimweh' vorkommt: Ersetzt es durch Szene, Blick oder Erinnerung."]
    ],
    upgrade: "Streicht 'Heimweh' oder 'traurig' und zeigt stattdessen Fensterblick, unberührtes Brot oder einen inneren Klang der Alp."
  },
  "frankfurt-verlorene-stadt": {
    aim: "Die historische Erklärung muss Rekonstruktion, Zerstörung und heutigen Abstand trennen.",
    checks: [
      ["1890 rekonstruiert", ["1890", "rekonstruiert", "spyris", "stadtwelt"], "Markiert die alte Frankfurt-Szene als Annäherung."],
      ["1944 als späterer Bruch", ["1944", "krieg", "zerstörung", "bomb", "katastrophe"], "Ordnet die Zerstörung als spätere historische Katastrophe ein."],
      ["Heute nicht gleich", ["heute", "nicht mehr", "wiederaufbau", "existiert"], "Erklärt, warum Spyris Frankfurt heute so nicht mehr vorhanden ist."]
    ],
    upgrade: "Formuliert in drei Sätzen: rekonstruiertes 19. Jahrhundert, Zerstörung 1944, heutiger Abstand."
  },
  "rueckkehr-alp": {
    aim: "Die Rückkehr muss Vertrautheit und Veränderung zugleich zeigen.",
    checks: [
      ["Wiedererkennen", ["wieder", "hütte", "wind", "gras", "großvater", "alp"], "Zeigt, was Heidi wiedererkennt."],
      ["Veränderung", ["frankfurt", "anders", "nicht mehr", "hinter ihr", "gelernt"], "Macht sichtbar, dass Heidi verändert zurückkommt."],
      ["Kurzer Satz", ["großvater", "ich bin", "da"], "Heidis erster Satz darf knapp und bedeutungsvoll sein."]
    ],
    upgrade: "Kürzt Heidis ersten Satz und ergänzt einen Hinweis, dass Frankfurt innerlich noch nachwirkt."
  },
  "grossmutter-hoert": {
    aim: "Zuhören soll als Handlung sichtbar werden.",
    checks: [
      ["Kurzer Satz der Großmutter", ["erzähl", "kind", "langsam", "ich höre", "weiter"], "Lasst die Großmutter knapp zum Weitererzählen einladen."],
      ["Pause oder Blick", ["pause", "wartet", "blick", "hände", "leise"], "Zeigt Zuhören körperlich, nicht nur durch Rede."],
      ["Heidis Erzählen verändert sich", ["noch einmal", "langsamer", "beginnt", "findet", "wort"], "Macht sichtbar, dass Heidi durch Zuhören weiterkommt."]
    ],
    upgrade: "Streicht eine lange Rede der Großmutter und ersetzt sie durch Pause plus kurze Rückfrage."
  },
  "peter-eifersucht": {
    aim: "Peters Gefühl soll verständlich werden, ohne falsches Verhalten zu entschuldigen.",
    checks: [
      ["Gefühl", ["eifersüchtig", "zurückgesetzt", "angst", "trotzig", "verliert"], "Benennt oder zeigt Peters schwieriges Gefühl."],
      ["Handlung", ["tritt", "sagt nichts", "nimmt", "wegschaut", "verletzt"], "Nennt, was Peter tatsächlich tut."],
      ["Grenze", ["trotzdem", "darf nicht", "grenze", "verantwortung"], "Setzt eine klare Grenze für verletzendes Verhalten."]
    ],
    upgrade: "Schreibt zwei Auswertungssätze: 'Man kann verstehen, dass ...' und 'Trotzdem darf ...'."
  },
  "dorfschule-peter": {
    aim: "Die Schulaufgabe muss Material, Lesesatz und Rückmeldung enthalten.",
    checks: [
      ["Material", ["karte", "bild", "ziegenname", "weg", "tisch"], "Legt fest, womit Peter arbeitet."],
      ["Lesesatz", ["liest", "satz", "schwänli", "steg", "geht"], "Schreibt den konkreten Satz, den Peter lesen soll."],
      ["Rückmeldung", ["du hast", "erkannt", "noch einmal", "gut", "nächstes wort"], "Gebt eine ermutigende Rückmeldung."]
    ],
    upgrade: "Macht aus der Idee eine spielbare Aufgabe: Material auf dem Tisch, Peters Satz, genaue Rückmeldung."
  },
  "clara-auf-der-alp": {
    aim: "Claras Alp-Erfahrung braucht Hilfe ohne Bevormundung.",
    checks: [
      ["Claras Wahrnehmung", ["clara", "licht", "luft", "weg", "wiese", "unsicher"], "Zeigt Claras eigene Wahrnehmung der Alp."],
      ["Heidis Angebot", ["ich zeige", "langsam", "pause", "du kannst", "wenn du willst"], "Formuliert Hilfe als Angebot."],
      ["Würde", ["nicht drängen", "nicht bevormunden", "ernst", "wahl"], "Achtet darauf, Clara nicht klein zu machen."]
    ],
    upgrade: "Ersetzt 'Du musst' durch 'Wir können' oder 'Wenn du willst, zeige ich dir ...'."
  },
  "ziegen-verloren": {
    aim: "Die Suchaufgabe braucht genaue Ortsangaben und einen planvollen Ruf.",
    checks: [
      ["Ortsangabe", ["felsen", "steg", "bach", "hang", "oberhalb", "unterhalb"], "Ersetzt 'dort' durch eine echte Ortsangabe."],
      ["Suchplan", ["zuerst", "dann", "danach", "zurück", "nicht allein"], "Ordnet die Suche in Schritte."],
      ["Lockruf", ["komm", "schwänli", "ziege", "hier", "weg"], "Formuliert einen kurzen Ruf, der zur Ziege passt."]
    ],
    upgrade: "Schreibt: letzter Ort, erster Suchweg, zweiter Suchweg, Rückweg-Regel, Lockruf."
  },
  "schlusskreis": {
    aim: "Der Schlusskreis soll auswählen, begründen und einen Lerngewinn benennen.",
    checks: [
      ["Eine Szene", ["ich wähle", "szene", "hütte", "ziege", "frankfurt", "schule", "alp"], "Wählt eine konkrete Szene statt alles aufzuzählen."],
      ["Ein Wort und eine Frage", ["wort", "frage", "warum", "woran", "oberhalb", "weil"], "Nennt ein genaueres Wort und eine gute Frage."],
      ["Begründung", ["weil", "dadurch", "deshalb", "gelernt"], "Begründet, was sich sprachlich verändert hat."]
    ],
    upgrade: "Formt den Beitrag so: Ich wähle ..., weil ... Das Wort ... hilft ... Die Frage ... öffnet ..."
  }
};

function gfMultiply(left, right) {
  let result = 0;
  for (let index = 0; index < 8; index += 1) {
    if (right & 1) result ^= left;
    const carry = left & 0x80;
    left = (left << 1) & 0xff;
    if (carry) left ^= 0x1d;
    right >>= 1;
  }
  return result;
}

function rsGenerator(degree) {
  let result = [1];
  let root = 1;
  for (let index = 0; index < degree; index += 1) {
    const next = Array(result.length + 1).fill(0);
    result.forEach((coefficient, position) => {
      next[position] ^= coefficient;
      next[position + 1] ^= gfMultiply(coefficient, root);
    });
    result = next;
    root = gfMultiply(root, 2);
  }
  return result;
}

function rsRemainder(data, degree) {
  const generator = rsGenerator(degree);
  const result = Array(degree).fill(0);
  for (const value of data) {
    const factor = value ^ result.shift();
    result.push(0);
    generator.slice(1).forEach((coefficient, index) => {
      result[index] ^= gfMultiply(coefficient, factor);
    });
  }
  return result;
}

function appendBits(bits, value, length) {
  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push((value >>> index) & 1);
  }
}

function bitsToCodewords(bits) {
  const bytes = [];
  for (let index = 0; index < bits.length; index += 8) {
    let value = 0;
    for (let offset = 0; offset < 8; offset += 1) {
      value = (value << 1) | (bits[index + offset] || 0);
    }
    bytes.push(value);
  }
  return bytes;
}

function qrDataCodewords(text) {
  const encoder = new TextEncoder();
  const bytes = [...encoder.encode(text)];
  const capacity = 108;
  if (bytes.length > 106) return null;
  const bits = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  appendBits(bits, 0, Math.min(4, capacity * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = bitsToCodewords(bits);
  for (let pad = 0xec; data.length < capacity; pad = pad === 0xec ? 0x11 : 0xec) {
    data.push(pad);
  }
  return data;
}

function drawFinder(modules, reserved, x, y) {
  for (let row = -1; row <= 7; row += 1) {
    for (let col = -1; col <= 7; col += 1) {
      const yy = y + row;
      const xx = x + col;
      if (yy < 0 || yy >= modules.length || xx < 0 || xx >= modules.length) continue;
      const dark = row >= 0 && row <= 6 && col >= 0 && col <= 6 && (row === 0 || row === 6 || col === 0 || col === 6 || (row >= 2 && row <= 4 && col >= 2 && col <= 4));
      modules[yy][xx] = dark;
      reserved[yy][xx] = true;
    }
  }
}

function drawAlignment(modules, reserved, centerX, centerY) {
  for (let row = -2; row <= 2; row += 1) {
    for (let col = -2; col <= 2; col += 1) {
      const dark = Math.max(Math.abs(row), Math.abs(col)) !== 1;
      modules[centerY + row][centerX + col] = dark;
      reserved[centerY + row][centerX + col] = true;
    }
  }
}

function qrBase() {
  const size = 37;
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));
  drawFinder(modules, reserved, 0, 0);
  drawFinder(modules, reserved, size - 7, 0);
  drawFinder(modules, reserved, 0, size - 7);
  drawAlignment(modules, reserved, 30, 30);
  for (let index = 8; index < size - 8; index += 1) {
    const dark = index % 2 === 0;
    modules[6][index] = dark;
    modules[index][6] = dark;
    reserved[6][index] = true;
    reserved[index][6] = true;
  }
  modules[29][8] = true;
  reserved[29][8] = true;
  for (let index = 0; index < 9; index += 1) {
    reserved[8][index] = true;
    reserved[index][8] = true;
    reserved[8][size - 1 - index] = true;
    reserved[size - 1 - index][8] = true;
  }
  return { modules, reserved };
}

function qrMask(mask, row, col) {
  if (mask === 0) return (row + col) % 2 === 0;
  if (mask === 1) return row % 2 === 0;
  if (mask === 2) return col % 3 === 0;
  if (mask === 3) return (row + col) % 3 === 0;
  if (mask === 4) return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
  if (mask === 5) return ((row * col) % 2) + ((row * col) % 3) === 0;
  if (mask === 6) return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
  return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
}

function placeData(modules, reserved, codewords, mask) {
  const size = modules.length;
  const bits = codewords.flatMap((byte) => Array.from({ length: 8 }, (_, index) => (byte >>> (7 - index)) & 1));
  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let offset = 0; offset < size; offset += 1) {
      const row = upward ? size - 1 - offset : offset;
      for (const col of [right, right - 1]) {
        if (reserved[row][col]) continue;
        let dark = Boolean(bits[bitIndex] || 0);
        if (qrMask(mask, row, col)) dark = !dark;
        modules[row][col] = dark;
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
}

function formatBits(mask) {
  let value = (1 << 3) | mask;
  let data = value << 10;
  const generator = 0x537;
  for (let index = 14; index >= 10; index -= 1) {
    if ((data >>> index) & 1) data ^= generator << (index - 10);
  }
  return (((value << 10) | data) ^ 0x5412) & 0x7fff;
}

function placeFormat(modules, mask) {
  const size = modules.length;
  const bits = formatBits(mask);
  const first = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
  const second = [[size-1,8],[size-2,8],[size-3,8],[size-4,8],[size-5,8],[size-6,8],[size-7,8],[size-8,8],[8,size-7],[8,size-6],[8,size-5],[8,size-4],[8,size-3],[8,size-2],[8,size-1]];
  first.forEach(([row, col], index) => { modules[row][col] = Boolean((bits >>> index) & 1); });
  second.forEach(([row, col], index) => { modules[row][col] = Boolean((bits >>> index) & 1); });
}

function penaltyScore(modules) {
  const size = modules.length;
  let score = 0;
  for (let row = 0; row < size; row += 1) {
    let runColor = modules[row][0];
    let run = 1;
    for (let col = 1; col < size; col += 1) {
      if (modules[row][col] === runColor) run += 1;
      else {
        if (run >= 5) score += run - 2;
        runColor = modules[row][col];
        run = 1;
      }
    }
    if (run >= 5) score += run - 2;
  }
  for (let col = 0; col < size; col += 1) {
    let runColor = modules[0][col];
    let run = 1;
    for (let row = 1; row < size; row += 1) {
      if (modules[row][col] === runColor) run += 1;
      else {
        if (run >= 5) score += run - 2;
        runColor = modules[row][col];
        run = 1;
      }
    }
    if (run >= 5) score += run - 2;
  }
  for (let row = 0; row < size - 1; row += 1) {
    for (let col = 0; col < size - 1; col += 1) {
      const color = modules[row][col];
      if (modules[row][col + 1] === color && modules[row + 1][col] === color && modules[row + 1][col + 1] === color) score += 3;
    }
  }
  const dark = modules.flat().filter(Boolean).length;
  score += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
  return score;
}

function qrSvg(text) {
  const data = qrDataCodewords(text);
  if (!data) return "";
  const codewords = [...data, ...rsRemainder(data, 26)];
  let best = null;
  for (let mask = 0; mask < 8; mask += 1) {
    const { modules, reserved } = qrBase();
    placeData(modules, reserved, codewords, mask);
    placeFormat(modules, mask);
    const score = penaltyScore(modules);
    if (!best || score < best.score) best = { modules, score };
  }
  const size = best.modules.length;
  const quiet = 4;
  const rects = [];
  best.modules.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) rects.push(`M${x + quiet},${y + quiet}h1v1h-1z`);
  }));
  return `<svg class="qr-code" viewBox="0 0 ${size + quiet * 2} ${size + quiet * 2}" role="img" aria-label="QR-Code"><rect width="100%" height="100%" fill="#fffaf0"/><path d="${rects.join("")}" fill="#1d3027"/></svg>`;
}

function chapter() {
  return state.content.chapters[state.chapterIndex] || state.content.chapters[0];
}

function journalEntries() {
  const roomJournal = state.room?.journal || [];
  const localJournal = JSON.parse(localStorage.getItem(storage.journal) || "[]");
  return state.mode === "partner" || state.mode === "phone" ? roomJournal : localJournal;
}

function saveLocalEntry(entry) {
  const entries = JSON.parse(localStorage.getItem(storage.journal) || "[]");
  entries.push({ ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
  localStorage.setItem(storage.journal, JSON.stringify(entries));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || "Die Anfrage ist fehlgeschlagen.");
  }
  return data;
}

function topbar(active = state.mode) {
  const items = [
    ["home", "/", "Start"],
    ["partner", "#partner", "Partnermodus"],
    ["desktop", "/desktop", "Desktop"],
    ["demo", "/demo", "Demo"],
    ["teacher", "/teacher", "Lehrpersonen"]
  ];
  return html`
    <header class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">H</span><span>Heidi - Die Welt bekommt Worte</span></div>
      <nav class="nav-pills" aria-label="Modus">
        ${items.map(([id, href, label]) => `<button type="button" data-nav="${id}" aria-current="${active === id ? "page" : "false"}">${label}</button>`).join("")}
      </nav>
    </header>
  `;
}

function renderHome() {
  state.mode = "home";
  stopPolling();
  app.innerHTML = html`
    ${topbar("home")}
    <section class="hero">
      ${sceneMedia(state.content)}
      <div class="hero-copy">
        <p class="eyebrow">Browserbasiertes Partnerspiel</p>
        <h1>Heidi - Die Welt bekommt Worte</h1>
        <p>${escapeHtml(state.content.learningConcept.short)}</p>
      </div>
      <div class="mode-grid">
        <article class="card">
          <h2>Partnermodus</h2>
          <p>Hauptcomputer als Spielleitung, zwei Handys mit QR-Codes für Schwänli und Schnecke.</p>
          <form class="host-login" data-host-login>
            <label>Hauptcomputer<input name="hostName" value="${escapeHtml(state.hostName)}" placeholder="z. B. Klasse 2b oder Lehrperson" required></label>
            <button type="submit">Spielraum eröffnen</button>
          </form>
        </article>
        <article class="card">
          <h2>Desktopmodus</h2>
          <p>Zwei Personen spielen an einem Bildschirm. Die Ziegenkarten werden nacheinander freigegeben.</p>
          <button type="button" data-nav="desktop">Desktop starten</button>
        </article>
        <article class="card">
          <h2>Demomodus</h2>
          <p>Beide Handyansichten, Beispielantworten, Kapitelwahl und didaktische Hinweise auf einem Desktop.</p>
          <button type="button" data-nav="demo">Demo öffnen</button>
        </article>
        <article class="card">
          <h2>Lehrpersonenansicht</h2>
          <p>Einstellungen, Datenmodell, Export und Hinweise für den schulischen Einsatz.</p>
          <button type="button" data-nav="teacher">Ansicht öffnen</button>
        </article>
      </div>
    </section>
  `;
}

async function startRoom(hostName = state.hostName) {
  state.hostName = String(hostName || "").trim();
  if (!state.hostName) {
    renderHome();
    return;
  }
  localStorage.setItem(storage.hostName, state.hostName);
  const room = await api("/api/rooms", { method: "POST", body: "{}" });
  state.mode = "partner";
  state.room = room;
  state.chapterIndex = room.chapterIndex;
  renderPartner();
  startPolling();
}

function joinAddress(role = "") {
  const url = new URL("/join", location.origin);
  url.searchParams.set("code", state.room?.code || "");
  if (role) url.searchParams.set("role", role);
  return url.toString();
}

function playerProfile(role, label = "") {
  const profiles = {
    A: {
      name: "Schwänli",
      src: "/heidi-game/assets/player-goat-a.jpg",
      alt: "Schwänli, die weiße Ziege"
    },
    B: {
      name: "Schnecke",
      src: "/heidi-game/assets/player-goat-b.jpeg",
      alt: "Schnecke, die gefleckte Ziege"
    }
  };
  const profile = profiles[role] || profiles.A;
  return html`
    <div class="player-profile role-${role.toLowerCase()}">
      <img src="${escapeHtml(profile.src)}" alt="${escapeHtml(profile.alt)}" loading="lazy">
      <div>
        <strong>${escapeHtml(label || profile.name)}</strong>
        <span>${role === "A" ? "Beobachten und sprechen" : "Wörter finden und nachfragen"}</span>
      </div>
    </div>
  `;
}

function qrCard(role, title, subtitle) {
  const url = joinAddress(role);
  return html`
    <article class="qr-card role-${role.toLowerCase()}">
      ${playerProfile(role, title)}
      <div>
        <p class="eyebrow">${escapeHtml(title)}</p>
        <h3>${role === "A" ? "Schwänli" : "Schnecke"}</h3>
        <p>${escapeHtml(subtitle)}</p>
      </div>
      ${qrSvg(url)}
      <p class="small">${escapeHtml(url)}</p>
    </article>
  `;
}

function renderPartner() {
  state.mode = "partner";
  const c = chapter();
  const sections = [
    { id: "join", label: "Handys" },
    { id: "path", label: "Questpfad" },
    { id: "status", label: "Stand" },
    { id: "write", label: "Schreiben" },
    { id: "log", label: "Lernspur" }
  ];
  const active = activePlaySection(sections, "join");
  app.innerHTML = html`
    ${topbar("partner")}
    <div class="play-layout">
      ${questStage(c, "Laptop-Spielleitung")}
      ${playSectionMenu(sections, active)}
      ${active === "join" ? html`
        <div class="panel stack">
          <div>
            <p class="eyebrow">Hauptcomputer</p>
            <h2>${escapeHtml(state.hostName)}</h2>
            <p>Die Handys scannen den Code ihrer Ziege. Der Raumcode bleibt nur als Reserve sichtbar: <strong>${escapeHtml(state.room?.code || "----")}</strong></p>
          </div>
          <div class="qr-grid">
            ${qrCard("A", "Schwänli", "Beobachten und zuerst sprechen")}
            ${qrCard("B", "Schnecke", "Wörter finden und nachfragen")}
          </div>
        </div>
      ` : ""}
      ${active === "path" ? chapterTabs() : ""}
      ${active === "status" ? statusStrip() : ""}
      ${active === "write" ? teamTaskPanel() : ""}
      ${active === "log" ? journalPanel() : ""}
    </div>
  `;
}

function questStage(c, label) {
  return html`
    <section class="quest-stage">
      <div class="quest-copy">
        <div class="quest-kicker">
          <span>${escapeHtml(label)}</span>
          <span>${escapeHtml(c.place || "Spielort")}</span>
          <span>Quest ${state.chapterIndex + 1} von ${state.content.chapters.length}</span>
        </div>
        <h1>${escapeHtml(c.title)}</h1>
        <p>${escapeHtml(c.laptopFrame)}</p>
        ${historicalNote(c)}
        <div class="quest-actions">
          <button type="button" class="secondary" data-prev-chapter ${state.chapterIndex === 0 ? "disabled" : ""}>Vorige Quest</button>
          <button type="button" data-next-chapter ${state.chapterIndex >= state.content.chapters.length - 1 ? "disabled" : ""}>Nächste Quest</button>
        </div>
      </div>
      ${sceneMedia(c)}
    </section>
  `;
}

function chapterTabs() {
  const progress = ((state.chapterIndex + 1) / state.content.chapters.length) * 100;
  return html`
    <div class="quest-map panel">
      <div class="quest-map-head">
        <div>
          <p class="eyebrow">Questpfad</p>
          <strong>${escapeHtml(chapter().title)}</strong>
        </div>
        <span>${state.chapterIndex + 1}/${state.content.chapters.length}</span>
      </div>
      <div class="quest-progress" aria-hidden="true"><span style="width:${progress}%"></span></div>
      <div class="chapter-tabs" aria-label="Kapitel">
        ${state.content.chapters.map((item, index) => `<button type="button" title="${escapeHtml(item.title)}" data-chapter="${index}" aria-current="${index === state.chapterIndex}"><span>${index + 1}</span></button>`).join("")}
      </div>
    </div>
  `;
}

function activePlaySection(items, fallback = "cards") {
  return items.some((item) => item.id === state.playSection) ? state.playSection : fallback;
}

function playSectionMenu(items, active) {
  return html`
    <nav class="section-menu panel" aria-label="Arbeitsbereiche">
      ${items.map((item) => `<button type="button" data-play-section="${escapeHtml(item.id)}" aria-current="${item.id === active}">${escapeHtml(item.label)}</button>`).join("")}
    </nav>
  `;
}

function statusStrip() {
  const occupied = state.room?.occupiedRoles || {};
  const ready = state.room?.roleReady || {};
  return html`
    <div class="status-strip">
      <div class="status-item">${playerProfile("A", "Schwänli")}<span>${occupied.A ? "verbunden" : "wartet"} · ${ready.A ? "ausgetauscht" : "noch geheim"}</span></div>
      <div class="status-item">${playerProfile("B", "Schnecke")}<span>${occupied.B ? "verbunden" : "wartet"} · ${ready.B ? "ausgetauscht" : "noch geheim"}</span></div>
      <div class="status-item"><strong>Kapitel</strong><br>${state.chapterIndex + 1} von ${state.content.chapters.length}</div>
    </div>
  `;
}

function sceneMedia(c) {
  const mediaItems = Array.isArray(c.mediaItems) && c.mediaItems.length ? c.mediaItems : c.media?.src ? [c.media] : [];
  if (!mediaItems.length) {
    return "";
  }

  return html`
    <div class="scene-media-grid">
      ${mediaItems.map((media) => `
        <figure class="scene-media">
          <video src="${escapeHtml(media.src)}" autoplay muted loop playsinline preload="metadata"></video>
          <figcaption>
            <strong>${escapeHtml(media.label || c.place || "Szene")}</strong>
            <span>${escapeHtml(media.caption || "")}</span>
            <div class="media-controls">
              ${media.hasAudio ? `<button type="button" class="secondary" data-toggle-media-sound>Videoton einschalten</button>` : ""}
              ${media.audio?.src ? `<button type="button" class="secondary" data-audio-label="${escapeHtml(media.audio.label || "Audio")}" data-toggle-scene-audio>${escapeHtml(media.audio.label || "Audio einschalten")}</button><audio src="${escapeHtml(media.audio.src)}" preload="metadata" ${media.audio.loop ? "loop" : ""}></audio>` : ""}
            </div>
          </figcaption>
        </figure>
      `).join("")}
    </div>
  `;
}

function historicalNote(c) {
  if (!c.historicalNote) {
    return "";
  }

  return html`
    <aside class="historical-note">
      <strong>Historischer Hinweis</strong>
      <p>${escapeHtml(c.historicalNote)}</p>
    </aside>
  `;
}

function teamTaskPanel() {
  const c = chapter();
  const bothReady = state.mode !== "partner" || (state.room?.roleReady?.A && state.room?.roleReady?.B);
  return html`
    <div class="task-panel panel stack">
      <div>
        <p class="eyebrow">Gemeinsame Aufgabe</p>
        <h2>${escapeHtml(c.teamTask)}</h2>
      </div>
      ${taskFlow(c)}
      ${bothReady ? answerForm() : `<div class="notice"><strong>Noch gesperrt.</strong><p>Die Schreibwerkstatt öffnet sich, sobald Schwänli und Schnecke ihre Beobachtungen ausgetauscht und auf dem Handy bestätigt haben.</p></div>`}
    </div>
  `;
}

function taskFlow(c) {
  return html`
    <div class="task-flow" aria-label="Arbeitsfluss">
      <article>
        <span>1</span>
        <strong>Austauschen</strong>
        <p>Schwänli: ${escapeHtml(c.roleA.name)}. Schnecke: ${escapeHtml(c.roleB.name)}.</p>
      </article>
      <article>
        <span>2</span>
        <strong>Formulieren</strong>
        <p>${escapeHtml(c.languageGoal)}</p>
      </article>
      <article>
        <span>3</span>
        <strong>Schärfen</strong>
        <p>${escapeHtml(c.revisionPrompt)}</p>
      </article>
    </div>
  `;
}

function answerForm(prefill = "") {
  const c = chapter();
  return html`
    <form class="answer-workshop stack" data-answer-form>
      <label><span>1. Erste Formulierung</span><textarea name="first" required>${escapeHtml(prefill)}</textarea></label>
      <div data-written-feedback="first">${feedbackMarkup(c, "first", prefill)}</div>
      <div class="feedback-box"><strong>Hinweis statt Richtig-falsch:</strong><p>${escapeHtml(c.hint)}</p></div>
      <label><span>2. Überarbeitete Fassung</span><textarea name="revision" required></textarea></label>
      <div data-written-feedback="revision">${feedbackMarkup(c, "revision", "")}</div>
      <label><span>3. Kurze Reflexion</span><textarea name="reflection" required placeholder="${escapeHtml(c.reflection)}"></textarea></label>
      <div data-written-feedback="reflection">${feedbackMarkup(c, "reflection", "")}</div>
      <div class="toolbar">
        <button type="submit">Lernspur speichern</button>
        <button type="button" class="secondary" data-example>Beispiel einsetzen</button>
      </div>
    </form>
  `;
}

async function saveAnswer(form) {
  const data = new FormData(form);
  const entries = [
    ["first", data.get("first")],
    ["revision", data.get("revision")],
    ["reflection", data.get("reflection")]
  ];
  const feedbackEntries = entries.map(([kind, text]) => {
    const feedback = qualifiedFeedback(chapter(), kind, text);
    return [
      `${kind}-feedback`,
      [
        feedback.title,
        feedback.summary,
        `Schon tragfähig: ${feedback.strengths.join(" ")}`,
        `Jetzt überarbeiten: ${feedback.nextSteps.join(" ")}`
      ].join("\n")
    ];
  });
  const allEntries = entries.flatMap((entry, index) => [entry, feedbackEntries[index]]);

  if (state.mode === "partner") {
    for (const [kind, text] of allEntries) {
      await api(`/api/rooms/${state.room.code}/submissions`, {
        method: "POST",
        body: JSON.stringify({ chapterIndex: state.chapterIndex, kind, text, role: "team", words: collectWords(text) })
      });
    }
    state.room = await api(`/api/rooms/${state.room.code}`);
    renderPartner();
    return;
  }

  for (const [kind, text] of allEntries) {
    saveLocalEntry({ chapterIndex: state.chapterIndex, kind, role: "team", text, words: collectWords(text) });
  }
  renderCurrentMode();
}

function collectWords(text) {
  return [...new Set(String(text).match(/\b[A-Za-zÄÖÜäöüß]{5,}\b/g) || [])].slice(0, 8);
}

function voiceKey(chapterIndex = state.chapterIndex, role = state.role) {
  return `${chapterIndex}:${role || "team"}`;
}

function speechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function wordCount(value) {
  return (String(value || "").trim().match(/\S+/g) || []).length;
}

function normalizeFeedbackText(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss");
}

function feedbackIncludes(text, terms) {
  const normalized = normalizeFeedbackText(text);
  return terms.some((term) => normalized.includes(normalizeFeedbackText(term)));
}

function kindLabel(kind) {
  if (kind === "first") return "erste Fassung";
  if (kind === "revision") return "Überarbeitung";
  if (kind === "reflection") return "Reflexion";
  if (kind === "voice") return "mündlicher Beitrag";
  return "Eingabe";
}

function qualifiedFeedback(chapterData, kind, text) {
  const profile = FEEDBACK_PROFILES[chapterData.id];
  const words = wordCount(text);
  if (!profile) {
    return {
      title: "Feedback",
      strengths: ["Die Eingabe ist gespeichert und kann mit dem Kapitelziel verglichen werden."],
      nextSteps: [chapterData.revisionPrompt],
      summary: chapterData.hint
    };
  }

  const strengths = [];
  const nextSteps = [];
  for (const [label, terms, suggestion] of profile.checks) {
    if (feedbackIncludes(text, terms)) {
      strengths.push(`${label}: erkennbar angelegt.`);
    } else {
      nextSteps.push(`${label}: ${suggestion}`);
    }
  }

  if (kind === "first" && words < 25) {
    nextSteps.push("Erste Fassung: Ergänzt mindestens einen konkreten Satz mehr, damit die Szene oder Erklärung prüfbar wird.");
  }
  if (kind === "revision" && words < 25) {
    nextSteps.push("Überarbeitung: Zeigt sichtbar, was ihr gegenüber der ersten Fassung verbessert habt.");
  }
  if (kind === "reflection" && !feedbackIncludes(text, ["weil", "dadurch", "deshalb", "darum"])) {
    nextSteps.push("Reflexion: Begründet eure Einschätzung mit 'weil', 'dadurch' oder 'deshalb'.");
  }
  if (kind === "voice" && words < 8) {
    nextSteps.push("Mündlicher Beitrag: Sprecht einen vollständigen Gedanken, nicht nur Stichwörter.");
  }

  if (!strengths.length) {
    strengths.push(`Die ${kindLabel(kind)} ist ein Anfang, braucht aber noch deutlichere Spuren der konkreten Quest.`);
  }
  if (!nextSteps.length) {
    nextSteps.push("Nächster Feinschliff: Kürzt eine schwache Stelle und macht ein Verb, eine Beobachtung oder eine Begründung genauer.");
  }

  return {
    title: `Qualifiziertes Feedback zur ${kindLabel(kind)}`,
    strengths,
    nextSteps,
    summary: `${profile.aim} ${profile.upgrade}`
  };
}

function feedbackMarkup(chapterData, kind, text) {
  const feedback = qualifiedFeedback(chapterData, kind, text);
  return html`
    <div class="qualified-feedback">
      <strong>${escapeHtml(feedback.title)}</strong>
      <p>${escapeHtml(feedback.summary)}</p>
      <div class="feedback-columns">
        <div>
          <p class="small"><strong>Schon tragfähig</strong></p>
          <ul>${feedback.strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
        <div>
          <p class="small"><strong>Jetzt überarbeiten</strong></p>
          <ul>${feedback.nextSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
      </div>
    </div>
  `;
}

function roleNeedsVoice(c, role) {
  return Boolean(c.voiceQuest?.required && c.voiceQuest.roles?.includes(role));
}

function voiceQuestPanel(role, c) {
  const quest = c.voiceQuest;
  if (!quest?.roles?.includes(role)) {
    return "";
  }

  const key = voiceKey(state.chapterIndex, role);
  const draft = state.voiceDrafts[key] || "";
  const supportsSpeech = Boolean(speechRecognitionConstructor());
  const complete = wordCount(draft) >= Number(quest.minWords || 1);
  return html`
    <section class="voice-quest ${quest.required ? "is-required" : ""}">
      <p class="eyebrow">${quest.required ? "Mikrofon-Aufgabe" : "Mündliche Probe"}</p>
      <h2>Sprache zuerst</h2>
      <p>${escapeHtml(quest.prompt)}</p>
      <div class="voice-meter" aria-hidden="true"><span style="width:${Math.min(100, wordCount(draft) / Number(quest.minWords || 1) * 100)}%"></span></div>
      <label>Transkript
        <textarea name="voiceTranscript" data-voice-transcript="${escapeHtml(key)}" placeholder="${supportsSpeech ? "Tippe auf Aufnahme und sprich ins Handy." : "Dieser Browser bietet keine automatische Spracheingabe. Dokumentiert euren gesprochenen Beitrag hier."}">${escapeHtml(draft)}</textarea>
      </label>
      <div data-feedback-for="${escapeHtml(key)}">${feedbackMarkup(c, "voice", draft)}</div>
      <div class="toolbar">
        ${supportsSpeech ? `<button type="button" data-start-voice="${escapeHtml(key)}">Aufnahme starten</button><button type="button" class="secondary" data-stop-voice>Stopp</button>` : ""}
        <button type="button" class="secondary" data-save-voice="${escapeHtml(key)}">Mündlichen Beitrag speichern</button>
      </div>
      <p class="small">${complete ? "Mündlicher Beitrag ist lang genug für den Austausch." : `Noch ${Math.max(0, Number(quest.minWords || 1) - wordCount(draft))} Wort/Wörter bis zur Freigabe.`}</p>
    </section>
  `;
}

function voiceTextarea(key) {
  return [...app.querySelectorAll("[data-voice-transcript]")]
    .find((element) => element.dataset.voiceTranscript === key) || null;
}

function feedbackTargetForVoice(key) {
  return [...app.querySelectorAll("[data-feedback-for]")]
    .find((element) => element.dataset.feedbackFor === key) || null;
}

function renderPhone() {
  state.mode = "phone";
  const params = new URLSearchParams(location.search);
  const code = params.get("code") || "";
  const role = (params.get("role") || "").toUpperCase();
  app.innerHTML = html`
    ${topbar("phone")}
    <section class="phone-frame stack">
      <div>
        <p class="eyebrow">Handyansicht</p>
        <h1>Ziege beitreten</h1>
      </div>
      <form class="stack" data-join-form>
        <label>Raumcode<input name="code" value="${escapeHtml(code)}" maxlength="6" required></label>
        <label>Ziege<select name="role"><option value="">automatisch</option><option value="A" ${role === "A" ? "selected" : ""}>Schwänli</option><option value="B" ${role === "B" ? "selected" : ""}>Schnecke</option></select></label>
        <button type="submit">Beitreten</button>
      </form>
    </section>
  `;
}

async function joinRoom(form) {
  const data = new FormData(form);
  const code = String(data.get("code") || "").trim().toUpperCase();
  const joined = await api(`/api/rooms/${code}/join`, {
    method: "POST",
    body: JSON.stringify({ role: data.get("role"), clientId: state.clientId })
  });
  state.room = joined.room;
  state.role = joined.role;
  state.chapterIndex = joined.room.chapterIndex;
  renderPhoneRole();
  startPolling();
}

function renderPhoneRole() {
  const c = chapter();
  const role = state.role || "A";
  const roleData = role === "A" ? c.roleA : c.roleB;
  const needsVoice = roleNeedsVoice(c, role);
  const voiceComplete = !needsVoice || wordCount(state.voiceDrafts[voiceKey(state.chapterIndex, role)]) >= Number(c.voiceQuest?.minWords || 1);
  app.innerHTML = html`
    ${topbar("phone")}
    <section class="phone-frame stack">
      <p class="eyebrow">Raum ${escapeHtml(state.room.code)} · ${role === "A" ? "Schwänli" : "Schnecke"}</p>
      <h1>${escapeHtml(roleData.name)}</h1>
      ${roleCard(role, roleData)}
      ${voiceQuestPanel(role, c)}
      <button type="button" data-ready="${role}" ${voiceComplete ? "" : "disabled"}>${state.room.roleReady?.[role] ? "Austausch bestätigt" : "Ich habe meine Informationen geteilt"}</button>
      <div class="notice"><p>${needsVoice ? "Diese Ziege muss zuerst den mündlichen Beitrag per Handy-Mikrofon festhalten." : "Sprich mit der Partnerperson."} Auf dem Laptop wird die Schreibaufgabe erst nach beiden Bestätigungen freigeschaltet.</p></div>
    </section>
  `;
}

function roleCard(role, roleData) {
  return html`
    <article class="role-card role-${role.toLowerCase()}">
      ${playerProfile(role)}
      <h2>${role === "A" ? "Schwänli" : "Schnecke"}: ${escapeHtml(roleData.name)}</h2>
      <p>${escapeHtml(roleData.prompt)}</p>
      <ul class="token-list">${roleData.tokens.map((token) => `<li>${escapeHtml(token)}</li>`).join("")}</ul>
    </article>
  `;
}

function renderDesktop() {
  state.mode = "desktop";
  const c = chapter();
  const sections = [
    { id: "cards", label: "Ziegenkarten" },
    { id: "write", label: "Schreibwerkstatt" },
    { id: "path", label: "Questpfad" },
    { id: "log", label: "Lernspur" }
  ];
  const active = activePlaySection(sections, "cards");
  app.innerHTML = html`
    ${topbar("desktop")}
    <div class="play-layout">
      ${questStage(c, "Desktopmodus")}
      ${playSectionMenu(sections, active)}
      ${active === "cards" ? html`
        <div class="goat-board panel stack">
          <h2>Ziegenkarten nacheinander öffnen</h2>
          ${taskFlow(c)}
          <div class="toolbar">
            <button type="button" class="secondary" data-reveal="A">${state.revealA ? "Schwänli verbergen" : "Schwänli öffnen"}</button>
            <button type="button" class="secondary" data-reveal="B">${state.revealB ? "Schnecke verbergen" : "Schnecke öffnen"}</button>
          </div>
          <div class="goat-stage">
            ${state.revealA ? roleCard("A", c.roleA) : `<div class="goat-card-placeholder role-a">${playerProfile("A", "Schwänli")}<h3>Schwänli ist verdeckt</h3><p>Eine Person liest zuerst die andere Karte nicht mit.</p></div>`}
            ${state.revealB ? roleCard("B", c.roleB) : `<div class="goat-card-placeholder role-b">${playerProfile("B", "Schnecke")}<h3>Schnecke ist verdeckt</h3><p>Öffnet diese Karte erst nach dem Wechsel.</p></div>`}
          </div>
        </div>
      ` : ""}
      ${active === "write" ? (state.revealA && state.revealB ? `<div class="panel stack"><p class="eyebrow">Gemeinsame Aufgabe</p><h2>${escapeHtml(c.teamTask)}</h2>${answerForm()}</div>` : `<div class="panel notice"><strong>Noch gesperrt.</strong><p>Öffne zuerst Schwänli und Schnecke im Bereich Ziegenkarten. Danach erscheint hier die Schreibwerkstatt.</p></div>`) : ""}
      ${active === "path" ? chapterTabs() : ""}
      ${active === "log" ? journalPanel() : ""}
    </div>
  `;
}

function renderDemo() {
  state.mode = "demo";
  const c = chapter();
  const sections = [
    { id: "cards", label: "Ziegenkarten" },
    { id: "write", label: "Schreibwerkstatt" },
    { id: "path", label: "Questpfad" },
    { id: "log", label: "Lernspur" },
    { id: "didactics", label: "Didaktik" }
  ];
  const active = activePlaySection(sections, "cards");
  app.innerHTML = html`
    ${topbar("demo")}
    <div class="play-layout">
      ${questStage(c, "Demomodus")}
      <div class="toolbar compact-actions">
        <button type="button" class="danger" data-reset-local>Aufgabe zurücksetzen</button>
      </div>
      ${playSectionMenu(sections, active)}
      ${active === "cards" ? html`
        <div class="goat-board panel stack">
          <div>
            <p class="eyebrow">Ziegenkarten</p>
            <h2>Schwänli und Schnecke tauschen ihre Hinweise aus</h2>
          </div>
          <div class="goat-stage demo-goats">
            <div class="goat-handset">${roleCard("A", c.roleA)}${voiceQuestPanel("A", c)}</div>
            <div class="goat-handset">${roleCard("B", c.roleB)}${voiceQuestPanel("B", c)}</div>
          </div>
        </div>
      ` : ""}
      ${active === "write" ? html`
        <div class="panel stack">
          <p class="eyebrow">Laptop nach Austausch</p>
          <h2>${escapeHtml(c.teamTask)}</h2>
          ${taskFlow(c)}
          ${answerForm(c.example)}
        </div>
      ` : ""}
      ${active === "path" ? chapterTabs() : ""}
      ${active === "log" ? journalPanel() : ""}
      ${active === "didactics" ? didacticsPanel() : ""}
    </div>
  `;
}

function didacticsPanel() {
  const c = chapter();
  return html`
    <div class="panel stack">
      <h2>Didaktischer Hinweis</h2>
      <p><strong>Sprachliches Ziel:</strong> ${escapeHtml(c.languageGoal)}</p>
      <ol class="cycle">
        ${["wahrnehmen", "erste Vermutung äußern", "Informationen austauschen", "Bedeutung aushandeln", "mündlich formulieren", "schriftlich festhalten", "Hinweis erhalten", "überarbeiten", "reflektieren"].map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ol>
    </div>
  `;
}

function renderTeacher() {
  state.mode = "teacher";
  state.teacher = state.teacher || JSON.parse(localStorage.getItem(storage.teacher) || "null") || state.content.teacherDefaults;
  app.innerHTML = html`
    ${topbar("teacher")}
    <section class="stack">
      <div class="panel">
        <p class="eyebrow">Lehrpersonenansicht</p>
        <h1>Einstellungen und Inhaltsmodell</h1>
        <p>Die Aufgaben, Hinweise, Spielerinformationen und Beispielantworten liegen in <strong>data/heidi-game-content.json</strong> und können ohne Programmlogik angepasst werden.</p>
      </div>
      <div class="teacher-grid">
        <form class="panel stack" data-teacher-form>
          <h2>Einstellungen</h2>
          <label>Sprachniveau<input name="languageLevel" value="${escapeHtml(state.teacher.languageLevel)}"></label>
          <label>Anzahl Kapitel<input type="number" min="1" max="24" name="chapterCount" value="${escapeHtml(state.teacher.chapterCount)}"></label>
          <label>Spielzeit<input name="playTime" value="${escapeHtml(state.teacher.playTime)}"></label>
          <label>Überarbeitung<select name="revisionRequired"><option value="true" ${state.teacher.revisionRequired ? "selected" : ""}>Pflicht</option><option value="false" ${!state.teacher.revisionRequired ? "selected" : ""}>freiwillig</option></select></label>
          <label><input type="checkbox" name="showExamples" ${state.teacher.showExamples ? "checked" : ""}> Beispielantworten anzeigen</label>
          <label><input type="checkbox" name="showDidactics" ${state.teacher.showDidactics ? "checked" : ""}> Didaktische Hinweise anzeigen</label>
          <button type="submit">Einstellungen speichern</button>
        </form>
        <div class="panel stack">
          <h2>Kapitel und Aufgaben</h2>
          ${state.content.chapters.map((item, index) => `<article class="journal-entry"><strong>${index + 1}. ${escapeHtml(item.title)}</strong><p>${escapeHtml(item.languageGoal)}</p></article>`).join("")}
        </div>
      </div>
      <div class="panel stack">
        <h2>Datenmodell</h2>
        <p>Jedes Kapitel enthält: id, title, place, languageGoal, laptopFrame, roleA, roleB, teamTask, hint, revisionPrompt, example und reflection. Zusätzlich besitzt jede Quest ein eigenes Feedbackprofil mit konkreten Prüfpunkten.</p>
        <p>Optionale Mikrofon-Aufgaben werden über <strong>voiceQuest</strong> gesteuert: required, roles, prompt und minWords.</p>
        <div class="toolbar">
          <button type="button" data-export-journal>Export Lernspur</button>
          <button type="button" class="secondary" data-print>Journal drucken</button>
          <button type="button" class="danger" data-reset-local>Lokale Lernspur löschen</button>
        </div>
      </div>
      ${journalPanel()}
    </section>
  `;
}

function journalPanel() {
  const entries = journalEntries();
  return html`
    <div class="panel stack learning-log">
      <div>
        <p class="eyebrow">Gesammelte Spuren</p>
        <h2>Lernspur</h2>
      </div>
      ${entries.length ? `<div class="journal-grid">${entries.map(renderJournalEntry).join("")}</div>` : `<p>Noch keine Einträge gespeichert.</p>`}
      <div class="toolbar">
        <button type="button" class="secondary" data-export-journal>Export</button>
        <button type="button" class="secondary" data-print>Drucken</button>
      </div>
    </div>
  `;
}

function renderJournalEntry(entry) {
  const item = state.content.chapters[entry.chapterIndex] || {};
  const isFeedback = String(entry.kind || "").includes("feedback");
  return html`
    <article class="journal-entry ${isFeedback ? "is-feedback" : ""}">
      <strong>${escapeHtml(item.title || "Kapitel")} · ${isFeedback ? "qualifiziertes Feedback" : escapeHtml(entry.kind)}</strong>
      <p>${escapeHtml(entry.text)}</p>
      ${entry.words?.length ? `<ul class="token-list">${entry.words.map((word) => `<li>${escapeHtml(word)}</li>`).join("")}</ul>` : ""}
    </article>
  `;
}

function renderCurrentMode() {
  if (state.mode === "partner") renderPartner();
  else if (state.mode === "phone" && state.role) renderPhoneRole();
  else if (state.mode === "phone") renderPhone();
  else if (state.mode === "desktop") renderDesktop();
  else if (state.mode === "demo") renderDemo();
  else if (state.mode === "teacher") renderTeacher();
  else renderHome();
}

function navigate(mode) {
  stopPolling();
  if (mode === "home") history.pushState({}, "", "/");
  if (mode === "desktop") history.pushState({}, "", "/desktop");
  if (mode === "demo") history.pushState({}, "", "/demo");
  if (mode === "teacher") history.pushState({}, "", "/teacher");
  if (mode === "partner") return startRoom();
  state.mode = mode;
  renderCurrentMode();
}

async function setChapter(index) {
  state.chapterIndex = index;
  state.revealA = false;
  state.revealB = false;
  if (state.mode === "partner" && state.room) {
    state.room = await api(`/api/rooms/${state.room.code}/chapter`, {
      method: "POST",
      body: JSON.stringify({ chapterIndex: index })
    });
  }
  renderCurrentMode();
}

function startPolling() {
  stopPolling();
  state.pollTimer = setInterval(async () => {
    if (!state.room?.code) return;
    try {
      const room = await api(`/api/rooms/${state.room.code}`);
      const changed = room.eventVersion !== state.room.eventVersion;
      state.room = room;
      state.chapterIndex = room.chapterIndex;
      if (changed) renderCurrentMode();
    } catch {
      stopPolling();
    }
  }, 1300);
}

function stopPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = null;
}

function startVoiceRecognition(key) {
  const Recognition = speechRecognitionConstructor();
  const textarea = voiceTextarea(key);
  if (!Recognition || !textarea) {
    return;
  }

  if (state.recognition) {
    state.recognition.stop();
  }

  const recognition = new Recognition();
  recognition.lang = "de-CH";
  recognition.interimResults = true;
  recognition.continuous = true;
  state.recognition = recognition;
  state.listeningKey = key;

  let finalText = textarea.value.trim();
  recognition.onresult = (event) => {
    let interimText = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const text = event.results[index][0].transcript.trim();
      if (event.results[index].isFinal) {
        finalText = `${finalText} ${text}`.trim();
      } else {
        interimText = text;
      }
    }
    textarea.value = `${finalText}${interimText ? ` ${interimText}` : ""}`.trim();
    state.voiceDrafts[key] = textarea.value;
    const [chapterIndex] = key.split(":");
    const chapterData = state.content.chapters[Number(chapterIndex)] || chapter();
    const feedbackTarget = feedbackTargetForVoice(key);
    if (feedbackTarget) feedbackTarget.innerHTML = feedbackMarkup(chapterData, "voice", textarea.value);
  };
  recognition.onend = () => {
    if (state.listeningKey === key) {
      state.listeningKey = "";
    }
  };
  recognition.start();
}

function stopVoiceRecognition() {
  if (state.recognition) {
    state.recognition.stop();
  }
  state.recognition = null;
  state.listeningKey = "";
}

async function saveVoiceDraft(key) {
  const textarea = voiceTextarea(key);
  const text = textarea?.value?.trim() || state.voiceDrafts[key] || "";
  if (!text) {
    return;
  }
  state.voiceDrafts[key] = text;
  const [chapterIndex, role] = key.split(":");
  const chapterData = state.content.chapters[Number(chapterIndex)] || chapter();
  const feedback = qualifiedFeedback(chapterData, "voice", text);
  const feedbackText = [
    feedback.title,
    feedback.summary,
    `Schon tragfähig: ${feedback.strengths.join(" ")}`,
    `Jetzt überarbeiten: ${feedback.nextSteps.join(" ")}`
  ].join("\n");
  if (state.room?.code && state.mode === "phone") {
    state.room = (await api(`/api/rooms/${state.room.code}/submissions`, {
      method: "POST",
      body: JSON.stringify({
        chapterIndex: Number(chapterIndex),
        kind: "voice",
        role,
        text,
        words: collectWords(text)
      })
    })).room;
    state.room = (await api(`/api/rooms/${state.room.code}/submissions`, {
      method: "POST",
      body: JSON.stringify({
        chapterIndex: Number(chapterIndex),
        kind: "voice-feedback",
        role,
        text: feedbackText,
        words: collectWords(feedbackText)
      })
    })).room;
  } else {
    saveLocalEntry({ chapterIndex: Number(chapterIndex), kind: "voice", role, text, words: collectWords(text) });
    saveLocalEntry({ chapterIndex: Number(chapterIndex), kind: "voice-feedback", role, text: feedbackText, words: collectWords(feedbackText) });
  }
  renderCurrentMode();
}

function exportJournal() {
  const payload = {
    title: state.content.title,
    exportedAt: new Date().toISOString(),
    entries: journalEntries()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "heidi-lernspur.json";
  link.click();
  URL.revokeObjectURL(url);
}

app.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.nav) navigate(button.dataset.nav);
  if (button.dataset.playSection) {
    state.playSection = button.dataset.playSection;
    renderCurrentMode();
  }
  if (button.dataset.startRoom !== undefined) await startRoom();
  if (button.dataset.prevChapter !== undefined) await setChapter(Math.max(0, state.chapterIndex - 1));
  if (button.dataset.nextChapter !== undefined) await setChapter(Math.min(state.content.chapters.length - 1, state.chapterIndex + 1));
  if (button.dataset.chapter !== undefined) await setChapter(Number(button.dataset.chapter));
  if (button.dataset.reveal) {
    if (button.dataset.reveal === "A") state.revealA = !state.revealA;
    if (button.dataset.reveal === "B") state.revealB = !state.revealB;
    renderDesktop();
  }
  if (button.dataset.example !== undefined) {
    const form = button.closest("form");
    form.elements.first.value = chapter().example;
    form.elements.revision.value = chapter().revisionPrompt + " " + chapter().example;
  }
  if (button.dataset.ready) {
    const c = chapter();
    const role = button.dataset.ready;
    if (roleNeedsVoice(c, role) && wordCount(state.voiceDrafts[voiceKey(state.chapterIndex, role)]) < Number(c.voiceQuest?.minWords || 1)) {
      return;
    }
    state.room = await api(`/api/rooms/${state.room.code}/role-ready`, {
      method: "POST",
      body: JSON.stringify({ role, ready: true })
    });
    renderPhoneRole();
  }
  if (button.dataset.startVoice) startVoiceRecognition(button.dataset.startVoice);
  if (button.dataset.stopVoice !== undefined) stopVoiceRecognition();
  if (button.dataset.saveVoice) await saveVoiceDraft(button.dataset.saveVoice);
  if (button.dataset.toggleDidactics !== undefined) {
    state.showDidactics = !state.showDidactics;
    renderDemo();
  }
  if (button.dataset.toggleMediaSound !== undefined) {
    const media = button.closest(".scene-media")?.querySelector("video");
    if (media) {
      media.muted = !media.muted;
      if (!media.muted) await media.play();
      button.textContent = media.muted ? "Videoton einschalten" : "Videoton ausschalten";
    }
  }
  if (button.dataset.toggleSceneAudio !== undefined) {
    const audio = button.closest(".scene-media")?.querySelector("audio");
    if (audio) {
      const label = button.dataset.audioLabel || "Audio";
      if (audio.paused) {
        await audio.play();
        button.textContent = `${label.replace(" einschalten", "")} pausieren`;
      } else {
        audio.pause();
        button.textContent = `${label.replace(" einschalten", "")} fortsetzen`;
      }
    }
  }
  if (button.dataset.exportJournal !== undefined) exportJournal();
  if (button.dataset.print !== undefined) window.print();
  if (button.dataset.resetLocal !== undefined) {
    localStorage.setItem(storage.journal, "[]");
    renderCurrentMode();
  }
});

app.addEventListener("input", (event) => {
  const transcript = event.target.closest("[data-voice-transcript]");
  if (transcript) {
    const key = transcript.dataset.voiceTranscript;
    state.voiceDrafts[key] = transcript.value;
    const [chapterIndex] = key.split(":");
    const chapterData = state.content.chapters[Number(chapterIndex)] || chapter();
    const feedbackTarget = feedbackTargetForVoice(key);
    if (feedbackTarget) feedbackTarget.innerHTML = feedbackMarkup(chapterData, "voice", transcript.value);
    return;
  }

  const answerFormElement = event.target.closest("[data-answer-form]");
  if (!answerFormElement || !event.target.name) return;
  const kind = event.target.name;
  if (!["first", "revision", "reflection"].includes(kind)) return;
  const feedbackTarget = answerFormElement.querySelector(`[data-written-feedback="${kind}"]`);
  if (feedbackTarget) feedbackTarget.innerHTML = feedbackMarkup(chapter(), kind, event.target.value);
});

app.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (event.target.matches("[data-host-login]")) {
    const data = new FormData(event.target);
    await startRoom(data.get("hostName"));
  }
  if (event.target.matches("[data-join-form]")) await joinRoom(event.target);
  if (event.target.matches("[data-answer-form]")) await saveAnswer(event.target);
  if (event.target.matches("[data-teacher-form]")) {
    const data = new FormData(event.target);
    state.teacher = {
      languageLevel: data.get("languageLevel"),
      chapterCount: Number(data.get("chapterCount")),
      playTime: data.get("playTime"),
      availableHelp: state.content.teacherDefaults.availableHelp,
      revisionRequired: data.get("revisionRequired") === "true",
      showExamples: data.get("showExamples") === "on",
      showDidactics: data.get("showDidactics") === "on"
    };
    localStorage.setItem(storage.teacher, JSON.stringify(state.teacher));
    renderTeacher();
  }
});

window.addEventListener("popstate", () => {
  state.mode = routeMode();
  renderCurrentMode();
});

async function boot() {
  state.content = await api(`/api/content?v=${Date.now()}`);
  state.teacher = state.content.teacherDefaults;
  renderCurrentMode();
}

boot().catch((error) => {
  app.innerHTML = `<div class="panel"><h1>Start nicht möglich</h1><p>${escapeHtml(error.message)}</p></div>`;
});
