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
  playSection: "cards",
  chaosEvents: {}
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
      ["Beobachtung auf der Alp", ["geiss", "geissen", "himmel", "wind", "licht", "wolke", "gras", "stein", "felsen"], "Nennt zuerst sichtbar, was Heidi wirklich bemerkt."],
      ["Spruchform", ["regel", "spruch", "reim", "wenn", "steht", "zieht", "kommt", "droht"], "Formt die Beobachtung zu einem knappen Merksatz, nicht zu einer langen Erklärung."],
      ["Vorsicht", ["vielleicht", "oft", "manchmal", "nicht immer", "kann", "könnte"], "Ergänzt, dass die Bauernregel Erfahrung ist und nicht immer stimmen muss."]
    ],
    upgrade: "Überarbeitet so: Beobachtung konkret machen, Spruch kürzen, dann mit 'oft', 'manchmal' oder 'vielleicht' einschränken."
  },
  "ziegen-ansprechen": {
    aim: "Die Tieransprache soll natürlich klingen und zugleich genau beobachten.",
    checks: [
      ["Heidis Stimme", ["heidi", "komm", "nur", "kleine", "ruhig", "ich tue", "darf"], "Gebt Heidi einen kurzen Satz, der ein Kind auf der Alp wirklich sagen könnte."],
      ["Geissenverhalten", ["geiss", "meckert", "zupft", "trottet", "springt", "bleibt", "kommt"], "Zeigt, was die Geiss tut, statt sie menschlich denken zu lassen."],
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
      ["Peters Welt", ["geiss", "geissen", "weg", "steg", "hang", "herde", "alp"], "Bindet Lesen an etwas, das Peter kennt."],
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
    aim: "Die Geissen sollen durch Namen und Verhalten unterscheidbar werden.",
    checks: [
      ["Namen", ["schwänli", "bärli", "name", "heißt"], "Gebt den Geissen Namen oder macht deutlich, wie Peter sie nennt."],
      ["Eigenheit", ["zupft", "drängt", "bleibt", "läuft", "findet", "langsam"], "Beschreibt eine sichtbare Gewohnheit jeder Geiss."],
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
      ["Erinnerungsbild", ["alp", "wind", "geissen", "heu", "peter", "hütte"], "Lasst ein Bild der Alp in Frankfurt auftauchen."],
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
      ["Material", ["karte", "bild", "geissenname", "weg", "tisch"], "Legt fest, womit Peter arbeitet."],
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
  "geissen-verloren": {
    aim: "Die Suchaufgabe braucht genaue Ortsangaben und einen planvollen Ruf.",
    checks: [
      ["Ortsangabe", ["felsen", "steg", "bach", "hang", "oberhalb", "unterhalb"], "Ersetzt 'dort' durch eine echte Ortsangabe."],
      ["Suchplan", ["zuerst", "dann", "danach", "zurück", "nicht allein"], "Ordnet die Suche in Schritte."],
      ["Lockruf", ["komm", "schwänli", "geiss", "hier", "weg"], "Formuliert einen kurzen Ruf, der zur Geiss passt."]
    ],
    upgrade: "Schreibt: letzter Ort, erster Suchweg, zweiter Suchweg, Rückweg-Regel, Lockruf."
  },
  "schlusskreis": {
    aim: "Der Schlusskreis soll auswählen, begründen und einen Lerngewinn benennen.",
    checks: [
      ["Eine Szene", ["ich wähle", "szene", "hütte", "geiss", "frankfurt", "schule", "alp"], "Wählt eine konkrete Szene statt alles aufzuzählen."],
      ["Ein Wort und eine Frage", ["wort", "frage", "warum", "woran", "oberhalb", "weil"], "Nennt ein genaueres Wort und eine gute Frage."],
      ["Begründung", ["weil", "dadurch", "deshalb", "gelernt"], "Begründet, was sich sprachlich verändert hat."]
    ],
    upgrade: "Formt den Beitrag so: Ich wähle ..., weil ... Das Wort ... hilft ... Die Frage ... öffnet ..."
  }
};

const STORY = {
  name: "Fräulein Rottenmeier",
  premise: "Auf der Alp treffen Heidis Staunen, Schwänlis Meckern, Schneckes Eigensinn und Fräulein Rottenmeiers Regelstimme aufeinander. Die Spielenden helfen, aus Beobachtung, Tadel, Fragen und Heimweh eine Sprache zu machen, die trägt.",
  journey: [
    {
      title: "1. Ihr erreicht die Alp",
      ids: ["huette-einrichten", "bett-im-heu", "peter-stellt-ziegen-vor", "ziegen-ansprechen", "alp-spricht", "almoehi-sprechen"],
      line: "Vor euch stehen Hütte, Heu, Geissen und der Großvater. Heidi sucht Wörter für das, was sie sieht."
    },
    {
      title: "2. Die Alp wird ernst",
      ids: ["grossvater-arbeitet", "gewitter-kommt", "alpsegen-hoeren", "grossmutter-hoert", "peter-lernt-anders", "dorfschule-peter"],
      line: "Handgriffe, Wetter, Abendruf und Lernen greifen ineinander. Sprache muss jetzt tragen."
    },
    {
      title: "3. Frankfurt wird eng",
      ids: ["ankunft-frankfurt", "frankfurter-stimmen", "clara-kennenlernen", "rottenmeier-tisch", "sehnsucht-alp", "frankfurt-verlorene-stadt"],
      line: "Türen, Regeln, Tonfall. Heidi merkt, dass viele Wörter nicht automatisch helfen."
    },
    {
      title: "4. Ihr kehrt verändert zurück",
      ids: ["rueckkehr-alp", "clara-auf-der-alp", "peter-eifersucht", "ziegen-verloren", "heidi-erzaehlt-weiter", "schlusskreis"],
      line: "Die Alp ist vertraut, aber nicht wie vorher. Clara, Peter und Heidi brauchen genauere Worte."
    }
  ],
  transitions: {
    "huette-einrichten": "Ihr seid oben. Bevor etwas erklärt wird, zeigen Bank, Schüssel, Decke und Heu, wie man hier lebt.",
    "bett-im-heu": "Die erste Nacht macht die Hütte körperlich: Heugeruch, Rascheln, Wärme, Wind.",
    "peter-stellt-ziegen-vor": "Am Morgen ist die Herde nicht mehr irgendeine Herde. Schwänli und Schnecke bekommen Eigenheiten.",
    "ziegen-ansprechen": "Wer eine Geiss kennt, ruft sie anders. Heidi versucht es mit Stimme, Nähe und einem genauen Verb.",
    "alp-spricht": "Aus Beobachtungen werden Sprüche. Aber eine Bauernregel bleibt Erfahrung, kein Befehl an den Himmel.",
    "almoehi-sprechen": "Heidi fragt nach. Der Großvater soll nicht geprüft werden; er soll zeigen, woran er etwas erkennt.",
    "grossvater-arbeitet": "Jetzt zählen Hände mehr als Erklärungen. Heidi schaut genau, bevor sie mithilft.",
    "gewitter-kommt": "Das Wetter zieht auf. Sprache muss kurz, klar und brauchbar werden.",
    "alpsegen-hoeren": "Nach dem Gewitter kommt der Abend. Stimme und Glocke halten die Nacht zusammen.",
    "grossmutter-hoert": "Bei der Großmutter wird es leiser. Eine Pause kann mehr öffnen als eine Rede.",
    "peter-lernt-anders": "Peter braucht keinen Druck, sondern einen Weg aus seiner eigenen Welt.",
    "dorfschule-peter": "In der Dorfschule wird dieser Weg greifbar: Karte, Satz, Stimme, Rückmeldung.",
    "ankunft-frankfurt": "Dann wird alles enger. Heidi kommt in eine Stadt aus Türen, Treppen und Regeln.",
    "frankfurter-stimmen": "In Frankfurt sprechen Menschen anders. Ein Satz kann helfen oder beschämen.",
    "clara-kennenlernen": "Clara ist keine Aufgabe. Sie ist ein Kind mit eigener Welt.",
    "rottenmeier-tisch": "Am Tisch wird die Regel scharf. Jetzt zeigt sich, ob Sprache erklärt oder verletzt.",
    "sehnsucht-alp": "Heidi sagt nicht einfach, dass sie heimwehkrank ist. Ihr Körper und ihr Blick verraten es.",
    "frankfurt-verlorene-stadt": "Das alte Frankfurt lässt sich nicht einfach besuchen. Bilder zeigen Nähe und Bruch zugleich.",
    "rueckkehr-alp": "Heidi ist wieder oben. Der Ort ist vertraut, aber sie selbst kommt verändert zurück.",
    "clara-auf-der-alp": "Nun erlebt Clara dieselbe Alp neu. Heidi muss helfen, ohne über sie zu bestimmen.",
    "peter-eifersucht": "Peter steht daneben. Sein Gefühl ist verständlich, aber es darf nicht alles erlauben.",
    "ziegen-verloren": "Dann fehlt Schwänli. Aus Sorge wird ein Suchplan mit genauen Ortswörtern.",
    "heidi-erzaehlt-weiter": "Am Ende ordnet Heidi die Erinnerungen. Aus Erlebnissen wird eine mögliche Weitererzählung.",
    "schlusskreis": "Zum Schluss zählt nicht alles zugleich. Eine Szene, ein Wort, eine Frage sollen bleiben."
  },
  rewards: [
    { object: "hay", text: "Heubüschel gewonnen: Erst wird beobachtet, dann wird geurteilt." },
    { object: "bell", text: "Glockenklang gewonnen: Schwänli und Schnecke dürfen eine Regel in Ruhe prüfen." },
    { object: "step", text: "Alpschritt gewonnen: Heidi kommt einen Schritt näher an eine eigene Stimme." },
    { object: "hat", text: "Rottenmeiers Hut wackelt: Eure Antwort hat eine starre Regel beweglich gemacht." },
    { object: "cheese", text: "Käselaib gewonnen: Die Milch ist gerettet, und aus der guten Antwort wird etwas Handfestes." },
    { object: "bucket", text: "Rahm im Kübel: Eure Formulierung war ruhig genug, dass die Geiss beim Melken stehen blieb." }
  ],
  kicks: [
    { object: "hoof", text: "Geissentritt: Fräulein Rottenmeier stampft, weil die Antwort noch zu allgemein bleibt." },
    { object: "bell", text: "Geissentritt: Es meckert dazwischen. Eine genaue Beobachtung fehlt noch." },
    { object: "hoof", text: "Geissentritt: Zu glatt formuliert. Schwänli verlangt ein sichtbares Detail." },
    { object: "word", text: "Geissentritt: Schnecke kaut auf dem Satz herum. Die Begründung ist noch dünn." }
  ],
  chaos: [
    {
      object: "rule",
      title: "Sie frisst die Hausregel",
      text: "Rottenmeiers Regelstimme schnappt nach der wichtigsten Regel im Raum und macht daraus sofort ein Verbot.",
      task: "Rettet die Regel: Sagt in einem Satz, was davon nützlich ist, und streicht den Teil, der nur einschüchtert.",
      example: "Nützlich ist, dass Heidi weiß, was am Tisch gilt; unnötig ist der scharfe Befehlston."
    },
    {
      object: "rule",
      title: "Sie frisst etwas Verbotenes",
      text: "Schnecke hat an einem Gegenstand geknabbert, der bestimmt nicht für Geissen gedacht war.",
      task: "Beschreibt den Schaden konkret und formuliert eine ruhige Reaktion, die nicht sofort in Geschrei kippt.",
      example: "Die Ecke der Regel ist angefressen; Heidi nimmt das Blatt weg und sagt ruhig: Das ist kein Heu."
    },
    {
      object: "hoof",
      title: "Sie bockt am falschen Ort",
      text: "Die Geiss stellt sich quer, senkt den Kopf und bewegt sich keinen Schritt weiter.",
      task: "Findet eine Frage oder einen Lockruf, mit dem Heidi die Situation löst, ohne die Geiss zu beschämen.",
      example: "Komm, Schwänli, nur bis zum Schemel; dort wartet frisches Heu."
    },
    {
      object: "bell",
      title: "Sie meckert alles durcheinander",
      text: "Aus der Geiss kommt ein wütendes Meckern: halb Tischregel, halb Alpwetter, halb beleidigter Salon.",
      task: "Sortiert das Meckern: Was ist Beobachtung, was ist Angst, was ist nur Befehlston?",
      example: "Beobachtung: Der Wind wird kalt. Angst: Sie kennt die Alp nicht. Befehlston: Alles sofort ordentlich!"
    },
    {
      object: "hoof",
      title: "Sie tritt gegen den Satz",
      text: "Kaum ist eine Antwort geschrieben, tritt die Geiss mit dem Huf daneben: Der Satz sei zu glatt.",
      task: "Macht den Satz widerstandsfähiger: ein genaueres Verb, ein sichtbares Detail, eine vorsichtige Begründung.",
      example: "Die Geissen drängen nicht nur zusammen; sie bleiben dicht beim Stein, weil der Wind kälter wird."
    },
    {
      object: "word",
      title: "Sie klaut ein Alpwörterchen",
      text: "Schnecke bemerkt: Ein wichtiges Wort ist weg. Zwischen Meckern und Regelton ist es verschwunden.",
      task: "Holt das Wort zurück, indem ihr es in einem neuen, klaren Satz benutzt.",
      example: "Das Wort 'zupfen' gehört zurück: Schnecke zupft am Kraut, statt einfach nur zu fressen."
    },
    {
      object: "hat",
      title: "Sie verwechselt Hilfe mit Befehl",
      text: "Die Geiss will helfen, aber alles klingt wie Kommandoton: sofort, ordentlich, still!",
      task: "Schreibt den Befehl in eine hilfreiche Bitte um.",
      example: "Statt 'Sofort still!' sagt Clara: Setz dich neben mich, ich zeige dir die Regel."
    },
    {
      object: "stool",
      title: "Melkzeit mit Widerstand",
      text: "Schwänli steht bereit, aber Rottenmeiers Regelstimme erklärt den Melkschemel für unzulässig.",
      task: "Formuliert eine ruhige Melk-Anweisung in drei Schritten: annähern, beruhigen, melken.",
      example: "Zuerst stellt Heidi den Schemel leise hin, dann streicht sie Schwänli über den Hals, danach beginnt sie langsam zu melken."
    },
    {
      object: "bucket-spill",
      title: "Der Kübel kippt",
      text: "Ein bockiger Tritt, und der Milchkübel fällt um. Die Milch läuft über den Boden, unter die Bank, mitten durch die schöne Ordnung.",
      task: "Beschreibt die Sauerei genau und macht daraus einen Plan: Wer hält die Geiss, wer rettet den Rest, wer wischt?",
      example: "Die Milch läuft unter die Bank; Peter hält die Geiss, Heidi stellt den Kübel auf, Schnecke holt den Lappen."
    },
    {
      object: "milk",
      title: "Milch durch die Gegend",
      text: "Die Geiss meckert triumphierend, während eine weiße Spur quer durch die Hütte läuft.",
      task: "Verwandelt das Chaos in Sprache: ein Satz über das sichtbare Durcheinander, ein Satz über die Lösung.",
      example: "Eine weiße Spur zieht vom Kübel zur Tür; Heidi wischt zuerst den Weg frei, damit niemand ausrutscht."
    },
    {
      object: "cheese",
      title: "Fast Käse",
      text: "Diesmal bleibt der Kübel stehen. Wenn die Antwort genau genug ist, kann aus der Milch später Käse werden.",
      task: "Schreibt eine kurze Käse-Regel: Was muss zuerst ruhig, sauber oder geduldig geschehen?",
      example: "Bleibt die Geiss ruhig und der Kübel sauber, kann aus der Milch später Käse werden."
    }
  ],
  questChaos: {
    "alp-spricht": [{
      object: "rule",
      title: "Die Geiss frisst die Bauernregel an",
      text: "Auf dem Zettel steht nur noch: 'Wenn die Geissen dicht beim Stein ...' Der Schluss fehlt, und Fräulein Rottenmeier behauptet, das Wetter müsse jetzt gehorchen.",
      task: "Schreibt eine eigene Bauernregel aus einer sichtbaren Alp-Beobachtung. Sie braucht drei Teile: Beobachtung, kurzer Spruch, vorsichtige Erklärung.",
      example: "Beobachtung: Die Geissen drängen zum Stein. Regel: 'Drängen die Geissen dicht zum Stein, zieht oft kühler Wind herein.' Erklärung: Vielleicht spüren sie Wind früher; sicher ist es nicht."
    }],
    "ziegen-ansprechen": [{
      object: "bell",
      title: "Die Geiss hört nicht auf 'Sie da!'",
      text: "Rottenmeiers Stimme ruft steif in die Wiese. Schwänli hebt nur kurz den Kopf, Schnecke zupft weiter am Kraut.",
      task: "Schreibt drei Sätze: Heidi ruft eine Geiss natürlich an, Peter erklärt mit einem genauen Verb, was sie tut, und Heidi übernimmt dieses Wort.",
      example: "Heidi sagt: 'Schwänli, komm nur ein Stück näher.' Peter sagt: 'Sie zupft am Kraut, die läuft gleich weiter.' Heidi merkt sich: zupfen ist genauer als fressen."
    }],
    "almoehi-sprechen": [{
      object: "stool",
      title: "Die Geiss stellt sich zwischen Heidi und den Großvater",
      text: "Gerade will Heidi fragen, da schiebt die Geiss den Schemel vor den Großvater, als müsse erst ein Verhör beginnen.",
      task: "Formuliert zwei höfliche Fragen an den Großvater: eine zur Bedeutung der Bauernregel, eine zu einem sichtbaren Beispiel auf der Alp.",
      example: "Großvater, du hast gesagt: 'Morgenrot mit Regen droht.' Was bedeutet das? Woran siehst du heute, ob wirklich Regen kommen könnte?"
    }],
    "frankfurter-stimmen": [{
      object: "hat",
      title: "Die Geiss meckert wie eine Hausordnung",
      text: "In Frankfurt klingt jede Hilfe plötzlich nach Befehl. Rottenmeiers Regelstimme macht daraus: 'Sofort ordentlich sein!'",
      task: "Schreibt drei klare Sätze: Was wurde wörtlich gesagt? Was macht der Tonfall daraus? Wie könnte derselbe Hinweis Heidi fair helfen?",
      example: "Wörtlich wird eine Tischregel genannt. Der scharfe Ton beschämt Heidi. Fair wäre: 'Leg die Serviette hierher; ich zeige dir, wann du sie nimmst.'"
    }],
    "peter-lernt-anders": [{
      object: "hay",
      title: "Die Geiss schiebt die Buchstaben ins Heu",
      text: "Peter soll lesen, aber die Geiss verstreut die Karten zwischen Heu, Wegbild und Geissennamen.",
      task: "Entwerft einen Lernweg in drei Schritten, der zu Peter passt: Material, Lesesatz, ermutigende Rückmeldung.",
      example: "1. Peter legt Geissennamen zu Bildern. 2. Er liest: 'Schwänli geht zum Steg.' 3. Die Großmutter sagt: 'Du hast den Namen erkannt; jetzt lesen wir das Wegwort.'"
    }],
    "heidi-erzaehlt-weiter": [{
      object: "cloth",
      title: "Die Geiss zieht die letzte Buchseite weg",
      text: "Fräulein Rottenmeier blökt: 'Was nicht im Buch steht, ist verboten!' Heidi darf aber eine mögliche Fortsetzung erzählen, wenn sie sie als eigene Erfindung kennzeichnet.",
      task: "Schreibt den Anfang einer möglichen Fortsetzung. Beginnt so, dass klar ist: Das ist eure Weitererzählung, keine Behauptung über Spyri.",
      example: "Vielleicht hätte Heidi später erzählt: Wenn der Abendhimmel rot wurde, hörte ich wieder Großvaters Stimme und prüfte erst, was ich wirklich sah."
    }],
    "huette-einrichten": [{
      object: "bucket",
      title: "Der Kübel steht am falschen Platz",
      text: "In der Hütte ist wenig Platz. Die Geiss stößt fast an Kübel, Bank und Decke, weil niemand genau sagt, was wohin gehört.",
      task: "Schreibt vier Sätze: zwei Gegenstände benennen, Heidi höflich fragen lassen, einen Handgriff des Großvaters zeigen.",
      example: "Heidi bleibt bei der Bank stehen. 'Darf ich die Decke zum Heu legen?' Der Großvater schiebt ihr die Schüssel näher und stellt den Kübel an die Wand."
    }],
    "bett-im-heu": [{
      object: "hay",
      title: "Die Geiss erklärt das Heu zum Durcheinander",
      text: "Schnecke wühlt im Heu, Fräulein Rottenmeier rümpft die Nase. Für Heidi ist das Heu aber kein Chaos, sondern ein Schlafplatz mit Geruch, Geräusch und Wärme.",
      task: "Schreibt fünf Sätze über Heidis Einschlafen. Mindestens ein Geruch, ein Geräusch und eine Körperempfindung müssen vorkommen.",
      example: "Das Heu roch trocken und warm. Wenn Heidi den Kopf bewegte, raschelten die Halme. Ihr Rücken wurde schwer, und draußen blieb nur der Wind."
    }],
    "peter-stellt-ziegen-vor": [{
      object: "bell",
      title: "Die Geiss vertauscht die Namensglocken",
      text: "Fräulein Rottenmeier will Nummern statt Namen. Peter hält dagegen: Jede Geiss hat eine Eigenheit.",
      task: "Erfindet drei Geissennamen mit je einer sichtbaren Eigenheit und macht daraus einen Dialog zwischen Heidi und Peter.",
      example: "Peter sagt: 'Das ist Schwänli. Sie läuft nie zuerst, findet aber jedes Kraut am Wegrand.' Heidi fragt: 'Und warum heißt die andere Schnecke?'"
    }],
    "gewitter-kommt": [{
      object: "bucket-spill",
      title: "Die Geiss stößt den Kübel an, als der Wind dreht",
      text: "Der Himmel wird dunkler, der Wind kühler, und die Herde rückt enger zusammen. Jetzt hilft kein langer Vortrag.",
      task: "Schreibt fünf kurze Sätze: Beobachtung, Warnung, Entscheidung, Handgriff, Rückweg.",
      example: "Die Wolken hängen tief. Peter warnt: 'Wir gehen zurück.' Heidi hält Schwänli nahe am Weg. Schnecke läuft hinterher. Bei der Hütte zählen sie die Herde."
    }],
    "alpsegen-hoeren": [{
      object: "bell",
      title: "Die Glocke mischt sich in den Alpsegen",
      text: "Zwischen Stimme, Echo und Glocke meckert die Geiss dazwischen. Trotzdem soll zuerst gehört werden, bevor erklärt wird.",
      task: "Schreibt eine Hörnotiz: Was klingt? Was könnte der Alpsegen leisten? Welche Wörter zeigen Respekt?",
      example: "Die Stimme klingt weit und getragen. Die Wiederholung wirkt ruhig. Es ist wie eine Bitte um Schutz für Menschen und Tiere in der Nacht."
    }],
    "grossvater-arbeitet": [{
      object: "stool",
      title: "Der Schemel steht genau im Arbeitsweg",
      text: "Der Großvater sagt wenig. Die Geiss steht im Weg. Nur genaue Handgriffe bringen Heidi weiter.",
      task: "Schreibt eine Anleitung für einen kleinen Handgriff in der Hütte. Die Verben müssen sichtbar machen, was Heidi tun soll.",
      example: "Zuerst hältst du die Schüssel mit beiden Händen. Dann gießt du langsam ein. Erst wenn nichts mehr tropft, stellst du sie auf die Bank."
    }],
    "ankunft-frankfurt": [{
      object: "hat",
      title: "Rottenmeiers Stimme steht in der Tür",
      text: "Treppen, Türen, Stimmen, enge Blicke: Heidi kommt nicht in eine Alp, sondern in ein Haus voller Regeln.",
      task: "Schreibt einen Ankunftsabsatz mit drei Stadtbeobachtungen und zwei vorsichtigen Vergleichen zur Alp.",
      example: "Die Häuser standen dicht, und der Himmel war nur ein Streifen. Auf der Alp konnte der Blick weit laufen. Hier führte jede Tür zur nächsten Regel."
    }],
    "clara-kennenlernen": [{
      object: "cloth",
      title: "Die Geiss zieht den Vorhang zwischen Heidi und Clara",
      text: "Fräulein Rottenmeier möchte das Kennenlernen ordnen. Heidi und Clara brauchen aber echte Fragen, keine Vorführung.",
      task: "Schreibt sechs Dialogzeilen. Heidi und Clara stellen je eine Frage und bieten je etwas aus ihrer eigenen Welt an.",
      example: "Heidi fragt: 'Darf ich dir erzählen, wie Peter die Geissen ruft?' Clara sagt: 'Ja, und danach zeige ich dir mein Bergbuch.'"
    }],
    "rottenmeier-tisch": [{
      object: "cloth",
      title: "Die Serviette wird zum Amtsblatt",
      text: "Die Geiss legt die Serviette hin, als wäre sie ein Gesetz. Heidi soll lernen, aber nicht beschämt werden.",
      task: "Schreibt dieselbe Tischregel in drei Fassungen: verletzend, neutral, hilfreich. Entscheidet, welche Fassung Heidi weiterbringt.",
      example: "Verletzend: 'Wie kann man nur so essen!' Neutral: 'Die Serviette bleibt auf dem Schoß.' Hilfreich: 'Leg die Serviette hierher; ich zeige es dir.'"
    }],
    "sehnsucht-alp": [{
      object: "hay",
      title: "Die Geiss versteckt ein Stück Alp im Zimmer",
      text: "Ein Heuhalm, ein Geruch, ein Klang: In Frankfurt kommt die Alp in Heidis Kopf zurück, ohne dass jemand das Wort Heimweh sagen muss.",
      task: "Schreibt eine Heimweh-Szene ohne das Wort 'Heimweh'. Zeigt ein Körperzeichen und ein Erinnerungsbild.",
      example: "Heidi stand am Fenster und suchte Himmel zwischen den Dächern. Das Brot blieb liegen. In ihrem Kopf hörte sie Peters Ruf nach Schwänli."
    }],
    "frankfurt-verlorene-stadt": [{
      object: "rule",
      title: "Zwei Frankfurt-Bilder liegen übereinander",
      text: "Ein Bild zeigt eine rekonstruierte Stadt um 1890, das andere die Zerstörung 1944. Fräulein Rottenmeier tut so, als sei beides dieselbe Gegenwart.",
      task: "Erklärt in drei Sätzen: rekonstruiertes Frankfurt um 1890, Zerstörung 1944, heutiger Abstand zu Spyris Stadtraum.",
      example: "Die 1890-Szene nähert sich der Stadtwelt an, die Heidi fremd gewesen sein könnte. 1944 kam eine spätere Katastrophe. Darum existiert Spyris Frankfurt heute so nicht mehr."
    }],
    "rueckkehr-alp": [{
      object: "bell",
      title: "Die Glocke läutet zu früh zur Rückkehr",
      text: "Die Geiss will sofort Jubel. Aber Heidis Rückkehr ist zugleich vertraut und verändert.",
      task: "Schreibt die ersten fünf Sätze der Rückkehr. Zeigt einmal Wiedererkennen und einmal, dass Frankfurt in Heidi nachwirkt.",
      example: "Heidi blieb vor der Hütte stehen. Der Wind roch wieder nach Gras. 'Großvater', sagte sie nur. Frankfurt lag hinter ihr, aber nicht ganz fort."
    }],
    "grossmutter-hoert": [{
      object: "bell",
      title: "Die Geiss meckert zu laut neben der Großmutter",
      text: "Lauter wird es nicht besser. Die Großmutter hört gerade deshalb gut zu, weil sie Pausen zulässt.",
      task: "Schreibt eine Zuhörszene: höchstens zwei kurze Sätze der Großmutter, dazu eine Pause oder ein Blick, der Heidis Erzählen verändert.",
      example: "Die Großmutter sagte: 'Erzähl weiter, Kind.' Dann wartete sie. Heidi sah auf ihre Hände und begann langsamer, bis sie das Wort für ihre Angst fand."
    }],
    "peter-eifersucht": [{
      object: "hoof",
      title: "Die Geiss tritt neben Peters Gefühl",
      text: "Peter ist verletzt, aber ein Tritt macht nichts besser. Die Szene muss Gefühl und Grenze auseinanderhalten.",
      task: "Schreibt eine kurze Szene und danach zwei Auswertungssätze: einer versteht Peters Gefühl, einer setzt eine klare Grenze.",
      example: "Peter tritt einen Stein weg und schweigt. Man kann verstehen, dass er Angst hat, Heidi zu verlieren. Trotzdem darf er Clara nicht verletzen."
    }],
    "dorfschule-peter": [{
      object: "rule",
      title: "Die Geiss frisst die Lesekarte an",
      text: "Auf der Karte steht nur noch: 'Schwänli geht zum ...' Peter braucht eine Aufgabe, die er spielen und lesen kann.",
      task: "Entwerft eine Schulaufgabe mit Material, Lesesatz und ermutigender Rückmeldung.",
      example: "Material: Karten mit Geissennamen und Wegbildern. Satz: 'Schwänli geht zum Steg.' Rückmeldung: 'Du hast Schwänli erkannt; jetzt lesen wir das Wegwort.'"
    }],
    "clara-auf-der-alp": [{
      object: "bucket",
      title: "Die Geiss schiebt Clara den Milchkübel vor die Füße",
      text: "Alles ist hell, nah und ungewohnt. Heidi darf Clara helfen, aber nicht über sie bestimmen.",
      task: "Schreibt zwei Perspektiven: zuerst Claras Wahrnehmung, dann Heidis behutsames Angebot.",
      example: "Clara blinzelte, weil das Licht auf der Wiese so hell war. Heidi sagte: 'Wir müssen nicht schnell gehen; ich zeige dir erst den flachen Weg.'"
    }],
    "ziegen-verloren": [{
      object: "bell",
      title: "Eine Glocke fehlt im Klang",
      text: "Schwänli ist nicht bei der Herde. Jetzt braucht es keine Panik, sondern Orte, Reihenfolge und einen Ruf.",
      task: "Schreibt einen Suchplan in vier Schritten und einen kurzen Lockruf für die Geiss.",
      example: "Zuerst gehen wir zum flachen Stein oberhalb des Stegs. Dann schauen wir beim Bach. Heidi ruft: 'Schwänli, komm her, hier ist der Weg!'"
    }],
    "schlusskreis": [{
      object: "cheese",
      title: "Der letzte Käse wird nur verteilt, wenn etwas hängen bleibt",
      text: "Am Ende drängt alles auf einmal herein: Alp, Frankfurt, Schule, Regeln, Glocken. Der Schlusskreis braucht Auswahl.",
      task: "Wählt eine Szene, ein genaueres Wort, eine gute Frage und einen Satz darüber, was Heidi dadurch gelernt haben könnte.",
      example: "Ich wähle die Szene mit der fehlenden Geiss, weil Heidi dort genauer sprechen muss. Das Wort 'oberhalb' hilft. Die Frage 'Wo stand sie zuletzt?' macht aus Angst einen Plan."
    }]
  },
  beats: {
    "alp-spricht": ["Rottenmeiers Regelstimme hält Bauernregeln für Amtsbefehle: Wenn Abendrot ist, müsse das Wetter gehorchen.", "Erfindet eine Regel, die klingt wie Alp-Erfahrung, aber nicht so tut, als könne sie den Himmel kommandieren."],
    "ziegen-ansprechen": ["Rottenmeiers Stimme ruft jede Geiss mit 'Sie da!' und wundert sich, dass niemand folgt.", "Findet eine Stimme, mit der Heidi eine Geiss wirklich ansprechen könnte: kurz, freundlich, beobachtend."],
    "almoehi-sprechen": ["Rottenmeiers Regelstimme will den Almöhi verhören: Name, Zweck, Wetterzuständigkeit.", "Heidi braucht eine Frage, die den Großvater öffnet, statt ihn wie ein Formular auszufüllen."],
    "frankfurter-stimmen": ["In Frankfurt merkt Heidi: Auch Menschen können mit Regeln verletzen. Manche Sätze helfen, manche machen klein.", "Trennt Hausregel, Tonfall und faire Hilfe, damit Heidi nicht nur gehorcht, sondern versteht."],
    "peter-lernt-anders": ["Rottenmeiers Regelstimme will Peter an den Tisch nageln, bis die Buchstaben ordentlich stehen.", "Baut einen Lernweg, der von Peters Wegen, Geissen und Händen ausgeht."],
    "heidi-erzaehlt-weiter": ["Die Geiss behauptet, alles müsse exakt im Buch stehen, sonst sei es verboten.", "Markiert eure Weitererzählung als möglich und verankert sie in einer konkreten Erinnerung."],
    "huette-einrichten": ["Rottenmeiers Regelstimme sucht in der Hütte nach Klingel, Teppichordnung und Besuchsformular.", "Macht sichtbar, wie Heidi über Gegenstände und Handgriffe ankommt."],
    "bett-im-heu": ["Rottenmeiers Stimme erklärt Heu zum unzulässigen Bettmaterial.", "Zeigt, warum das Heu für Heidi nicht Armut, sondern Wärme, Geruch und Ruhe bedeutet."],
    "peter-stellt-ziegen-vor": ["Rottenmeiers Regelstimme will Nummern statt Namen: Geiss 1, Geiss 2, Geiss 3.", "Gebt den Geissen Eigenheiten, damit aus Herde einzelne Wesen werden."],
    "gewitter-kommt": ["Rottenmeiers Regelstimme verlangt einen schriftlichen Donner-Antrag, während die Wolken schon tief hängen.", "Macht aus Beobachtung einen schnellen, praktischen Plan."],
    "alpsegen-hoeren": ["Rottenmeiers Stimme hört den Alpsegen und fragt, ob das eine Hausordnung mit Melodie sei.", "Findet Worte dafür, wie ein Ruf Schutz, Abend und Gemeinschaft bedeuten kann."],
    "grossvater-arbeitet": ["Rottenmeiers Regelstimme kommentiert jeden Handgriff, bis kein Holz mehr gespalten wird.", "Beschreibt Arbeit so genau, dass Schweigen und Können verständlich werden."],
    "ankunft-frankfurt": ["Frankfurt tut so, als sei alles selbstverständlich: Türen, Treppen, Stimmen, Regeln.", "Zeigt Heidis erste Überforderung: Geräusche, Regeln, Höhe, Enge."],
    "clara-kennenlernen": ["Rottenmeiers Regelstimme will Freundschaft nach Sitzordnung vergeben.", "Lasst Clara und Heidi vorsichtig Kontakt aufnehmen, ohne dass eine die andere vorführt."],
    "rottenmeier-tisch": ["Am Tisch fühlt sich Rottenmeiers Regelstimme plötzlich mächtig: Serviette, Haltung, Schweigen!", "Verwandelt eine steife Tischregel in einen Satz, der Heidi wirklich helfen könnte."],
    "sehnsucht-alp": ["Rottenmeiers Regelstimme findet Heimweh unordentlich: Gefühle sollen bitte im Schrank bleiben.", "Macht Heidis Sehnsucht konkret, ohne sie zu verkitschen."],
    "frankfurt-verlorene-stadt": ["Heidi sucht Spyris Frankfurt und stößt auf Bilder einer Stadt, die so nicht mehr existiert.", "Erklärt den historischen Bruch, ohne die Heidi-Szene zu verlieren."],
    "rueckkehr-alp": ["Rottenmeiers Regelstimme will die Rückkehr als Reisebericht abstempeln lassen.", "Zeigt, was sich an Heidi verändert hat, wenn sie wieder oben ankommt."],
    "grossmutter-hoert": ["Die Geiss spricht extra laut, weil sie Zuhören mit Lautstärke verwechselt.", "Findet eine Sprache, die Rücksicht nimmt und trotzdem lebendig erzählt."],
    "peter-eifersucht": ["Rottenmeiers Regelstimme würde Peters Eifersucht sofort bestrafen und abhaken.", "Sucht die Kränkung hinter der Tat und eine Antwort, die Verantwortung möglich macht."],
    "dorfschule-peter": ["Rottenmeiers Regelstimme marschiert in die Dorfschule und will alle Buchstaben geradeziehen.", "Entwerft eine Aufgabe, bei der Peter nicht beschämt wird."],
    "clara-auf-der-alp": ["Rottenmeiers Stimme ruft: 'Alp ist kein Sanatorium!' und macht Claras ersten Schritt unnötig schwer.", "Beschreibt Claras Ankommen auf der Alp konkret und vorsichtig."],
    "ziegen-verloren": ["Eine Geiss fehlt, und Rottenmeiers Regelstimme möchte zuerst ein Verlustprotokoll.", "Macht aus Sorge einen Suchplan mit Ortswörtern und Lockruf."],
    "schlusskreis": ["Am Ende will Rottenmeiers Regelstimme wissen, ob jetzt endlich Ordnung herrscht.", "Wählt die stärkste Szene und erklärt, was sie an Sprache verändert hat."]
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
      <div class="brand"><span class="brand-mark" aria-hidden="true">H</span><span>Heidi - Geissen, Regeln, Stimmen</span></div>
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
      <div class="front-video" aria-hidden="true">
        <video src="/heidi-game/assets/alpfeeling-front.mp4" autoplay muted loop playsinline preload="metadata"></video>
      </div>
      <div class="front-scrim" aria-hidden="true"></div>
      <div class="front-content">
        <div class="hero-copy">
          <p class="eyebrow">Browserbasiertes Partnerspiel</p>
          <h1>Heidi - Geissen, Regeln, Stimmen</h1>
          <p>${escapeHtml(STORY.premise)}</p>
        </div>
        <div class="front-objects" aria-label="Spielstart">
          <section class="front-object group-object">
            <p class="eyebrow">Für die Klasse</p>
            <h2>Als Gruppe spielen</h2>
            <p>Tragt euren Gruppennamen ein. Danach erscheinen zwei QR-Codes: einer für Schwänli, einer für Schnecke.</p>
            <form class="host-login" data-host-login>
              <label>Gruppenname<input name="hostName" value="${escapeHtml(state.hostName)}" placeholder="z. B. Tisch 3, Gruppe Alpwind oder Klasse 2b" required></label>
              <button type="submit">Gruppe anmelden</button>
            </form>
          </section>
          <nav class="front-object entry-objects" aria-label="Weitere Einstiege">
            <button type="button" class="entry-object is-desktop" data-nav="desktop"><strong>Desktop</strong><span>Zwei Personen spielen an einem Bildschirm.</span></button>
            <button type="button" class="entry-object is-demo" data-nav="demo"><strong>Demo</strong><span>Handyansichten, Beispiele und Kapitelwahl ansehen.</span></button>
            <button type="button" class="entry-object is-teacher" data-nav="teacher"><strong>Lehrpersonen</strong><span>Einstellungen, Inhaltsmodell und Export öffnen.</span></button>
          </nav>
        </div>
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
      alt: "Schwänli, die weiße Geiss"
    },
    B: {
      name: "Schnecke",
      src: "/heidi-game/assets/player-goat-b.jpeg",
      alt: "Schnecke, die gefleckte Geiss"
    }
  };
  const profile = profiles[role] || profiles.A;
  return html`
    <div class="player-profile role-${role.toLowerCase()}">
      <img src="${escapeHtml(profile.src)}" alt="${escapeHtml(profile.alt)}" loading="lazy">
      <div>
        <strong>${escapeHtml(label || profile.name)}</strong>
        <span>${escapeHtml(goatJob(role).short)}</span>
      </div>
    </div>
  `;
}

function goatJob(role) {
  if (role === "A") {
    return {
      short: "sieht zuerst",
      title: "Schwänli sieht zuerst.",
      text: "Du sammelst, was in der Szene wirklich sichtbar, hörbar oder spürbar ist. Sag es kurz, bevor ihr deutet.",
      prompt: "Beginne mit: Ich sehe ... / Ich höre ... / Mir fällt auf ..."
    };
  }
  return {
    short: "fragt nach",
    title: "Schnecke fragt nach.",
    text: "Du bringst Wörter, Fragen und Ordnung hinein. Hilf, aus Schwänlis Beobachtung eine brauchbare Antwort zu machen.",
    prompt: "Frage: Welches Wort passt genauer? Was fehlt noch? Wie klingt es vorsichtiger?"
  };
}

function goatCardGuide(compact = false) {
  return html`
    <aside class="goat-guide ${compact ? "is-compact" : ""}">
      <strong>So funktionieren die Geissenkarten</strong>
      <ol>
        <li><span>1</span><p><strong>Getrennt lesen.</strong> Schwänli und Schnecke bekommen verschiedene Hinweise. Nicht sofort alles vermischen.</p></li>
        <li><span>2</span><p><strong>Laut austauschen.</strong> Jede Geiss sagt ihren Hinweis in eigenen Worten. Wenn ein Mikrofon verlangt wird, zuerst ins Handy sprechen.</p></li>
        <li><span>3</span><p><strong>Gemeinsam schreiben.</strong> Erst danach öffnet ihr die Schreibwerkstatt und macht aus beiden Hinweisen eine Antwort.</p></li>
      </ol>
    </aside>
  `;
}

function qrCard(role, title, subtitle) {
  const url = joinAddress(role);
  const job = goatJob(role);
  return html`
    <article class="qr-card role-${role.toLowerCase()}">
      ${playerProfile(role, title)}
      <div>
        <p class="eyebrow">Handykarte</p>
        <h3>${role === "A" ? "Schwänli" : "Schnecke"}</h3>
        <p><strong>${escapeHtml(job.title)}</strong> ${escapeHtml(job.text)}</p>
        <p class="small">${escapeHtml(subtitle)}</p>
      </div>
      ${qrSvg(url)}
      <p class="small">${escapeHtml(url)}</p>
    </article>
  `;
}

function meadowUnderlay() {
  return html`
    <div class="meadow-underlay" aria-hidden="true">
      <video src="/heidi-game/assets/wiese-background.mp4" autoplay muted loop playsinline preload="metadata"></video>
    </div>
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
      ${meadowUnderlay()}
      ${questStage(c, "Laptop-Spielleitung")}
      ${playSectionMenu(sections, active)}
      ${active === "join" ? html`
        <div class="panel stack">
          <div>
            <p class="eyebrow">Eure Gruppe</p>
            <h2>${escapeHtml(state.hostName)}</h2>
            <p>Scanne den passenden QR-Code: eine Person bekommt Schwänli, eine Person bekommt Schnecke. Der Raumcode bleibt als Reserve sichtbar: <strong>${escapeHtml(state.room?.code || "----")}</strong></p>
          </div>
          ${goatCardGuide()}
          <div class="qr-grid">
            ${qrCard("A", "Schwänli", "Diese Karte gehört der Person mit Schwänli.")}
            ${qrCard("B", "Schnecke", "Diese Karte gehört der Person mit Schnecke.")}
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
  const [trouble] = storyBeatText(c);
  return html`
    <section class="quest-stage">
      ${sceneMedia(c)}
      <div class="quest-copy">
        <div class="quest-kicker">
          <span>${escapeHtml(label)}</span>
          <span>${escapeHtml(c.place || "Spielort")}</span>
          <span>Quest ${state.chapterIndex + 1} von ${state.content.chapters.length}</span>
        </div>
        ${journeyMarker(c)}
        <h1>${escapeHtml(c.title)}</h1>
        ${alpInventory()}
        <details class="story-drawer">
          <summary>Worum geht es?</summary>
          <p>${escapeHtml(c.laptopFrame)}</p>
        </details>
        <p class="scene-context"><strong>Heute stört:</strong> ${escapeHtml(trouble)}</p>
        ${chaosPanel(c)}
        ${transitionNote(c)}
        ${historicalNote(c)}
        <div class="quest-actions">
          <button type="button" class="secondary" data-prev-chapter ${state.chapterIndex === 0 ? "disabled" : ""}>Vorige Quest</button>
          <button type="button" data-next-chapter ${state.chapterIndex >= state.content.chapters.length - 1 ? "disabled" : ""}>Nächste Quest</button>
        </div>
      </div>
    </section>
  `;
}

function journeyPhase(c = chapter()) {
  return STORY.journey.find((phase) => phase.ids.includes(c.id)) || STORY.journey[0];
}

function journeyMarker(c = chapter()) {
  const phase = journeyPhase(c);
  return html`
    <div class="journey-marker">
      <strong>${escapeHtml(phase.title)}</strong>
      <span>${escapeHtml(phase.line)}</span>
    </div>
  `;
}

function transitionNote(c = chapter()) {
  const line = STORY.transitions[c.id];
  if (!line) return "";
  return html`
    <aside class="transition-note">
      <strong>Warum jetzt?</strong>
      <p>${escapeHtml(line)}</p>
    </aside>
  `;
}

function chaosKey(c = chapter()) {
  return `${state.chapterIndex}:${c.id}`;
}

function currentChaos(c = chapter()) {
  const options = questChaosOptions(c);
  const key = chaosKey(c);
  if (state.chaosEvents[key] === undefined) {
    state.chaosEvents[key] = Math.floor(Math.random() * options.length);
  }
  return options[state.chaosEvents[key] % options.length];
}

function questChaosOptions(c = chapter()) {
  return STORY.questChaos?.[c.id] || STORY.chaos;
}

function chaosPanel(c) {
  const chaos = currentChaos(c);
  const options = questChaosOptions(c);
  return html`
    <aside class="chaos-panel meadow-task">
      <section class="main-assignment meadow-bloom assignment-bloom">
        <p class="eyebrow">Auftrag</p>
        <h2>${escapeHtml(chaos.assignment || c.teamTask)}</h2>
      </section>
      <div class="object-card-head meadow-bloom disturbance-bloom">
        ${objectCutout(chaos.object, chaos.title)}
        <div>
          <p class="eyebrow">Störung der Geiss</p>
          <strong>${escapeHtml(chaos.title)}</strong>
        </div>
      </div>
      <div class="chaos-plain meadow-leaf">
        <span>Das passiert gerade</span>
        <p>${escapeHtml(chaos.text)}</p>
      </div>
      <div class="chaos-task meadow-leaf">
        <span>So löst ihr die Quest</span>
        <p>${escapeHtml(chaos.task)}</p>
      </div>
      <form class="object-response meadow-writing" data-chaos-form>
        <label>
          <span>Schreibfeld: Eure Questantwort</span>
          <textarea name="response" required placeholder="Hier eure eigene Antwort schreiben."></textarea>
        </label>
        <div data-save-feedback="chaos"></div>
        <div class="example-drawer" data-example-drawer>
          <button type="button" class="secondary" data-show-chaos-example>Wie meinst du das?</button>
          <p hidden>${escapeHtml(chaos.example || c.example || "Schreibt konkret, kurz und passend zur Szene.")}</p>
        </div>
        <button type="submit">Questantwort speichern</button>
      </form>
      ${options.length > 1 ? `<button type="button" class="secondary" data-chaos>Neue passende Störung</button>` : ""}
    </aside>
  `;
}

function objectCutout(type = "word", label = "Spielobjekt") {
  const normalized = String(type || "word").replace(/[^a-z-]/g, "");
  const assets = {
    bell: "bell",
    "bucket-spill": "bucket-spill",
    bucket: "bucket",
    cheese: "cheese",
    cloth: "cloth",
    hay: "hay",
    milk: "bucket-spill",
    rule: "rule",
    stool: "stool",
    word: "rule"
  };
  const asset = assets[normalized];
  return html`
    <span class="object-cutout is-${escapeHtml(normalized)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
      ${asset ? `<img src="/heidi-game/assets/objects/${escapeHtml(asset)}.png" alt="" loading="lazy">` : `<span class="object-shape" aria-hidden="true"></span>`}
    </span>
  `;
}

function reactionText(reaction) {
  return typeof reaction === "string" ? reaction : reaction?.text || "";
}

function reactionObject(reaction) {
  return typeof reaction === "string" ? "word" : reaction?.object || "word";
}

function reactionTitle(reaction, fallback) {
  const text = reactionText(reaction);
  return text.split(":")[0] || fallback;
}

function alpInventory() {
  return html`
    <div class="alp-inventory" aria-label="Alp-Inventar">
      ${["bucket", "cheese", "hay", "bell", "rule", "stool", "cloth"].map((item) => objectCutout(item, item)).join("")}
      <div>
        <strong>Alp-Inventar</strong>
        <span>Kübel, Käse, Heu, Glocke, Regel, Schemel, Lappen. Diese Dinge werden bespielt.</span>
      </div>
    </div>
  `;
}

function storyBeatText(c) {
  return STORY.beats[c.id] || [
    "Rottenmeiers Regelstimme will aus der Szene sofort eine starre Vorschrift machen.",
    "Schwänli und Schnecke müssen zeigen, was man wirklich sieht, hört oder sagen kann."
  ];
}

function chapterTabs() {
  return html`
    <div class="quest-map quest-meadow">
      <div class="quest-map-head">
        <div>
          <p class="eyebrow">Alpblumenwiese</p>
          <strong>${escapeHtml(chapter().title)}</strong>
        </div>
        <span>${state.chapterIndex + 1}/${state.content.chapters.length}</span>
      </div>
      <div class="flower-field" aria-label="Quests als Alpblumen">
        ${state.content.chapters.map((item, index) => `<button type="button" class="quest-flower flower-${(index % 6) + 1}" title="${escapeHtml(item.title)}" data-chapter="${index}" aria-current="${index === state.chapterIndex}" style="--x:${(index * 37) % 92}%;--y:${18 + ((index * 29) % 64)}%;--tilt:${((index % 5) - 2) * 7}deg"><span>${index + 1}</span><em>${escapeHtml(item.title)}</em></button>`).join("")}
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
  const [main, ...more] = mediaItems;

  return html`
    <div class="scene-media-grid stage-media">
      <figure class="scene-media is-main">
        <video src="${escapeHtml(main.src)}" autoplay muted loop playsinline preload="metadata"></video>
        <figcaption>
          <strong>${escapeHtml(main.label || c.place || "Szene")}</strong>
          <div class="media-controls">
            ${main.hasAudio ? `<button type="button" class="secondary" data-toggle-media-sound>Videoton einschalten</button>` : ""}
            ${main.audio?.src ? `<button type="button" class="secondary" data-audio-label="${escapeHtml(main.audio.label || "Audio")}" data-toggle-scene-audio>${escapeHtml(main.audio.label || "Audio einschalten")}</button><audio src="${escapeHtml(main.audio.src)}" preload="metadata" ${main.audio.loop ? "loop" : ""}></audio>` : ""}
          </div>
        </figcaption>
      </figure>
      ${more.length ? `<div class="scene-thumbs">${more.map((media) => `
        <figure class="scene-media is-thumb">
          <video src="${escapeHtml(media.src)}" autoplay muted loop playsinline preload="metadata"></video>
          <figcaption><strong>${escapeHtml(media.label || "Nebenclip")}</strong></figcaption>
        </figure>
      `).join("")}</div>` : ""}
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
        <strong>Schwänli sagt, was da ist</strong>
        <p>${escapeHtml(c.roleA.name)}: Beobachtung, Stimme oder erster Eindruck aus der Szene.</p>
      </article>
      <article>
        <span>2</span>
        <strong>Schnecke macht es genauer</strong>
        <p>${escapeHtml(c.roleB.name)}: Wörter, Fragen, Ordnung oder Vorsicht für die Antwort.</p>
      </article>
      <article>
        <span>3</span>
        <strong>Ihr schreibt gemeinsam</strong>
        <p>Verbindet beide Karten zu einer Antwort. Danach überarbeitet ihr: ${escapeHtml(c.revisionPrompt)}</p>
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
      <div class="example-drawer" data-answer-help>
        <button type="button" class="secondary" data-show-answer-help>Wie meinst du das?</button>
        <div hidden>
          <strong>Hinweis</strong>
          <p>${escapeHtml(c.hint)}</p>
          <strong>Beispiel</strong>
          <p>${escapeHtml(c.example)}</p>
        </div>
      </div>
      <label><span>2. Überarbeitete Fassung</span><textarea name="revision" required></textarea></label>
      <div data-written-feedback="revision">${feedbackMarkup(c, "revision", "")}</div>
      <label><span>3. Kurze Reflexion</span><textarea name="reflection" required placeholder="${escapeHtml(c.reflection)}"></textarea></label>
      <div data-written-feedback="reflection">${feedbackMarkup(c, "reflection", "")}</div>
      <div data-save-feedback="answer"></div>
      <div class="toolbar">
        <button type="submit">Lernspur speichern</button>
      </div>
    </form>
  `;
}

async function saveAnswer(form) {
  const data = new FormData(form);
  const c = chapter();
  const entries = [
    ["first", data.get("first")],
    ["revision", data.get("revision")],
    ["reflection", data.get("reflection")]
  ];
  const decisions = entries.map(([kind, text]) => [kind, text, qualityDecision(c, kind, text)]);
  const rejected = decisions.filter(([, , decision]) => !decision.accepted);

  for (const [kind, text, decision] of decisions) {
    const target = form.querySelector(`[data-written-feedback="${kind}"]`);
    if (target) target.innerHTML = decision.accepted ? feedbackMarkup(c, kind, text) : qualityGateMarkup(decision);
  }

  const saveFeedback = form.querySelector("[data-save-feedback]");
  if (rejected.length) {
    if (saveFeedback) {
      saveFeedback.innerHTML = html`
        <div class="save-refusal">
          <strong>Diese Lernspur ist noch nicht bereit.</strong>
          <p>Überarbeitet zuerst ${rejected.map(([kind]) => kindLabel(kind)).join(", ")}. Erst dann wächst die Schiefertafel weiter.</p>
        </div>
      `;
    }
    const [firstRejectedKind] = rejected[0];
    form.querySelector(`[name="${firstRejectedKind}"]`)?.focus();
    return;
  }

  if (saveFeedback) saveFeedback.innerHTML = "";

  const feedbackEntries = decisions.map(([kind, text, decision]) => {
    const feedback = decision.feedback;
    return [
      `${kind}-feedback`,
      [
        feedback.title,
        `Spielreaktion: ${reactionText(feedback.reward || feedback.kick)}`,
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
    .replaceAll("ß", "ss")
    .replace(/[^a-z0-9\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SYNONYM_GROUPS = [
  ["geiss", "geissen", "geisslein", "ziege", "ziegen", "tier", "tiere", "herde", "schwaenli", "schnecke", "baerli"],
  ["huette", "haus", "stube", "raum", "maiensaess", "alpstube"],
  ["grossvater", "alm-oehi", "almoehi", "opa", "alter", "oehi"],
  ["peter", "geissenpeter", "hirte", "bub"],
  ["bitte", "darf", "duerfte", "kann ich", "koennte ich", "frag", "frage", "fragen"],
  ["handgriff", "legt", "stellen", "stellt", "schiebt", "nimmt", "haelt", "zeigt", "rueckt", "hebt", "setzt", "wischt"],
  ["wetter", "himmel", "wolke", "wolken", "wind", "regen", "gewitter", "donner", "licht", "abendrot", "morgenrot"],
  ["alp", "berg", "wiese", "hang", "gras", "stein", "felsen", "weite", "heuboden"],
  ["frankfurt", "stadt", "haus", "haeuser", "strasse", "treppe", "salon", "zerstoert", "zerstoerung", "nicht mehr"],
  ["hilfe", "helfen", "hilft", "zeigt", "erklaert", "fair", "freundlich", "ohne beschaemen"],
  ["vorsicht", "vielleicht", "oft", "manchmal", "koennte", "nicht immer", "erfahrung"],
  ["spruch", "regel", "bauernregel", "merksatz", "reim"],
  ["begründen", "weil", "dadurch", "deshalb", "darum", "denn"]
];

function expandedFeedbackTerms(terms = []) {
  const normalizedTerms = terms.map(normalizeFeedbackText).filter(Boolean);
  const expanded = new Set(normalizedTerms);
  for (const group of SYNONYM_GROUPS) {
    const normalizedGroup = group.map(normalizeFeedbackText).filter(Boolean);
    const belongs = normalizedGroup.some((groupTerm) =>
      normalizedTerms.some((term) => term === groupTerm || term.includes(groupTerm) || groupTerm.includes(term))
    );
    if (belongs) {
      normalizedGroup.forEach((term) => expanded.add(term));
    }
  }
  return [...expanded];
}

function feedbackMatchesTerm(normalized, term) {
  if (!normalized || !term) return false;
  if (normalized.includes(term)) return true;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const termTokens = term.split(/\s+/).filter(Boolean);
  if (termTokens.length > 1) {
    return termTokens.every((termToken) => feedbackMatchesTerm(normalized, termToken));
  }
  if (term.length < 5) return false;
  const stem = term.slice(0, Math.min(6, term.length));
  return tokens.some((token) => token.startsWith(stem) || term.startsWith(token.slice(0, Math.min(6, token.length))));
}

function feedbackIncludes(text, terms) {
  const normalized = normalizeFeedbackText(text);
  return expandedFeedbackTerms(terms).some((term) => feedbackMatchesTerm(normalized, term));
}

function kindLabel(kind) {
  if (kind === "first") return "erste Fassung";
  if (kind === "revision") return "Überarbeitung";
  if (kind === "reflection") return "Reflexion";
  if (kind === "voice") return "mündlicher Beitrag";
  if (kind === "questantwort") return "Questantwort";
  return "Eingabe";
}

function qualityExpectation(kind) {
  if (kind === "voice") return { minHits: 2, minWords: 8 };
  if (kind === "reflection") return { minHits: 1, minWords: 12 };
  if (kind === "questantwort") return { minHits: 2, minWords: 18 };
  return { minHits: 2, minWords: 25 };
}

function qualifiedFeedback(chapterData, kind, text) {
  const profile = FEEDBACK_PROFILES[chapterData.id];
  const words = wordCount(text);
  if (!profile) {
    const hits = words >= 20 ? 2 : 0;
    return {
      title: "Feedback",
      strengths: ["Die Eingabe ist gespeichert und kann mit dem Kapitelziel verglichen werden."],
      nextSteps: [chapterData.revisionPrompt],
      summary: chapterData.hint,
      hits,
      words,
      reward: rewardForFeedback(hits, words, kind),
      kick: kickForFeedback(hits, words, kind)
    };
  }

  const strengths = [];
  const nextSteps = [];
  const missingLabels = [];
  let hits = 0;
  for (const [label, terms, suggestion] of profile.checks) {
    if (feedbackIncludes(text, terms)) {
      hits += 1;
      strengths.push(`${label}: erkennbar angelegt.`);
    } else {
      missingLabels.push(label);
      nextSteps.push(`${label}: ${suggestion}`);
    }
  }

  if ((kind === "first" || kind === "questantwort") && words < qualityExpectation(kind).minWords) {
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
    summary: `${profile.aim} ${profile.upgrade}`,
    hits,
    words,
    missingLabels,
    reward: rewardForFeedback(hits, words, kind),
    kick: kickForFeedback(hits, words, kind)
  };
}

function rewardForFeedback(hits, words, kind) {
  const expectation = qualityExpectation(kind);
  if (hits < expectation.minHits || words < expectation.minWords) return "";
  return STORY.rewards[(hits + words + kind.length) % STORY.rewards.length];
}

function kickForFeedback(hits, words, kind) {
  const expectation = qualityExpectation(kind);
  if (hits >= expectation.minHits && words >= expectation.minWords) return "";
  return STORY.kicks[(hits + words + kind.length) % STORY.kicks.length];
}

function qualityDecision(chapterData, kind, text) {
  const feedback = qualifiedFeedback(chapterData, kind, text);
  const expectation = qualityExpectation(kind);
  const accepted = feedback.hits >= expectation.minHits && feedback.words >= expectation.minWords;
  const missing = [];
  if (feedback.hits < expectation.minHits) {
    missing.push(`${expectation.minHits - feedback.hits} weitere konkrete Spur(en) aus der Quest`);
  }
  if (feedback.words < expectation.minWords) {
    missing.push(`${expectation.minWords - feedback.words} Wort/Wörter mehr`);
  }
  return { accepted, feedback, expectation, missing };
}

function qualityGateMarkup(decision) {
  const { feedback, missing } = decision;
  const reaction = feedback.kick || STORY.kicks[0];
  return html`
    <div class="qualified-feedback quality-gate">
      <strong>Noch nicht gespeichert</strong>
      <div class="game-feedback is-kick">
        ${objectCutout(reactionObject(reaction), reactionTitle(reaction, "Geissentritt"))}
        <div>
          <strong>Die Geiss bockt noch.</strong>
          <p>${escapeHtml(missing.length ? `Es fehlt: ${missing.join(", ")}.` : "Die Antwort trifft die Quest noch nicht genau genug.")}</p>
        </div>
      </div>
      <details class="feedback-details" open>
        <summary>So bessert ihr nach</summary>
        <p>${escapeHtml(feedback.summary)}</p>
        <div>
          <strong>Schon tragfähig</strong>
          <ul>${feedback.strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
        <div>
          <strong>Jetzt konkret ergänzen</strong>
          <ul>${feedback.nextSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
      </details>
    </div>
  `;
}

function feedbackMarkup(chapterData, kind, text) {
  if (!String(text || "").trim()) {
    return "";
  }
  const feedback = qualifiedFeedback(chapterData, kind, text);
  const reaction = feedback.reward || feedback.kick;
  return html`
    <div class="qualified-feedback">
      <strong>${escapeHtml(feedback.title)}</strong>
      <div class="game-feedback ${feedback.reward ? "is-reward" : "is-kick"}">
        ${objectCutout(reactionObject(reaction), reactionTitle(reaction, feedback.reward ? "Belohnung" : "Geissentritt"))}
        <div>
          <strong>${feedback.reward ? "Belohnung" : "Geissentritt"}</strong>
          <p>${escapeHtml(reactionText(reaction))}</p>
        </div>
      </div>
      <details class="feedback-details">
        <summary>Warum?</summary>
        <p>${escapeHtml(feedback.summary)}</p>
        <div>
          <strong>Schon tragfähig</strong>
          <ul>${feedback.strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
        <div>
          <strong>Jetzt überarbeiten</strong>
          <ul>${feedback.nextSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
      </details>
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
        <h1>Geiss beitreten</h1>
      </div>
      <form class="stack" data-join-form>
        <label>Raumcode<input name="code" value="${escapeHtml(code)}" maxlength="6" required></label>
        <label>Geiss<select name="role"><option value="">automatisch</option><option value="A" ${role === "A" ? "selected" : ""}>Schwänli</option><option value="B" ${role === "B" ? "selected" : ""}>Schnecke</option></select></label>
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
      <div class="notice"><p>${needsVoice ? "Diese Geiss muss zuerst den mündlichen Beitrag per Handy-Mikrofon festhalten." : "Sprich mit der Partnerperson."} Auf dem Laptop wird die Schreibaufgabe erst nach beiden Bestätigungen freigeschaltet.</p></div>
    </section>
  `;
}

function roleCard(role, roleData) {
  const job = goatJob(role);
  return html`
    <article class="role-card role-${role.toLowerCase()}">
      ${playerProfile(role)}
      <div class="goat-job">
        <strong>${escapeHtml(job.title)}</strong>
        <p>${escapeHtml(job.text)}</p>
        <p class="small">${escapeHtml(job.prompt)}</p>
      </div>
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
    { id: "cards", label: "Geissenkarten" },
    { id: "write", label: "Schreibwerkstatt" },
    { id: "path", label: "Questpfad" },
    { id: "log", label: "Lernspur" }
  ];
  const active = activePlaySection(sections, "cards");
  app.innerHTML = html`
    ${topbar("desktop")}
    <div class="play-layout">
      ${meadowUnderlay()}
      ${questStage(c, "Desktopmodus")}
      ${playSectionMenu(sections, active)}
      ${active === "cards" ? html`
        <div class="goat-board panel stack">
          <div>
            <p class="eyebrow">Geissenkarten</p>
            <h2>Erst getrennt lesen, dann zusammenführen</h2>
          </div>
          ${goatCardGuide()}
          ${taskFlow(c)}
          <div class="toolbar">
            <button type="button" class="secondary" data-reveal="A">${state.revealA ? "Schwänli verbergen" : "Schwänli öffnen"}</button>
            <button type="button" class="secondary" data-reveal="B">${state.revealB ? "Schnecke verbergen" : "Schnecke öffnen"}</button>
          </div>
          <div class="goat-stage">
            ${state.revealA ? roleCard("A", c.roleA) : `<div class="goat-card-placeholder role-a">${playerProfile("A", "Schwänli")}<h3>Schwänli wartet</h3><p>Öffnet diese Karte für die Person, die zuerst beobachtet und spricht.</p></div>`}
            ${state.revealB ? roleCard("B", c.roleB) : `<div class="goat-card-placeholder role-b">${playerProfile("B", "Schnecke")}<h3>Schnecke wartet</h3><p>Öffnet diese Karte für die Person, die nachfragt und die Wörter schärft.</p></div>`}
          </div>
        </div>
      ` : ""}
      ${active === "write" ? (state.revealA && state.revealB ? `<div class="panel stack"><p class="eyebrow">Gemeinsame Aufgabe</p><h2>${escapeHtml(c.teamTask)}</h2>${answerForm()}</div>` : `<div class="panel notice"><strong>Noch gesperrt.</strong><p>Öffne zuerst Schwänli und Schnecke im Bereich Geissenkarten. Danach erscheint hier die Schreibwerkstatt.</p></div>`) : ""}
      ${active === "path" ? chapterTabs() : ""}
      ${active === "log" ? journalPanel() : ""}
    </div>
  `;
}

function renderDemo() {
  state.mode = "demo";
  const c = chapter();
  const sections = [
    { id: "cards", label: "Geissenkarten" },
    { id: "write", label: "Schreibwerkstatt" },
    { id: "path", label: "Questpfad" },
    { id: "log", label: "Lernspur" },
    { id: "didactics", label: "Didaktik" }
  ];
  const active = activePlaySection(sections, "cards");
  app.innerHTML = html`
    ${topbar("demo")}
    <div class="play-layout">
      ${meadowUnderlay()}
      ${questStage(c, "Demomodus")}
      <div class="toolbar compact-actions">
        <button type="button" class="danger" data-reset-local>Aufgabe zurücksetzen</button>
      </div>
      ${playSectionMenu(sections, active)}
      ${active === "cards" ? html`
        <div class="goat-board panel stack">
          <div>
            <p class="eyebrow">Geissenkarten</p>
            <h2>Schwänli und Schnecke bringen zwei Hälften zusammen</h2>
          </div>
          ${goatCardGuide(true)}
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
      ${slateProgress(entries)}
      ${entries.length ? `<div class="journal-grid">${entries.map(renderJournalEntry).join("")}</div>` : `<p>Noch keine Einträge gespeichert.</p>`}
      <div class="toolbar">
        <button type="button" class="secondary" data-export-journal>Export</button>
        <button type="button" class="secondary" data-print>Drucken</button>
      </div>
    </div>
  `;
}

function solvedChapterIndexes(entries = journalEntries()) {
  const solvedKinds = new Set(["questantwort", "revision", "reflection"]);
  return [...new Set(entries
    .filter((entry) => solvedKinds.has(String(entry.kind || "")) && String(entry.text || "").trim())
    .map((entry) => Number(entry.chapterIndex))
    .filter((index) => Number.isInteger(index) && index >= 0))];
}

function slateProgress(entries = journalEntries()) {
  const solved = new Set(solvedChapterIndexes(entries));
  const total = state.content.chapters.length;
  return html`
    <figure class="slate-progress" aria-label="${solved.size} von ${total} Aufgaben gelöst">
      <div class="slate-pieces" style="--solved:${solved.size};--total:${total}">
        <video src="/heidi-game/assets/tafel-background.mp4" autoplay muted loop playsinline preload="metadata" aria-hidden="true"></video>
        ${state.content.chapters.map((item, index) => `<span class="slate-piece" aria-label="${escapeHtml(item.title)}" aria-current="${solved.has(index)}" title="${escapeHtml(item.title)}">${solved.has(index) ? index + 1 : ""}</span>`).join("")}
      </div>
      <figcaption>Heidi lernt die Stadt Frankfurt lesen, beschreibt Klara aber lieber die Alp</figcaption>
    </figure>
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
  const decision = qualityDecision(chapterData, "voice", text);
  const feedback = decision.feedback;
  const feedbackTarget = feedbackTargetForVoice(key);
  if (!decision.accepted) {
    if (feedbackTarget) feedbackTarget.innerHTML = qualityGateMarkup(decision);
    return;
  }
  const feedbackText = [
    feedback.title,
    `Spielreaktion: ${reactionText(feedback.reward || feedback.kick)}`,
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

async function saveChaosResponse(form) {
  const data = new FormData(form);
  const text = String(data.get("response") || "").trim();
  if (!text) return;
  const c = chapter();
  const chaos = currentChaos(c);
  const decision = qualityDecision(c, "questantwort", text);
  const feedbackTarget = form.querySelector("[data-save-feedback]");
  if (!decision.accepted) {
    if (feedbackTarget) feedbackTarget.innerHTML = qualityGateMarkup(decision);
    form.querySelector("textarea")?.focus();
    return;
  }
  if (feedbackTarget) feedbackTarget.innerHTML = "";
  const feedback = decision.feedback;
  const reaction = feedback.reward || feedback.kick;
  const entryText = [
    `Hauptauftrag: ${c.teamTask}`,
    `Störung: ${chaos.title}`,
    `Antwort: ${text}`,
    `Spielreaktion: ${reactionText(reaction)}`,
    `Feedback: ${feedback.strengths.join(" ")}`
  ].join("\n");

  if (state.mode === "partner" && state.room?.code) {
    state.room = (await api(`/api/rooms/${state.room.code}/submissions`, {
      method: "POST",
      body: JSON.stringify({ chapterIndex: state.chapterIndex, kind: "questantwort", role: "team", text: entryText, words: collectWords(text) })
    })).room;
  } else {
    saveLocalEntry({ chapterIndex: state.chapterIndex, kind: "questantwort", role: "team", text: entryText, words: collectWords(text) });
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
  if (button.dataset.chaos !== undefined) {
    const key = chaosKey();
    const options = questChaosOptions();
    const current = state.chaosEvents[key] ?? -1;
    let next = Math.floor(Math.random() * options.length);
    if (options.length > 1 && next === current) {
      next = (next + 1) % options.length;
    }
    state.chaosEvents[key] = next;
    renderCurrentMode();
  }
  if (button.dataset.showChaosExample !== undefined) {
    const drawer = button.closest("[data-example-drawer]");
    const paragraph = drawer?.querySelector("p");
    if (paragraph) paragraph.hidden = false;
    button.remove();
  }
  if (button.dataset.showAnswerHelp !== undefined) {
    const drawer = button.closest("[data-answer-help]");
    const help = drawer?.querySelector("div");
    if (help) help.hidden = false;
    button.remove();
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

  const chaosFormElement = event.target.closest("[data-chaos-form]");
  if (chaosFormElement && event.target.name === "response") {
    const feedbackTarget = chaosFormElement.querySelector("[data-save-feedback]");
    const text = event.target.value;
    if (!String(text || "").trim()) {
      if (feedbackTarget) feedbackTarget.innerHTML = "";
      return;
    }
    const decision = qualityDecision(chapter(), "questantwort", text);
    if (feedbackTarget) feedbackTarget.innerHTML = decision.accepted ? feedbackMarkup(chapter(), "questantwort", text) : qualityGateMarkup(decision);
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
  if (event.target.matches("[data-chaos-form]")) await saveChaosResponse(event.target);
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
