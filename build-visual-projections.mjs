import{mkdir,readFile,writeFile}from'node:fs/promises';
import{join}from'node:path';
import{hashProjections}from'./visual-hash.js';

const root=join(process.cwd(),'catalog','visual'),manifestPath=join(root,'manifest.json');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const rows=new Map;
for(const file of manifest.files.filter(file=>file.startsWith('bands/0-')))for(const[hash,id]of JSON.parse(await readFile(join(root,file),'utf8')))rows.set(String(id),[hash,String(id)]);
const projections=Array.from({length:16},()=>new Map);
for(const[hash,id]of rows.values())hashProjections(hash).forEach((key,index)=>{if(!projections[index].has(key))projections[index].set(key,[]);projections[index].get(key).push([hash,id])});
await mkdir(join(root,'projections'),{recursive:true});
const files=[];
for(let index=0;index<projections.length;index++)for(const[key,value]of projections[index]){const file=`projections/${index}-${key}.json`;await writeFile(join(root,file),JSON.stringify(value));files.push(file)}
manifest.version=3;manifest.files=[...manifest.files.filter(file=>!file.startsWith('projections/')),...files];
await writeFile(manifestPath,JSON.stringify(manifest));
console.log(`Added ${files.length} tolerant artwork projection buckets for ${rows.size} products.`);
