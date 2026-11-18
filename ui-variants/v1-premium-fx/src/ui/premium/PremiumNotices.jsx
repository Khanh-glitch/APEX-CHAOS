import React, { useEffect, useRef, useState } from 'react';
import ApexIcon from './ApexIcon.jsx';
import { dismissNotice, installNotifyApi, pushNotice, subscribeNotices } from './notifyBus.js';
import './premiumNotices.css';

const ICON_BY_VARIANT = { reward: 'coin', success: 'check', info: 'info', warn: 'warn', error: 'fault', skin: 'skin', trophy: 'trophy' };

// Animated number: eases from 0 → value so rewards visibly "land".
function CountUp({ value, duration = 900, prefix = '', suffix = '' }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const reduce = document.documentElement?.dataset?.apexMotion === 'reduced'
      || window.APEX_SETTINGS?.get?.()?.reducedMotion
      || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduce || !Number.isFinite(value)) { setShown(value); return undefined; }
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{prefix}{shown}{suffix}</>;
}

function Notice({ notice }) {
  const { id, variant, kicker, title, body, value, valueSuffix, icon, life, leaving } = notice;
  const timer = useRef(0);
  useEffect(() => {
    timer.current = window.setTimeout(() => dismissNotice(id), life);
    return () => window.clearTimeout(timer.current);
  }, [id, life]);
  const iconName = icon || ICON_BY_VARIANT[variant] || 'info';
  return (
    <div
      className={`apx-notice apx-v-${variant}${leaving ? ' is-leaving' : ''}`}
      style={{ '--apx-life': `${life}ms` }}
      role={variant === 'error' || variant === 'warn' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      data-apex-no-localize=""
    >
      <span className="apx-notice-flash" aria-hidden="true" />
      <span className="apx-notice-rail" aria-hidden="true" />
      <span className="apx-notice-icon" aria-hidden="true">
        <span className="apx-notice-ring" />
        <ApexIcon name={iconName} size={26} />
      </span>
      <div className="apx-notice-copy">
        {kicker && <span className="apx-notice-kicker">{kicker}</span>}
        {Number.isFinite(value)
          ? (
            <strong className="apx-notice-value">
              <CountUp value={value} prefix="+" suffix={valueSuffix || ''} />
            </strong>
          )
          : title && <strong className="apx-notice-title">{title}</strong>}
        {body && <small className="apx-notice-body">{body}</small>}
      </div>
      <span className="apx-notice-timer" aria-hidden="true"><i /></span>
    </div>
  );
}

export default function PremiumNotices() {
  const [list, setList] = useState([]);
  useEffect(() => {
    installNotifyApi(window);
    // Connectivity feedback: the game is local-first, so say so plainly.
    const vie = () => { try { return window.APEX_I18N?.getLanguage?.() === 'vie'; } catch { return false; } };
    const onOffline = () => pushNotice({
      key: 'apex-net', variant: 'warn', icon: 'warn',
      kicker: vie() ? 'MẤT KẾT NỐI' : 'CONNECTION LOST',
      title: vie() ? 'Chế độ ngoại tuyến' : 'Offline mode',
      body: vie() ? 'Tiến trình vẫn lưu trên thiết bị' : 'Progress is saved on this device',
      life: 4200,
    });
    const onOnline = () => pushNotice({
      key: 'apex-net', variant: 'success', icon: 'check',
      kicker: vie() ? 'ĐÃ KẾT NỐI' : 'BACK ONLINE',
      title: vie() ? 'Kết nối đã khôi phục' : 'Connection restored',
      life: 2800,
    });
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    const unsub = subscribeNotices(setList);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      unsub();
    };
  }, []);
  if (!list.length) return null;
  return (
    <div className="apx-notice-stack" aria-label="Notifications">
      {list.map((notice) => <Notice key={notice.id} notice={notice} />)}
    </div>
  );
}
