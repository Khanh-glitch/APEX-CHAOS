#!/usr/bin/env node
// Independent Gold evidence PRE-FLIGHT; never awards certification.
// The existing strict phase gate is the sole shipping certification authority.
// This preflight provides an exact SHA-locked, machine-readable list of the
// missing proofs, and verifies raw provenance if a reference is provisioned.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const argv=process.argv.slice(2);
function arg(flag){
  const n=argv.indexOf(flag);
  if(n===-1)return null;
  if(!argv[n+1]||argv[n+1].startsWith('--'))throw Error('Missing value for '+flag);
  return argv[n+1];
}
const backlogPath='docs/maintenance/V43_GOLD_40_PHASE_EVIDENCE_BACKLOG_2026-10-10.json';
const certPath='tools/testOwnerV43GoldCertification.mjs';
const source=fs.readFileSync(certPath,'utf8');
const backlog=JSON.parse(fs.readFileSync(backlogPath,'utf8'));
const shaMatch=source.match(/const SOURCE_SHA='([a-f0-9]{64})'/);
if(!shaMatch)throw Error('Missing pinned SHA in strict certification authority');
const expectedSha=shaMatch[1];
if(backlog.ownerBaselineGoldHtmlSha256!==expectedSha)
  throw Error('Owner Gold SHA drift between backlog and strict certification');
const ids=['FLARE_GUN','TACTICAL_CROSSBOW','STEEL_BALL_LAUNCHER','COMBAT_BOOMERANG',
  'RPG_7','FLAMETHROWER','PLASMA_SPLITTER','SHRAPNEL_MINE_LAUNCHER'];
const phases=['ready','attack','contact','afterglow','counter'];
const rows=backlog.pendingPhases;
if(!Array.isArray(rows)||rows.length!==40)
  throw Error('Gold backlog must have exactly 40 phase rows');
const lookup=new Map();
for(const row of rows){
  const key=row.weapon+'/'+row.phase;
  if(!ids.includes(row.weapon)||!phases.includes(row.phase)||lookup.has(key))
    throw Error('Unknown or duplicate Gold phase '+key);
  if(!Array.isArray(row.goldProofsMissing)||!row.goldProofsMissing.length)
    throw Error('Phase has no independent Gold proof declaration: '+key);
  if(!['UNVERIFIED','VERIFIED'].includes(row.status))
    throw Error('Unknown Gold phase status '+key+': '+row.status);
  for(const proof of row.goldProofsMissing){
    if(typeof proof!=='string'||!proof.startsWith('gold:')||
      !source.includes("'"+proof+"'"))
      throw Error('Missing exact Gold proof ID in certification matrix: '+key+' '+proof);
  }
  lookup.set(key,row);
}
for(const id of ids)for(const phase of phases)
  if(!lookup.has(id+'/'+phase))throw Error('Missing required Gold phase '+id+'/'+phase);
const referenceFile=arg('--reference')||process.env.APEX_V43_OWNER_GOLD_HTML||null;
let reference={status:'NOT_PROVISIONED',expectedSha256:expectedSha};
if(referenceFile){
  if(!fs.existsSync(referenceFile))throw Error('Original owner Gold HTML not found: '+referenceFile);
  const contents=fs.readFileSync(referenceFile);
  const digest=createHash('sha256').update(contents).digest('hex');
  reference={status:digest===expectedSha?'SHA256_VERIFIED':'SHA256_MISMATCH',
    expectedSha256:expectedSha,actualSha256:digest,bytes:contents.length,
    basename:path.basename(referenceFile)};
}
const rawValidated=reference.status==='SHA256_VERIFIED';
const outstanding=rows.filter(r=>r.status!=='VERIFIED').map(r=>({
  weapon:r.weapon,phase:r.phase,missingGoldProofs:r.goldProofsMissing,
  referenceAction:'Capture original event-aligned motion + compare full candidate sequence',
}));
const report={
  schema:'apex-chaos-v43-gold-preflight-v1',
  type:'EVIDENCE_INVENTORY_NOT_CERTIFICATION',
  candidateFromGitHead:process.env.GITHUB_SHA||null,
  baselineGoldHtmlSha256:expectedSha,
  reference,
  phaseSlotsExpected:40,phaseSlotsInventoried:rows.length,
  phaseRowsMarkedVerified:rows.length-outstanding.length,
  independentProofsEstablishedByThisTool:0,
  releaseStatus:'BLOCKED_PENDING_STRICT_GOLD_CERTIFICATION',
  captureRequirements:backlog.captureRequirements,
  missingPhaseEvidence:outstanding,
  warnings:[
    '7 source Canvas traces are not 40 full Gold phase comparisons',
    'Candidate-only Chrome screenshots cannot replace matched Gold reference frames',
    'Raw Library indexing does not prove the original HTML SHA256',
    'A correctly hashed source is prerequisite, not itself Gold phase certification',
  ]
};
const dest=arg('--out');
if(dest){fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');}
console.log('V43 GOLD REFERENCE PREFLIGHT '+JSON.stringify({
  inventory:rows.length,unverified:outstanding.length,originalReference:reference.status,
  rawValidated,releaseStatus:report.releaseStatus,reportPath:dest||null}));
if(reference.status==='SHA256_MISMATCH'){
  console.error('Reference SHA mismatch; do not use this source for Gold capture');
  process.exitCode=1;
}
