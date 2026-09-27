import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{groupDetections}from'../analyzer.js';
import{differenceHash,hashBands,hashDistance}from'../visual-hash.js';

const match=(game,name,score=.95)=>({score,item:{id:`${game}-${name}`,game,n:name,k:name.toLowerCase(),p:[{m:2}]}});

test('mixed TCG cards with the same name stay separate',()=>{
  const groups=groupDetections([
    {time:1,match:match('Magic','Renewal'),cardCandidates:[]},
    {time:1.4,match:match('Magic','Renewal'),cardCandidates:[]},
    {time:4,match:match('Sorcery','Renewal'),cardCandidates:[]},
    {time:4.4,match:match('Sorcery','Renewal'),cardCandidates:[]}
  ]);
  assert.equal(groups.length,2);
  assert.deepEqual(groups.map(group=>group.match.item.game),['Magic','Sorcery']);
});

test('recognition source is card-only and has no stream-context lock',async()=>{
  const source=await readFile(new URL('../analyzer.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/contextTextSheet|contextLines|Reading stream context|inferScope|scope\.game|cardRegion/);
  assert.match(source,/extractCardRegions/);
  assert.match(source,/candidateMode:true/);
});

test('recognition handles vertically stretched stream cards',async()=>{
  const [vision,source]=await Promise.all([
    readFile(new URL('../card-vision.js',import.meta.url),'utf8'),
    readFile(new URL('../analyzer.js',import.meta.url),'utf8')
  ]);
  assert.match(vision,/2\.5,2\.8/);
  assert.match(source,/bands=\[\.12,\.18,\.25\]/);
});

test('recognition reads only the physical-card reveal area',async()=>{
  const source=await readFile(new URL('../analyzer.js',import.meta.url),'utf8');
  assert.match(source,/portrait\?\.28:\.22/);
  assert.match(source,/portrait\?\.27:\.16/);
  assert.match(source,/cardTextSheet\(frame,regions\)/);
  assert.doesNotMatch(source,/contextTextSheet|contextLines|inferScope/);
});

test('artwork matching leads and OCR only resolves uncertainty',async()=>{
  const source=await readFile(new URL('../analyzer.js',import.meta.url),'utf8');
  const visual=source.indexOf('await matchCardArtwork(row.cardHashes)');
  const ocr=source.indexOf('await matchLines(row.lines.slice(0,60)');
  assert.ok(visual>0&&ocr>visual);
  assert.match(source,/if\(clearVisual\)\{row\.matches=visual;return\}/);
  assert.match(source,/Matching card artwork/);
});

test('64-bit artwork fingerprints provide stable bands and distance',()=>{
  const pixels=Uint8Array.from({length:72},(_,index)=>index%9);
  const hash=differenceHash(pixels);
  assert.match(hash,/^[0-9a-f]{16}$/);
  assert.equal(hashBands(hash).length,8);
  assert.equal(hashDistance(hash,hash),0);
  assert.equal(hashDistance('0000000000000000','ffffffffffffffff'),64);
});
