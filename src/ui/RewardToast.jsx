import React, { useEffect, useRef, useState } from 'react';
import './rewardToast.css';

// APEX CHAOS — AC reward toast (presentation only).
// The canonical Result Gold report never prints the match payout, so a
// new player could win +200 AC without ever seeing the number land. The
// wallet authority announces every balance through 'apex:credits'; this
// toast derives the positive delta from consecutive announcements and
// shows it briefly ("+200 AC"). It reads nothing else and writes
// nothing: no economy state lives here. Spends (Lucky Draw) decrease the
// balance and never toast. Sits below the modal layer, so mission
// claims keep their in-panel feedback without double-signalling.
export default function RewardToast() {
  const [toast, setToast] = useState(null); // { delta, balance, seq }
  const prevCredits = useRef(null);
  const timer = useRef(0);
  const seq = useRef(0);

  useEffect(() => {
    const readBalance = (detail) => {
      if (detail && Number.isFinite(detail.credits)) return detail.credits;
      try { return window.APEX_ARSENAL_META?.getState?.()?.credits ?? null; } catch { return null; }
    };
    const onCredits = (event) => {
      const next = readBalance(event?.detail);
      if (!Number.isFinite(next)) return;
      const prev = prevCredits.current;
      prevCredits.current = next;
      if (prev === null) return; // first announcement only seeds the baseline
      const delta = next - prev;
      if (delta <= 0) return;
      seq.current += 1;
      setToast({ delta, balance: next, seq: seq.current });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToast(null), 3600);
    };
    // Seed as soon as the wallet authority exists so the boot-time seed
    // write is never mistaken for a reward.
    const seed = () => {
      if (prevCredits.current === null) {
        const now = readBalance(null);
        if (Number.isFinite(now)) prevCredits.current = now;
      }
    };
    seed();
    const seedPoll = window.setInterval(seed, 800);
    window.addEventListener('apex:credits', onCredits);
    return () => {
      window.clearInterval(seedPoll);
      window.clearTimeout(timer.current);
      window.removeEventListener('apex:credits', onCredits);
    };
  }, []);

  if (!toast) return null;
  return (
    <div className="apex-reward-toast" key={toast.seq} role="status" aria-live="polite">
      <span className="apex-reward-toast-delta">+{toast.delta} AC</span>
      <span className="apex-reward-toast-balance">{toast.balance} AC</span>
    </div>
  );
}
