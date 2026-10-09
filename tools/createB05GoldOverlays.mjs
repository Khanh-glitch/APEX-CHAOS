#!/usr/bin/env node
// ONE-TIME B0.5 source overlay creation from clean R90 builder and the
// semantically merged Q5+R90 artifacts. The overlays are committed and become
// fail-closed, inspectable source data for future generator revisions.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const overlays=path.join(REPO,'tools','goldB05Overlays');
const hud='public/gold/battle-hud.html',shell='public/gold/shell.html';
const content=(name)=>fs.readFileSync(path.join(REPO,name),'utf8');
const targets=new Map([[hud,content(hud)],[shell,content(shell)]]);
const regex=/(<script id="battleHudPayload" type="text\/plain">)([\s\S]*?)(<\/script>)/;
const sentinel='__B05_EMBEDDED_HUD_FROM_CURRENT_CANONICAL_SOURCE__';
function mask(text){
 if(!regex.test(text))throw Error('Missing canonical Shell payload');
 return text.replace(regex,(_,a,b,c)=>a+sentinel+c);
}
function run(cmd,args){
 const p=spawnSync(cmd,args,{cwd:REPO,encoding:'utf8',maxBuffer:32*1024*1024});
 if(p.status!==0)throw Error(cmd+' '+args.join(' ')+' exit='+p.status+'\n'+p.stderr+'\n'+p.stdout.slice(-3200));
 return p.stdout;
}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'b05-patchgen-'));
try{
 run(process.execPath,['tools/buildGoldCutover.mjs']);
 const generators=new Map([[hud,content(hud)],[shell,content(shell)]]);
 fs.mkdirSync(overlays,{recursive:true});
 for(const target of [hud,shell]){
  let old=generators.get(target),desired=targets.get(target);
  if(target===shell){old=mask(old);desired=mask(desired);}
  const a=path.join(temp,'base.html'),b=path.join(temp,'target.html');
  fs.writeFileSync(a,old);fs.writeFileSync(b,desired);
  const diff=spawnSync('diff',['-U','3','--label','a/'+target,'--label','b/'+target,a,b],
    {cwd:REPO,encoding:'utf8',maxBuffer:32*1024*1024});
  if(diff.status!==0&&diff.status!==1)throw Error('diff failed: '+diff.stderr);
  if(diff.status!==1)throw Error('Unexpected identical Gold '+target+'; confirm whether overlay is still needed');
  const patch='diff --git a/'+target+' b/'+target+'\n'+diff.stdout;
  fs.writeFileSync(path.join(overlays,path.basename(target)+'.patch'),patch,'utf8');
  console.log('B05_PATCH_CREATED '+target+' '+patch.length+' bytes');
 }
 run(process.execPath,['tools/buildGoldCutover.mjs']);
 for(const target of [hud,shell]){
  if(content(target)!==targets.get(target))
   throw Error('B05 generator overlay does not reproduce reviewed '+target);
  console.log('B05_REGENERATED_EQUALS_MERGED '+target+' TRUE');
 }
 run(process.execPath,['tools/buildGoldCutover.mjs','--check']);
 console.log('B05_CUTOVER_REPRODUCIBLE PASS');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
