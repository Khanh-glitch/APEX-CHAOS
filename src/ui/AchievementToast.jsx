import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  MASTERY_BY_ID,
  MASTERY_HEROES,
  RARITY_LABELS,
  applicableAchievements,
  masteryResultHeroId,
} from './masteryCatalog.js';
import './achievementToast.css';

// CP3 live mastery feedback. This component only displays first-lifetime
// unlock events already recorded by APEX_ARSENAL_META. It never evaluates
// an achievement itself. The queue is bounded and pointer-transparent so a
// burst of unlocks cannot cover input or turn a match into toast spam.

const COPY = {
  eng: {
    unlocked: 'ACHIEVEMENT UNLOCKED',
    more: (n) => `+${n} MORE RECORDED IN MASTERY VAULT`,
    progress: (hero, earned, total) => `${hero} MASTERY ${earned}/${total}`,
  },
  vie: {
    unlocked: 'ĐÃ MỞ THÀNH TỰU',
    more: (n) => `+${n} THÀNH TỰU NỮA ĐÃ GHI VÀO KHO TINH THÔNG`,
    progress: (hero, earned, total) => `TINH THÔNG ${hero} ${earned}/${total}`,
  },
};

function currentLanguage() {
  try { return window.APEX_I18N?.getLanguage?.() === 'vie' ? 'vie' : 'eng'; }
  catch { return 'eng'; }
}

function heroProgress(heroId) {
  const hero = masteryResultHeroId(heroId);
  try {
    const progress = window.APEX_ARSENAL_META?.heroMasteryProgress?.(hero);
    if (progress) return progress;
  } catch { /* use catalog fallback below */ }
  const mastery = window.APEX_ARSENAL_META?.getMastery?.() || {};
  const earned = mastery.earned?.[hero] || {};
  const applicable = applicableAchievements(hero);
  return {
    heroId: hero,
    earned: applicable.filter((item) => Object.prototype.hasOwnProperty.call(earned, item.id)).length,
    total: applicable.length,
  };
}

export default function AchievementToast() {
  const [current, setCurrent] = useState(null);
  const [overflow, setOverflow] = useState(0);
  const [language, setLanguage] = useState(currentLanguage);
  const queueRef = useRef([]);
  const activeRef = useRef(null);
  const overflowRef = useRef(0);
  const seenRef = useRef(new Set());
  const hideTimerRef = useRef(0);
  const nextTimerRef = useRef(0);
  const showNextRef = useRef(null);

  const showNext = useCallback(() => {
    if (activeRef.current) return;
    const next = queueRef.current.shift();
    if (!next) {
      overflowRef.current = 0;
      setOverflow(0);
      return;
    }
    activeRef.current = next;
    setCurrent(next);
    setOverflow(overflowRef.current);
    try { window.apexUiSfx?.play?.('ui.option.confirm'); } catch { /* sound is optional */ }
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      activeRef.current = null;
      setCurrent(null);
      nextTimerRef.current = window.setTimeout(() => showNextRef.current?.(), 140);
    }, 2800);
  }, []);
  showNextRef.current = showNext;

  useEffect(() => {
    const enqueue = (event) => {
      const unlocks = Array.isArray(event?.detail?.unlocks) ? event.detail.unlocks : [];
      const incoming = unlocks
        .map((unlock) => {
          const achievement = MASTERY_BY_ID[unlock?.achievementId];
          if (!achievement) return null;
          const heroId = masteryResultHeroId(unlock.heroId);
          const at = Number(unlock.at) || Date.now();
          return {
            key: `${heroId}:${achievement.id}:${at}`,
            achievement,
            heroId,
            heroName: MASTERY_HEROES.find((hero) => hero.resultId === heroId)?.name || heroId,
            at,
          };
        })
        .filter(Boolean)
        .sort((a, b) => (b.achievement.rarityWeight - a.achievement.rarityWeight) || (a.at - b.at));

      for (const item of incoming) {
        if (seenRef.current.has(item.key)) continue;
        seenRef.current.add(item.key);
        if (seenRef.current.size > 512) {
          seenRef.current = new Set([...seenRef.current].slice(-256));
        }
        const visibleOrQueued = queueRef.current.length + (activeRef.current ? 1 : 0);
        if (visibleOrQueued < 3) {
          queueRef.current.push(item);
        } else {
          overflowRef.current += 1;
          let weakestIndex = -1;
          let weakestWeight = Infinity;
          queueRef.current.forEach((queued, index) => {
            if (queued.achievement.rarityWeight < weakestWeight) {
              weakestWeight = queued.achievement.rarityWeight;
              weakestIndex = index;
            }
          });
          if (weakestIndex >= 0 && item.achievement.rarityWeight > weakestWeight) {
            queueRef.current[weakestIndex] = item;
          }
        }
      }
      queueRef.current.sort((a, b) => (b.achievement.rarityWeight - a.achievement.rarityWeight) || (a.at - b.at));
      setOverflow(overflowRef.current);
      showNext();
    };
    const onLanguage = () => setLanguage(currentLanguage());
    window.addEventListener('apex:mastery-unlocked', enqueue);
    window.addEventListener('apex:language-changed', onLanguage);
    return () => {
      window.removeEventListener('apex:mastery-unlocked', enqueue);
      window.removeEventListener('apex:language-changed', onLanguage);
      window.clearTimeout(hideTimerRef.current);
      window.clearTimeout(nextTimerRef.current);
      activeRef.current = null;
      queueRef.current = [];
    };
  }, [showNext]);

  if (!current) return null;
  const lang = language === 'vie' ? 'vie' : 'eng';
  const t = COPY[lang];
  const achievement = current.achievement;
  const progress = heroProgress(current.heroId);

  return (
    <div
      className={`apex-achievement-toast rarity-${achievement.rarity}`}
      key={current.key}
      role="status"
      aria-live="polite"
      data-apex-no-localize=""
    >
      <div className="apex-achievement-toast-medal" aria-hidden="true">{achievement.iconGlyph}</div>
      <div className="apex-achievement-toast-copy">
        <span>{t.unlocked} · {RARITY_LABELS[achievement.rarity]?.[lang] || achievement.rarity}</span>
        <strong>{achievement.name}</strong>
        <small>{t.progress(current.heroName, progress.earned, progress.total)}</small>
        {overflow > 0 && <small className="apex-achievement-toast-more">{t.more(overflow)}</small>}
      </div>
    </div>
  );
}
