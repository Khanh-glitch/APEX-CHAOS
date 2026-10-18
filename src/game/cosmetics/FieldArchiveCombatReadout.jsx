import React,{useState,useEffect} from 'react';
import {heroProfile,weaponProfile,skillRecords} from './fieldArchiveProfiles.js';
import './fieldArchiveCombatReadout.css';
import './fieldArchiveC04.css';

function Radar({profile}){
 const axes=profile.axes,points=(scale=1)=>axes.map((a,i)=>{const t=-Math.PI/2+2*Math.PI*i/5,r=90*(a.value==null?0:a.value/100)*scale;return [120+Math.cos(t)*r,113+Math.sin(t)*r]});
 const coord=p=>p.map(x=>x.join(',')).join(' ');
 return <div className="fa4-radar-frame" aria-label="Five-axis combat role radar">
  <svg viewBox="0 0 240 230" role="img" aria-label={axes.map(a=>a.label+': '+(a.value==null?'unavailable':a.value+'/100')).join(', ')}>
   {[.25,.5,.75,1].map(x=><polygon key={x} points={coord(axes.map((_,i)=>{const t=-Math.PI/2+i*Math.PI*2/5;return [120+Math.cos(t)*90*x,113+Math.sin(t)*90*x]}))} fill="none" stroke="#92724a" strokeWidth="1" opacity=".58"/>)}
   {axes.map((a,i)=>{const t=-Math.PI/2+i*Math.PI*2/5;return <line key={a.key} x1="120" y1="113" x2={120+Math.cos(t)*90} y2={113+Math.sin(t)*90} stroke="#b79b74" opacity=".5"/>})}
   <polygon points={coord(points())} stroke="#f6ac59" strokeWidth="2.5" strokeLinejoin="round" fill="#da863b" fillOpacity=".27"/>
   {points().map((p,i)=><circle key={axes[i].key} cx={p[0]} cy={p[1]} r="3.5" fill="#ffcb81"/>)}
   {axes.map((a,i)=>{const t=-Math.PI/2+i*Math.PI*2/5;return <text key={a.key} x={120+Math.cos(t)*112} y={113+Math.sin(t)*110+4} textAnchor="middle" fill="#e5c69a" fontSize="9" fontWeight="bold">{a.label}</text>})}
  </svg>
  <small>{profile.status==='unclassified'?'UNCLASSIFIED MECHANICS':'TACTICAL AFFINITY'} · NOT POWER / DPS</small>
 </div>;
}
function Profile({profile}){return <div className="fa4-profile">
 <Radar profile={profile}/>
 <div className="fa4-axes">{profile.axes.map(a=><div className="fa4-axis" key={a.key} title={a.evidence.join(' · ')||'No mechanic evidence'}><span>{a.label}</span><div className="fa4-track"><i style={{width:(a.value||0)+'%'}}/></div><b>{a.value==null?'—':a.value}</b></div>)}</div>
 </div>}
const GOLD_SKILL_ART=Object.freeze({
 ROBOT:'newbot', HUNTER:'hunter', CRYSTAL:'crystala', MAGNET:'magnet',
 ICE:'frost', MIRROR:'mirror'
});
function skillArtwork(item,slot){
 const declared=item?.registry?.archiveProfile?.skillArt?.[slot];
 if(typeof declared==='string'&&declared.startsWith('/assets/')&&/\.(png|webp|jpg)$/.test(declared)&&!declared.includes('..'))
   return declared;
 const slug=GOLD_SKILL_ART[item?.id];
 return slug?'/assets/gold-ui/heroes/'+slug+'/skill_'+slot.toLowerCase()+'.webp':null;
}
function SkillThumbnail({src,slot}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[src]);
 return !src||failed?<span className="fa4-skill-fallback" aria-hidden="true">{slot==='PASSIVE'?'P':slot}</span>
   :<img src={src} alt="" loading="lazy" onError={()=>setFailed(true)}/>;
}
export function AbilityWeb({item,legacySkills=[],compact=false}){
 const [selected,setSelected]=useState('A1');
 useEffect(()=>setSelected('A1'),[item?.id]);
 const skills=skillRecords(item?.registry);
 const current=skills.find(x=>x.slot===selected)||skills[0];
 const legacy=legacySkills.find(x=>x[0]===current?.slot);
 const explanation=item?.registry?.skills?.[current?.slot]?.archiveProfile?.description||legacy?.[2]||'';
 return <section className={'fa4-readout'+(compact?' fa4-compact':'')}>
  <div className="fa3-readout-top"><b>FIGHTER / COMBAT PROFILE</b><span>CANONICAL LV1 · ROLE PROFILE</span></div>
  <div className="fa4-skill-portraits fa4-skill-select" role="group" aria-label="Three registered fighter abilities">
   {skills.map(skill=><button type="button" key={skill.slot}
      className="fa4-skill-portrait" aria-label={skill.slot+' · '+skill.name}
      onClick={()=>setSelected(skill.slot)} aria-pressed={selected===skill.slot}
      title={skill.name}>
     <SkillThumbnail src={skillArtwork(item,skill.slot)} slot={skill.slot}/>
     <span>{skill.slot}</span>
    </button>)}
  </div>
  <Profile profile={heroProfile(item?.registry)}/>
  {!compact&&<div className="fa4-skills">
   {current?<div className="fa4-skill-info"><b>{current.name||legacy?.[1]||current.mechanicId.replaceAll(/[._]/g,' ').toUpperCase()}</b>{explanation&&<p>{explanation}</p>}<small>{current.cooldown!=null?'COOLDOWN '+current.cooldown+'s · ':''}{current.metrics.map(x=>x.label+' '+x.value).join(' · ')||'CANONICAL MECHANIC'}</small></div>:<span>NO REGISTERED SKILL</span>}
  </div>}
 </section>
}
const SPECS=[
 ['BLAST PEAK',['peak','maxDamage'],'HP'],['DIRECT HIT',['direct','damage','damagePerShot','damagePerPellet','tickDamage','outgoing'],'RAW'],
 ['PROJECTILE SPEED',['bulletSpeed','speed','throwSpeed','shardSpeed'],'u/s'],['MAX SPEED',['maxSpeed','cruise'],'u/s'],
 ['ACCELERATION',['acceleration'],'u/s²'],['BLAST RADIUS',['blastRadius'],'u'],['EFFECT RANGE',['triggerRange','range','reach'],'u'],
 ['KNOCKBACK',['knockback'],'u'],['STUN',['stun'],'s'],['SLOW',['slowSeconds'],'s'],['FIRING INTERVAL',['interval'],'s'],
 ['SHOT COUNT',['shots'],'shots'],['PELLETS',['pellets'],'pellets'],['CHARGE',['charge','aimTime','windup'],'s'],
 ['DURATION',['duration'],'s'],['REFLECT RADIUS',['reflectRadius'],'u'],['DAMAGE TAKEN',['damageTakenMult'],'mult'],
 ['SPEED MULT',['speedMult'],'mult'],['PROJECTILE LIFE',['bulletLife','maxFlightSeconds'],'s'],['FUSE',['fuse'],'s']
];
export function nativeWeaponMetrics(item){
 const d=item?.data||{};
 return SPECS.flatMap(([title,keys,unit])=>{const key=keys.find(k=>typeof d[k]==='number'&&Number.isFinite(d[k]));return key?[{title,value:String(d[key]),unit,source:key}]:[]});
}
export function WeaponStatConsole({item,skin,compact=false}){
 const [page,setPage]=useState(0);
 useEffect(()=>setPage(0),[item?.id]);
 const profile=weaponProfile(item),metrics=nativeWeaponMetrics(item);
 const perPage=typeof window!=='undefined'&&window.innerWidth<=900?4:8;
 const pages=Math.max(1,Math.ceil(metrics.length/perPage));
 const safePage=Math.min(page,pages-1),visibleMetrics=metrics.slice(safePage*perPage,(safePage+1)*perPage);
 const kind=String(item?.data?.kind||item?.family||'UNKNOWN').toUpperCase();
 return <section className={'fa4-readout'+(compact?' fa4-compact':'')}>
  <div className="fa3-readout-top"><b>ARSENAL / COMBAT PROFILE</b><span>LIVE NATIVE REGISTRY · {item?.tier}</span></div>
  <Profile profile={profile}/>
  {!compact&&<div className="fa4-telemetry"><div className="fa4-telemetry-heading">{kind} / {item?.family||'EQUIPMENT'} <small>NATIVE SPECS · NO SIMULATED DPS</small></div>
   <div className="fa4-telemetry-list">{metrics.length?visibleMetrics.map(m=><div className="fa4-spec" key={m.title}><span>{m.title}</span><b>{m.value}<small> {m.unit}</small></b></div>):<div>NO NUMERIC NATIVE SPECIFICATION</div>}</div>
   {pages>1&&<div className="fa4-spec-pages"><button type="button" disabled={safePage===0} onClick={()=>setPage(v=>Math.max(0,v-1))} aria-label="Previous weapon specification page">‹</button><span>SPECS {safePage+1} / {pages}</span><button type="button" disabled={safePage===pages-1} onClick={()=>setPage(v=>Math.min(pages-1,v+1))} aria-label="Next weapon specification page">›</button></div>}
  </div>}
 </section>;
}
