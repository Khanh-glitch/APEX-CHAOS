import React, {useCallback,useEffect,useRef,useState} from 'react';
import './productSessionNavigation.css';

// The owner visual documents do NOT own our game navigation. This adapter only
// coordinates their canonical entry/exit mechanisms, preserving the true AC
// wallet, Gold draw animation and Field Archive data.
const SECTIONS=['Missions','Mastery','Account','Lucky Draw','Archive'];
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
const luckyHost=()=>document.getElementById('luckyDonorHost');
const luckyActive=()=>!!luckyHost()?.classList.contains('is-open');
const archiveActive=()=>!!document.querySelector('.fa3-overlay.apex-cosmetics-overlay');
const goldActive=()=>!!document.querySelector('.apex-gold-direct-host iframe');
const busyDraw=()=>{
 if(!luckyActive())return false;
 const stage=document.getElementById('luckyDonorFrame')?.contentDocument?.getElementById('stage');
 return !!stage&&stage.dataset.busy!=='0';
};
const interactive='button,a,input,textarea,select,[contenteditable],[role="button"],[role="tab"],[role="dialog"],.drawer,.fa3-index-list,.fa3-record-navigation,.fa3-appear,.fa3-detail';
function isProtectedTarget(target){
 return !!target?.closest?.(interactive);
}

export default function ProductSessionNavigator(){
 const [visible,setVisible]=useState(-1);
 const moving=useRef(false),gesture=useRef(null),attachedFrame=useRef(null);
 const activeSurface=useCallback(()=>{
  if(archiveActive())return 4;
  if(luckyActive())return 3;
  return -1; // Gold supplies its own integrated dots and navigation.
 },[]);
 const navigate=useCallback(async(index)=>{
  if(!Number.isInteger(index)||index<0||index>=SECTIONS.length||moving.current)return false;
  const current=activeSurface();
  if(current===index)return true;
  if(window.APEX_SCENE_TRANSITION?.active?.()||document.getElementById('apex-wave-host'))return false;
  if(luckyActive()&&busyDraw())return false; // NEVER interrupt a paid draw.
  moving.current=true;
  try{
   if(archiveActive()){
    window.dispatchEvent(new Event('apex-close-cosmetics'));
    await waitFor(()=>!archiveActive());
   }
   if(luckyActive()){
    const frame=document.getElementById('luckyDonorFrame');
    const back=frame?.contentDocument?.getElementById('backBtn');
    if(!back)throw Error('Missing original Lucky Draw BACK button');
    back.click(); // canonical donor => Gold scene-transition coordinator
    await waitFor(()=>!luckyActive()&&!window.APEX_SCENE_TRANSITION?.active?.());
   }
   if(goldActive()&&index>2){
    window.__APEX_GOLD_BRIDGE__?.close?.();
    await waitFor(()=>!goldActive());
   }
   if(index<=2){
    if(goldActive()){
      // Reuse the mounted Gold document for interior navigation, no reload.
      document.querySelector('.apex-gold-direct-host iframe')?.contentWindow?.postMessage(
        {type:'APEX_GOLD_SECTION_SELECT',index},location.origin);
    }else if(index===2){
      window.APEX_ACCOUNT_CENTER?.open?.();
    }else{
      window.APEX_PROGRESSION_CENTER?.open?.(index===1?'mastery':'mission');
    }
    await waitFor(goldActive);
    return true;
   }
   if(index===3){
    const entry=document.getElementById('openLuckyDraw');
    if(!entry)throw Error('Missing owner Gold Lucky Draw entry');
    entry.click(); // same Gold donor bridge as Home; never paint a fake wheel
    await waitFor(()=>luckyActive()&&!window.APEX_SCENE_TRANSITION?.active?.());
    setVisible(3);
    return true;
   }
   window.dispatchEvent(new Event('apex-open-dictionary'));
   await waitFor(archiveActive);
   setVisible(4);
   return true;
  }catch(e){
   console.warn('[apex-section-nav]',e);
   return false;
  }finally{
   moving.current=false;
  }
 },[activeSurface]);

 useEffect(()=>{
  const onRoute=e=>{const index=Number(e.detail?.index);if(Number.isInteger(index))void navigate(index);};
  window.addEventListener('apex:session-navigate',onRoute);
  return()=>window.removeEventListener('apex:session-navigate',onRoute);
 },[navigate]);

 useEffect(()=>{
  let attachedDoc=null;
  const usePointer=(getSection)=>{
   const down=e=>{
    if(!e.isPrimary||!['touch','pen','mouse'].includes(e.pointerType)||e.button!==0)return;
    if(window.APEX_SCENE_TRANSITION?.active?.()||busyDraw()||isProtectedTarget(e.target))return;
    if(document.querySelector('.fa3-overlay .sheet'))return;
    gesture.current={pointerId:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),from:getSection()};
   };
   const up=e=>{
    const start=gesture.current;gesture.current=null;
    if(!start||start.pointerId!==e.pointerId||start.from<3||getSection()!==start.from)return;
    const dx=e.clientX-start.x,dy=e.clientY-start.y;
    if(Math.abs(dx)<72||Math.abs(dx)<1.45*Math.abs(dy)||performance.now()-start.time>1350)return;
    const next=start.from+(dx<0?1:-1);
    if(next>=0&&next<SECTIONS.length)void navigate(next);
   };
   return {down,up};
  };
  const bindings=usePointer(activeSurface);
  const onArchiveDown=e=>{if(archiveActive()&&e.target?.closest?.('.fa3-overlay'))bindings.down(e);};
  const onArchiveUp=e=>{if(archiveActive())bindings.up(e);};
  document.addEventListener('pointerdown',onArchiveDown,true);
  document.addEventListener('pointerup',onArchiveUp,true);
  document.addEventListener('pointercancel',()=>{gesture.current=null;},true);
  const onLuckyDown=e=>{if(luckyActive())bindings.down(e);};
  const onLuckyUp=e=>{if(luckyActive())bindings.up(e);};
  const interval=window.setInterval(()=>{
   const current=activeSurface();
   setVisible(old=>old===current?old:current);
   const frame=document.getElementById('luckyDonorFrame');
   let doc=null;
   try{doc=frame?.contentDocument?.getElementById('stage')?frame.contentDocument:null;}catch{}
   if(doc===attachedDoc)return;
   if(attachedDoc){attachedDoc.removeEventListener('pointerdown',onLuckyDown,true);
     attachedDoc.removeEventListener('pointerup',onLuckyUp,true);
     delete attachedDoc.documentElement.dataset.apexSectionSwipeReady;}
   attachedDoc=doc;
   if(doc){doc.addEventListener('pointerdown',onLuckyDown,true);doc.addEventListener('pointerup',onLuckyUp,true);
     doc.documentElement.dataset.apexSectionSwipeReady='1';}
  },190);
  return()=>{
   window.clearInterval(interval);
   document.removeEventListener('pointerdown',onArchiveDown,true);
   document.removeEventListener('pointerup',onArchiveUp,true);
   if(attachedDoc){attachedDoc.removeEventListener('pointerdown',onLuckyDown,true);
     attachedDoc.removeEventListener('pointerup',onLuckyUp,true);
     delete attachedDoc.documentElement.dataset.apexSectionSwipeReady;}
  };
 },[navigate,activeSurface]);

 if(visible<3)return null;
 return <nav className="apex-session-interchange" aria-label="Navigate APEX CHAOS sections" data-session-index={visible}>
  <button type="button" disabled={moving.current||visible===0} onClick={()=>void navigate(visible-1)}
    aria-label={'Previous section: '+SECTIONS[visible-1]}>‹ <span>{SECTIONS[visible-1]}</span></button>
  <div className="apex-session-interchange-pos" aria-label={SECTIONS[visible]}>
   {SECTIONS.map((s,i)=><i key={s} className={i===visible?'on':''}/>)}
  </div>
  <button type="button" disabled={moving.current||visible===SECTIONS.length-1} onClick={()=>void navigate(visible+1)}
    aria-label={visible===4?'End of sections':'Next section: '+SECTIONS[visible+1]}>
   <span>{SECTIONS[visible+1]||'END'}</span> ›</button>
 </nav>;
}
