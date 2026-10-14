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
  <div className="fa3-readout-top"><b>COMBAT CIRCUIT / 03 NODES</b><span>SKILL RELATION MAP</span></div>
  <div className="fa3-web-body">
   <div className="fa3-web-graphic" role="group" aria-label="Passive, A1, A2 ability selection">
    <svg viewBox="0 0 250 200" aria-hidden="true" className="fa3-web-lines">
     <defs>
      <linearGradient id="fa3-web-wires" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0" stopColor="#bd6f32"/><stop offset=".5" stopColor="#fbb66c"/><stop offset="1" stopColor="#66563f"/>
      </linearGradient>
     </defs>
     <path d="M125 13 L226 175 L24 175 Z" fill="#121817" fillOpacity=".30" stroke="url(#fa3-web-wires)" strokeWidth="2.2"/>
     <path d="M125 45 L195 160 L55 160 Z" stroke="#c49153" strokeOpacity=".48" fill="none" strokeDasharray="4 5"/>
     <path d="M125 77 L163 148 L87 148 Z M125 13 V175 M24 175 L176 94 M226 175 L74 94" fill="none" stroke="#976c47" strokeOpacity=".45" strokeWidth=".8"/>
     <circle cx="125" cy="119" r="31" fill="#1c2221" stroke="#9c6e40" strokeWidth="1.7"/>
     <circle cx="125" cy="119" r="23" fill="none" stroke="#dba45e" strokeOpacity=".55" strokeDasharray="2 3"/>
     <path d="M119 119l6-8 6 8-6 8z" fill="#eca35c"/>
     <path d="M8 184h33 M209 184h33 M125 4V15" stroke="#d5a263" strokeWidth="2"/>
    </svg>
    {KEYS.map((code,i)=>{
      const label=content.find(([k])=>k===code)?.[1]||code;
      return <button type="button" key={code} className={'fa3-web-node fa3-web-node-'+code.toLowerCase()+(selected===code?' active':'')} aria-pressed={selected===code} aria-label={code+' '+label} onClick={()=>setSelected(code)}>
       <span>{code==='PASSIVE'?'P':code}</span>
      </button>;
    })}
    <span className="fa3-web-stamp" aria-hidden="true">SELECT NODE</span>
   </div>
   <div className="fa3-web-detail" aria-live="polite">
    <span className="fa3-readout-code">{current?.[0]||'—'} // ACTIVE FILE</span>
    <strong>{current?.[1]||'NO ABILITY REGISTERED'}</strong>
    <p>{current?.[2]||'Ability information unavailable'}</p>
    <div className="fa3-web-legend"><i/> NATIVE ABILITY <b>NO COSMETIC BUFF</b></div>
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
