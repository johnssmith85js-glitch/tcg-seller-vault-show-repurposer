import tf from'@tensorflow/tfjs-node';
import mobilenet from'@tensorflow-models/mobilenet';
import sharp from'sharp';
import{mkdir,readFile,readdir,writeFile}from'node:fs/promises';
import{join}from'node:path';
import{EMBEDDING_DIM,EMBEDDING_INPUT_DIM,projectionMatrix,quantizeProjected}from'./embedding-projection.js';

const catalog=join(process.cwd(),'catalog'),shardDir=join(catalog,'shards'),outDir=join(catalog,'visual','embeddings');
const names=(await readdir(shardDir)).filter(name=>name.endsWith('.json')),items=new Map;
for(const name of names)for(const item of JSON.parse(await readFile(join(shardDir,name),'utf8')))if((item.p||[]).some(row=>Number(row.m)>=1))items.set(String(item.id),item);
await mkdir(outDir,{recursive:true});
const model=await mobilenet.load({version:2,alpha:.5}),projection=tf.tensor2d(projectionMatrix(),[EMBEDDING_INPUT_DIM,EMBEDDING_DIM]),rows=[...items.values()],ids=[],vectors=[];
let failed=0;
for(let start=0;start<rows.length;start+=16){
  const batch=rows.slice(start,start+16),images=[];
  for(const item of batch)try{const response=await fetch(`https://tcgplayer-cdn.tcgplayer.com/product/${item.id}_in_400x400.jpg`);if(!response.ok)throw new Error(String(response.status));const pixels=await sharp(Buffer.from(await response.arrayBuffer())).flatten({background:'#fff'}).resize(224,224,{fit:'fill'}).removeAlpha().raw().toBuffer();images.push({item,pixels})}catch{failed++}
  if(images.length){const bytes=new Uint8Array(Buffer.concat(images.map(row=>row.pixels))),input=tf.tensor4d(bytes,[images.length,224,224,3],'int32'),embedded=model.infer(input,true),projected=tf.matMul(embedded,projection),values=await projected.data();for(let i=0;i<images.length;i++){ids.push(Number(images[i].item.id));vectors.push(quantizeProjected(values.subarray(i*EMBEDDING_DIM,(i+1)*EMBEDDING_DIM)))}tf.dispose([input,embedded,projected])}
  if((start+batch.length)%512<16)console.log(`Artwork embeddings ${start+batch.length}/${rows.length}`);
}
projection.dispose();
const header=new Uint32Array([1,ids.length,EMBEDDING_DIM,EMBEDDING_INPUT_DIM]),idArray=Uint32Array.from(ids),vectorBytes=Buffer.concat(vectors.map(vector=>Buffer.from(vector.buffer,vector.byteOffset,vector.byteLength)));
await writeFile(join(outDir,'index.bin'),Buffer.concat([Buffer.from(header.buffer),Buffer.from(idArray.buffer),vectorBytes]));
await writeFile(join(outDir,'manifest.json'),JSON.stringify({version:1,model:'mobilenet-v2-alpha-0.5',dimensions:EMBEDDING_DIM,indexedProducts:ids.length,failedProducts:failed,generatedAt:new Date().toISOString()}));
console.log(`Embedding index contains ${ids.length}/${rows.length} eligible products.`);
