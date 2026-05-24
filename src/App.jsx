import React, { useEffect, useRef } from 'react';

const once = { loaded: false };

function callApexGlobal(name) {
  window[name]?.();
}

export default function App() {
  const scriptRef = useRef(null);

  useEffect(() => {
    if (once.loaded) return undefined;

    const script = document.createElement('script');
    script.src = `/apexEngine.js?v=${Date.now()}`;
    script.async = false;
    script.onload = () => {
      const bridge = document.createElement('script');
      bridge.textContent = `
        try { window.goToMenu = goToMenu; } catch (error) {}
        try { window.goToSelect = goToSelect; } catch (error) {}
        try { window.goToTournament = goToTournament; } catch (error) {}
        try { window.resetTournament = resetTournament; } catch (error) {}
        try { window.startMatch = startMatch; } catch (error) {}
        try { window.startSoloMode = startSoloMode; } catch (error) {}
        try { window.goToSoloSelect = goToSoloSelect; } catch (error) {}
      `;
      document.body.appendChild(bridge);
    };
    document.body.appendChild(script);
    scriptRef.current = script;
    once.loaded = true;

    return () => {
      scriptRef.current = null;
    };
  }, []);

  return (
    <div id="game-wrapper">
      <canvas id="game-canvas" width="1000" height="1000" />

      <div id="countdown-overlay">
        <div className="count-num" id="countdown-num">3</div>
        <div className="count-sub" id="countdown-sub">TOURNAMENT MATCH</div>
      </div>

      <div className="ui-layer" id="hud" style={{ opacity: 0 }}>
        <div className="header">
          <div className="player-info p1-info">
            <div className="name" id="p1-name">P1</div>
            <div className="hp-bar-bg">
              <div className="hp-bar-fill" id="p1-hp" />
              <div className="hp-text" id="p1-hp-text">100.0 / 100</div>
            </div>
            <div className="rage-indicator" id="p1-rage">RAGE ACTIVE</div>
          </div>

          <div className="player-info p2-info">
            <div className="name" id="p2-name">P2</div>
            <div className="hp-bar-bg">
              <div className="hp-bar-fill" id="p2-hp" />
              <div className="hp-text" id="p2-hp-text">100.0 / 100</div>
            </div>
            <div className="rage-indicator" id="p2-rage">RAGE ACTIVE</div>
          </div>
        </div>
      </div>

      <div id="menu-screen" className="screen">
        <h1>APEX CHAOS</h1>
        <p>
          32 Fighters. Canonical Identity + Balance Merge.
          <br />
          Every matchup can explode. Arena 1000x1000.
        </p>
        <div className="menu-buttons">
          <button type="button" onClick={() => callApexGlobal('goToSelect')}>Play</button>
          <button type="button" onClick={() => callApexGlobal('goToTournament')}>GIAI DAU</button>
          <button type="button" onClick={() => callApexGlobal('goToSoloSelect')}>SOLO 1V1 LOCAL</button>
        </div>
      </div>

      <div id="select-screen" className="screen hidden">
        <div id="select-ui">
          <h2 id="select-title" style={{ color: '#7fd4ff' }}>SELECT PLAYER 1</h2>
          <div className="roster" id="roster-grid" />
          <button id="start-btn" className="hidden" type="button" onClick={() => callApexGlobal('startMatch')}>
            ENGAGE
          </button>
        </div>
      </div>

      <div id="tournament-screen" className="screen hidden">
        <div className="tournament-wrap">
          <div className="tournament-head">
            <div>
              <div className="tournament-title">GIAI DAU</div>
              <div className="tournament-sub">
                Giai dau 2 nhanh tuong tac. Cap co the choi luon nam o khu CAP SAN SANG;
                bracket ben duoi chi dung de theo doi nhanh.
              </div>
            </div>
            <button type="button" onClick={() => callApexGlobal('resetTournament')}>Xep lai giai</button>
          </div>
          <div id="tournament-board" className="tournament-board" />
          <div className="tournament-footer">
            <button type="button" onClick={() => callApexGlobal('goToMenu')}>Ve Menu</button>
            <button type="button" onClick={() => callApexGlobal('goToSelect')}>Chon dau thuong</button>
          </div>
        </div>
      </div>

      <div id="end-screen" className="screen hidden">
        <h1 id="winner-text">WINNER</h1>
        <div id="stats-panel" className="stats-panel" />
        <div id="end-actions" style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => callApexGlobal('goToSelect')}>Rematch</button>
          <button id="tournament-return-btn" className="hidden" type="button" onClick={() => callApexGlobal('goToTournament')}>
            Tiep tuc giai dau
          </button>
        </div>
      </div>

      <div id="solo-screen" className="screen hidden">
        <h1>SOLO 1V1 LOCAL</h1>
        <p className="solo-hint">
          Uses the same fighter roster, colors, speed profile, and signature skills as Play.
          Player-controlled local 1v1 with manual normal, skill, and rage inputs.
        </p>
        <h2 id="solo-title" style={{ color: '#7fd4ff', margin: '8px 0 4px' }}>P1 SELECT</h2>
        <div id="solo-roster" className="solo-roster" />
        <div className="solo-controls">
          <div className="solo-panel">
            <b>P1</b>
            <div className="control-row">
              <div className="key-cluster wasd">
                <span className="key key-up">W</span>
                <span className="key key-left">A</span>
                <span className="key key-down">S</span>
                <span className="key key-right">D</span>
              </div>
              <span className="control-label">MOVE</span>
            </div>
            <div className="control-row">
              <span className="key action-key">E</span>
              <span className="control-label">NORMAL</span>
              <span className="key action-key">R</span>
              <span className="control-label">SKILL</span>
              <span className="key action-key space-key">SPACE</span>
              <span className="control-label">RAGE</span>
            </div>
          </div>
          <div className="solo-panel">
            <b>P2</b>
            <div className="control-row">
              <div className="key-cluster arrows">
                <span className="key key-up">↑</span>
                <span className="key key-left">←</span>
                <span className="key key-down">↓</span>
                <span className="key key-right">→</span>
              </div>
              <span className="control-label">MOVE</span>
            </div>
            <div className="control-row">
              <span className="key action-key">1</span>
              <span className="control-label">NORMAL</span>
              <span className="key action-key">2</span>
              <span className="control-label">SKILL</span>
              <span className="key action-key">3</span>
              <span className="control-label">RAGE</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button id="solo-start-btn" className="hidden" type="button" onClick={() => callApexGlobal('startSoloMode')}>
            START SOLO
          </button>
          <button type="button" onClick={() => callApexGlobal('goToMenu')}>BACK</button>
        </div>
      </div>

      <div id="solo-hud" className="solo-hud">
        <div className="solo-hud-card">
          <b id="solo-p1-name">P1</b>
          <span id="solo-p1-state">READY</span>
          <div className="solo-mini-bar"><div id="solo-p1-hp" className="solo-mini-fill" /></div>
        </div>
        <div className="solo-hud-card" style={{ textAlign: 'right' }}>
          <b id="solo-p2-name">P2</b>
          <span id="solo-p2-state">READY</span>
          <div className="solo-mini-bar"><div id="solo-p2-hp" className="solo-mini-fill" /></div>
        </div>
      </div>
    </div>
  );
}
