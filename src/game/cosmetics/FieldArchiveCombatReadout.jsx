import React,{useState,useEffect} from 'react';
import './fieldArchiveCombatReadout.css';

/** Native runtime weapon values ONLY. Don't derive gameplay damage from a
 * rendered skin, or invent DPS: bullets, tick damage, criticals, damage scale,
 * and per-weapon specials have different damage authorities. */
export function nativeWeaponMetrics(item){
 const d=item?.data||{};
 const val=(keys)=>{for(const k of keys){const v=d[k];if(typeof v==='number'&&Number.isFinite(v)&&v!==0)return v}return null};
 const n=(value)=>Number.isInteger(value)?String(value):String(Math.round(value*100)/100);
 const specs=[];
 const add=(title,value,unit='',subtitle='')=>{if(value!==null)specs.push({title,value:n(value),unit,subtitle})};
 const peak=val(['peak','maxDamage']);
 const direct=val(['direct','damagePerShot','damage','coreDamage','damagePerPellet','tickDamage','outgoing','shardDamage']);
 add(peak!==null?'BLAST PEAK':d.damagePerPellet?'PELLET BASE':d.tickDamage?'TICK BASE':d.direct?'DIRECT HIT':'HIT BASE',peak??direct,'HP',peak!==null||d.direct?'Native special authority':'Raw weapon specification');
 add('PROJECTILE SPEED',val(['bulletSpeed','speed','throwSpeed','shardSpeed']), 'u/s','Launch / initial velocity');
 add('TOP SPEED',val(['maxSpeed','cruise']),'u/s','Special projectile limit');
 add('SHOT COUNT',val(['shots']),'shots','Per firing sequence');
 add('PELLET COUNT',val(['pellets']),'pellets','Per spread shot');
 add('SHOT INTERVAL',val(['interval']),'sec','Between burst shots');
 add('CHARGE TIME',val(['charge','aimTime','windup']),'sec','Before weapon release');
 add('BLAST RADIUS',val(['blastRadius','triggerRadius']),'u','Area of effect');
 add('EFFECT RANGE',val(['triggerRange','range','reach']),'u','Native engagement range');
 add('SPREAD',val(['spread','cone']),'rad','Projectile distribution');
 add('KNOCKBACK',val(['knockback']),'u','Impulse on impact');
 add('BURN TICKS',val(['burnTicks']),'ticks','Damage-over-time stages');
 add('STUN',val(['stun']),'sec','Control duration');
 add('ACCELERATION',val(['acceleration']),'u/s²','Projectile acceleration');
 return specs;
}
const KEYS=['PASSIVE','A1','A2'];
export function AbilityWeb({item,skills,compact=false}){
 const [selected,setSelected]=useState('A1');
 useEffect(()=>setSelected('A1'),[item?.id]);
 const content=skills||[];
 const current=content.find(([id])=>id===selected)||content[0]||null;
 return <section className={'fa3-combat-web'+(compact?' fa3-combat-web-compact':'')} aria-label="Ability circuit; select a skill node">
  <div className="fa3-readout-top"><b>TACTICAL ABILITY NETWORK</b><span>03 ACTIVE CHANNELS / P · A1 · A2</span></div>
  <div className="fa3-web-body">
   <div className="fa3-web-graphic" role="group" aria-label="Passive, A1, A2 ability selection">
    <div className="fa3-web-map" data-node={selected.toLowerCase()}>
     <svg viewBox="0 0 250 200" aria-hidden="true" className="fa3-web-lines">
      <defs>
       <linearGradient id="fa3-web-wires" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#cf7931"/><stop offset=".46" stopColor="#ffcc84"/><stop offset="1" stopColor="#8c5633"/></linearGradient>
       <radialGradient id="fa3-web-core"><stop offset="0" stopColor="#c9793d" stopOpacity=".55"/><stop offset="1" stopColor="#c9793d" stopOpacity="0"/></radialGradient>
      </defs>
      <path d="M125 20 L224 168 L26 168 Z" fill="#171f1d" fillOpacity=".42" stroke="#f4a85b" strokeOpacity=".38" strokeWidth="5"/>
      <path d="M125 20 L224 168 L26 168 Z" fill="none" stroke="url(#fa3-web-wires)" strokeWidth="1.8"/>
      <path d="M125 49 L202 156 L48 156 Z M125 78 L178 145 L72 145 Z" stroke="#ac8457" strokeOpacity=".52" fill="none" strokeDasharray="3 5"/>
      <path d="M125 20 L125 117 L26 168 M125 117 L224 168 M26 168 L125 20 M224 168 L125 20" fill="none" stroke="#ba8b54" strokeOpacity=".5" strokeWidth="1.2"/>
      <path d="M125 117 L125 20 M125 117 L26 168 M125 117 L224 168" fill="none" className="fa3-web-beams" stroke="url(#fa3-web-wires)" strokeWidth="1.8" strokeDasharray="9 10"/>
      <circle cx="125" cy="117" r="35" fill="url(#fa3-web-core)"/>
      <circle cx="125" cy="117" r="23" fill="#151c1c" stroke="#ffbd6c" strokeWidth="2"/>
      <circle cx="125" cy="117" r="32" fill="none" stroke="#ffac62" strokeOpacity=".65" strokeDasharray="3 5"/>
      <path d="M117 117l8-12 8 12-8 12z" fill="#fbb66b"/>
      <path d="M9 176h42 M198 176h42 M125 0v18" stroke="#b88755" strokeWidth="2"/>
      <path d="M19 174v10 M231 174v10" stroke="#b88755"/>
     </svg>
     {KEYS.map(code=>{
      const label=content.find(([k])=>k===code)?.[1]||code;
      return <button type="button" key={code} className={'fa3-web-node fa3-web-node-'+code.toLowerCase()+(selected===code?' active':'')} aria-pressed={selected===code} aria-label={code+' '+label} onClick={()=>setSelected(code)}>
       <span>{code==='PASSIVE'?'P':code}</span>
      </button>;
     })}
     <span className="fa3-web-stamp" aria-hidden="true">SKILL AUTHORITY</span>
    </div>
   </div>
   <div className="fa3-web-detail" aria-live="polite">
    <span className="fa3-readout-code">{current?.[0]||'—'} // LIVE ABILITY RECORD</span>
    <strong>{current?.[1]||'NO ABILITY REGISTERED'}</strong>
    <p>{current?.[2]||'Ability information unavailable'}</p>
    <div className="fa3-web-legend"><i/> ENGINE AUTHORITY <b>SKIN ≠ BUFF</b></div>
   </div>
  </div>
 </section>;
}
export function WeaponStatConsole({item,skin,compact=false}){
 const d=item?.data||{},specs=nativeWeaponMetrics(item);
 const display=specs.slice(0,compact?4:8);
 const exotic=['rocket','flame','plasma','mine','boomerang','bolt','ball'].includes(String(d.kind||''));
 const skinParts=item?.id==='RPG_7'&&skin?.id==='vua-he'?'LAUNCHER / PROJECTILE / SMOKE / BLAST':skin?.id==='default'?'ORIGINAL WEAPON VISUAL':'APPROVED COSMETIC FX';
 return <section className={'fa3-stat-console'+(compact?' fa3-stat-console-compact':'')} aria-label={'Native combat specifications '+item?.name}>
  <div className="fa3-readout-top"><b>ARSENAL TELEMETRY / {item?.id||'—'}</b><span>ENGINE DATA / {item?.tier||'—'}</span></div>
  <div className="fa3-stat-ribbon"><span className="fa3-tier-marker">{item?.tier||'—'}</span><span>{String(item?.family||'ARMS').toUpperCase()}</span><span>{exotic?'SPECIAL EXECUTOR':'STANDARD LOADOUT'}</span></div>
  <div className="fa3-metrics">
   {display.length?display.map((s,i)=><div className={'fa3-metric'+(i===0?' fa3-metric-prime':'')} key={s.title}>
     <span className="fa3-metric-name">{s.title}</span>
     <div className="fa3-metric-value">{s.value}<small>{s.unit}</small></div>
     {!compact&&<span className="fa3-metric-sub">{s.subtitle}</span>}
    </div>):<div className="fa3-metric fa3-metric-empty">NATIVE SPECIAL — NO NUMERIC STATS IN CONFIG</div>}
  </div>
  <div className="fa3-stat-status"><b>SKIN FX</b><span>{skinParts}</span></div>
  <div className="fa3-stat-foot">RAW CONFIG VALUES · ACTUAL HIT DMG MAY BE MODIFIED BY BATTLE ENGINE</div>
 </section>;
}
