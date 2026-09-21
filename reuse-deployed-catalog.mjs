import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const base = (process.env.CATALOG_BASE_URL ||
  "https://johnssmith85js-glitch.github.io/tcg-seller-vault-show-repurposer/catalog")
  .replace(/\/$/, "");
const out = join(process.cwd(), "catalog");
const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
const keys = [
  ...characters,
  ...[...characters].flatMap(first => [...` ${characters}`].map(second => first + second))
];

async function fetchRequired(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Catalog download failed (${response.status}): ${url}`);
  return response;
}

await rm(out, { recursive: true, force: true });
await mkdir(join(out, "shards"), { recursive: true });

const manifestResponse = await fetchRequired(`${base}/manifest.json`);
await writeFile(join(out, "manifest.json"), Buffer.from(await manifestResponse.arrayBuffer()));

let next = 0;
let copied = 0;
async function worker() {
  while (next < keys.length) {
    const key = keys[next++];
    const response = await fetch(`${base}/shards/${encodeURIComponent(key)}.json`);
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`Shard download failed (${response.status}): ${key}`);
    await writeFile(join(out, "shards", `${key}.json`), Buffer.from(await response.arrayBuffer()));
    copied++;
  }
}

await Promise.all(Array.from({ length: 24 }, worker));
if (copied < 100) throw new Error(`Only ${copied} catalog shards were recovered; refusing to deploy.`);
console.log(`Reused ${copied} catalog shards from the current production deployment.`);
