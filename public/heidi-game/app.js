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
  pollTimer: null
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
          <p>Hauptcomputer als Spielleitung, zwei Handys mit QR-Codes für die Rollen.</p>
          <form class="host-login" data-host-login>
            <label>Hauptcomputer<input name="hostName" value="${escapeHtml(state.hostName)}" placeholder="z. B. Klasse 2b oder Lehrperson" required></label>
            <button type="submit">Spielraum eröffnen</button>
          </form>
        </article>
        <article class="card">
          <h2>Desktopmodus</h2>
          <p>Zwei Personen spielen an einem Bildschirm. Rollenkarten werden nacheinander freigegeben.</p>
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

function qrCard(role, title, subtitle) {
  const url = joinAddress(role);
  return html`
    <article class="qr-card role-${role.toLowerCase()}">
      <div>
        <p class="eyebrow">${escapeHtml(title)}</p>
        <h3>Rolle ${escapeHtml(role)}</h3>
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
  app.innerHTML = html`
    ${topbar("partner")}
    <div class="layout">
      <section class="stack">
        <div class="panel">
          <p class="eyebrow">Laptop-Spielleitung</p>
          <h1>${escapeHtml(c.title)}</h1>
          <p>${escapeHtml(c.laptopFrame)}</p>
          ${historicalNote(c)}
          ${sceneMedia(c)}
        </div>
        ${chapterTabs()}
        ${statusStrip()}
        ${teamTaskPanel()}
      </section>
      <aside class="stack">
        <div class="panel stack">
          <div>
            <p class="eyebrow">Hauptcomputer</p>
            <h2>${escapeHtml(state.hostName)}</h2>
            <p>Handys scannen ihren Rollen-Code. Der Raumcode bleibt nur als Reserve sichtbar: <strong>${escapeHtml(state.room?.code || "----")}</strong></p>
          </div>
          <div class="qr-grid">
            ${qrCard("A", "Handy 1", "Beobachten, sprechen, erste Rolle")}
            ${qrCard("B", "Handy 2", "Wortmaterial, nachfragen, zweite Rolle")}
          </div>
        </div>
        ${journalPanel()}
      </aside>
    </div>
  `;
}

function chapterTabs() {
  return html`
    <div class="panel">
      <div class="chapter-tabs" aria-label="Kapitel">
        ${state.content.chapters.map((item, index) => `<button type="button" data-chapter="${index}" aria-current="${index === state.chapterIndex}">${index + 1}</button>`).join("")}
      </div>
    </div>
  `;
}

function statusStrip() {
  const occupied = state.room?.occupiedRoles || {};
  const ready = state.room?.roleReady || {};
  return html`
    <div class="status-strip">
      <div class="status-item"><strong>Rolle A</strong><br>${occupied.A ? "verbunden" : "wartet"} · ${ready.A ? "ausgetauscht" : "noch geheim"}</div>
      <div class="status-item"><strong>Rolle B</strong><br>${occupied.B ? "verbunden" : "wartet"} · ${ready.B ? "ausgetauscht" : "noch geheim"}</div>
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
              ${media.audio?.src ? `<button type="button" class="secondary" data-toggle-scene-audio>${escapeHtml(media.audio.label || "Audio einschalten")}</button><audio src="${escapeHtml(media.audio.src)}" preload="metadata"></audio>` : ""}
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
    <div class="panel stack">
      <p class="eyebrow">Gemeinsame Aufgabe</p>
      ${bothReady ? `<h2>${escapeHtml(c.teamTask)}</h2>${answerForm()}` : `<div class="notice"><strong>Noch gesperrt.</strong><p>Die Aufgabe erscheint, sobald beide Rollen ihre Beobachtungen ausgetauscht und auf dem Handy bestätigt haben.</p></div>`}
    </div>
  `;
}

function answerForm(prefill = "") {
  const c = chapter();
  return html`
    <form class="stack" data-answer-form>
      <label>Erste Formulierung<textarea name="first" required>${escapeHtml(prefill)}</textarea></label>
      <div class="feedback-box"><strong>Hinweis statt Richtig-falsch:</strong><p>${escapeHtml(c.hint)}</p></div>
      <label>Überarbeitete Fassung<textarea name="revision" required></textarea></label>
      <label>Kurze Reflexion<textarea name="reflection" required placeholder="${escapeHtml(c.reflection)}"></textarea></label>
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

  if (state.mode === "partner") {
    for (const [kind, text] of entries) {
      await api(`/api/rooms/${state.room.code}/submissions`, {
        method: "POST",
        body: JSON.stringify({ chapterIndex: state.chapterIndex, kind, text, role: "team", words: collectWords(text) })
      });
    }
    state.room = await api(`/api/rooms/${state.room.code}`);
    renderPartner();
    return;
  }

  for (const [kind, text] of entries) {
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
        <h1>Rolle beitreten</h1>
      </div>
      <form class="stack" data-join-form>
        <label>Raumcode<input name="code" value="${escapeHtml(code)}" maxlength="6" required></label>
        <label>Rolle<select name="role"><option value="">automatisch</option><option value="A" ${role === "A" ? "selected" : ""}>A - Wahrnehmen</option><option value="B" ${role === "B" ? "selected" : ""}>B - Versprachlichen</option></select></label>
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
      <p class="eyebrow">Raum ${escapeHtml(state.room.code)} · Rolle ${escapeHtml(role)}</p>
      <h1>${escapeHtml(roleData.name)}</h1>
      ${roleCard(role, roleData)}
      ${voiceQuestPanel(role, c)}
      <button type="button" data-ready="${role}" ${voiceComplete ? "" : "disabled"}>${state.room.roleReady?.[role] ? "Austausch bestätigt" : "Ich habe meine Informationen geteilt"}</button>
      <div class="notice"><p>${needsVoice ? "Diese Rolle muss zuerst den mündlichen Beitrag per Handy-Mikrofon festhalten." : "Sprich mit der Partnerperson."} Auf dem Laptop wird die Schreibaufgabe erst nach beiden Bestätigungen freigeschaltet.</p></div>
    </section>
  `;
}

function roleCard(role, roleData) {
  return html`
    <article class="role-card role-${role.toLowerCase()}">
      <h2>Rolle ${escapeHtml(role)}: ${escapeHtml(roleData.name)}</h2>
      <p>${escapeHtml(roleData.prompt)}</p>
      <ul class="token-list">${roleData.tokens.map((token) => `<li>${escapeHtml(token)}</li>`).join("")}</ul>
    </article>
  `;
}

function renderDesktop() {
  state.mode = "desktop";
  const c = chapter();
  app.innerHTML = html`
    ${topbar("desktop")}
    <div class="layout">
      <section class="stack">
        <div class="panel">
          <p class="eyebrow">Desktopmodus</p>
          <h1>${escapeHtml(c.title)}</h1>
          <p>${escapeHtml(c.laptopFrame)}</p>
          ${historicalNote(c)}
          ${sceneMedia(c)}
        </div>
        ${chapterTabs()}
        <div class="panel stack">
          <h2>Rollenkarten nacheinander öffnen</h2>
          <div class="toolbar">
            <button type="button" class="secondary" data-reveal="A">${state.revealA ? "Rolle A verbergen" : "Rolle A öffnen"}</button>
            <button type="button" class="secondary" data-reveal="B">${state.revealB ? "Rolle B verbergen" : "Rolle B öffnen"}</button>
          </div>
          <div class="chapter-grid">
            ${state.revealA ? roleCard("A", c.roleA) : `<div class="card"><h3>Rolle A ist verdeckt</h3><p>Eine Person liest zuerst die andere Karte nicht mit.</p></div>`}
            ${state.revealB ? roleCard("B", c.roleB) : `<div class="card"><h3>Rolle B ist verdeckt</h3><p>Öffnet diese Karte erst nach dem Rollenwechsel.</p></div>`}
          </div>
        </div>
        ${(state.revealA && state.revealB) ? `<div class="panel stack"><p class="eyebrow">Gemeinsame Aufgabe</p><h2>${escapeHtml(c.teamTask)}</h2>${answerForm()}</div>` : ""}
      </section>
      <aside>${journalPanel()}</aside>
    </div>
  `;
}

function renderDemo() {
  state.mode = "demo";
  const c = chapter();
  app.innerHTML = html`
    ${topbar("demo")}
    <div class="layout">
      <section class="stack">
        <div class="panel">
          <p class="eyebrow">Demomodus</p>
          <h1>${escapeHtml(c.title)}</h1>
          <p>${escapeHtml(c.laptopFrame)}</p>
          ${historicalNote(c)}
          ${sceneMedia(c)}
          <div class="toolbar">
            <button type="button" class="secondary" data-toggle-didactics>${state.showDidactics ? "Didaktik ausblenden" : "Didaktik einblenden"}</button>
            <button type="button" class="danger" data-reset-local>Aufgabe zurücksetzen</button>
          </div>
        </div>
        ${chapterTabs()}
        <div class="phone-sim-grid">
          <div class="phone-frame">${roleCard("A", c.roleA)}${voiceQuestPanel("A", c)}</div>
          <div class="phone-frame">${roleCard("B", c.roleB)}${voiceQuestPanel("B", c)}</div>
        </div>
        <div class="panel stack">
          <p class="eyebrow">Laptop nach Rollenaustausch</p>
          <h2>${escapeHtml(c.teamTask)}</h2>
          ${answerForm(c.example)}
        </div>
        ${state.showDidactics ? didacticsPanel() : ""}
      </section>
      <aside>${journalPanel()}</aside>
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
        <p>Die Aufgaben, Hinweise, Rolleninformationen und Beispielantworten liegen in <strong>data/heidi-game-content.json</strong> und können ohne Programmlogik angepasst werden.</p>
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
        <p>Jedes Kapitel enthält: id, title, place, languageGoal, laptopFrame, roleA, roleB, teamTask, hint, revisionPrompt, example und reflection. Die Spiellogik liest diese Felder generisch aus.</p>
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
    <div class="panel stack">
      <h2>Lernspur</h2>
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
  return html`
    <article class="journal-entry">
      <strong>${escapeHtml(item.title || "Kapitel")} · ${escapeHtml(entry.kind)}</strong>
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
  } else {
    saveLocalEntry({ chapterIndex: Number(chapterIndex), kind: "voice", role, text, words: collectWords(text) });
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
  if (button.dataset.startRoom !== undefined) await startRoom();
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
      if (audio.paused) {
        await audio.play();
        button.textContent = "Audio pausieren";
      } else {
        audio.pause();
        button.textContent = button.textContent.includes("Alpsegen") ? button.textContent : "Audio fortsetzen";
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
  if (!transcript) return;
  state.voiceDrafts[transcript.dataset.voiceTranscript] = transcript.value;
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
