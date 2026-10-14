import React, { useEffect, useMemo, useState } from 'react';
import { PRODUCT_ROSTER } from '../productSurface.js';
import { cosmetics } from './cosmeticAuthority.js';
import { loadDeferredGameRuntimes } from '../runtimeLoader.js';
import './cosmeticLocker.css';
import './approvedGoldSkins.js';

const heroNames={
  ROBOT:'NEWBOT',HUNTER:'HUNTER',CRYSTAL:'CRYSTALA',
  MAGNET:'MAGNET',ICE:'FROST',MIRROR:'MIRROR',
};
const heroColors={
  ROBOT:'#c6a475',HUNTER:'#87b877',CRYSTAL:'#b389de',
  MAGNET:'#a4a9b8',ICE:'#79bddf',MIRROR:'#ddd0b6',
};
const sortWeapons=(w)=>w.sort((a,b)=>{
  const tierA=Number(a.tier?.replace('T',''))||0;
  const tierB=Number(b.tier?.replace('T',''))||0;
  return tierA-tierB||a.id.localeCompare(b.id);
});
function getWeaponEntries(){
  const config=window.APEX_ARSENAL_CONFIG;
  if(!config?.WEAPONS)return [];
  return sortWeapons(Object.entries(config.WEAPONS).map(([id,data])=>({
    id,name:data?.name||data?.art||id.replaceAll('_',' '),
    tier:config.tierOf?.(id)||data?.tier||'—',
    family:data?.family||data?.kind||'Equipment',
  })).filter(o=>o.id!=='T6' && o.id!=='STORMBREAKER_INTERNAL'));
}
function currentlyHome() {
  const stage=document.getElementById('stage');
  if (!document.body.classList.contains('apex-gold-mounted') ||
      document.getElementById('apex-boot-start') || !stage ||
      window.gameState==='ARSENAL') return false;
  return !['screen-mode','screen-fighter','screen-draw','screen-battle','flow-transition']
    .some(v=>stage.classList.contains(v));
}
export default function CosmeticLocker() {
  const [home,setHome]=useState(false);
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [loadError,setLoadError]=useState('');
  const [tab,setTab]=useState('hero');
  const [side,setSide]=useState('p1');
  const [focusId,setFocusId]=useState('ROBOT');
  const [query,setQuery]=useState('');
  const [weapons,setWeapons]=useState([]);
  const [revision,setRevision]=useState(0);
  const [saveWarning,setSaveWarning]=useState(false);
  useEffect(()=>{
    const update=()=>{
      const active=currentlyHome();
      setHome(active);
      if(!active)setOpen(false);
    };
    const t=setInterval(update,400);
    const stop=cosmetics.subscribe(()=>setRevision(n=>n+1));
    const openEvent=()=>void launch();
    window.addEventListener('apex-open-cosmetics',openEvent);
    update();
    return ()=>{clearInterval(t);stop();window.removeEventListener('apex-open-cosmetics',openEvent)};
  },[]);
  useEffect(()=>{
    if(!open)return;
    const esc=(e)=>{if(e.key==='Escape')setOpen(false)};
    document.body.classList.add('apex-cosmetic-locker-open');
    window.addEventListener('keydown',esc);
    return ()=>{document.body.classList.remove('apex-cosmetic-locker-open');window.removeEventListener('keydown',esc)};
  },[open]);
  async function launch(){
    if(!currentlyHome()||loading)return;
    setLoading(true);setLoadError('');
    try{
      await loadDeferredGameRuntimes('arsenalHub');
      setWeapons(getWeaponEntries());
      setOpen(true);
    }catch(e){
      setLoadError(String(e?.message||e));
    }finally{setLoading(false)}
  }
  const entities=useMemo(()=>tab==='hero'
    ?PRODUCT_ROSTER.playableIds.map(id=>({id,name:heroNames[id]||id,tier:'HERO',family:'Fighter'}))
    :weapons,[tab,weapons]);
  const visible=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return entities.filter(x=>!q||x.name.toLowerCase().includes(q)||x.id.toLowerCase().includes(q));
  },[entities,query]);
  const active=visible.find(x=>x.id===focusId)||visible[0]||null;
  const skins=active?cosmetics.variants(tab,active.id):[];
  const equipped=active?cosmetics.selected(side,tab,active.id):null;
  const variantsAvailable=skins.length>1;
  const onEquip=(id)=>{
    if(!active)return;
    const result=cosmetics.equip(side,tab,active.id,id);
    if(result.ok)setSaveWarning(result.persisted===false);
  };
  function changeTab(t){
    setTab(t);setQuery('');setFocusId(t==='hero'?'ROBOT':weapons[0]?.id||'');
  }
  return <>
    {home&&!open&&<button className="apex-skin-entry" type="button" onClick={launch}
      disabled={loading} title="Open fighter and weapon cosmetic locker">
      <span className="apex-skin-entry-mark" aria-hidden="true">✦</span>
      <span>{loading?'LOADING':'SKINS'}</span>
      <span aria-hidden="true">↗</span>
    </button>}
    {home&&!open&&loadError&&<div className="apex-skin-error" role="alert">
      Cosmetic catalogue unavailable: {loadError}
      <button type="button" onClick={()=>setLoadError('')}>×</button>
    </div>}
    {open&&<div className="apex-cosmetics-overlay" role="presentation"
      // A modal must own its keyboard input. Gold's global keydown handler
      // must never intercept search typing, P1/P2 controls or focused tabs.
      onKeyDownCapture={e=>{
        e.stopPropagation();
        if(e.key==='Escape'){e.preventDefault();setOpen(false)}
      }}
      onKeyUpCapture={e=>e.stopPropagation()}
      onMouseDown={e=>{
        if(e.target===e.currentTarget)setOpen(false);
      }}>
      <section className="apex-cosmetics" role="dialog" aria-modal="true" aria-labelledby="apex-cosmetics-title">
        <header className="apex-cosmetics-head">
          <div><div className="apex-cosmetics-eyebrow">APEX CHAOS / PERSONALIZATION</div>
            <h2 id="apex-cosmetics-title">COSMETIC LOCKER <span>✦</span></h2>
            <p>Choose a look for each fighter and each weapon. Combat stays identical.</p></div>
          <button className="apex-cosmetics-close" type="button" onClick={()=>setOpen(false)} aria-label="Close skin locker">×</button>
        </header>
        <div className="apex-cosmetics-tools">
          <div className="apex-cosmetics-tabs" role="tablist" aria-label="Cosmetic category">
            <button type="button" role="tab" aria-selected={tab==='hero'} className={tab==='hero'?'on':''} onClick={()=>changeTab('hero')}>FIGHTER SKINS</button>
            <button type="button" role="tab" aria-selected={tab==='weapon'} className={tab==='weapon'?'on':''} onClick={()=>changeTab('weapon')}>WEAPON SKINS</button>
          </div>
          <div className="apex-cosmetics-sides" aria-label="Player loadout">
            <button type="button" className={side==='p1'?'on':''} aria-pressed={side==='p1'} onClick={()=>setSide('p1')}>P1</button>
            <button type="button" className={side==='p2'?'on':''} aria-pressed={side==='p2'} onClick={()=>setSide('p2')}>P2 / BOT</button>
          </div>
        </div>
        <div className="apex-cosmetics-content">
          <aside className="apex-cosmetics-catalogue">
            <label htmlFor="apex-cosmetics-search">CHOOSE {tab==='hero'?'FIGHTER':'WEAPON'} <span>{entities.length}</span></label>
            <input id="apex-cosmetics-search" type="search" value={query}
              onChange={e=>setQuery(e.target.value)} placeholder="Search catalogue…" autoComplete="off"/>
            <div className="apex-cosmetics-list" role="listbox" aria-label={tab==='hero'?'Fighters':'Weapons'}>
              {visible.map(item=>{
                const chosen=active?.id===item.id;
                const selectedSkin=cosmetics.selected(side,tab,item.id);
                return <button key={item.id} type="button" role="option" aria-selected={chosen}
                  className={'apex-cosmetics-item'+(chosen?' on':'')}
                  onClick={()=>setFocusId(item.id)}>
                  <span className="apex-cosmetics-item-icon" style={{'--accent':heroColors[item.id]||'#d1b37a'}}>{item.name.slice(0,2)}</span>
                  <span className="apex-cosmetics-item-copy"><strong>{item.name}</strong><small>{item.tier} · {selectedSkin.id==='default'?'ORIGINAL':selectedSkin.label}</small></span>
                  <span className="apex-cosmetics-item-arrow">›</span>
                </button>
              })}
              {!visible.length&&<p className="apex-cosmetics-empty">No matching entries.</p>}
            </div>
          </aside>
          <article className="apex-cosmetics-detail" key={tab+'-'+active?.id}>
            {active?<>
              <div className="apex-cosmetics-art" style={{'--accent':heroColors[active.id]||'#d1b37a'}}>
                <div className="apex-cosmetics-orbit" aria-hidden="true"></div>
                <span className="apex-cosmetics-monogram">{active.name.slice(0,2)}</span>
                <span className="apex-cosmetics-art-number">{active.tier}</span>
                <span className="apex-cosmetics-art-caption">COSMETIC PREVIEW / {active.id}</span>
              </div>
              <div className="apex-cosmetics-detail-head">
                <div><small>{tab==='hero'?'FIGHTER':'WEAPON'} · {active.family}</small>
                  <h3>{active.name}</h3></div>
                <span className="apex-cosmetics-loaded">PLAYER {side==='p1'?'01':'02'}</span>
              </div>
              <div className="apex-cosmetics-skinlabel">AVAILABLE APPEARANCES <span>{skins.length}</span></div>
              <div className="apex-cosmetics-skins">
                {skins.map(skin=><button type="button" key={skin.id}
                  className={'apex-cosmetics-skin'+(equipped?.id===skin.id?' selected':'')}
                  onClick={()=>onEquip(skin.id)} aria-pressed={equipped?.id===skin.id}>
                  <span className="apex-cosmetics-skin-swatch">{skin.preview?<img src={skin.preview} alt="" />:'✦'}</span>
                  <span className="apex-cosmetics-skin-copy"><strong>{skin.label}</strong>
                    <small>{skin.id==='default'?'Base visual identity':skin.detail||'Alternate presentation'}</small></span>
                  <span className="apex-cosmetics-skin-status">{equipped?.id===skin.id?'EQUIPPED':'EQUIP'}</span>
                </button>)}
              </div>
              {!variantsAvailable&&<p className="apex-cosmetics-notice">
                Alternate skins will appear here when their approved artwork and effect packs are registered.
                The original appearance is available now.
              </p>}
              {saveWarning&&<p className="apex-cosmetics-warning" role="alert">Skin selected for this session, but browser storage is unavailable.</p>}
            </>:<p className="apex-cosmetics-empty">No content in this category.</p>}
          </article>
        </div>
        <footer className="apex-cosmetics-foot">
          <span>VISUAL ONLY / NO DAMAGE, SPEED OR COOLDOWN CHANGES</span>
          <button type="button" onClick={()=>setOpen(false)}>RETURN TO HOME ↗</button>
        </footer>
      </section>
    </div>}
  </>;
}
