import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "data/heidi-game-content.json");
const targetDir = path.join(root, "public/data");
const target = path.join(targetDir, "heidi-game-content.json");

await fs.mkdir(targetDir, { recursive: true });
await fs.copyFile(source, target);
console.log(`Synced ${path.relative(root, source)} -> ${path.relative(root, target)}`);
