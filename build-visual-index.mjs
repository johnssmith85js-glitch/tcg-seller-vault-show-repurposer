import sharp from'sharp';
import{mkdir,readFile,readdir,rm,writeFile}from'node:fs/promises';
import{join}from'node:path';
import{differenceHash,hashBands}from'./visual-hash.js';

const root=process.cwd(),catalog=join(root,'catalog'),out=join(catalog,'visual'),shardDir=join(catalog,'shards');
const names=(await readdir(shardDir)).filter(name=>name.endsWith('.json')),items=new Map;
for(const name of names){for(const item of JSON.parse(await readFile(join(shardDir,name),'utf8'))){
  if(!(item.p||[]).some(row=>Number(row.m)>=1))continue;
  items.set(String(item.id),item);
}}

await rm(out,{recursive:true,force:true});
await mkdir(join(out,'bands'),{recursive:true});await mkdir(join(out,'items'),{recursive:true});
const bands=Array.from({length:8},()=>new Map),itemBuckets=new Map,rows=[...items.values()];
let next=0,done=0,failed=0;
async function worker(){while(next<rows.length){const item=rows[next++],id=String(item.id);try{
  const response=await fetch(`https://tcgplayer-cdn.tcgplayer.com/product/${id}_in_400x400.jpg`);
  if(!response.ok)throw new Error(String(response.status));
  const{data,info}=await sharp(Buffer.from(await response.arrayBuffer())).trim({threshold:10}).flatten({background:'#ffffff'}).greyscale().resize(9,8,{fit:'fill'}).raw().toBuffer({resolveWithObject:true});
  const hash=differenceHash(data,info.width,info.height);hashBands(hash).forEach((key,index)=>{if(!bands[index].has(key))bands[index].set(key,[]);bands[index].get(key).push([hash,id])});
  const bucket=(Number(item.id)%64).toString(16).padStart(2,'0');if(!itemBuckets.has(bucket))itemBuckets.set(bucket,[]);itemBuckets.get(bucket).push(item);
}catch{failed++}finally{done++;if(done%1000===0)console.log(`Artwork fingerprints ${done}/${rows.length}`)}}}
await Promise.all(Array.from({length:12},worker));
const files=[];for(let index=0;index<bands.length;index++){for(const[key,value]of bands[index]){const file=`bands/${index}-${key}.json`;await writeFile(join(out,file),JSON.stringify(value));files.push(file)}}
for(const[key,value]of itemBuckets){const file=`items/${key}.json`;await writeFile(join(out,file),JSON.stringify(value));files.push(file)}
await writeFile(join(out,'manifest.json'),JSON.stringify({version:2,generatedAt:new Date().toISOString(),eligibleProducts:rows.length,indexedProducts:rows.length-failed,failedProducts:failed,files}));
console.log(`Visual index contains ${rows.length-failed}/${rows.length} eligible products.`);
