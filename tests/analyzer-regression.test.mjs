import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{groupDetections}from'../analyzer.js';

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
