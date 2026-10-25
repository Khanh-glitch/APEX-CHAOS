import React from 'react';
import { apexAppUrl } from '../game/appRoot.js';
import './goldMissionAccount.css';

// Ported from the owner-supplied Gold prototype: one AC emblem, shared across
// account and missions. This is artwork only, NEVER a second wallet.
export function GoldCoin({ size = 38, motion = false }) {
  const key = React.useId().replace(/:/g, '');
  return (
    <svg className={motion ? 'agm-coin agm-coin-live' : 'agm-coin'}
      width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id={key + 'rim'} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#fff7c3"/><stop offset=".35" stopColor="#ffc43d"/>
          <stop offset=".7" stopColor="#f16b12"/><stop offset="1" stopColor="#8a3900"/>
        </linearGradient>
        <linearGradient id={key + 'face'} x1="0" x2=".9" y1="0" y2="1">
          <stop stopColor="#ffe48a"/><stop offset=".5" stopColor="#ffb12a"/>
          <stop offset="1" stopColor="#db5a0a"/>
        </linearGradient>
      </defs>
      <polygon points="20,1.5 36,10.5 36,29.5 20,38.5 4,29.5 4,10.5" fill={`url(#${key}rim)`}/>
      <polygon points="20,5 33,12.2 33,27.8 20,35 7,27.8 7,12.2" fill={`url(#${key}face)`}/>
      <polygon points="20,8.5 30,14 30,26 20,31.5 10,26 10,14" fill="none" stroke="#a24a00" strokeOpacity=".65"/>
      <path d="M22.5 9 13 21.5h6l-1.5 9.5L27.5 18.5h-6z" fill="#3a1600"/>
    </svg>
  );
}

export const acText = (n) => Number.isFinite(Number(n))
  ? Math.trunc(Number(n)).toLocaleString('vi-VN') : '—';

const portraits = Object.freeze({
  ROBOT: 'newbot', HUNTER: 'hunter', CRYSTAL: 'crystala',
  MAGNET: 'magnet', ICE: 'frost', MIRROR: 'mirror',
});
export function goldPortrait(id) {
  // Canonical shipped Gold roster art, not any of the prototype's invented six.
  const key = portraits[String(id || '').toUpperCase()];
  return apexAppUrl(key
    ? `/gold/assets/placeholders/pick/cover/${key}.svg`
    : '/gold/assets/gold/favicon-apex-chaos.png');
}
export function GoldMeter({ value, max, label }) {
  const percentage = max > 0 ? Math.min(100, Math.max(0, (Number(value) || 0) / max * 100)) : 0;
  return (
    <div className="agm-meter" role="progressbar" aria-label={label || 'Progress'}
      aria-valuemin={0} aria-valuemax={Math.max(0, max || 0)}
      aria-valuenow={Math.max(0, Math.min(max || 0, Number(value) || 0))}>
      <span style={{ width: `${percentage}%` }} />
    </div>
  );
}
export function GoldWallet({ amount, caption = 'APEX CREDITS', large = false }) {
  return (
    <div className={large ? 'agm-wallet is-large' : 'agm-wallet'} data-gold-ac-wallet="">
      <GoldCoin size={large ? 76 : 38} motion={large}/>
      <div><small>{caption}</small><strong data-account-credits={large ? "" : undefined}>{acText(amount)} <em>AC</em></strong></div>
    </div>
  );
}
export function GoldHeroArt({ id, name, large = false }) {
  return (
    <div className={large ? 'agm-hero-art is-large' : 'agm-hero-art'}>
      <img src={goldPortrait(id)} alt={name || String(id || '')} loading="lazy"
        onError={(e) => { if (!e.currentTarget.dataset.fallback) {
          e.currentTarget.dataset.fallback = 'true';
          e.currentTarget.src = apexAppUrl('/gold/assets/gold/favicon-apex-chaos.png');
        }}}/>
    </div>
  );
}
export function GoldShell({ type, title, subtitle, onClose, closeRef, children, roleTitleId, legacyClass = '' }) {
  return (
    <div className={`agm-overlay agm-${type} ${legacyClass}`} role="dialog" aria-modal="true"
      aria-labelledby={roleTitleId} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="agm-stage" aria-hidden="true"/>
      <section className={type === "account" ? "agm-page apex-account-panel" : "agm-page"}>
        <header className={type === "account" ? "agm-top apex-account-head" : "agm-top"}>
          <div className="agm-wordmark"><span>APEX</span><small>CHAOS</small></div>
          <div className="agm-top-center">APEX CHAOS <b>◈</b> PILOT SYSTEM</div>
          <button className={type === "account" ? "agm-exit apex-account-close" : "agm-exit"} type="button" onClick={onClose} ref={closeRef} aria-label="Close panel">
            <span>✕</span><small>BACK TO GAME</small>
          </button>
        </header>
        <div className={type === "account" ? "agm-main apex-account-body" : "agm-main"}>
          <div className="agm-heading">
            <div><p>APEX CHAOS // {subtitle}</p><h2 id={roleTitleId}>{title}</h2></div>
            <span className="agm-heading-rule" aria-hidden="true">◆ ◆ ◆</span>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
