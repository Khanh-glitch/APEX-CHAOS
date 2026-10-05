import React, { useEffect, useRef, useState } from 'react';
import {
  loadDeferredGameRuntimes,
  loadMenuInteractiveRuntimes,
  scheduleDeferredGameRuntimes,
} from './game/runtimeLoader.js';
import { APEX_ARSENAL_RUNTIME_REVISION, preloadRuntimeSources } from './game/runtimeManifest.js';
import {
  getProductSurface,
  installProductSurfaceAuthority,
} from './game/productSurface.js';
import {
  beginPerfSpan,
  markBootInteractive,
  markBootPhase,
  markLoaderHidden,
} from './game/performanceMetrics.js';
import { GOLD_SHELL_URL } from './game/goldAssetManifest.js';

const once = { loaded: false };
const LOADING_ASSETS = {
  bgPortrait: '/assets/ui_2026/loading-bg-portrait.webp',
  bgLandscape: '/assets/ui_2026/loading-bg-landscape.webp',
  gameTitle: '/assets/ui_2026/game-name-icon.webp',
  loadingBarFrame: '/assets/loading/loading-bar-frame.webp',
};

// §A4 / 2026-10-05 correction slice — ONE product music authority.
// The single existing menu-media element IS the product theme element: there
// is exactly one persistent HTMLMediaElement for product music (the Gold
// bridge must never create a second Audio for music) and its source is the
// owner Forward Drive theme (AV preload), not a second menu BGM.
// Owner law: music fades in/out over ~300–450ms.
const MENU_MUSIC_FADE_MS = 380;
const MENU_MUSIC_VOLUME = 0.48;
// Product surfaces where the Forward Drive theme is allowed. Everything else
// (Lucky Draw, Upgrade, Missions, Shop, an actual match) is music-off.
const MENU_MUSIC_ALLOWED_SURFACES = new Set(['home', 'mode', 'fighter', 'transition']);

const LOADING_LABELS = ['LOADING ASSETS', 'PREPARING ARENA', 'SYNCHRONIZING VFX'];
const IMAGE_PRELOAD_TIMEOUT_MS = 7000;
const LOADER_READY_HOLD_MS = 160;
const LOADER_FADE_MS = 280;

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
  return [
    { path: loadingBackground, type: 'image', required: true },
    { path: LOADING_ASSETS.gameTitle, type: 'image', required: true },
    { path: LOADING_ASSETS.loadingBarFrame, type: 'image', required: true },
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
        try { window.startMatch = startMatch; } catch (error) {}
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
  // Reassert on hot reloads / test mounts before any deferred classic script.
  installProductSurfaceAuthority(window);
  const scriptRef = useRef(null);
  const menuAudioRef = useRef(null);
  const menuAudioWasPlayingRef = useRef(false);
  // Product music lifecycle is owned by productMusicAuthority. React keeps
  // only the single persistent element ref for diagnostics/fallback cleanup.
  const [gameReady, setGameReady] = useState(false);
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

  const stopMenuMusic = () => {
    const audio = menuAudioRef.current;
    if (!audio) return;
    // The ONE product music authority owns stop/fade semantics. Compatibility
    // callers may ask to "reset", but owner law forbids seeking the theme.
    const authority = window.apexProductMusic;
    if (authority && typeof authority.fadeOut === 'function') {
      authority.fadeOut(MENU_MUSIC_FADE_MS);
      return;
    }
    // Fallback only when the authority failed to install: pause in place.
    audio.pause();
  };

  const playMenuMusic = () => {
    const audio = menuAudioRef.current;
    if (!audio) return;
    // Playback is requested through the ONE product music authority so browser
    // rejection and interruption recovery share one state machine.
    const musicAuthority = window.apexProductMusic;
    if (musicAuthority && typeof musicAuthority.request === 'function') {
      musicAuthority.request('menu');
      return;
    }
    // Without the authority there is no semantic surface owner. Fail silent
    // rather than guessing from retired DOM; the next Gold surface event will
    // use the installed authority in normal production.
    if (!window.apexProductMusic) {
      audio.pause();
      return;
    }
    audio.volume = 0.48;
    const playPromise = audio.play();
    if (playPromise && playPromise.catch) playPromise.catch(() => {});
  };

  useEffect(() => {
    // ── the one product music authority (owner law 2026-10-05) ────────────
    // Home / Mode / Fighter select / battle-entry transition keep the Forward
    // Drive theme playing continuously; Lucky Draw / Upgrade / Missions / Shop
    // and a live match do not. A match start fades the theme OUT and the
    // result/return fades it back IN from the preserved playhead. The single
    // persistent element, the surface policy, the fades and the M mute all
    // live in the product music runtime; this effect only installs it and
    // publishes it for the Gold bridge (never a second music manager).
    const music = window.installProductMusicAuthority
      ? window.installProductMusicAuthority({
        window, document,
        allowedSurfaces: [...MENU_MUSIC_ALLOWED_SURFACES],
      })
      : null;
    // ONE persistent product-music element in the whole product: the one the
    // authority owns. The App deliberately does NOT create its own Audio here
    // (a second element would be a second product music source). §A4 — the
    // authority warms the theme in the background before the first user
    // gesture; preload never blocks menu interactivity and playback still
    // respects autoplay policy (no forced audible autoplay).
    const audio = (music && music.audio) ? music.audio : null;
    if (audio) {
      audio.__apexMenuMusic = true;
      menuAudioRef.current = audio;
    }
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
    window.apexStopMenuMusic = () => stopMenuMusic();
    window.apexPlayMenuMusic = () => playMenuMusic();
    const musicAuthority = music ? music.api : null;
    if (musicAuthority) {
      window.apexProductMusic = musicAuthority;
      // Legacy menu-music probes keep reading the SAME element.
      window.__apexMenuBgmState = () => {
        const st = musicAuthority.state();
        if (!st || !audio) return null;
        return {
          preload: audio.preload, readyState: audio.readyState, networkState: audio.networkState,
          paused: st.paused, src: st.src,
        };
      };
      // Compatibility names must never seek the product theme. Surface changes
      // pause/fade the ONE persistent element and resume the same playhead.
      window.apexStopMenuMusic = () => {
        if (typeof musicAuthority.fadeOut === 'function') {
          musicAuthority.fadeOut(MENU_MUSIC_FADE_MS);
          return;
        }
        audio?.pause();
      };
      window.apexPlayMenuMusic = () => {
        const st = musicAuthority.state();
        if (!st || !st.allowed || !audio) return;
        // Route through the authority's request() so a blocked autoplay arms
        // the ONE temporary gesture-unlock set instead of failing silently.
        if (typeof musicAuthority.request === 'function') {
          musicAuthority.request('legacy-menu');
          return;
        }
        audio.volume = MENU_MUSIC_VOLUME;
        const p = audio.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      };
    }

    // CP7: re-armed on every interaction (NOT once) — if a resume was ever
    // missed (transient blur/hidden state at the exit-to-menu handoff), the
    // next click/keypress heals the menu music instead of leaving the menu
    // silent for the rest of the session. playMenuMusic no-ops when already
    // playing or when no menu screen is visible.
    // This is a MENU-RESUME path on the SAME single element; the autoplay
    // unlock itself is the ONE temporary listener set owned by the product
    // music authority (pointerdown/touchstart/keydown/click, removed after
    // success) — never a second element, AudioContext or unlock set.
    const unlock = () => playMenuMusic();
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
      playMenuMusic();
    };
    const handleVisibility = () => {
      if (document.hidden) pauseForHiddenTab();
      else resumeForVisibleTab();
    };
    // The product authority owns autoplay unlock + hidden/blur lifecycle.
    // Keep these legacy listeners ONLY as a fallback when that authority could
    // not be installed; otherwise two independent pause-state memories race.
    const useLegacyMusicLifecycle = !musicAuthority;
    if (useLegacyMusicLifecycle) {
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('blur', pauseForHiddenTab);
      window.addEventListener('focus', resumeForVisibleTab);
    }

    return () => {
      if (useLegacyMusicLifecycle) {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('blur', pauseForHiddenTab);
        window.removeEventListener('focus', resumeForVisibleTab);
      }
      if (audio) audio.pause();
      menuAudioRef.current = null;
      if (window.apexStopMenuMusic) delete window.apexStopMenuMusic;
      if (window.apexPlayMenuMusic) delete window.apexPlayMenuMusic;
      if (window.__apexMenuBgmState) delete window.__apexMenuBgmState;
      if (music && typeof music.dispose === 'function') music.dispose();
    };
  }, []);

  const launchProductSurface = async (surfaceId, { admin = false } = {}) => {
    const surface = getProductSurface(surfaceId);
    const authority = window.APEX_PRODUCT_SURFACE;
    if (!surface || !authority?.canLaunch?.(surface.id, { admin })) return false;
    if (!gameReady) return false;

    if (surface.route === 'shop' || surface.route === 'draw' || surface.route === 'local' || surface.route === 'bot') {
      await loadDeferredGameRuntimes('arsenalHub');
      const meta = window.APEX_ARSENAL_META;
      if (!meta) throw new Error('Arsenal product meta runtime did not register.');
      if (surface.route === 'shop') meta.paintShop?.();
      if (surface.route === 'draw') meta.paintDraw?.();
      if (surface.route === 'local') meta.openFreePick?.();
      if (surface.route === 'bot') meta.openBotPick?.();
      return true;
    }

    if (surface.route === 'lab' && admin) {
      // ADMIN only: the real Lab keeps the accepted Arsenal battle core. It
      // is deliberately launchable through this seam but absent from public UI.
      await loadDeferredGameRuntimes('arsenalProduct');
      stopMenuMusic();
      const ready = window.apexArsenalGameplayBarrierSync?.('lab')
        || await window.apexArsenalGameplayBarrier?.('lab');
      if (ready === false) return false;
      window.startArsenalLab?.();
      return true;
    }
    return false;
  };

  // ── Gold product shell ──────────────────────────────────────────────────
  // The Gold pack (docs/gold-ui/current, owner authority) is the visible
  // product UI: Home, Mode/Fighter select, Lucky Draw and the Battle HUD.
  // Production truth stays in this document — the engine canvas, runtimes and
  // economy — and public/game/gold/goldProductBridge.js is the only seam.
  // The canonical iframe boundary is relaxed ONLY so the live arena canvas can
  // occupy the donor's authored arena slot (same-document mount).
  const [goldReady, setGoldReady] = useState(false);
  useEffect(() => {
    if (!gameReady || goldReady) return;
    const host = document.getElementById('gold-shell-host');
    if (!host || host.dataset.apexGoldMounted === '1') return;
    let cancelled = false;
    const mountGoldShell = async () => {
      try {
        // Shop/Draw/selection save + shell authority (hub group) before mount.
        await loadDeferredGameRuntimes('arsenalHub');
        const response = await fetch(GOLD_SHELL_URL, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`gold shell HTTP ${response.status}`);
        const html = await response.text();
        if (cancelled) return;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const base = doc.createElement('base');
        base.href = '/gold/';
        doc.head.insertBefore(base, doc.head.firstChild);
        const executableScripts = [...doc.querySelectorAll('script')].filter((node) => {
          const type = String(node.getAttribute('type') || '').toLowerCase();
          return !type || type === 'text/javascript' || type === 'application/javascript' || type === 'module';
        });
        // DOMParser-created executable scripts are inert. Snapshot their authored
        // order/bytes, then REMOVE them before importing the Gold DOM so there is
        // exactly one execution path. Non-executable payload scripts (notably
        // #battleHudPayload text/plain) remain in the imported DOM.
        const scriptPlan = executableScripts.map((node) => ({
          type: String(node.getAttribute('type') || '').toLowerCase(),
          src: node.getAttribute('src') || '',
          text: node.textContent || '',
        }));
        executableScripts.forEach((node) => node.remove());

        for (const node of [...doc.head.children]) host.appendChild(document.importNode(node, true));
        for (const node of [...doc.body.children]) host.appendChild(document.importNode(node, true));

        // The background deferred-runtime queue can race the Gold mount. Match
        // script identity by resolved URL (relative/absolute spellings are the
        // same resource), and share the data-apex-loaded contract so neither
        // side double-loads nor waits forever on an already-finished script.
        const findExistingGoldScript = (src) => {
          const baseUrl = document.baseURI || window.location.href;
          let target;
          try { target = new URL(src, baseUrl).href; } catch (error) { target = String(src); }
          for (const node of document.querySelectorAll('script[src]')) {
            const raw = node.getAttribute('src');
            if (!raw) continue;
            let candidate;
            try { candidate = new URL(raw, baseUrl).href; } catch (error) { candidate = raw; }
            if (candidate === target) return node;
          }
          return null;
        };

        for (const planned of scriptPlan) {
          if (cancelled) return;
          const run = document.createElement('script');
          if (planned.type) run.type = planned.type;
          if (planned.src) {
            const existing = findExistingGoldScript(planned.src);
            if (existing) {
              if (existing.dataset.apexLoaded !== 'true') {
                await new Promise((resolve, reject) => {
                  existing.addEventListener('load', () => {
                    existing.dataset.apexLoaded = 'true';
                    resolve();
                  }, { once: true });
                  existing.addEventListener('error', () => reject(new Error(`gold script failed: ${planned.src}`)), { once: true });
                });
              }
              continue;
            }
            await new Promise((resolve, reject) => {
              run.onload = () => {
                run.dataset.apexLoaded = 'true';
                resolve();
              };
              run.onerror = () => reject(new Error(`gold script failed: ${planned.src}`));
              // Preserve the authored raw src instead of src.src (which becomes
              // absolute and breaks the runtime loader's shared identity).
              run.src = planned.src;
              run.async = false;
              host.appendChild(run);
            });
          } else if (planned.type === 'module') {
            await new Promise((resolve, reject) => {
              run.onload = resolve;
              run.onerror = () => reject(new Error('gold inline module failed'));
              run.textContent = planned.text;
              host.appendChild(run);
            });
          } else {
            run.textContent = planned.text;
            host.appendChild(run);
          }
        }
        host.dataset.apexGoldMounted = '1';
        document.body.classList.add('apex-gold-mounted');
        setGoldReady(true);
      } catch (error) {
        console.warn('[gold-shell] Gold product shell mount failed.', error);
      }
    };
    mountGoldShell();
    return () => { cancelled = true; };
  }, [gameReady, goldReady]);

  useEffect(() => {
    const launchAdminLab = () => launchProductSurface('arsenal-lab', { admin: true });
    const launchAny = (id, options = {}) => launchProductSurface(id, options);
    window.apexLaunchArsenalLab = launchAdminLab;
    window.apexLaunchProductSurface = launchAny;
    return () => {
      if (window.apexLaunchArsenalLab === launchAdminLab) delete window.apexLaunchArsenalLab;
      if (window.apexLaunchProductSurface === launchAny) delete window.apexLaunchProductSurface;
    };
  }, [gameReady]);

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
    {/* Gold is the only public product surface. The host below the Gold mount
        contains engine/combat infrastructure only; no legacy menu or picker DOM. */}
    <div id="gold-shell-host" aria-label="APEX CHAOS product surface" />
    {/* Engine-owned battle infrastructure remains mounted for production truth.
        Gold relocates the live canvas into its authored arena during battle. */}
    <div id="battle-shell">
      <CombatPanelSide side={1} />
    <div id="game-wrapper">
      <canvas id="game-canvas" width="1000" height="1000" />

      <div id="countdown-overlay">
        <div className="count-num" id="countdown-num">3</div>
        <div className="count-sub" id="countdown-sub">ARSENAL BATTLE</div>
      </div>

      <div className="ui-layer" id="hud" style={{ opacity: 0 }} />



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
