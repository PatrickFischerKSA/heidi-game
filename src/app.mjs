import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRoomManager } from "./services/heidi-room-manager.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");
const contentPath = path.resolve(__dirname, "../data/heidi-game-content.json");

export function createApp() {
  const app = express();
  const rooms = createRoomManager();

  app.use(express.json({ limit: "512kb" }));
  app.use(express.static(publicDir, { extensions: ["html"] }));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true, app: "heidi-worte" });
  });

  app.get("/api/content", async (_request, response) => {
    const rawContent = await fs.readFile(contentPath, "utf8");
    response.type("json").send(rawContent);
  });

  app.post("/api/rooms", (_request, response) => {
    const room = rooms.createRoom();
    response.status(201).json(room);
  });

  app.get("/api/rooms/:code", (request, response) => {
    const room = rooms.getRoom(request.params.code);
    if (!room) {
      response.status(404).json({ error: "room_not_found" });
      return;
    }

    response.json(room);
  });

  app.post("/api/rooms/:code/join", (request, response) => {
    try {
      const joined = rooms.joinRoom(request.params.code, request.body || {});
      response.json(joined);
    } catch (error) {
      response.status(error.status || 400).json({ error: error.code || "join_failed", message: error.message });
    }
  });

  app.post("/api/rooms/:code/role-ready", (request, response) => {
    try {
      response.json(rooms.markRoleReady(request.params.code, request.body || {}));
    } catch (error) {
      response.status(error.status || 400).json({ error: error.code || "ready_failed", message: error.message });
    }
  });

  app.post("/api/rooms/:code/submissions", (request, response) => {
    try {
      response.json(rooms.addSubmission(request.params.code, request.body || {}));
    } catch (error) {
      response.status(error.status || 400).json({ error: error.code || "submit_failed", message: error.message });
    }
  });

  app.post("/api/rooms/:code/chapter", (request, response) => {
    try {
      response.json(rooms.setChapter(request.params.code, request.body || {}));
    } catch (error) {
      response.status(error.status || 400).json({ error: error.code || "chapter_failed", message: error.message });
    }
  });

  app.post("/api/rooms/:code/reset", (request, response) => {
    try {
      response.json(rooms.resetRoom(request.params.code, request.body || {}));
    } catch (error) {
      response.status(error.status || 400).json({ error: error.code || "reset_failed", message: error.message });
    }
  });

  app.get(["/", "/join", "/desktop", "/demo", "/teacher"], (_request, response) => {
    response.sendFile(path.join(publicDir, "index.html"));
  });

  return app;
}
