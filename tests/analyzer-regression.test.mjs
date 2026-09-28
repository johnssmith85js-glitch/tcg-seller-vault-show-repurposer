import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{cardIdentityName,chooseRecognitionMatches,groupDetections}from'../analyzer.js';
import{descriptorTokens}from'../feature-matcher.js';
import{differenceHash,hashBands,hashDistance,hashProjections}from'../visual-hash.js';

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

test('recognition searches plausible distorted card shapes',async()=>{
  const [vision,source]=await Promise.all([
    readFile(new URL('../card-vision.js',import.meta.url),'utf8'),
    readFile(new URL('../analyzer.js',import.meta.url),'utf8')
  ]);
  assert.match(vision,/1\.9,2\.2/);
  assert.match(vision,/expandedCrop/);
  assert.match(source,/bands=\[\.12,\.18,\.25\]/);
});

test('recognition reads only detector-isolated cards',async()=>{
  const source=await readFile(new URL('../analyzer.js',import.meta.url),'utf8');
  assert.match(source,/cardTextSheet\(regions\)/);
  assert.doesNotMatch(source,/drawImage\(frame/);
  assert.doesNotMatch(source,/revealHeight|portrait\?\.28:\.22|portrait\?\.27:\.16/);
  assert.doesNotMatch(source,/contextTextSheet|contextLines|inferScope/);
});

test('artwork matching leads while strong card text vetoes a wrong TCG collision',async()=>{
  const source=await readFile(new URL('../analyzer.js',import.meta.url),'utf8');
  const visual=source.indexOf('await matchCardFeatures(row.cardCandidates)');
  const ocr=source.indexOf('await matchLines(row.lines.slice(0,60)');
  assert.ok(visual>0&&ocr>visual);
  assert.match(source,/features\.length\?features:await matchCardArtwork/);
  const wrong=[{...match('Flesh & Blood TCG','False Match',.8),support:2}];
  const right=[match('Magic: The Gathering','Bloodline Bidding',.96)];
  assert.deepEqual(chooseRecognitionMatches(wrong,right),right);
  assert.match(source,/Matching card artwork/);
});

test('one artwork collision cannot decide a card identity',()=>{
  const collision=[{...match('Flesh & Blood TCG','False Match',.84),support:1}];
  assert.deepEqual(chooseRecognitionMatches(collision,[]),[]);
});

test('a strong multiword OCR shortlist can reach artwork verification',()=>{
  const likely=[match('Magic','Bloodline Bidding',.74)];
  const unrelated=[match('Flesh & Blood TCG','Blood Tribute',.6)];
  assert.deepEqual(chooseRecognitionMatches([],likely.concat(unrelated)),likely);
});

test('one-word OCR noise cannot decide identity without artwork agreement',()=>{
  const noise=[match('Bakugan TCG','CEE',1)];
  assert.deepEqual(chooseRecognitionMatches([],noise),[]);
  const agreed=[{...match('Bakugan TCG','CEE',.8),support:3}];
  assert.deepEqual(chooseRecognitionMatches(agreed,noise),agreed);
});

test('reused artwork keeps every printing of the recognized card',()=>{
  const first={...match('Magic: The Gathering','Bloodline Bidding',.91),support:3,item:{...match('Magic: The Gathering','Bloodline Bidding').item,id:'one',set:'Odyssey'}};
  const second={...match('Magic: The Gathering','Bloodline Bidding',.9),support:3,item:{...match('Magic: The Gathering','Bloodline Bidding').item,id:'two',set:'Mystery Booster'}};
  const other={...match('Flesh & Blood TCG','False Match',.77),support:2};
  assert.deepEqual(chooseRecognitionMatches([first,second,other],[]),[first,second]);
});

test('art variants share one base card identity',()=>{
  assert.equal(cardIdentityName({name:'Bloodline Bidding (Showcase) (Fracture Foil)'}),'bloodline bidding');
});

test('catalog-wide local descriptors produce deterministic bounded lookup tokens',()=>{
  const data=Uint8Array.from({length:96},(_,index)=>(index*37+11)%256),features={count:3,data};
  const first=descriptorTokens(features),second=descriptorTokens(features);
  assert.deepEqual(first,second);
  assert.equal(first.length,4);
  assert.ok(first.every(table=>table.length>0&&table.every(token=>token>=0&&token<4096)));
});

test('recognized base identity expands to all catalog printings before finish review',async()=>{
  const [analyzer,catalog,build]=await Promise.all([
    readFile(new URL('../analyzer.js',import.meta.url),'utf8'),
    readFile(new URL('../catalog-client.js',import.meta.url),'utf8'),
    readFile(new URL('../build-visual-index.mjs',import.meta.url),'utf8')
  ]);
  assert.match(analyzer,/await identityPrintings\(recognized\)/);
  assert.match(catalog,/candidate\.game===item\.game/);
  assert.match(build,/version:4/);
  assert.match(build,/features\/table-/);
});

test('64-bit artwork fingerprints provide stable bands and distance',()=>{
  const pixels=Uint8Array.from({length:72},(_,index)=>index%9);
  const hash=differenceHash(pixels);
  assert.match(hash,/^[0-9a-f]{16}$/);
  assert.equal(hashBands(hash).length,8);
  assert.equal(hashDistance(hash,hash),0);
  assert.equal(hashDistance('0000000000000000','ffffffffffffffff'),64);
});

test('cross-image projections recover a near artwork with no exact byte band',()=>{
  const query='b9f1a9ac0c8cdcca',reference='b499f9bcbe8eaecc';
  assert.equal(hashBands(query).filter((band,index)=>band===hashBands(reference)[index]).length,0);
  assert.ok(hashProjections(query).some((key,index)=>key===hashProjections(reference)[index]));
  assert.equal(hashDistance(query,reference),20);
});
