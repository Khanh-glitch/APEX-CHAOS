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
const allowFlag=args.find(x=>x.startsWith('--approved-sha-file='));
const limit=maxFlag?Number(maxFlag.slice(8)):5;
if(apply&&!confirm)throw Error('Deletion disabled: --confirm=DELETE-VERIFIED-ANCESTORS required');
if(apply&&!allowFlag)throw Error('Deletion disabled: an independently reviewed --approved-sha-file is required');
if(!Number.isInteger(limit)||limit<1||limit>20)throw Error('--limit must be integer 1..20');
if(!/^[-\w]+\/[-\w]+$/.test(audit.repo))throw Error('Invalid fixed repository');
const base='repos/'+audit.repo+'/';
// This file is intentionally not included in the repo. Each requested ref must
// be independently approved by exact SHA after deployment/rollback review.
let approvals=null;
if(apply){
  const file=allowFlag.slice('--approved-sha-file='.length);
  if(!file||!fs.existsSync(file))throw Error('Missing external reviewed approval file');
  approvals=JSON.parse(fs.readFileSync(file,'utf8'));
  if(approvals.repo!==audit.repo||approvals.canonicalSha!==audit.canonicalSha
    ||approvals.reviewedExternalDeployments!==true
    ||typeof approvals.approvedBy!=='string'||!approvals.approvedBy.trim()
    ||!Array.isArray(approvals.branches)||!approvals.branches.length)
    throw Error('Invalid or unreviewed external SHA allowlist');
  if(approvals.branches.some(b=>!b||typeof b.name!=='string'||!/^[0-9a-f]{40}$/.test(b.sha)))
    throw Error('Approval entries require name and 40-character exact SHA');
  const keys=approvals.branches.map(b=>b.name+'@'+b.sha);
  if(new Set(keys).size!==keys.length)throw Error('Duplicate approved refs');
  approvals.shaSet=new Set(keys);
}
const json=(path)=>{
  // GitHub repository GET uses /repos/owner/repo (without a trailing slash).
  // GitHub Actions returns HTTP 404 for /repos/owner/repo/ on this endpoint.
  const endpoint=path?base+path:base.slice(0,-1);
  const out=execFileSync('gh',['api',endpoint],{encoding:'utf8',maxBuffer:32*1024*1024});
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
// Query the live GitHub default branch; main is not an everlasting constant.
const liveDefault=json('').default_branch;
if(!liveDefault||typeof liveDefault!=='string')throw Error('Cannot establish live default branch');
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
const wildcardPrefixes=[...new Set(workflowSources.flatMap(w=>
  [...w.body.matchAll(/([A-Za-z0-9._/-]+)\/\*+/g)].map(m=>m[1]+'/')))];
const workflowOwns=(name)=>workflowSources.some(w=>w.body.includes(name))
  ||wildcardPrefixes.some(prefix=>name.startsWith(prefix));
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
  if(old.name===audit.canonicalDevelopment||old.name===liveDefault)
    reasons.push('canonical-or-live-default-ref');
  // Broad CI patterns such as arena/** must protect their entire namespace.
  if(old.name.startsWith('arena/'))reasons.push('workflow-glob:arena/**');
  // Human-approved rollback/deploy/checkpoint refs never go through bulk prune.
  if(/^(safety|owner|playtest|release|production|preview|backup|archive|checkpoint|hotfix)\//.test(old.name))
    reasons.push('rollback-or-deployment-namespace');
  if(workflowOwns(old.name))reasons.push('workflow-reference-or-wildcard');
  // History comparisons happen only when every cheaper live guard passed.
  if(reasons.length===0&&!isAncestor(old.sha,audit.canonicalSha))
    reasons.push('not-an-ancestor');
  if(reasons.length)blocked.push({name:old.name,reasons});
  else ready.push({name:old.name,sha:old.sha});
}
const plan={mode:apply?'APPLY':'DRY_RUN',repo:audit.repo,
  anchor:{branch:audit.canonicalDevelopment,sha:audit.canonicalSha},
  scanned:branchList.length,candidates:ready.length,blocked:blocked.length,
  liveDefault,workflowWildcardPrefixes:wildcardPrefixes,
  deleteLimit:apply?limit:0,ready,blocked};
process.stdout.write(JSON.stringify(plan,null,2)+'\n');
if(!apply){
  console.log('READ ONLY: zero refs deleted. External deploy and branch-policy review required before apply.');
  process.exit(0);
}
if(!ready.length){console.log('Nothing eligible.');process.exit(0);}
const todo=ready.filter(b=>approvals.shaSet.has(b.name+'@'+b.sha)).slice(0,limit);
if(!todo.length)throw Error('No approved SHA matches a verified safe candidate; zero refs deleted');
for(const branch of todo){
  // Revalidate live branch head, protection, all open PRs and Git ancestry at
  // the instant of each deletion. No force update, no rewrite and no fallback.
  const detail=json('branches/'+branch.name);
  if(detail.name!==branch.name||detail.commit.sha!==branch.sha||detail.protected)
    throw Error('Branch drift/protection: '+branch.name);
  const defaultNow=json('').default_branch;
  if(!defaultNow||branch.name===defaultNow||branch.name===audit.canonicalDevelopment)
    throw Error('Live default/canonical branch must never be deleted: '+branch.name);
  if(!approvals.shaSet.has(branch.name+'@'+branch.sha))
    throw Error('Missing exact external SHA approval: '+branch.name);
  const prsNow=paged('pulls?state=open&');
  if(prsNow.some(p=>p.head?.ref===branch.name||p.base?.ref===branch.name))
    throw Error('New PR dependency: '+branch.name);
  if(!isAncestor(branch.sha,audit.canonicalSha))
    throw Error('No longer an ancestor: '+branch.name);
  if(branch.name.startsWith('arena/')||
    /^(safety|owner|playtest|release|production|preview|backup|archive|checkpoint|hotfix)\//.test(branch.name))
    throw Error('Reserved by workflow glob / rollback policy: '+branch.name);
  if(workflowOwns(branch.name))
    throw Error('Active workflow direct/wildcard dependency: '+branch.name);
  if(!/^[a-zA-Z0-9._/-]+$/.test(branch.name))
    throw Error('Unexpected ref characters');
  execFileSync('gh',['api','-X','DELETE',base+'git/refs/heads/'+branch.name],
    {stdio:'inherit'});
  console.log('DELETED verified ancestor '+branch.name+' at '+branch.sha);
}
console.log('Batch complete: '+todo.length+' refs; re-run dry-run and verify workflows before another batch.');
