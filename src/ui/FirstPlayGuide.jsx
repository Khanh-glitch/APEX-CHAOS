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
    actionKicker: 'YOUR MOVE',
    skip: 'SKIP',
    pausedNote: 'MATCH PAUSED — TAKE YOUR TIME',
    sideYou: 'YOU · PLAYER 1',
    sideBot: 'BOT · PLAYER 2',
    sideP1: 'PLAYER 1',
    sideP2: 'PLAYER 2',
    steps: [
      { title: 'START HERE', body: 'Press FREE BATTLE.' },
      { title: 'FIRST FIGHT', body: 'Choose VS BOT.' },
      { title: 'READY?', body: 'Pick your fighter, then LOCK IN.' },
      { title: 'CAST SKILL 1', keyboard: 'Press J now.', touch: 'Tap Skill 1 now.' },
      { title: 'CAST SKILL 2', keyboard: 'Press K now.', touch: 'Tap Skill 2 now.' },
      { title: 'REWARDS WAITING', body: 'Open MISSIONS to claim starter rewards and view Mastery.' },
    ],
  },
  vie: {
    kicker: 'HỌC BẰNG CÁCH CHƠI',
    actionKicker: 'LƯỢT CỦA BẠN',
    skip: 'BỎ QUA',
    pausedNote: 'TRẬN ĐANG TẠM DỪNG — CỨ THONG THẢ',
    sideYou: 'BẠN · NGƯỜI CHƠI 1',
    sideBot: 'BOT · NGƯỜI CHƠI 2',
    sideP1: 'NGƯỜI CHƠI 1',
    sideP2: 'NGƯỜI CHƠI 2',
    steps: [
      { title: 'BẮT ĐẦU TẠI ĐÂY', body: 'Nhấn ĐẤU TỰ DO.' },
      { title: 'TRẬN ĐẦU TIÊN', body: 'Chọn ĐẤU BOT.' },
      { title: 'SẴN SÀNG CHƯA?', body: 'Chọn tướng rồi nhấn LOCK IN.' },
      { title: 'TUNG CHIÊU 1', keyboard: 'Nhấn J ngay.', touch: 'Chạm thẻ Kỹ năng 1 ngay.' },
      { title: 'TUNG CHIÊU 2', keyboard: 'Nhấn K ngay.', touch: 'Chạm thẻ Kỹ năng 2 ngay.' },
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

// CP5.1: the instruction names the actual skill being taught, read from
// the live HUD projection/DOM at render time — never a per-hero table in
// the coach. Falls back to the generic Skill 1/2 wording when unavailable.
function taughtSkillName(index) {
  try {
    const projected = projectedSkill(index);
    const fromProjection = projected?.name || projected?.label || projected?.title;
    if (typeof fromProjection === 'string' && fromProjection.trim().length >= 2) {
      return fromProjection.trim().slice(0, 28).toUpperCase();
    }
    const element = skillAnchor(index);
    const named = element?.querySelector?.('[data-name], .skillName, .skill-name, strong, h3, h4, b');
    const text = String(named?.textContent || '').trim();
    if (text.length >= 2 && text.length <= 28 && /[A-Za-zÀ-ỹ]/.test(text)) return text.toUpperCase();
  } catch { /* presentation only */ }
  return '';
}

// CP5.1: the paused pill docks inside the arena's top edge (measured from
// the live arena canvas each render), so "the match is paused" reads at
// the place the player is looking — not buried inside the coach chip.
function arenaPillStyle() {
  try {
    let best = null;
    document.querySelectorAll('canvas').forEach((canvas) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 200 && rect.height > 200 && (!best || rect.width * rect.height > best.width * best.height)) best = rect;
    });
    if (best) {
      return {
        top: `${Math.round(best.top + 10)}px`,
        right: `${Math.max(8, Math.round(window.innerWidth - best.right + 10))}px`,
      };
    }
  } catch { /* fall through to the safe default */ }
  return { top: '96px', right: '10px' };
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

const SIDE_INTRO_KEY = 'apex.alpha.sideIntro.v1';

function playCoachSfx(key) {
  try { window.apexUiSfx?.play?.(key); } catch { /* sound is optional */ }
}

function publishTutorialPause(slot) {
  try {
    window.APEX_TUTORIAL_PAUSE = {
      active: true,
      slot,
      updatedAt: Date.now(),
      source: 'cp4-coach',
    };
  } catch { /* hero-rework lease is fail-closed without this object */ }
}

function clearTutorialPause() {
  try {
    window.APEX_TUTORIAL_PAUSE = {
      active: false,
      updatedAt: Date.now(),
      source: 'cp4-coach',
    };
  } catch { /* nothing to release */ }
}

function liveFighters() {
  try { return Array.isArray(window.fighters) ? window.fighters : []; }
  catch { return []; }
}

function bodyVelocity(body) {
  const measured = body?.__hrVel;
  if (measured && Number.isFinite(measured.x) && Number.isFinite(measured.y)) {
    return { x: Number(measured.x), y: Number(measured.y) };
  }
  let mult = 1;
  try {
    if (typeof body?.speedMult === 'function') mult = Number(body.speedMult()) || 0;
  } catch { mult = 1; }
  const speed = (Number(body?.baseSpeed) || 0) * mult;
  return {
    x: (Number(body?.dir?.x) || 0) * speed,
    y: (Number(body?.dir?.y) || 0) * speed,
  };
}

function closestApproach(from, velocity, point, horizon) {
  const rx = point.x - from.x;
  const ry = point.y - from.y;
  const vv = (velocity.x * velocity.x) + (velocity.y * velocity.y);
  const t = vv > 1 ? Math.max(0, Math.min(horizon, (rx * velocity.x + ry * velocity.y) / vv)) : 0;
  const qx = from.x + velocity.x * t;
  const qy = from.y + velocity.y * t;
  return { t, distance: Math.hypot(point.x - qx, point.y - qy) };
}

function incomingThreat(self, horizon = 0.65) {
  try {
    const selfVelocity = bodyVelocity(self);
    const threatRadius = Math.max(90, (Number(self?.radius) || 40) + 55);
    for (const p of window.projectiles || []) {
      if (!p || p.owner === self || !(Number(p.life) > 0)) continue;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)
        || !Number.isFinite(p.vx) || !Number.isFinite(p.vy)) continue;
      const relative = { x: Number(p.vx) - selfVelocity.x, y: Number(p.vy) - selfVelocity.y };
      if ((relative.x * relative.x) + (relative.y * relative.y) <= 1) continue;
      const hit = closestApproach(
        { x: Number(p.x), y: Number(p.y) },
        relative,
        { x: self.x, y: self.y },
        horizon,
      );
      if (hit.distance <= threatRadius) return true;
    }
  } catch { /* fall through to geometry-only fallback */ }
  return false;
}

function revealedWeaponSlots() {
  const slots = battleState()?.slots;
  return Array.isArray(slots)
    ? slots.filter((slot) => slot && slot.phase === 'REVEALED' && slot.kind !== 'HEAL' && !!slot.weaponId)
    : [];
}

// The softlock guard is intentionally late and still tactical: it requires
// a live threat, a contested pickup while unarmed, or a genuinely closing
// opponent. Cooldown-zero alone can never open the pause.
function observableFallbackOpportunity(index, waitedMs) {
  if (waitedMs < 22000) return false;
  const [self, foe] = liveFighters();
  if (!self || !foe || !(self.hp > 0) || !(foe.hp > 0)) return false;
  if (incomingThreat(self)) return true;
  const selfArmed = !!self.data?.arsenal?.weaponId;
  if (index === 0 && !selfArmed && revealedWeaponSlots().length) return true;
  const dx = foe.x - self.x;
  const dy = foe.y - self.y;
  const distance = Math.hypot(dx, dy);
  if (distance > 560 || distance < 1) return false;
  const foeVelocity = bodyVelocity(foe);
  const selfVelocity = bodyVelocity(self);
  const closingSpeed = -(((foeVelocity.x - selfVelocity.x) * dx)
    + ((foeVelocity.y - selfVelocity.y) * dy)) / distance;
  return closingSpeed > 30;
}

function tacticalOpportunity(index, waitedMs) {
  const state = battleState();
  if (!state || state.over || (Number(state.time) || 0) < 1.6) return false;
  const [self, foe] = liveFighters();
  if (!self || !foe || !(self.hp > 0) || !(foe.hp > 0)) return false;

  try {
    const decision = window.APEX_HERO_REWORK?.observeAbilityOpportunity?.(
      self,
      index === 1 ? 'A2' : 'A1',
    );
    if (decision?.shouldCast && Number(decision.score) >= 0.6
      && decision.reason !== 'ready-default') return true;
  } catch { /* use the late observable fallback below */ }

  return observableFallbackOpportunity(index, waitedMs);
}

function readSideIntroSeen() {
  try {
    const raw = JSON.parse(localStorage.getItem(SIDE_INTRO_KEY) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch { return {}; }
}

function writeSideIntroSeen(value) {
  try { localStorage.setItem(SIDE_INTRO_KEY, JSON.stringify(value)); } catch { /* session-only */ }
}

function setSideIntroLabels(labels) {
  try {
    const rows = [
      document.querySelector('#p1Side .id-row'),
      document.querySelector('#p2Side .id-row'),
    ];
    let applied = true;
    rows.forEach((row, index) => {
      if (!row) { applied = false; return; }
      if (labels) row.dataset.introRole = labels[index];
      else delete row.dataset.introRole;
    });
    document.querySelector('#hud')?.classList.toggle('apex-side-intro-on', !!labels);
    return applied;
  } catch { return false; }
}

function isVisibleAnchor(element) {
  if (!element?.isConnected) return false;
  try {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle?.(element);
    return rect.width > 2 && rect.height > 2
      && style?.display !== 'none' && style?.visibility !== 'hidden'
      && Number(style?.opacity ?? 1) > 0;
  } catch { return false; }
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
  if (step === 3 || step === 4) {
    const element = skillInfo(step - 3).element;
    return isVisibleAnchor(element) ? element : null;
  }
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
  const [pausedSlot, setPausedSlot] = useState(null);
  const [language, setLanguage] = useState(currentLanguage);
  const [coarse] = useState(() => {
    try { return !!window.matchMedia?.('(pointer: coarse)').matches; } catch { return false; }
  });

  const coachRef = useRef(coach);
  const activeRef = useRef(active);
  const frameKeyRef = useRef('');
  const skillSnapshotsRef = useRef([null, null]);
  const pauseRef = useRef(null);
  const stepSinceRef = useRef({ step: -1, at: 0 });
  const pauseCooldownUntilRef = useRef(0);
  const sideIntroRef = useRef({ scene: '', mode: null, activeUntil: 0, applied: false, lastTime: 0 });
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

  const releaseTutorialPause = useCallback(() => {
    if (!pauseRef.current && !window.APEX_TUTORIAL_PAUSE?.active) return;
    pauseRef.current = null;
    setPausedSlot(null);
    clearTutorialPause();
  }, []);

  const engageTutorialPause = useCallback((slot) => {
    if (pauseRef.current?.slot === slot) {
      publishTutorialPause(slot);
      return;
    }
    pauseRef.current = { slot, since: Date.now() };
    publishTutorialPause(slot);
    setPausedSlot(slot);
    playCoachSfx('tutorial.pause');
  }, []);

  const acceptTutorialInput = useCallback((slot, source, key) => {
    // The event being handled is the player's real J/K or touch input.
    // Release the freeze first, then forward that one input through the
    // canonical ability executor exactly once on the next frame.
    releaseTutorialPause();
    pauseCooldownUntilRef.current = Date.now() + 4000;
    playCoachSfx('tutorial.resume');
    window.requestAnimationFrame(() => {
      try {
        if (source === 'pointer' && typeof window.APEX_GOLD_HUD?.pressSkill === 'function') {
          window.APEX_GOLD_HUD.pressSkill(0, slot, { source: 'pointer' });
          return;
        }
        if (source === 'pointer' && typeof window.APEX_GOLD?.pressSkill === 'function') {
          window.APEX_GOLD.pressSkill(0, slot, { source: 'pointer' });
          return;
        }
        const fighter = liveFighters()[0];
        window.APEX_HERO_REWORK?.pressAbility?.(
          fighter,
          slot === 1 ? 'A2' : 'A1',
          { side: 'p1', source: source === 'pointer' ? 'pointer' : 'keyboard', key: key || (slot === 1 ? 'KeyK' : 'KeyJ') },
        );
      } catch { /* a failed cast leaves the match running and re-teachable */ }
    });
  }, [releaseTutorialPause]);

  const updateCoach = useCallback((patch) => {
    const current = coachRef.current;
    if (!current) return null;
    const next = { ...current, ...patch };
    if (JSON.stringify(next) === JSON.stringify(current)) return current;
    if (Object.prototype.hasOwnProperty.call(patch, 'step') && patch.step !== current.step) {
      clearFrame();
      stepSinceRef.current = { step: patch.step, at: Date.now() };
      const expectedSlot = patch.step === 3 ? 0 : patch.step === 4 ? 1 : null;
      if (pauseRef.current && pauseRef.current.slot !== expectedSlot) releaseTutorialPause();
    }
    return persistCoach(next);
  }, [clearFrame, persistCoach, releaseTutorialPause]);

  const setActiveBoth = useCallback((next) => {
    activeRef.current = next;
    setActive(next);
    if (!next) {
      releaseTutorialPause();
      clearFrame();
    }
  }, [clearFrame, releaseTutorialPause]);

  const finishCoach = useCallback((skipped = false) => {
    releaseTutorialPause();
    const current = coachRef.current || freshCoach(sealedCounts());
    persistCoach({ ...current, done: true, skipped: skipped || current.skipped });
    activeRef.current = false;
    setActive(false);
    clearFrame();
  }, [clearFrame, persistCoach, releaseTutorialPause]);

  const skipCoach = useCallback(() => finishCoach(true), [finishCoach]);

  const replayCoach = useCallback(() => {
    releaseTutorialPause();
    setLanguage(currentLanguage());
    persistCoach(freshCoach(sealedCounts()));
    skillSnapshotsRef.current = [null, null];
    stepSinceRef.current = { step: 0, at: Date.now() };
    pauseCooldownUntilRef.current = Date.now() + 1500;
    writeSideIntroSeen({ ...readSideIntroSeen(), bot: 0, local: 0 });
    activeRef.current = true;
    setActive(true);
    clearFrame();
  }, [clearFrame, persistCoach, releaseTutorialPause]);

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
      releaseTutorialPause();
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
      releaseTutorialPause();
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
      releaseTutorialPause();
      skillSnapshotsRef.current = [null, null];
    }

    if (step !== current.step || baselineBotMatches !== current.baselineBotMatches
      || baselineSealedMatches !== current.baselineSealedMatches) {
      updateCoach({ step, baselineBotMatches, baselineSealedMatches });
    }

    if ((step === 3 || step === 4) && (scene !== 'battle' || !isBotBattle())) {
      releaseTutorialPause();
    } else if ((step === 3 || step === 4) && scene === 'battle' && isBotBattle()) {
      const slot = step - 3;
      const info = skillInfo(slot);
      const now = Date.now();
      if (stepSinceRef.current.step !== step) stepSinceRef.current = { step, at: now };
      const waitedMs = Math.max(0, now - stepSinceRef.current.at);
      const [self, foe] = liveFighters();
      const battleEnded = !!battleState()?.over || !(self?.hp > 0) || !(foe?.hp > 0);

      if (pauseRef.current) {
        if (pauseRef.current.slot !== slot || !info.ready || battleEnded) {
          releaseTutorialPause();
          pauseCooldownUntilRef.current = now + 4000;
        } else if (now - pauseRef.current.since > 30000) {
          // Recovery guard: a forgotten lesson resumes the fight and can
          // be offered again later instead of trapping the match forever.
          releaseTutorialPause();
          pauseCooldownUntilRef.current = now + 30000;
        } else {
          publishTutorialPause(slot);
        }
      } else if (!battleEnded && info.ready && now >= pauseCooldownUntilRef.current
        && tacticalOpportunity(slot, waitedMs)) {
        engageTutorialPause(slot);
      }
    }

    if (!stepSceneMatches(step, scene)) {
      setFrameIfChanged(null);
      return;
    }

    // CP4 replaces the old persistent ready prompt: battle skill steps are
    // visible only while the real pause lease is held for that exact slot.
    if ((step === 3 || step === 4) && pauseRef.current?.slot !== step - 3) {
      setFrameIfChanged(null);
      return;
    }

    setFrameIfChanged(computeFrame(step, findAnchor(step)));
  }, [clearFrame, engageTutorialPause, finishCoach, releaseTutorialPause, setFrameIfChanged, updateCoach]);

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

  // CP4 first-fight side introduction: a one-time role word inside each
  // existing HUD identity row (BOT: YOU/OPPONENT, LOCAL: PLAYER 1/2).
  // No arena marker, ring, arrow or extra surface is created.
  useEffect(() => {
    const poll = () => {
      const intro = sideIntroRef.current;
      const scene = currentScene();
      const state = battleState();
      const mode = state?.battleMode === 'BOT'
        ? 'bot'
        : state?.battleMode === 'LOCAL' ? 'local' : null;
      const battleTime = Number(state?.time) || 0;
      const now = Date.now();

      const enteredBattle = intro.scene !== 'battle' && scene === 'battle';
      const restarted = scene === 'battle' && battleTime + 0.5 < intro.lastTime;
      if (enteredBattle || restarted || intro.mode !== mode) {
        intro.mode = mode;
        intro.activeUntil = 0;
        intro.applied = false;
        setSideIntroLabels(null);
      }
      intro.scene = scene;
      intro.lastTime = battleTime;

      if (scene !== 'battle' || !state || state.over || !mode) {
        if (intro.activeUntil) {
          intro.activeUntil = 0;
          intro.applied = false;
          setSideIntroLabels(null);
        }
        return;
      }

      const copy = COPY[currentLanguage() === 'vie' ? 'vie' : 'eng'];
      const labels = mode === 'bot'
        ? [copy.sideYou, copy.sideBot]
        : [copy.sideP1, copy.sideP2];

      if (intro.activeUntil) {
        if (now < intro.activeUntil) {
          if (setSideIntroLabels(labels) && !intro.applied) {
            intro.applied = true;
            writeSideIntroSeen({ ...readSideIntroSeen(), [mode]: now });
          }
        } else {
          intro.activeUntil = 0;
          intro.applied = false;
          setSideIntroLabels(null);
        }
        return;
      }

      if (!readSideIntroSeen()[mode] && battleTime <= 6) {
        intro.activeUntil = now + 4500;
        if (setSideIntroLabels(labels)) {
          intro.applied = true;
          writeSideIntroSeen({ ...readSideIntroSeen(), [mode]: now });
        }
      }
    };

    poll();
    const interval = window.setInterval(poll, 200);
    return () => {
      window.clearInterval(interval);
      setSideIntroLabels(null);
    };
  }, []);

  // While a lesson is paused, only the taught slot can resume it. The
  // canonical executor is closed during the lease, so accepting the real
  // input here cannot double-cast: release first, forward once next frame.
  useEffect(() => {
    if (pausedSlot == null) return undefined;
    const slot = pausedSlot;
    const expectedCode = slot === 1 ? 'KeyK' : 'KeyJ';
    const expectedKey = slot === 1 ? 'k' : 'j';

    const heartbeat = window.setInterval(() => {
      if (pauseRef.current?.slot === slot) publishTutorialPause(slot);
    }, 500);

    const onKeyDown = (event) => {
      if (event.repeat) return;
      const key = String(event.key || '').toLowerCase();
      if (event.code !== expectedCode && key !== expectedKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      acceptTutorialInput(slot, 'keyboard', event.code || expectedCode);
    };

    // Gold's real pointer contract casts on release. Mirror it exactly:
    // hold the taught P1 skill card on pointerdown, accept on pointerup,
    // and swallow both events so Gold cannot cast a second time.
    let pendingPointer = null;
    const taughtSkillCard = (event) => {
      const card = event.target?.closest?.('#p1Side .skill, .skill[data-p="1"]');
      return card && Number(card.dataset.i) === slot ? card : null;
    };

    const clearPendingPointer = () => {
      if (!pendingPointer) return;
      pendingPointer.card.classList.remove('is-held');
      try {
        if (pendingPointer.card.hasPointerCapture?.(pendingPointer.id)) {
          pendingPointer.card.releasePointerCapture(pendingPointer.id);
        }
      } catch { /* pointer already released */ }
      pendingPointer = null;
    };

    const onPointerDown = (event) => {
      const card = taughtSkillCard(event);
      if (!card || pendingPointer) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      pendingPointer = { id: event.pointerId, card };
      card.classList.add('is-held');
      try { card.setPointerCapture?.(event.pointerId); } catch { /* capture is optional */ }
    };

    const onPointerUp = (event) => {
      if (!pendingPointer || event.pointerId !== pendingPointer.id) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      clearPendingPointer();
      acceptTutorialInput(slot, 'pointer', expectedCode);
    };

    const onPointerCancel = (event) => {
      if (!pendingPointer || event.pointerId !== pendingPointer.id) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      clearPendingPointer();
    };

    const releaseForRecovery = () => releaseTutorialPause();
    const onVisibility = () => { if (document.hidden) releaseForRecovery(); };

    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerCancel, true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', releaseForRecovery);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerCancel, true);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', releaseForRecovery);
      clearPendingPointer();
      releaseTutorialPause();
    };
  }, [acceptTutorialInput, pausedSlot, releaseTutorialPause]);

  // CP5 spotlight (presentation only): while a lesson is paused, dim the
  // arena canvas and the skill card that is NOT being taught, so the one
  // real control to use is unmistakable. The pause lease, opportunity
  // logic and input contract are untouched.
  useEffect(() => {
    if (pausedSlot == null) return undefined;
    const touched = [];
    const mark = (element, className) => {
      if (!element?.classList) return;
      element.classList.add(className);
      touched.push([element, className]);
    };
    try {
      document.body.classList.add('apex-tutorial-paused');
      mark(skillInfo(pausedSlot).element, 'apex-coach-taught');
      mark(skillInfo(1 - pausedSlot).element, 'apex-coach-dimmed');
      document.querySelectorAll('canvas').forEach((canvas) => {
        if (canvas.width > 200 && !canvas.closest('.apex-coach-layer')) mark(canvas, 'apex-coach-dimmed');
      });
    } catch { /* spotlight is decoration; the lesson itself never depends on it */ }
    return () => {
      document.body.classList.remove('apex-tutorial-paused');
      touched.forEach(([element, className]) => { try { element.classList.remove(className); } catch { /* detached */ } });
    };
  }, [pausedSlot]);

  useEffect(() => () => {
    releaseTutorialPause();
    setSideIntroLabels(null);
  }, [releaseTutorialPause]);

  if (!active || !coach || coach.done || !frame) return null;

  const lang = language === 'vie' ? 'vie' : 'eng';
  const copy = COPY[lang];
  const item = copy.steps[coach.step] || copy.steps[0];
  const body = item.body || (coarse ? item.touch : item.keyboard);
  const isPausedLesson = (coach.step === 3 || coach.step === 4)
    && pausedSlot === coach.step - 3;
  const skillName = isPausedLesson ? taughtSkillName(coach.step - 3) : '';
  const displayBody = skillName ? `${body} · ${skillName}` : body;

  return (
    <div
      className={`apex-guide-dock apex-coach-layer${isPausedLesson ? ' is-tutorial-paused' : ''}`}
      data-tutorial-paused={isPausedLesson ? 'true' : 'false'}
      aria-live="polite"
    >
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
      {isPausedLesson && (
        <div className="apex-guide-paused-note apex-guide-arena-pill" style={arenaPillStyle()} aria-hidden="true">
          <i className="apex-pause-bars"><b /><b /></i>
          <span>{copy.pausedNote}</span>
        </div>
      )}
      <section
        className="apex-guide-card apex-coach-chip"
        role="status"
        aria-label={`${copy.kicker}: ${item.title}. ${displayBody}${isPausedLesson ? ` ${copy.pausedNote}` : ''}`}
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
          <p className="apex-guide-kicker">{(isPausedLesson ? copy.actionKicker : copy.kicker)} · {coach.step + 1}/{LAST_STEP + 1}</p>
          <div className="apex-guide-steps" aria-hidden="true">
            {Array.from({ length: LAST_STEP + 1 }, (_, index) => (
              <i key={index} className={index <= coach.step ? 'is-done' : ''} />
            ))}
          </div>
          <h2>{item.title}</h2>
          <p className="apex-guide-body">{displayBody}</p>
        </div>
        <button type="button" className="apex-coach-skip" onClick={skipCoach}>{copy.skip}</button>
      </section>
    </div>
  );
}
