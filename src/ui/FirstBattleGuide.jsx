import React, { useEffect, useState } from 'react';
import './firstBattleGuide.css';

const KEY = 'apexChaos.firstBattleGuide.v1';
const VI = [
  ['BƯỚC 1 · VÀO TRẬN', 'Chọn Đấu tự do → đấu BOT để bắt đầu. Chọn một tướng mình đã mở khóa rồi xác nhận chọn tướng.'],
  ['BƯỚC 2 · PHÂN BIỆT ĐỊCH TA', 'P1 màu CAM là bạn; P2 màu XANH là đối thủ. Cùng chọn một tướng vẫn là hai phe khác nhau. Kỹ năng P1 dùng phím J/K trên máy tính; hãy theo chỉ dẫn điều khiển trong trận.'],
  ['BƯỚC 3 · NHẬN THƯỞNG', 'Thắng BOT +200 AC, thua +25 AC; hoàn thành LOCAL +50 AC. Dùng 350 AC để quay mở tướng. Mỗi trận chỉ trả thưởng một lần.'],
  ['LƯU TIẾN ĐỘ', 'Đang chơi với tài khoản Khách. AC, tướng và tiến độ lưu trong trình duyệt hiện tại; xóa dữ liệu trang có thể mất tiến độ.']
];
const EN = [
  ['STEP 1 · ENTER A MATCH', 'Choose Free Battle → BOT. Pick an owned fighter and confirm your selection to enter the arena.'],
  ['STEP 2 · TELL SIDES APART', 'P1 ORANGE is you; P2 BLUE is the rival. Both sides may choose the same fighter. P1 ability keys are J/K on desktop; follow the in-match controls for movement.'],
  ['STEP 3 · EARN CREDITS', 'Win vs BOT: +200 AC; loss: +25 AC; completed LOCAL: +50 AC. A Lucky Draw costs 350 AC. Each match only pays once.'],
  ['LOCAL SAVE', 'Guest progress, fighters, and AC remain in this browser. Clearing site data may erase your save.']
];
const readSeen=()=>{try{return localStorage.getItem(KEY)==='1'}catch{return false}};
export default function FirstBattleGuide(){
  const [open,setOpen]=useState(false);
  const [step,setStep]=useState(0);
  const [lang,setLang]=useState(()=>window.APEX_I18N?.getLanguage?.()||'eng');
  useEffect(()=>{
    let pending=0;
    const show=()=>{setLang(window.APEX_I18N?.getLanguage?.()||'eng');setStep(0);setOpen(true)};
    const onBoot=()=>{if(!readSeen())pending=window.setTimeout(show,320)};
    const onOpen=()=>show();
    const onLanguage=()=>setLang(window.APEX_I18N?.getLanguage?.()||'eng');
    window.addEventListener('apex:boot-started',onBoot);
    window.addEventListener('apex:guide-open',onOpen);
    window.addEventListener('apex:language-changed',onLanguage);
    return ()=>{window.clearTimeout(pending);window.removeEventListener('apex:boot-started',onBoot);window.removeEventListener('apex:guide-open',onOpen);window.removeEventListener('apex:language-changed',onLanguage)};
  },[]);
  useEffect(()=>{
    if(!open)return undefined;
    const onKey=e=>{if(e.key==='Escape'){e.preventDefault();finish()}};
    window.addEventListener('keydown',onKey,true);
    return ()=>window.removeEventListener('keydown',onKey,true);
  },[open]);
  const finish=()=>{
    try{localStorage.setItem(KEY,'1')}catch{}
    setOpen(false);
  };
  if(!open)return null;
  const copy=lang==='vie'?VI:EN, item=copy[step];
  return <div className="apex-first-guide-overlay" role="dialog" aria-modal="true" aria-labelledby="apex-first-guide-title">
    <section className="apex-first-guide-card" data-apex-no-localize="">
      <div className="apex-first-guide-eyebrow">APEX CHAOS · {lang==='vie'?'HƯỚNG DẪN NGƯỜI MỚI':'FIRST PLAY GUIDE'}</div>
      <div className="apex-first-guide-progress" aria-label={`${step+1}/${copy.length}`}>{copy.map((_,i)=><span key={i} className={i===step?'is-current':''}/>)}</div>
      <h2 id="apex-first-guide-title">{item[0]}</h2>
      <p>{item[1]}</p>
      <div className="apex-first-guide-actions">
        <button type="button" className="is-secondary" onClick={finish}>{lang==='vie'?'BỎ QUA':'SKIP'}</button>
        {step>0&&<button type="button" className="is-secondary" onClick={()=>setStep(n=>n-1)}>{lang==='vie'?'QUAY LẠI':'BACK'}</button>}
        <button type="button" className="is-primary" autoFocus onClick={()=>step===copy.length-1?finish():setStep(n=>n+1)}>
          {step===copy.length-1?(lang==='vie'?'VÀO GAME':'PLAY NOW'):(lang==='vie'?'TIẾP':'NEXT')} →
        </button>
      </div>
    </section>
  </div>;
}
