import React, {useEffect, useRef, useState} from 'react';
import playerAccount from '../game/playerAccount.js';
import {apexAppUrl} from '../game/appRoot.js';
import './firstSessionWelcome.css';

// Real local identity, not a simulated Google/email login.
// Once completed this is hidden persistently. Help can replay the real tutorial.
const KEY='apex.firstSessionWelcome.v1';
function readDone(){try{return localStorage.getItem(KEY)==='done';}catch{return false;}}
const COPY={
 vie:{section:'PLAYER ACCESS',headline:'CHÀO MỪNG',accent:'CHIẾN BINH',intro:'CẤP QUYỀN TRUY CẬP',id:'DANH TÍNH',experience:'KINH NGHIỆM',
  name:'DANH HIỆU TRÊN ĐẤU TRƯỜNG',placeholder:'NHẬP TÊN CHIẾN BINH',
  next:'XÁC NHẬN DANH TÍNH',who:'CHỌN CÁCH BẮT ĐẦU',new:'TÂN BINH',veteran:'KỲ CỰU',
  newDesc:'Vào game và bật hướng dẫn thực chiến',veteranDesc:'Vào thẳng Home, không bật hướng dẫn',
  local:'HỒ SƠ CỤC BỘ',privacy:'Tiến trình lưu trên thiết bị. Đăng nhập trực tuyến chưa được bật trong bản này.',
  error:'Tên chiến binh cần ít nhất 2 ký tự.'},
 eng:{section:'PLAYER ACCESS',headline:'WELCOME',accent:'FIGHTER',intro:'ACCESS AUTHORIZATION',id:'IDENTITY',experience:'EXPERIENCE',
  name:'ARENA CALLSIGN',placeholder:'ENTER FIGHTER NAME',
  next:'CONFIRM IDENTITY',who:'SELECT ENTRY PROTOCOL',new:'ROOKIE',veteran:'VETERAN',
  newDesc:'Enter the arena with the interactive tutorial',veteranDesc:'Go straight to Home with no tutorial',
  local:'LOCAL PROFILE',privacy:'Progress is saved on this device. Online sign-in is not enabled in this release.',
  error:'Fighter name must contain at least 2 characters.'}
};
const ASSETS={
 background:apexAppUrl('/gold/assets/gold/home-world-background.png'),
 fighter:apexAppUrl('/gold/assets/gold/home-robot-body.png'),
 brand:apexAppUrl('/gold/assets/gold/apex-chaos-wordmark.png')
};
export default function FirstSessionWelcome({ready=false}){
 const [done,setDone]=useState(readDone);
 const [step,setStep]=useState('identity');
 const [name,setName]=useState(()=>{
  const p=playerAccount.profile();
  return p.kind==='guest'&&p.displayName?.startsWith('GUEST-')?'':(p.displayName||'');
 });
 const [error,setError]=useState('');
 const [language,setLanguage]=useState(()=>window.APEX_I18N?.getLanguage?.()==='vie'?'vie':'eng');
 const field=useRef(null);
 useEffect(()=>{if(ready&&!done&&step==='identity')field.current?.focus();},[ready,done,step]);
 useEffect(()=>{
  const update=()=>setLanguage(window.APEX_I18N?.getLanguage?.()==='vie'?'vie':'eng');
  window.addEventListener('apex:language-changed',update);
  return()=>window.removeEventListener('apex:language-changed',update);
 },[]);
 useEffect(()=>{
  // Gold game hotkeys are globally captured. Never steal name input.
  const stop=e=>{if(e.target?.closest?.('.apex-welcome-gate input'))e.stopImmediatePropagation();};
  for(const event of ['keydown','keyup','keypress'])window.addEventListener(event,stop,true);
  return()=>{for(const event of ['keydown','keyup','keypress'])window.removeEventListener(event,stop,true);};
 },[]);
 if(!ready||done)return null;
 const t=COPY[language];
 const advance=e=>{
  e.preventDefault();
  const clean=name.trim().slice(0,24);
  if(clean.length<2){setError(t.error);return;}
  playerAccount.setDisplayName(clean);
  setError('');
  setStep('experience');
 };
 const choose=tutorial=>{
  window.dispatchEvent(new CustomEvent('apex:tutorial-answer',{detail:{enable:tutorial}}));
  try{localStorage.setItem(KEY,'done');}catch{}
  setDone(true);
 };
 return <div className="apex-welcome-gate" role="dialog" aria-modal="true" aria-label={t.headline+' '+t.accent} data-apex-no-localize="">
  <div className="apex-welcome-world" style={{backgroundImage:`url("${ASSETS.background}")`}} aria-hidden="true"/>
  <div className="apex-welcome-robot" style={{backgroundImage:`url("${ASSETS.fighter}")`}} aria-hidden="true"/>
  <div className="apex-welcome-grit" aria-hidden="true"/>
  <header className="apex-welcome-brand">
   <img src={ASSETS.brand} alt="APEX CHAOS" decoding="async"/>
   <span>{t.section} <em> // 001</em></span>
  </header>
  <main className="apex-welcome-panel">
   <div className="apex-welcome-toprail"><span>{t.intro}</span><span>SYS · AC-01</span></div>
   <div className="apex-welcome-steps" aria-label={step==='identity'?t.id:t.experience}>
    <span className={step==='identity'?'is-current':'is-complete'}>01 <small>{t.id}</small></span>
    <i aria-hidden="true"/>
    <span className={step==='experience'?'is-current':''}>02 <small>{t.experience}</small></span>
   </div>
   <div className="apex-welcome-hero-copy">
    <span className="apex-welcome-eyebrow"><i aria-hidden="true"/> APEX // DEPLOYMENT PROTOCOL</span>
    <h1><span>{t.headline}</span><strong>{t.accent}</strong></h1>
    <p className="apex-welcome-subtitle">{step==='identity'?t.name:t.who}</p>
   </div>
   {step==='identity'?<form className="apex-welcome-form" onSubmit={advance}>
     <label htmlFor="apex-welcome-name">{t.name}</label>
     <div className="apex-welcome-field"><span aria-hidden="true">ID //</span>
      <input ref={field} id="apex-welcome-name" value={name} maxLength={24}
       onChange={e=>setName(e.target.value)} placeholder={t.placeholder} autoComplete="nickname" required/>
     </div>
     {error&&<p className="apex-welcome-error" role="alert">{error}</p>}
     <button type="submit" className="apex-welcome-primary"><span>{t.next}</span><b aria-hidden="true">❯</b></button>
    </form>:
    <div className="apex-welcome-experience" role="group" aria-label={t.who}>
     <button type="button" className="apex-welcome-choice" onClick={()=>choose(true)}>
      <span className="apex-welcome-choice-id">01</span>
      <span className="apex-welcome-choice-copy"><strong>{t.new}</strong><small>{t.newDesc}</small></span>
      <span className="apex-welcome-choice-arrow" aria-hidden="true">❯</span>
     </button>
     <button type="button" className="apex-welcome-choice" onClick={()=>choose(false)}>
      <span className="apex-welcome-choice-id">02</span>
      <span className="apex-welcome-choice-copy"><strong>{t.veteran}</strong><small>{t.veteranDesc}</small></span>
      <span className="apex-welcome-choice-arrow" aria-hidden="true">❯</span>
     </button>
    </div>}
   <div className="apex-welcome-footer"><span className="apex-welcome-local">{t.local}</span><span>{t.privacy}</span></div>
  </main>
  <div className="apex-welcome-edge" aria-hidden="true"><span>ARENA ACCESS / SECURE</span><span>AC · 00-01</span></div>
 </div>;
}
