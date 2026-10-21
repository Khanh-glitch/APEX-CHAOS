import React, { useCallback, useEffect, useRef, useState } from 'react';
import './firstPlayGuide.css';

// APEX CHAOS — Learn by Playing coach (CP3).
// This replaces the static first-play carousel with one anchored prompt at
// a time. The coach is presentation only: it never clicks, selects, locks,
// casts or opens anything for the player. Its persisted step advances from
// real DOM/scene/projection proof of the player's own action.
//
// Source-verified Free Battle controls: P1 J = Skill 1, K = Skill 2; touch
// uses the real HUD skill cards. BOT WAVE and Quest are deliberately out of
// scope. The beacon/chip are pointer-transparent; only SKIP captures input.

const COACH_KEY = 'apex.alpha.coach.v2';
const LEGACY_KEY = 'apex.alpha.guide.v1';
const LAST_STEP = 5;

const COPY = {
  eng: {
    kicker: 'LEARN BY PLAYING',
    skip: 'SKIP',
    steps: [
      { title: 'START HERE', body: 'Press FREE BATTLE.' },
      { title: 'FIRST FIGHT', body: 'Choose VS BOT.' },
      { title: 'READY?', body: 'Pick your fighter, then LOCK IN.' },
      { title: 'SKILL 1 READY', keyboard: 'Press J to cast Skill 1.', touch: 'Tap the highlighted Skill 1 card.' },
      { title: 'SKILL 2 READY', keyboard: 'Press K to cast Skill 2.', touch: 'Tap the highlighted Skill 2 card.' },
      { title: 'REWARDS WAITING', body: 'Open MISSIONS to claim starter rewards and view Mastery.' },
    ],
  },
  vie: {
    kicker: 'HỌC BẰNG CÁCH CHƠI',
    skip: 'BỎ QUA',
    steps: [
      { title: 'BẮT ĐẦU TẠI ĐÂY', body: 'Nhấn ĐẤU TỰ DO.' },
      { title: 'TRẬN ĐẦU TIÊN', body: 'Chọn ĐẤU BOT.' },
      { title: 'SẴN SÀNG CHƯA?', body: 'Chọn tướng rồi nhấn LOCK IN.' },
      { title: 'KỸ NĂNG 1 ĐÃ SẴN SÀNG', keyboard: 'Nhấn J để tung Kỹ năng 1.', touch: 'Chạm thẻ Kỹ năng 1 đang được đánh dấu.' },
      { title: 'KỸ NĂNG 2 ĐÃ SẴN SÀNG', keyboard: 'Nhấn K để tung Kỹ năng 2.', touch: 'Chạm thẻ Kỹ năng 2 đang được đánh dấu.' },
      { title: 'PHẦN THƯỞNG ĐANG CHỜ', body: 'Mở NHIỆM VỤ để nhận thưởng khởi đầu và xem Tinh thông.' },
    ],
  },
};

function currentLanguage() {
  try { return window.APEX_I18N?.getLanguage?.() === 'vie' ? 'vie' : 'eng'; }
  catch { return 'eng'; }
}

function sealedCounts() {
  try {
    const state = window.APEX_ARSENAL_META?.getState?.();
    if (!state) return null;
    const progression = state.progression || {};
    const bot = Number(progression.botMatches ?? state.botMatches) || 0;
    const local = Number(progression.localMatches ?? state.localMatches) || 0;
    return { bot, local, total: bot + local };
  } catch { return null; }
}

function cleanCount(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function sanitizeCoach(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return {
    version: 2,
    step: Math.max(0, Math.min(LAST_STEP, Number(raw.step) || 0)),
    done: raw.done === true,
    skipped: raw.skipped === true,
    baselineBotMatches: cleanCount(raw.baselineBotMatches),
    baselineSealedMatches: cleanCount(raw.baselineSealedMatches),
  };
}

function readCoach() {
  try {
    const raw = localStorage.getItem(COACH_KEY);
    return raw ? sanitizeCoach(JSON.parse(raw)) : null;
  } catch { return null; }
}

function freshCoach(counts, done = false, skipped = false) {
  return {
    version: 2,
    step: 0,
    done,
    skipped,
    baselineBotMatches: counts ? counts.bot : null,
    baselineSealedMatches: counts ? counts.total : null,
  };
}

function stageElement() {
  return document.querySelector('#gold-shell-host #stage') || document.querySelector('#stage');
}

function bootGateVisible() {
  const gate = document.querySelector('#apex-boot-start');
  if (!gate) return false;
  const rect = gate.getBoundingClientRect();
  const style = window.getComputedStyle?.(gate);
  return rect.width > 0 && rect.height > 0 && style?.display !== 'none' && style?.visibility !== 'hidden';
}

function battleVisible() {
  try {
    // The production Battle HUD is a same-document donor mounted outside the
    // Gold shell stage: its own #stage carries no screen-battle class, while
    // the shell stage is hidden. Detect combat from the HUD/body/state
    // authorities instead of mistaking that hidden shell stage for Home.
    if (document.body?.classList?.contains('battle-hud-open')) return true;
    if (document.querySelector('#battleHudHost.is-open')) return true;
    if (battleState()?.active) return true;
    return [...document.querySelectorAll('#stage')].some((el) => el.classList.contains('screen-battle'));
  } catch { return false; }
}

function currentScene() {
  if (bootGateVisible()) return 'boot';
  if (battleVisible()) return 'battle';
  const stage = stageElement();
  if (!stage) return 'unknown';
  if (stage.classList.contains('screen-fighter')) return 'fighter';
  if (stage.classList.contains('screen-mode')) return 'mode';
  if (['screen-draw', 'flow-transition'].some((name) => stage.classList.contains(name))) return 'other';
  return 'home';
}

function battleState() {
  try { return window.APEX_ARSENAL?.state || null; } catch { return null; }
}

function isBotBattle() {
  const state = battleState();
  return String(state?.battleMode || '').toUpperCase() === 'BOT'
    && !state?.labMode
    && !state?.questMultiActor
    && !state?.questStage;
}

function findByText(root, selector, patterns) {
  if (!root) return null;
  const normalized = patterns.map((item) => item.toUpperCase());
  return [...root.querySelectorAll(selector)].find((element) => {
    const text = String(element.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();
    return normalized.some((pattern) => text.includes(pattern));
  }) || null;
}

function skillAnchor(index) {
  return document.querySelector(`#p1Side .skill[data-i="${index}"]`)
    || document.querySelector(`.skill[data-p="1"][data-i="${index}"]`)
    || document.querySelectorAll('#hud .skill')[index]
    || null;
}

function projectedSkill(index) {
  try {
    const projection = window.APEX_GOLD_PROJECTION?.();
    return projection?.state?.sides?.[0]?.skills?.[index] || null;
  } catch { return null; }
}

function skillInfo(index) {
  const element = skillAnchor(index);
  const projected = projectedSkill(index);
  const state = element?.dataset?.state || '';
  let charges = Number(projected?.charges);
  if (!Number.isFinite(charges)) charges = state === 'ready' ? 1 : 0;
  const nextIn = Number(projected?.nextIn) || 0;
  const ready = element
    ? state === 'ready' && projected?.locked !== true
    : !!projected && projected.locked !== true && charges > 0;
  return { element, projected, state, charges, nextIn, ready };
}

function findAnchor(step) {
  const stage = stageElement();
  if (step === 0) return document.querySelector('#freeBattle');
  if (step === 1) {
    return stage?.querySelector('.modeCard[data-mode="bot"]')
      || document.querySelector('.modeCard[data-mode="bot"]')
      || findByText(stage || document, 'button, [role="button"]', ['VS BOT', 'BOT BATTLE', 'ĐẤU BOT']);
  }
  if (step === 2) return document.querySelector('#lockIn') || stage?.querySelector('.lockIn');
  if (step === 3) return skillInfo(0).element;
  if (step === 4) return skillInfo(1).element;
  if (step === 5) return document.querySelector('#apexMissionsOpen');
  return null;
}

function stepSceneMatches(step, scene) {
  if (step === 0 || step === 5) return scene === 'home';
  if (step === 1) return scene === 'mode';
  if (step === 2) return scene === 'fighter';
  if (step === 3 || step === 4) return scene === 'battle' && isBotBattle();
  return false;
}

function anchorReceivesHit(anchor, rect) {
  if (!document.elementFromPoint) return true;
  const width = window.innerWidth || document.documentElement.clientWidth || 0;
  const height = window.innerHeight || document.documentElement.clientHeight || 0;
  const points = [[0.5, 0.5], [0.25, 0.5], [0.75, 0.5], [0.5, 0.25], [0.5, 0.75]];
  return points.some(([fx, fy]) => {
    const x = rect.left + (rect.width * fx);
    const y = rect.top + (rect.height * fy);
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const hit = document.elementFromPoint(x, y);
    return hit === anchor || anchor.contains(hit);
  });
}

function computeFrame(step, anchor) {
  if (!anchor?.isConnected) return null;
  const rect = anchor.getBoundingClientRect();
  if (!Number.isFinite(rect.width) || rect.width < 2 || rect.height < 2) return null;
  const style = window.getComputedStyle?.(anchor);
  if (style?.display === 'none' || style?.visibility === 'hidden' || Number(style?.opacity) === 0) return null;
  // A modal product surface (Archive/Account/Locker) can cover the Home
  // anchor without changing the coach step. Hide until the real control is
  // the hit target again instead of floating a chip over that surface.
  if (!anchorReceivesHit(anchor, rect)) return null;

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || rect.right;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || rect.bottom;
  const cardWidth = Math.min(320, Math.max(220, viewportWidth - 24));
  const gap = 10;
  const clampLeft = (value) => Math.max(12, Math.min(Math.max(12, viewportWidth - cardWidth - 12), value));
  const clampTop = (value) => Math.max(12, Math.min(Math.max(12, viewportHeight - 96), value));

  let placement = 'above';
  let chipLeft = clampLeft(rect.left + (rect.width / 2) - (cardWidth / 2));
  let chipTop = Math.max(12, rect.top - gap);
  let chipTransform = 'translateY(-100%)';

  if ((step === 3 || step === 4) && rect.left > cardWidth + gap + 12) {
    placement = 'left';
    chipLeft = rect.left - cardWidth - gap;
    chipTop = clampTop(rect.top);
    chipTransform = 'none';
  } else if ((step === 3 || step === 4) && viewportWidth - rect.right > cardWidth + gap + 12) {
    placement = 'right';
    chipLeft = rect.right + gap;
    chipTop = clampTop(rect.top);
    chipTransform = 'none';
  } else if (rect.top < 118) {
    placement = 'below';
    chipTop = Math.min(Math.max(12, viewportHeight - 96), rect.bottom + gap);
    chipTransform = 'none';
  }

  return {
    beaconLeft: Math.round(rect.left - 5),
    beaconTop: Math.round(rect.top - 5),
    beaconWidth: Math.round(rect.width + 10),
    beaconHeight: Math.round(rect.height + 10),
    chipLeft: Math.round(chipLeft),
    chipTop: Math.round(chipTop),
    chipWidth: Math.round(cardWidth),
    chipTransform,
    placement,
  };
}

export default function FirstPlayGuide() {
  const [coach, setCoach] = useState(readCoach);
  const [active, setActive] = useState(() => {
    const stored = readCoach();
    return !!stored && !stored.done;
  });
  const [frame, setFrame] = useState(null);
  const [language, setLanguage] = useState(currentLanguage);
  const [coarse] = useState(() => {
    try { return !!window.matchMedia?.('(pointer: coarse)').matches; } catch { return false; }
  });

  const coachRef = useRef(coach);
  const activeRef = useRef(active);
  const frameKeyRef = useRef('');
  const skillSnapshotsRef = useRef([null, null]);
  const bootstrappedRef = useRef(false);

  const persistCoach = useCallback((next) => {
    coachRef.current = next;
    setCoach(next);
    try { localStorage.setItem(COACH_KEY, JSON.stringify(next)); } catch { /* session-only if storage is unavailable */ }
    return next;
  }, []);

  const clearFrame = useCallback(() => {
    if (frameKeyRef.current !== '') {
      frameKeyRef.current = '';
      setFrame(null);
    }
  }, []);

  const updateCoach = useCallback((patch) => {
    const current = coachRef.current;
    if (!current) return null;
    const next = { ...current, ...patch };
    if (JSON.stringify(next) === JSON.stringify(current)) return current;
    if (Object.prototype.hasOwnProperty.call(patch, 'step') && patch.step !== current.step) clearFrame();
    return persistCoach(next);
  }, [clearFrame, persistCoach]);

  const setActiveBoth = useCallback((next) => {
    activeRef.current = next;
    setActive(next);
    if (!next) clearFrame();
  }, [clearFrame]);

  const finishCoach = useCallback((skipped = false) => {
    const current = coachRef.current || freshCoach(sealedCounts());
    persistCoach({ ...current, done: true, skipped: skipped || current.skipped });
    activeRef.current = false;
    setActive(false);
    clearFrame();
  }, [clearFrame, persistCoach]);

  const skipCoach = useCallback(() => finishCoach(true), [finishCoach]);

  const replayCoach = useCallback(() => {
    setLanguage(currentLanguage());
    persistCoach(freshCoach(sealedCounts()));
    skillSnapshotsRef.current = [null, null];
    activeRef.current = true;
    setActive(true);
    clearFrame();
  }, [clearFrame, persistCoach]);

  const hideCoach = useCallback(() => setActiveBoth(false), [setActiveBoth]);

  useEffect(() => { coachRef.current = coach; }, [coach]);
  useEffect(() => { activeRef.current = active; }, [active]);

  // Bootstrap/resume. A v2 record resumes exactly where it stopped; a v1
  // dismissal is honoured; a brand-new zero-match profile starts at step 0.
  useEffect(() => {
    if (bootstrappedRef.current) return undefined;
    bootstrappedRef.current = true;
    if (coachRef.current) {
      setActiveBoth(!coachRef.current.done);
      return undefined;
    }

    let tries = 0;
    const poll = window.setInterval(() => {
      tries += 1;
      const counts = sealedCounts();
      if (counts === null && tries <= 40) return;
      window.clearInterval(poll);
      let legacySeen = false;
      try { legacySeen = localStorage.getItem(LEGACY_KEY) === '1'; } catch { legacySeen = false; }
      if (legacySeen || !counts || counts.total > 0) {
        persistCoach(freshCoach(counts, true, legacySeen));
        setActiveBoth(false);
        return;
      }
      persistCoach(freshCoach(counts));
      setActiveBoth(true);
    }, 250);
    return () => window.clearInterval(poll);
  }, [persistCoach, setActiveBoth]);

  // Replay "?" lives in the Gold stage, as before. CSS hides it away from
  // Home so it can never sit over pick or battle controls.
  useEffect(() => {
    const onOpen = () => replayCoach();
    const onLanguage = () => setLanguage(currentLanguage());
    window.addEventListener('apex:guide-open', onOpen);
    window.addEventListener('apex:language-changed', onLanguage);

    let guideBtn = null;
    const mountBtn = () => {
      if (guideBtn?.isConnected) return;
      const stage = stageElement();
      if (!stage) return;
      guideBtn = document.createElement('button');
      guideBtn.type = 'button';
      guideBtn.id = 'apex-guide-open';
      guideBtn.dataset.apexNoLocalize = '';
      guideBtn.setAttribute('aria-label', 'How to play / Hướng dẫn chơi');
      guideBtn.textContent = '?';
      guideBtn.addEventListener('click', replayCoach);
      stage.appendChild(guideBtn);
    };
    mountBtn();
    const guard = new MutationObserver(mountBtn);
    guard.observe(document.body, { subtree: true, childList: true });

    return () => {
      window.removeEventListener('apex:guide-open', onOpen);
      window.removeEventListener('apex:language-changed', onLanguage);
      guard.disconnect();
      guideBtn?.remove();
    };
  }, [replayCoach]);

  useEffect(() => {
    const api = Object.freeze({
      open: replayCoach,
      close: hideCoach,
      skip: skipCoach,
      isOpen: () => activeRef.current && !coachRef.current?.done,
      state: () => (coachRef.current ? { ...coachRef.current } : null),
    });
    window.APEX_FIRST_PLAY_GUIDE = api;
    window.APEX_LEARN_BY_PLAYING = api;
    return () => {
      if (window.APEX_FIRST_PLAY_GUIDE === api) delete window.APEX_FIRST_PLAY_GUIDE;
      if (window.APEX_LEARN_BY_PLAYING === api) delete window.APEX_LEARN_BY_PLAYING;
    };
  }, [hideCoach, replayCoach, skipCoach, active, coach?.done]);

  const setFrameIfChanged = useCallback((nextFrame) => {
    const key = nextFrame ? JSON.stringify(nextFrame) : '';
    if (frameKeyRef.current === key) return;
    frameKeyRef.current = key;
    setFrame(nextFrame);
  }, []);

  const syncCoach = useCallback(() => {
    const current = coachRef.current;
    if (!activeRef.current || !current || current.done) {
      clearFrame();
      return;
    }

    const scene = currentScene();
    const counts = sealedCounts();
    let step = current.step;
    let baselineBotMatches = current.baselineBotMatches;
    let baselineSealedMatches = current.baselineSealedMatches;

    if (baselineBotMatches == null && counts && step < 3) baselineBotMatches = counts.bot;
    if (baselineSealedMatches == null && counts && step < 3) baselineSealedMatches = counts.total;

    if (step === LAST_STEP && document.querySelector('.apex-progress-panel')) {
      finishCoach(false);
      return;
    }

    if (step >= 3 && step <= 4 && scene !== 'battle') {
      const sealedBotSinceStart = counts && baselineBotMatches != null && counts.bot > baselineBotMatches;
      if (sealedBotSinceStart) step = LAST_STEP;
      else if (scene === 'home') step = 0;
      else if (scene === 'mode') step = 1;
      else if (scene === 'fighter') step = 2;
      skillSnapshotsRef.current = [null, null];
    } else if (step < 3) {
      if (scene === 'home') step = 0;
      else if (scene === 'mode') step = 1;
      else if (scene === 'fighter') step = 2;
      else if (scene === 'battle' && isBotBattle()) step = 3;
    }

    if (step >= 2 && step < LAST_STEP && scene === 'home' && counts
      && baselineBotMatches != null && counts.bot > baselineBotMatches) {
      step = LAST_STEP;
    }

    // Real skill-cast proof: a ready production skill transitions into a
    // cast/active/cooldown state, loses a charge, or gains real cooldown.
    if ((step === 3 || step === 4) && scene === 'battle' && isBotBattle()) {
      const watchedIndex = step - 3;
      const infos = [skillInfo(0), skillInfo(1)];
      infos.forEach((info, index) => {
        const previous = skillSnapshotsRef.current[index];
        const cast = !!previous?.ready && (
          ['cast', 'active', 'cd'].includes(info.state)
          || info.charges < previous.charges
          || info.nextIn > previous.nextIn + 0.25
        );
        if (index === watchedIndex && cast) step += 1;
        skillSnapshotsRef.current[index] = {
          ready: info.ready,
          charges: info.charges,
          nextIn: info.nextIn,
          state: info.state,
        };
      });
    } else if (scene !== 'battle') {
      skillSnapshotsRef.current = [null, null];
    }

    if (step !== current.step || baselineBotMatches !== current.baselineBotMatches
      || baselineSealedMatches !== current.baselineSealedMatches) {
      updateCoach({ step, baselineBotMatches, baselineSealedMatches });
    }

    if (!stepSceneMatches(step, scene)) {
      setFrameIfChanged(null);
      return;
    }

    if ((step === 3 || step === 4) && !skillInfo(step - 3).ready) {
      setFrameIfChanged(null);
      return;
    }

    setFrameIfChanged(computeFrame(step, findAnchor(step)));
  }, [clearFrame, finishCoach, setFrameIfChanged, updateCoach]);

  useEffect(() => {
    if (!active || !coach || coach.done) {
      clearFrame();
      return undefined;
    }

    const onClick = (event) => {
      if (event.target?.closest?.('.apex-coach-skip')) return;
      const current = coachRef.current;
      if (!activeRef.current || !current || current.done) return;
      const step = current.step;
      if (step === 0 && event.target?.closest?.('#freeBattle')) {
        updateCoach({ step: 1 });
      } else if (step === 1 && event.target?.closest?.('.modeCard[data-mode="bot"]')) {
        updateCoach({ step: 2 });
      } else if (step === LAST_STEP && event.target?.closest?.('#apexMissionsOpen')) {
        // The progress-panel proof is checked on the next sync; also finish
        // shortly after the real click if the panel mounted synchronously.
        window.setTimeout(syncCoach, 40);
      }
    };

    syncCoach();
    document.addEventListener('click', onClick, true);
    window.addEventListener('resize', syncCoach, { passive: true });
    window.addEventListener('scroll', syncCoach, { passive: true, capture: true });
    const interval = window.setInterval(syncCoach, 160);
    const host = document.querySelector('#gold-shell-host') || document.body;
    const observer = new MutationObserver(syncCoach);
    observer.observe(host, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'data-state', 'aria-hidden'],
    });

    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('resize', syncCoach);
      window.removeEventListener('scroll', syncCoach, true);
      window.clearInterval(interval);
      observer.disconnect();
    };
  }, [active, coach, coach?.done, clearFrame, syncCoach, updateCoach]);

  if (!active || !coach || coach.done || !frame) return null;

  const lang = language === 'vie' ? 'vie' : 'eng';
  const copy = COPY[lang];
  const item = copy.steps[coach.step] || copy.steps[0];
  const body = item.body || (coarse ? item.touch : item.keyboard);

  return (
    <div className="apex-guide-dock apex-coach-layer" aria-live="polite">
      <div
        className="apex-coach-beacon"
        aria-hidden="true"
        style={{
          left: `${frame.beaconLeft}px`,
          top: `${frame.beaconTop}px`,
          width: `${frame.beaconWidth}px`,
          height: `${frame.beaconHeight}px`,
        }}
      />
      <section
        className="apex-guide-card apex-coach-chip"
        role="status"
        aria-label={`${copy.kicker}: ${item.title}. ${body}`}
        data-placement={frame.placement}
        data-apex-no-localize=""
        style={{
          left: `${frame.chipLeft}px`,
          top: `${frame.chipTop}px`,
          width: `${frame.chipWidth}px`,
          transform: frame.chipTransform,
        }}
      >
        <div className="apex-coach-copy">
          <p className="apex-guide-kicker">{copy.kicker} · {coach.step + 1}/{LAST_STEP + 1}</p>
          <h2>{item.title}</h2>
          <p className="apex-guide-body">{body}</p>
        </div>
        <button type="button" className="apex-coach-skip" onClick={skipCoach}>{copy.skip}</button>
      </section>
    </div>
  );
}
