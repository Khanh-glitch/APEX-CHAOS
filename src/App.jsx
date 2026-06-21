import React, { useEffect, useRef, useState } from 'react';

const once = { loaded: false };

const LOADING_ASSETS = {
  bgPortrait: '/assets/ui_2026/loading-bg-portrait.webp',
  bgLandscape: '/assets/ui_2026/loading-bg-landscape.webp',
  gameTitle: '/assets/ui_2026/game-name-icon.webp',
  loadingBarFrame: '/assets/loading/loading-bar-frame.webp',
};

const UI_2026_ASSETS = {
  menuBgLandscape: '/assets/ui_2026/menu-bg-landscape.webp',
  menuBgPortrait: '/assets/ui_2026/menu-bg-portrait.webp',
  menuVfxOverlay: '/assets/ui_2026/menu-vfx-overlay.webp',
  fighterPickBg: '/assets/ui_2026/fighter-pick-bg.webp',
  tabApexUpdate: '/assets/ui_2026/tab-apex-update.webp',
  tabFullRoster: '/assets/ui_2026/tab-full-roster.webp',
  p1SetupVfx: '/assets/ui_2026/p1-setup-vfx.webp',
  p2SetupVfx: '/assets/ui_2026/p2-setup-vfx.webp',
  fighterPickButton: '/assets/ui_2026/fighter-pick-button.webp',
  fightButton: '/assets/ui_2026/fight-button.webp',
  exitButton: '/assets/ui_2026/exit-button.webp',
  pickedIce: '/assets/ui_2026/picked-ice.webp',
  pickedString: '/assets/ui_2026/picked-string.webp',
  pickedGalaxy: '/assets/ui_2026/picked-galaxy.webp',
  pickedSoccer: '/assets/ui_2026/picked-soccer.webp',
  pickedNinja: '/assets/ui_2026/picked-ninja.webp',
  pickedEngineer: '/assets/ui_2026/picked-engineer.webp',
};

const MENU_AUDIO = '/assets/audio/menu_bgm.mp3';

const MENU_BUTTONS = [
  { id: 'play', label: 'Choi', asset: '/assets/ui_2026/menu-play.webp', action: 'goToSelect', primary: true },
  { id: 'tam-chien', label: '3-Phase Battle', asset: '/assets/ui_2026/menu-3phase.webp', action: 'startTamChienMode' },
  { id: 'trial', label: 'Test Battle With Saitama', asset: '/assets/ui_2026/menu-saitama-test.webp', action: 'goToTrialSelect' },
  { id: 'giai', label: 'Tournament', asset: '/assets/ui_2026/menu-tournament.webp', action: 'goToTournament' },
  { id: 'solo', label: 'Solo 1v1 Local', asset: '/assets/ui_2026/menu-solo.webp', action: 'goToSoloSelect' },
];

const LOADING_LABELS = ['LOADING ASSETS', 'PREPARING ARENA', 'SYNCHRONIZING VFX'];
const IMAGE_PRELOAD_TIMEOUT_MS = 7000;
const RUNTIME_READY_TIMEOUT_MS = 4500;
let preloadAudioContext = null;

function callApexGlobal(name, enabled = true) {
  if (!enabled) return;
  window[name]?.();
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function assetTypeFromPath(path) {
  const clean = path.split('?')[0].toLowerCase();
  if (/\.(png|jpe?g|webp|gif|svg|avif)$/.test(clean)) return 'image';
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/.test(clean)) return 'audio';
  if (/\.js$/.test(clean)) return 'script';
  if (/\.json$/.test(clean)) return 'data';
  return 'fetch';
}

async function preloadImage(path) {
  await new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const timeout = window.setTimeout(() => finish('timeout'), IMAGE_PRELOAD_TIMEOUT_MS);
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      img.onload = null;
      img.onerror = null;
      if (ok === 'timeout') console.warn(`[asset-loader] Timed out image asset: ${path}`);
      if (ok === false) console.warn(`[asset-loader] Failed image asset: ${path}`);
      resolve();
    };
    img.decoding = 'async';
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = path;
    if (img.complete) finish(img.naturalWidth > 0);
  });
}

async function preloadFetchAsset(path, type) {
  try {
    const response = await fetch(path, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    if (type === 'audio') {
      try {
        preloadAudioContext ||= new (window.AudioContext || window.webkitAudioContext)();
        await preloadAudioContext.decodeAudioData(buffer.slice(0));
      } catch (decodeError) {
        console.warn(`[asset-loader] Failed to decode audio asset: ${path}`, decodeError);
      }
    }
  } catch (error) {
    console.warn(`[asset-loader] Failed ${type} asset: ${path}`, error);
  }
}

let menuAudioWarmup = null;
function warmMenuAudio() {
  if (!menuAudioWarmup) menuAudioWarmup = preloadFetchAsset(MENU_AUDIO, 'audio');
  return menuAudioWarmup;
}

async function loadAssetManifest() {
  try {
    const response = await fetch(`/asset-manifest.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.warn('[asset-loader] Failed asset manifest; loading required overlay assets only.', error);
    return { assets: [] };
  }
}

function uniqueAssets(manifestAssets, engineSrc) {
  const assets = [
    ...manifestAssets,
    { path: engineSrc, type: 'script', required: true },
  ];
  const seen = new Set();
  return assets.filter((asset) => {
    const path = asset.path || asset.url;
    if (!path) return false;
    const dedupeKey = path.split('?')[0];
    if (dedupeKey === '/apexEngine.js' && path !== engineSrc) return false;
    if (seen.has(path)) return false;
    seen.add(path);
    asset.path = path;
    asset.type = asset.type || assetTypeFromPath(path);
    return true;
  });
}

function criticalBootAssets(engineSrc) {
  const portraitViewport = window.innerHeight > window.innerWidth || window.innerWidth <= 700;
  const primaryBackground = portraitViewport ? LOADING_ASSETS.bgPortrait : LOADING_ASSETS.bgLandscape;

  return [
    { path: primaryBackground, type: 'image', required: true },
    { path: LOADING_ASSETS.gameTitle, type: 'image', required: true },
    { path: MENU_AUDIO, type: 'audio', required: true },
    ...Object.values(UI_2026_ASSETS).map((path) => ({ path, type: 'image', required: true })),
    ...MENU_BUTTONS.filter((button) => button.asset).map((button) => ({ path: button.asset, type: 'image', required: true })),
  ];
}

function blockingBootAssets(manifestAssets, engineSrc) {
  return uniqueAssets([
    ...criticalBootAssets(engineSrc),
    ...Object.values(LOADING_ASSETS).map((path) => ({ path, type: 'image', required: true })),
  ], engineSrc);
}

async function preloadAssetList(assets, onProgress) {
  let loadedCount = 0;
  const totalCount = Math.max(assets.length, 1);
  let nextIndex = 0;
  const workerCount = Math.min(6, assets.length || 1);

  onProgress({ loadedCount, totalCount, percent: 0, label: LOADING_LABELS[0] });

  const loadOne = async (asset) => {
    const type = asset.type || assetTypeFromPath(asset.path);
    if (type === 'image') await preloadImage(asset.path);
    else await preloadFetchAsset(asset.path, type);
  };

  const tick = () => {
    loadedCount += 1;
    const ratio = loadedCount / totalCount;
    onProgress({
      loadedCount,
      totalCount,
      percent: Math.round(ratio * 100),
      label: LOADING_LABELS[Math.min(LOADING_LABELS.length - 1, Math.floor(ratio * LOADING_LABELS.length))],
    });
  };

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < assets.length) {
      const asset = assets[nextIndex];
      nextIndex += 1;
      await loadOne(asset);
      tick();
    }
  }));
}

async function preloadGameAssets(engineSrc, onProgress) {
  const manifest = await loadAssetManifest();
  const assets = blockingBootAssets(manifest?.assets, engineSrc);
  await preloadAssetList(assets, onProgress);

  return { totalCount: assets.length, loadedCount: assets.length, manifest };
}

async function waitForRuntimeAssetReadiness() {
  const expectedGalaxyAudio = [
    'throw',
    'explosion',
    'pressureWalk',
    'pressureContact',
    'wall',
    'divine',
    'impact',
    'rage',
    'bluehole',
  ];
  const start = performance.now();
  while (performance.now() - start < RUNTIME_READY_TIMEOUT_MS) {
    const galaxy = window.APEX_GALAXY;
    if (!galaxy || !galaxy.audio) {
      await wait(50);
      continue;
    }
    const complete = expectedGalaxyAudio.every((key) => Object.prototype.hasOwnProperty.call(galaxy.audio, key));
    if (complete) return;
    await wait(50);
  }
  console.warn('[asset-loader] Timed out waiting for runtime GALAXY audio decode; gameplay will use safe fallbacks.');
}

function injectApexEngine(scriptRef, engineSrc) {
  if (window.__apexEngineReady) return Promise.resolve();
  if (window.__apexEngineLoadPromise) return window.__apexEngineLoadPromise;
  window.__apexEngineLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = engineSrc;
    script.async = false;
    script.dataset.apexEngine = 'true';
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
        try { window.goToTrialSelect = goToTrialSelect; } catch (error) {}
        try { window.startTrialMode = startTrialMode; } catch (error) {}
        try { window.endTrialMode = endTrialMode; } catch (error) {}
        try { window.startTamChienMode = startTamChienMode; } catch (error) {}
        try { window.toggleAutoBattlePause = toggleAutoBattlePause; } catch (error) {}
        try { window.restartAutoBattle = restartAutoBattle; } catch (error) {}
        try { window.exitAutoBattle = exitAutoBattle; } catch (error) {}
      `;
      bridge.dataset.apexEngineBridge = 'true';
      document.body.appendChild(bridge);
      window.__apexEngineReady = true;
      resolve();
    };
    script.onerror = () => {
      console.warn(`[asset-loader] Failed engine script: ${engineSrc}`);
      window.__apexEngineLoadPromise = null;
      reject(new Error(`Failed to load ${engineSrc}`));
    };
    document.body.appendChild(script);
    scriptRef.current = script;
  });
  return window.__apexEngineLoadPromise;
}

export default function App() {
  const scriptRef = useRef(null);
  const menuAudioRef = useRef(null);
  const menuAudioWasPlayingRef = useRef(false);
  const pendingActionRef = useRef(null);
  const [gameReady, setGameReady] = useState(false);
  const [pressedMenuButton, setPressedMenuButton] = useState(null);
  const [loader, setLoader] = useState({
    active: true,
    fading: false,
    percent: 0,
    status: 'LOADING ASSETS',
    loadedCount: 0,
    totalCount: 1,
  });

  useEffect(() => {
    if (once.loaded) return undefined;
    let cancelled = false;
    const engineSrc = `/apexEngine.js?v=${Date.now()}`;

    const boot = async () => {
      warmMenuAudio();
      const enginePromise = injectApexEngine(scriptRef, engineSrc);
      enginePromise.catch(() => {});
      const preloadResult = await preloadGameAssets(engineSrc, (progress) => {
        if (cancelled) return;
        setLoader((current) => ({
          ...current,
          percent: progress.percent,
          status: progress.label,
          loadedCount: progress.loadedCount,
          totalCount: progress.totalCount,
        }));
      });
      if (cancelled) return;
      setLoader((current) => ({ ...current, percent: 100, status: 'STARTING ENGINE' }));
      await enginePromise;
      await waitForRuntimeAssetReadiness();
      if (cancelled) return;
      once.loaded = true;
      setGameReady(true);
      await wait(350);
      if (cancelled) return;
      setLoader((current) => ({ ...current, fading: true, percent: 100, status: 'READY' }));
      await wait(520);
      if (cancelled) return;
      setLoader((current) => ({ ...current, active: false }));
    };

    boot().catch((error) => {
      console.warn('[asset-loader] Boot failed.', error);
      if (!cancelled) setLoader((current) => ({ ...current, status: 'LOADING FALLBACK', percent: 100, fading: true }));
    });

    return () => {
      cancelled = true;
      scriptRef.current = null;
    };
  }, []);

  const menuMusicAllowed = () => {
    if (typeof document === 'undefined') return false;
    const visible = (id) => {
      const el = document.getElementById(id);
      if (!el || el.classList.contains('hidden')) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };
    return visible('menu-screen')
      || visible('select-screen')
      || visible('tournament-screen')
      || visible('solo-screen')
      || visible('solo-select-screen')
      || visible('trial-screen')
      || visible('trial-select-screen')
      || visible('tam-chien-screen');
  };

  const stopMenuMusic = (reset = false) => {
    const audio = menuAudioRef.current;
    if (!audio) return;
    audio.pause();
    if (reset) {
      try { audio.currentTime = 0; } catch (error) {}
    }
  };

  const playMenuMusic = (restart = false) => {
    const audio = menuAudioRef.current;
    if (!audio) return;
    if (!menuMusicAllowed()) {
      audio.pause();
      return;
    }
    if (restart) {
      try { audio.currentTime = 0; } catch (error) {}
    }
    audio.volume = 0.48;
    const playPromise = audio.play();
    if (playPromise && playPromise.catch) playPromise.catch(() => {});
  };

  useEffect(() => {
    const audio = new Audio(MENU_AUDIO);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.48;
    audio.__apexMenuMusic = true;
    menuAudioRef.current = audio;
    window.apexStopMenuMusic = (reset = false) => stopMenuMusic(reset);
    window.apexPlayMenuMusic = (restart = false) => playMenuMusic(restart);

    const unlock = () => playMenuMusic(false);
    const pauseForHiddenTab = () => {
      const current = menuAudioRef.current;
      if (!current) return;
      menuAudioWasPlayingRef.current = !current.paused;
      current.pause();
    };
    const resumeForVisibleTab = () => {
      if (!menuMusicAllowed()) {
        menuAudioWasPlayingRef.current = false;
        menuAudioRef.current?.pause();
        return;
      }
      if (!menuAudioWasPlayingRef.current) return;
      menuAudioWasPlayingRef.current = false;
      playMenuMusic(false);
    };
    const handleVisibility = () => {
      if (document.hidden) pauseForHiddenTab();
      else resumeForVisibleTab();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', pauseForHiddenTab);
    window.addEventListener('focus', resumeForVisibleTab);
    playMenuMusic(true);

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', pauseForHiddenTab);
      window.removeEventListener('focus', resumeForVisibleTab);
      audio.pause();
      menuAudioRef.current = null;
      if (window.apexStopMenuMusic) delete window.apexStopMenuMusic;
      if (window.apexPlayMenuMusic) delete window.apexPlayMenuMusic;
    };
  }, []);

  const runApex = (name, options = {}) => {
    if (!gameReady) return;
    if (options.startsMatch) {
      stopMenuMusic(true);
      window.apexStopBattleAudio?.();
    } else if (name === 'startMatch' || name === 'startSoloMode' || name === 'startTrialMode') {
      stopMenuMusic(true);
      window.apexStopBattleAudio?.();
    } else if (name === 'goToMenu' || name === 'exitAutoBattle') {
      window.apexStopBattleAudio?.();
      playMenuMusic(true);
    } else if (name === 'goToSelect' || name === 'goToTournament' || name === 'goToSoloSelect') {
      window.apexStopBattleAudio?.();
      playMenuMusic(false);
    }
    callApexGlobal(name, true);
    if (options.startsMatch || name === 'startMatch' || name === 'startSoloMode' || name === 'startTrialMode') {
      stopMenuMusic(true);
    }
  };

  const handleMenuButton = (button) => {
    if (!gameReady || pendingActionRef.current) return;
    pendingActionRef.current = button.action;
    setPressedMenuButton(button.id);
    window.setTimeout(() => {
      runApex(button.action, { startsMatch: button.startsMatch });
      setPressedMenuButton(null);
      pendingActionRef.current = null;
    }, 105);
  };

  return (
    <>
    {loader.active && (
      <div id="loading-screen" className={loader.fading ? 'is-fading' : ''} aria-live="polite">
        <div className="loading-fallback" />
        <img className="loading-bg loading-bg-landscape" src={LOADING_ASSETS.bgLandscape} alt="" />
        <img className="loading-bg loading-bg-portrait" src={LOADING_ASSETS.bgPortrait} alt="" />
        <div className="loading-vignette" />
        <img className="loading-title" src={LOADING_ASSETS.gameTitle} alt="Apex Chaos" />
        <div className="loading-bar-shell">
          <img className="loading-bar-frame" src={LOADING_ASSETS.loadingBarFrame} alt="" />
          <div className="loading-bar-interior">
            <div className="loading-bar-fill" style={{ width: `${loader.percent}%` }} />
          </div>
          <div className="loading-status">{loader.status}</div>
          <div className="loading-percent">{loader.percent}%</div>
        </div>
      </div>
    )}
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
              <div className="hp-loss-trail" id="p1-hp-loss" />
              <div className="hp-bar-fill" id="p1-hp" />
              <div className="hp-text" id="p1-hp-text">100.0 / 100</div>
            </div>
            <div className="rage-indicator" id="p1-rage">RAGE ACTIVE</div>
          </div>

          <div className="player-info p2-info">
            <div className="name" id="p2-name">P2</div>
            <div className="hp-bar-bg">
              <div className="hp-loss-trail" id="p2-hp-loss" />
              <div className="hp-bar-fill" id="p2-hp" />
              <div className="hp-text" id="p2-hp-text">100.0 / 100</div>
            </div>
            <div className="rage-indicator" id="p2-rage">RAGE ACTIVE</div>
          </div>
        </div>
      </div>

      <div id="battle-controls" className="battle-controls hidden">
        <button id="battle-pause-btn" type="button" disabled={!gameReady} onClick={() => runApex('toggleAutoBattlePause')} aria-label="Pause">II</button>
        <button type="button" disabled={!gameReady} onClick={() => runApex('restartAutoBattle')} aria-label="Restart">R</button>
        <button type="button" disabled={!gameReady} onClick={() => runApex('exitAutoBattle')} aria-label="Exit">X</button>
      </div>

      <div id="menu-screen" className="screen">
        <div className="menu-bg menu-bg-landscape" aria-hidden="true" />
        <div className="menu-bg menu-bg-portrait" aria-hidden="true" />
        <div className="menu-vfx-overlay" aria-hidden="true" />
        <div className="menu-darken" aria-hidden="true" />
        <div className="menu-energy menu-energy-red" aria-hidden="true" />
        <div className="menu-energy menu-energy-cyan" aria-hidden="true" />
        <img className="menu-title-img" src={LOADING_ASSETS.gameTitle} alt="Apex Chaos" />
        <div className="menu-buttons">
          {MENU_BUTTONS.map((button, index) => (
            <button
              key={button.id}
              type="button"
              className={`menu-image-button ${button.primary ? 'primary' : ''} ${pressedMenuButton === button.id ? 'is-pressed' : ''}`}
              style={{ '--menu-delay': `${index * 42 + 80}ms` }}
              disabled={!gameReady}
              onClick={() => handleMenuButton(button)}
              aria-label={button.label}
            >
              {button.asset ? (
                <img src={button.asset} alt="" draggable="false" />
              ) : (
                <span className="menu-text-label">{button.text || button.label}</span>
              )}
              <span className="menu-button-sweep" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      <div id="select-screen" className="screen hidden">
        <div className="select-bg" aria-hidden="true" />
        <div id="select-ui">
          <h2 id="select-title" style={{ color: '#7fd4ff' }}>SELECT PLAYER 1</h2>
          <div className="roster-tabs visual-tabs" aria-hidden="true">
            <span className="visual-tab"><img src={UI_2026_ASSETS.tabApexUpdate} alt="" draggable="false" /></span>
            <span className="visual-tab"><img src={UI_2026_ASSETS.tabFullRoster} alt="" draggable="false" /></span>
          </div>
          <div className="roster" id="roster-grid" />
          <div className="fighter-stage" aria-label="Selected fighters">
            <div className="picked-fighter-slot picked-fighter-p1">
              <img id="p1-fighter-vfx" className="picked-fighter-vfx" alt="Player 1 fighter" draggable="false" />
              <span className="picked-fighter-label">P1</span>
            </div>
            <button id="start-btn" className="fight-stage-button hidden" type="button" disabled={!gameReady} onClick={() => runApex('startMatch')}>
              <img className="fight-action-img" src={UI_2026_ASSETS.fightButton} alt="Fight" draggable="false" />
            </button>
            <div className="picked-fighter-slot picked-fighter-p2">
              <img id="p2-fighter-vfx" className="picked-fighter-vfx" alt="Player 2 fighter" draggable="false" />
              <span className="picked-fighter-label">P2</span>
            </div>
          </div>
          <div className="autobattle-settings" aria-label="Auto battle settings">
            <div className="ab-panel p1">
              <img className="setup-vfx setup-vfx-p1" src={UI_2026_ASSETS.p1SetupVfx} alt="" draggable="false" />
              <b>P1 SETUP</b>
              <label>
                <span>HP</span>
                <input id="p1-hp-setting" type="text" inputMode="numeric" defaultValue="1000" placeholder="1000 or INF" />
              </label>
              <label>
                <span>DMG %</span>
                <input id="p1-dmg-setting" type="number" min="100" max="1000" step="10" defaultValue="100" />
              </label>
            </div>
            <div className="ab-panel p2">
              <img className="setup-vfx setup-vfx-p2" src={UI_2026_ASSETS.p2SetupVfx} alt="" draggable="false" />
              <b>P2 SETUP</b>
              <label>
                <span>HP</span>
                <input id="p2-hp-setting" type="text" inputMode="numeric" defaultValue="1000" placeholder="1000 or INF" />
              </label>
              <label>
                <span>DMG %</span>
                <input id="p2-dmg-setting" type="number" min="100" max="1000" step="10" defaultValue="100" />
              </label>
            </div>
          </div>
          <div className="select-actions">
            <button id="matchup-stats-btn" type="button" disabled={!gameReady} onClick={() => runApex('runMatchupStats')}>
              RUN 20 STATS
            </button>
            <button id="select-exit-btn" type="button" disabled={!gameReady} onClick={() => runApex('goToMenu')}>
              <img className="action-button-img exit-action-img" src={UI_2026_ASSETS.exitButton} alt="Exit" draggable="false" />
            </button>
          </div>
          <div id="matchup-report" className="matchup-report" />
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
            <button type="button" disabled={!gameReady} onClick={() => runApex('resetTournament')}>Xep lai giai</button>
          </div>
          <div id="tournament-board" className="tournament-board" />
          <div className="tournament-footer">
            <button type="button" disabled={!gameReady} onClick={() => runApex('goToMenu')}>Ve Menu</button>
            <button type="button" disabled={!gameReady} onClick={() => runApex('goToSelect')}>Chon dau thuong</button>
          </div>
        </div>
      </div>

      <div id="end-screen" className="screen hidden">
        <h1 id="winner-text">WINNER</h1>
        <div id="stats-panel" className="stats-panel" />
        <div id="end-actions" style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button id="save-replay-btn" type="button" disabled={!gameReady} onClick={() => runApex('saveLastReplay')}>
            Save Replay
          </button>
          <button type="button" disabled={!gameReady} onClick={() => runApex('goToSelect')}>Rematch</button>
          <button id="tournament-return-btn" className="hidden" type="button" disabled={!gameReady} onClick={() => runApex('goToTournament')}>
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
          <button id="solo-start-btn" className="hidden" type="button" disabled={!gameReady} onClick={() => runApex('startSoloMode')}>
            START SOLO
          </button>
          <button type="button" disabled={!gameReady} onClick={() => runApex('goToMenu')}>BACK</button>
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

      <div id="trial-screen" className="screen hidden">
        <h1>DAU THU</h1>
        <p className="trial-hint">
          Chon 1 tuong de test voi boss SAITAMA. Boss chi dam thuong 10 damage moi 10 giay va khong ket lieu doi thu.
        </p>
        <div className="trial-config">
          <label htmlFor="trial-boss-hp">SAITAMA HP</label>
          <input id="trial-boss-hp" type="text" inputMode="decimal" defaultValue="1000" placeholder="1, 1000, infinity" />
        </div>
        <div className="sandbox-tools">
          <button type="button" disabled={!gameReady} onClick={() => runApex('sandboxToggleRage')}>Toggle Rage</button>
          <button type="button" disabled={!gameReady} onClick={() => runApex('sandboxResetCooldowns')}>Reset CD</button>
          <button type="button" disabled={!gameReady} onClick={() => runApex('sandboxSlowMotion')}>Slow 50%</button>
        </div>
        <h2 id="trial-title" style={{ color: '#7fd4ff', margin: '8px 0 4px' }}>SELECT TEST FIGHTER</h2>
        <div id="trial-roster" className="solo-roster trial-roster" />
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button id="trial-start-btn" className="hidden" type="button" disabled={!gameReady} onClick={() => runApex('startTrialMode')}>
            START TEST
          </button>
          <button type="button" disabled={!gameReady} onClick={() => runApex('goToMenu')}>BACK</button>
        </div>
      </div>

      <div id="trial-hud" className="trial-hud">
        <div className="trial-hud-card">
          <b id="trial-clock">0.0s</b>
          <span id="trial-boss-hp-readout">SAITAMA HP</span>
        </div>
        <button type="button" disabled={!gameReady} onClick={() => runApex('endTrialMode')}>KET THUC</button>
      </div>

      <div id="tam-chien-screen" className="screen hidden">
        <div id="tam-chien-root" className="tam-chien-root" />
      </div>
    </div>

    <div id="combat-inspector" aria-hidden="true">
      <div className="ci-card ci-left">
        <div className="ci-head"><span id="ci-p1-title">P1</span><b id="ci-p1-mode">READY</b></div>
        <div className="ci-rows" id="ci-p1-rows" />
      </div>
      <div className="ci-card ci-right">
        <div className="ci-head"><span id="ci-p2-title">P2</span><b id="ci-p2-mode">READY</b></div>
        <div className="ci-rows" id="ci-p2-rows" />
      </div>
    </div>
    </>
  );
}
