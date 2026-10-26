import React, {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './productSessionNavigation.css';

// Single ordered registry. Upgrade and Fighter Shop can join here once they
// expose real game-owned open/close contracts; no speculative screen or wallet.
const SECTIONS=[
 {id:'missions',label:'Missions'},
 {id:'mastery',label:'Mastery'},
 {id:'account',label:'Account'},
 {id:'lucky',label:'Lucky Draw'},
 {id:'archive',label:'Archive'},
];
const sleep=ms=>new Promise(resolve=>window.setTimeout(resolve,ms));
const waitFor=(test,maxMs=18000)=>new Promise((resolve,reject)=>{
 const started=performance.now();
 const poll=()=>{
  let yes=false;try{yes=!!test()}catch{}
  if(yes){resolve(true);return;}
  if(performance.now()-started>maxMs){reject(Error('APEX session navigation timed out'));return;}
  window.setTimeout(poll,85);
 };
 poll();
});
const luckyFrame=()=>document.getElementById('luckyDonorFrame');
const luckyActive=()=>!!document.getElementById('luckyDonorHost')?.classList.contains('is-open');
const archiveActive=()=>!!document.querySelector('.fa3-overlay.apex-cosmetics-overlay');
const goldFrame=()=>document.querySelector('.apex-gold-direct-host iframe');
const goldActive=()=>!!goldFrame();
const goldReady=()=>!!goldFrame()?.contentDocument?.querySelector('main h1');
const busyDraw=()=>luckyActive()&&luckyFrame()?.contentDocument?.getElementById('stage')?.dataset.busy!=='0';
const interactive='button,a,input,textarea,select,[contenteditable],[role="button"],[role="tab"],.drawer,.fa3-index-list,.fa3-record-navigation,.fa3-appear,.fa3-detail';
const isProtectedTarget=target=>!!target?.closest?.(interactive);

// The donor owns its own document. This integration-only skin is injected
// into its native HUD without modifying the approved Gold draw artwork.
const LUCKY_STYLE=`
#stage .apex-inline-session{display:flex;align-items:center;gap:4px;height:var(--hud-btn);margin:0;padding:0;font:800 11px/1 Arial,sans-serif}
#stage .apex-inline-session button{display:flex;align-items:center;justify-content:center;gap:5px;height:var(--hud-btn);min-width:var(--hud-btn);padding:0 8px;background:rgba(15,12,10,.9);color:#ffe1ac;box-shadow:inset 0 0 0 1px rgba(255,162,59,.55);cursor:pointer;font:inherit;letter-spacing:.04em}
#stage .apex-inline-session button:focus-visible{outline:2px solid #fff2cb;outline-offset:2px}
#stage .apex-inline-dots{display:flex;align-items:center;gap:3px;margin:0 2px}
#stage .apex-inline-dots i{width:8px;height:3px;background:#8a6240}
#stage .apex-inline-dots i.current{width:14px;background:#ffd16f}
#stage:not([data-layout="desk"]) .apex-inline-session button{padding:0}
#stage:not([data-layout="desk"]) .apex-inline-session button span,#stage:not([data-layout="desk"]) .apex-inline-dots{display:none}
#stage[data-layout="port"] .apex-inline-session{gap:3px}
#stage[data-layout="port"] .hud-l:has(.apex-inline-session) .title{display:none}
`;

export default function ProductSessionNavigator(){
 const [visible,setVisible]=useState(-1);
 const [mount,setMount]=useState(null);
 const [wipe,setWipe]=useState(null);
 const moving=useRef(false),gesture=useRef(null),queued=useRef(null);
 const activeSurface=useCallback(()=>{
  if(archiveActive())return 4;
  if(luckyActive())return 3;
  return -1; // Gold has its own native wipe, guide and navigation.
 },[]);

 const navigate=useCallback(async(index)=>{
  if(!Number.isInteger(index)||index<0||index>=SECTIONS.length)return false;
  // A destination is already interactive while its final Gold wipe
  // retracts. Never drop an immediate second swipe: keep the latest intent
  // and execute it once the preceding transition settles.
  if(moving.current){queued.current=index;return false;}
  const current=activeSurface();
  if(current===index)return true;
  if(document.getElementById('apex-wave-host')||busyDraw())return false;
  moving.current=true;
  const external=current>=3||index>=3;
  const label=SECTIONS[index].label.toUpperCase();
  try{
   // Never discard gestures while the Home scene Door is still opening.
   if(window.APEX_SCENE_TRANSITION?.active?.()){
    await waitFor(()=>!window.APEX_SCENE_TRANSITION?.active?.(),20000);
   }
   // Match the Account–Mission orange Gold wipe on all cross-doc routes.
   // Hold the plate closed while the actual destination is hydrating.
   if(external){setWipe({phase:'cover',label});await sleep(425);}
   if(archiveActive()){
    window.dispatchEvent(new Event('apex-close-cosmetics'));
    await waitFor(()=>!archiveActive());
   }
   if(luckyActive()){
    const donor=window.APEX_LUCKY_SESSION;
    if(!donor?.closeToSection)throw Error('Lucky direct session bridge missing');
    await donor.closeToSection(); // NOT Lucky BACK => Home scene Door.
    await waitFor(()=>!luckyActive());
   }
   if(goldActive()&&index>2){
    window.__APEX_GOLD_BRIDGE__?.close?.();
    await waitFor(()=>!goldActive());
   }
   if(index<=2){
    if(goldActive()){
     goldFrame()?.contentWindow?.postMessage({type:'APEX_GOLD_SECTION_SELECT',index},location.origin);
    }else if(index===2){
     window.APEX_ACCOUNT_CENTER?.open?.();
    }else{
     window.APEX_PROGRESSION_CENTER?.open?.(index===1?'mastery':'mission');
    }
    await waitFor(goldReady);
   }else if(index===3){
    if(!window.APEX_LUCKY_SESSION?.openFromSection)throw Error('Lucky direct session bridge missing');
    await window.APEX_LUCKY_SESSION.openFromSection();
    await waitFor(luckyActive);
   }else{
    window.dispatchEvent(new Event('apex-open-dictionary'));
    await waitFor(archiveActive);
   }
   if(external){setWipe({phase:'release',label});await sleep(435);}
   return true;
  }catch(e){
   console.warn('[apex-section-nav]',e);
   return false;
  }finally{
   setWipe(null);
   moving.current=false;
   const next=queued.current;
   queued.current=null;
   if(Number.isInteger(next))window.setTimeout(()=>{void navigate(next);},0);
  }
 },[activeSurface]);

 useEffect(()=>{
  const onRoute=e=>{
   const index=Number(e.detail?.index);
   if(Number.isInteger(index))void navigate(index);
  };
  window.addEventListener('apex:session-navigate',onRoute);
  return()=>window.removeEventListener('apex:session-navigate',onRoute);
 },[navigate]);

 useEffect(()=>{
  let attachedDoc=null;
  const down=e=>{
   if(!e.isPrimary||!['touch','pen','mouse'].includes(e.pointerType)||e.button!==0)return;
   if(busyDraw()||isProtectedTarget(e.target))return;
   if(document.querySelector('.fa3-overlay .sheet'))return;
   gesture.current={pointerId:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),from:activeSurface()};
  };
  const up=e=>{
   const start=gesture.current;gesture.current=null;
   if(!start||start.pointerId!==e.pointerId||start.from<3||activeSurface()!==start.from)return;
   const dx=e.clientX-start.x,dy=e.clientY-start.y;
   if(Math.abs(dx)<72||Math.abs(dx)<1.45*Math.abs(dy)||performance.now()-start.time>1350)return;
   const next=start.from+(dx<0?1:-1);
   if(next>=0&&next<SECTIONS.length)void navigate(next);
  };
  const cancel=()=>{gesture.current=null;};
  const onArchiveDown=e=>{if(archiveActive()&&e.target?.closest?.('.fa3-overlay'))down(e);};
  const onArchiveUp=e=>{if(archiveActive())up(e);};
  const onLuckyDown=e=>{if(luckyActive())down(e);};
  const onLuckyUp=e=>{if(luckyActive())up(e);};
  document.addEventListener('pointerdown',onArchiveDown,true);
  document.addEventListener('pointerup',onArchiveUp,true);
  document.addEventListener('pointercancel',cancel,true);
  const interval=window.setInterval(()=>{
   const current=activeSurface();
   setVisible(old=>old===current?old:current);
   const frame=luckyFrame();
   let doc=null;
   try{doc=frame?.contentDocument?.getElementById('stage')?frame.contentDocument:null;}catch{}
   const node=current===3?doc?.querySelector('.hud-l'):
    current===4?document.querySelector('.fa3-overlay .fa3-header'):null;
   setMount(old=>old?.node===node&&old?.section===current?old:node?{node,section:current}:null);
   if(doc===attachedDoc)return;
   if(attachedDoc){
    attachedDoc.removeEventListener('pointerdown',onLuckyDown,true);
    attachedDoc.removeEventListener('pointerup',onLuckyUp,true);
    delete attachedDoc.documentElement.dataset.apexSectionSwipeReady;
   }
   attachedDoc=doc;
   if(doc){
    doc.addEventListener('pointerdown',onLuckyDown,true);
    doc.addEventListener('pointerup',onLuckyUp,true);
    doc.documentElement.dataset.apexSectionSwipeReady='1';
   }
  },125);
  return()=>{
   window.clearInterval(interval);
   document.removeEventListener('pointerdown',onArchiveDown,true);
   document.removeEventListener('pointerup',onArchiveUp,true);
   document.removeEventListener('pointercancel',cancel,true);
   if(attachedDoc){
    attachedDoc.removeEventListener('pointerdown',onLuckyDown,true);
    attachedDoc.removeEventListener('pointerup',onLuckyUp,true);
    delete attachedDoc.documentElement.dataset.apexSectionSwipeReady;
   }
  };
 },[navigate,activeSurface]);

 const nav=visible>=3?<nav className="apex-inline-session" aria-label="APEX section navigation" data-session-index={visible}>
  <button type="button" disabled={moving.current||visible===0} onClick={()=>void navigate(visible-1)}
   aria-label={'Previous section: '+SECTIONS[visible-1]?.label}>‹ <span>{SECTIONS[visible-1]?.label.toUpperCase()}</span></button>
  <div className="apex-inline-dots" aria-label={SECTIONS[visible].label}>
   {SECTIONS.map((s,i)=><i key={s.id} className={i===visible?'current':''}/>)}
  </div>
  {visible<SECTIONS.length-1&&<button type="button" disabled={moving.current} onClick={()=>void navigate(visible+1)}
   aria-label={'Next section: '+SECTIONS[visible+1].label}>
    <span>{SECTIONS[visible+1].label.toUpperCase()}</span> ›
  </button>}
 </nav>:null;

 return <>
  {mount?.section===visible&&createPortal(<>
   {visible===3&&<style>{LUCKY_STYLE}</style>}
   {nav}
  </>,mount.node)}
  {wipe&&<div className={'apex-session-wipe '+(wipe.phase==='release'?'is-releasing':'is-covering')}
   aria-hidden="true" data-testid="apex-session-wipe">
   <div className="apex-session-wipe-plate"><span>{wipe.label}</span></div>
  </div>}
 </>;
}
