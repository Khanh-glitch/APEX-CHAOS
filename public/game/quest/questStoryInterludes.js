/* Quest Q4E: per-match narrative cue receipts. Never changes combat or Story save. */
(function installStoryBeats(root){
'use strict';
if(root.APEX_QUEST_STORY_BEATS)return;
const scene=[
{id:'WAKE_OPEN',type:'PANELS',trigger:'DIRECTOR_WAKE',art:['NEWBOT','SCRAP_BASIN'],text:['WAKE','SCRAP BASIN']},
{id:'E01_R1_IMPACT',type:'IN_ENGINE_HOLD',trigger:'REAL_PISTOL_R1',art:['NEWBOT','TOT'],text:[]},
{id:'E01_R2_IMPACT',type:'IN_ENGINE_HOLD',trigger:'REAL_PISTOL_R2',art:['TOT','NEWBOT'],text:[]},
{id:'E01_J_REVEAL',type:'SYSTEM_CUE',trigger:'REAL_PISTOL_R2',art:[],text:['UNKNOWN ROUTINE — J']},
{id:'E01_K_REVEAL',type:'SYSTEM_CUE',trigger:'REAL_A1_CAST',art:[],text:[]},
{id:'E01_RIVET_HOLD',type:'IN_ENGINE_HOLD',trigger:'REAL_HP_AND_CASTS',art:['RIVET'],text:[]},
{id:'E01_RIVET_SUPPRESSION_TECH',type:'CINEMATIC',trigger:'REAL_STORMBREAKER_SETTLED',art:['RIVET','STORMBREAKER'],text:[]},
{id:'WORKSHOP_ARRIVAL',type:'PANELS',trigger:'DIRECTOR_WORKSHOP',art:['RIVET','TOT','NEWBOT','WORKSHOP'],text:['WORKSHOP','NO VALID NETWORK ID','REGISTERED']}
].map(s=>Object.freeze({...s,art:Object.freeze(s.art),text:Object.freeze(s.text),dialogue:Object.freeze([])}));
const scenes=Object.freeze(scene);
const byId=new Map(scenes.map(s=>[s.id,s]));
const r1=e=>e?.kind==='PISTOL_HIT'&&e.from==='NEWBOT'&&e.to==='T.O.T'&&Number.isFinite(e.amount)&&e.amount>0;
const r2=e=>e?.kind==='PISTOL_HIT'&&e.from==='T.O.T'&&e.to==='NEWBOT'&&Number.isFinite(e.amount)&&e.amount>0;
const cast=(e,k)=>e?.kind==='CAST'&&e.slot===k&&Number.isSafeInteger(e.seq)&&e.seq>0;
const phases=['R1_PISTOL','R2_PISTOL','J_CAST','K_CAST','BOTH_HALF','AWAIT_RIVET'];
function create(){
 let closed=false,lastPhase='R1_PISTOL',lastReceipts=0;
 const events=[],pending=[],issued=new Set();
 function emit(id){if(!issued.has(id)){issued.add(id);events.push(id);pending.push(id);}}
 function observeReflex(s,tech){
  if(closed)return {accepted:false,reason:'closed'};
  const r=s?.receipts;
  if(!s?.active||!Array.isArray(r)||r.length>4)return {accepted:false,reason:'no-real-gate'};
  if((r.length>0&&!r1(r[0]))||(r.length>1&&!r2(r[1]))
     ||(r.length>2&&!cast(r[2],'A1'))
     ||(r.length>3&&(!cast(r[3],'A2')||r[3].seq<=r[2].seq)))
    return {accepted:false,reason:'invalid-arsenal-receipts'};
  const n=phases.indexOf(s.phase),prev=phases.indexOf(lastPhase);
  if(n<0||n<prev||r.length<lastReceipts)return {accepted:false,reason:'non-monotonic'};
  if(n>=1&&r.length>=1)emit('E01_R1_IMPACT');
  if(n>=2&&r.length>=2){emit('E01_R2_IMPACT');emit('E01_J_REVEAL');}
  if(n>=3&&r.length>=3)emit('E01_K_REVEAL');
  if(s.phase==='AWAIT_RIVET'&&r.length===4
    &&s.awaitingRivet===true&&s.complete===false&&s.storyProgress===false
    &&s.hp?.newbot>0&&s.hp.newbot<=500&&s.hp?.tot>0&&s.hp.tot<=500)
    emit('E01_RIVET_HOLD');
  if(issued.has('E01_RIVET_HOLD')&&tech?.ready===true
    &&tech.kind==='E01_RIVET_TECHNICAL_PREVIEW'
    &&tech.phase==='PREVIEW_SETTLED'
    &&tech.checkpointAuthorized===false&&tech.storyComplete===false
    &&tech.weapon==='STORMBREAKER'&&tech.operator==='RIVET')
    emit('E01_RIVET_SUPPRESSION_TECH');
  lastPhase=s.phase;lastReceipts=r.length;
  return {accepted:true,pending:pending.length};
 }
 // Taking/skipping a cue is not Story completion or combat command.
 function take(){return closed?null:pending.shift()||null;}
 function snapshot(){return Object.freeze({closed,lastPhase,receipts:lastReceipts,
   emitted:events.slice(),pending:pending.slice(),checkpointAuthorized:false,storyComplete:false});}
 function close(){closed=true;pending.length=0;events.length=0;issued.clear();}
 return Object.freeze({observeReflex,take,snapshot,close});
}
root.APEX_QUEST_STORY_BEATS=Object.freeze({
 create,scenes:()=>scenes.map(s=>({id:s.id,type:s.type,trigger:s.trigger,
  art:s.art.slice(),text:s.text.slice(),dialogue:[]})),
 scene:id=>byId.get(id)||null
});
root.apexQuestStoryInterludes='ready';
})(typeof window!=='undefined'?window:globalThis);
