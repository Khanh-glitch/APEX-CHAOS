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
 add('AMMO CAPACITY',val(['ammo','magazine','magSize','magazineSize']),'rounds','Weapon magazine if defined in native config');
 add('TRAVEL LIFETIME',val(['bulletLife','maxFlightSeconds','flightMax']),'sec','Projectile duration / limit');
 add('FUSE TIME',val(['fuse']),'sec','Delay before detonation');
 add('BURN DAMAGE',val(['burnDamage']),'HP','Native damage per burning tick');
 add('FRAGMENTS',val(['fragments','shards']),'units','Spawned fragment or shard count');
 add('FRAGMENT HIT',val(['fragmentDamage','shardDamage']),'HP','Native shard direct damage');
 add('RETURN HIT',val(['returning']),'HP','Boomerang return damage');
 add('ARM TIME',val(['armSeconds']),'sec','Mine becomes active');
 add('DEPLOY DELAY',val(['deployDelay']),'sec','Deployment setup');
 add('CONTROL SLOW',val(['slowSeconds']),'sec','Status effect duration');
 add('BURN STAGES',val(['burnTicks','ticks']),'ticks','Periodic stages');
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
 const d=item?.data||{},all=nativeWeaponMetrics(item),specs=all.slice(0,compact?4:8);
 const family=String(item?.family||'').toUpperCase();
 const mode=String(d.kind||family||'STANDARD').toUpperCase();
 const isRpg=item?.id==='RPG_7',isVuaHe=isRpg&&skin?.id==='vua-he';
 const skinParts=isVuaHe?'LAUNCHER · ROCKET · SMOKE · BLAST':skin?.id==='default'?'ORIGINAL NATIVE VISUAL':'REGISTERED COSMETIC FX';
 const special=['ROCKET','FLAME','PLASMA','MINE','BOOMERANG','BOLT','BALL'].includes(mode);
 const offense=all.find(s=>/HIT BASE|PELLET BASE|BLAST PEAK|TICK BASE|DIRECT HIT/i.test(s.title));
 const velocity=all.find(s=>s.title==='PROJECTILE SPEED');
 const impact=all.find(s=>s.title==='BLAST RADIUS');
 const properties=[
  ['ORIGIN',item?.tier||'—'],
  ['TRAVEL',velocity?velocity.value+' '+velocity.unit:mode],
  ['IMPACT',impact?impact.value+' '+impact.unit:offense?offense.value+' '+offense.unit:'NATIVE'],
 ];
 return <section className={'fa3-stat-console'+(compact?' fa3-stat-console-compact':'')} aria-label={'Native combat specifications '+item?.name}>
  <div className="fa3-readout-top"><b>WEAPON FIELD TELEMETRY / {item?.id||'—'}</b><span>ARSENAL LIVE CONFIG</span></div>
  <div className="fa3-stat-ribbon">
   <span className="fa3-tier-marker">{item?.tier||'—'}</span>
   <span className="fa3-weapon-kind">{mode} / {family}</span>
   <span className="fa3-weapon-type">{special?'SPECIAL EXECUTOR':'NATIVE FIREARM'}</span>
  </div>
  {!compact&&<div className="fa3-ballistic-diagram" aria-label="Weapon firing event chain, not a scaled performance graph">
   <svg className="fa3-ballistic-line" viewBox="0 0 320 39" preserveAspectRatio="none" aria-hidden="true">
    <path d="M12 21 L113 21 L151 9 L193 33 L230 21 L306 21" fill="none" stroke="#7f6645" strokeWidth="4" strokeLinecap="square"/>
    <path className="fa3-ballistic-pulse" d="M12 21 L113 21 L151 9 L193 33 L230 21 L306 21" fill="none" stroke="#ffbd6f" strokeWidth="1.8" strokeDasharray="12 10"/>
    <circle cx="12" cy="21" r="5" fill="#f0ac62"/><circle cx="151" cy="9" r="4" fill="#e29742"/><circle cx="306" cy="21" r="7" fill="#f39b48" stroke="#ffdb9b" strokeWidth="1"/>
   </svg>
   <div className="fa3-ballistic-points">{properties.map(([name,value])=><div key={name}><b>{name}</b><strong>{value}</strong></div>)}</div>
  </div>}
  <div className="fa3-metrics">
   {specs.length?specs.map((s,i)=><div className={'fa3-metric'+(i===0?' fa3-metric-prime':'')} key={s.title}>
     <span className="fa3-metric-name"><i>{String(i+1).padStart(2,'0')}</i>{s.title}</span>
     <div className="fa3-metric-value">{s.value}<small>{s.unit}</small></div>
     {!compact&&<span className="fa3-metric-sub">{s.subtitle}</span>}
    </div>):<div className="fa3-metric fa3-metric-empty">NATIVE SPECIAL / NO NUMERIC STATS IN CONFIG</div>}
  </div>
  <div className="fa3-stat-status"><b>VISUAL KIT</b><span>{skinParts}</span></div>
  <div className="fa3-stat-foot">ENGINE RAW DATA · SKIN ADDS 0 DAMAGE · NO INVENTED DPS / AMMO</div>
 </section>;
}
