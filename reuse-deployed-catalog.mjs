import { mkdir, rm, writeFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const execFile=promisify(execFileCallback);

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
  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await fetch(url);
    if (response.ok) return response;
    if (response.status === 404) return response;
    if (attempt < 9) {
      const retryAfter=Number(response.headers.get('retry-after'))*1000;
      const delay=Number.isFinite(retryAfter)&&retryAfter>0?retryAfter:Math.min(30000,1000*2**attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
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

const visualBundleResponse=await fetchRequired(`${base}/visual-index.tar.gz`);
if(visualBundleResponse.ok){
  const bundlePath=join(out,'visual-index.tar.gz');
  await writeFile(bundlePath,Buffer.from(await visualBundleResponse.arrayBuffer()));
  await execFile('tar',['-xzf',bundlePath,'-C',out]);
  await rm(bundlePath,{force:true});
  console.log('Reused the packaged production visual index.');
}else{
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
  // The first bundle-enabled deployment must recover the legacy loose-file
  // index. Keep concurrency deliberately low so GitHub Pages does not answer
  // thousands of requests with HTTP 429.
  await Promise.all(Array.from({length:2},visualWorker));
  console.log(`Reused ${visualCopied} visual-index files.`);
  const embeddingManifestResponse=await fetchRequired(`${base}/visual/embeddings/manifest.json`);
  if(embeddingManifestResponse.ok){
    const embeddingManifest=await embeddingManifestResponse.json(),embeddingIndexResponse=await fetchRequired(`${base}/visual/embeddings/index.bin`);
    if(!embeddingIndexResponse.ok)throw new Error('Production embedding index is incomplete.');
    const embeddingDir=join(out,'visual','embeddings');await mkdir(embeddingDir,{recursive:true});
    await writeFile(join(embeddingDir,'manifest.json'),JSON.stringify(embeddingManifest));
    await writeFile(join(embeddingDir,'index.bin'),Buffer.from(await embeddingIndexResponse.arrayBuffer()));
    console.log(`Reused ${embeddingManifest.indexedProducts||0} artwork embeddings.`);
  }else{
    console.log('Production has no embedding index; building the initial artwork embedding index now.');
    await import('./build-embedding-index.mjs');
  }
  if(Number(manifest.version||0)<3){
    console.log('Adding tolerant artwork projections to the production index.');
    await import('./build-visual-projections.mjs');
  }
}else{
  console.log('Production has no visual index; building the initial artwork index now.');
  await import('./build-visual-index.mjs');
}
}
