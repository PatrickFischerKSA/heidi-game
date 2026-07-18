import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const expectedOrder = [
  "huette-einrichten",
  "bett-im-heu",
  "peter-stellt-ziegen-vor",
  "ziegen-ansprechen",
  "alp-spricht",
  "almoehi-sprechen",
  "grossvater-arbeitet",
  "gewitter-kommt",
  "alpsegen-hoeren",
  "grossmutter-hoert",
  "peter-lernt-anders",
  "dorfschule-peter",
  "ankunft-frankfurt",
  "frankfurter-stimmen",
  "clara-kennenlernen",
  "rottenmeier-tisch",
  "sehnsucht-alp",
  "frankfurt-verlorene-stadt",
  "rueckkehr-alp",
  "clara-auf-der-alp",
  "peter-eifersucht",
  "ziegen-verloren",
  "heidi-erzaehlt-weiter",
  "schlusskreis"
];

test("orders quests as a coherent Heidi story arc", async () => {
  const content = JSON.parse(await readFile("data/heidi-game-content.json", "utf8"));
  assert.deepEqual(content.chapters.map((chapter) => chapter.id), expectedOrder);
});

test("keeps every quest connected to a journey phase, transition and Geiss disturbance", async () => {
  const content = JSON.parse(await readFile("data/heidi-game-content.json", "utf8"));
  const app = await readFile("public/heidi-game/app.js", "utf8");
  const ids = content.chapters.map((chapter) => chapter.id);

  for (const id of ids) {
    assert.ok(app.includes(`"${id}": "`), `${id} needs a transition line`);
    assert.ok(app.includes(`"${id}": [{`), `${id} needs a quest-specific Geiss disturbance`);
  }

  for (const id of ids) {
    assert.match(app, new RegExp(`ids: \\[[^\\]]*"${id}"`, "s"), `${id} needs a journey phase`);
  }
});
