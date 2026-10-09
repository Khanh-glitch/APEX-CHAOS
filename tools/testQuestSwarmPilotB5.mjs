// B5b E03 HP-only experiment. Each sample enters the genuine Gold UI through
// trusted Chrome mouse/touch, replays E03 and lets real Arsenal physics decide.
// No Fighter HP writes, spoofed damage, forced KO, synthetic checkpoint credit.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const mobile=process.argv.includes('--mobile');
const platform=mobile?'mobile':'desktop';
const count=Number(process.env.B5B_ATTEMPTS||12);
const root=process.env.APEX_EVIDENCE_DIR||'/tmp/b5b-native';
fs.mkdirSync(root,{recursive:true});
const results=[];
for(let i=0;i<count;i++){
 const dir=path.join(root,platform+'-trial-'+String(i+1).padStart(2,'0'));
 fs.mkdirSync(dir,{recursive:true});
 const port=(mobile?25000:24000)+i;
 const child=spawnSync(process.execPath,['tools/testQuestSwarmTelemetryB5.mjs','--diagnose-e03',...(mobile?['--mobile']:[])],{
  env:{...process.env,APEX_EVIDENCE_DIR:dir,APEX_CDP_PORT:String(port)},
  encoding:'utf8',timeout:100000,maxBuffer:12*1024*1024
 });
 fs.writeFileSync(path.join(dir,'chrome.log'),(child.stdout||'')+'\n'+(child.stderr||''));
 let json=null;
 try{json=JSON.parse(fs.readFileSync(path.join(dir,'b5-swarm-telemetry'+(mobile?'-mobile':'')+'.json'),'utf8'))}catch{}
 const info={index:i+1,exit:child.status,signal:child.signal,
  outcome:json?.outcome||'NO_PHYSICAL_RESULT',wave:json?.wave||null,
  waveB:!!json?.firstB,steps:json?.steps??null,hp:json?.heroHp??null,
  weaponHoldPercent:json?.weaponHoldPercent??null,maxOffensive:json?.maxOffensive??null,
  tiers:json?.seenTiers||[],damageReal:!!json&&Number.isFinite(json.heroHp),
  error:child.error?String(child.error):null
 };
 results.push(info);console.log('B5B_REAL_TRIAL '+JSON.stringify(info));
 if(child.status!==0){console.error('B5B_MISSING_VALID_BROWSER '+path.join(dir,'chrome.log'));break;}
 if(info.outcome==='COMPLETE'){
  if(!info.waveB||info.wave!=='B'||info.maxOffensive>5||info.tiers.some(t=>t!=='T1'&&t!=='T2'))
    throw new Error('Completion without genuine wave B, 5-slot cap or T1/T2');
  break;
 }
}
const wins=results.filter(x=>x.outcome==='COMPLETE').length;
const complete={platform,runs:results.length,wins,trials:results};
fs.writeFileSync(path.join(root,'b5b-'+platform+'-summary.json'),JSON.stringify(complete,null,2));
if(!wins){
 console.error('FAIL B5b physical E03 real win not demonstrated in '+results.length+' valid trials');
 process.exitCode=1;
}else{
 console.log('PASS B5b real two-wave E03 organic victory '+JSON.stringify({platform,runs:results.length,wins}));
}
