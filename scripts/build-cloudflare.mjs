import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist-cloudflare");

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(path.join(dist, "data"), { recursive: true });
await fs.cp(path.join(root, "public/index.html"), path.join(dist, "index.html"));
await fs.cp(path.join(root, "public/heidi-game"), path.join(dist, "heidi-game"), { recursive: true });
await fs.copyFile(path.join(root, "data/heidi-game-content.json"), path.join(dist, "data/heidi-game-content.json"));

console.log("Built dist-cloudflare for Cloudflare Workers deployment.");
