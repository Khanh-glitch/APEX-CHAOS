import { useEffect, useRef } from 'react';
import { pushNotice } from './premium/notifyBus.js';

// APEX CHAOS — AC reward notice (presentation only).
// Bridges positive 'apex:credits' deltas to PremiumNotices (+200 AC count-up,
// specular sheen, hexagon coin emblem, life-timer) without owning economy state.
const COPY = {
  eng: { kicker: 'REWARD · CREDITS', balance: (n) => `BALANCE ${n} AC` },
  vie: { kicker: 'PHẦN THƯỞNG · CREDITS', balance: (n) => `SỐ DƯ ${n} AC` },
};

function lang() {
  try { return window.APEX_I18N?.getLanguage?.() === 'vie' ? 'vie' : 'eng'; } catch { return 'eng'; }
}

export default function RewardToast() {
  const prevCredits = useRef(null);

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
      if (prev === null) return;
      const delta = next - prev;
      if (delta <= 0) return;
      const t = COPY[lang()];
      pushNotice({
        key: 'apex-credit-reward',
        variant: 'reward',
        icon: 'coin',
        kicker: t.kicker,
        value: delta,
        valueSuffix: ' AC',
        body: t.balance(next),
        life: 3900,
      });
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
    return () => {
      window.clearInterval(seedPoll);
      window.removeEventListener('apex:credits', onCredits);
    };
  }, []);

  return null;
}
