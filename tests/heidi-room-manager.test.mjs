import test from "node:test";
import assert from "node:assert/strict";
import { createRoomManager } from "../src/services/heidi-room-manager.mjs";

test("creates temporary rooms with public state", () => {
  const manager = createRoomManager();
  const room = manager.createRoom();

  assert.match(room.code, /^[A-Z2-9]{4,6}$/);
  assert.equal(room.chapterIndex, 0);
  assert.deepEqual(room.occupiedRoles, { A: false, B: false });
});

test("assigns unique roles and prevents accidental double occupation", () => {
  const manager = createRoomManager();
  const room = manager.createRoom();

  const first = manager.joinRoom(room.code, { role: "A", clientId: "phone-a" });
  assert.equal(first.role, "A");
  assert.equal(first.room.occupiedRoles.A, true);

  assert.throws(
    () => manager.joinRoom(room.code, { role: "A", clientId: "phone-b" }),
    /bereits belegt/
  );

  const second = manager.joinRoom(room.code, { role: "B", clientId: "phone-b" });
  assert.equal(second.role, "B");
});

test("allows reconnection with the same client id", () => {
  const manager = createRoomManager();
  const room = manager.createRoom();

  manager.joinRoom(room.code, { role: "A", clientId: "phone-a" });
  const rejoined = manager.joinRoom(room.code, { role: "A", clientId: "phone-a" });

  assert.equal(rejoined.role, "A");
  assert.equal(rejoined.clientId, "phone-a");
});

test("stores first draft, revision and reflection in the journal", () => {
  const manager = createRoomManager();
  const room = manager.createRoom();

  manager.addSubmission(room.code, {
    chapterIndex: 0,
    kind: "first",
    text: "Die Geiss steht am Felsen.",
    words: ["Geiss", "Felsen"]
  });
  manager.addSubmission(room.code, {
    chapterIndex: 0,
    kind: "revision",
    text: "Die Geiss sucht Schutz am Felsen, weil Wind aufkommt."
  });

  const updated = manager.getRoom(room.code);
  assert.equal(updated.journal.length, 2);
  assert.equal(updated.journal[0].kind, "first");
  assert.equal(updated.journal[1].kind, "revision");
});

test("chapter changes reset role readiness but keep journal", () => {
  const manager = createRoomManager();
  const room = manager.createRoom();

  manager.markRoleReady(room.code, { role: "A", ready: true });
  manager.addSubmission(room.code, { text: "Eine Lernspur bleibt erhalten." });
  const changed = manager.setChapter(room.code, { chapterIndex: 2 });

  assert.equal(changed.chapterIndex, 2);
  assert.deepEqual(changed.roleReady, { A: false, B: false });
  assert.equal(changed.journal.length, 1);
});

test("ending a room makes its code unusable", () => {
  const manager = createRoomManager();
  const room = manager.createRoom();

  manager.joinRoom(room.code, { role: "A", clientId: "phone-a" });
  const ended = manager.endRoom(room.code);

  assert.deepEqual(ended, { code: room.code, ended: true });
  assert.equal(manager.getRoom(room.code), null);
  assert.throws(
    () => manager.joinRoom(room.code, { role: "B", clientId: "phone-b" }),
    /existiert nicht mehr/
  );
});
