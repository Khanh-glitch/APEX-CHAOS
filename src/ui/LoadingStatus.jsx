import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { getLoadingSnapshot, subscribeLoading } from '../game/loadingProgress.js';
import { useGameLanguage } from './useGraphics.js';

export default function LoadingStatus() {
  const progress = useSyncExternalStore(subscribeLoading, getLoadingSnapshot);
  const [phase, setPhase] = useState('boot');
  const [failed, setFailed] = useState(false);
  const [slow, setSlow] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const vi = useGameLanguage();
  useEffect(() => {
    const start = () => setPhase('ready');
    const done = () => setPhase('done');
    const sync = () => {
      const body = document.body.dataset;
      setFailed(body.apexBootError === 'true' || body.apexSceneTransition === 'ERROR');
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-apex-boot-error', 'data-apex-scene-transition'] });
    const network = () => setOnline(navigator.onLine);
    window.addEventListener('apex:start-ready', start);
    window.addEventListener('apex:boot-interactive', done);
    window.addEventListener('online', network); window.addEventListener('offline', network);
    sync();
    return () => { observer.disconnect(); window.removeEventListener('apex:start-ready', start); window.removeEventListener('apex:boot-interactive', done); window.removeEventListener('online', network); window.removeEventListener('offline', network); };
  }, []);
  const active = phase === 'boot' || (phase === 'done' && progress.busy);
  useEffect(() => {
    setSlow(false);
    if (!active) return;
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, [active, progress.label]);
  useEffect(() => {
    setStalled(false);
    if (phase !== 'boot') return;
    const timer = setTimeout(() => setStalled(true), 60000);
    return () => clearTimeout(timer);
  }, [phase]);
  const error = failed || progress.error || stalled;
  const counted = progress.busy && progress.total > 0;
  if (!error && !active) return null;
  const label = error ? (vi ? 'Chưa thể tải game' : 'Unable to finish loading')
    : !online ? (vi ? 'Đang chờ kết nối' : 'Waiting for connection')
    : progress.label === 'battle' ? (vi ? 'Đang chuẩn bị trận đấu' : 'Preparing your battle')
    : phase === 'boot' ? (vi ? 'Đang khởi động APEX CHAOS' : 'Starting APEX CHAOS')
    : (vi ? 'Đang chuẩn bị nội dung' : 'Preparing your next screen');
  return <aside className={`ux-loading ${error ? 'is-error' : ''}`} data-apex-no-localize aria-label={label}>
    <div className="ux-loading-heading"><span className="ux-loading-mark" aria-hidden="true">A</span><div><strong role="status">{label}</strong><small>{error ? (vi ? 'Tải lại để thử lại. Tiến trình đã lưu vẫn được giữ.' : 'Reload to try again. Your saved progress stays on this device.') : slow ? (vi ? 'Lần đầu có thể lâu hơn. Đang chuẩn bị tài nguyên…' : 'First launch may take longer. Still preparing assets…') : (vi ? 'Sẵn sàng cho đấu trường' : 'GETTING YOU ARENA READY')}</small></div></div>
    {!error && <div className="ux-loading-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={counted ? progress.total : 100} aria-valuenow={counted ? progress.completed : undefined}><i style={counted ? { width: `${100 * progress.completed / progress.total}%` } : undefined} className={counted ? '' : 'is-indeterminate'} /></div>}
    {error && <button type="button" onClick={() => location.reload()}>{vi ? 'TẢI LẠI' : 'RELOAD GAME'} ↗</button>}
  </aside>;
}
