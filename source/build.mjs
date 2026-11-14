import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const here=path.dirname(fileURLToPath(import.meta.url));
const kit=path.resolve(process.env.TEARDOWN_SKILL||path.join(here,'../.deps/teardown'));
const out=path.resolve(process.env.PHE_OUT||path.join(here,'../dist'));
const staging=path.resolve(path.join(here,'../.build'));
fs.mkdirSync(out,{recursive:true});
execFileSync(process.execPath,[path.join(kit,'sims/build.mjs'),path.join(here,'viewer')],{
  env:{...process.env,TEARDOWN_OUT:staging},stdio:'inherit'
});
const license=['LICENSE','node_modules/three/LICENSE','node_modules/@fontsource-variable/inter/LICENSE','node_modules/@fontsource/jetbrains-mono/LICENSE'].map(f=>fs.readFileSync(path.join(kit,f),'utf8')).join('\n');
let page=fs.readFileSync(path.join(staging,'dist/viewer.html'),'utf8').replace('<html lang="en">','<html lang="zh-CN">')
  .replace('<title>viewer</title>','<title>可拆式板式换热器 · 结构与流道</title>')
  .replace('</body>','<!-- Third-party licenses\n'+license+'\n-->\n</body>');
fs.writeFileSync(path.join(out,'板式换热器_交互拆解.html'),page);
console.log('Offline HTML:',Buffer.byteLength(page),'bytes');
