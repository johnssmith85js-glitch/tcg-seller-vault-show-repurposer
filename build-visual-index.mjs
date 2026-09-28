import sharp from'sharp';
import jsfeat from'jsfeat';
import{mkdir,readFile,readdir,rm,writeFile}from'node:fs/promises';
import{join}from'node:path';
import{differenceHash,hashBands,hashProjections}from'./visual-hash.js';

const root=process.cwd(),catalog=join(root,'catalog'),out=join(catalog,'visual'),shardDir=join(catalog,'shards');
function featureTokens(data,width,height){const gray=new jsfeat.matrix_t(width,height,jsfeat.U8_t|jsfeat.C1_t);gray.data.set(data);const corners=Array.from({length:width*height},()=>new jsfeat.keypoint_t(0,0,0,0,0));jsfeat.fast_corners.set_threshold(20);const count=jsfeat.fast_corners.detect(gray,corners,16),chosen=corners.slice(0,count).sort((a,b)=>b.score-a.score).slice(0,24);for(const corner of chosen)corner.angle=0;const descriptors=new jsfeat.matrix_t(32,chosen.length,jsfeat.U8_t|jsfeat.C1_t);jsfeat.orb.describe(gray,chosen,chosen.length,descriptors);const out=Array.from({length:4},()=>new Set);for(let row=0;row<chosen.length;row++)for(let table=0;table<4;table++){let token=0;for(let bit=0;bit<12;bit++){const position=(table*53+bit*17)%256,byte=descriptors.data[row*32+(position>>3)];token|=((byte>>(position&7))&1)<<bit}out[table].add(token)}return out}
const names=(await readdir(shardDir)).filter(name=>name.endsWith('.json')),items=new Map;
for(const name of names){for(const item of JSON.parse(await readFile(join(shardDir,name),'utf8'))){
  if(!(item.p||[]).some(row=>Number(row.m)>=1))continue;
  items.set(String(item.id),item);
}}

await rm(out,{recursive:true,force:true});
await mkdir(join(out,'bands'),{recursive:true});await mkdir(join(out,'projections'),{recursive:true});await mkdir(join(out,'features'),{recursive:true});await mkdir(join(out,'items'),{recursive:true});
const bands=Array.from({length:8},()=>new Map),projections=Array.from({length:16},()=>new Map),featureBuckets=Array.from({length:4},()=>Array.from({length:4096},()=>[])),itemBuckets=new Map,rows=[...items.values()];
let next=0,done=0,failed=0;
async function worker(){while(next<rows.length){const item=rows[next++],id=String(item.id);try{
  const response=await fetch(`https://tcgplayer-cdn.tcgplayer.com/product/${id}_in_400x400.jpg`);
  if(!response.ok)throw new Error(String(response.status));
  const image=Buffer.from(await response.arrayBuffer()),{data,info}=await sharp(image).trim({threshold:10}).flatten({background:'#ffffff'}).greyscale().resize(9,8,{fit:'fill'}).raw().toBuffer({resolveWithObject:true});
  const hash=differenceHash(data,info.width,info.height);hashBands(hash).forEach((key,index)=>{if(!bands[index].has(key))bands[index].set(key,[]);bands[index].get(key).push([hash,id])});
  hashProjections(hash).forEach((key,index)=>{if(!projections[index].has(key))projections[index].set(key,[]);projections[index].get(key).push([hash,id])});
  const featureImage=await sharp(image).trim({threshold:10}).flatten({background:'#ffffff'}).greyscale().resize(286,400,{fit:'fill'}).raw().toBuffer({resolveWithObject:true});featureTokens(featureImage.data,featureImage.info.width,featureImage.info.height).forEach((tokens,table)=>tokens.forEach(token=>featureBuckets[table][token].push(Number(id))));
  const bucket=(Number(item.id)%64).toString(16).padStart(2,'0');if(!itemBuckets.has(bucket))itemBuckets.set(bucket,[]);itemBuckets.get(bucket).push(item);
}catch{failed++}finally{done++;if(done%1000===0)console.log(`Artwork fingerprints ${done}/${rows.length}`)}}}
await Promise.all(Array.from({length:12},worker));
const files=[];for(let index=0;index<bands.length;index++){for(const[key,value]of bands[index]){const file=`bands/${index}-${key}.json`;await writeFile(join(out,file),JSON.stringify(value));files.push(file)}}
for(let index=0;index<projections.length;index++){for(const[key,value]of projections[index]){const file=`projections/${index}-${key}.json`;await writeFile(join(out,file),JSON.stringify(value));files.push(file)}}
for(let table=0;table<featureBuckets.length;table++){const buckets=featureBuckets[table],offsets=new Uint32Array(4097);let total=0;for(let token=0;token<4096;token++){offsets[token]=total;total+=buckets[token].length}offsets[4096]=total;const ids=new Uint32Array(total);let cursor=0;for(const bucket of buckets)for(const id of bucket)ids[cursor++]=id;const file=`features/table-${table}.bin`,header=Buffer.from(offsets.buffer),body=Buffer.from(ids.buffer);await writeFile(join(out,file),Buffer.concat([header,body]));files.push(file)}
for(const[key,value]of itemBuckets){const file=`items/${key}.json`;await writeFile(join(out,file),JSON.stringify(value));files.push(file)}
await writeFile(join(out,'manifest.json'),JSON.stringify({version:4,generatedAt:new Date().toISOString(),eligibleProducts:rows.length,indexedProducts:rows.length-failed,failedProducts:failed,files}));
console.log(`Visual index contains ${rows.length-failed}/${rows.length} eligible products.`);
