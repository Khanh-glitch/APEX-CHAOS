#!/usr/bin/env node
/**
 * FROST V1 Git durability checkpoint.
 *
 * --probe   Verify remote auth/read access for CURRENT Arena session branch.
 * --push    Require clean tree, push local HEAD to CURRENT arena/* branch,
 *           verify remote SHA == local HEAD, and persist that SHA locally.
 * --recover Emit local recovery bundle/patches relative to the last verified
 *           remote SHA. This is secondary protection only.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args=new Set(process.argv.slice(2));
const run=(cmd,a=[],opts={})=>execFileSync(cmd,a,{
  encoding:opts.encoding===null?null:'utf8',
  stdio:opts.stdio||['ignore','pipe','pipe'],
});
const textRun=(cmd,a=[])=>String(run(cmd,a)).trim();
const fail=(msg)=>{console.error('[FROST DURABILITY] FAIL:',msg);process.exit(1);};

const branch=textRun('git',['branch','--show-current']);
if(!branch.startsWith('arena/')) fail('Current branch must be Arena-assigned arena/*, got '+branch);
const local=textRun('git',['rev-parse','HEAD']);
const gitDir=textRun('git',['rev-parse','--git-dir']);
const marker=join(gitDir,'FROST_LAST_REMOTE_VERIFIED');

function readMarker(){ try{return readFileSync(marker,'utf8').trim();}catch{return '';} }
function writeMarker(sha){ writeFileSync(marker,sha+'\n','utf8'); }
function remoteSha(){
  const out=textRun('git',['ls-remote','origin','refs/heads/'+branch]);
  return out?out.split(/\s+/)[0]:'';
}
function recover(){
  const last=readMarker();
  const dir=join(gitDir,'frost-recovery');
  mkdirSync(dir,{recursive:true});
  const stamp=local.slice(0,12);
  const info={branch,localHead:local,lastVerifiedRemote:last||null,files:[]};

  if(last && last!==local){
    try{
      const bundle=join(dir,'FROST_'+stamp+'.bundle');
      run('git',['bundle','create',bundle,last+'..'+local]);
      info.files.push(bundle);
    }catch(e){ console.error('[FROST DURABILITY] bundle warning:',e.message); }
    try{
      const patch=run('git',['format-patch','--stdout',last+'..'+local],{encoding:null});
      const path=join(dir,'FROST_'+stamp+'.format.patch');
      writeFileSync(path,patch); info.files.push(path);
    }catch(e){ console.error('[FROST DURABILITY] format-patch warning:',e.message); }
  }

  try{
    const wt=run('git',['diff','--binary','HEAD'],{encoding:null});
    if(wt.length){ const p=join(dir,'FROST_'+stamp+'.working.patch'); writeFileSync(p,wt); info.files.push(p); }
    const st=run('git',['diff','--binary','--cached','HEAD'],{encoding:null});
    if(st.length){ const p=join(dir,'FROST_'+stamp+'.staged.patch'); writeFileSync(p,st); info.files.push(p); }
  }catch(e){ console.error('[FROST DURABILITY] dirty-patch warning:',e.message); }

  const meta=join(dir,'FROST_'+stamp+'.json');
  writeFileSync(meta,JSON.stringify(info,null,2)+'\n','utf8'); info.files.push(meta);
  console.error('[FROST DURABILITY] LOCAL RECOVERY ONLY:',JSON.stringify(info,null,2));
  return info;
}

if(args.has('--recover')){ recover(); process.exit(0); }

let before='';
try{ before=remoteSha(); }
catch(e){ recover(); fail('Remote authentication/read failed. STOP implementation until credentials are restored.'); }

if(args.has('--probe')){
  console.log('[FROST DURABILITY] auth/read PASS');
  console.log('[FROST DURABILITY] branch:',branch);
  console.log('[FROST DURABILITY] local:',local);
  console.log('[FROST DURABILITY] remote:',before||'(branch not yet created)');
  if(before===local) writeMarker(local);
  process.exit(0);
}

if(args.has('--push')){
  const dirty=textRun('git',['status','--porcelain']);
  if(dirty) fail('Working tree is dirty. Commit the coherent checkpoint before --push.');
  try{
    run('git',['push','origin','HEAD:refs/heads/'+branch],{stdio:['ignore','inherit','inherit']});
  }catch(e){ recover(); fail('Push failed. STOP implementation; recovery artifacts emitted locally.'); }
  let after='';
  try{ after=remoteSha(); }
  catch(e){ recover(); fail('Push returned but remote verification failed. STOP implementation.'); }
  if(after!==local){ recover(); fail('Remote SHA '+after+' does not match local HEAD '+local+'. STOP implementation.'); }
  writeMarker(local);
  console.log('[FROST DURABILITY] REMOTE VERIFIED:',local);
  process.exit(0);
}

fail('Choose one mode: --probe, --push, or --recover');
