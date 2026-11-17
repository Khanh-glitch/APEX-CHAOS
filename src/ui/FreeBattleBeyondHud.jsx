import React, { useEffect, useRef, useState } from 'react';
import { GraphicsControls } from './GraphicsSettings.jsx';
import { useGameLanguage } from './useGraphics.js';
import './freeBattleBeyondHud.css';

const CIRC = 2 * Math.PI * 10;

export default function FreeBattleBeyondHud() {
  const [snap, setSnap] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [arenaRect, setArenaRect] = useState(null);
  const vi = useGameLanguage();
  const panelRef = useRef(null), configRef = useRef(null);
  const touch = window.matchMedia?.('(pointer: coarse)').matches;

  useEffect(() => {
    let timer = 0, owner = null;
    const measure = () => {
      if (!owner) return;
      const r = owner.getBoundingClientRect();
      if (r.width <= 40 || r.height <= 40) return;
      const next = { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
      setArenaRect(prev => prev && Object.keys(next).every(k => prev[k] === next[k]) ? prev : next);
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    const poll = () => {
      if (document.hidden) return;
      const combat = window.APEX_BEYOND_COMBAT;
      const next = combat?.getHudSnapshot?.();
      if (!next?.active || next.over) {
        setSnap(prev => prev ? null : prev);
        setPanelOpen(false);
        observer?.disconnect(); owner = null;
        timer = setTimeout(poll, 400);
        return;
      }
      // Gold moves the canvas to #battleHudHost #arena. Use actual viewport
      // geometry so the tactical dock cannot cover P1/P2 side panels.
      const goldArena = document.querySelector('#battleHudHost.is-open #arena');
      const activeCanvas = document.getElementById('game-canvas');
      const nextOwner = goldArena?.contains(activeCanvas) ? goldArena : activeCanvas;
      if (owner !== nextOwner) {
        observer?.disconnect(); owner = nextOwner;
        if (owner) observer?.observe(owner);
        measure();
      }
      setSnap(next);
      timer = setTimeout(poll, window.APEX_GRAPHICS?.getSnapshot?.().profile.hudMs || 80);
    };
    const visibility = () => { clearTimeout(timer); if (!document.hidden) { measure(); poll(); } };
    poll();
    window.addEventListener('resize', measure, { passive: true });
    window.visualViewport?.addEventListener('resize', measure, { passive: true });
    window.visualViewport?.addEventListener('scroll', measure, { passive: true });
    document.addEventListener('visibilitychange', visibility);
    return () => { clearTimeout(timer); observer?.disconnect(); window.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('scroll', measure); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  useEffect(() => {
    if (!panelOpen) return;
    panelRef.current?.querySelector('button')?.focus();
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setPanelOpen(false); configRef.current?.focus(); } };
    const outside = e => { if (!panelRef.current?.contains(e.target) && !configRef.current?.contains(e.target)) setPanelOpen(false); };
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', outside, true);
    return () => { document.removeEventListener('keydown', key, true); document.removeEventListener('pointerdown', outside, true); };
  }, [panelOpen]);

  if (!snap || !snap.active || snap.over) return null;

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

  return (
    <div className={`apex-beyond-hud ${arenaRect ? 'ab-arena-anchored' : ''} ${arenaRect?.width < 380 ? 'ab-compact' : ''} ${arenaRect?.width < 240 ? 'ab-mini' : ''}`}
      style={arenaRect ? {
        '--ab-arena-left': `${arenaRect.x}px`,
        '--ab-arena-top': `${arenaRect.y}px`,
        '--ab-arena-width': `${arenaRect.width}px`,
        '--ab-arena-height': `${arenaRect.height}px`,
        '--ab-arena-bottom': `${arenaRect.y + arenaRect.height}px`,
        '--ab-arena-center': `${arenaRect.x + arenaRect.width / 2}px`
      } : undefined}
      aria-label="APEX Beyond Free Battle Tactical HUD">
      {/* Live Mid-Match Arena Event Telegraph / Active Strip */}
      {snap.event && (
        <div
          className={`ab-event-banner ${snap.event.phase === 'TELEGRAPH' ? 'is-telegraph' : ''}`}
          style={{ borderColor: snap.event.color }}
        >
          <span className="ab-event-dot" style={{ background: snap.event.color, color: snap.event.color }} />
          <div className="ab-event-copy">
            <span className="ab-event-title">
              {snap.event.phase === 'TELEGRAPH' ? `INCOMING · ${snap.event.label}` : snap.event.label}
            </span>
            <span className="ab-event-sub">{snap.event.sub}</span>
          </div>
          <span className="ab-event-timer" style={{ color: snap.event.color }}>
            {snap.event.remaining.toFixed(1)}s
          </span>
        </div>
      )}

      {/* Subtle First-Match Tactical Micro-Guide (auto-hides once used or after 10s) */}
      {snap.showHint && !panelOpen && !snap.event && arenaRect?.width >= 300 && (
        <div className="ab-hint-strip" data-apex-no-localize>
          {touch ? (vi ? 'Chạm ⚡ để xung lực · Chạm thẻ kỹ năng để ra chiêu' : 'Tap ⚡ to impulse · Tap skill cards to cast') : (vi ? 'SPACE: Xung lực · WASD: Hướng · J / K: Kỹ năng' : 'SPACE: Impulse · WASD: Aim · J / K: Skills')}
        </div>
      )}

      {/* Compact Upward Arena & Tactical Config Popover */}
      {panelOpen && (
        <div ref={panelRef} id="ab-arena-options" className="ab-popover" role="dialog" aria-label="Total Evolution Arena Options" onKeyDown={e => e.stopPropagation()}>
          <div className="ab-pop-head">
            <span className="ab-pop-title">TOTAL EVOLUTION · ARENA CONTROL</span>
            <button type="button" className="ab-pop-close" onClick={() => { setPanelOpen(false); configRef.current?.focus(); }} aria-label="Close">✕</button>
          </div>

          <div className="ab-pop-row">
            <span className="ab-pop-label">ARENA STAGE (LIVE SWITCH)</span>
            <div className="ab-seg-grid ab-arena-grid">
              {(snap.themes || []).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`ab-seg-btn ${snap.theme?.id === t.id ? 'is-active' : ''}`}
                  aria-pressed={snap.theme?.id === t.id}
                  onClick={() => selectTheme(t.id)}
                >
                  <span className="ab-swatch" style={{ background: t.accent, color: t.accent }} />
                  {t.short}
                </button>
              ))}
            </div>
          </div>

          {!isLocal && (
            <div className="ab-pop-row">
              <span className="ab-pop-label">ADAPTIVE BOT INTELLIGENCE</span>
              <div className="ab-seg-grid cols-3">
                {['ROOKIE', 'VETERAN', 'APEX'].map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    className={`ab-seg-btn ${snap.settings.botTier === tier ? 'is-active' : ''}`}
                    aria-pressed={snap.settings.botTier === tier}
                    onClick={() => updateSetting({ botTier: tier })}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="ab-pop-row">
            <span className="ab-pop-label">COMBAT MODIFIERS</span>
            <div className="ab-seg-grid cols-3">
              <button
                type="button"
                className={`ab-seg-btn ${snap.settings.arenaEvents ? 'is-active' : ''}`}
                onClick={() => updateSetting({ arenaEvents: !snap.settings.arenaEvents })}
              >
                EVENTS {snap.settings.arenaEvents ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                className={`ab-seg-btn ${snap.settings.hyperChaos ? 'is-active' : ''}`}
                onClick={() => updateSetting({ hyperChaos: !snap.settings.hyperChaos })}
              >
                {snap.settings.hyperChaos ? 'HYPER' : 'STD PACE'}
              </button>
              <button
                type="button"
                className={`ab-seg-btn ${snap.settings.cameraDirector ? 'is-active' : ''}`}
                onClick={() => updateSetting({ cameraDirector: !snap.settings.cameraDirector })}
              >
                CAM {snap.settings.cameraDirector ? 'DYN' : 'LOCK'}
              </button>
            </div>
          </div>

          <GraphicsControls />
          <div className="ab-stat-strip">
            <span>P1 DEFLECTS: <b>{p1.deflects || 0}</b></span>
            <span>CLASHES: <b>{(p1.clashesWon || 0) + (p2.clashesWon || 0)}</b></span>
            <span>WALL SLAMS: <b>{(p1.wallSlams || 0) + (p2.wallSlams || 0)}</b></span>
          </div>
        </div>
      )}

      {/* Slim Bottom Tactical Control Dock */}
      <div className="ab-dock">
        {/* P1 Kinetic Impulse & Deflect Trigger */}
        <button
          type="button"
          className={`ab-impulse-btn ${p1Ready ? 'is-ready' : ''} ${p1.deflectWindow > 0 ? 'is-deflect' : ''}`}
          onPointerDown={(e) => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); fireImpulse(0); }}
          onKeyDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); if (e.detail === 0) fireImpulse(0); }}
          aria-label={vi ? 'P1: Xung lực và phản đòn' : 'P1: Impulse and deflect'}
          title="Kinetic Impulse & Perfect Deflect (Space / Shift / Tap Arena)"
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
            <span className="ab-ring-icon">⚡</span>
          </span>
          <span className="ab-btn-copy">
            <span className="ab-btn-label">{p1.deflectWindow > 0 ? 'DEFLECT!' : 'IMPULSE'}</span>
            <span className="ab-btn-key">SPACE · TAP</span>
          </span>
        </button>

        {/* P1 & P2 Overdrive Momentum Gauges */}
        <div className="ab-od-group">
          <div className={`ab-od-meter ${p1OdActive ? 'is-active' : ''}`}>
            <div className="ab-od-head">
              <span>{p1OdActive ? 'OVERDRIVE' : 'P1 OD'}</span>
              <span>{p1OdActive ? `${p1.overdriveTimer.toFixed(1)}s` : `${Math.round(p1.overdrive || 0)}%`}</span>
            </div>
            <div className="ab-od-track">
              <div className="ab-od-bar" style={{ transform: `scaleX(${p1OdFill})` }} />
            </div>
          </div>

          <button
            ref={configRef}
            type="button"
            className="ab-config-btn"
            aria-expanded={panelOpen}
            aria-controls="ab-arena-options"
            aria-label={vi ? 'Tùy chỉnh đấu trường và đồ họa' : 'Arena and graphics settings'}
            onClick={() => setPanelOpen((v) => !v)}
            title="Switch Arena Stage, BOT Difficulty & Combat Modifiers"
          >
            <span className="ab-swatch" style={{ background: snap.theme?.accent || '#f0a642', color: snap.theme?.accent || '#f0a642' }} />
            <span className="ab-theme-name">{snap.theme?.short || 'FOUNDRY'}</span>
            <span className="ab-settings-icon" aria-hidden="true">☷</span>
            <span style={{ opacity: 0.7 }}>{panelOpen ? '▾' : '▴'}</span>
          </button>

          <div className={`ab-od-meter is-p2 ${p2OdActive ? 'is-active' : ''}`}>
            <div className="ab-od-head">
              <span>{p2OdActive ? 'OVERDRIVE' : (isLocal ? 'P2 OD' : 'BOT OD')}</span>
              <span>{p2OdActive ? `${p2.overdriveTimer.toFixed(1)}s` : `${Math.round(p2.overdrive || 0)}%`}</span>
            </div>
            <div className="ab-od-track">
              <div className="ab-od-bar" style={{ transform: `scaleX(${p2OdFill})` }} />
            </div>
          </div>
        </div>

        {/* P2 Kinetic Impulse Trigger (Local 1v1 PvP) */}
        {isLocal && (
          <button
            type="button"
            className={`ab-impulse-btn is-p2 ${p2Ready ? 'is-ready' : ''} ${p2.deflectWindow > 0 ? 'is-deflect' : ''}`}
            onPointerDown={(e) => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); fireImpulse(1); }}
            onKeyDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); if (e.detail === 0) fireImpulse(1); }}
            aria-label={vi ? 'P2: Xung lực và phản đòn' : 'P2: Impulse and deflect'}
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
              <span className="ab-ring-icon">⚡</span>
            </span>
            <span className="ab-btn-copy">
              <span className="ab-btn-label">{p2.deflectWindow > 0 ? 'DEFLECT!' : 'P2 BURST'}</span>
              <span className="ab-btn-key">ENTER · 0</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
