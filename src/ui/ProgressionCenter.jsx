import React, { useEffect, useState } from 'react';
import './progressionCenter.css';

export default function ProgressionCenter() {
  const [open,setOpen]=useState(false);
  const [tab,setTab]=useState('mission');
  const [revision,refresh]=useState(0);
  const [message,setMessage]=useState('');
  const [language,setLanguage]=useState(()=>window.APEX_I18N?.getLanguage?.()||'eng');
  useEffect(()=>{
    const openPanel=()=>{setLanguage(window.APEX_I18N?.getLanguage?.()||'eng');setMessage('');setTab('mission');refresh(v=>v+1);setOpen(true)};
    const onNav=e=>{
      const btn=e.target?.closest?.('[data-apex-progress-entry]');
      if(!btn)return;
      e.preventDefault();e.stopPropagation();openPanel();
    };
    const onChange=()=>refresh(v=>v+1);
    const onLanguage=()=>setLanguage(window.APEX_I18N?.getLanguage?.()||'eng');
    document.addEventListener('click',onNav,true);
    window.addEventListener('apex:progress-open',openPanel);
    window.addEventListener('apex:credits',onChange);
    window.addEventListener('apex:language-changed',onLanguage);
    return ()=>{document.removeEventListener('click',onNav,true);window.removeEventListener('apex:progress-open',openPanel);window.removeEventListener('apex:credits',onChange);window.removeEventListener('apex:language-changed',onLanguage)};
  },[]);
  useEffect(()=>{
    if(!open)return undefined;
    const key=e=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false)}};
    window.addEventListener('keydown',key,true);
    return ()=>window.removeEventListener('keydown',key,true);
  },[open]);
  if(!open)return null;
  const meta=window.APEX_ARSENAL_META;
  const all=meta?.progressionCatalog?.()||[];
  const state=meta?.getState?.()||{};
  const progress=state.progression||{};
  const items=all.filter(x=>x.kind===tab);
  const vi=language==='vie';
  const claim=id=>{
    const result=meta?.claimProgressReward?.(id);
    setMessage(result?.ok?(vi?'ĐÃ NHẬN THƯỞNG':'REWARD CLAIMED'):(vi?'CHƯA THỂ NHẬN THƯỞNG: ':'UNABLE TO CLAIM: ')+(result?.reason||'unavailable'));
    refresh(v=>v+1);
  };
  return <div className="apex-progress-overlay" role="dialog" aria-modal="true" aria-label={vi?'Nhiệm vụ và Thành tựu':'Missions and Achievements'} onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
    <section className="apex-progress-panel" data-apex-no-localize="">
      <header className="apex-progress-header">
        <div><small>APEX CHAOS · GUEST ALPHA</small><h2>{vi?'NHIỆM VỤ & THÀNH TỰU':'MISSIONS & ACHIEVEMENTS'}</h2></div>
        <button type="button" onClick={()=>setOpen(false)} aria-label={vi?'Đóng':'Close'}>✕</button>
      </header>
      <div className="apex-progress-bal">{vi?'SỐ DƯ HIỆN TẠI':'CURRENT BALANCE'} <strong>{Number.isFinite(state.credits)?state.credits:0} AC</strong></div>
      <div className="apex-progress-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab==='mission'} className={tab==='mission'?'active':''} onClick={()=>setTab('mission')}>{vi?'NHIỆM VỤ':'MISSIONS'}</button>
        <button type="button" role="tab" aria-selected={tab==='achievement'} className={tab==='achievement'?'active':''} onClick={()=>setTab('achievement')}>{vi?'THÀNH TỰU':'ACHIEVEMENTS'}</button>
      </div>
      <div className="apex-progress-list" role="tabpanel">
        {items.length===0?<p>{vi?'Đang tải dữ liệu nhiệm vụ...':'Preparing progression...'}</p>:items.map(d=>{
          const done=(progress.claimedIds||[]).includes(d.id);
          const count=Math.min(Math.max(0,Number(progress[d.stat])||0),d.target);
          const eligible=count>=d.target&&!done;
          return <article className={'apex-progress-row '+(done?'claimed':'')} key={d.id}>
            <div className="apex-progress-row-info">
              <h3>{vi?d.vie:d.eng}</h3>
              <p>{count} / {d.target} · +{d.ac} AC</p>
              <div className="apex-progress-meter"><span style={{width:(count/d.target*100)+'%'}}/></div>
            </div>
            <button type="button" disabled={!eligible} onClick={()=>claim(d.id)}>{done?(vi?'ĐÃ NHẬN':'CLAIMED'):eligible?(vi?'NHẬN +'+d.ac:'CLAIM +'+d.ac):(vi?'CHƯA ĐẠT':'INCOMPLETE')}</button>
          </article>;
        })}
      </div>
      <p className="apex-progress-note">{vi?'Chỉ trận BOT/LOCAL hoàn chỉnh, có kết quả hợp lệ mới tính tiến độ. Mỗi phần thưởng được nhận một lần trên trình duyệt này. Skin Gold hiện hữu chưa bị khóa lại; phần thưởng skin cần được nghiệm thu quyền sở hữu riêng.':'Only sealed, completed BOT/LOCAL matches count. Each bonus is claimed once in this browser. Existing Gold skins are not retroactively locked; cosmetic entitlements require separate acceptance.'}</p>
      <div className="apex-progress-feedback" role="status">{message}</div>
    </section>
  </div>;
}
