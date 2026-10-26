import React, {useEffect, useRef, useState} from 'react';
import playerAccount from '../game/playerAccount.js';
import {apexAppUrl} from '../game/appRoot.js';
import './firstSessionWelcome.css';

const KEY = 'apex.firstSessionWelcome.v1';
function readDone(){ try{return localStorage.getItem(KEY)==='done';}catch{return false;} }
const copy={
 vie:{tag:'PLAYER ACCESS // APEX CHAOS',title:'CHÀO MỪNG ĐẾN ARENA',name:'Tên chiến binh',nameHint:'Đặt tên hiển thị (2–24 ký tự)',entry:'TIẾP TỤC',choice:'BẠN ĐÃ TỪNG CHIẾN ĐẤU?',newPlayer:'MỚI CHƠI',newDesc:'Học luật chơi theo hướng dẫn ngay trong game',veteran:'KỲ CỰU',veteranDesc:'Vào thẳng Home, bỏ qua hướng dẫn',guest:'Chế độ người chơi cục bộ: tên và tiến trình được lưu trên thiết bị. Google/đăng ký mật khẩu chưa được mở trên bản itch này.',error:'Tên phải có ít nhất 2 ký tự.'},
 eng:{tag:'PLAYER ACCESS // APEX CHAOS',title:'WELCOME TO THE ARENA',name:'Fighter name',nameHint:'Display name (2–24 characters)',entry:'CONTINUE',choice:'HOW EXPERIENCED ARE YOU?',newPlayer:'NEW PLAYER',newDesc:'Start with the in-game guided tutorial',veteran:'VETERAN',veteranDesc:'Enter Home without a tutorial',guest:'Local player mode: your name and progress are saved on this device. Google/email-password sign-in is not enabled in this itch build.',error:'Name must be at least 2 characters.'}
};
export default function FirstSessionWelcome({ready=false}){
 const [done,setDone]=useState(readDone);
 const [step,setStep]=useState('name');
 const [name,setName]=useState(()=>{const current=playerAccount.profile();return current.kind==='guest'&&current.displayName?.startsWith('GUEST-')?'':(current.displayName||'')});
 const [error,setError]=useState('');
 const field=useRef(null);
 useEffect(()=>{if(ready&&!done&&step==='name')field.current?.focus();},[ready,done,step]);
 if(!ready||done)return null;
 const lang=window.APEX_I18N?.getLanguage?.()==='vie'?'vie':'eng';
 const t=copy[lang];
 const choose=(tutorial)=>{
  window.dispatchEvent(new CustomEvent('apex:tutorial-answer',{detail:{enable:tutorial}}));
  try{localStorage.setItem(KEY,'done')}catch{}
  setDone(true);
 };
 const advance=e=>{
  e.preventDefault();
  const clean=name.trim().slice(0,24);
  if(clean.length<2){setError(t.error);return;}
  playerAccount.setDisplayName(clean);
  setError('');
  setStep('experience');
 };
 return <div className="apex-welcome-gate" role="dialog" aria-modal="true" aria-label={t.title} data-apex-no-localize="">
  <section className="apex-welcome-card">
   <div className="apex-welcome-identity"><img src={apexAppUrl('/assets/dictionary/heroes/boxe/avatar.png')} alt="BOXE" loading="eager" decoding="async"/><small className="apex-welcome-kicker">{t.tag}</small></div>
   <h1>{t.title}</h1>
   <div className="apex-welcome-rule"/>
   {step==='name'?<form onSubmit={advance}>
    <label htmlFor="apex-welcome-name">{t.name}</label>
    <input ref={field} id="apex-welcome-name" value={name} maxLength={24} onChange={e=>setName(e.target.value)} placeholder={t.nameHint} autoComplete="nickname" required/>
    {error&&<p className="apex-welcome-error" role="alert">{error}</p>}
    <button type="submit" className="apex-welcome-primary">{t.entry}</button>
    <p className="apex-welcome-disclaimer">{t.guest}</p>
   </form>:<div className="apex-welcome-experience">
    <h2>{t.choice}</h2>
    <button type="button" onClick={()=>choose(true)}><strong>{t.newPlayer}</strong><small>{t.newDesc}</small></button>
    <button type="button" onClick={()=>choose(false)}><strong>{t.veteran}</strong><small>{t.veteranDesc}</small></button>
   </div>}
  </section>
 </div>;
}
