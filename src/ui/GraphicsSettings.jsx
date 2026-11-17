import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGraphics, useGameLanguage } from './useGraphics.js';
import './premiumExperience.css';

export function GraphicsControls() {
  const [state, update] = useGraphics();
  const vi = useGameLanguage();
  const names = vi ? ['Tự động', 'Thấp', 'Cân bằng', 'Cao', 'Ultra'] : ['Auto', 'Low', 'Balanced', 'High', 'Ultra'];
  const keys = ['auto', 'low', 'balanced', 'high', 'ultra'];
  const descriptions = vi
    ? ['Điều chỉnh theo độ mượt thực tế của trận đấu.', 'Ưu tiên tốc độ và tiết kiệm pin.', 'Hình ảnh rõ, hiệu ứng vừa đủ.', 'Ánh sáng động và hiệu ứng GPU.', 'Đầy đủ hiệu ứng, ưu tiên chất lượng hình ảnh.']
    : ['Adapts to sustained frame performance.', 'Prioritizes speed and battery life.', 'Clear visuals with a lighter effects budget.', 'Dynamic lighting and GPU effects.', 'Full effects for maximum visual detail.'];
  return <div className="gx-controls" data-apex-no-localize>
    <div className="gx-label">{vi ? 'CHẤT LƯỢNG ĐỒ HỌA' : 'GRAPHICS QUALITY'}<span>{names[keys.indexOf(state.effective)]}</span></div>
    <div className="gx-presets" role="group" aria-label={vi ? 'Chất lượng đồ họa' : 'Graphics quality'}>
      {keys.map((key, i) => <button key={key} type="button" aria-pressed={state.quality === key} onClick={() => update({ quality: key })}>{names[i]}</button>)}
    </div>
    <p className="gx-description">{descriptions[keys.indexOf(state.quality)]}</p>
    {!state.gpuAvailable && <p className="gx-description">{vi ? 'Hiệu ứng GPU không khả dụng. Đang dùng Canvas.' : 'GPU effects unavailable. Canvas rendering is active.'}</p>}
    <label className="gx-setting"><span><b>{vi ? 'Chuyển động' : 'Motion'}</b><small>{vi ? 'Giảm rung máy và chuyển động mạnh' : 'Camera shake and cinematic movement'}</small></span>
      <select value={state.motion} onChange={e => update({ motion: e.target.value })}>
        <option value="system">{vi ? 'Theo thiết bị' : 'System'}</option><option value="reduced">{vi ? 'Giảm' : 'Reduced'}</option><option value="full">{vi ? 'Đầy đủ' : 'Full'}</option>
      </select>
    </label>
    <label className="gx-setting"><span><b>{vi ? 'Ưu tiên rõ trận đấu' : 'Combat clarity'}</b><small>{vi ? 'Giảm lóa, giữ rõ cảnh báo và nhân vật' : 'Softer bloom and distortion; readable combat'}</small></span><input type="checkbox" checked={state.clarity} onChange={e => update({ clarity: e.target.checked })} /></label>
    <label className="gx-setting"><span><b>{vi ? 'Hiển thị FPS' : 'Show frame rate'}</b><small>{vi ? 'Đo trong trận đấu' : 'Measured during battle'}</small></span><input type="checkbox" checked={state.showFps} onChange={e => update({ showFps: e.target.checked })} /></label>
  </div>;
}

export default function GraphicsSettings() {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [state] = useGraphics();
  const vi = useGameLanguage();
  const dialog = useRef(null);
  useEffect(() => {
    const ready = () => setReady(true);
    const show = () => setOpen(true);
    window.addEventListener('apex:boot-interactive', ready);
    window.addEventListener('apex:open-graphics', show);
    return () => { window.removeEventListener('apex:boot-interactive', ready); window.removeEventListener('apex:open-graphics', show); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    dialog.current?.querySelector('button')?.focus();
    const key = e => {
      // Keep game shortcuts out of a focused settings dialog.
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
      if (e.key === 'Tab') {
        const nodes = [...dialog.current.querySelectorAll('button,select,input')];
        const first = nodes[0], last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      e.stopPropagation();
    };
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('keydown', key, true); if (previous?.isConnected) previous.focus(); };
  }, [open]);
  return <>
    {ready && state.showFps && <output className="gx-fps" aria-label="Frame rate">{state.fps == null ? '—' : state.fps} FPS · {state.effective.toUpperCase()}</output>}
    {open && createPortal(<div className="gx-backdrop" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <section ref={dialog} className="gx-dialog" role="dialog" aria-modal="true" aria-labelledby="gx-title" data-apex-no-localize>
        <header><div><span className="gx-eyebrow">APEX CHAOS / {vi ? 'TRẢI NGHIỆM' : 'EXPERIENCE'}</span><h2 id="gx-title">{vi ? 'TỐI ƯU CHO BẠN' : 'YOUR GAME. YOUR WAY.'}</h2></div><button className="gx-close" type="button" onClick={() => setOpen(false)} aria-label={vi ? 'Đóng cài đặt' : 'Close display settings'}>×</button></header>
        <GraphicsControls />
        <footer>{vi ? 'Áp dụng ngay · Tự lưu trên thiết bị này' : 'Applied instantly · Saved on this device'}</footer>
      </section>
    </div>, document.body)}
  </>;
}
