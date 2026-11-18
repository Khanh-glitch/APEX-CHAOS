import React, { useEffect, useState } from 'react';
import {
  ApexImpulseBoltIcon,
  ApexArenaCrestIcon,
  X,
  ChevronUp,
  ChevronDown,
  Shield,
  Swords,
  Target,
  Flame,
  Activity,
  SlidersHorizontal,
} from './ApexIcons.jsx';
import './freeBattleBeyondHud.css';

const CIRC = 2 * Math.PI * 10;

const COPY = {
  eng: {
    incoming: 'INCOMING',
    popTitle: 'ARENA & TACTICAL CONTROL',
    close: 'Close',
    arenaStage: 'ARENA STAGE (LIVE SWITCH)',
    botIntel: 'ADAPTIVE BOT INTELLIGENCE',
    tiers: { ROOKIE: 'ROOKIE', VETERAN: 'VETERAN', APEX: 'APEX' },
    modifiers: 'COMBAT MODIFIERS',
    eventsOn: 'EVENTS ON',
    eventsOff: 'EVENTS OFF',
    hyper: 'HYPER',
    stdPace: 'STD PACE',
    camDyn: 'CAM DYN',
    camLock: 'CAM LOCK',
    deflects: 'DEFLECTS',
    clashes: 'CLASHES',
    slams: 'SLAMS',
    deflectNow: 'DEFLECT!',
    impulse: 'IMPULSE',
    p2Burst: 'P2 BURST',
    overdrive: 'OVERDRIVE',
    odShort: 'OD',
  },
  vie: {
    incoming: 'SẮP TỚI',
    popTitle: 'ĐIỀU KHIỂN SÀN ĐẤU',
    close: 'Đóng',
    arenaStage: 'SÀN ĐẤU (ĐỔI TRỰC TIẾP)',
    botIntel: 'TRÍ TUỆ BOT THÍCH ỨNG',
    tiers: { ROOKIE: 'TÂN BINH', VETERAN: 'KỲ CỰU', APEX: 'APEX' },
    modifiers: 'BIẾN SỐ GIAO TRANH',
    eventsOn: 'SỰ KIỆN BẬT',
    eventsOff: 'SỰ KIỆN TẮT',
    hyper: 'SIÊU TỐC',
    stdPace: 'CHUẨN',
    camDyn: 'CAM ĐỘNG',
    camLock: 'CAM KHÓA',
    deflects: 'PHẢN ĐÒN',
    clashes: 'ĐẤU ĐÒN',
    slams: 'VA TƯỜNG',
    deflectNow: 'PHẢN ĐÒN!',
    impulse: 'XUNG LỰC',
    p2Burst: 'P2 XUNG',
    overdrive: 'QUÁ TẢI',
    odShort: 'QT',
  },
};

function readLang() {
  try { return window.APEX_I18N?.getLanguage?.() === 'vie' ? 'vie' : 'eng'; }
  catch { return 'eng'; }
}

function rectOf(selector) {
  try {
    const el = document.querySelector(selector);
    if (!el) return null;
    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return null;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4 ? r : null;
  } catch {
    return null;
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function sameBox(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.left === b.left
    && a.top === b.top
    && a.width === b.width
    && a.height === b.height
    && a.stacked === b.stacked
    && a.compact === b.compact;
}

function sameSlots(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.kind === b.kind
    && a.mode === b.mode
    && sameBox(a.p1, b.p1)
    && sameBox(a.p2, b.p2)
    && sameBox(a.portBar, b.portBar)
    && sameBox(a.event, b.event)
    && sameBox(a.popover, b.popover);
}

// Compute HUD-rail docking boxes guaranteed NEVER to overlap #arena.
function measureHudSlots() {
  const vw = window.innerWidth || document.documentElement.clientWidth || 1280;
  const vh = window.innerHeight || document.documentElement.clientHeight || 720;
  const hud = document.querySelector('#battleHudHost.is-open #hud');
  const arena = rectOf('#battleHudHost.is-open #arena') || rectOf('#game-canvas');
  if (!arena || arena.width < 60 || arena.height < 60) return null;

  const layout = hud?.dataset?.layout || (vh > vw ? 'port' : vw >= 1180 ? 'desk' : 'land');
  const mode = hud?.dataset?.mode || '1p';

  const p1Side = rectOf('#battleHudHost.is-open #p1Side');
  const p1Skills = rectOf('#battleHudHost.is-open #p1Side .skills');
  const p1Weapon = rectOf('#battleHudHost.is-open #p1Side .weapon');
  const p2Side = rectOf('#battleHudHost.is-open #p2Side');
  const p2Ident = rectOf('#battleHudHost.is-open #p2Side .ident');
  const p2Skills = rectOf('#battleHudHost.is-open #p2Side .skills');
  const p2Weapon = rectOf('#battleHudHost.is-open #p2Side .weapon');
  const rail = rectOf('#battleHudHost.is-open #versusRail');

  // ── 1. PORTRAIT LAYOUT (stacked territories above & below #arena) ─────────
  if (layout === 'port' && p1Side) {
    if (mode === '1p') {
      const h = 36;
      // Leave rightmost 40px in #p1Side's reserved bottom row for Tactical Pause (||).
      const reservePause = p1Side.width >= 280 ? 40 : 0;
      const w = Math.max(180, Math.round(p1Side.width - reservePause));
      const left = Math.round(p1Side.left);
      const minSafeTop = p1Skills
        ? Math.max(Math.round(arena.bottom + 6), Math.ceil(p1Skills.bottom + 2))
        : Math.round(arena.bottom + 6);
      const desiredTop = Math.max(minSafeTop, Math.round(p1Side.bottom - h - 1));
      const portBar = (desiredTop + h <= vh + 2 && (!p1Skills || desiredTop >= Math.floor(p1Skills.bottom)))
        ? { left, top: Math.min(desiredTop, vh - h - 1), width: w, height: h, stacked: false, compact: w < 330 }
        : null;
      const anchorTop = portBar ? portBar.top : desiredTop;
      const popTop = Math.round(arena.bottom + 6);
      const popAvailH = Math.max(96, anchorTop - popTop - 6);
      const popW = Math.min(368, Math.round(p1Side.width));
      const popLeft = Math.round(p1Side.left + (p1Side.width - popW) * 0.5);
      return {
        kind: 'port-1p',
        mode,
        p1: null,
        p2: null,
        portBar,
        event: null, // Rendered inline inside portBar when active — zero extra panel
        popover: {
          left: popLeft,
          top: Math.max(8, vh - anchorTop + 6), // stores bottom offset in .top for upward anchor
          width: popW,
          height: popAvailH,
          stacked: false,
          compact: true,
        },
      };
    }

    // Portrait 2P (face-to-face shared device): dock each pod in its own side territory,
    // strictly outside P1/P2 .skills hit targets.
    const h = 32;
    const p1W = Math.max(150, Math.round(p1Side.width));
    const p1Left = Math.round(p1Side.left);
    const p1MinTop = p1Skills
      ? Math.max(Math.round(arena.bottom + 5), Math.ceil(p1Skills.bottom + 1))
      : Math.round(arena.bottom + 5);
    const p1Top = Math.max(p1MinTop, Math.round(p1Side.bottom - h));
    const p1PortBox = (p1Top + h <= vh + 2 && (!p1Skills || p1Top >= Math.floor(p1Skills.bottom)))
      ? { left: p1Left, top: p1Top, width: p1W, height: h, stacked: false, compact: true }
      : null;

    let p2Box = null;
    if (p2Side) {
      const p2W = Math.max(150, Math.round(p2Side.width));
      const p2Left = Math.round(p2Side.left);
      // #p2Side is rotated 180deg in Local 2P, so its reserved "." row renders at p2Side.top
      // strictly above p2Skills.top.
      const maxBottom = Math.min(
        rail ? rail.top - 4 : arena.top - 6,
        p2Skills ? Math.floor(p2Skills.top - 1) : arena.top - 6,
      );
      const p2Top = Math.max(2, Math.min(Math.round(p2Side.top + 1), Math.round(maxBottom - h)));
      if (p2Top + h <= arena.top - 2 && (!p2Skills || p2Top + h <= Math.ceil(p2Skills.top))) {
        p2Box = { left: p2Left, top: p2Top, width: p2W, height: h, stacked: false, compact: true };
      }
    }

    const popW = Math.min(360, Math.round(p1Side.width));
    const popLeft = Math.round(p1Side.left + (p1Side.width - popW) * 0.5);
    const popAvailH = Math.max(76, p1Top - Math.round(arena.bottom + 6) - 6);
    return {
      kind: 'port-2p',
      mode,
      p1: p1PortBox,
      p2: p2Box,
      portBar: null,
      event: null,
      popover: {
        left: popLeft,
        top: Math.max(8, vh - p1Top + 6),
        width: popW,
        height: popAvailH,
        stacked: false,
        compact: true,
      },
    };
  }

  // ── 2. DESKTOP & LANDSCAPE (3-column: #p1Side | #arena | #p2Side) ─────────
  // HARD LAW: p1Box and p2Box MUST sit strictly inside the reserved "." spacer
  // row between .skills.bottom and .weapon.top — NEVER overlapping .skill tiles!
  const isDesk = layout === 'desk';
  const targetPodH = isDesk ? 40 : 34;

  // Left P1 gutter (strictly left of #arena and strictly below P1 .skills)
  const leftMaxRight = Math.floor(arena.left - 6);
  let p1Box = null;
  if (p1Side && leftMaxRight >= 124) {
    const refRight = Math.min(leftMaxRight, Math.round((p1Skills || p1Side).right));
    const maxW = Math.min(420, Math.round((p1Skills || p1Side).width), refRight - 6);
    const w = Math.max(118, maxW);
    const left = Math.max(6, refRight - w);
    const gapTop = p1Skills ? Math.ceil(p1Skills.bottom + 2) : Math.round(p1Side.top + 8);
    const gapBottom = p1Weapon ? Math.floor(p1Weapon.top - 2) : Math.round(p1Side.bottom - 4);
    const availGap = gapBottom - gapTop;
    if (left + w <= arena.left - 4 && availGap >= 30) {
      const h = Math.min(targetPodH, availGap);
      const top = Math.round(gapTop + (availGap - h) * 0.5);
      p1Box = { left, top, width: w, height: h, stacked: false, compact: w < 235 || h < 36 };
    }
  }

  // Right P2 / Stage gutter (strictly right of #arena and strictly below P2 .skills)
  const rightMinLeft = Math.ceil(arena.right + 6);
  let p2Box = null;
  let eventBox = null;
  let popBox = null;
  if (p2Side && vw - rightMinLeft >= 124) {
    const refLeft = Math.max(rightMinLeft, Math.round((p2Skills || p2Side).left));
    const rawW = Math.min(420, Math.round((p2Skills || p2Side).width), vw - 6 - refLeft);
    const w = Math.max(118, rawW);
    const left = Math.max(rightMinLeft, Math.min(refLeft, vw - 6 - w));
    const gapTop = p2Skills
      ? Math.ceil(p2Skills.bottom + 2)
      : (p2Ident ? Math.ceil(p2Ident.bottom + 6) : Math.round(p2Side.top + 8));
    const gapBottom = p2Weapon ? Math.floor(p2Weapon.top - 2) : Math.round(p2Side.bottom - 4);
    const availGap = gapBottom - gapTop;
    // On narrow mobile landscape 1P (#p2Side ~156px wide with tall spacer), stack cleanly into 2 rows.
    const shouldStack = mode === '1p' && w < 210 && availGap >= 64;
    const desiredH = shouldStack ? 60 : targetPodH;
    if (left >= arena.right + 4 && availGap >= 30) {
      const h = Math.min(desiredH, availGap);
      const top = Math.round(gapBottom - h - Math.min(3, Math.max(0, (availGap - h) * 0.5)));
      p2Box = { left, top, width: w, height: h, stacked: shouldStack && h >= 56, compact: w < 250 || h < 36 };
    }

    // Live Arena Event telemetry strip: sits inside #p2Side open slot, NEVER on #arena.
    const evH = 42;
    if (p2Box && p2Box.top - gapTop >= evH + 44) {
      // Leave top 42px below p2Skills free for Pause button; dock event strip right above p2Pod.
      eventBox = { left: p2Box.left, top: p2Box.top - evH - 6, width: p2Box.width, height: evH, stacked: false, compact: p2Box.width < 230 };
    } else if (p2Ident && p2Skills && p2Skills.top - p2Ident.bottom >= evH + 10) {
      // Desktop 2P upper #p2Side gap (leave rightmost 40px open for Pause button).
      const evW = Math.max(140, Math.round(p2Side.width - 42));
      const evLeft = Math.max(rightMinLeft, Math.round(p2Side.left));
      if (evLeft + evW <= p2Side.right - 36) {
        eventBox = { left: evLeft, top: Math.round(p2Ident.bottom + 6), width: evW, height: evH, stacked: false, compact: evW < 230 };
      }
    }

    // Stage & Tactical Config drawer: anchored strictly inside #p2Side right rail (never over #arena).
    const anchorTop = p2Box ? p2Box.top : Math.round(arena.bottom - 48);
    const sideW = Math.max(140, Math.round(p2Side.right - rightMinLeft));
    const popW = Math.min(356, sideW);
    const popLeft = Math.max(rightMinLeft, Math.round(p2Side.right - popW));
    const minPopTop = rail ? Math.round(rail.bottom + 8) : 12;
    const popMaxH = Math.max(140, anchorTop - minPopTop - 8);
    popBox = {
      left: popLeft,
      top: Math.max(8, vh - anchorTop + 6), // bottom offset
      width: popW,
      height: popMaxH,
      stacked: false,
      compact: popW < 280,
    };
  } else if (vw - rightMinLeft >= 140) {
    const w = Math.min(260, vw - rightMinLeft - 8);
    const top = Math.round(arena.bottom - targetPodH - 4);
    p2Box = { left: rightMinLeft, top, width: w, height: targetPodH, stacked: false, compact: w < 230 };
    popBox = { left: Math.max(8, rightMinLeft + w - Math.min(320, w)), top: Math.max(8, vh - top + 6), width: Math.min(320, Math.max(240, w)), height: Math.max(200, top - 24), stacked: false, compact: w < 260 };
  }

  return {
    kind: 'side-rails',
    mode,
    p1: p1Box,
    p2: p2Box,
    portBar: null,
    event: eventBox,
    popover: popBox,
  };
}

export default function FreeBattleBeyondHud() {
  const [snap, setSnap] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [slots, setSlots] = useState(null);
  const [lang, setLang] = useState(readLang);
  const [suppressed, setSuppressed] = useState(false);

  const visible = Boolean(snap && snap.active && !snap.over && !suppressed);

  // Publish body class + zero-occlusion diegetic perimeter state so Gold HUD reserves
  // dedicated rail slots and subtly illuminates #arena's outer frame on Overdrive / Event.
  const s0 = snap?.sides?.[0];
  const s1 = snap?.sides?.[1];
  const odState = visible
    ? ((s0?.overdriveTimer > 0 && s1?.overdriveTimer > 0)
      ? 'both'
      : (s0?.overdriveTimer > 0 ? 'p1' : (s1?.overdriveTimer > 0 ? 'p2' : '')))
    : '';
  const evPhase = visible && snap?.event ? (snap.event.phase === 'TELEGRAPH' ? 'telegraph' : 'live') : '';
  const evColor = visible && snap?.event?.color ? String(snap.event.color) : '';

  useEffect(() => {
    document.body?.classList?.toggle('apex-beyond-live', visible);
    let settleRaf = 0;
    if (visible) {
      // Re-measure one frame after body.apex-beyond-live activates the reserved
      // "." grid rows in Gold HUD so pods dock immediately with zero overlap.
      settleRaf = requestAnimationFrame(() => {
        const nextSlots = measureHudSlots();
        setSlots((prev) => (sameSlots(prev, nextSlots) ? prev : nextSlots));
        try { window.dispatchEvent(new CustomEvent('apex:beyond-layout', { detail: { active: true } })); } catch { /* ignore */ }
      });
    }
    try { window.dispatchEvent(new CustomEvent('apex:beyond-layout', { detail: { active: visible } })); } catch { /* ignore */ }
    return () => {
      if (settleRaf) cancelAnimationFrame(settleRaf);
      document.body?.classList?.remove('apex-beyond-live');
    };
  }, [visible]);

  useEffect(() => {
    const body = document.body;
    if (!body) return undefined;
    if (odState) body.dataset.apexOd = odState;
    else delete body.dataset.apexOd;
    if (evPhase) {
      body.dataset.apexEvent = evPhase;
      if (evColor) body.style.setProperty('--apex-arena-ev', evColor);
    } else {
      delete body.dataset.apexEvent;
      body.style.removeProperty('--apex-arena-ev');
    }
    return () => {
      delete body.dataset.apexOd;
      delete body.dataset.apexEvent;
      body.style.removeProperty('--apex-arena-ev');
    };
  }, [odState, evPhase, evColor]);

  useEffect(() => {
    let rafId = 0;
    let lastPush = 0;

    const stopLoop = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const syncSlotsNow = () => {
      const nextSlots = measureHudSlots();
      setSlots((prev) => {
        if (sameSlots(prev, nextSlots)) return prev;
        try { window.dispatchEvent(new CustomEvent('apex:beyond-layout', { detail: { active: true } })); } catch { /* ignore */ }
        return nextSlots;
      });
    };

    const poll = (now) => {
      const combat = window.APEX_BEYOND_COMBAT;
      const next = combat?.getHudSnapshot?.();
      if (!next || !next.active) {
        stopLoop();
        setSnap((prev) => (prev ? null : prev));
        setPanelOpen(false);
        return;
      }
      rafId = requestAnimationFrame(poll);
      if (now - lastPush < 60) return; // ~16Hz lightweight HUD sync
      lastPush = now;
      syncSlotsNow();
      setSnap(next);
    };

    const ensureLoop = (event) => {
      const active = event?.detail?.active ?? Boolean(window.APEX_BEYOND_COMBAT?.getHudSnapshot?.()?.active);
      if (active) {
        if (!rafId) rafId = requestAnimationFrame(poll);
      } else {
        stopLoop();
        setSnap(null);
        setPanelOpen(false);
      }
    };

    const syncSuppression = () => {
      const paused = Boolean(window.__apexBattlePaused || document.body?.classList?.contains('apex-battle-paused'));
      const resultOpen = Boolean(document.getElementById('apex-real-match-result') || document.body?.classList?.contains('battle-result'));
      setSuppressed(paused || resultOpen);
      if (paused || resultOpen) setPanelOpen(false);
    };

    const onLang = () => setLang(readLang());

    ensureLoop();
    syncSuppression();
    window.addEventListener('apex:beyond-state', ensureLoop);
    window.addEventListener('apex:gold-battle-exited', ensureLoop);
    window.addEventListener('apex:battle-pause-changed', syncSuppression);
    window.addEventListener('apex:battle-result-changed', syncSuppression);
    window.addEventListener('apex:gold-result-ready', syncSuppression);
    window.addEventListener('apex:language-changed', onLang);
    window.addEventListener('resize', syncSlotsNow, { passive: true });
    return () => {
      stopLoop();
      window.removeEventListener('apex:beyond-state', ensureLoop);
      window.removeEventListener('apex:gold-battle-exited', ensureLoop);
      window.removeEventListener('apex:battle-pause-changed', syncSuppression);
      window.removeEventListener('apex:battle-result-changed', syncSuppression);
      window.removeEventListener('apex:gold-result-ready', syncSuppression);
      window.removeEventListener('apex:language-changed', onLang);
      window.removeEventListener('resize', syncSlotsNow);
    };
  }, []);

  useEffect(() => {
    if (!panelOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setPanelOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [panelOpen]);

  if (!visible || !slots) return null;

  const copy = COPY[lang] || COPY.eng;
  const p1 = snap.sides[0] || {};
  const p2 = snap.sides[1] || {};
  const isLocal = snap.battleMode !== 'BOT';
  const p1Ready = (p1.impulseCharge || 0) >= 0.99;
  const p2Ready = (p2.impulseCharge || 0) >= 0.99;
  const p1OdActive = (p1.overdriveTimer || 0) > 0;
  const p2OdActive = (p2.overdriveTimer || 0) > 0;
  const p1OdFill = p1OdActive ? Math.min(1, p1.overdriveTimer / 8) : Math.min(1, (p1.overdrive || 0) / 100);
  const p2OdFill = p2OdActive ? Math.min(1, p2.overdriveTimer / 8) : Math.min(1, (p2.overdrive || 0) / 100);

  const fireImpulse = (side) => {
    window.APEX_BEYOND_COMBAT?.triggerImpulse?.(side);
  };

  const selectTheme = (id) => {
    window.APEX_BEYOND_ARENA?.setTheme?.(id);
  };

  const updateSetting = (patch) => {
    window.APEX_BEYOND_COMBAT?.updateSetting?.(patch);
  };

  const renderP1Trigger = (compact) => (
    <button
      type="button"
      className={`ab-impulse-btn ${p1Ready ? 'is-ready' : ''} ${p1.deflectWindow > 0 ? 'is-deflect' : ''} ${compact ? 'is-compact' : ''}`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        fireImpulse(0);
      }}
      title="Kinetic Impulse & Perfect Deflect (Space / Shift)"
    >
      <span className="ab-ring-wrap">
        <svg className="ab-ring-svg" viewBox="0 0 26 26">
          <circle className="ab-ring-bg" cx="13" cy="13" r="10" />
          <circle
            className="ab-ring-fill"
            cx="13"
            cy="13"
            r="10"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - (p1.impulseCharge || 0))}
          />
        </svg>
        <span className="ab-ring-icon">
          <ApexImpulseBoltIcon size={12} deflect={p1.deflectWindow > 0} />
        </span>
      </span>
      <span className="ab-btn-copy">
        <span className="ab-btn-label">{p1.deflectWindow > 0 ? copy.deflectNow : copy.impulse}</span>
        {!compact && <span className="ab-btn-key">SPACE</span>}
      </span>
    </button>
  );

  const renderP2Trigger = (compact) => (
    <button
      type="button"
      className={`ab-impulse-btn is-p2 ${p2Ready ? 'is-ready' : ''} ${p2.deflectWindow > 0 ? 'is-deflect' : ''} ${compact ? 'is-compact' : ''}`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        fireImpulse(1);
      }}
      title="P2 Kinetic Impulse & Perfect Deflect (Enter / Numpad 0)"
    >
      <span className="ab-ring-wrap">
        <svg className="ab-ring-svg" viewBox="0 0 26 26">
          <circle className="ab-ring-bg" cx="13" cy="13" r="10" />
          <circle
            className="ab-ring-fill"
            cx="13"
            cy="13"
            r="10"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - (p2.impulseCharge || 0))}
          />
        </svg>
        <span className="ab-ring-icon">
          <ApexImpulseBoltIcon size={12} deflect={p2.deflectWindow > 0} />
        </span>
      </span>
      <span className="ab-btn-copy">
        <span className="ab-btn-label">{p2.deflectWindow > 0 ? copy.deflectNow : copy.p2Burst}</span>
        {!compact && <span className="ab-btn-key">ENTER</span>}
      </span>
    </button>
  );

  const renderOdMeter = (sideIdx, compact) => {
    const isP2 = sideIdx === 1;
    const active = isP2 ? p2OdActive : p1OdActive;
    const timer = isP2 ? p2.overdriveTimer : p1.overdriveTimer;
    const val = isP2 ? p2.overdrive : p1.overdrive;
    const fill = isP2 ? p2OdFill : p1OdFill;
    const label = active
      ? (compact ? copy.odShort : copy.overdrive)
      : (isP2 ? (isLocal ? `P2 ${copy.odShort}` : `BOT ${copy.odShort}`) : `P1 ${copy.odShort}`);
    return (
      <div className={`ab-od-meter ${isP2 ? 'is-p2' : ''} ${active ? 'is-active' : ''}`}>
        <div className="ab-od-head">
          <span>
            {active && <Flame size={9} strokeWidth={2.5} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '2px' }} />}
            {label}
          </span>
          <span>{active ? `${timer.toFixed(1)}s` : `${Math.round(val || 0)}%`}</span>
        </div>
        <div className="ab-od-track">
          <div className="ab-od-bar" style={{ transform: `scaleX(${fill})` }} />
          <div className="ab-od-ticks" aria-hidden="true" />
        </div>
      </div>
    );
  };

  const renderStageBtn = (iconOnly = false) => (
    <button
      type="button"
      className={`ab-config-btn ${panelOpen ? 'is-open' : ''} ${iconOnly ? 'is-icon-only' : ''}`}
      onPointerDown={(e) => {
        // Keep focus off toolbar button so Space / Enter remain pure combat keys.
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        setPanelOpen((v) => !v);
      }}
      title={copy.popTitle}
      aria-label={copy.popTitle}
      aria-expanded={panelOpen}
    >
      <ApexArenaCrestIcon
        themeId={snap.theme?.id}
        size={13}
        color={snap.theme?.accent || '#f0a642'}
      />
      {!iconOnly && <span className="ab-config-text">{snap.theme?.short || 'FOUNDRY'}</span>}
      <span className="ab-config-chevron" aria-hidden="true">
        {panelOpen ? <ChevronDown size={12} strokeWidth={2.6} /> : <ChevronUp size={12} strokeWidth={2.6} />}
      </span>
    </button>
  );

  return (
    <div
      className="apex-beyond-hud"
      data-layout-kind={slots.kind}
      data-apex-no-localize=""
      aria-label="APEX Beyond Tactical HUD Rails"
    >
      {/* Side-Rail Docked Arena Event Readout (Desktop / Landscape — strictly outside #arena) */}
      {snap.event && slots.event && !panelOpen && (
        <div
          className={`ab-event-banner ${snap.event.phase === 'TELEGRAPH' ? 'is-telegraph' : ''} ${slots.event.compact ? 'is-compact' : ''}`}
          style={{
            left: `${slots.event.left}px`,
            top: `${slots.event.top}px`,
            width: `${slots.event.width}px`,
            borderColor: snap.event.color,
            '--ab-ev-color': snap.event.color,
          }}
        >
          <span
            className="ab-event-badge"
            style={{ color: snap.event.color, borderColor: snap.event.color }}
            aria-hidden="true"
          >
            <Activity size={12} strokeWidth={2.5} />
          </span>
          <div className="ab-event-copy">
            <span className="ab-event-title">
              {snap.event.phase === 'TELEGRAPH' ? `${copy.incoming} · ${snap.event.label}` : snap.event.label}
            </span>
            {!slots.event.compact && <span className="ab-event-sub">{snap.event.sub}</span>}
          </div>
          <span className="ab-event-timer" style={{ color: snap.event.color }}>
            {snap.event.remaining.toFixed(1)}s
          </span>
        </div>
      )}

      {/* Side-Rails Composition (Desktop & Landscape): P1 in #p1Side, P2/Stage in #p2Side */}
      {slots.kind === 'side-rails' && slots.p1 && (
        <div
          className={`ab-pod is-p1 ${slots.p1.compact ? 'is-compact' : ''}`}
          style={{
            left: `${slots.p1.left}px`,
            top: `${slots.p1.top}px`,
            width: `${slots.p1.width}px`,
            height: `${slots.p1.height}px`,
          }}
        >
          {renderP1Trigger(slots.p1.compact)}
          {renderOdMeter(0, slots.p1.compact)}
        </div>
      )}

      {slots.kind === 'side-rails' && slots.p2 && (
        <div
          className={`ab-pod is-p2 ${slots.p2.stacked ? 'is-stacked' : ''} ${slots.p2.compact ? 'is-compact' : ''}`}
          style={{
            left: `${slots.p2.left}px`,
            top: `${slots.p2.top}px`,
            width: `${slots.p2.width}px`,
            height: `${slots.p2.height}px`,
          }}
        >
          {isLocal ? (
            <>
              {renderStageBtn(true)}
              {renderOdMeter(1, true)}
              {renderP2Trigger(slots.p2.compact || slots.p2.width < 300)}
            </>
          ) : (
            <>
              {renderOdMeter(1, slots.p2.compact)}
              {renderStageBtn(false)}
            </>
          )}
        </div>
      )}

      {/* Portrait 1P Unified Bottom Rail inside #p1Side (strictly below #arena) */}
      {slots.kind === 'port-1p' && slots.portBar && (
        <div
          className={`ab-port-bar ${slots.portBar.compact ? 'is-compact' : ''}`}
          style={{
            left: `${slots.portBar.left}px`,
            top: `${slots.portBar.top}px`,
            width: `${slots.portBar.width}px`,
            height: `${slots.portBar.height}px`,
          }}
        >
          {renderP1Trigger(true)}
          {renderOdMeter(0, true)}
          {snap.event ? (
            <span className="ab-inline-event" style={{ color: snap.event.color, borderColor: snap.event.color }}>
              <Activity size={11} strokeWidth={2.5} />
              <b>{snap.event.remaining.toFixed(0)}s</b>
            </span>
          ) : (
            !slots.portBar.compact && renderOdMeter(1, true)
          )}
          {renderStageBtn(slots.portBar.compact)}
        </div>
      )}

      {/* Portrait 2P Dual Face-to-Face Side Rails (strictly outside #arena) */}
      {slots.kind === 'port-2p' && slots.p1 && (
        <div
          className="ab-pod is-p1 is-compact"
          style={{
            left: `${slots.p1.left}px`,
            top: `${slots.p1.top}px`,
            width: `${slots.p1.width}px`,
            height: `${slots.p1.height}px`,
          }}
        >
          {renderP1Trigger(true)}
          {renderOdMeter(0, true)}
          {renderStageBtn(true)}
        </div>
      )}

      {slots.kind === 'port-2p' && slots.p2 && (
        <div
          className="ab-pod is-p2 is-compact is-flipped"
          style={{
            left: `${slots.p2.left}px`,
            top: `${slots.p2.top}px`,
            width: `${slots.p2.width}px`,
            height: `${slots.p2.height}px`,
          }}
        >
          {renderP2Trigger(true)}
          {renderOdMeter(1, true)}
        </div>
      )}

      {/* Tap-outside dismiss backdrop + Side-Rail Anchored Stage & Modifier Drawer */}
      {panelOpen && slots.popover && (
        <>
          <div
            className="ab-pop-backdrop"
            onPointerDown={(e) => {
              e.stopPropagation();
              setPanelOpen(false);
            }}
            aria-hidden="true"
          />
          <div
            className={`ab-popover ${slots.popover.compact ? 'is-compact' : ''}`}
            role="dialog"
            aria-label={copy.popTitle}
            style={{
              left: `${slots.popover.left}px`,
              bottom: `${slots.popover.top}px`,
              width: `${slots.popover.width}px`,
              maxHeight: `${slots.popover.height}px`,
            }}
          >
            <div className="ab-pop-head">
              <span className="ab-pop-title">
                <SlidersHorizontal size={13} strokeWidth={2.4} />
                <span>{copy.popTitle}</span>
              </span>
              <button
                type="button"
                className="ab-pop-close"
                onClick={() => setPanelOpen(false)}
                aria-label={copy.close}
              >
                <X size={15} strokeWidth={2.5} />
              </button>
            </div>

            <div className="ab-pop-row">
              <span className="ab-pop-label">{copy.arenaStage}</span>
              <div className="ab-seg-grid ab-arena-grid">
                {(snap.themes || []).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`ab-seg-btn ${snap.theme?.id === t.id ? 'is-active' : ''}`}
                    onClick={() => selectTheme(t.id)}
                  >
                    <ApexArenaCrestIcon themeId={t.id} size={12} color={t.accent} />
                    <span>{t.short}</span>
                  </button>
                ))}
              </div>
            </div>

            {!isLocal && (
              <div className="ab-pop-row">
                <span className="ab-pop-label">{copy.botIntel}</span>
                <div className="ab-seg-grid cols-3">
                  {['ROOKIE', 'VETERAN', 'APEX'].map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      className={`ab-seg-btn ${snap.settings.botTier === tier ? 'is-active' : ''}`}
                      onClick={() => updateSetting({ botTier: tier })}
                    >
                      {copy.tiers[tier] || tier}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="ab-pop-row">
              <span className="ab-pop-label">{copy.modifiers}</span>
              <div className="ab-seg-grid cols-3">
                <button
                  type="button"
                  className={`ab-seg-btn ${snap.settings.arenaEvents ? 'is-active' : ''}`}
                  onClick={() => updateSetting({ arenaEvents: !snap.settings.arenaEvents })}
                >
                  {snap.settings.arenaEvents ? copy.eventsOn : copy.eventsOff}
                </button>
                <button
                  type="button"
                  className={`ab-seg-btn ${snap.settings.hyperChaos ? 'is-active' : ''}`}
                  onClick={() => updateSetting({ hyperChaos: !snap.settings.hyperChaos })}
                >
                  {snap.settings.hyperChaos ? copy.hyper : copy.stdPace}
                </button>
                <button
                  type="button"
                  className={`ab-seg-btn ${snap.settings.cameraDirector ? 'is-active' : ''}`}
                  onClick={() => updateSetting({ cameraDirector: !snap.settings.cameraDirector })}
                >
                  {snap.settings.cameraDirector ? copy.camDyn : copy.camLock}
                </button>
              </div>
            </div>

            <div className="ab-stat-strip">
              <span>
                <Shield size={11} strokeWidth={2.3} /> {copy.deflects}: <b>{p1.deflects || 0}</b>
              </span>
              <span>
                <Swords size={11} strokeWidth={2.3} /> {copy.clashes}: <b>{(p1.clashesWon || 0) + (p2.clashesWon || 0)}</b>
              </span>
              <span>
                <Target size={11} strokeWidth={2.3} /> {copy.slams}: <b>{(p1.wallSlams || 0) + (p2.wallSlams || 0)}</b>
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
