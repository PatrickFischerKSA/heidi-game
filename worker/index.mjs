const ROLE_IDS = ["A", "B"];
const MAX_CHAPTER_INDEX = 5;

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {})
    }
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeRole(role) {
  const normalized = String(role || "").trim().toUpperCase();
  return ROLE_IDS.includes(normalized) ? normalized : "";
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 4; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function publicRoom(room) {
  return {
    code: room.code,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    chapterIndex: room.chapterIndex,
    roleReady: room.roleReady,
    occupiedRoles: {
      A: Boolean(room.roles.A),
      B: Boolean(room.roles.B)
    },
    submissions: room.submissions,
    journal: room.journal,
    eventVersion: room.eventVersion
  };
}

function makeEmptyRoom(code) {
  const now = new Date().toISOString();
  return {
    code,
    createdAt: now,
    updatedAt: now,
    chapterIndex: 0,
    roleReady: { A: false, B: false },
    roles: { A: null, B: null },
    submissions: [],
    journal: [],
    eventVersion: 1
  };
}

function touch(room) {
  room.updatedAt = new Date().toISOString();
  room.eventVersion += 1;
}

function errorResponse(status, code, message) {
  return json({ error: code, message }, { status });
}

async function loadRoom(storage, code) {
  return (await storage.get("room")) || null;
}

async function saveRoom(storage, room) {
  await storage.put("room", room);
}

export class RoomObject {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "get";
    const code = normalizeCode(url.searchParams.get("code"));
    let room = await loadRoom(this.ctx.storage, code);

    if (request.method === "POST" && action === "create") {
      if (room) {
        return errorResponse(409, "room_exists", "Dieser Raumcode ist bereits vergeben.");
      }
      room = makeEmptyRoom(code);
      await saveRoom(this.ctx.storage, room);
      return json(publicRoom(room), { status: 201 });
    }

    if (!room) {
      return errorResponse(404, "room_not_found", "Dieser Spielraum existiert nicht mehr.");
    }

    if (request.method === "GET" && action === "get") {
      return json(publicRoom(room));
    }

    const payload = await readJson(request);

    if (request.method === "POST" && action === "join") {
      const clientId = String(payload.clientId || crypto.randomUUID());
      let role = normalizeRole(payload.role);
      const reconnectRole = ROLE_IDS.find((candidate) => room.roles[candidate]?.clientId === clientId);

      if (reconnectRole) {
        room.roles[reconnectRole].lastSeenAt = new Date().toISOString();
        touch(room);
        await saveRoom(this.ctx.storage, room);
        return json({ room: publicRoom(room), role: reconnectRole, clientId });
      }

      if (!role) {
        role = ROLE_IDS.find((candidate) => !room.roles[candidate]) || "";
      }
      if (!role) {
        return errorResponse(409, "room_full", "Beide Rollen sind bereits belegt.");
      }
      if (room.roles[role]) {
        return errorResponse(409, "role_taken", `Rolle ${role} ist bereits belegt.`);
      }

      room.roles[role] = {
        clientId,
        joinedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString()
      };
      touch(room);
      await saveRoom(this.ctx.storage, room);
      return json({ room: publicRoom(room), role, clientId });
    }

    if (request.method === "POST" && action === "role-ready") {
      const role = normalizeRole(payload.role);
      if (!role) {
        return errorResponse(400, "invalid_role", "Die Rolle fehlt.");
      }
      room.roleReady[role] = Boolean(payload.ready);
      touch(room);
      await saveRoom(this.ctx.storage, room);
      return json(publicRoom(room));
    }

    if (request.method === "POST" && action === "submissions") {
      const text = String(payload.text || "").trim();
      if (!text) {
        return errorResponse(400, "empty_submission", "Die Antwort ist leer.");
      }
      const entry = {
        id: crypto.randomUUID(),
        chapterIndex: Number.isInteger(payload.chapterIndex) ? payload.chapterIndex : room.chapterIndex,
        kind: String(payload.kind || "first"),
        role: normalizeRole(payload.role) || "team",
        text,
        words: Array.isArray(payload.words) ? payload.words.map(String).filter(Boolean) : [],
        createdAt: new Date().toISOString()
      };
      room.submissions.push(entry);
      room.journal.push(entry);
      touch(room);
      await saveRoom(this.ctx.storage, room);
      return json({ room: publicRoom(room), entry });
    }

    if (request.method === "POST" && action === "chapter") {
      const chapterIndex = Number(payload.chapterIndex);
      if (!Number.isInteger(chapterIndex) || chapterIndex < 0 || chapterIndex > MAX_CHAPTER_INDEX) {
        return errorResponse(400, "invalid_chapter", "Dieses Kapitel gibt es im Prototyp nicht.");
      }
      room.chapterIndex = chapterIndex;
      room.roleReady = { A: false, B: false };
      touch(room);
      await saveRoom(this.ctx.storage, room);
      return json(publicRoom(room));
    }

    if (request.method === "POST" && action === "reset") {
      const chapterIndex = Number.isInteger(payload.chapterIndex) ? payload.chapterIndex : null;
      if (chapterIndex === null) {
        room.submissions = [];
        room.journal = [];
      } else {
        room.submissions = room.submissions.filter((entry) => entry.chapterIndex !== chapterIndex);
        room.journal = room.journal.filter((entry) => entry.chapterIndex !== chapterIndex);
      }
      room.roleReady = { A: false, B: false };
      touch(room);
      await saveRoom(this.ctx.storage, room);
      return json(publicRoom(room));
    }

    return errorResponse(404, "not_found", "Unbekannte Raumaktion.");
  }
}

function roomStub(env, code) {
  const id = env.ROOMS.idFromName(code);
  return env.ROOMS.get(id);
}

async function proxyRoom(request, env, code, action) {
  const url = new URL(request.url);
  url.search = new URLSearchParams({ code, action }).toString();
  return roomStub(env, code).fetch(new Request(url, request));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/api/health") {
      return json({ ok: true, app: "heidi-worte", runtime: "cloudflare-workers" });
    }

    if (pathname === "/api/content") {
      const assetUrl = new URL("/data/heidi-game-content.json", url.origin);
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }

    if (pathname === "/api/rooms" && request.method === "POST") {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const code = makeCode();
        const created = await proxyRoom(new Request(request.url, { method: "POST", body: "{}" }), env, code, "create");
        if (created.status === 201) {
          return created;
        }
      }
      return errorResponse(503, "room_code_failed", "Es konnte kein Raumcode erzeugt werden.");
    }

    const roomMatch = pathname.match(/^\/api\/rooms\/([A-Z0-9]+)(?:\/([^/]+))?$/i);
    if (roomMatch) {
      const code = normalizeCode(roomMatch[1]);
      const subroute = roomMatch[2] || "get";
      const actionMap = {
        get: "get",
        join: "join",
        "role-ready": "role-ready",
        submissions: "submissions",
        chapter: "chapter",
        reset: "reset"
      };
      const action = actionMap[subroute];
      if (!action) {
        return errorResponse(404, "not_found", "Unbekannter API-Pfad.");
      }
      return proxyRoom(request, env, code, action);
    }

    return env.ASSETS.fetch(request);
  }
};
