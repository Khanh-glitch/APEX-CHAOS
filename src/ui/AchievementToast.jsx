import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { translateCopy } from '../game/localeCatalog.js';
import {
  MASTERY_BY_ID,
  MASTERY_HEROES,
  RARITY_LABELS,
  applicableAchievements,
  formatMasteryValue,
  masteryResultHeroId,
  primaryProgress,
} from './masteryCatalog.js';
import './achievementToast.css';

// CP3.2 mastery feedback. This component displays provisional live
// candidates separately from permanent unlocks committed by a valid sealed
// match. It never evaluates an achievement itself. The queue is bounded and
// pointer-transparent so feedback cannot cover input or become toast spam.

const COPY = {
  eng: {
    unlocked: 'ACHIEVEMENT UNLOCKED',
    provisional: 'ACHIEVEMENT IN REACH',
    botFeat: 'BOT FEAT',
    botNote: 'BOT FEAT — NOT ADDED TO YOUR MASTERY',
    sealNote: 'FINISH THE MATCH TO RECORD IT',
    more: (n) => `+${n} MORE RECORDED IN MASTERY VAULT`,
    provisionalMore: (n) => `+${n} MORE WAITING FOR MATCH SEAL`,
    botMore: (n) => `+${n} MORE BOT FEATS — NOT RECORDED`,
    progress: (hero, earned, total) => `${hero} MASTERY ${earned}/${total}`,
    ownerYou: 'YOU',
    ownerP1: 'PLAYER 1',
    ownerP2: 'PLAYER 2',
    ownerBot: 'BOT',
  },
  vie: {
    unlocked: 'ĐÃ MỞ THÀNH TỰU',
    provisional: 'THÀNH TỰU ĐANG CHỜ CHỐT',
    botFeat: 'THÀNH TÍCH CỦA BOT',
    botNote: 'THÀNH TÍCH CỦA BOT — KHÔNG GHI VÀO TINH THÔNG CỦA BẠN',
    sealNote: 'HOÀN THÀNH TRẬN ĐỂ GHI NHẬN',
    more: (n) => `+${n} THÀNH TỰU NỮA ĐÃ GHI VÀO KHO TINH THÔNG`,
    provisionalMore: (n) => `+${n} THÀNH TỰU NỮA ĐANG CHỜ CHỐT TRẬN`,
    botMore: (n) => `+${n} THÀNH TÍCH BOT NỮA — KHÔNG GHI NHẬN`,
    progress: (hero, earned, total) => `TINH THÔNG ${hero} ${earned}/${total}`,
    ownerYou: 'BẠN',
    ownerP1: 'NGƯỜI CHƠI 1',
    ownerP2: 'NGƯỜI CHƠI 2',
    ownerBot: 'BOT',
  },
};

function currentLanguage() {
  try { return window.APEX_I18N?.getLanguage?.() === 'vie' ? 'vie' : 'eng'; }
  catch { return 'eng'; }
}

function normalizeOwner(unlock) {
  const rawIndex = Number.isInteger(unlock?.ownerSideIndex)
    ? unlock.ownerSideIndex
    : Number.isInteger(unlock?.sideIndex) ? unlock.sideIndex : null;
  const sideText = String(unlock?.ownerSide || unlock?.side || '').trim().toUpperCase();
  const ownerSideIndex = rawIndex === 0 || sideText === 'P1' ? 0
    : rawIndex === 1 || sideText === 'P2' ? 1 : null;
  const battleMode = String(unlock?.battleMode || '').trim().toUpperCase();
  let ownerKind = ['human', 'bot', 'player1', 'player2'].includes(unlock?.ownerKind)
    ? unlock.ownerKind : 'unknown';
  if (ownerKind === 'unknown' && ownerSideIndex != null) {
    if (battleMode === 'BOT') ownerKind = ownerSideIndex === 0 ? 'human' : 'bot';
    else if (battleMode === 'LOCAL') ownerKind = ownerSideIndex === 0 ? 'player1' : 'player2';
  }
  const walletEligible = typeof unlock?.walletEligible === 'boolean'
    ? unlock.walletEligible
    : ownerKind === 'human' || ownerKind === 'player1' || ownerKind === 'player2';
  return {
    ownerSide: ownerSideIndex == null ? null : `P${ownerSideIndex + 1}`,
    ownerSideIndex,
    ownerKind,
    walletEligible,
    battleMode: battleMode === 'BOT' || battleMode === 'LOCAL' ? battleMode : null,
  };
}

function ownerLabel(owner, t) {
  if (owner.ownerKind === 'bot') return t.ownerBot;
  if (owner.ownerKind === 'human') return t.ownerYou;
  if (owner.ownerKind === 'player1' || owner.ownerSide === 'P1') return t.ownerP1;
  if (owner.ownerKind === 'player2' || owner.ownerSide === 'P2') return t.ownerP2;
  return '';
}

function queueScore(item) {
  const ownerPriority = item.ownerKind === 'bot' ? 0
    : item.walletEligible ? 3 : 1;
  return (ownerPriority * 10)
    + (item.provisional ? 0 : 2)
    + (item.achievement.rarityWeight || 0);
}

function compareQueueItems(a, b) {
  return (queueScore(b) - queueScore(a)) || (a.at - b.at);
}

function toastDisplayMs(item) {
  return item.ownerKind === 'bot' ? 1800
    : item.provisional ? 2400
      : item.achievement.rarity === 'legendary' ? 3400
        : item.achievement.rarity === 'epic' ? 3000
          : 2600;
}

function toastSfxKey(item) {
  if (item.ownerKind === 'bot') return 'achievement.bot';
  if (item.provisional) return 'achievement.provisional';
  if (item.achievement.rarity === 'legendary') return 'achievement.legendary';
  if (item.achievement.rarity === 'epic') return 'achievement.epic';
  if (item.achievement.rarity === 'rare') return 'achievement.rare';
  return 'achievement.official';
}

function RarityPips({ count }) {
  return (
    <span className="apex-rarity-pips" aria-hidden="true">
      {Array.from({ length: Math.max(1, count || 1) }, (_, index) => <i key={index} />)}
    </span>
  );
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

const TOAST_CLEARANCE = 6;
const GAMEPLAY_BLOCKERS = [
  '#p1Side .skill', '#p2Side .skill',
  '#p1Side .weapon', '#p2Side .weapon',
  '#p1Rail', '#p2Rail', '#matchCenter',
  '#arena', '#arenaCanvas',
  '#freeBattle', '#apexMissionsOpen', '.modeCard', '.rosterCard', '.fighter-card', '.cta', '.lockIn',
  '#apexFirstPlayGuide', '#firstPlayGuide', '[data-apex-first-play-guide]',
  '.apex-first-play-guide', '.first-play-guide',
];

function findSafeToastDock(element, ownerSide) {
  if (!element || typeof window === 'undefined') return null;
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  if (!(width > 0 && height > 0 && viewportWidth > 0 && viewportHeight > 0)) return null;

  const blockers = [...new Set(GAMEPLAY_BLOCKERS.flatMap((selector) => {
    try { return [...document.querySelectorAll(selector)]; } catch { return []; }
  }))].filter((blocker) => blocker !== element && !element.contains(blocker)).map((blocker) => {
    const rect = blocker.getBoundingClientRect();
    const style = getComputedStyle(blocker);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0
      && rect.width > 0 && rect.height > 0
      ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
      : null;
  }).filter(Boolean);

  const xCandidates = new Set([8, viewportWidth - width - 8]);
  const yCandidates = new Set([8, viewportHeight - height - 8]);
  for (const blocker of blockers) {
    xCandidates.add(blocker.right + TOAST_CLEARANCE);
    xCandidates.add(blocker.left - width - TOAST_CLEARANCE);
    yCandidates.add(blocker.bottom + TOAST_CLEARANCE);
    yCandidates.add(blocker.top - height - TOAST_CLEARANCE);
  }

  const preferredLeft = ownerSide === 'P2' ? viewportWidth - width - 8 : 8;
  const preferredTop = viewportHeight - height - 8;
  let best = null;
  for (const left of xCandidates) for (const top of yCandidates) {
    if (left < 8 || top < 8 || left + width > viewportWidth - 8 || top + height > viewportHeight - 8) continue;
    const candidate = {
      left: left - TOAST_CLEARANCE,
      top: top - TOAST_CLEARANCE,
      right: left + width + TOAST_CLEARANCE,
      bottom: top + height + TOAST_CLEARANCE,
    };
    if (blockers.some((blocker) => candidate.left < blocker.right && candidate.right > blocker.left
      && candidate.top < blocker.bottom && candidate.bottom > blocker.top)) continue;
    const score = Math.abs(left - preferredLeft) + Math.abs(top - preferredTop) * 1.15;
    if (!best || score < best.score) best = { left, top, score };
  }
  return best ? { left: best.left, top: best.top, safe: true }
    : { left: preferredLeft, top: Math.max(8, preferredTop), safe: false };
}

export default function AchievementToast() {
  const [current, setCurrent] = useState(null);
  const [overflow, setOverflow] = useState(0);
  const [dock, setDock] = useState(null);
  const toastRef = useRef(null);
  const [language, setLanguage] = useState(currentLanguage);
  const queueRef = useRef([]);
  const activeRef = useRef(null);
  const overflowRef = useRef(0);
  const seenRef = useRef(new Set());
  const hideTimerRef = useRef(0);
  const nextTimerRef = useRef(0);
  const remainingDisplayRef = useRef(null);
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
    try { window.apexUiSfx?.play?.(toastSfxKey(next)); } catch { /* sound is optional */ }
    // The read timer is owned by the safe-dock effect below. A queued award
    // must remain pending, not expire invisibly, while every legal HUD lane is
    // occupied; the visible duration begins only after an actual safe dock.
    remainingDisplayRef.current = { key: next.key, remaining: toastDisplayMs(next) };
    window.clearTimeout(hideTimerRef.current);
  }, []);
  showNextRef.current = showNext;

  useLayoutEffect(() => {
    if (!current) {
      setDock(null);
      return undefined;
    }
    const element = toastRef.current;
    if (!element) return undefined;
    let frame = 0;
    const place = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = findSafeToastDock(element, current.ownerSide);
        setDock((previous) => previous?.left === next?.left && previous?.top === next?.top
          && previous?.safe === next?.safe ? previous : next);
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('orientationchange', place);
    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(place);
      observer.observe(element);
      for (const selector of GAMEPLAY_BLOCKERS) {
        try { document.querySelectorAll(selector).forEach((blocker) => observer.observe(blocker)); }
        catch { /* an optional HUD/tutorial anchor is not mounted */ }
      }
    }
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
      window.removeEventListener('orientationchange', place);
      observer?.disconnect();
    };
  }, [current?.key, current?.ownerSide, overflow, language]);

  useEffect(() => {
    if (!current) return undefined;
    if (remainingDisplayRef.current?.key !== current.key) {
      remainingDisplayRef.current = { key: current.key, remaining: toastDisplayMs(current) };
    }
    if (!dock?.safe) return undefined;
    const remaining = Math.max(0, remainingDisplayRef.current.remaining);
    const startedAt = Date.now();
    let completed = false;
    hideTimerRef.current = window.setTimeout(() => {
      completed = true;
      remainingDisplayRef.current = { key: current.key, remaining: 0 };
      activeRef.current = null;
      setCurrent(null);
      nextTimerRef.current = window.setTimeout(() => showNextRef.current?.(), 140);
    }, remaining);
    return () => {
      window.clearTimeout(hideTimerRef.current);
      if (!completed && remainingDisplayRef.current?.key === current.key) {
        remainingDisplayRef.current.remaining = Math.max(0, remaining - (Date.now() - startedAt));
      }
    };
  }, [current?.key, dock?.safe]);

  useEffect(() => {
    const enqueue = (event) => {
      const unlocks = Array.isArray(event?.detail?.unlocks) ? event.detail.unlocks : [];
      const incoming = unlocks
        .map((unlock) => {
          const achievement = MASTERY_BY_ID[unlock?.achievementId];
          if (!achievement) return null;
          const heroId = masteryResultHeroId(unlock.heroId);
          const at = Number(unlock.at) || Date.now();
          const provisional = event.type === 'apex:mastery-provisional' || unlock.provisional === true;
          const owner = normalizeOwner(unlock);
          return {
            key: `${provisional ? 'provisional' : 'sealed'}:${owner.ownerSide || 'unknown'}:${heroId}:${achievement.id}:${at}`,
            achievement,
            // CP5.1: the ledger/meta payload already carries the primary
            // metric that crossed the threshold; the toast renders it as
            // an achieved-vs-target meter from the same catalog authority.
            value: Number.isFinite(Number(unlock?.value)) ? Number(unlock.value) : null,
            heroId,
            heroName: MASTERY_HEROES.find((hero) => hero.resultId === heroId)?.name || heroId,
            at,
            provisional,
            ...owner,
          };
        })
        .filter(Boolean)
        .sort(compareQueueItems);

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
          let weakestScore = Infinity;
          queueRef.current.forEach((queued, index) => {
            const score = queueScore(queued);
            if (score < weakestScore) {
              weakestScore = score;
              weakestIndex = index;
            }
          });
          if (weakestIndex >= 0 && queueScore(item) > weakestScore) {
            queueRef.current[weakestIndex] = item;
          }
        }
      }
      queueRef.current.sort(compareQueueItems);
      setOverflow(overflowRef.current);
      showNext();
    };
    const onLanguage = () => setLanguage(currentLanguage());
    window.addEventListener('apex:mastery-unlocked', enqueue);
    window.addEventListener('apex:mastery-provisional', enqueue);
    window.addEventListener('apex:language-changed', onLanguage);
    return () => {
      window.removeEventListener('apex:mastery-unlocked', enqueue);
      window.removeEventListener('apex:mastery-provisional', enqueue);
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
  const achievementTitle = translateCopy(achievement.name, lang);
  const presentation = achievement.rarityPresentation || {};
  const isBotFeat = current.ownerKind === 'bot';
  const progress = isBotFeat ? null : heroProgress(current.heroId);
  const ownerText = ownerLabel(current, t);
  const statusText = isBotFeat ? t.botFeat : current.provisional ? t.provisional : t.unlocked;
  const detailText = isBotFeat ? t.botNote
    : current.provisional ? t.sealNote
      : t.progress(current.heroName, progress.earned, progress.total);
  const overflowText = isBotFeat ? t.botMore(overflow)
    : current.provisional ? t.provisionalMore(overflow) : t.more(overflow);
  const progressInfo = current.value != null
    ? primaryProgress(achievement, current.value, !current.provisional)
    : null;
  const showMeter = !!progressInfo && progressInfo.compare !== 'event' && progressInfo.current != null;
  const meterUnit = progressInfo?.unit ? translateCopy(progressInfo.unit, lang) : '';
  const meterText = showMeter
    ? `${formatMasteryValue(progressInfo.current)} / ${progressInfo.compare === 'lte' ? '≤ ' : ''}${formatMasteryValue(progressInfo.target)}${meterUnit ? ` ${meterUnit}` : ''}`
    : '';
  const meterStatus = showMeter
    ? lang === 'vie'
      ? `Đã đạt ${formatMasteryValue(progressInfo.current)} ${meterUnit}; mục tiêu ${progressInfo.compare === 'lte' ? 'tối đa ' : ''}${formatMasteryValue(progressInfo.target)} ${meterUnit}`.trim()
      : `Achieved ${formatMasteryValue(progressInfo.current)} ${meterUnit}; target ${progressInfo.compare === 'lte' ? 'at most ' : ''}${formatMasteryValue(progressInfo.target)} ${meterUnit}`.trim()
    : '';

  // CP5: BOT feats render as a compact edge chip (ref: edge-feed hierarchy)
  // so an opponent event never carries the same weight as the player's own
  // unlock. Ownership, rarity shape and the not-recorded note all survive.
  return (
    <div
      className={`apex-achievement-toast rarity-${achievement.rarity} owner-${current.ownerKind}${current.provisional ? ' is-provisional' : ' is-sealed'}${isBotFeat ? ' is-compact' : ''}`}
      key={current.key}
      data-provisional={current.provisional ? 'true' : 'false'}
      data-owner-side={current.ownerSide || 'unknown'}
      data-owner-kind={current.ownerKind}
      data-wallet-eligible={current.walletEligible ? 'true' : 'false'}
      data-dock-safe={dock?.safe ? 'true' : 'false'}
      data-visual-pending={dock?.safe ? 'false' : 'true'}
      ref={toastRef}
      style={dock
        ? { left: `${dock.left}px`, top: `${dock.top}px`, right: 'auto', bottom: 'auto', ...(dock.safe ? {} : { opacity: 0 }) }
        : { opacity: 0 }}
      role="status"
      aria-live="polite"
      data-apex-no-localize=""
    >
      <div
        className={`apex-achievement-toast-medal shape-${presentation.shape || 'circle'} pattern-${presentation.pattern || 'plain'}`}
        data-rarity-shape={presentation.shape || 'circle'}
        aria-hidden="true"
      >
        <span className="apex-achievement-toast-glyph">{achievement.iconGlyph}</span>
        <RarityPips count={presentation.pips} />
      </div>
      <div className="apex-achievement-toast-copy">
        <span>{isBotFeat
          ? `${current.ownerSide || 'P2'} · ${t.ownerBot} · ${RARITY_LABELS[achievement.rarity]?.[lang] || achievement.rarity}`
          : `${ownerText ? `${ownerText} · ` : ''}${statusText} · ${RARITY_LABELS[achievement.rarity]?.[lang] || achievement.rarity}`}</span>
        <strong>{achievementTitle}</strong>
        {showMeter && (
          <span className="apex-achievement-toast-meter" role="group" aria-label={meterStatus}
            data-achieved={progressInfo.current} data-threshold={progressInfo.target} data-compare={progressInfo.compare}>
            <i aria-hidden="true"><b style={{ width: `${progressInfo.percent}%` }} /></i>
            <em>{meterText}</em>
          </span>
        )}
        <small>{detailText}</small>
        {overflow > 0 && <small className="apex-achievement-toast-more">{overflowText}</small>}
      </div>
    </div>
  );
}
