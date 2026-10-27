import React, {useCallback,useEffect,useRef,useState} from 'react';
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

export default function ProductSessionNavigator(){
 const [visible,setVisible]=useState(-1);
 const [wipe,setWipe]=useState(null);
 const [coach,setCoach]=useState(false);
 const moving=useRef(false),gesture=useRef(null),queued=useRef(null);
 const hintTimer=useRef(null);
 const lessonShown=useRef(false);
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
  const onKeys=e=>{
   if(!e.altKey||!['ArrowLeft','ArrowRight'].includes(e.key)||e.repeat)return;
   if(e.target?.closest?.('input,textarea,select,[contenteditable],[role="dialog"]'))return;
   const current=activeSurface();
   if(current<3)return; // Gold owns the other three sections.
   e.preventDefault();
   void navigate(current+(e.key==='ArrowRight'?1:-1));
  };
  document.addEventListener('pointerdown',onArchiveDown,true);
  document.addEventListener('pointerup',onArchiveUp,true);
  document.addEventListener('pointercancel',cancel,true);
  window.addEventListener('keydown',onKeys);
  const interval=window.setInterval(()=>{
   const current=activeSurface();
   setVisible(old=>old===current?old:current);
   // One unified first-entry instruction for the complete five-section rail.
   // The same key is used by the Gold Missions/Mastery/Account document.
   if(current>=3&&!lessonShown.current){
    lessonShown.current=true;
    let first=false;
    try{
     first=localStorage.getItem('apex.gold.sections.swipe.v3')!=='seen';
     if(first)localStorage.setItem('apex.gold.sections.swipe.v3','seen');
    }catch{first=true;}
    if(first){
     setCoach(true);
     hintTimer.current=window.setTimeout(()=>setCoach(false),6000);
    }
   }
   if(current<3)setCoach(false);
   const frame=luckyFrame();
   let doc=null;
   try{doc=frame?.contentDocument?.getElementById('stage')?frame.contentDocument:null;}catch{}
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
   if(hintTimer.current)window.clearTimeout(hintTimer.current);
   window.removeEventListener('keydown',onKeys);
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

 return <>
  {/* The native Gold HUD / Lucky HUD / Archive header remains unobstructed.
      A five-position progress rail is visual-only; swipe is the navigation. */}
  {visible>=3&&<div className="apex-session-position" data-session-index={visible}
    role="status" aria-label={SECTIONS[visible].label+" — swipe horizontally to change section"}>
    {SECTIONS.map((section,index)=><span key={section.id}
      className={visible===index?'is-current':''} aria-current={visible===index?'step':undefined}/>)}
  </div>}
  {visible>=3&&coach&&<div className="apex-session-coach" data-testid="apex-session-swipe-coach"
    role="status" aria-live="polite">
    <div className="apex-session-coach-copy">VUỐT TRÁI / PHẢI · SWIPE LEFT / RIGHT</div>
    <div className="apex-session-coach-track" aria-hidden="true">
      <span>‹</span>
      <svg className="apex-session-coach-hand" viewBox="0 0 56 68" width="46" height="56" fill="none">
        <path d="M15 30v-6a4 4 0 018 0V11a4 4 0 018 0v17-9a4 4 0 018 0v12-7a4 4 0 018 0v19c0 8-4 14-12 17l-10 3-11-9L5 42a5 5 0 017-6l8 6V30"
          fill="#ffe5ae" stroke="#78380f" strokeWidth="2.5" strokeLinejoin="round"/>
      </svg>
      <span>›</span>
    </div>
  </div>}
  {wipe&&<div className={'apex-session-wipe '+(wipe.phase==='release'?'is-releasing':'is-covering')}
   aria-hidden="true" data-testid="apex-session-wipe">
   <div className="apex-session-wipe-plate"><span>{wipe.label}</span></div>
  </div>}
 </>;
}
