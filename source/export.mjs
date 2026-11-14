import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)), kit=path.resolve(process.env.TEARDOWN_SKILL||path.join(here,'../.deps/teardown'));
const out=path.resolve(process.env.PHE_OUT||path.join(here,'../dist'));
const cache=path.resolve(here,'../.build/export-bundle.mjs');
fs.mkdirSync(path.dirname(cache),{recursive:true});fs.mkdirSync(out,{recursive:true});
const esbuild=createRequire(path.join(kit,'package.json'))('esbuild');
await esbuild.build({entryPoints:[path.join(here,'src/export.js')],outfile:cache,format:'esm',platform:'node',target:'node22',bundle:true,nodePaths:[path.join(kit,'node_modules')],logLevel:'warning'});
globalThis.FileReader=class FileReader {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
};
const {createAssets}=await import(pathToFileURL(cache));
const {binary,paths}=await createAssets();
fs.writeFileSync(path.join(out,'板式换热器_装配与动画.glb'),binary);
fs.writeFileSync(path.join(out,'流向路径.json'),JSON.stringify(paths));
console.log('GLB',binary.byteLength,'bytes;',paths.routes.length,'named lane paths');
