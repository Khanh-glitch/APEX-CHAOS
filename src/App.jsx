import React, { useEffect, useRef, useState } from 'react';
import {
  loadDeferredGameRuntimes,
  loadMenuInteractiveRuntimes,
  scheduleDeferredGameRuntimes,
} from './game/runtimeLoader.js';
import { APEX_ARSENAL_RUNTIME_REVISION, preloadRuntimeSources } from './game/runtimeManifest.js';
import {
  beginPerfSpan,
  markBootInteractive,
  markBootPhase,
  markLoaderHidden,
} from './game/performanceMetrics.js';

const once = { loaded: false };
const RAW_MANUAL_ROOM_WS_URL = String(import.meta.env.VITE_MANUAL_ROOM_WS_URL || '').trim();
const MANUAL_ROOM_WS_URL = /(^|\.)example\.com(?=\/|$)/i.test(RAW_MANUAL_ROOM_WS_URL.replace(/^wss?:\/\//i, ''))
  ? ''
  : RAW_MANUAL_ROOM_WS_URL;

function wakeManualRoomRelay() {
  if (!MANUAL_ROOM_WS_URL) return;
  try {
    const relayUrl = new URL(MANUAL_ROOM_WS_URL);
    relayUrl.protocol = relayUrl.protocol === 'wss:' ? 'https:' : 'http:';
    relayUrl.pathname = '/health';
    relayUrl.search = '';
    relayUrl.hash = '';
    fetch(relayUrl.toString(), {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      keepalive: true,
    }).catch(() => {});
  } catch (error) {
    console.warn('[manual-room] Invalid VITE_MANUAL_ROOM_WS_URL; relay wake-up skipped.');
  }
}

const LOADING_ASSETS = {
  bgPortrait: '/assets/ui_2026/loading-bg-portrait.webp',
  bgLandscape: '/assets/ui_2026/loading-bg-landscape.webp',
  gameTitle: '/assets/ui_2026/game-name-icon.webp',
  loadingBarFrame: '/assets/loading/loading-bar-frame.webp',
};

const UI_2026_ASSETS = {
  menuBgLandscape: '/assets/ui_2026/menu-bg-landscape.webp',
  menuBgPortrait: '/assets/ui_2026/menu-bg-portrait.webp',
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

const LOADING_LABELS = ['LOADING ASSETS', 'PREPARING ARENA', 'SYNCHRONIZING VFX'];
const IMAGE_PRELOAD_TIMEOUT_MS = 7000;
const LOADER_READY_HOLD_MS = 160;
const LOADER_FADE_MS = 280;

const DEFERRED_RUNTIME_ACTION_GROUPS = {
  goToSelect: 'select',
  startMatch: 'battle',
  goToTournament: 'select',
  goToManualLabSelect: 'manualLab',
  goToSoloSelect: 'soloBattle',
  startSoloMode: 'soloBattle',
  goToTrialSelect: 'trialBattle',
  startTrialMode: 'trialBattle',
  startTamChienMode: 'tamChien',
  // Historical quest calls are explicit compatibility/developer entry only.
  startArsenalQuestMode: 'arsenalQuest',
  beginArsenalQuestSelection: 'arsenalQuest',
  beginArsenalQuestMap: 'arsenalQuest',
  // Public product actions use these neutral groups directly.
  startArsenalProductBattle: 'arsenalCore',
  openArsenalLab: 'arsenalCore',
};

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
    let decodeStarted = false;
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
    const finishLoaded = async () => {
      if (settled || decodeStarted) return;
      decodeStarted = true;
      try {
        if (img.decode) await img.decode();
      } catch (decodeError) {
        if (!img.naturalWidth) {
          console.warn(`[asset-loader] Failed to decode image asset: ${path}`, decodeError);
        }
      }
      finish(true);
    };
    img.decoding = 'async';
    img.onload = () => { void finishLoaded(); };
    img.onerror = () => finish(false);
    img.src = path;
    if (img.complete) {
      if (img.naturalWidth > 0) void finishLoaded();
      else finish(false);
    }
  });
}

async function preloadFetchAsset(path, type) {
  try {
    const response = await fetch(path, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    await response.arrayBuffer();
  } catch (error) {
    console.warn(`[asset-loader] Failed ${type} asset: ${path}`, error);
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

function criticalBootAssets() {
  const portraitViewport = window.innerHeight > window.innerWidth || window.innerWidth <= 700;
  const loadingBackground = portraitViewport ? LOADING_ASSETS.bgPortrait : LOADING_ASSETS.bgLandscape;
  const menuBackground = portraitViewport ? UI_2026_ASSETS.menuBgPortrait : UI_2026_ASSETS.menuBgLandscape;

  return [
    { path: loadingBackground, type: 'image', required: true },
    { path: LOADING_ASSETS.gameTitle, type: 'image', required: true },
    { path: LOADING_ASSETS.loadingBarFrame, type: 'image', required: true },
    { path: menuBackground, type: 'image', required: true },
  ];
}

function blockingBootAssets(engineSrc) {
  return uniqueAssets(criticalBootAssets(), engineSrc);
}

async function preloadAssetList(assets, onProgress) {
  let loadedCount = 0;
  const totalCount = Math.max(assets.length, 1);
  let nextIndex = 0;
  const workerCount = Math.min(6, assets.length || 1);

  onProgress({ loadedCount, totalCount, percent: 0, label: LOADING_LABELS[0] });

  const loadOne = async (asset) => {
    const type = asset.type || assetTypeFromPath(asset.path);
    const endTiming = beginPerfSpan('asset', asset.path, { type });
    try {
      if (type === 'image') await preloadImage(asset.path);
      else await preloadFetchAsset(asset.path, type);
      endTiming({ ok: true });
    } catch (error) {
      endTiming({ ok: false });
      throw error;
    }
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
  const assets = blockingBootAssets(engineSrc);
  await preloadAssetList(assets, onProgress);

  return { totalCount: assets.length, loadedCount: assets.length };
}

function injectApexEngine(scriptRef, engineSrc) {
  if (window.__apexEngineReady) return Promise.resolve();
  if (window.__apexEngineLoadPromise) return window.__apexEngineLoadPromise;
  const endEngineTiming = beginPerfSpan('engine', engineSrc);
  window.__apexEngineLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = engineSrc;
    script.async = false;
    script.dataset.apexEngine = 'true';
    const finishRuntimeLoad = () => {
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
        try { window.goToManualLabSelect = goToManualLabSelect; } catch (error) {}
        try { window.toggleAutoBattlePause = toggleAutoBattlePause; } catch (error) {}
        try { window.restartAutoBattle = restartAutoBattle; } catch (error) {}
        try { window.exitAutoBattle = exitAutoBattle; } catch (error) {}
      `;
      bridge.dataset.apexEngineBridge = 'true';
      document.body.appendChild(bridge);
      window.__apexEngineReady = true;
      endEngineTiming({ ok: true });
      resolve();
    };
    script.onload = async () => {
      try {
        markBootPhase('engine-ready');
        // Tier 1 — only the menu-interactive runtime chain (§A2). Everything
        // else loads as background warmup or route intent.
        await loadMenuInteractiveRuntimes();
        markBootPhase('menu-runtime-ready');
        window.APEX_MANUAL_ROOM_WS_URL = MANUAL_ROOM_WS_URL;
        window.__apexEnsureDeferredRuntimes = loadDeferredGameRuntimes;
        finishRuntimeLoad();
      } catch (error) {
        console.warn('[asset-loader] Failed menu-interactive game runtime.', error);
        window.__apexEngineLoadPromise = null;
        endEngineTiming({ ok: false, error: String(error?.message || error) });
        reject(error);
      }
    };
    script.onerror = () => {
      console.warn(`[asset-loader] Failed engine script: ${engineSrc}`);
      window.__apexEngineLoadPromise = null;
      endEngineTiming({ ok: false, error: `Failed to load ${engineSrc}` });
      reject(new Error(`Failed to load ${engineSrc}`));
    };
    document.body.appendChild(script);
    scriptRef.current = script;
  });
  return window.__apexEngineLoadPromise;
}

// PASS B — universal combat HUD side panel (authority §3/§6).
// React owns this markup; the engine + APEX_COMBAT_HUD only WRITE into these
// ids (cached refs, change-only). Engine-owned ids (p1/p2-name, -hp,
// -hp-loss, -hp-text, -rage) are MOVED here from the legacy top header —
// the engine keeps writing them exactly as before.
function CombatPanelSide({ side }) {
  const p = `p${side}`;
  const isP1 = side === 1;
  return (
    <aside id={`${p}-combat-panel`} className={`combat-panel cp-side-p${side}`} aria-label={`Player ${side} combat panel`}>
      <section className="cp-identity">
        <div className="cp-fighter-head">
          <div className="cp-fighter-copy">
            <div className="cp-eyebrow">{isP1 ? 'P1 · PLAYER SIDE' : 'P2 · RIVAL SIDE'}</div>
            <div className="name" id={`${p}-name`}>P{side}</div>
          </div>
          <span className="cp-chip" id={`${p}-cp-chip`} />
        </div>
        <div className="cp-hp-wrap">
          <div className="cp-hp-label">
            <span>HP</span>
            <span className="hp-text" id={`${p}-hp-text`}>1000 / 1000</span>
          </div>
          <div className="hp-bar-bg">
            <div className="hp-loss-trail" id={`${p}-hp-loss`} />
            <div className="hp-bar-fill" id={`${p}-hp`} />
            <div className="cp-hp-ticks" />
          </div>
          <div className="rage-indicator" id={`${p}-rage`}>RAGE ACTIVE</div>
        </div>
      </section>

      <div className="cp-section-title cp-pressure-title">RECENT PRESSURE</div>
      <section className="cp-burst" id={`${p}-burst`}>
        <div className="cp-burst-top">
          <div className="cp-burst-stack">
            <div className="cp-burst-kicker">ROLLING 1.2S</div>
            <div className="cp-burst-readout">
              <span className="cp-burst-total" id={`${p}-burst-total`}>0</span>
              <span className="cp-burst-unit">DMG</span>
            </div>
            <div className="cp-burst-meta">
              <span className="cp-burst-hits" id={`${p}-burst-hits`}>0 HITS</span>
              <span className="cp-burst-crits" id={`${p}-burst-crits`}>0 CRIT</span>
            </div>
          </div>
          <div className="cp-burst-label" id={`${p}-burst-label`} />
        </div>
        <div className="cp-burst-track">
          <div className="cp-burst-fill" id={`${p}-burst-fill`} />
        </div>
      </section>

      <section className="cp-combat-stage">
        <div className="cp-loadout-shell" id={`${p}-loadout`}>
          <div className="cp-loadout-kicker">CURRENT LOADOUT</div>
          <div className="cp-loadout-top">
            <div className="cp-loadout-copy">
              <div className="cp-loadout-name" id={`${p}-loadout-name`}>—</div>
              <div className="cp-loadout-line">
                <span className="cp-loadout-family" id={`${p}-loadout-family`} />
                <span className="cp-loadout-tier" id={`${p}-loadout-tier`} />
              </div>
              <div className="cp-loadout-state" id={`${p}-loadout-state`}>UNARMED</div>
            </div>
            <div className="cp-loadout-art">
              <canvas id={`${p}-loadout-canvas`} className="cp-loadout-canvas" width="480" height="240" />
              <div className="cp-loadout-fallback" id={`${p}-loadout-fallback`}>
                <span className="cp-glyph" id={`${p}-cp-glyph`}>—</span>
                <span className="cp-fallback-label" id={`${p}-loadout-fallback-label`}>UNARMED</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="cp-section-title cp-energy-title-row">ENERGY</div>
      <section className="cp-energy" id={`${p}-energy`}>
        <div className="cp-energy-head">
          <span className="cp-energy-kicker">COMBAT RESOURCE</span>
          <span className="cp-energy-val" id={`${p}-energy-val`}>0</span>
        </div>
        <div className="cp-energy-track">
          <div className="cp-energy-fill" id={`${p}-energy-fill`} />
          <span className="cp-energy-ready" id={`${p}-energy-state`} />
        </div>
      </section>

      <section className="cp-robot-passive" id={`${p}-robot-passive`} hidden aria-label="Robot rolling burst milestones">
        <div className="cp-robot-head"><span>BURST 1.2S</span><strong id={`${p}-robot-count`}>0 / 150</strong></div>
        <div className="cp-robot-rail">{[0,1,2,3,4,5].map(i => <span key={i} id={`${p}-robot-step-${i}`} />)}</div>
        <div id={`${p}-robot-progress`} />
        <div className="cp-robot-refund" id={`${p}-robot-refund`} aria-live="polite" />
      </section>
      <section className="cp-mode" id={`${p}-mode-slot`} />
    </aside>
  );
}

export default function App() {
  const scriptRef = useRef(null);
  const menuAudioRef = useRef(null);
  const menuAudioWasPlayingRef = useRef(false);
  const pendingActionRef = useRef(null);
  const [gameReady, setGameReady] = useState(false);
  const [productSurfaces, setProductSurfaces] = useState([]);
  const [productNotice, setProductNotice] = useState('Loading the product graph…');
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
    // Cache-bust the classic engine the same way as the other public
    // runtimes so a stable Cloudflare alias can never serve stale bytes.
    const engineSrc = `/apexEngine.js?v=${APEX_ARSENAL_RUNTIME_REVISION}`;

    wakeManualRoomRelay();

    const boot = async () => {
      markBootPhase('boot-start');
      preloadRuntimeSources();
      const enginePromise = injectApexEngine(scriptRef, engineSrc);
      enginePromise.catch(() => {});
      // Loading truth (§A1): progress counts EVERY menu-interactive unit —
      // critical shell assets (which include the engine bytes) plus the
      // engine + Tier-1 runtime execution unit. The percentage can therefore
      // never read 100%/READY while a menu dependency is still pending.
      let progressTotalUnits = 0;
      const preloadResult = await preloadGameAssets(engineSrc, (progress) => {
        if (cancelled) return;
        if (!progressTotalUnits) progressTotalUnits = progress.totalCount + 1; // + engine/tier-1 unit
        setLoader((current) => ({
          ...current,
          percent: Math.min(99, Math.floor((progress.loadedCount / progressTotalUnits) * 100)),
          status: progress.label,
          loadedCount: progress.loadedCount,
          totalCount: progress.totalCount,
        }));
      });
      markBootPhase('critical-shell-ready', { assets: preloadResult.loadedCount });
      if (cancelled) return;
      setLoader((current) => ({
        ...current,
        // All shell assets in; the engine execution unit is still pending.
        percent: Math.min(99, Math.floor((preloadResult.totalCount / (preloadResult.totalCount + 1)) * 100)),
        status: 'STARTING ENGINE',
      }));
      await enginePromise;
      if (cancelled) return;
      once.loaded = true;
      setGameReady(true);
      // The menu is genuinely usable from this tick onward (buttons enabled,
      // engine nav globals bound, Tier-1 audio bridge live).
      markBootInteractive();
      markBootPhase('menu-interactive');
      setLoader((current) => ({ ...current, active: true, fading: false, percent: 100, status: 'READY' }));
      // Tier 2 — background warmup of likely-next groups. Never blocks the
      // menu; yields to any route intent through the priority queue.
      scheduleDeferredGameRuntimes();
      await wait(LOADER_READY_HOLD_MS);
      if (cancelled) return;
      setLoader((current) => ({ ...current, fading: true }));
      await wait(LOADER_FADE_MS);
      if (cancelled) return;
      setLoader((current) => ({ ...current, active: false, fading: false }));
      markLoaderHidden();
      window.dispatchEvent(new CustomEvent('apex:boot-interactive'));
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

  useEffect(() => {
    if (!gameReady) return undefined;
    let cancelled = false;
    // Load the small graph/meta authority behind the interactive menu. This is
    // intentionally not the Arsenal combat core and never touches the retired
    // quest ladder; clicking a product surface remains priority loading.
    loadDeferredGameRuntimes('arsenalHub', { priority: false }).then(() => {
      if (cancelled) return;
      const authority = window.APEX_PRODUCT_SURFACES;
      if (authority?.publicSurfaces) {
        setProductSurfaces(authority.publicSurfaces());
        setProductNotice('Choose an available surface. Locked systems are clearly marked and do not open placeholder pages.');
      }
    }).catch((error) => {
      console.warn('[product-graph] Unable to hydrate product authority.', error);
    });
    return () => { cancelled = true; };
  }, [gameReady]);

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
      || visible('manual-room-screen')
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

  const playMenuMusic = (restart = false, attempts = 0) => {
    const audio = menuAudioRef.current;
    if (!audio) return;
    if (!menuMusicAllowed()) {
      audio.pause();
      // CP7 self-healing resume: the exit-to-menu handoff is fire-once — if
      // the menu screen was not yet visible at that instant (screen swap,
      // transient blur/hidden state on slow machines) the menu stayed silent
      // with no retry. Retry briefly; never fight a real background-tab
      // pause (document.hidden) or the battle-audio session (independent
      // element, CP6).
      if (attempts < 8 && !document.hidden) {
        setTimeout(() => playMenuMusic(restart, attempts + 1), 250);
      }
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
    const audio = new Audio();
    audio.loop = true;
    // §A4 — warm the menu BGM in the background before the first user
    // gesture. Preload never blocks menu interactivity, and playback still
    // respects autoplay policy (no forced audible autoplay); the first
    // allowed play starts from already-warmed data.
    audio.preload = 'auto';
    audio.volume = 0.48;
    audio.src = MENU_AUDIO;
    audio.__apexMenuMusic = true;
    audio.load();
    menuAudioRef.current = audio;
    // Evidence probe (§A4): read-only BGM readiness without exposing the
    // element itself (it is deliberately never attached to the DOM).
    window.__apexMenuBgmState = () => {
      const a = menuAudioRef.current;
      if (!a) return null;
      return {
        preload: a.preload,
        readyState: a.readyState,
        networkState: a.networkState,
        paused: a.paused,
        src: a.currentSrc || a.src,
      };
    };
    window.apexStopMenuMusic = (reset = false) => stopMenuMusic(reset);
    window.apexPlayMenuMusic = (restart = false) => playMenuMusic(restart);

    // CP7: re-armed on every interaction (NOT once) — if a resume was ever
    // missed (transient blur/hidden state at the exit-to-menu handoff), the
    // next click/keypress heals the menu music instead of leaving the menu
    // silent for the rest of the session. playMenuMusic no-ops when already
    // playing or when no menu screen is visible.
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
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', pauseForHiddenTab);
    window.addEventListener('focus', resumeForVisibleTab);

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
      if (window.__apexMenuBgmState) delete window.__apexMenuBgmState;
    };
  }, []);

  const runApex = async (name, options = {}) => {
    if (!gameReady) return;
    try {
      const deferredGroup = options.deferredGroup || (options.startsMatch ? 'battle' : DEFERRED_RUNTIME_ACTION_GROUPS[name]);
      if (deferredGroup) await loadDeferredGameRuntimes(deferredGroup);
      // Battle-audio session lifecycle (correction pass): entering a match =
      // terminate the previous session for real (old voices/cues die), then
      // unmute the master for the new session. Menu/select navigation ends
      // the session — battle SFX stay silent until the next match begins.
      if (options.startsMatch) {
        stopMenuMusic(true);
        window.apexBeginBattleAudioSession?.();
      } else if (name === 'startMatch' || name === 'startSoloMode' || name === 'startTrialMode' || name === 'startArsenalQuestMode' || name === 'startTamChienMode') {
        stopMenuMusic(true);
        window.apexBeginBattleAudioSession?.();
      } else if (name === 'goToMenu' || name === 'exitAutoBattle') {
        window.apexEndBattleAudioSession?.();
        playMenuMusic(true);
      } else if (name === 'goToSelect' || name === 'goToManualLabSelect' || name === 'goToTournament' || name === 'goToSoloSelect' || name === 'beginArsenalQuestSelection' || name === 'beginArsenalQuestMap') {
        window.apexEndBattleAudioSession?.();
        playMenuMusic(false);
      }
      callApexGlobal(name, true);
      if (options.startsMatch || name === 'startMatch' || name === 'startSoloMode' || name === 'startTrialMode') {
        stopMenuMusic(true);
      }
    } catch (error) {
      console.warn(`[asset-loader] Failed to prepare action ${name}.`, error);
    }
  };

  const handleProductSurface = (surface) => {
    if (!gameReady || pendingActionRef.current) return;
    const id = surface?.id;
    if (!id) return;
    if (surface.availability !== 'ACTIVE') {
      setProductNotice(`${surface.title} is LOCKED. ${surface.summary || 'This system is not available in the pre-pilot cut.'}`);
      return;
    }
    pendingActionRef.current = id;
    setPressedMenuButton(id);
    setProductNotice(`Opening ${surface.title}…`);
    const run = async () => {
      try {
        await loadDeferredGameRuntimes('arsenalHub');
        const authority = window.APEX_PRODUCT_SURFACES;
        if (authority?.publicSurfaces) setProductSurfaces(authority.publicSurfaces());
        const result = window.openApexProductSurface?.(id);
        if (!result?.ok) {
          setProductNotice(`${surface.title} is unavailable: ${result?.reason || 'launcher not ready'}.`);
          return;
        }
        // Selection and Meta overlays retain their own visible controls; this
        // notice only documents the graph transition for the root shell.
        setProductNotice(`${surface.title} opened.`);
      } catch (error) {
        console.warn(`[product-graph] Failed to open ${id}.`, error);
        setProductNotice(`${surface.title} could not be opened.`);
      } finally {
        setPressedMenuButton(null);
        pendingActionRef.current = null;
      }
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => { void run(); });
    else { void run(); }
  };

  return (
    <>
    {loader.active && (
      <div id="loading-screen" className={loader.fading ? 'is-fading' : ''} aria-live="polite">
        <div className="loading-fallback" />
        <picture>
          <source media="(orientation: portrait), (max-width: 700px)" srcSet={LOADING_ASSETS.bgPortrait} />
          <img className="loading-bg" src={LOADING_ASSETS.bgLandscape} alt="" />
        </picture>
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
    {/* PASS B: P1 SIDE PANEL | SQUARE ARENA | P2 SIDE PANEL (authority §3).
        Side panels are hidden outside battle (CSS .is-battle); the arena
        column keeps its exact legacy box so absolute screens/overlays
        behave as before. Engine-owned p1/p2 ids now live in the panels. */}
    <div id="battle-shell">
      <CombatPanelSide side={1} />
    <div id="game-wrapper">
      <canvas id="game-canvas" width="1000" height="1000" />

      <div id="countdown-overlay">
        <div className="count-num" id="countdown-num">3</div>
        <div className="count-sub" id="countdown-sub">TOURNAMENT MATCH</div>
      </div>

      <div className="ui-layer" id="hud" style={{ opacity: 0 }}>
        <div id="manual-lab-hud" className="manual-lab-hud hidden" aria-live="polite">
          <div className="manual-lab-title">APEX CONTROL · TERRITORY MODE</div>
          <div className="manual-engineer-hud">
          <div className="manual-lab-readout">
            <span>BLUEPRINT <b id="manual-blueprint">TURRET</b></span>
            <span>COST <b id="manual-cost">3</b></span>
            <span>SCRAP <b id="manual-scrap">3</b></span>
          </div>
          </div>
          <div className="manual-katana-hud hidden">
            <div className="manual-katana-slots">
              <span><b>LMB</b> ADAPTIVE ATTACK</span>
              <span><b>RMB</b> COLLISION EXECUTION</span>
              <span><b>Q</b> DASH <i id="manual-katana-q">READY</i></span>
              <span><b>E</b> CLONE EVADE <i id="manual-katana-e">LOCKED</i></span>
              <span><b>R</b> LUNAR REWRITE <i id="manual-katana-r">LOCKED</i></span>
            </div>
          </div>
          <div id="manual-status" className="manual-lab-status">READY</div>
          <div id="manual-skill-map" className="manual-skill-map hidden" aria-label="Champion skill mapping" />
          <div className="manual-lab-keys">WASD MOVE · MOUSE AIM · LMB BUILD/FIRE · RMB MAGNET · Q/E BLUEPRINT · SPACE MERGE · R WAR MACHINE</div>
        </div>
      </div>

      <div id="battle-controls" className="battle-controls hidden">
        <button id="battle-pause-btn" type="button" disabled={!gameReady} onClick={() => runApex('toggleAutoBattlePause')} aria-label="Pause">II</button>
        <button type="button" disabled={!gameReady} onClick={() => runApex('restartAutoBattle')} aria-label="Restart">R</button>
        <button type="button" disabled={!gameReady} onClick={() => runApex('exitAutoBattle')} aria-label="Exit">X</button>
      </div>
      <aside id="multiplayer-debug-overlay" className="multiplayer-debug-overlay hidden" aria-live="polite">
        <b>REALTIME AUTHORITY</b>
        <pre id="multiplayer-debug-content">NETWORK IDLE</pre>
      </aside>

      <div id="manual-room-dialog" className="manual-room-dialog hidden" role="dialog" aria-modal="true" aria-labelledby="manual-room-dialog-title">
        <div className="manual-room-dialog-panel">
          <p className="manual-room-dialog-kicker">APEX CONTROL · ONLINE</p>
          <h2 id="manual-room-dialog-title">CLOSE BATTLE ROOM?</h2>
          <p id="manual-room-dialog-message">Leaving now will close the room for both players.</p>
          <div id="manual-room-dialog-confirm-actions" className="manual-room-dialog-actions">
            <button type="button" onClick={() => window.cancelManualRoomDestroy?.()}>CANCEL</button>
            <button className="danger" type="button" onClick={() => window.confirmManualRoomDestroy?.()}>CLOSE ROOM</button>
          </div>
          <div id="manual-room-dialog-notice-actions" className="manual-room-dialog-actions hidden">
            <button type="button" onClick={() => window.acknowledgeManualRoomNotice?.()}>OK</button>
          </div>
        </div>
      </div>

      <div id="menu-screen" className="screen">
        <div className="menu-bg menu-bg-landscape" aria-hidden="true" />
        <div className="menu-bg menu-bg-portrait" aria-hidden="true" />
        <div className="menu-darken" aria-hidden="true" />
        <section className="product-menu" aria-labelledby="product-menu-title">
          <header className="product-menu-head">
            <div>
              <p className="product-menu-kicker">APEX CHAOS · PRE-PILOT</p>
              <h1 id="product-menu-title">PRODUCT GRAPH</h1>
              <p className="product-menu-subtitle">Active systems launch real accepted runtime seams. Locked systems do not open placeholder pages.</p>
            </div>
            <div className="product-menu-revision">RUNTIME {APEX_ARSENAL_RUNTIME_REVISION}</div>
          </header>
          <p className="product-menu-notice" role="status">{productNotice}</p>
          <div className="product-surface-grid" aria-label="Public product surfaces">
            {productSurfaces.length ? productSurfaces.map((surface, index) => {
              const active = surface.availability === 'ACTIVE';
              const contents = <>
                <span className="product-surface-index">{String(index + 1).padStart(2, '0')} · {active ? 'AVAILABLE NOW' : 'LOCKED'}</span>
                <strong>{surface.title}</strong>
                <span>{surface.summary || surface.description || (active ? 'Available now.' : 'Not available in the pre-pilot cut.')}</span>
                <em>{active ? 'OPEN' : 'LOCKED'}</em>
              </>;
              return active ? (
                <button
                  key={surface.id}
                  type="button"
                  className={`product-surface-card is-active ${pressedMenuButton === surface.id ? 'is-pressed' : ''}`}
                  disabled={!gameReady}
                  onClick={() => handleProductSurface(surface)}
                >{contents}</button>
              ) : (
                <div key={surface.id} className="product-surface-card is-locked" aria-disabled="true">{contents}</div>
              );
            }) : <div className="product-surface-card is-locked" aria-live="polite"><span className="product-surface-index">PRODUCT AUTHORITY</span><strong>LOADING PRODUCT GRAPH</strong><span>Preparing the authoritative public surface list.</span></div>}
          </div>
          <footer className="product-menu-foot">Developer tools are deliberately omitted from this public graph.</footer>
        </section>
      </div>

      <div id="select-screen" className="screen hidden">
        <div id="apex-pick-runtime-root" aria-label="Champion pick screen" />
        <div className="select-bg" aria-hidden="true" />
        <div id="select-ui">
          <div className="select-loading-panel" aria-live="polite">LOADING SELECT UI</div>
          <div className="fighter-stage" aria-label="Selected fighters">
            <h2 id="select-title">SELECT PLAYER 1</h2>
            <div id="select-phase-label">P1 SELECTING</div>
            <div className="picked-fighter-slot picked-fighter-p1" data-player="1">
              <img className="side-backdrop" data-select-asset="sideBackdrop" alt="" draggable="false" />
              <div className="side-art-aperture">
                <img id="p1-fighter-vfx" className="picked-fighter-vfx" alt="Player 1 fighter" draggable="false" />
              </div>
              <img className="side-frame side-frame-base" data-select-asset="sideFrameBase" alt="" draggable="false" />
              <span className="side-frame-tint" aria-hidden="true" />
              <img className="side-frame side-frame-highlight" data-select-asset="sideFrameHighlight" alt="" draggable="false" />
              <div className="picked-fighter-copy">
                <span className="picked-fighter-label">P1</span>
                <b id="p1-select-name">SELECTING</b>
              </div>
            </div>
            <div className="pick-stat-panel pick-stat-p1" data-player="1">
              <img className="pick-stat-base" data-select-asset="statsPanelBase" alt="" draggable="false" />
              <span className="pick-stat-label pick-hp-label">HP</span>
              <span id="p1-select-hp" className="pick-stat-value pick-hp-value">1000</span>
              <span className="pick-stat-label pick-dmg-label">DMG%</span>
              <span id="p1-select-dmg" className="pick-stat-value pick-dmg-value">100</span>
            </div>
            <div className="select-center" aria-label="Champion select controls">
              <div className="select-vs" aria-hidden="true">VS</div>
              <div className="carousel-shell">
                <button id="select-arrow-left" className="select-arrow select-arrow-left" type="button" disabled={!gameReady} aria-label="Previous fighter" />
                <div className="roster" id="roster-grid" />
                <button id="select-arrow-right" className="select-arrow select-arrow-right" type="button" disabled={!gameReady} aria-label="Next fighter" />
              </div>
              <div className="select-info-panel" aria-label="Champion information">
                <img className="stats-panel-base" data-select-asset="statsPanelBase" alt="" draggable="false" />
                <div className="select-info-copy">
                  <span id="select-info-status">P1 SELECTING</span>
                  <h3 id="select-info-name">CHOOSE FIGHTER</h3>
                  <p id="select-info-desc">Pick a champion to preview combat data.</p>
                  <dl className="select-stat-list">
                    <div><dt>Speed</dt><dd id="select-info-speed">--</dd></div>
                    <div><dt>P1 HP</dt><dd><input id="p1-hp-setting" type="text" inputMode="numeric" defaultValue="1000" placeholder="1000 or INF" /></dd></div>
                    <div><dt>P1 DMG</dt><dd><input id="p1-dmg-setting" type="number" min="100" max="1000" step="10" defaultValue="100" /></dd></div>
                    <div><dt>P2 HP</dt><dd><input id="p2-hp-setting" type="text" inputMode="numeric" defaultValue="1000" placeholder="1000 or INF" /></dd></div>
                    <div><dt>P2 DMG</dt><dd><input id="p2-dmg-setting" type="number" min="100" max="1000" step="10" defaultValue="100" /></dd></div>
                  </dl>
                </div>
              </div>
              <div className="select-actions">
                <button id="start-btn" className="fight-stage-button hidden" type="button" disabled={!gameReady} onClick={() => document.body.classList.contains('manual-online-select') ? window.lockManualRoomChampion?.() : document.body.classList.contains('manual-lab-select') ? window.goToManualRoomLobby?.() : runApex('startMatch', window.__apexArsenalSelectPending ? { startsMatch: true, deferredGroup: 'arsenalCore' } : {})}>
                  <span>START BATTLE</span>
                </button>
                <button id="select-exit-btn" type="button" disabled={!gameReady} onClick={() => runApex('goToMenu')}>
                  <span>BACK</span>
                </button>
              </div>
            </div>
            <div className="picked-fighter-slot picked-fighter-p2" data-player="2">
              <img className="side-backdrop" data-select-asset="sideBackdrop" alt="" draggable="false" />
              <div className="side-art-aperture">
                <img id="p2-fighter-vfx" className="picked-fighter-vfx" alt="Player 2 fighter" draggable="false" />
              </div>
              <img className="side-frame side-frame-base" data-select-asset="sideFrameBase" alt="" draggable="false" />
              <span className="side-frame-tint" aria-hidden="true" />
              <img className="side-frame side-frame-highlight" data-select-asset="sideFrameHighlight" alt="" draggable="false" />
              <div className="picked-fighter-copy">
                <span className="picked-fighter-label">P2</span>
                <b id="p2-select-name">WAITING</b>
              </div>
            </div>
            <div className="pick-stat-panel pick-stat-p2" data-player="2">
              <img className="pick-stat-base" data-select-asset="statsPanelBase" alt="" draggable="false" />
              <span className="pick-stat-label pick-hp-label">HP</span>
              <span id="p2-select-hp" className="pick-stat-value pick-hp-value">1000</span>
              <span className="pick-stat-label pick-dmg-label">DMG%</span>
              <span id="p2-select-dmg" className="pick-stat-value pick-dmg-value">100</span>
            </div>
          </div>
          <div id="matchup-report" className="matchup-report" />
        </div>
      </div>

      <div id="manual-room-screen" className="screen hidden" aria-label="APEX Control room lobby">
        <div className="manual-room-bg" aria-hidden="true" />
        <div className="manual-room-scanlines" aria-hidden="true" />
        <section id="manual-room-panel" className="manual-room-panel" aria-live="polite">
          <p className="manual-room-kicker">APEX CONTROL · VERSUS LINK</p>
          <h2 className="manual-room-title">BATTLE ROOM</h2>
          <p className="manual-room-subtitle">Create a private link or enter your rival's access code.</p>

          <div className="manual-room-primary-actions">
            <button id="manual-room-create" className="room-art-button" type="button"><span>CREATE ROOM</span></button>
            <div className="manual-room-code-entry">
              <label htmlFor="manual-room-input">ROOM CODE</label>
              <input id="manual-room-input" type="text" maxLength={4} placeholder="----" spellCheck="false" aria-label="Room code" />
            </div>
            <button id="manual-room-join" className="room-art-button" type="button"><span>JOIN ROOM</span></button>
          </div>

          <div className="manual-room-readout">
            <span>ACCESS CODE <b id="manual-room-code">----</b></span>
            <i aria-hidden="true" />
            <span>LINK ROLE <b id="manual-room-role">OFFLINE</b></span>
          </div>

          <div id="manual-room-status" className="manual-room-status">CHAMPIONS LOCKED · CHOOSE CONNECTION</div>
          <div className="manual-room-secondary-actions">
            <button id="manual-room-copy" className="room-art-button compact" type="button"><span>COPY CODE</span></button>
            <button id="manual-room-select" className="room-art-button compact accent" type="button" disabled onClick={() => window.closeManualRoomLobby?.()}><span>SELECT CHAMPIONS</span></button>
            <button id="manual-room-leave" className="room-art-button compact danger" type="button" disabled><span>LEAVE</span></button>
          </div>
          <button id="manual-room-start" className="room-art-button local-battle accent" type="button" disabled><span>START ONLINE</span></button>
          <div className="manual-room-divider"><span>OR</span></div>
          <button className="room-art-button local-battle" type="button" onClick={() => window.startManualLocalMatch?.()}><span>PLAY LOCAL BATTLE</span></button>
          <button className="manual-room-back" type="button" onClick={() => window.closeManualRoomLobby?.()}>← CHANGE CHAMPIONS</button>
        </section>
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
      <CombatPanelSide side={2} />
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
