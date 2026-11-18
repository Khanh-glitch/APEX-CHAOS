import React, { useCallback, useEffect, useRef, useState } from 'react';
import './battlePauseOverlay.css';

const COPY = {
  eng: {
    triggerLabel: 'Pause match (Esc / P)',
    kicker: 'COMBAT CHANNEL // TACTICAL HOLD',
    title: 'PAUSED',
    modeBot: 'VS BOT · SOLO',
    modeLocal: 'LOCAL · 1 VS 1',
    modeQuest: 'QUEST 01 · STORY',
    resume: 'RESUME FIGHT',
    resumeSub: 'Return to live combat (Esc)',
    rematch: 'INSTANT REMATCH',
    rematchSub: 'Restart round with current fighters',
    leave: 'LEAVE MATCH',
    leaveSubBot: 'Return to Fighter Select',
    leaveSubQuest: 'Return to Home',
    confirmPrompt: 'TAP AGAIN TO CONFIRM',
    confirmRematch: 'Current round progress will reset.',
    confirmLeave: 'Current match will end without rewards.',
    settingsHead: 'FIELD SETTINGS',
    graphics: 'GRAPHICS',
    auto: 'AUTO',
    high: 'HIGH',
    bal: 'BAL',
    low: 'LOW',
    audio: 'AUDIO',
    music: 'MUSIC',
    sfx: 'SFX',
    on: 'ON',
    off: 'OFF',
    language: 'LANGUAGE',
    controlsHead: 'CONTROLS',
    p1Controls: 'P1: J / K Skills · SPACE Impulse · WASD Aim',
    p2Controls: 'P2: NUM 1 / 2 Skills · ENTER Impulse · ↑↓←→ Aim',
    touchControls: 'TOUCH: Tap Skill Cards · Tap Arena for Impulse',
  },
  vie: {
    triggerLabel: 'Tạm dừng trận đấu (Esc / P)',
    kicker: 'KÊNH GIAO TRANH // TẠM GIỮ',
    title: 'TẠM DỪNG',
    modeBot: 'ĐẤU BOT · ĐƠN',
    modeLocal: 'ĐỐI KHÁNG · 1 VS 1',
    modeQuest: 'NHIỆM VỤ 01 · CỐT TRUYỆN',
    resume: 'TIẾP TỤC CHIẾN ĐẤU',
    resumeSub: 'Quay lại sàn đấu ngay (Esc)',
    rematch: 'ĐẤU LẠI NGAY',
    rematchSub: 'Bắt đầu lại với cặp tướng hiện tại',
    leave: 'RỜI TRẬN ĐẤU',
    leaveSubBot: 'Quay về màn hình Chọn Tướng',
    leaveSubQuest: 'Quay về Màn hình Chính',
    confirmPrompt: 'NHẤN LẦN NỮA ĐỂ XÁC NHẬN',
    confirmRematch: 'Tiến độ hiệp hiện tại sẽ được đặt lại.',
    confirmLeave: 'Trận đấu hiện tại sẽ kết thúc và không tính thưởng.',
    settingsHead: 'CÀI ĐẶT NHANH',
    graphics: 'ĐỒ HỌA',
    auto: 'AUTO',
    high: 'CAO',
    bal: 'CÂN',
    low: 'THẤP',
    audio: 'ÂM THANH',
    music: 'NHẠC',
    sfx: 'SFX',
    on: 'BẬT',
    off: 'TẮT',
    language: 'NGÔN NGỮ',
    controlsHead: 'ĐIỀU KHIỂN',
    p1Controls: 'P1: J / K Kỹ năng · SPACE Xung lực · WASD Hướng',
    p2Controls: 'P2: NUM 1 / 2 Kỹ năng · ENTER Xung lực · ↑↓←→ Hướng',
    touchControls: 'CẢM ỨNG: Chạm thẻ Kỹ năng · Chạm sân để Xung lực',
  },
};

function readSettings() {
  try {
    const s = window.APEX_SETTINGS?.get?.();
    if (s) return s;
  } catch { /* fallback */ }
  const lang = window.APEX_I18N?.getLanguage?.() === 'vie' ? 'vie' : 'eng';
  const gfxMode = window.APEX_GFX_QUALITY?.getMode?.() || 'auto';
  const gfxEffective = window.APEX_GFX_QUALITY?.getEffective?.() || 'ultra';
  return { gfxMode, gfxEffective, musicMuted: false, sfxMuted: false, reducedMotion: false, language: lang };
}

function visibleRect(selector) {
  try {
    const el = document.querySelector(selector);
    if (!el) return null;
    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return null;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2 ? r : null;
  } catch {
    return null;
  }
}

function rectsOverlap(a, b, pad = 2) {
  if (!a || !b) return false;
  return (a.left - pad) < b.right
    && (a.right + pad) > b.left
    && (a.top - pad) < b.bottom
    && (a.bottom + pad) > b.top;
}

// Compute a valid HUD-rail slot for the pause trigger with strictly ZERO overlap
// against #arena (the live combat square) and primary HUD readouts/skill tiles.
function computePauseRailSlot() {
  const hud = document.querySelector('#battleHudHost.is-open #hud');
  const arena = visibleRect('#battleHudHost.is-open #arena') || visibleRect('#game-canvas');
  if (!arena || arena.width < 80 || arena.height < 80) return null;

  const vw = window.innerWidth || document.documentElement.clientWidth || 1280;
  const vh = window.innerHeight || document.documentElement.clientHeight || 720;
  const BTN = 34;
  const layout = hud?.dataset?.layout || (vh > vw ? 'port' : vw >= 1180 ? 'desk' : 'land');
  const mode = hud?.dataset?.mode || '1p';
  const isQuest = hud?.dataset?.quest === '1';
  const beyondActive = Boolean(document.body?.classList?.contains('apex-beyond-live'));

  const p1Side = visibleRect('#battleHudHost.is-open #p1Side');
  const p1Ident = visibleRect('#battleHudHost.is-open #p1Side .ident');
  const p1Skills = visibleRect('#battleHudHost.is-open #p1Side .skills');
  const p1Weapon = visibleRect('#battleHudHost.is-open #p1Side .weapon');
  const p2Side = visibleRect('#battleHudHost.is-open #p2Side');
  const p2Ident = visibleRect('#battleHudHost.is-open #p2Side .ident');
  const p2Skills = visibleRect('#battleHudHost.is-open #p2Side .skills');
  const p2Weapon = visibleRect('#battleHudHost.is-open #p2Side .weapon');
  const rail = visibleRect('#battleHudHost.is-open #versusRail');
  const mc = visibleRect('#battleHudHost.is-open #matchCenter');
  const p2Pod = visibleRect('.apex-beyond-hud .ab-pod.is-p2');

  const candidates = [];
  const push = (left, top, blockers) => {
    const l = Math.round(left);
    const t = Math.round(top);
    const box = { left: l, top: t, right: l + BTN, bottom: t + BTN };
    if (box.left < 4 || box.top < 4 || box.right > vw - 4 || box.bottom > vh - 4) return;
    // Hard invariant: NEVER overlap the live battle arena.
    if (rectsOverlap(box, arena, 4)) return;
    for (const blk of blockers) {
      if (blk && rectsOverlap(box, blk, 2)) return;
    }
    candidates.push({ top: t, left: l });
  };

  if (layout === 'port') {
    if (mode === '2p' && rail) {
      // Portrait 2P moves HP rails into each player's side; versusRail right wing is open.
      push(rail.right - BTN, rail.top + (rail.height - BTN) * 0.5, [mc, p1Side, p2Side]);
    }
    if (mode === '1p' && p1Side) {
      if (beyondActive) {
        // Shares the right end of #p1Side's dedicated bottom tactical dock (reserved 40px slot).
        push(p1Side.right - BTN, p1Side.bottom - BTN - 2, [p1Skills, p1Ident, p1Weapon, rail]);
      }
      if (p1Skills && p1Side.bottom - p1Skills.bottom >= BTN + 4) {
        push(p1Side.right - BTN, p1Skills.bottom + 4, [p1Ident, p1Weapon, rail]);
      }
      if (isQuest && p1Ident) {
        push(p1Side.right - BTN, p1Ident.top + (p1Ident.height - BTN) * 0.5, [p1Skills, p1Weapon, rail]);
      }
    }
  } else if (p2Side) {
    // Desktop & Landscape: dock cleanly in #p2Side utility space outside #arena.
    const commonBlockers = [rail, mc, p2Ident, p2Skills, p2Weapon, p2Pod];
    if (p2Ident && (!p2Skills || p2Skills.top - p2Ident.bottom >= BTN + 10)) {
      push(p2Side.right - BTN, p2Ident.bottom + 8, commonBlockers);
    }
    if (p2Skills && (!p2Weapon || p2Weapon.top - p2Skills.bottom >= BTN + 10)) {
      push(p2Side.right - BTN, p2Skills.bottom + 8, commonBlockers);
    }
    // Wide-screen outer gutter of #p2Side (when .ident is narrower than #p2Side)
    if (p2Ident && p2Side.right - p2Ident.right >= BTN + 8) {
      push(p2Side.right - BTN, p2Side.top + 6, commonBlockers);
    }
    // Landscape 2P: #p2Side is RTL so portrait+name hug the right edge; inner-left of ident row is open.
    if (p2Ident && p2Side.width >= 150) {
      const p2Por = visibleRect('#battleHudHost.is-open #p2Side .portrait');
      push(p2Side.left + 2, p2Ident.top + Math.max(0, (p2Ident.height - BTN) * 0.5), [rail, mc, p2Por, p2Skills, p2Weapon, p2Pod]);
    }
  }

  return candidates[0] || null;
}

function isLivePausableBattle() {
  try {
    // BOT WAVE owns its own dedicated Ring Command pause sheet inside #apex-wave-host.
    if (document.getElementById('apex-wave-host')) return false;
    if (document.getElementById('apex-real-match-result')) return false;
    if (document.body?.classList?.contains('battle-result')) return false;
    if (document.body?.classList?.contains('battle-transition-active')) return false;
    // Yield Escape/pause while a Quest 01 narrative modal is open.
    if (document.querySelector('[data-quest01-dialog="true"], .quest01-modal.is-open')) return false;
    const host = document.getElementById('battleHudHost');
    if (!host || !host.classList.contains('is-open') || host.classList.contains('is-transitioning') || host.classList.contains('is-preloading')) {
      return false;
    }
    const st = window.APEX_ARSENAL?.state;
    if (!st || !st.active || st.over) return false;
    return true;
  } catch {
    return false;
  }
}

function readMatchMeta() {
  try {
    const st = window.APEX_ARSENAL?.state || {};
    const quest = Boolean(st.questMultiActor || st.questStage || st.questBreachEncounter || document.querySelector('#battleHudHost #hud[data-quest="1"]'));
    const modeRaw = String(st.battleMode || '').toUpperCase();
    const mode = quest ? 'quest' : (modeRaw === 'BOT' ? 'bot' : 'local');
    const p1Name = document.querySelector('#battleHudHost #p1Side .id-name')?.textContent?.trim()
      || window.fighters?.[0]?.displayName
      || window.fighters?.[0]?.name
      || 'P1';
    const p2Name = document.querySelector('#battleHudHost #p2Side .id-name')?.textContent?.trim()
      || window.fighters?.[1]?.displayName
      || window.fighters?.[1]?.name
      || (mode === 'bot' ? 'BOT' : 'P2');
    const clock = document.querySelector('#battleHudHost #matchCenter .mc-time, #battleHudHost .mc-clock')?.textContent?.trim() || '';
    return { mode, quest, canRematch: !quest && !st.labMode, p1Name, p2Name, clock };
  } catch {
    return { mode: 'bot', quest: false, canRematch: true, p1Name: 'P1', p2Name: 'BOT', clock: '' };
  }
}

function playUi(key) {
  try { window.apexUiSfx?.play?.(key); } catch { /* optional */ }
}

export default function BattlePauseOverlay() {
  const [eligible, setEligible] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [settings, setSettings] = useState(readSettings);
  const [meta, setMeta] = useState(readMatchMeta);
  const [anchorPos, setAnchorPos] = useState(null);

  const openRef = useRef(false);
  const confirmTimerRef = useRef(0);
  const resumeBtnRef = useRef(null);
  const triggerBtnRef = useRef(null);

  const clearConfirm = useCallback(() => {
    if (confirmTimerRef.current) {
      window.clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = 0;
    }
    setConfirmAction(null);
  }, []);

  const applyEnginePause = useCallback((nextOpen, silent = false) => {
    const shouldPause = Boolean(nextOpen) && isLivePausableBattle();
    openRef.current = shouldPause;
    window.__apexBattlePaused = shouldPause;
    document.body?.classList?.toggle('apex-battle-paused', shouldPause);
    setOpen(shouldPause);
    clearConfirm();
    if (shouldPause) {
      setMeta(readMatchMeta());
      setSettings(readSettings());
      if (!silent) playUi('ui.button.press');
      try { window.APEX_GOLD_HUD?.setLive?.(false); } catch { /* ignore */ }
      try { window.postMessage({ type: 'APEX_CHAOS_BATTLE_PAUSE' }, window.location.origin); } catch { /* ignore */ }
    } else {
      if (!silent) playUi('ui.back.cancel');
      if (isLivePausableBattle()) {
        try { window.APEX_GOLD_HUD?.setLive?.(true); } catch { /* ignore */ }
        try { window.postMessage({ type: 'APEX_CHAOS_BATTLE_LIVE' }, window.location.origin); } catch { /* ignore */ }
      }
    }
    try {
      window.dispatchEvent(new CustomEvent('apex:battle-pause-changed', { detail: { paused: shouldPause } }));
    } catch { /* ignore */ }
    return shouldPause;
  }, [clearConfirm]);

  const syncAnchor = useCallback(() => {
    const next = computePauseRailSlot();
    if (!next) {
      setAnchorPos((prev) => (prev ? null : prev));
      return;
    }
    setAnchorPos((prev) => (prev && prev.top === next.top && prev.left === next.left ? prev : next));
  }, []);

  // Expose singleton authority for battle-hud.html, shell.html & keyboard shortcuts
  useEffect(() => {
    const api = Object.freeze({
      isOpen: () => openRef.current,
      canPause: isLivePausableBattle,
      open: () => applyEnginePause(true),
      close: (silent = false) => applyEnginePause(false, silent),
      toggle: () => applyEnginePause(!openRef.current),
    });
    window.APEX_BATTLE_PAUSE = api;
    return () => {
      window.__apexBattlePaused = false;
      document.body?.classList?.remove('apex-battle-paused');
      if (window.APEX_BATTLE_PAUSE === api) delete window.APEX_BATTLE_PAUSE;
    };
  }, [applyEnginePause]);

  // Track battle lifecycle & arena position with zero idle overhead outside combat
  useEffect(() => {
    let resizeObs = null;
    let observedArena = null;
    let checkTimer = 0;

    const refresh = () => {
      const ok = isLivePausableBattle();
      setEligible((prev) => (prev === ok ? prev : ok));
      if (!ok && openRef.current) {
        applyEnginePause(false, true);
      }
      if (ok) {
        const arena = document.querySelector('#battleHudHost.is-open #arena') || document.getElementById('game-canvas');
        if (arena !== observedArena) {
          if (resizeObs && observedArena) {
            try { resizeObs.unobserve(observedArena); } catch { /* ignore */ }
          }
          observedArena = arena || null;
          if (observedArena) {
            if (!resizeObs && typeof ResizeObserver !== 'undefined') {
              resizeObs = new ResizeObserver(syncAnchor);
            }
            resizeObs?.observe(observedArena);
          }
        }
        syncAnchor();
        if (!checkTimer) {
          checkTimer = window.setInterval(() => {
            if (!isLivePausableBattle()) refresh();
          }, 300);
        }
      } else {
        if (checkTimer) {
          window.clearInterval(checkTimer);
          checkTimer = 0;
        }
        if (resizeObs && observedArena) {
          try { resizeObs.unobserve(observedArena); } catch { /* ignore */ }
        }
        observedArena = null;
      }
    };

    const bodyObs = typeof MutationObserver !== 'undefined' && document.body
      ? new MutationObserver(refresh)
      : null;
    bodyObs?.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    const onExit = () => { applyEnginePause(false, true); setEligible(false); };
    const onSettings = () => setSettings(readSettings());
    const onVisibility = () => {
      // Auto-pause active solo/local battle if tab is hidden mid-fight
      if (document.hidden && isLivePausableBattle() && !openRef.current) {
        applyEnginePause(true, true);
      }
    };

    const onMatchCenterClick = (event) => {
      if (openRef.current || !isLivePausableBattle()) return;
      const mc = event.target?.closest?.('#battleHudHost.is-open #matchCenter');
      if (!mc) return;
      event.preventDefault();
      event.stopPropagation();
      applyEnginePause(true);
    };

    window.addEventListener('apex:gold-battle-exited', onExit);
    window.addEventListener('apex:gold-result-ready', onExit);
    window.addEventListener('apex:battle-result-changed', refresh);
    window.addEventListener('apex:beyond-state', refresh);
    window.addEventListener('apex:beyond-layout', syncAnchor);
    window.addEventListener('apex:settings-changed', onSettings);
    window.addEventListener('apex:language-changed', onSettings);
    window.addEventListener('resize', syncAnchor, { passive: true });
    document.addEventListener('click', onMatchCenterClick);
    document.addEventListener('visibilitychange', onVisibility);
    refresh();

    return () => {
      if (checkTimer) window.clearInterval(checkTimer);
      bodyObs?.disconnect();
      resizeObs?.disconnect();
      window.removeEventListener('apex:gold-battle-exited', onExit);
      window.removeEventListener('apex:gold-result-ready', onExit);
      window.removeEventListener('apex:battle-result-changed', refresh);
      window.removeEventListener('apex:beyond-state', refresh);
      window.removeEventListener('apex:beyond-layout', syncAnchor);
      window.removeEventListener('apex:settings-changed', onSettings);
      window.removeEventListener('apex:language-changed', onSettings);
      window.removeEventListener('resize', syncAnchor);
      document.removeEventListener('click', onMatchCenterClick);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [applyEnginePause, syncAnchor]);

  // Keyboard shortcut: P (IME-safe KeyP) toggles pause; Escape resumes when pause sheet is open
  useEffect(() => {
    const onKey = (event) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const tag = String(event.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (window.APEX_GOLD?.isResultOpen?.()) return;
      if (event.code === 'KeyP' || event.key === 'p' || event.key === 'P') {
        if (!isLivePausableBattle()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        applyEnginePause(!openRef.current);
      } else if (event.key === 'Escape' && openRef.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        applyEnginePause(false);
        try { document.activeElement?.blur?.(); } catch { /* ignore */ }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [applyEnginePause]);

  // Move focus cleanly into dialog on open
  useEffect(() => {
    if (open) {
      resumeBtnRef.current?.focus?.({ preventScroll: true });
    }
    return () => clearConfirm();
  }, [open, clearConfirm]);

  const armOrRun = (action, run) => {
    if (confirmAction !== action) {
      clearConfirm();
      setConfirmAction(action);
      playUi('ui.focus.move');
      confirmTimerRef.current = window.setTimeout(() => setConfirmAction(null), 3500);
      return;
    }
    clearConfirm();
    playUi('ui.option.confirm');
    run();
  };

  const handleRematch = () => {
    armOrRun('rematch', () => {
      applyEnginePause(false, true);
      if (typeof window.APEX_GOLD?.rematchBattle === 'function') {
        void window.APEX_GOLD.rematchBattle();
      }
    });
  };

  const handleLeave = () => {
    armOrRun('leave', () => {
      applyEnginePause(false, true);
      window.postMessage({ type: 'APEX_CHAOS_BATTLE_EXIT' }, window.location.origin);
    });
  };

  const updatePref = (patch) => {
    if (window.APEX_SETTINGS?.update) {
      setSettings(window.APEX_SETTINGS.update(patch));
    } else if (patch.gfxMode) {
      window.APEX_GFX_QUALITY?.setMode?.(patch.gfxMode);
      setSettings(readSettings());
    } else if (patch.language) {
      window.APEX_I18N?.setLanguage?.(patch.language);
      setSettings(readSettings());
    }
    playUi('ui.option.confirm');
  };

  if (!eligible) return null;

  const lang = settings.language === 'vie' ? 'vie' : 'eng';
  const t = COPY[lang];
  const modeLabel = meta.mode === 'quest' ? t.modeQuest : (meta.mode === 'local' ? t.modeLocal : t.modeBot);
  const effTag = { ultra: t.high, balanced: t.bal, off: t.low }[settings.gfxEffective] || t.high;

  return (
    <>
      {!open && anchorPos && (
        <button
          ref={triggerBtnRef}
          type="button"
          className="apex-battle-pause-btn"
          style={{ top: `${anchorPos.top}px`, left: `${anchorPos.left}px` }}
          onClick={(e) => { e.stopPropagation(); applyEnginePause(true); }}
          aria-label={t.triggerLabel}
          title={t.triggerLabel}
          data-apex-no-localize=""
        >
          <i aria-hidden="true" />
          <i aria-hidden="true" />
        </button>
      )}

      {open && (
        <div
          className="apex-battle-pause"
          role="dialog"
          aria-modal="true"
          aria-labelledby="apex-bp-title"
          data-apex-no-localize=""
          onClick={(e) => { if (e.target === e.currentTarget) applyEnginePause(false); }}
        >
          <section className="apex-bp-card">
            <header className="apex-bp-head">
              <div className="apex-bp-head-top">
                <span className="apex-bp-kicker">{t.kicker}</span>
                <span className="apex-bp-mode">{modeLabel}</span>
              </div>
              <h2 id="apex-bp-title" className="apex-bp-title">{t.title}</h2>
              <div className="apex-bp-matchup">
                <span className="is-p1">{meta.p1Name}</span>
                <em>VS</em>
                <span className="is-p2">{meta.p2Name}</span>
                {meta.clock ? <b className="apex-bp-clock">{meta.clock}</b> : null}
              </div>
            </header>

            <nav className="apex-bp-actions" aria-label={t.title}>
              <button
                ref={resumeBtnRef}
                type="button"
                className="apex-bp-act is-primary"
                onClick={() => applyEnginePause(false)}
              >
                <strong>{t.resume}</strong>
                <small>{t.resumeSub}</small>
              </button>

              {meta.canRematch && (
                <button
                  type="button"
                  className={`apex-bp-act ${confirmAction === 'rematch' ? 'is-confirming' : ''}`}
                  onClick={handleRematch}
                >
                  <strong>{confirmAction === 'rematch' ? t.confirmPrompt : t.rematch}</strong>
                  <small>{confirmAction === 'rematch' ? t.confirmRematch : t.rematchSub}</small>
                </button>
              )}

              <button
                type="button"
                className={`apex-bp-act is-danger ${confirmAction === 'leave' ? 'is-confirming' : ''}`}
                onClick={handleLeave}
              >
                <strong>{confirmAction === 'leave' ? t.confirmPrompt : t.leave}</strong>
                <small>
                  {confirmAction === 'leave'
                    ? t.confirmLeave
                    : (meta.quest ? t.leaveSubQuest : t.leaveSubBot)}
                </small>
              </button>
            </nav>

            <div className="apex-bp-settings">
              <div className="apex-bp-sec-head">{t.settingsHead}</div>

              <div className="apex-bp-row">
                <span className="apex-bp-label">
                  {t.graphics} {settings.gfxMode === 'auto' ? `(${effTag})` : ''}
                </span>
                <div className="apex-bp-seg cols-4">
                  {[
                    ['auto', t.auto],
                    ['ultra', t.high],
                    ['balanced', t.bal],
                    ['off', t.low],
                  ].map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={settings.gfxMode === mode ? 'is-active' : ''}
                      aria-pressed={settings.gfxMode === mode ? 'true' : 'false'}
                      onClick={() => updatePref({ gfxMode: mode })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="apex-bp-split">
                <div className="apex-bp-row">
                  <span className="apex-bp-label">{t.audio}</span>
                  <div className="apex-bp-seg cols-2">
                    <button
                      type="button"
                      className={!settings.musicMuted ? 'is-active' : ''}
                      aria-pressed={!settings.musicMuted ? 'true' : 'false'}
                      onClick={() => updatePref({ musicMuted: !settings.musicMuted })}
                    >
                      {t.music} {!settings.musicMuted ? t.on : t.off}
                    </button>
                    <button
                      type="button"
                      className={!settings.sfxMuted ? 'is-active' : ''}
                      aria-pressed={!settings.sfxMuted ? 'true' : 'false'}
                      onClick={() => updatePref({ sfxMuted: !settings.sfxMuted })}
                    >
                      {t.sfx} {!settings.sfxMuted ? t.on : t.off}
                    </button>
                  </div>
                </div>

                <div className="apex-bp-row">
                  <span className="apex-bp-label">{t.language}</span>
                  <div className="apex-bp-seg cols-2">
                    <button
                      type="button"
                      className={lang === 'eng' ? 'is-active' : ''}
                      aria-pressed={lang === 'eng' ? 'true' : 'false'}
                      onClick={() => updatePref({ language: 'eng' })}
                    >
                      ENG
                    </button>
                    <button
                      type="button"
                      className={lang === 'vie' ? 'is-active' : ''}
                      aria-pressed={lang === 'vie' ? 'true' : 'false'}
                      onClick={() => updatePref({ language: 'vie' })}
                    >
                      VIE
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <footer className="apex-bp-controls">
              <span className="apex-bp-sec-head">{t.controlsHead}</span>
              <p>{t.p1Controls}</p>
              {meta.mode === 'local' ? <p>{t.p2Controls}</p> : <p>{t.touchControls}</p>}
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
