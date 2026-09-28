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
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(url);
    if (response.ok) return response;
    if (response.status === 404) return response;
    if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 750 * (attempt + 1)));
    else throw new Error(`Catalog download failed (${response.status}): ${url}`);
  }
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
    const response = await fetchRequired(`${base}/shards/${encodeURIComponent(key)}.json`);
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`Shard download failed (${response.status}): ${key}`);
    await writeFile(join(out, "shards", `${key}.json`), Buffer.from(await response.arrayBuffer()));
    copied++;
  }
}

await Promise.all(Array.from({ length: 8 }, worker));
if (copied < 100) throw new Error(`Only ${copied} catalog shards were recovered; refusing to deploy.`);
console.log(`Reused ${copied} catalog shards from the current production deployment.`);

const visualManifestResponse=await fetchRequired(`${base}/visual/manifest.json`);
if(visualManifestResponse.ok){
  const manifest=await visualManifestResponse.json();
  if(Number(manifest.version||0)<4){
    console.log('Production artwork index needs catalog-wide local features; rebuilding it now.');
    await import('./build-visual-index.mjs');
    process.exit(0);
  }
  await mkdir(join(out,'visual'),{recursive:true});
  await writeFile(join(out,'visual','manifest.json'),JSON.stringify(manifest));
  let visualNext=0,visualCopied=0;
  async function visualWorker(){while(visualNext<manifest.files.length){const file=manifest.files[visualNext++],response=await fetchRequired(`${base}/visual/${file}`);if(!response.ok)throw new Error(`Visual index file missing: ${file}`);const path=join(out,'visual',file);await mkdir(join(path,'..'),{recursive:true});await writeFile(path,Buffer.from(await response.arrayBuffer()));visualCopied++}}
  await Promise.all(Array.from({length:12},visualWorker));
  console.log(`Reused ${visualCopied} visual-index files.`);
  if(Number(manifest.version||0)<3){
    console.log('Adding tolerant artwork projections to the production index.');
    await import('./build-visual-projections.mjs');
  }
}else{
  console.log('Production has no visual index; building the initial artwork index now.');
  await import('./build-visual-index.mjs');
}
