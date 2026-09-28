import{execFile as execFileCallback}from'node:child_process';import{cp,mkdir,readFile,rm,writeFile}from'node:fs/promises';import{join}from'node:path';import{promisify}from'node:util';import{generateScopeIndex}from'./scope-index.mjs';
const root=process.cwd(),out=join(root,'_site'),files=['index.html','styles.css','app.js','analyzer.js','card-vision.js','feature-matcher.js','embedding-matcher.js','embedding-projection.js','visual-hash.js','catalog-client.js','isolation.js','isolation-worker.js','default-logo.png','catalog'];
await generateScopeIndex(join(root,'catalog'));
const visualBundle=join(root,'catalog','visual-index.tar.gz');await rm(visualBundle,{force:true});await promisify(execFileCallback)('tar',['-czf',visualBundle,'-C',join(root,'catalog'),'visual']);
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});for(const file of files)await cp(join(root,file),join(out,file),{recursive:true});await mkdir(join(out,'vendor'),{recursive:true});await cp(join(root,'node_modules/jsfeat/build/jsfeat-min.js'),join(out,'vendor/jsfeat-min.js'));
const version=(process.env.GITHUB_SHA||Date.now().toString(36)).slice(0,12),versioned=['index.html','app.js','analyzer.js','card-vision.js','isolation.js'];
for(const file of versioned){const path=join(out,file),source=await readFile(path,'utf8'),updated=source.replace(/\?v=[a-z0-9]+/gi,`?v=${version}`);await writeFile(path,updated)}
const indexPath=join(out,'index.html'),index=await readFile(indexPath,'utf8');await writeFile(indexPath,index.replace('href="styles.css"',`href="styles.css?v=${version}"`));
console.log(`Static site ready in _site (${version})`);
