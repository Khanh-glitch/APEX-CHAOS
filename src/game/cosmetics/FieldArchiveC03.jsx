import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {PRODUCT_ROSTER} from '../productSurface.js';
import {cosmetics} from './cosmeticAuthority.js';
import {loadDeferredGameRuntimes} from '../runtimeLoader.js';
import './approvedGoldSkins.js';
import './cosmeticLocker.css';
import './fieldArchiveC03.css';

const HERO_META=Object.freeze({
 ROBOT:{name:'NEWBOT',file:'newbot',accent:'#df8e39',intro:'A discarded machine that learned to fight again.',skills:[['PASSIVE','ROLLING BURST','Damage in a 1.2s burst window refunds active cooldown.'],['A1','WEAPON DASH','Quickly closes the distance to a revealed floor weapon.'],['A2','VIRTUAL ARMOR','Reduces incoming damage for 3 seconds.']]},
 HUNTER:{name:'HUNTER',file:'hunter',accent:'#8ab19a',intro:'A relentless predator: traps, mobility and disarming strikes.',skills:[['PASSIVE','HUNTER TRAITS','Predatory positioning and short-range control.'],['A1','TRAP','Places a root trap that activates when an opponent enters.'],['A2','DASH / STRIKE','Dashes, strikes and can disarm the opponent.']]},
 CRYSTAL:{name:'CRYSTALA',file:'crystala',accent:'#aa82cc',intro:'The ancient crystal keeper; shards, defensive walls and HEXA.',skills:[['PASSIVE','SHARD SYSTEM','Crystal shards fuel the keeper’s techniques.'],['A1','WALL','Constructs a wall that interacts with enemy projectiles.'],['A2','HEXA','Deploys a multi-face shard defense.']]},
 MAGNET:{name:'MAGNET',file:'magnet',accent:'#bdac90',intro:'Manipulates eligible weapons and projectiles with magnetic force.',skills:[['PASSIVE','MAGNETIC BODY','An orbit of controlled weapons and projectiles.'],['A1','ATTRACTION','Pulls eligible revealed floor guns and curves bullets.'],['A2','REPEL','Repels nearby bullets, weapons and the opponent.']]},
 ICE:{name:'FROST',file:'frost',accent:'#86bcd6',intro:'Freezes weapons, controls movement and turns ice into an advantage.',skills:[['PASSIVE','FREEZE PRESSURE','Follow-up hits refresh a frozen target’s timer.'],['A1','FROST BREATH','Lays ice and controls movement speed on the frozen ground.'],['A2','ICE RUSH','Rushes forward, leaving ice and stealing an eligible weapon.']]},
 MIRROR:{name:'MIRROR',file:'mirror',accent:'#a8a3b2',intro:'Turns battlefield positioning and projectiles into an illusion.',skills:[['PASSIVE','MIRROR ILLUSION','Manifests the mirror image during battle.'],['A1','MIRROR SKILL','Interacts with enemy projectile pressure.'],['A2','POSITION SWAP','Exchanges position under the skill’s native rules.']]},
});
const HERO_ORDER=['ROBOT','HUNTER','CRYSTAL','MAGNET','ICE','MIRROR'];
const PICTURE=(id)=>{const m=HERO_META[id];if(!m)return null;return '/assets/gold-ui/heroes/'+m.file+'/pick_'+(id==='MIRROR'?'roster_cover':'selected_large')+'.webp'};
const WEAPON_C_IMAGES=new Set('PISTOL SHOTGUN SMG SNIPER GRENADE SABRE BATTLE_AXE DAGGER SPEAR SPIKED_CLUB SWIRL_SHIELD TOWER_SHIELD AK_47 BERETTA_93R DESERT_DEAGLE GLOCK_17 JACKHAMMER M16 M249_SAW MAC_10 MAGNUM_500 MBR MBR2 MOSSBERG_500 P90 SAWED_OFF SZECSEI_FUCHS TEC_9 ZBROYAR_Z15'.split(' '));
const WEAPON_V43_IMAGES=new Set('BOLT COMBAT_BOOMERANG FLAMETHROWER FLARE_GUN PLASMA_SPLITTER RPG_7 SHRAPNEL_MINE_LAUNCHER STEEL_BALL_LAUNCHER TACTICAL_CROSSBOW'.split(' '));
function weaponImage(id,meta){if(id==='RPG_7'&&meta?.skinId==='vua-he')return '/assets/skins/rocket-vua-he/launcher.png';
 if(WEAPON_V43_IMAGES.has(id))return '/assets/arsenal/v43/'+id+'.webp';
 if(WEAPON_C_IMAGES.has(id))return '/assets/arsenal/weapons/c/'+id+'.png';
 return typeof meta?.art==='string'&&/^\/assets\/arsenal\//.test(meta.art)?meta.art:null;
}
const isHome=()=>{
 const stage=document.getElementById('stage');
 return !!(document.body.classList.contains('apex-gold-mounted')&&stage&&!document.getElementById('apex-boot-start')&&window.gameState!=='ARSENAL'&&
 !['screen-mode','screen-fighter','screen-draw','screen-battle','flow-transition'].some(c=>stage.classList.contains(c)));
};
function catalogWeapons(){
 const c=window.APEX_ARSENAL_CONFIG;
 if(!c?.WEAPONS)return [];
 return Object.entries(c.WEAPONS).filter(([id])=>id!=='T6'&&id!=='STORMBREAKER_INTERNAL').map(([id,w])=>({
  id,name:String(w.name||id.replaceAll('_',' ')),tier:c.tierOf?.(id)||w.tier||'—',
  family:String(w.family||w.kind||'Equipment'),data:w
 })).sort((a,b)=>(Number(a.tier?.slice(1))||9)-(Number(b.tier?.slice(1))||9)||a.name.localeCompare(b.name));
}
function GoldEcoActor({active}){
 const ref=useRef(null);const [fallback,setFallback]=useState(false);
 useEffect(()=>{if(!active)return;let run=true,raf=0,mod=null;
  import('./ecoNewbotV17Gold.js').then(api=>{
   if(!run)return;
   if(!api.prepareEcoGold?.()){setFallback(true);return}
   mod=api;
   const draw=time=>{
    if(!run)return;
    const canvas=ref.current,ctx=canvas?.getContext('2d');
    if(canvas&&ctx){
     const bounds=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
     if(bounds.width>0&&bounds.height>0){
      const w=Math.round(bounds.width*dpr),h=Math.round(bounds.height*dpr);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);ctx.save();ctx.translate(w*.5,h*.52);
      const scale=Math.min(w/165,h/150)*.73;ctx.scale(scale,scale);
      const t=time/1000;
      const springs={rootX:0,rootY:Math.sin(t*1.35)*1.7,tilt:Math.sin(t*.73)*.012,coreX:0,coreY:0,crest:0,chin:0,cheekX:0,cheekY:0,lagX:0,lagY:0,lid:0,glow:1,seam:0,calDx:[0,0],calDy:[0,0],calTh:[0,0],spin:[t*.5,t*.43]};
      try{api.drawEcoGoldActor(ctx,{robot:{time:t,springs,ticks:[0,0,0],scanning:false,armor:false,held:false,lockFlash:0,pulses:[],stress:[]}})}catch(e){console.warn('[archive] ECOBOT Gold renderer',e);setFallback(true);run=false}
      ctx.restore();
     }
    }
    raf=requestAnimationFrame(draw);
   };
   raf=requestAnimationFrame(draw);
  }).catch(e=>{console.warn('[archive] ECOBOT Gold import',e);setFallback(true)});
  return()=>{run=false;cancelAnimationFrame(raf)};
 },[active]);
 if(!active)return null;
 if(fallback)return <img src={PICTURE('ROBOT')} className="fa3-hero-img" alt="NEWBOT original fallback (ECOBOT preview unavailable)"/>;
 return <canvas ref={ref} className="fa3-eco" aria-label="Approved ECOBOT V17 Gold actor rendering"/>;
}
function DisplayArtwork({kind,item,previewId}){
 const hero=kind==='hero';
 const image=hero?PICTURE(item.id):weaponImage(item.id,{skinId:previewId,art:item.data?.art});
 const isEco=hero&&item.id==='ROBOT'&&previewId==='ecobot';
 const [broken,setBroken]=useState(false);
 useEffect(()=>setBroken(false),[image,isEco]);
 return <div className={'fa3-artwork '+(hero?'fa3-artwork-hero':'fa3-artwork-weapon')} key={kind+item.id+previewId}>
  <span className="fa3-art-code" aria-hidden="true">{hero?'FIELD RECORD / '+item.id:'ARSENAL / '+item.tier}</span>
  <div className="fa3-art-orbit" aria-hidden="true"/>
  {isEco?<GoldEcoActor active/>:image&&!broken?<img src={image} className={hero?'fa3-hero-img':'fa3-weapon-img'} alt={item.name+' '+previewId+' approved asset'} onError={()=>setBroken(true)}/>:<div className="fa3-art-missing" role="status">VISUAL RECORD UNAVAILABLE <small>Asset not present in approved inventory</small></div>}
  <span className="fa3-art-underlay" aria-hidden="true">{item.id.replaceAll('_',' ').slice(0,18)}</span>
  <span className="fa3-art-label">{previewId==='default'?'ORIGINAL':previewId.toUpperCase()} / VISUAL PREVIEW</span>
 </div>;
}
function WeaponFacts({item,skin}){
 const d=item.data||{}, isRocket=item.id==='RPG_7'&&skin?.id==='vua-he';
 const tags=[item.tier,item.family].filter(Boolean);
 const measurable=[['DAMAGE',d.damagePerShot??d.damage??d.tickDamage],['AMMO',d.ammo??d.magazine??d.shots],['RANGE',d.range??d.triggerRange]].filter(([,v])=>typeof v==='number'&&Number.isFinite(v));
 return <div className="fa3-facts">
  <div className="fa3-fact"><b>WEAPON PROFILE</b><strong>{tags.join(' / ')}</strong><small>{measurable.length?measurable.map(([n,v])=>n+' '+v).join(' · '):'Combat values follow the native Arsenal weapon configuration.'}</small></div>
  <div className="fa3-fact"><b>SKIN MODIFIES</b><strong>{isRocket?'LAUNCHER · ROCKET · TRAIL · BLAST':skin?.id==='default'?'ORIGINAL PRESENTATION':'REGISTERED GOLD VISUALS'}</strong><small>{skin?.id==='default'?'Native game weapon appearance':skin?.detail||'Visuals only; native gameplay unchanged'}</small></div>
  <div className="fa3-fact"><b>UNCHANGED IN BATTLE</b><strong>DAMAGE · PICKUP · HIT RULES</strong><small>Skin selection does not choose which gun will spawn in the arena.</small></div>
 </div>;
}
function HeroFacts({item}){const m=HERO_META[item.id];return <div className="fa3-facts">{(m?.skills||[]).map(([n,title,desc])=><div className="fa3-fact" key={n}><b>{n}</b><strong>{title}</strong><small>{desc}</small></div>)}</div>}
export default function FieldArchiveC03(){
 const [home,setHome]=useState(false),[open,setOpen]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [kind,setKind]=useState('hero'),[side,setSide]=useState('p1'),[focus,setFocus]=useState('ROBOT');
 const [weapons,setWeapons]=useState([]),[view,setView]=useState('SKINS'),[page,setPage]=useState(0),[query,setQuery]=useState('');
 const [preview,setPreview]=useState('default'),[rev,setRev]=useState(0),[warning,setWarning]=useState(false);
 const [windowSize,setWindowSize]=useState({w:typeof window!=='undefined'?window.innerWidth:1440,h:typeof window!=='undefined'?window.innerHeight:900});
 const inFlight=useRef(false),opener=useRef(null);
 useEffect(()=>{
  const update=()=>{const current=isHome();setHome(current);if(!current)setOpen(false)};
  const resize=()=>setWindowSize({w:innerWidth,h:innerHeight});
  const subscription=cosmetics.subscribe(()=>setRev(x=>x+1));
  const interval=setInterval(update,400);
  const event=()=>{void launch()};
  const homeClick=e=>{if(e.target?.closest?.('#apexDictionaryOpen'))void launch()};
  window.addEventListener('apex-open-cosmetics',event);
  window.addEventListener('apex-open-dictionary',event);
  document.addEventListener('click',homeClick);
  window.addEventListener('resize',resize,{passive:true});
  update();
  return()=>{clearInterval(interval);subscription();document.removeEventListener('click',homeClick);window.removeEventListener('resize',resize);window.removeEventListener('apex-open-cosmetics',event);window.removeEventListener('apex-open-dictionary',event)};
 },[]);
 useEffect(()=>{if(!open)return;
  const before=document.activeElement;
  document.body.classList.add('apex-cosmetic-locker-open','fa3-locked');
  const key=e=>{if(e.key==='Escape'){e.preventDefault();setOpen(false)}};
  window.addEventListener('keydown',key);
  return()=>{window.removeEventListener('keydown',key);document.body.classList.remove('apex-cosmetic-locker-open','fa3-locked');(opener.current||before)?.focus?.()};
 },[open]);
 async function launch(){
  if(!isHome()||inFlight.current)return;
  opener.current=document.activeElement;inFlight.current=true;setLoading(true);setError('');
  try{await loadDeferredGameRuntimes('arsenalHub');setWeapons(catalogWeapons());setOpen(true);setView('SKINS')}
  catch(e){setError(String(e?.message||e))}
  finally{inFlight.current=false;setLoading(false)}
 }
 const items=useMemo(()=>kind==='hero'?HERO_ORDER.filter(x=>PRODUCT_ROSTER.playableIds.includes(x)).map(id=>({id,name:HERO_META[id].name,tier:'FIGHTER',family:'CORE SIX'})):weapons,[kind,weapons]);
 const filtered=useMemo(()=>items.filter(x=>!query||x.name.toLowerCase().includes(query.toLowerCase())||x.id.toLowerCase().includes(query.toLowerCase())),[items,query]);
 const current=items.find(x=>x.id===focus)||items[0]||null;
 const count=items.length,idx=Math.max(0,items.findIndex(x=>x.id===current?.id));
 const opts=current?cosmetics.variants(kind,current.id):[];
 const worn=current?cosmetics.selected(side,kind,current.id):null;
 const activePreview=opts.some(v=>v.id===preview)?preview:'default';
 const chosen=opts.find(v=>v.id===activePreview)||opts[0]||null;
 const isNarrow=windowSize.w<760||windowSize.h<550;
 const listPageSize=windowSize.w<540?3:windowSize.h<710?4:6;
 const pageMax=Math.max(0,Math.ceil(filtered.length/listPageSize)-1);
 const safePage=Math.min(page,pageMax),pageItems=filtered.slice(safePage*listPageSize,(safePage+1)*listPageSize);
 const resetFocus=useCallback((id)=>{setFocus(id);setPage(0);setPreview(cosmetics.selected(side,kind,id).id);setWarning(false)},[kind,side]);
 const shift=(delta)=>{if(!items.length)return;const item=items[(idx+delta+items.length)%items.length];resetFocus(item.id)};
 function changeKind(next){setKind(next);setPage(0);setQuery('');setView('SKINS');const id=next==='hero'?'ROBOT':weapons[0]?.id||'';setFocus(id);if(id)setPreview(cosmetics.selected(side,next,id).id)}
 function changeSide(next){setSide(next);if(current)setPreview(cosmetics.selected(next,kind,current.id).id)}
 function equip(){if(!current||!chosen||activePreview===worn?.id)return;const result=cosmetics.equip(side,kind,current.id,chosen.id);if(result.ok)setWarning(result.persisted===false)}
 return <>
  {home&&!open&&<button type="button" className="apex-skin-entry" onClick={()=>void launch()} disabled={loading} title="Open Field Archive: fighters, weapons and skins"><span className="apex-skin-entry-mark" aria-hidden="true">✦</span><span>{loading?'LOADING':'ARCHIVE'}</span><span aria-hidden="true">↗</span></button>}
  {home&&!open&&error&&<div className="apex-skin-error" role="alert">Archive unavailable: {error}<button type="button" onClick={()=>setError('')}>×</button></div>}
  {open&&<div className="fa3-overlay apex-cosmetics-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}} onKeyDownCapture={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();setOpen(false)}}} onKeyUpCapture={e=>e.stopPropagation()}>
   <section className="fa3-shell" role="dialog" aria-modal="true" aria-labelledby="fa3-title">
    <div className="fa3-binding" aria-hidden="true"><i/><i/><i/></div>
    <header className="fa3-header"><div className="fa3-brand"><small>APEX CHAOS / RESTRICTED FIELD RECORD</small><h2 id="fa3-title">THE FIELD <em>ARCHIVE</em></h2></div>
     <div className="fa3-primary" role="tablist" aria-label="Archive category"><button role="tab" aria-selected={kind==='hero'} className={kind==='hero'?'on':''} onClick={()=>changeKind('hero')}>FIGHTERS</button><button role="tab" aria-selected={kind==='weapon'} className={kind==='weapon'?'on':''} onClick={()=>changeKind('weapon')}>WEAPONS</button></div>
     <div className="fa3-players" role="group" aria-label="Choose loadout"><button aria-pressed={side==='p1'} className={side==='p1'?'on':''} onClick={()=>changeSide('p1')}>P1</button><button aria-pressed={side==='p2'} className={side==='p2'?'on':''} onClick={()=>changeSide('p2')}>P2 / BOT</button></div>
     <button className="fa3-close apex-cosmetics-close" type="button" onClick={()=>setOpen(false)} aria-label="Close archive">✕</button>
    </header>
    <div className="fa3-body">
      <aside className={'fa3-index '+(view==='INDEX'?'fa3-index-active':'')} aria-label="Fighter and weapon catalogue">
       <div className="fa3-index-head"><b>REGISTER / {kind==='hero'?'FIGHTERS':'WEAPONS'}</b><span>{String(filtered.length).padStart(2,'0')} FILES</span></div>
       <input type="search" aria-label="Search archive" placeholder="FIND A RECORD..." value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}}/>
       <div className="fa3-index-list">{pageItems.map(item=><button type="button" key={item.id} className={item.id===current?.id?'chosen':''} aria-pressed={item.id===current?.id} onClick={()=>{resetFocus(item.id);setView('SKINS')}}>
         <span className="fa3-index-img">{kind==='hero'?<img src={PICTURE(item.id)} alt=""/>:<span>{item.tier}</span>}</span>
         <span className="fa3-index-name"><b>{item.name}</b><small>{kind==='hero'?'FIGHTER':item.tier+' / '+item.family}</small></span><i aria-hidden="true">↗</i></button>)}
         {filtered.length===0&&<p className="fa3-no-results">No matching records.</p>}
       </div>
       <div className="fa3-pager"><button disabled={safePage===0} onClick={()=>setPage(x=>Math.max(0,x-1))} aria-label="Previous archive page">‹</button><span>{String(safePage+1).padStart(2,'0')} / {String(pageMax+1).padStart(2,'0')}</span><button disabled={safePage>=pageMax} onClick={()=>setPage(x=>Math.min(pageMax,x+1))} aria-label="Next archive page">›</button></div>
      </aside>
      <main className="fa3-center">
       <div className="fa3-record-top"><div><small>DOCUMENT / {String(idx+1).padStart(2,'0')} — {String(count).padStart(2,'0')}</small><h3>{current?.name||'ARCHIVE'}</h3></div><span className="fa3-record-stamp">{kind==='hero'?'FIGHTER REGISTRY':'ARSENAL RECORD'}</span></div>
       {current?<DisplayArtwork kind={kind} item={current} previewId={activePreview}/>:<div className="fa3-empty">Preparing Arsenal records…</div>}
       <div className="fa3-record-navigation"><button type="button" onClick={()=>shift(-1)} aria-label="Previous record">‹</button><span>{current?.tier||'—'} / {kind==='hero'?'CORE SIX':current?.family||'ARSENAL'}</span><button type="button" onClick={()=>shift(1)} aria-label="Next record">›</button></div>
      </main>
      <section className="fa3-detail" aria-label="Appearance and record information">
       <div className="fa3-detail-tabs" role="tablist" aria-label="Record details">
        {['SKINS','INFO','INDEX'].map(v=><button key={v} role="tab" aria-selected={view===v} className={view===v?'on':''} onClick={()=>setView(v)}>{v}</button>)}
       </div>
       <div className="fa3-detail-heading"><span>{view==='SKINS'?'APPEARANCES / SELECT & EQUIP':view==='INFO'?'FIELD NOTES / GAMEPLAY':'SELECT RECORD'}</span><i aria-hidden="true">RECORD NO. {String(idx+1).padStart(3,'0')}</i></div>
       {view==='SKINS'&&<div className="fa3-appear">
        <p className="fa3-description">{kind==='hero'?HERO_META[current?.id]?.intro:'Skin applies whenever this weapon type is obtained during a match.'}</p>
        <div className="fa3-skin-list">{opts.map(s=><button type="button" key={s.id} className={'fa3-skin'+(s.id===activePreview?' preview':'')+(s.id===worn?.id?' equipped':'')} onClick={()=>setPreview(s.id)} aria-pressed={s.id===activePreview}>
          <span className="fa3-skin-thumb">{s.id==='ecobot'?<span className="fa3-eco-symbol">E</span>:<img src={kind==='hero'?PICTURE(current.id):weaponImage(current.id,{skinId:s.id,art:current.data?.art})||''} alt=""/>}</span>
          <span className="fa3-skin-name"><b>{s.label}</b><small>{s.id==='default'?'ORIGINAL PRESENTATION':s.detail||'APPROVED COSMETIC'}</small></span>
          <strong>{s.id===worn?.id?'✓':'↗'}</strong></button>)}</div>
        <div className="fa3-equip-state"><b>{side==='p1'?'PLAYER 01':'PLAYER 02 / BOT'}</b><span>EQUIPPED / {worn?.label||'ORIGINAL'}</span></div>
        <button type="button" className="fa3-equip" onClick={equip} disabled={!chosen||chosen.id===worn?.id}>{chosen?.id===worn?.id?'EQUIPPED ✓':'EQUIP THIS SKIN ↗'}</button>
        {warning&&<small role="alert" className="fa3-alert">Selection active for this session; browser storage is disabled.</small>}
       </div>}
       {view==='INFO'&&current&&(kind==='hero'?<HeroFacts item={current}/>:<WeaponFacts item={current} skin={chosen}/>)}
       {view==='INDEX'&&<div className="fa3-index-on-panel"><p>Select a record from the indexed folio.</p><button onClick={()=>setView('SKINS')}>RETURN TO APPEARANCES ↗</button></div>}
       <div className="fa3-bottom-note">APPEARANCES ONLY / COMBAT RULES PRESERVED</div>
      </section>
    </div>
    <footer className="fa3-footer"><span>FIELD ARCHIVE · VOL. 01 / CORE SIX & ARSENAL</span><span>ESC — CLOSE · ARROWS — NEXT RECORD</span><span className="fa3-safety">NO PAGE SCROLL / LIVE EQUIP AUTHORITY</span></footer>
   </section>
  </div>}
 </>;
}
