#!/usr/bin/env node
// APEX CHAOS V4.3 — fail-closed branch cleanup planner.
// Defaults to READ ONLY. Apply mode requires explicit confirmation and never
// touches diverged, open-PR, protected, default or canonical development refs.
import fs from 'node:fs';
import {execFileSync, spawnSync} from 'node:child_process';

const inventoryPath='docs/maintenance/V43_BRANCH_INVENTORY_2026-10-10.json';
const audit=JSON.parse(fs.readFileSync(inventoryPath,'utf8'));
const args=process.argv.slice(2);
const apply=args.includes('--apply');
const confirm=args.includes('--confirm=DELETE-VERIFIED-ANCESTORS');
const maxFlag=args.find(x=>x.startsWith('--limit='));
const limit=maxFlag?Number(maxFlag.slice(8)):5;
if(apply&&!confirm)throw Error('Deletion disabled: --confirm=DELETE-VERIFIED-ANCESTORS required');
if(!Number.isInteger(limit)||limit<1||limit>20)throw Error('--limit must be integer 1..20');
if(!/^[-\w]+\/[-\w]+$/.test(audit.repo))throw Error('Invalid fixed repository');
const base='repos/'+audit.repo+'/';
const json=(path)=>{
  const out=execFileSync('gh',['api',base+path],{encoding:'utf8',maxBuffer:32*1024*1024});
  return JSON.parse(out);
};
const paged=(segment)=>{
  const out=[];
  for(let page=1;page<=20;page++){
    const chunk=json(segment+(segment.includes('?')?'&':'?')+'per_page=100&page='+page);
    if(!Array.isArray(chunk))throw Error('Expected GitHub API array for '+segment);
    out.push(...chunk);
    if(chunk.length<100)return out;
  }
  throw Error('Pagination exceeded safe maximum for '+segment);
};
const branchList=paged('branches');
const live=new Map(branchList.map(x=>[x.name,x]));
const fixed=live.get(audit.canonicalDevelopment);
if(!fixed||fixed.commit.sha!==audit.canonicalSha){
  throw Error('V43 SHA MOVED: cleanup blocked until a fresh audit');
}
const openPRs=paged('pulls?state=open&');
const prRefs=new Set(openPRs.flatMap(p=>[p.head?.ref,p.base?.ref]).filter(Boolean));
const workflowDir='.github/workflows';
const workflowSources=fs.readdirSync(workflowDir)
  .filter(n=>/\.ya?ml$/i.test(n))
  .map(n=>({path:workflowDir+'/'+n,body:fs.readFileSync(workflowDir+'/'+n,'utf8')}));
function isAncestor(candidate,anchor){
  const proc=spawnSync('git',['merge-base','--is-ancestor',candidate,anchor],
    {stdio:'ignore'});
  if(proc.error||proc.status===null||proc.status>1)
    throw Error('Local complete git history required; cannot verify '+candidate);
  return proc.status===0;
}
const ready=[],blocked=[];
for(const old of audit.branches){
  const now=live.get(old.name);
  const reasons=[];
  if(old.role!=='ancestor-review-candidate')reasons.push('reserved-role:'+old.role);
  if(!now)reasons.push('branch-missing');
  else {
    if(now.commit.sha!==old.sha)reasons.push('sha-drift');
    if(now.protected||old.protected)reasons.push('protected');
  }
  if(prRefs.has(old.name))reasons.push('live-open-PR');
  if(old.name===audit.canonicalDevelopment||old.name==='main')reasons.push('core-ref');
  if(workflowSources.some(w=>w.body.includes(old.name)))reasons.push('workflow-reference');
  // History comparisons happen only when every cheaper live guard passed.
  if(reasons.length===0&&!isAncestor(old.sha,audit.canonicalSha))
    reasons.push('not-an-ancestor');
  if(reasons.length)blocked.push({name:old.name,reasons});
  else ready.push({name:old.name,sha:old.sha});
}
const plan={mode:apply?'APPLY':'DRY_RUN',repo:audit.repo,
  anchor:{branch:audit.canonicalDevelopment,sha:audit.canonicalSha},
  scanned:branchList.length,candidates:ready.length,blocked:blocked.length,
  deleteLimit:apply?limit:0,ready,blocked};
process.stdout.write(JSON.stringify(plan,null,2)+'\n');
if(!apply){
  console.log('READ ONLY: zero refs deleted. External deploy and branch-policy review required before apply.');
  process.exit(0);
}
if(!ready.length){console.log('Nothing eligible.');process.exit(0);}
const todo=ready.slice(0,limit);
for(const branch of todo){
  // Revalidate live branch head, protection, all open PRs and Git ancestry at
  // the instant of each deletion. No force update, no rewrite and no fallback.
  const detail=json('branches/'+branch.name);
  if(detail.name!==branch.name||detail.commit.sha!==branch.sha||detail.protected)
    throw Error('Branch drift/protection: '+branch.name);
  const prsNow=paged('pulls?state=open&');
  if(prsNow.some(p=>p.head?.ref===branch.name||p.base?.ref===branch.name))
    throw Error('New PR dependency: '+branch.name);
  if(!isAncestor(branch.sha,audit.canonicalSha))
    throw Error('No longer an ancestor: '+branch.name);
  if(workflowSources.some(w=>w.body.includes(branch.name)))
    throw Error('Active workflow dependency: '+branch.name);
  if(!/^[a-zA-Z0-9._/-]+$/.test(branch.name))
    throw Error('Unexpected ref characters');
  execFileSync('gh',['api','-X','DELETE',base+'git/refs/heads/'+branch.name],
    {stdio:'inherit'});
  console.log('DELETED verified ancestor '+branch.name+' at '+branch.sha);
}
console.log('Batch complete: '+todo.length+' refs; re-run dry-run and verify workflows before another batch.');
