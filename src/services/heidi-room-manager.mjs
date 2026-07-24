import { randomBytes } from "node:crypto";

const ROLE_IDS = ["A", "B"];
const MAX_CHAPTER_INDEX = 5;

function makeCode(existingCodes) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    let code = "";
    for (let index = 0; index < 4; index += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    if (!existingCodes.has(code)) {
      return code;
    }
  }
  return randomBytes(3).toString("hex").toUpperCase();
}

function appError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
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

function touch(room) {
  room.updatedAt = new Date().toISOString();
  room.eventVersion += 1;
}

function normalizeRole(role) {
  const normalized = String(role || "").trim().toUpperCase();
  return ROLE_IDS.includes(normalized) ? normalized : "";
}

function validateRoom(rooms, code) {
  const room = rooms.get(String(code || "").trim().toUpperCase());
  if (!room) {
    throw appError(404, "room_not_found", "Dieser Spielraum existiert nicht mehr.");
  }
  return room;
}

export function createRoomManager() {
  const rooms = new Map();

  return {
    createRoom() {
      const code = makeCode(rooms);
      const room = makeEmptyRoom(code);
      rooms.set(code, room);
      return publicRoom(room);
    },

    getRoom(code) {
      const room = rooms.get(String(code || "").trim().toUpperCase());
      return room ? publicRoom(room) : null;
    },

    joinRoom(code, payload) {
      const room = validateRoom(rooms, code);
      const clientId = String(payload.clientId || randomBytes(6).toString("hex"));
      let role = normalizeRole(payload.role);

      const reconnectRole = ROLE_IDS.find((candidate) => room.roles[candidate]?.clientId === clientId);
      if (reconnectRole) {
        room.roles[reconnectRole].lastSeenAt = new Date().toISOString();
        touch(room);
        return { room: publicRoom(room), role: reconnectRole, clientId };
      }

      if (!role) {
        role = ROLE_IDS.find((candidate) => !room.roles[candidate]) || "";
      }

      if (!role) {
        throw appError(409, "room_full", "Beide Rollen sind bereits belegt.");
      }

      if (room.roles[role]) {
        throw appError(409, "role_taken", `Rolle ${role} ist bereits belegt.`);
      }

      room.roles[role] = {
        clientId,
        joinedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString()
      };
      touch(room);
      return { room: publicRoom(room), role, clientId };
    },

    markRoleReady(code, payload) {
      const room = validateRoom(rooms, code);
      const role = normalizeRole(payload.role);
      if (!role) {
        throw appError(400, "invalid_role", "Die Rolle fehlt.");
      }
      room.roleReady[role] = Boolean(payload.ready);
      touch(room);
      return publicRoom(room);
    },

    addSubmission(code, payload) {
      const room = validateRoom(rooms, code);
      const chapterIndex = Number.isInteger(payload.chapterIndex) ? payload.chapterIndex : room.chapterIndex;
      const kind = String(payload.kind || "first");
      const text = String(payload.text || "").trim();
      if (!text) {
        throw appError(400, "empty_submission", "Die Antwort ist leer.");
      }

      const entry = {
        id: randomBytes(6).toString("hex"),
        chapterIndex,
        kind,
        role: normalizeRole(payload.role) || "team",
        text,
        words: Array.isArray(payload.words) ? payload.words.map(String).filter(Boolean) : [],
        createdAt: new Date().toISOString()
      };
      room.submissions.push(entry);
      room.journal.push(entry);
      touch(room);
      return { room: publicRoom(room), entry };
    },

    setChapter(code, payload) {
      const room = validateRoom(rooms, code);
      const chapterIndex = Number(payload.chapterIndex);
      if (!Number.isInteger(chapterIndex) || chapterIndex < 0 || chapterIndex > MAX_CHAPTER_INDEX) {
        throw appError(400, "invalid_chapter", "Dieses Kapitel gibt es im Prototyp nicht.");
      }
      room.chapterIndex = chapterIndex;
      room.roleReady = { A: false, B: false };
      touch(room);
      return publicRoom(room);
    },

    resetRoom(code, payload) {
      const room = validateRoom(rooms, code);
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
      return publicRoom(room);
    },

    endRoom(code) {
      const normalized = String(code || "").trim().toUpperCase();
      const room = validateRoom(rooms, normalized);
      touch(room);
      rooms.delete(normalized);
      return { code: normalized, ended: true };
    }
  };
}
