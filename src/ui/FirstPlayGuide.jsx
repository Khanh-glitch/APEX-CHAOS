import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './firstPlayGuide.css';

// APEX CHAOS — Learn by Playing Coach (Tactical Pulse Non-Blocking Edition).
// Non-negotiable product laws:
//   1. Non-blocking: match clock, AI, projectiles, weapon spawns, and cooldowns
//      NEVER pause. No input is intercepted, swallowed, or dimmed.
//   2. Executor-truth gating: prompts appear ONLY for an untaught skill that
//      observeAbilityCastability confirms castable RIGHT NOW. When NEWBOT J has
//      no floor gun yet, Coach teaches castable K first without locking J or K.
//   3. Proven cast advancement: steps 3 & 4 advance strictly when the real
//      combat engine emits a confirmed P1 Cast / telemetry increment.
//   4. Zero arena & control occlusion: battle chip docks strictly in measured
//      open HUD slots with >= 44x44px SKIP hit target across all viewports.

const COACH_KEY = 'apex.alpha.coach.v2';
const LEGACY_KEY = 'apex.alpha.guide.v1';
// Tutorial preference (Issue #105). Absent = not asked yet; battles stay CLEAN.
const PREF_KEY = 'apex.alpha.tutorial.v1';
const SIDE_INTRO_KEY = 'apex.alpha.sideIntro.v2';
const LAST_STEP = 5;

const COPY = {
  eng: {
    kicker: 'LEARN BY PLAYING',
    actionKicker: 'TACTICAL PULSE',
    skip: 'SKIP',
    sideYou: 'YOU · ORANGE EDGE',
    identity: 'YOU · AUTO FIGHT',
    sideBot: 'BOT · BLUE EDGE',
    sideP1: 'P1 · ORANGE EDGE',
    sideP2: 'P2 · BLUE EDGE',
    pickupPrompt: 'AUTO PICKUP · Your fighter collects a ground gun on contact.',
    steps: [
      { title: 'START HERE', body: 'Press FREE BATTLE.' },
      { title: 'FIRST FIGHT', body: 'Choose VS BOT.' },
      { title: 'READY?', body: 'Pick your fighter, then LOCK IN.' },
      {
        title: 'CAST SKILL 1',
        keyboard: 'Press J now — target live.',
        touch: 'Tap Skill 1 now — target live.',
      },
      {
        title: 'CAST SKILL 2',
        keyboard: 'Press K now to activate Skill 2.',
        touch: 'Tap Skill 2 now to activate.',
      },
      { title: 'REWARDS WAITING', body: 'Open MISSIONS to claim starter rewards and view Mastery.' },
    ],
  },
  vie: {
    kicker: 'HỌC BẰNG CÁCH CHƠI',
    actionKicker: 'NHỊP CHIẾN THUẬT',
    skip: 'BỎ QUA',
    sideYou: 'BẠN · VIỀN CAM',
    identity: 'BẠN · TỰ ĐÁNH',
    sideBot: 'BOT · VIỀN XANH',
    sideP1: 'P1 · VIỀN CAM',
    sideP2: 'P2 · VIỀN XANH',
    pickupPrompt: 'TỰ NHẶT SÚNG · Robot tự nhặt súng khi chạm súng trên sân.',
    steps: [
      { title: 'BẮT ĐẦU TẠI ĐÂY', body: 'Nhấn ĐẤU TỰ DO.' },
      { title: 'TRẬN ĐẦU TIÊN', body: 'Chọn ĐẤU BOT.' },
      { title: 'SẴN SÀNG CHƯA?', body: 'Chọn tướng rồi nhấn LOCK IN.' },
      {
        title: 'DÙNG CHIÊU 1',
        keyboard: 'Nhấn J ngay — đã có mục tiêu.',
        touch: 'Chạm thẻ Kỹ năng 1 ngay — đã có mục tiêu.',
      },
      {
        title: 'DÙNG CHIÊU 2',
        keyboard: 'Nhấn K ngay để bật Chiêu 2.',
        touch: 'Chạm thẻ Kỹ năng 2 ngay để kích hoạt.',
      },
      { title: 'PHẦN THƯỞNG ĐANG CHỜ', body: 'Mở NHIỆM VỤ để nhận thưởng khởi đầu và xem Tinh thông.' },
    ],
  },
};

function currentLanguage() {
  try { return window.APEX_I18N?.getLanguage?.() === 'vie' ? 'vie' : 'eng'; }
  catch { return 'eng'; }
}

function publishNonBlockingTutorialState() {
  try {
    window.APEX_TUTORIAL_PAUSE = { active: false, slot: null, since: 0 };
  } catch { /* read-only global guard */ }
}

function playCoachSfx(key) {
  try { window.apexUiSfx?.play?.(key); } catch { /* audio is optional */ }
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

function readPref() {
  try {
    const value = localStorage.getItem(PREF_KEY);
    return value === 'on' || value === 'off' ? value : null;
  } catch { return null; }
}

function writePref(value) {
  try { localStorage.setItem(PREF_KEY, value); } catch { /* session-only */ }
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

function battleState() {
  try { return window.APEX_ARSENAL?.state || null; } catch { return null; }
}

function liveFighters() {
  try { return Array.isArray(window.fighters) ? window.fighters : []; }
  catch { return []; }
}

function battleVisible() {
  try {
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

function taughtSkillName(index) {
  try {
    const projected = projectedSkill(index);
    const fromProjection = projected?.name || projected?.label || projected?.title;
    if (typeof fromProjection === 'string' && fromProjection.trim().length >= 2) {
      return fromProjection.trim().slice(0, 28).toUpperCase();
    }
    const element = skillAnchor(index);
    const named = element?.querySelector?.('.sk-name, [data-name], .skillName, .skill-name, strong, h3, h4, b');
    const text = String(named?.textContent || '').trim();
    if (text.length >= 2 && text.length <= 28 && /[A-Za-zÀ-ỹ]/.test(text)) return text.toUpperCase();
  } catch { /* presentation only */ }
  return '';
}

function skillInfo(index) {
  const element = skillAnchor(index);
  const projected = projectedSkill(index);
  const fighter = liveFighters()[0] || null;
  const slot = index === 0 ? 'A1' : 'A2';
  let engineCastable = null;
  try {
    if (fighter && typeof window.APEX_HERO_REWORK?.observeAbilityCastability === 'function') {
      const verdict = window.APEX_HERO_REWORK.observeAbilityCastability(fighter, slot);
      if (verdict && verdict.known) engineCastable = verdict.castable === true;
    }
  } catch { engineCastable = null; }
  const state = element?.dataset?.state || '';
  const tpState = element?.dataset?.tpState || '';
  let charges = Number(projected?.charges);
  if (!Number.isFinite(charges)) charges = state === 'ready' ? 1 : 0;
  const nextIn = Number(projected?.nextIn) || 0;
  const castable = engineCastable !== null
    ? engineCastable
    : (projected?.truth === true && projected?.castable === true && charges > 0);
  const ready = castable
    && projected?.locked !== true
    && state !== 'locked'
    && tpState !== 'standby';
  return { element, projected, state, charges, nextIn, ready };
}

function readP1SkillCastCounts() {
  try {
    const p1 = liveFighters()[0];
    const bySkill = p1?.__hrCombatant?.telemetry?.bySkill;
    if (!bySkill) return null;
    const c0 = typeof bySkill.A1 === 'number' ? bySkill.A1 : (Number(bySkill.A1?.casts) || 0);
    const c1 = typeof bySkill.A2 === 'number' ? bySkill.A2 : (Number(bySkill.A2?.casts) || 0);
    return [c0, c1];
  } catch { return null; }
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
      if (labels) {
        row.dataset.introRole = labels[index];
        row.dataset.introEdge = index === 0 ? 'orange' : 'blue';
      } else {
        delete row.dataset.introRole;
        delete row.dataset.introEdge;
      }
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

function rectOf(selector) {
  try {
    const el = document.querySelector(selector);
    if (!isVisibleAnchor(el)) return null;
    return el.getBoundingClientRect();
  } catch { return null; }
}

function intersectionArea(a, b) {
  if (!a || !b) return 0;
  const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return w * h;
}

function computePickupPromptFrame() {
  const state = battleState();
  if (!state?.active || state?.over || !isBotBattle()) return null;
  if (document.querySelector('#apex-real-match-result')) return null;
  const self = liveFighters()[0];
  const unarmed = !!self?.data && !self.data.arsenal?.weaponId;
  if (!unarmed) return null;
  const isGun = window.APEX_ARSENAL_CONFIG?.isGun;
  const gunAvailable = typeof isGun === 'function'
    && Array.isArray(state?.slots)
    && state.slots.some((slot) => slot?.phase === 'REVEALED' && isGun(slot.weaponId) === true);
  if (!gunAvailable) return null;
  const row = rectOf('#p1Side .weapon');
  const vw = window.innerWidth || document.documentElement.clientWidth || 0;
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  if (!row || row.width < 112 || row.height < 28 || row.left < 0 || row.top < 0 || row.right > vw || row.bottom > vh) {
    return null;
  }
  const overlappingNotification = [...document.querySelectorAll('.apex-achievement-toast, .apex-reward-toast, .apex-skin-unlock-dock')]
    .some((el) => {
      try {
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity || 1) <= 0) return false;
        return intersectionArea(el.getBoundingClientRect(), row) > 0;
      } catch { return false; }
    });
  if (overlappingNotification) return null;
  const compact = row.width < 220 || row.height < 58;
  return {
    left: Math.round(row.left + 1),
    top: Math.round(row.top + 1),
    width: Math.max(108, Math.floor(row.width - 2)),
    height: Math.max(26, Math.floor(row.height - 2)),
    compact,
  };
}

// Compute a strictly non-occluding dock slot during live combat across
// 1440x900, 844x390, 900x900 (P90), and 390x844 without covering fighters,
// arena canvas, HP bars, timer, identity plates, or skill buttons.
function computeBattleFrame(anchor, measuredChipHeight, prevId = null) {
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth || document.documentElement.clientWidth || rect.right;
  const vh = window.innerHeight || document.documentElement.clientHeight || rect.bottom;
  const chipH = Math.max(60, Math.min(114, Number(measuredChipHeight) || 78));

  const p1Side = rectOf('#p1Side');
  const p1Ident = rectOf('#p1Side .ident');
  const p1Skills = rectOf('#p1Side .skills');
  const p1Weapon = rectOf('#p1Side .weapon');
  const p2Side = rectOf('#p2Side');
  const p2Skills = rectOf('#p2Side .skills');
  const p2Weapon = rectOf('#p2Side .weapon');
  const arena = rectOf('#arena') || rectOf('#arenaCanvas');

  const blockers = [
    arena,
    rectOf('#versusRail'),
    rectOf('#p1Rail'),
    rectOf('#p2Rail'),
    rectOf('#matchCenter'),
    p1Ident,
    p1Skills,
    p1Weapon,
    rectOf('#p2Side .ident'),
    p2Skills,
    p2Weapon,
  ].filter(Boolean);

  const candidates = [];

  // Candidate 1: Open space inside #p1Side below .skills and above .weapon (Desktop 1440x900, P90 900x900)
  if (p1Side && p1Skills && p1Weapon && p1Weapon.top - p1Skills.bottom >= chipH + 6) {
    const w = Math.min(300, Math.max(176, Math.floor(p1Side.width - 8)));
    candidates.push({
      id: 'p1-skills-weapon',
      left: Math.round(p1Side.left + 4),
      top: Math.round(p1Skills.bottom + 5),
      width: w,
      compact: w < 210,
      narrow: w < 180,
    });
  }

  // Candidate 2: Open space inside #p1Side between .ident and .skills (390x844 portrait + tall side layouts)
  if (p1Side && p1Ident && p1Skills && p1Skills.top - p1Ident.bottom >= chipH + 6) {
    const w = Math.min(340, Math.max(180, Math.floor(p1Side.width - 8)));
    candidates.push({
      id: 'p1-ident-skills',
      left: Math.round(p1Side.left + 4),
      top: Math.round(p1Ident.bottom + 5),
      width: w,
      compact: true,
      narrow: w < 180,
    });
  }

  // Candidate 3: Open spacer cell inside #p2Side on 844x390 landscape solo ("." row between #p2Side .skills and .weapon)
  if (p2Side && p2Skills && p2Weapon && p2Weapon.top - p2Skills.bottom >= 86) {
    const w = Math.min(260, Math.max(146, Math.floor(p2Side.width - 4)));
    const narrowH = Math.min(chipH, Math.max(84, p2Weapon.top - p2Skills.bottom - 8));
    candidates.push({
      id: 'p2-spacer',
      left: Math.max(8, Math.min(vw - w - 6, Math.round(p2Side.left + 2))),
      top: Math.round(p2Skills.bottom + Math.max(3, Math.floor((p2Weapon.top - p2Skills.bottom - narrowH) / 2))),
      width: w,
      heightOverride: narrowH,
      compact: true,
      narrow: w < 185,
    });
  }

  // Candidate 4: Open space below .skills inside #p1Side
  if (p1Side && p1Skills && p1Side.bottom - p1Skills.bottom >= chipH + 4) {
    const w = Math.min(340, Math.max(190, Math.floor(p1Side.width - 8)));
    candidates.push({
      id: 'p1-below-skills',
      left: Math.round(p1Side.left + 4),
      top: Math.round(p1Skills.bottom + 4),
      width: w,
      compact: true,
      narrow: w < 185,
    });
  }

  // Candidate choice is sticky (hysteresis): the previously chosen candidate is
  // kept while it still fits with zero overlap. The HUD animates its rects for
  // several hundred ms after a battle starts; re-ranking on every sample made the
  // chip hop between candidates. A new candidate wins only when the previous one
  // stops fitting, so the chip cannot oscillate frame to frame.
  let best = null;
  let bestPenalty = Infinity;
  let prevPenalty = null;
  for (const cand of candidates) {
    const h = cand.heightOverride || chipH;
    const box = {
      left: cand.left,
      top: cand.top,
      right: cand.left + cand.width,
      bottom: cand.top + h,
    };
    if (box.left < 4 || box.top < 4 || box.right > vw - 4 || box.bottom > vh - 4) continue;
    let hudPenalty = 0;
    let arenaPenalty = 0;
    for (const blk of blockers) {
      const area = intersectionArea(box, blk);
      if (area <= 0) continue;
      if (blk === arena) arenaPenalty += area;
      else hudPenalty += area * 10;
    }
    const totalPenalty = hudPenalty + arenaPenalty;
    if (prevId && cand.id === prevId) prevPenalty = totalPenalty;
    if (totalPenalty < bestPenalty) {
      bestPenalty = totalPenalty;
      best = cand;
    }
  }
  if (prevId && prevPenalty === 0) {
    best = candidates.find((cand) => cand.id === prevId) || best;
  }

  // Fallback is anchored to the stable P1 column, never to the per-frame skill
  // anchor (which alternates between skill slots and made the chip jump 54px).
  const fallbackWidth = Math.min(250, vw - 16);
  const columnRect = p1Side || rect;
  const chosen = best || {
    id: 'fallback',
    left: Math.max(8, Math.min(vw - fallbackWidth - 8, Math.round(columnRect.left))),
    top: Math.max(8, Math.round(columnRect.top - chipH - 8)),
    width: fallbackWidth,
    compact: true,
    narrow: false,
  };

  return {
    beaconLeft: Math.round(rect.left - 3),
    beaconTop: Math.round(rect.top - 3),
    beaconWidth: Math.round(rect.width + 6),
    beaconHeight: Math.round(rect.height + 6),
    chipLeft: chosen.left,
    chipTop: chosen.top,
    chipWidth: chosen.width,
    chipTransform: 'none',
    placement: 'docked',
    candidate: chosen.id || 'fallback',
    compact: !!chosen.compact,
    narrow: !!chosen.narrow,
  };
}

function findMenuAnchor(step) {
  const stage = stageElement();
  if (step === 0) return document.querySelector('#freeBattle');
  if (step === 1) {
    return stage?.querySelector('.modeCard[data-mode="bot"]')
      || document.querySelector('.modeCard[data-mode="bot"]')
      || findByText(stage || document, 'button, [role="button"]', ['VS BOT', 'BOT BATTLE', 'ĐẤU BOT']);
  }
  if (step === 2) return document.querySelector('#lockIn') || stage?.querySelector('.lockIn');
  if (step === 5) return document.querySelector('#apexMissionsOpen');
  return null;
}

function computeMenuFrame(step, anchor, chipHeight = 82) {
  if (!anchor?.isConnected) return null;
  const rect = anchor.getBoundingClientRect();
  if (!Number.isFinite(rect.width) || rect.width < 2 || rect.height < 2) return null;
  const style = window.getComputedStyle?.(anchor);
  if (style?.display === 'none' || style?.visibility === 'hidden' || Number(style?.opacity) === 0) return null;
  if (!anchorReceivesHit(anchor, rect)) return null;

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || rect.right;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || rect.bottom;
  const cardWidth = Math.min(320, Math.max(220, viewportWidth - 24));
  const h = Math.max(68, Math.min(130, chipHeight || 82));
  const gap = 10;
  const clampLeft = (value) => Math.max(12, Math.min(Math.max(12, viewportWidth - cardWidth - 12), value));

  let placement = 'above';
  const chipLeft = clampLeft(rect.left + (rect.width / 2) - (cardWidth / 2));
  let chipTop = Math.max(12, rect.top - gap - h);
  const chipTransform = 'none';

  if (rect.top < h + gap + 12) {
    placement = 'below';
    chipTop = Math.min(Math.max(12, viewportHeight - h - 12), rect.bottom + gap);
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
    compact: false,
    narrow: false,
  };
}

function stepSceneMatches(step, scene) {
  if (step === 0 || step === 5) return scene === 'home';
  if (step === 1) return scene === 'mode';
  if (step === 2) return scene === 'fighter'
    && !stageElement()?.classList?.contains('fighter-active-p2');
  if (step === 3 || step === 4) return scene === 'battle' && isBotBattle();
  return false;
}

function FirstPlayGuideCoach() {
  const [coach, setCoach] = useState(readCoach);
  const [active, setActive] = useState(() => {
    const stored = readCoach();
    return !!stored && !stored.done && readPref() !== 'off';
  });
  const [frame, setFrame] = useState(null);
  const [pickupFrame, setPickupFrame] = useState(null);
  const [hintSlot, setHintSlot] = useState(null);
  const [language, setLanguage] = useState(currentLanguage);
  const [coarse, setCoarse] = useState(() => {
    try { return !!window.matchMedia?.('(pointer: coarse)').matches; } catch { return false; }
  });

  const coachRef = useRef(coach);
  const activeRef = useRef(active);
  const frameKeyRef = useRef('');
  const pickupKeyRef = useRef('');
  const chipRef = useRef(null);
  const battleSessionRef = useRef({ active: false, casted: [false, false], baseCasts: [0, 0] });
  const sideIntroRef = useRef({ scene: '', mode: null, activeUntil: 0, applied: false, lastTime: 0 });
  const bootstrappedRef = useRef(false);
  const lastSlotRef = useRef(null);
  const lastCandidateRef = useRef(null);

  // Enforce non-blocking tutorial state unconditionally across lifecycle events.
  useEffect(() => {
    publishNonBlockingTutorialState();
    const keepUnpaused = () => publishNonBlockingTutorialState();
    window.addEventListener('pagehide', keepUnpaused);
    window.addEventListener('pageshow', keepUnpaused);
    document.addEventListener('visibilitychange', keepUnpaused);
    return () => {
      window.removeEventListener('pagehide', keepUnpaused);
      window.removeEventListener('pageshow', keepUnpaused);
      document.removeEventListener('visibilitychange', keepUnpaused);
      publishNonBlockingTutorialState();
    };
  }, []);

  useEffect(() => {
    const onPointer = (event) => {
      const type = String(event?.pointerType || '');
      if (type === 'touch' || type === 'pen') setCoarse(true);
      else if (type === 'mouse') setCoarse(false);
    };
    const onTouchStart = () => setCoarse(true);
    const onKey = (event) => {
      if (event?.key === 'Escape') return;
      setCoarse(false);
    };
    let query = null;
    const onMedia = (event) => setCoarse(!!event.matches);
    try {
      query = window.matchMedia?.('(pointer: coarse)') || null;
      if (query?.matches) setCoarse(true);
      query?.addEventListener?.('change', onMedia);
    } catch { query = null; }
    window.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('touchstart', onTouchStart, { capture: true });
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey, true);
      try { query?.removeEventListener?.('change', onMedia); } catch { /* older engines */ }
    };
  }, []);

  const persistCoach = useCallback((next) => {
    coachRef.current = next;
    setCoach(next);
    try { localStorage.setItem(COACH_KEY, JSON.stringify(next)); } catch { /* session-only */ }
    return next;
  }, []);

  const setPickupIfChanged = useCallback((nextPickup) => {
    const key = nextPickup ? JSON.stringify(nextPickup) : '';
    if (pickupKeyRef.current === key) return;
    pickupKeyRef.current = key;
    setPickupFrame(nextPickup);
  }, []);

  const clearFrame = useCallback(() => {
    if (frameKeyRef.current !== '') {
      frameKeyRef.current = '';
      setFrame(null);
    }
    setHintSlot((prev) => (prev === null ? prev : null));
  }, []);

  const updateCoach = useCallback((patch) => {
    const current = coachRef.current;
    if (!current) return null;
    const next = { ...current, ...patch };
    if (JSON.stringify(next) === JSON.stringify(current)) return current;
    if (Object.prototype.hasOwnProperty.call(patch, 'step') && patch.step !== current.step) {
      clearFrame();
    }
    return persistCoach(next);
  }, [clearFrame, persistCoach]);

  const setActiveBoth = useCallback((next) => {
    activeRef.current = next;
    setActive(next);
    publishNonBlockingTutorialState();
    if (!next) {
      clearFrame();
      setPickupIfChanged(null);
    }
  }, [clearFrame, setPickupIfChanged]);

  const finishCoach = useCallback((skipped = false) => {
    publishNonBlockingTutorialState();
    const current = coachRef.current || freshCoach(sealedCounts());
    persistCoach({ ...current, done: true, skipped: skipped || current.skipped });
    activeRef.current = false;
    setActive(false);
    clearFrame();
    setPickupIfChanged(null);
  }, [clearFrame, persistCoach, setPickupIfChanged]);

  const skipCoach = useCallback(() => {
    playCoachSfx('ui.back.cancel');
    finishCoach(true);
  }, [finishCoach]);

  const replayCoach = useCallback(() => {
    publishNonBlockingTutorialState();
    setLanguage(currentLanguage());
    const counts = sealedCounts();
    persistCoach(freshCoach(counts));
    const liveCasts = readP1SkillCastCounts() || [0, 0];
    battleSessionRef.current = { active: battleVisible(), casted: [false, false], baseCasts: liveCasts };
    writeSideIntroSeen({ ...readSideIntroSeen(), bot: 0, local: 0 });
    activeRef.current = true;
    setActive(true);
    clearFrame();
    setPickupIfChanged(null);
  }, [clearFrame, persistCoach, setPickupIfChanged]);

  const hideCoach = useCallback(() => setActiveBoth(false), [setActiveBoth]);

  useEffect(() => { coachRef.current = coach; }, [coach]);
  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    if (bootstrappedRef.current) return undefined;
    bootstrappedRef.current = true;
    if (coachRef.current) {
      // Existing coach record keeps its meaning: an unfinished lesson means the
      // tutorial was on; a finished or skipped one means it is off.
      if (readPref() === null) writePref(coachRef.current.done ? 'off' : 'on');
      setActiveBoth(!coachRef.current.done && readPref() === 'on');
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
      if (legacySeen && readPref() === null) writePref('off');
      // New profile: tutorial OFF until the player answers the one-time question
      // at a safe menu. The record is created done so nothing runs in battle.
      persistCoach(freshCoach(counts, true, legacySeen));
      setActiveBoth(false);
    }, 250);
    return () => window.clearInterval(poll);
  }, [persistCoach, setActiveBoth]);

  // Single authority for the tutorial preference. Yes starts the lesson from step 0;
  // No persists OFF and closes the lesson without running it.
  const answerTutorial = useCallback((enable) => {
    writePref(enable ? 'on' : 'off');
    if (enable) replayCoach();
    else finishCoach(true);
    try { window.dispatchEvent(new CustomEvent('apex:tutorial-pref-changed')); } catch { /* no CustomEvent */ }
  }, [finishCoach, replayCoach]);

  useEffect(() => {
    const onAnswer = (event) => answerTutorial(!!event?.detail?.enable);
    window.addEventListener('apex:tutorial-answer', onAnswer);
    return () => window.removeEventListener('apex:tutorial-answer', onAnswer);
  }, [answerTutorial]);

  useEffect(() => {
    const onOpen = () => replayCoach();
    const onLanguage = () => setLanguage(currentLanguage());
    const unsubI18n = window.APEX_I18N?.subscribe?.(onLanguage);
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
      if (typeof unsubI18n === 'function') unsubI18n();
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
    lastCandidateRef.current = nextFrame?.candidate || null;
    setFrame(nextFrame);
  }, []);

  const syncCoach = useCallback(() => {
    publishNonBlockingTutorialState();
    const current = coachRef.current;
    if (!activeRef.current || !current || current.done) {
      clearFrame();
      setPickupIfChanged(null);
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

    const inLiveBotBattle = scene === 'battle' && isBotBattle();
    const session = battleSessionRef.current;
    if (inLiveBotBattle && !session.active) {
      const initialCasts = readP1SkillCastCounts() || [0, 0];
      lastSlotRef.current = null;
      lastCandidateRef.current = null;
      session.active = true;
      session.casted = [initialCasts[0] > 0, initialCasts[1] > 0];
      session.baseCasts = initialCasts;
    } else if (!inLiveBotBattle && session.active) {
      session.active = false;
      session.casted = [false, false];
      session.baseCasts = [0, 0];
    }

    if (inLiveBotBattle) {
      const liveCasts = readP1SkillCastCounts();
      if (liveCasts) {
        if (liveCasts[0] > session.baseCasts[0]) session.casted[0] = true;
        if (liveCasts[1] > session.baseCasts[1]) session.casted[1] = true;
      }
    }

    if (step >= 3 && step <= 4 && scene !== 'battle') {
      const sealedBotSinceStart = counts && baselineBotMatches != null && counts.bot > baselineBotMatches;
      if (sealedBotSinceStart) step = LAST_STEP;
      else if (scene === 'home') step = 0;
      else if (scene === 'mode') step = 1;
      else if (scene === 'fighter') step = 2;
    } else if (step < 3) {
      if (scene === 'home') step = 0;
      else if (scene === 'mode') step = 1;
      else if (scene === 'fighter') step = 2;
      else if (inLiveBotBattle) step = 3;
    }

    if (step >= 2 && step < LAST_STEP && scene === 'home' && counts
      && baselineBotMatches != null && counts.bot > baselineBotMatches) {
      step = LAST_STEP;
    }

    if (inLiveBotBattle && (step === 3 || step === 4)) {
      const uniqueCasts = (session.casted[0] ? 1 : 0) + (session.casted[1] ? 1 : 0);
      if (uniqueCasts >= 2) {
        step = LAST_STEP;
      } else if (uniqueCasts === 1 && step === 3) {
        step = 4;
      }
    }

    if (step !== current.step
      || baselineBotMatches !== current.baselineBotMatches
      || baselineSealedMatches !== current.baselineSealedMatches) {
      updateCoach({ step, baselineBotMatches, baselineSealedMatches });
    }

    if (document.querySelector('#apex-real-match-result')) {
      clearFrame();
      setPickupIfChanged(null);
      return;
    }

    if (step === LAST_STEP && inLiveBotBattle) {
      clearFrame();
      setPickupIfChanged(computePickupPromptFrame());
      return;
    }

    setPickupIfChanged(null);

    if (!stepSceneMatches(step, scene)) {
      clearFrame();
      return;
    }

    if (step === 3 || step === 4) {
      const state = battleState();
      if (!state?.active || state?.over) {
        clearFrame();
        return;
      }
      const s0 = skillInfo(0);
      const s1 = skillInfo(1);
      let chosenSlot = null;
      const stickySlot = lastSlotRef.current;
      if (step === 3) {
        const eligible0 = !session.casted[0] && s0.ready;
        const eligible1 = !session.casted[1] && s1.ready;
        if (stickySlot === 1 && eligible1) chosenSlot = 1;
        else if (stickySlot === 0 && eligible0) chosenSlot = 0;
        else if (eligible0) chosenSlot = 0;
        else if (eligible1) chosenSlot = 1;
      } else {
        const remainingSlot = session.casted[0] ? 1 : 0;
        const info = remainingSlot === 0 ? s0 : s1;
        if (info.ready) chosenSlot = remainingSlot;
      }
      lastSlotRef.current = chosenSlot;

      if (chosenSlot === null) {
        clearFrame();
        return;
      }

      const anchor = (chosenSlot === 0 ? s0.element : s1.element);
      if (!isVisibleAnchor(anchor)) {
        clearFrame();
        return;
      }
      setHintSlot((prev) => (prev === chosenSlot ? prev : chosenSlot));
      const measuredH = chipRef.current?.offsetHeight || 78;
      setFrameIfChanged(computeBattleFrame(anchor, measuredH, lastCandidateRef.current));
      return;
    }

    setHintSlot((prev) => (prev === null ? prev : null));
    const menuAnchor = findMenuAnchor(step);
    const measuredMenuH = chipRef.current?.offsetHeight || 82;
    setFrameIfChanged(computeMenuFrame(step, menuAnchor, measuredMenuH));
  }, [clearFrame, finishCoach, setFrameIfChanged, setPickupIfChanged, updateCoach]);

  // Listen directly to authoritative combat engine Cast events for immediate step sync.
  useEffect(() => {
    let attachedBus = null;
    const onEngineCast = (evt) => {
      const payload = evt?.payload;
      if (!payload) return;
      const side = String(payload.side || payload.combatantId || '').toLowerCase();
      if (side !== 'p1' && side !== '0') return;
      const slotIdx = payload.slot === 'A2' ? 1 : 0;
      battleSessionRef.current.casted[slotIdx] = true;
      syncCoach();
    };
    const bindBus = () => {
      const bus = window.APEX_HERO_REWORK_AIL?.bus;
      if (bus && bus !== attachedBus && typeof bus.on === 'function') {
        attachedBus = bus;
        try { bus.on('Cast', onEngineCast); } catch { /* idempotent observer */ }
      }
    };
    bindBus();
    const interval = window.setInterval(() => {
      bindBus();
      syncCoach();
    }, 100);
    const onResize = () => syncCoach();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [syncCoach]);

  // Brief non-blocking side-color intro badge on HUD identity headers.
  useEffect(() => {
    const poll = () => {
      const scene = currentScene();
      const state = battleState();
      const mode = String(state?.battleMode || '').toUpperCase();
      const validMode = mode === 'BOT' ? 'bot' : mode === 'LOCAL' ? 'local' : null;
      const ref = sideIntroRef.current;
      if (scene !== 'battle' || !validMode) {
        if (ref.applied) {
          setSideIntroLabels(null);
          ref.applied = false;
        }
        ref.scene = scene;
        ref.mode = null;
        ref.activeUntil = 0;
        return;
      }
      if (ref.mode !== validMode || Number(state?.time || 0) + 0.5 < ref.lastTime) {
        ref.mode = validMode;
        const seen = readSideIntroSeen();
        if (!seen[validMode]) {
          ref.activeUntil = Date.now() + 4200;
          writeSideIntroSeen({ ...seen, [validMode]: 1 });
        } else {
          ref.activeUntil = 0;
        }
      }
      ref.lastTime = Number(state?.time || 0);
      if (Date.now() < ref.activeUntil) {
        const t = COPY[currentLanguage()];
        const labels = validMode === 'bot' ? [t.sideYou, t.sideBot] : [t.sideP1, t.sideP2];
        ref.applied = setSideIntroLabels(labels);
      } else if (ref.applied) {
        setSideIntroLabels(null);
        ref.applied = false;
      }
    };
    poll();
    const interval = window.setInterval(poll, 200);
    return () => {
      window.clearInterval(interval);
      setSideIntroLabels(null);
    };
  }, []);

  // Soft highlight ring on the currently taught castable skill card ONLY;
  // NEVER dims the arena canvas or locks/dims the other skill card.
  useEffect(() => {
    if (!active || !coach || coach.done || (coach.step !== 3 && coach.step !== 4) || hintSlot == null) {
      return undefined;
    }
    const element = skillAnchor(hintSlot);
    if (!element?.classList) return undefined;
    element.classList.add('apex-coach-taught');
    return () => {
      try { element.classList.remove('apex-coach-taught'); } catch { /* detached */ }
    };
  }, [active, coach, hintSlot]);

  // Notify live overlays (e.g. AchievementToast safe-dock solver) whenever the
  // non-blocking coach mounts, relocates, switches lessons, or unmounts.
  useLayoutEffect(() => {
    try { window.dispatchEvent(new CustomEvent('apex:coach-layout-changed')); }
    catch { /* environment without CustomEvent */ }
  }, [active, coach?.done, coach?.step, frame, pickupFrame, hintSlot, language]);

  if (!active || !coach || coach.done || (!frame && !pickupFrame)) return null;

  const lang = (currentLanguage() === 'vie' || (language === 'vie' && !window.APEX_I18N?.getLanguage)) ? 'vie' : 'eng';
  const copy = COPY[lang];

  if (pickupFrame && !frame) {
    return (
      <div
        className="apex-guide-dock apex-coach-layer"
        data-tutorial-paused="false"
        aria-live="polite"
      >
        <div
          className={`apex-guide-pickup-prompt${pickupFrame.compact ? ' is-compact' : ''}`}
          role="status"
          aria-label={copy.pickupPrompt}
          data-apex-no-localize=""
          style={{
            left: `${pickupFrame.left}px`,
            top: `${pickupFrame.top}px`,
            width: `${pickupFrame.width}px`,
            height: `${pickupFrame.height}px`,
          }}
        >
          {copy.pickupPrompt}
        </div>
      </div>
    );
  }

  const isBattleStep = (coach.step === 3 || coach.step === 4) && hintSlot != null;
  const item = isBattleStep
    ? copy.steps[hintSlot === 0 ? 3 : 4]
    : (copy.steps[coach.step] || copy.steps[0]);
  const rawBody = item.body || (coarse ? item.touch : item.keyboard);
  const skillName = isBattleStep ? taughtSkillName(hintSlot) : '';
  const displayBody = skillName ? `${rawBody} · ${skillName}` : rawBody;

  return (
    <div
      className="apex-guide-dock apex-coach-layer"
      data-tutorial-paused="false"
      data-taught-slot={isBattleStep ? String(hintSlot) : ''}
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
      <section
        ref={chipRef}
        className={`apex-guide-card apex-coach-chip${frame.compact ? ' is-compact' : ''}${frame.narrow ? ' is-narrow' : ''}`}
        role="status"
        aria-label={`${copy.kicker}: ${item.title}. ${displayBody}`}
        data-placement={frame.placement}
        data-candidate={frame.candidate || ''}
        data-apex-no-localize=""
        style={{
          left: `${frame.chipLeft}px`,
          top: `${frame.chipTop}px`,
          width: `${frame.chipWidth}px`,
          transform: frame.chipTransform,
        }}
      >
        <div className="apex-coach-copy">
          <p className="apex-guide-kicker">{(isBattleStep ? copy.actionKicker : copy.kicker)} · {coach.step + 1}/{LAST_STEP + 1}</p>
          <div className="apex-guide-steps" aria-hidden="true">
            {Array.from({ length: LAST_STEP + 1 }, (_, index) => (
              <i key={index} className={index <= coach.step ? 'is-done' : ''} />
            ))}
          </div>
          <h2>{item.title}</h2>
          <p className="apex-guide-body">{displayBody}</p>
        </div>
        <button
          type="button"
          className="apex-coach-skip apex-guide-close"
          onClick={skipCoach}
          aria-label={copy.skip}
        >
          {copy.skip}
        </button>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tutorial preference UI (Issue #105). Non-blocking by design: the question is a
// small card at the bottom edge (no backdrop, no focus trap) and the toggle is a
// Help-row control beside `?`. Both write through the coach component via the
// 'apex:tutorial-answer' event so there is exactly one preference authority.
const TUTORIAL_COPY = {
  eng: {
    ask: 'Enable the optional tutorial?',
    body: 'Short hints during your first battle. Change it anytime in Help.',
    yes: 'YES, GUIDE ME',
    no: 'NO THANKS',
    toggle: 'Tutorial / Hướng dẫn tân thủ',
    on: 'ON',
    off: 'OFF',
    label: 'Tutorial preference',
  },
  vie: {
    ask: 'Bật hướng dẫn tân thủ?',
    body: 'Gợi ý ngắn trong trận đầu. Đổi bất cứ lúc nào trong Trợ giúp.',
    yes: 'CÓ, HƯỚNG DẪN',
    no: 'KHÔNG CẦN',
    toggle: 'Tutorial / Hướng dẫn tân thủ',
    on: 'BẬT',
    off: 'TẮT',
    label: 'Cài đặt hướng dẫn',
  },
};

function tutorialLang() {
  try { return window.APEX_I18N?.getLanguage?.() === 'vie' ? 'vie' : 'eng'; }
  catch { return 'eng'; }
}

// A safe menu is any shell screen outside a live battle, once boot has finished.
function safeMenuNow() {
  if (!stageElement() || bootGateVisible() || battleVisible()) return false;
  return currentScene() !== 'battle';
}

function requestTutorial(enable) {
  try { window.dispatchEvent(new CustomEvent('apex:tutorial-answer', { detail: { enable: !!enable } })); }
  catch { /* no CustomEvent */ }
}

function TutorialPreference() {
  const [pref, setPref] = useState(readPref);
  const [lang, setLang] = useState(tutorialLang);
  const [askOpen, setAskOpen] = useState(false);
  const toggleRef = useRef(null);
  const prefRef = useRef(pref);
  prefRef.current = pref;
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    const sync = () => {
      const nextPref = readPref();
      setPref(nextPref);
      setLang(tutorialLang());
      // Ask only once: while no answer is stored and a coach record exists (so the
      // coach has finished bootstrapping), and only at a safe menu.
      setAskOpen(nextPref === null && !!readCoach() && safeMenuNow());
    };
    sync();
    const interval = window.setInterval(sync, 300);
    window.addEventListener('apex:tutorial-pref-changed', sync);
    window.addEventListener('apex:language-changed', sync);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('apex:tutorial-pref-changed', sync);
      window.removeEventListener('apex:language-changed', sync);
    };
  }, []);

  // Help-row toggle: DOM-mounted beside `?` (same visibility rules as `?`).
  useEffect(() => {
    // paint() only writes when the value changed: this button lives inside the
    // observed body subtree, so unconditional writes would re-trigger the observer.
    const paint = () => {
      const btn = toggleRef.current;
      if (!btn?.isConnected) return;
      const copy = TUTORIAL_COPY[langRef.current] || TUTORIAL_COPY.eng;
      const on = prefRef.current === 'on';
      const checked = on ? 'true' : 'false';
      const label = `${copy.toggle}: ${on ? copy.on : copy.off}`;
      const stateText = on ? copy.on : copy.off;
      if (btn.getAttribute('aria-checked') !== checked) btn.setAttribute('aria-checked', checked);
      if (btn.getAttribute('aria-label') !== label) btn.setAttribute('aria-label', label);
      const stateEl = btn.querySelector('.apex-tt-state');
      if (stateEl && stateEl.textContent === stateText && btn.querySelector('.apex-tt-name')?.textContent === copy.toggle) return;
      btn.textContent = '';
      const name = document.createElement('span');
      name.className = 'apex-tt-name';
      name.textContent = copy.toggle;
      const state = document.createElement('span');
      state.className = 'apex-tt-state';
      state.textContent = stateText;
      btn.append(name, state);
    };
    const mount = () => {
      if (toggleRef.current?.isConnected) return;
      const stage = stageElement();
      if (!stage) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'apex-tutorial-toggle';
      btn.setAttribute('role', 'switch');
      btn.dataset.apexNoLocalize = '';
      btn.addEventListener('click', () => requestTutorial(prefRef.current !== 'on'));
      stage.appendChild(btn);
      toggleRef.current = btn;
      paint();
    };
    mount();
    const guard = new MutationObserver(mount);
    guard.observe(document.body, { subtree: true, childList: true });
    const repaint = window.setInterval(paint, 300);
    paint();
    return () => {
      window.clearInterval(repaint);
      guard.disconnect();
      toggleRef.current?.remove();
      toggleRef.current = null;
    };
  }, []);

  if (!askOpen) return null;
  const copy = TUTORIAL_COPY[lang] || TUTORIAL_COPY.eng;
  return (
    <section
      className="apex-tutorial-ask"
      role="region"
      aria-label={copy.label}
      data-apex-no-localize=""
    >
      <p className="apex-tutorial-ask-title">{copy.ask}</p>
      <p className="apex-tutorial-ask-body">{copy.body}</p>
      <div className="apex-tutorial-ask-actions">
        <button type="button" className="apex-tutorial-ask-yes" onClick={() => requestTutorial(true)}>
          {copy.yes}
        </button>
        <button type="button" className="apex-tutorial-ask-no" onClick={() => requestTutorial(false)}>
          {copy.no}
        </button>
      </div>
    </section>
  );
}

export default function FirstPlayGuide() {
  return (
    <>
      <FirstPlayGuideCoach />
      <TutorialPreference />
    </>
  );
}
