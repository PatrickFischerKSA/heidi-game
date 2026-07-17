const app = document.querySelector("#app");
const storage = {
  clientId: "heidi.clientId",
  journal: "heidi.localJournal",
  teacher: "heidi.teacherSettings"
};

const state = {
  content: null,
  mode: new URLSearchParams(location.search).get("mode") || routeMode(),
  room: null,
  role: null,
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
    ...options,
    headers: {
      "Content-Type": "application/json",
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
          <p>Laptop als Spielleitung, zwei Handys mit komplementären Rolleninformationen.</p>
          <button type="button" data-start-room>Spielraum eröffnen</button>
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

async function startRoom() {
  const room = await api("/api/rooms", { method: "POST", body: "{}" });
  state.mode = "partner";
  state.room = room;
  state.chapterIndex = room.chapterIndex;
  renderPartner();
  startPolling();
}

function joinAddress() {
  const url = new URL("/join", location.origin);
  url.searchParams.set("code", state.room?.code || "");
  return url.toString();
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
        <div class="panel">
          <h2>Raumcode</h2>
          <div class="code-box"><div class="room-code">${escapeHtml(state.room?.code || "----")}</div></div>
          <p class="small">Beitrittsadresse: <strong>${escapeHtml(joinAddress())}</strong></p>
          <div class="qr-placeholder" aria-label="Stilisierter QR-Platzhalter"></div>
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
  app.innerHTML = html`
    ${topbar("phone")}
    <section class="phone-frame stack">
      <div>
        <p class="eyebrow">Handyansicht</p>
        <h1>Rolle beitreten</h1>
      </div>
      <form class="stack" data-join-form>
        <label>Raumcode<input name="code" value="${escapeHtml(code)}" maxlength="6" required></label>
        <label>Rolle<select name="role"><option value="">automatisch</option><option value="A">A - Wahrnehmen</option><option value="B">B - Versprachlichen</option></select></label>
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
          <label>Anzahl Kapitel<input type="number" min="1" max="6" name="chapterCount" value="${escapeHtml(state.teacher.chapterCount)}"></label>
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
