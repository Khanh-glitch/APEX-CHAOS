#!/usr/bin/env node
// B0.5 specific true 3-way Shell conflict resolver.
// Never chooses an entire side. Treat generated Base64 Battle HUD as an opaque
// derived artifact, merge the authored shell, then embed the exact merged HUD.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';

const shell='public/gold/shell.html';
const hud='public/gold/battle-hud.html';
const root=process.cwd();
const get=(stage)=>execFileSync('git',['show',':'+stage+':'+shell],{encoding:'utf8',maxBuffer:12*1024*1024});
const marker='__B05_CANONICAL_GOLD_BATTLE_HUD_BASE64_PLACEHOLDER__';
const re=/(<script id="battleHudPayload" type="text\/plain">)([\s\S]*?)(<\/script>)/g;
function strip(label,s){
 let n=0;
 const out=s.replace(re,(_,start,old,end)=>{n++;return start+marker+end;});
 if(n!==1)throw Error(label+': expected exactly 1 generated payload, got '+n);
 return out;
}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'apex-b05-'));
const names=['base','ours','theirs'].map(label=>path.join(temp,'gold-shell-'+label+'.html'));
try{
 fs.writeFileSync(names[0],strip('base',get(1)));
 fs.writeFileSync(names[1],strip('ours',get(2)));
 fs.writeFileSync(names[2],strip('theirs',get(3)));
 const merged=spawnSync('git',['merge-file','--diff3','-p',names[1],names[0],names[2]],{encoding:'utf8',maxBuffer:20*1024*1024});
 fs.writeFileSync('reports/integration-b05/shell-merge-staged.txt',merged.stdout||'');
 fs.writeFileSync('reports/integration-b05/shell-merge-stderr.txt',merged.stderr||'');
 if(merged.status!==0||merged.stdout.includes('<<<<<<<'))
   throw Error('authored shell has independent unresolved conflicts (exit='+merged.status+')');
 const target=fs.readFileSync(hud,'utf8');
 if(!target.includes('quest')&&!target.includes('QUEST'))throw Error('merged authored HUD may be missing Quest content; manual audit required');
 let n=0;
 const result=merged.stdout.replace(re,(_,open,payload,close)=>{
   if(payload!==marker)throw Error('shell placeholder mutated');
   n++;
   return open+Buffer.from(target,'utf8').toString('base64')+close;
 });
 if(n!==1)throw Error('post-merge shell has '+n+' payload occurrences');
 fs.writeFileSync(shell,result,'utf8');
 execFileSync('git',['add',shell,hud],{stdio:'inherit'});
 const match=result.match(re);
 if(!match||!match[0])throw Error('payload missing after embedding');
 const encoded=match[0].slice(match[0].indexOf('>')+1,match[0].lastIndexOf('</script>'));
 if(Buffer.from(encoded,'base64').toString('utf8')!==target)throw Error('embedded HUD byte mismatch');
 const unmerged=execFileSync('git',['ls-files','-u'],{encoding:'utf8'});
 if(unmerged.trim())throw Error('unresolved Git entries: '+unmerged);
 console.log('B05_RESOLVED authored Shell without selecting an entire branch');
 console.log('B05_GOLD_PAYLOAD_EQUALS_CANONICAL_HUD true');
 console.log('B05_SHELL_BYTES '+Buffer.byteLength(result));
 console.log('B05_HUD_BYTES '+Buffer.byteLength(target));
}catch(error){console.error('B05_RESOLUTION_FAILED',error.stack||error);process.exitCode=1}
finally{fs.rmSync(temp,{recursive:true,force:true})}
