import React, { useEffect, useState } from 'react';
import './freeBattleBeyondHud.css';

const CIRC = 2 * Math.PI * 10;

export default function FreeBattleBeyondHud() {
  const [snap, setSnap] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [arenaRect, setArenaRect] = useState(null);

  useEffect(() => {
    let rafId = 0;
    let lastPush = 0;

    const poll = (now) => {
      rafId = requestAnimationFrame(poll);
      if (now - lastPush < 55) return; // ~18Hz lightweight React HUD sync
      lastPush = now;
      // Gold moves the canvas to #battleHudHost #arena. Use actual viewport
      // geometry so the tactical dock cannot cover P1/P2 side panels.
      const goldArena = document.querySelector('#battleHudHost.is-open #arena');
      const activeCanvas = document.getElementById('game-canvas');
      const owner = goldArena?.contains(activeCanvas) ? goldArena : activeCanvas;
      if (owner) {
        const r = owner.getBoundingClientRect();
        if (r.width > 40 && r.height > 40) {
          const next = { x: Math.round(r.left), y: Math.round(r.top),
            width: Math.round(r.width), height: Math.round(r.height) };
          setArenaRect(prev => prev && Object.keys(next).every(k => prev[k] === next[k]) ? prev : next);
        }
      }
      const combat = window.APEX_BEYOND_COMBAT;
      if (!combat?.getHudSnapshot) {
        setSnap((prev) => (prev ? null : prev));
        return;
      }
      const next = combat.getHudSnapshot();
      if (!next || !next.active) {
        setSnap((prev) => (prev ? null : prev));
        setPanelOpen(false);
        return;
      }
      setSnap(next);
    };

    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, []);

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
    <div className={`apex-beyond-hud ${arenaRect ? 'ab-arena-anchored' : ''}`}
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
      {snap.showHint && !panelOpen && (
        <div className="ab-hint-strip">
          <b>SPACE</b> / <b>TAP ARENA</b>: IMPULSE + PERFECT DEFLECT · <b>WASD</b>: AIM BURST · <b>J / K</b>: SKILLS
        </div>
      )}

      {/* Compact Upward Arena & Tactical Config Popover */}
      {panelOpen && (
        <div className="ab-popover" role="dialog" aria-label="Total Evolution Arena Options">
          <div className="ab-pop-head">
            <span className="ab-pop-title">TOTAL EVOLUTION · ARENA CONTROL</span>
            <button type="button" className="ab-pop-close" onClick={() => setPanelOpen(false)} aria-label="Close">✕</button>
          </div>

          <div className="ab-pop-row">
            <span className="ab-pop-label">ARENA STAGE (LIVE SWITCH)</span>
            <div className="ab-seg-grid ab-arena-grid">
              {(snap.themes || []).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`ab-seg-btn ${snap.theme?.id === t.id ? 'is-active' : ''}`}
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
          onPointerDown={(e) => { e.stopPropagation(); fireImpulse(0); }}
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
            type="button"
            className="ab-config-btn"
            onClick={() => setPanelOpen((v) => !v)}
            title="Switch Arena Stage, BOT Difficulty & Combat Modifiers"
          >
            <span className="ab-swatch" style={{ background: snap.theme?.accent || '#f0a642', color: snap.theme?.accent || '#f0a642' }} />
            <span>{snap.theme?.short || 'FOUNDRY'}</span>
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
            onPointerDown={(e) => { e.stopPropagation(); fireImpulse(1); }}
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
