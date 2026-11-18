import React, { useEffect, useRef, useState } from 'react';
import { ApexCreditCoinIcon } from './ApexIcons.jsx';
import './rewardToast.css';

function currentLanguage() {
  try { return window.APEX_I18N?.getLanguage?.() === 'vie' ? 'vie' : 'eng'; }
  catch { return 'eng'; }
}

// APEX CHAOS — AAA Premium AC Reward Toast (presentation only).
// Announces positive AC deltas from 'apex:credits' with a 3D Hexagonal
// Apex Coin, tactical telemetry kicker, and live balance badge.
export default function RewardToast() {
  const [toast, setToast] = useState(null); // { delta, balance, seq }
  const [lang, setLang] = useState(currentLanguage);
  const prevCredits = useRef(null);
  const timer = useRef(0);
  const seq = useRef(0);

  useEffect(() => {
    const onLanguage = () => setLang(currentLanguage());
    const readBalance = (detail) => {
      if (detail && Number.isFinite(detail.credits)) return detail.credits;
      try { return window.APEX_ARSENAL_META?.getState?.()?.credits ?? null; } catch { return null; }
    };
    const onCredits = (event) => {
      const next = readBalance(event?.detail);
      if (!Number.isFinite(next)) return;
      const prev = prevCredits.current;
      prevCredits.current = next;
      if (prev === null) return;
      const delta = next - prev;
      if (delta <= 0) return;
      seq.current += 1;
      setToast({ delta, balance: next, seq: seq.current });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToast(null), 3600);
    };
    let seedPoll = 0;
    const seed = () => {
      if (prevCredits.current === null) {
        const now = readBalance(null);
        if (Number.isFinite(now)) prevCredits.current = now;
      }
      if (prevCredits.current !== null && seedPoll) {
        window.clearInterval(seedPoll);
        seedPoll = 0;
      }
    };
    seed();
    if (prevCredits.current === null) {
      seedPoll = window.setInterval(seed, 800);
    }
    window.addEventListener('apex:credits', onCredits);
    window.addEventListener('apex:language-changed', onLanguage);
    return () => {
      window.clearInterval(seedPoll);
      window.clearTimeout(timer.current);
      window.removeEventListener('apex:credits', onCredits);
      window.removeEventListener('apex:language-changed', onLanguage);
    };
  }, []);

  if (!toast) return null;
  const isVie = lang === 'vie';

  return (
    <div
      className="apex-reward-toast"
      key={toast.seq}
      role="status"
      aria-live="polite"
      data-apex-no-localize=""
    >
      <span className="apex-reward-toast-sheen" aria-hidden="true" />
      <div className="apex-reward-toast-emblem" aria-hidden="true">
        <span className="apex-reward-toast-halo" />
        <ApexCreditCoinIcon size={34} />
      </div>
      <div className="apex-reward-toast-body">
        <span className="apex-reward-toast-kicker">
          {isVie ? 'ĐÃ NHẬN THƯỞNG // ĐỒNG BỘ VÍ' : 'REWARD CREDITED // WALLET SYNC'}
        </span>
        <div className="apex-reward-toast-row">
          <span className="apex-reward-toast-delta">+{toast.delta} AC</span>
          <span className="apex-reward-toast-sep" aria-hidden="true" />
          <span className="apex-reward-toast-balance">
            {isVie ? 'SỐ DƯ' : 'TOTAL'} <b>{toast.balance} AC</b>
          </span>
        </div>
      </div>
      <span className="apex-reward-toast-timer" aria-hidden="true" />
    </div>
  );
}
