import React, { useEffect, useRef, useState } from 'react';
import { attachBootStartViewportGuard } from './game/bootStartViewportGuard.js';
import {
  loadBattleGameRuntimes,
  loadDeferredGameRuntimes,
  loadMenuInteractiveRuntimes,
  loadProductMusicBootRuntime,
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
import { GOLD_SHELL_URL, HERO_BATTLE_RIGS, HERO_BATTLE_RIG_ASSETS } from './game/goldAssetManifest.js';
import { installSceneTransitionCoordinator } from './game/sceneTransitionCoordinator.js';
import goldFontParityCSS from './game/goldFontParity.css?raw';

const once = { loaded: false };
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
        window.__apexEnsureBattleRuntimes = loadBattleGameRuntimes;
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
  // Product music lifecycle is owned by productMusicAuthority. React keeps
  // only the single persistent element ref for diagnostics/fallback cleanup.
  const [gameReady, setGameReady] = useState(false);

  useEffect(() => {
    // In-battle hero rig intent (ONE authority, generated): the product asset
    // runtime preloads these with the match so a hero body never loads during
    // the first visible frames (owner report: MAGNET showed nothing at all,
    // FROST loaded later than the others). Published read-only for the classic
    // product runtimes, which cannot import the bundle.
    window.APEX_HERO_RIGS = HERO_BATTLE_RIGS;
    window.APEX_HERO_RIG_ASSETS = HERO_BATTLE_RIG_ASSETS;
    return () => {
      if (window.APEX_HERO_RIGS === HERO_BATTLE_RIGS) delete window.APEX_HERO_RIGS;
      if (window.APEX_HERO_RIG_ASSETS === HERO_BATTLE_RIG_ASSETS) delete window.APEX_HERO_RIG_ASSETS;
    };
  }, []);

  useEffect(() => {
    const canvas = document.getElementById('apex-scene-transition');
    const blackout = document.getElementById('apex-boot-blackout');
    const contentRoot = document.getElementById('gold-shell-host');
    const coordinator = installSceneTransitionCoordinator({ canvas, blackout, contentRoot });
    const onBootTransitionComplete = () => {
      markLoaderHidden();
      window.dispatchEvent(new CustomEvent('apex:boot-interactive'));
    };
    window.addEventListener('apex:boot-transition-complete', onBootTransitionComplete);
    return () => {
      window.removeEventListener('apex:boot-transition-complete', onBootTransitionComplete);
      if (window.APEX_SCENE_TRANSITION === coordinator) {
        // The product root normally lives for the whole page. HMR/test unmounts
        // still release the Gold engine RAF + resize listener before reinstall.
        coordinator.dispose?.();
        delete window.APEX_SCENE_TRANSITION;
      }
    };
  }, []);

  useEffect(() => {
    if (once.loaded) return undefined;
    let cancelled = false;
    // Cache-bust the classic engine the same way as the other public
    // runtimes so a stable Cloudflare alias can never serve stale bytes.
    const engineSrc = `/apexEngine.js?v=${APEX_ARSENAL_RUNTIME_REVISION}`;

    const boot = async () => {
      markBootPhase('boot-start');
      preloadRuntimeSources();
      await injectApexEngine(scriptRef, engineSrc);
      if (cancelled) return;
      once.loaded = true;
      setGameReady(true);
      markBootInteractive();
      markBootPhase('menu-interactive');
      // Tier 2 stays opportunistic and never blocks the visible Home reveal.
      scheduleDeferredGameRuntimes();
    };

    boot().catch((error) => {
      console.warn('[asset-loader] Boot failed.', error);
      document.body.dataset.apexBootError = 'true';
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
    // E1 — boot music is independent of apexEngine. The initial Mechanical
    // Door starts immediately; in parallel we fetch/evaluate ONLY the one
    // Forward Drive authority runtime. As soon as it exists, the boot scene is
    // announced as "transition", which causes the authority itself to issue
    // the earliest honest play() request on its ONE persistent media element.
    //
    // If browser autoplay policy rejects that request, the authority records
    // blocked=true and arms its one-shot gesture unlock. We never claim audible
    // playback from preload/readiness alone, and we never create a second
    // element as a workaround.
    let disposed = false;
    let musicHandle = null;
    let audio = null;

    const exposeMusicDiagnostics = (musicAuthority) => {
      window.__apexMenuBgmState = () => {
        const a = menuAudioRef.current;
        if (!a) return null;
        const st = musicAuthority?.state?.() || null;
        const diag = musicAuthority?.diagnostics?.() || null;
        return {
          preload: a.preload,
          readyState: a.readyState,
          networkState: a.networkState,
          paused: st ? st.paused : a.paused,
          src: st ? st.src : (a.currentSrc || a.src),
          blocked: st ? !!st.blocked : null,
          requested: diag ? diag.requested : null,
          success: diag ? diag.success : null,
          rejected: diag ? diag.rejected : null,
          surface: st && st.surface ? st.surface.id : null,
        };
      };
    };

    const installBootMusic = async () => {
      try {
        await loadProductMusicBootRuntime();
        if (disposed) return;

        musicHandle = window.installProductMusicAuthority
          ? window.installProductMusicAuthority({
            window, document,
            allowedSurfaces: [...MENU_MUSIC_ALLOWED_SURFACES],
          })
          : window.__apexProductMusicHandle || null;

        audio = musicHandle?.audio || window.__apexProductMusicHandle?.audio || null;
        const musicAuthority = musicHandle?.api || window.apexProductMusic || null;
        if (!audio || !musicAuthority) return;

        audio.__apexMenuMusic = true;
        menuAudioRef.current = audio;
        window.apexProductMusic = musicAuthority;
        exposeMusicDiagnostics(musicAuthority);

        window.apexStopMenuMusic = () => {
          if (typeof musicAuthority.fadeOut === 'function') {
            musicAuthority.fadeOut(MENU_MUSIC_FADE_MS);
            return;
          }
          audio.pause();
        };
        window.apexPlayMenuMusic = () => {
          const st = musicAuthority.state?.();
          if (!st || !st.allowed) return;
          if (typeof musicAuthority.request === 'function') {
            musicAuthority.request('legacy-menu');
            return;
          }
          audio.volume = MENU_MUSIC_VOLUME;
          const p = audio.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        };

        // Critical ordering: "transition" is published here, before Gold Home
        // is mounted/READY. setSurface owns the play() request, so boot playback
        // begins during the loading transition when policy permits it.
        musicAuthority.setSurface?.('transition');
        window.__apexBootThemeRequested = true;
      } catch (error) {
        // Audio failure may not strand the boot door or the Home surface.
        // The state is explicit so owner/browser diagnostics can distinguish
        // "runtime failed" from an ordinary NotAllowedError autoplay block.
        window.__apexBootThemeRequested = false;
        window.__apexBootThemeError = String(error?.message || error);
        console.warn('[product-music] Boot theme authority failed to load.', error);
      }
    };

    window.__apexBootMusicReady = installBootMusic();

    return () => {
      disposed = true;
      if (audio) audio.pause();
      if (menuAudioRef.current === audio) menuAudioRef.current = null;
      if (window.apexStopMenuMusic) delete window.apexStopMenuMusic;
      if (window.apexPlayMenuMusic) delete window.apexPlayMenuMusic;
      if (window.__apexMenuBgmState) delete window.__apexMenuBgmState;
      delete window.__apexBootThemeRequested;
      delete window.__apexBootThemeError;
      delete window.__apexBootMusicReady;
      if (musicHandle && typeof musicHandle.dispose === 'function') musicHandle.dispose();
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
        // The Gold document is executable product UI. Never pin stale HTML in a returning browser.
        const response = await fetch(GOLD_SHELL_URL, { cache: 'no-cache' });
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

        // Typeface must not drift between desktop and mobile platform font
        // fallbacks. The Gold source is generated; do NOT edit donor CSS.
        // Mount the localized font faces + single parity layer AFTER donor
        // styles so both shell and embedded battle use the same WOFF2 bytes.
        const faceSheet = document.createElement('link');
        faceSheet.rel = 'stylesheet';
        faceSheet.href = '/gold/fonts.css';
        faceSheet.id = 'apex-gold-font-faces';
        const fontSheetReady = new Promise((resolve) => {
          faceSheet.onload = () => resolve(true);
          faceSheet.onerror = () => resolve(false);
        });
        host.appendChild(faceSheet);
        const paritySheet = document.createElement('style');
        paritySheet.id = 'apex-gold-font-parity';
        paritySheet.textContent = goldFontParityCSS;
        host.appendChild(paritySheet);
        const facesLoaded = await fontSheetReady;
        if (facesLoaded) {
          try {
            await Promise.all([
              document.fonts.load('400 16px Oswald'),
              document.fonts.load('700 36px Oswald'),
            ]);
          } catch (error) {
            console.warn('[apex-gold-font-parity] localized face unavailable', error);
          }
        } else {
          // Font failure is visible to diagnostics, never a permanent
          // boot/transition block if an asset server is temporarily down.
          console.warn('[apex-gold-font-parity] font stylesheet failed');
        }

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
        // R76 diagnostic only: inspect Android's real visual viewport and tap stack.
        // No layout/style/interaction changes. Available in DevTools as
        // window.__apexHomeInputDiagnostics.snapshot().
        if (!window.__apexHomeInputDiagnostics) {
          const snapshot = () => {
            const rect = (selector) => {
              const el = document.querySelector(selector);
              if (!el) return null;
              const r = el.getBoundingClientRect();
              const css = getComputedStyle(el);
              return { x:r.x, y:r.y, width:r.width, height:r.height,
                bottom:r.bottom, zIndex:css.zIndex, pointerEvents:css.pointerEvents };
            };
            const a=rect('#freeBattle'), b=rect('#stage .routes');
            const overlap=Boolean(a&&b&&a.x < b.x+b.width&&a.x+a.width>b.x&&a.y<b.bottom&&a.bottom>b.y);
            return { url:location.href, shell:GOLD_SHELL_URL,
              inner:{ width:innerWidth,height:innerHeight },
              visual:window.visualViewport?{width:visualViewport.width,height:visualViewport.height,
                offsetTop:visualViewport.offsetTop,offsetLeft:visualViewport.offsetLeft,scale:visualViewport.scale}:null,
              battle:a,routes:b,overlap };
          };
          let lastOverlap=false;
          const measure=()=>{
            const d=snapshot();
            if(d.overlap!==lastOverlap){lastOverlap=d.overlap;
              if(d.overlap)console.warn('[apex-home-hit-test] overlap detected',d);
            }
          };
          const tap=(e)=>{
            const target=e.target?.closest?.('#freeBattle,#stage .routes,.route');
            if(!target)return;
            const d=snapshot();
            console.info('[apex-home-hit-test] input', { target:target.id||target.className,
              type:e.type, hit:document.elementFromPoint(e.clientX,e.clientY)?.id||
              document.elementFromPoint(e.clientX,e.clientY)?.className, geometry:d });
          };
          window.__apexHomeInputDiagnostics={snapshot};
          window.addEventListener('resize',measure,{passive:true});
          window.visualViewport?.addEventListener('resize',measure,{passive:true});
          window.visualViewport?.addEventListener('scroll',measure,{passive:true});
          document.addEventListener('pointerdown',tap,{capture:true,passive:true});
          requestAnimationFrame(measure);
        }
        // R78: production-only Home geometry authority.
        // The donor shell is imported into React's document, so viewport units
        // observed by a standalone /gold/shell.html test are not authoritative.
        // Measure the ACTUAL two button bands after mount instead of assuming
        // that a particular phone aspect ratio predicts their hit rectangles.
        if (!window.__apexHomeGeometryGuard) {
          const stage = document.getElementById('stage');
          const actions = stage?.querySelector('.actions');
          const routes = stage?.querySelector('.routes');
          const story = stage?.querySelector('.story');
          // R86: evaluate the existing geometry authority in an opt-in lab.
          // No effect at all on ordinary Gold URLs.
          const homeSolverLab = new URLSearchParams(window.location.search).get('apexHomeSolver') === '1';
          if (stage && actions && routes) {
            let scheduled = false;
            let last = null;
            const layout = () => {
              scheduled = false;
              if (!stage.isConnected) return;
              const portrait = matchMedia('(orientation: portrait)').matches;
              const home = !stage.classList.contains('screen-mode')
                && !stage.classList.contains('screen-fighter')
                && !stage.classList.contains('screen-battle');
              if (!portrait || !home) {
                actions.style.removeProperty('top');
                actions.style.removeProperty('transition-property');
                if (homeSolverLab && story) {
                  story.style.removeProperty('top');
                  story.style.removeProperty('transition-property');
                }
                return;
              }
              // Gold flow animations include "top" in their transition list.
              // During Chrome mobile viewport changes that interpolates HITBOXES
              // toward stale coordinates for 380ms. Preserve scene fades/slide
              // but make all measured Home geometry changes atomic.
              actions.style.transitionProperty = 'opacity, transform, translate, filter';
              const stageRect = stage.getBoundingClientRect();
              const bandRect = routes.getBoundingClientRect();
              const actionRect = actions.getBoundingClientRect();
              if (!(stageRect.height > 0 && actionRect.height > 0)) return;
              const compact = matchMedia('(max-height: 700px)').matches;
              const authoredTop = stageRect.height * (compact ? .654 : .671);
              // R86 opt-in: the painted route bar can still be translating
              // after Home readiness. getBoundingClientRect() includes that
              // temporary transform and yields a stale, too-low ceiling.
              // offsetTop is the layout position before transitions. The
              // routes live directly under #stage, so their offset is stable.
              const stableRouteTop = homeSolverLab && routes.offsetParent === stage
                ? routes.offsetTop
                : bandRect.top - stageRect.top;
              const ceiling = stableRouteTop - actionRect.height - 10;
              const top = Math.max(0, Math.min(authoredTop, ceiling));
              actions.style.top = top.toFixed(2) + 'px';
              let storyGeometry = null;
              if (homeSolverLab && story) {
                // One authority for both stacked content islands. Always
                // remeasure the donor's *authored* story top, never the last
                // corrective value (prevents cumulative resize drift).
                story.style.transitionProperty = 'opacity, transform, translate, filter';
                story.style.removeProperty('top');
                const sr = story.getBoundingClientRect();
                const authoredStoryTop = sr.top - stageRect.top;
                const storyCeiling = top - sr.height - 12;
                const minStoryTop = stageRect.height * .18;
                const storyTop = Math.max(minStoryTop, Math.min(authoredStoryTop, storyCeiling));
                if (storyTop < authoredStoryTop - .5) {
                  story.style.top = storyTop.toFixed(2) + 'px';
                }
                storyGeometry = {
                  authoredStoryTop, storyTop, storyHeight: sr.height,
                  storyCeiling, storyToActions: top - storyTop - sr.height,
                  feasible: storyCeiling >= minStoryTop
                };
              }
              last = { stageHeight: stageRect.height, authoredTop, top,
                ceiling, shifted: top < authoredTop - .5,
                gap: bandRect.top - (stageRect.top + top + actionRect.height),
                story: storyGeometry };
              if (last.shifted) {
                console.info('[apex-home-geometry] short portrait safety constraint', last);
              }
            };
            const request = () => {
              if (scheduled) return;
              scheduled = true;
              requestAnimationFrame(layout);
            };
            const observer = new ResizeObserver(request);
            observer.observe(stage);
            observer.observe(actions);
            observer.observe(routes);
            if (homeSolverLab && story) observer.observe(story);
            const mutation = new MutationObserver(request);
            mutation.observe(stage, { attributes:true, attributeFilter:['class'] });
            window.addEventListener('resize', request, { passive:true });
            window.addEventListener('orientationchange', request, { passive:true });
            window.visualViewport?.addEventListener('resize', request, { passive:true });
            window.visualViewport?.addEventListener('scroll', request, { passive:true });
            window.__apexHomeGeometryGuard = {
              snapshot: () => ({ ...last, visualHeight: window.visualViewport?.height ?? null }),
              remeasure: request,
              dispose: () => {
                observer.disconnect();
                mutation.disconnect();
                window.removeEventListener('resize', request);
                window.removeEventListener('orientationchange', request);
                window.visualViewport?.removeEventListener('resize', request);
                window.visualViewport?.removeEventListener('scroll', request);
                actions.style.removeProperty('top');
                actions.style.removeProperty('transition-property');
                if (homeSolverLab && story) {
                  story.style.removeProperty('top');
                  story.style.removeProperty('transition-property');
                }
                delete window.__apexHomeGeometryGuard;
              },
            };
            request();
          }
        }
        host.dataset.apexGoldMounted = '1';
        document.body.classList.add('apex-gold-mounted');
        // Boot READY includes the explicit Home Core asset set (including CSS
        // layer art), then the coordinator verifies DOM decode/font/layout.
        if (window.APEX_GOLD?.prepareSurface) {
          await window.APEX_GOLD.prepareSurface('home');
        }
        // Owner boot START: user gesture is needed for reliable audible music.
        // Home assets are settled BEFORE this control is shown; the mechanical
        // door remains closed until the player's explicit START interaction.
        // START must not become actionable before the single music authority has
        // loaded (a fast Home mount can otherwise race the async audio module).
        await window.__apexBootMusicReady;
        if (cancelled) return;
        // Decode the only START art before presenting it; Home and music readiness
        // remain the authority. The original vector is a safe asset-failure fallback.
        const startArtUrl = '/assets/ui/apex-transition-start-r72.webp';
        const startArt = new Image();
        startArt.src = startArtUrl;
        try { await startArt.decode(); } catch (_) {}
        if (cancelled) return;
        await new Promise((resolve) => {
          if (cancelled) { resolve(); return; }
          const start = document.createElement('button');
          start.type = 'button';
          start.id = 'apex-boot-start';
          start.innerHTML = '<img class="apex-boot-start-art" src="' +
            (startArt.naturalWidth ? startArtUrl : '/assets/ui/apex-transition-start-plate.svg') +
            '" alt="" draggable="false">';
          start.setAttribute('aria-label', 'Start APEX CHAOS');
          start.className = 'apex-boot-start-plate';
          let activated = false;
          let stopStartGuard = () => {};
          const activateStart = () => {
            if (activated) return;
            activated = true;
            stopStartGuard();
            // Hide in the same trusted input event, before requesting Door OPEN.
            // Do not defer this to transition timing or any async audio callback.
            start.remove();
            try {
              const music = window.apexProductMusic;
              if (music?.request) music.request('boot-start');
              else window.apexPlayMenuMusic?.();
            } catch (error) { console.warn('[boot-start] music request', error); }
            resolve();
          };
          start.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            activateStart();
          });
          // Enter/Space and assistive activation use click.
          start.addEventListener('click', activateStart);
          document.body.appendChild(start);
          stopStartGuard = attachBootStartViewportGuard(start);
        });
        if (cancelled) return;
        await window.APEX_SCENE_TRANSITION?.signalBootReady?.();
        // Publish state only after the complete boot handshake: setting this
        // earlier triggers the effect cleanup, setting cancelled=true while
        // Home preparation / START is still pending.
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
    <div id="apex-boot-blackout" aria-hidden="true" />
    <canvas id="apex-scene-transition" aria-hidden="true" />
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
