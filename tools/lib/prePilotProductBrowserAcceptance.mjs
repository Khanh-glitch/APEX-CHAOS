// Current-product real-browser acceptance for the pre-pilot cutover.
// This is intentionally driven by the same CDP physical-pointer helper as the
// Arsenal browser suite; it is not a DOM-only or direct-call substitute for UI
// navigation. The suite runs BEFORE the historical Arsenal compatibility group
// is explicitly requested.

const PUBLIC_IDS = [
  'quest-01', 'bot-battle', 'local-1v1', 'fighter-shop', 'lucky-draw',
  'fighter-upgrade', 'dictionary', 'missions', 'achievements', 'account-profile',
];
const ACTIVE_IDS = ['bot-battle', 'local-1v1', 'fighter-shop', 'lucky-draw'];
const LOCKED_IDS = [
  'quest-01', 'fighter-upgrade', 'dictionary', 'missions', 'achievements', 'account-profile',
];
const CORE_SIX = ['ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR'];
const LOCKED_FIGHTERS = ['BLACK_HOLE', 'MATH_V2', 'RUBBER', 'TIME', 'SLIME', 'SNIPER'];
const META_KEY = 'apexChaos.arsenalMeta.v1';

export async function runPrePilotProductBrowserAcceptance({
  evaluate,
  hitProbe,
  physicalClick,
  screenshot,
  setViewport,
  navigate,
  appUrl,
  sleep,
  gate,
  evidence,
}) {
  const result = {};
  const pass = (name, ok, detail) => {
    result[name] = { pass: !!ok, detail };
    gate(name, !!ok, detail);
  };

  async function poll(expression, predicate = Boolean, { attempts = 100, interval = 100 } = {}) {
    for (let i = 0; i < attempts; i++) {
      let value;
      try { value = await evaluate(expression); } catch { value = null; }
      if (predicate(value)) return value;
      await sleep(interval);
    }
    try { return await evaluate(expression); } catch { return null; }
  }

  async function menuReady() {
    return poll(`(() => {
      const menu = document.getElementById('menu-screen');
      const cards = [...document.querySelectorAll('#menu-screen [data-product-surface]')];
      return {
        visible: !!menu && !menu.classList.contains('hidden'),
        cardCount: cards.length,
        cardsEnabled: cards.length === 10 && cards.every(card => !card.disabled),
        productReady: window.__apexDeferredRuntimesReady_arsenalProduct === true,
        metaReady: !!(window.APEX_ARSENAL_META && window.APEX_ARSENAL_META.getState),
      };
    })()`, value => value && value.visible && value.cardsEnabled && value.productReady && value.metaReady,
    { attempts: 160, interval: 100 });
  }

  async function awaitMenu() {
    let state = await poll(`(() => ({
      visible: !document.getElementById('menu-screen')?.classList.contains('hidden'),
      gameState: typeof gameState === 'undefined' ? null : gameState,
      dialog: !!document.querySelector('.product-lock-dialog'),
    }))()`, value => value && value.visible && !value.dialog, { attempts: 80, interval: 100 });
    if (!state || !state.visible || state.dialog) {
      // Cleanup fallback only; the proof itself uses physical UI controls.
      await evaluate(`(() => { window.exitArsenalBattleMode?.(); window.exitArsenalLab?.(); window.goToMenu?.(); return true; })()`).catch(() => null);
      state = await poll(`(() => ({
        visible: !document.getElementById('menu-screen')?.classList.contains('hidden'),
        gameState: typeof gameState === 'undefined' ? null : gameState,
        dialog: !!document.querySelector('.product-lock-dialog'),
      }))()`, value => value && value.visible && !value.dialog, { attempts: 50, interval: 100 });
    }
    return state;
  }

  async function clickVisible(selector, { attempts = 50, interval = 80 } = {}) {
    let probe = null;
    for (let i = 0; i < attempts; i++) {
      try { probe = await hitProbe(selector); } catch { probe = null; }
      if (probe && probe.exists && !probe.disabled && probe.hitWithin
          && probe.pointerEvents !== 'none' && probe.width > 1 && probe.height > 1) {
        return await physicalClick(selector);
      }
      await sleep(interval);
    }
    return probe || { exists: false };
  }

  async function selectVisibleChampion(champion, { maxTurns = 8 } = {}) {
    // Confirm the focused carousel card only. A side card can be visible and
    // hit-testable while the picker is still mounting or moving, which makes
    // a physical click select the adjacent card during a cold route.
    const selector = `.apex-pick-card[data-champion="${champion}"][data-slot="focus"]`;
    let probe = null;
    let previousRect = null;
    let stableSamples = 0;
    for (let turn = 0; turn < maxTurns; turn++) {
      for (let sample = 0; sample < 6; sample++) {
        try { probe = await hitProbe(selector); } catch { probe = null; }
        const hitReady = probe && probe.exists && !probe.disabled && probe.hitWithin
          && probe.pointerEvents !== 'none' && probe.width > 1 && probe.height > 1;
        const rect = hitReady
          ? [probe.left, probe.top, probe.width, probe.height].map(value => Math.round(value * 10) / 10).join(',')
          : null;
        if (rect && rect === previousRect) stableSamples += 1;
        else stableSamples = 0;
        previousRect = rect;
        if (hitReady && stableSamples >= 2) {
          return await physicalClick(selector);
        }
        await sleep(80);
      }
      const arrow = await clickVisible('.apex-pick-button[aria-label="arrow-right"]', {
        attempts: 3, interval: 60,
      });
      if (!arrow.hitWithin) return probe || arrow;
      previousRect = null;
      stableSamples = 0;
      await sleep(520); // let the carousel finish before the next hit-test
    }
    return probe || { exists: false };
  }

  async function enterProduct(surfaceId) {
    await awaitMenu();
    const selector = `#menu-screen [data-product-surface="${surfaceId}"]`;
    const pointer = await clickVisible(selector);
    return { pointer, selector };
  }

  async function returnFromBattle(label) {
    const pointer = await clickVisible('#aq-battle-exit', { attempts: 70, interval: 80 });
    const menu = await awaitMenu();
    result[`${label}Exit`] = { pointer, menu };
    return result[`${label}Exit`];
  }

  await setViewport(1600, 900, false);
  const ready = await menuReady();

  // The boot/preload route must warm the active product group only. Exact
  // filename matching deliberately ignores arsenalQuestConfig.js, which is
  // shared compatibility data and is not the detached Quest runtime/ladder.
  result.runtimeWarmup = await evaluate(`(() => {
    const scriptUrls = [...document.scripts].map(node => node.src).filter(Boolean);
    const hintedUrls = [...document.querySelectorAll('link[href]')].map(node => node.href);
    const resources = performance.getEntriesByType('resource').map(entry => entry.name);
    const allUrls = [...scriptUrls, ...hintedUrls, ...resources];
    const isLegacyQuestFile = url => /\\/game\\/(modes\\/arsenalQuestRuntime|arsenal\\/arsenalQuestLadder)\\.js(?:[?#]|$)/.test(url);
    return {
      productReady: window.__apexDeferredRuntimesReady_arsenalProduct === true,
      questAliasReady: window.__apexDeferredRuntimesReady_arsenalQuest === true,
      legacyGroupReady: window.__apexDeferredRuntimesReady_arsenalLegacyQuest === true,
      battleRuntimeLoaded: scriptUrls.some(url => /\\/game\\/modes\\/arsenalBattleRuntime\\.js(?:[?#]|$)/.test(url)),
      questRuntimeLoaded: scriptUrls.some(url => /\\/game\\/modes\\/arsenalQuestRuntime\\.js(?:[?#]|$)/.test(url)),
      ladderLoaded: scriptUrls.some(url => /\\/game\\/arsenal\\/arsenalQuestLadder\\.js(?:[?#]|$)/.test(url)),
      legacyRequested: allUrls.some(isLegacyQuestFile),
      scriptUrls,
    };
  })()`);
  pass('warmup-active-arsenal-product-no-legacy-request',
    !!ready && ready.productReady === true
      && result.runtimeWarmup.productReady === true
      && result.runtimeWarmup.battleRuntimeLoaded === true
      && result.runtimeWarmup.questAliasReady === false
      && result.runtimeWarmup.legacyGroupReady === false
      && result.runtimeWarmup.questRuntimeLoaded === false
      && result.runtimeWarmup.ladderLoaded === false
      && result.runtimeWarmup.legacyRequested === false,
    { ready, runtime: result.runtimeWarmup });
  evidence.push(await screenshot('prepilot-product-menu-graph'));

  result.publicGraph = await evaluate(`(() => {
    const authority = window.APEX_PRODUCT_SURFACE;
    const graph = authority?.list?.() || [];
    const cards = [...document.querySelectorAll('#menu-screen [data-product-surface]')];
    const cardIds = cards.map(card => card.dataset.productSurface);
    const active = graph.filter(item => item.availability === 'ACTIVE').map(item => item.id);
    const locked = graph.filter(item => item.availability === 'LOCKED').map(item => item.id);
    const normalMenu = document.getElementById('menu-screen');
    const navText = normalMenu ? normalMenu.innerText : '';
    const retired = [
      'Classic Play', 'APEX CONTROL', '3-Phase', 'Tam Chien', 'Saitama Trial',
      'Tournament', 'Standalone Solo', 'ARSENAL QUEST', 'ARSENAL LAB',
    ];
    return {
      authorityVersion: authority?.version || null,
      graphIds: graph.map(item => item.id),
      cardIds,
      active,
      locked,
      availability: cards.map(card => card.dataset.availability),
      graphMatchesDom: JSON.stringify(graph.map(item => item.id)) === JSON.stringify(cardIds),
      retiredMentions: retired.filter(label => navText.toLowerCase().includes(label.toLowerCase())),
      publicLabCard: !!normalMenu?.querySelector('[data-product-surface="arsenal-lab"]'),
      adminLauncherAvailable: typeof window.apexLaunchArsenalLab === 'function',
      menuVisible: !!normalMenu && !normalMenu.classList.contains('hidden'),
    };
  })()`);
  pass('public-graph-exactly-ten-four-active-six-locked-no-retired-actions',
    result.publicGraph.authorityVersion === 'pre-pilot-product-graph-v1'
      && JSON.stringify(result.publicGraph.graphIds) === JSON.stringify(PUBLIC_IDS)
      && JSON.stringify(result.publicGraph.cardIds) === JSON.stringify(PUBLIC_IDS)
      && JSON.stringify(result.publicGraph.active) === JSON.stringify(ACTIVE_IDS)
      && JSON.stringify(result.publicGraph.locked) === JSON.stringify(LOCKED_IDS)
      && result.publicGraph.graphMatchesDom
      && result.publicGraph.retiredMentions.length === 0
      && result.publicGraph.publicLabCard === false
      && result.publicGraph.adminLauncherAvailable === true
      && result.publicGraph.menuVisible === true,
    result.publicGraph);

  // Every visible locked product opens the intended lock dialog, leaves game
  // state at MENU, and physically returns to the same public product root.
  for (const surfaceId of LOCKED_IDS) {
    const selector = `#menu-screen [data-product-surface="${surfaceId}"]`;
    const pointer = await clickVisible(selector);
    const dialog = await poll(`(() => {
      const dialog = document.querySelector('.product-lock-dialog[role="dialog"]');
      return dialog ? {
        visible: getComputedStyle(dialog).display !== 'none',
        title: dialog.querySelector('#product-lock-title')?.textContent?.trim() || '',
        state: typeof gameState === 'undefined' ? null : gameState,
        selectVisible: !!document.getElementById('select-screen')
          && !document.getElementById('select-screen').classList.contains('hidden'),
        battleActive: !!window.APEX_ARSENAL?.state?.active,
      } : null;
    })()`, value => value && value.visible, { attempts: 30, interval: 60 });
    if (surfaceId === 'quest-01') evidence.push(await screenshot('prepilot-quest-01-locked-dialog'));
    const backPointer = await clickVisible('.product-lock-dialog .product-lock-panel button');
    const returned = await awaitMenu();
    pass(`locked-surface-${surfaceId}-blocks-gameplay-and-returns`,
      pointer.hitWithin === true && pointer.pointerEvents !== 'none'
        && !!dialog && dialog.title === (result.publicGraph.graphIds.includes(surfaceId)
          ? ({
            'quest-01': 'Quest 01', 'fighter-upgrade': 'Fighter Upgrade',
            dictionary: 'Dictionary', missions: 'Missions', achievements: 'Achievements',
            'account-profile': 'Account / Profile',
          })[surfaceId] : '')
        && dialog.state === 'MENU' && dialog.selectVisible === false && dialog.battleActive === false
        && backPointer.hitWithin === true && returned?.visible === true && returned?.gameState === 'MENU',
      { pointer, dialog, backPointer, returned });
  }

  // Seed a real persisted pre-cutover record, then reload so migration occurs
  // during normal runtime initialization rather than through a test-only
  // migration call. A second reload proves that NEWBIE cannot reappear.
  const migrationSeed = {
    version: 1,
    credits: 777,
    ownedFighters: ['NEWBIE', 'BLACK_HOLE', 'SLIME', 'HUNTER', 'ICE'],
    lastSelectedP1: 'BLACK_HOLE',
    lastSelectedP2: 'NEWBIE',
    totalSpins: 3,
    unlockedAt: { NEWBIE: 33, BLACK_HOLE: 44, SLIME: 55, HUNTER: 66, ICE: 77 },
  };
  await evaluate(`localStorage.setItem(${JSON.stringify(META_KEY)}, ${JSON.stringify(JSON.stringify(migrationSeed))}); true`);
  const reloadUrl = (tag) => {
    const url = new URL(appUrl);
    url.searchParams.set('apex-product-acceptance', tag);
    return url.toString();
  };
  await navigate(reloadUrl('migration-first-boot'));
  const migrationFirst = await poll(`(() => {
    const M = window.APEX_ARSENAL_META;
    if (!M || !M.getState) return null;
    return { state: M.getState(), raw: JSON.parse(localStorage.getItem(${JSON.stringify(META_KEY)})) };
  })()`, value => !!value, { attempts: 180, interval: 100 });
  await navigate(reloadUrl('migration-durable-reload'));
  const migrationDurable = await poll(`(() => {
    const M = window.APEX_ARSENAL_META;
    if (!M || !M.getState) return null;
    return { state: M.getState(), raw: JSON.parse(localStorage.getItem(${JSON.stringify(META_KEY)})) };
  })()`, value => !!value, { attempts: 180, interval: 100 });
  const migratedOwners = migrationDurable?.state?.ownedFighters || [];
  const migratedRawOwners = migrationDurable?.raw?.ownedFighters || [];
  pass('save-newbie-robot-migration-is-durable-preserves-locked-ownership-sanitizes-selections',
    migrationFirst?.state?.ownedFighters?.includes('ROBOT') === true
      && !migrationFirst.state.ownedFighters.includes('NEWBIE')
      && migrationFirst.state.ownedFighters.includes('BLACK_HOLE')
      && migrationFirst.state.ownedFighters.includes('SLIME')
      && migrationFirst.state.lastSelectedP1 === 'ROBOT'
      && migrationFirst.state.lastSelectedP2 === 'ROBOT'
      && migrationFirst.raw?.ownedFighters?.includes('ROBOT') === true
      && !migrationFirst.raw.ownedFighters.includes('NEWBIE')
      && migrationDurable?.state?.ownedFighters?.includes('ROBOT') === true
      && !migratedOwners.includes('NEWBIE')
      && migratedOwners.includes('BLACK_HOLE') && migratedOwners.includes('SLIME')
      && migratedRawOwners.includes('BLACK_HOLE') && migratedRawOwners.includes('SLIME')
      && migrationDurable.state.lastSelectedP1 === 'ROBOT'
      && migrationDurable.state.lastSelectedP2 === 'ROBOT',
    { first: migrationFirst, durable: migrationDurable });

  // Local/Bot share the same accepted picker and neutral runtime. Keep the
  // legal owned subset intentionally narrower than the historic ownership
  // record so LOCKED fighters remain visible in saves but never selectable.
  const pickerSeed = {
    version: 1,
    credits: 777,
    ownedFighters: ['ROBOT', 'HUNTER', 'ICE', 'BLACK_HOLE', 'SLIME'],
    lastSelectedP1: 'HUNTER',
    lastSelectedP2: 'SLIME',
    totalSpins: 3,
    unlockedAt: { ROBOT: 0, HUNTER: 10, ICE: 11, BLACK_HOLE: 12, SLIME: 13 },
  };
  result.pickerSeed = await evaluate(`(() => {
    const M = window.APEX_ARSENAL_META;
    const state = M.sanitize(${JSON.stringify(pickerSeed)});
    M.save(state);
    return { state: M.getState(), legal: M.getState().ownedFighters.filter(id => M.canPublicSelect(id)) };
  })()`);

  const localRoute = await enterProduct('local-1v1');
  const localReady = await poll(`(() => ({
    visible: !document.getElementById('select-screen')?.classList.contains('hidden'),
    menuHidden: !!document.getElementById('menu-screen')?.classList.contains('hidden'),
    pickerReady: !!window.__APEX_PICK_TEST,
    cards: [...document.querySelectorAll('.apex-pick-stage .apex-pick-card')].map(card => card.dataset.champion),
  }))()`, value => value && value.visible && value.pickerReady && value.cards.length >= 2,
  { attempts: 160, interval: 100 });
  const localPickerState = await evaluate(`(() => {
    const T = window.__APEX_PICK_TEST;
    const M = window.APEX_ARSENAL_META;
    const roster = T ? T.roster().map(card => card.name) : [];
    return {
      roster,
      p1: T?.p1() || null,
      p2: T?.p2() || null,
      activePlayer: T?.activePlayer() ?? null,
      onlyLegalOwnedCoreSix: roster.length > 0 && roster.every(id =>
        window.APEX_PRODUCT_SURFACE.roster.playableIds.includes(id) && M.owns(id)),
      rejectsLockedOwned: M.canPublicSelect('SLIME') === false
        && M.canPublicSelect('BLACK_HOLE') === false
        && window.APEX_ARSENAL_SHELLS.canPublicSelect('SLIME') === false,
      visibleCards: [...document.querySelectorAll('.apex-pick-stage .apex-pick-card')].map(card => card.dataset.champion),
    };
  })()`);
  evidence.push(await screenshot('prepilot-local-core-six-picker'));
  const localP1Click = await selectVisibleChampion('HUNTER');
  const afterLocalP1 = await poll('window.__APEX_PICK_TEST?.p1() || null', value => value === 'HUNTER', { attempts: 20, interval: 50 });
  const localP2Click = await selectVisibleChampion('ROBOT');
  const afterLocalP2 = await poll('window.__APEX_PICK_TEST?.p2() || null', value => value === 'ROBOT', { attempts: 20, interval: 50 });
  const localStart = await clickVisible('[data-layer-id="start-button"]');
  const localBattle = await poll(`(() => {
    const debug = window.getArsenalBattleDebugState?.();
    return {
      state: typeof gameState === 'undefined' ? null : gameState,
      active: debug?.active === true,
      battleMode: debug?.battleMode || null,
      fighters: typeof fighters !== 'undefined' && fighters ? fighters.map(f => f.name) : [],
      battleRuntime: window.apexArsenalBattleRuntime || null,
      neutralScriptLoaded: [...document.scripts].some(node => /\\/game\\/modes\\/arsenalBattleRuntime\\.js(?:[?#]|$)/.test(node.src)),
      menuHidden: !!document.getElementById('menu-screen')?.classList.contains('hidden'),
    };
  })()`, value => value && value.state === 'ARSENAL' && value.active, { attempts: 120, interval: 100 });
  evidence.push(await screenshot('prepilot-local-neutral-battle'));
  pass('local-1v1-physical-route-legal-owned-picker-and-neutral-match',
    localRoute.pointer.hitWithin === true && localReady?.visible === true
      && localPickerState.onlyLegalOwnedCoreSix === true
      && localPickerState.rejectsLockedOwned === true
      && localPickerState.roster.join(',') === 'ROBOT,HUNTER,ICE'
      && localP1Click.hitWithin === true && afterLocalP1 === 'HUNTER'
      && localP2Click.hitWithin === true && afterLocalP2 === 'ROBOT'
      && localStart.hitWithin === true
      && localBattle?.state === 'ARSENAL' && localBattle.active === true
      && localBattle.battleMode === 'LOCAL'
      && localBattle.fighters.join(',') === 'HUNTER,ROBOT'
      && localBattle.battleRuntime === 'ready' && localBattle.neutralScriptLoaded === true
      && localBattle.menuHidden === true,
    { route: localRoute, ready: localReady, picker: localPickerState,
      clicks: { p1: localP1Click, selectedP1: afterLocalP1, p2: localP2Click,
        selectedP2: afterLocalP2, start: localStart }, battle: localBattle });
  result.localExit = await returnFromBattle('local');
  const localExitPointer = result.localExit.pointer;
  pass('local-battle-physical-exit-returns-to-product-menu',
    localExitPointer?.hitWithin === true && result.localExit.menu?.visible === true
      && result.localExit.menu.gameState === 'MENU', result.localExit);
  evidence.push(await screenshot('prepilot-local-product-menu-return'));

  // BOT is a thin mode profile on the same picker/runtime. P2 is fixed to
  // owned ROBOT; its real Hero Rework cast event is collected from AIL.bus.
  const botRoute = await enterProduct('bot-battle');
  const botReady = await poll(`(() => ({
    visible: !document.getElementById('select-screen')?.classList.contains('hidden'),
    pickerReady: !!window.__APEX_PICK_TEST,
    p1: window.__APEX_PICK_TEST?.p1() || null,
    p2: window.__APEX_PICK_TEST?.p2() || null,
    mode: window.__apexArsenalSelectionMode || null,
    botFlag: window.__apexArsenalBotBattle === true,
    cards: [...document.querySelectorAll('.apex-pick-stage .apex-pick-card')].map(card => card.dataset.champion),
  }))()`, value => value && value.visible && value.pickerReady && value.cards.length >= 1,
  { attempts: 160, interval: 100 });
  const botP1Click = await selectVisibleChampion('HUNTER');
  const botPick = await evaluate(`(() => ({
    p1: window.__APEX_PICK_TEST?.p1() || null,
    p2: window.__APEX_PICK_TEST?.p2() || null,
    activePlayer: window.__APEX_PICK_TEST?.activePlayer() ?? null,
    botFlag: window.__apexArsenalBotBattle === true,
    p2Legal: window.APEX_PRODUCT_SURFACE.isPublicPlayableFighter(window.__APEX_PICK_TEST?.p2())
      && window.APEX_ARSENAL_META.owns(window.__APEX_PICK_TEST?.p2()),
  }))()`);
  await evaluate(`(() => {
    window.__prePilotBotCastEvents = [];
    const bus = window.APEX_HERO_REWORK_AIL?.bus;
    if (window.__prePilotBotCastUnsubscribe) window.__prePilotBotCastUnsubscribe();
    window.__prePilotBotCastUnsubscribe = bus?.on('Cast', event => {
      const payload = event?.payload || {};
      if (payload.source === 'p2-ai') window.__prePilotBotCastEvents.push({
        type: event.type, seq: event.seq, hero: payload.hero, slot: payload.slot,
        mechanic: payload.mechanic, source: payload.source,
      });
    }) || null;
    return !!window.__prePilotBotCastUnsubscribe;
  })()`);
  evidence.push(await screenshot('prepilot-bot-battle-picker'));
  const botStart = await clickVisible('[data-layer-id="start-button"]');
  const botCastReport = await evaluate(`(async () => {
    const until = performance.now() + 12000;
    while (performance.now() < until && !(window.__prePilotBotCastEvents || []).length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const debug = window.getArsenalBattleDebugState?.();
    const rework = window.APEX_HERO_REWORK?.debugState?.();
    const events = window.__prePilotBotCastEvents || [];
    return {
      state: typeof gameState === 'undefined' ? null : gameState,
      active: debug?.active === true,
      battleMode: debug?.battleMode || null,
      fighters: typeof fighters !== 'undefined' && fighters ? fighters.map(f => f.name) : [],
      neutralRuntime: window.apexArsenalBattleRuntime || null,
      neutralScriptLoaded: [...document.scripts].some(node => /\\/game\\/modes\\/arsenalBattleRuntime\\.js(?:[?#]|$)/.test(node.src)),
      aiEnabled: rework?.aiEnabled === true,
      reworkP2: rework?.combatants?.[1]?.heroId || null,
      cast: events.find(event => event.source === 'p2-ai') || null,
      casts: events,
    };
  })()`);
  result.botBattle = { route: botRoute, ready: botReady, p1Click: botP1Click, picker: botPick,
    start: botStart, runtime: botCastReport };
  evidence.push(await screenshot('prepilot-bot-neutral-battle-p2-ai-cast'));
  pass('bot-battle-physical-route-deterministic-p2-neutral-match-and-real-ai-cast',
    botRoute.pointer.hitWithin === true && botReady?.visible === true
      && botReady.mode === 'bot' && botReady.botFlag === true
      && botP1Click.hitWithin === true && botPick.p1 === 'HUNTER'
      && botPick.p2 === 'ROBOT' && botPick.p2Legal === true
      && botStart.hitWithin === true
      && botCastReport.state === 'ARSENAL' && botCastReport.active === true
      && botCastReport.battleMode === 'BOT'
      && botCastReport.fighters.join(',') === 'HUNTER,ROBOT'
      && botCastReport.neutralRuntime === 'ready' && botCastReport.neutralScriptLoaded === true
      && botCastReport.aiEnabled === true && botCastReport.reworkP2 === 'ROBOT'
      && botCastReport.cast?.source === 'p2-ai'
      && ['A1', 'A2'].includes(botCastReport.cast?.slot),
    result.botBattle);
  result.botExit = await returnFromBattle('bot');
  pass('bot-battle-physical-exit-returns-to-product-menu',
    result.botExit.pointer?.hitWithin === true && result.botExit.menu?.visible === true
      && result.botExit.menu.gameState === 'MENU', result.botExit);

  // The public Fighter Shop renders all 12 but offers mutations only to the
  // Core Six. Locked future ownership is intentionally retained in this save.
  await evaluate(`(() => {
    const M = window.APEX_ARSENAL_META;
    M.save(M.sanitize({
      version: 1, credits: 777,
      ownedFighters: ['ROBOT', 'HUNTER', 'ICE', 'BLACK_HOLE', 'SLIME'],
      lastSelectedP1: 'HUNTER', lastSelectedP2: 'ROBOT', totalSpins: 0,
      unlockedAt: { ROBOT: 0, HUNTER: 10, ICE: 11, BLACK_HOLE: 12, SLIME: 13 },
    }));
    return true;
  })()`);
  const shopRoute = await enterProduct('fighter-shop');
  const shopState = await poll(`(() => {
    const root = document.getElementById('aq-meta-root');
    const cards = [...document.querySelectorAll('#aq-meta-root [data-shop-card]')];
    return {
      visible: !!root && root.style.display !== 'none' && !!document.querySelector('#aq-meta-root .aq-shop-grid'),
      count: cards.length,
      ids: cards.map(card => card.dataset.shopCard),
      states: Object.fromEntries(cards.map(card => [card.dataset.shopCard,
        card.querySelector('.aq-fighter-state')?.textContent?.trim() || ''])),
      credits: window.APEX_ARSENAL_META?.credits?.(),
      shopCost: window.APEX_ARSENAL_META?.SHOP_COST,
      productPlayable: window.APEX_PRODUCT_SURFACE?.roster?.playableIds || [],
      futureLocked: cards.filter(card => ${JSON.stringify(LOCKED_FIGHTERS)}.includes(card.dataset.shopCard))
        .every(card => card.classList.contains('is-locked')
          && card.querySelector('.aq-fighter-state')?.textContent?.trim() === 'PRE-PILOT LOCKED'),
    };
  })()`, value => value && value.visible, { attempts: 80, interval: 80 });
  await clickVisible('#aq-meta-root [data-shop-card="CRYSTAL"]');
  const legalShopOffer = await evaluate(`(() => ({
    selected: document.querySelector('#aq-shop-detail h2')?.textContent?.trim() || '',
    button: document.getElementById('aq-buy')?.textContent?.trim() || '',
    disabled: !!document.getElementById('aq-buy')?.disabled,
    status: document.querySelector('#aq-shop-detail .aq-detail-status')?.textContent?.trim() || '',
  }))()`);
  await clickVisible('#aq-meta-root [data-shop-card="BLACK_HOLE"]');
  const unavailablePurchase = await evaluate(`(() => {
    const M = window.APEX_ARSENAL_META;
    const before = M.credits();
    const bh = M.buy('BLACK_HOLE');
    const slime = M.buy('SLIME');
    return {
      bh, slime, creditsBefore: before, creditsAfter: M.credits(),
      lockedName: document.querySelector('#aq-shop-detail h2')?.textContent?.trim() || '',
      lockedStatus: document.querySelector('#aq-shop-detail .aq-detail-status')?.textContent?.trim() || '',
      buyDisabled: !!document.getElementById('aq-buy')?.disabled,
      buyLabel: document.getElementById('aq-buy')?.textContent?.trim() || '',
    };
  })()`);
  evidence.push(await screenshot('prepilot-fighter-shop-twelve-visible-locked-six'));
  pass('fighter-shop-public-roster-twelve-core-six-law-1000-ac-and-locked-purchase-rejection',
    shopRoute.pointer.hitWithin === true && shopState?.visible === true
      && JSON.stringify(shopState.ids) === JSON.stringify(CORE_SIX.concat(LOCKED_FIGHTERS))
      && JSON.stringify(shopState.productPlayable) === JSON.stringify(CORE_SIX)
      && shopState.futureLocked === true && shopState.shopCost === 1000
      && legalShopOffer.selected === 'CRYSTALA'
      && /1000\s*AC/.test(legalShopOffer.button) && legalShopOffer.disabled === false
      && unavailablePurchase.bh?.ok === false && unavailablePurchase.bh?.reason === 'unavailable'
      && unavailablePurchase.slime?.ok === false && unavailablePurchase.slime?.reason === 'unavailable'
      && unavailablePurchase.creditsBefore === unavailablePurchase.creditsAfter
      && unavailablePurchase.lockedName === 'BLACK_HOLE'
      && unavailablePurchase.lockedStatus === 'PRE-PILOT LOCKED'
      && unavailablePurchase.buyDisabled === true
      && /LOCKED\s*·\s*PRE-PILOT/.test(unavailablePurchase.buyLabel),
    { route: shopRoute, shop: shopState, legalOffer: legalShopOffer, unavailablePurchase });
  const shopBack = await clickVisible('#aq-shop-back');
  const shopReturned = await awaitMenu();
  pass('fighter-shop-physical-back-returns-to-product-menu',
    shopBack.hitWithin === true && shopReturned?.visible === true && shopReturned?.gameState === 'MENU',
    { back: shopBack, returned: shopReturned });

  // Exact clean-state Lucky Draw law: 350 AC buys one draw from unowned
  // playable Core Six only; the physical second attempt is rejected at zero.
  const cleanDrawSeed = {
    version: 1, credits: 350, ownedFighters: ['ROBOT'],
    lastSelectedP1: 'ROBOT', lastSelectedP2: 'ROBOT', totalSpins: 0,
    unlockedAt: { ROBOT: 0 },
  };
  result.drawSeed = await evaluate(`(() => {
    const M = window.APEX_ARSENAL_META;
    M.save(M.sanitize(${JSON.stringify(cleanDrawSeed)}));
    return { state: M.getState(), pool: M.poolLocked() };
  })()`);
  const drawRoute = await enterProduct('lucky-draw');
  const drawBefore = await poll(`(() => {
    const M = window.APEX_ARSENAL_META;
    const root = document.getElementById('aq-meta-root');
    const labels = [...document.querySelectorAll('#aq-wheel .aq-wheel-label')].map(node => node.textContent.trim());
    return {
      visible: !!root && root.style.display !== 'none' && !!document.getElementById('aq-wheel'),
      credits: M?.credits?.(),
      spins: M?.getState?.().totalSpins,
      pool: M?.poolLocked?.() || [],
      labels,
      cost: document.querySelector('#aq-meta-root .aq-draw-fact b')?.textContent?.trim() || '',
      button: document.getElementById('aq-spin')?.textContent?.trim() || '',
      futureInPool: (M?.poolLocked?.() || []).some(id => ${JSON.stringify(LOCKED_FIGHTERS)}.includes(id)),
    };
  })()`, value => value && value.visible, { attempts: 80, interval: 80 });
  evidence.push(await screenshot('prepilot-lucky-draw-clean-350-ac'));
  const firstSpin = await clickVisible('#aq-spin');
  const drawResult = await poll(`(() => {
    const M = window.APEX_ARSENAL_META;
    const state = M?.getState?.();
    const newlyOwned = (state?.ownedFighters || []).filter(id => id !== 'ROBOT');
    return {
      resultVisible: !!document.querySelector('#aq-meta-root .aq-draw-result strong'),
      resultLabel: document.querySelector('#aq-meta-root .aq-draw-result strong')?.textContent?.trim() || '',
      credits: M?.credits?.(), totalSpins: state?.totalSpins,
      owned: state?.ownedFighters || [], newlyOwned,
      pool: M?.poolLocked?.() || [],
      futureOwned: (state?.ownedFighters || []).filter(id => ${JSON.stringify(LOCKED_FIGHTERS)}.includes(id)),
    };
  })()`, value => value && value.resultVisible, { attempts: 90, interval: 100 });
  const secondSpin = await clickVisible('#aq-spin');
  const secondDraw = await evaluate(`(() => {
    const M = window.APEX_ARSENAL_META;
    const denial = M.spin();
    return {
      message: document.getElementById('aq-draw-message')?.textContent?.trim() || '',
      denial, credits: M.credits(), totalSpins: M.getState().totalSpins,
      owned: M.getState().ownedFighters,
    };
  })()`);
  const drawBack = await clickVisible('#aq-draw-back');
  const drawReturned = await awaitMenu();
  pass('lucky-draw-physical-route-pool-core-six-and-exactly-one-350-ac-draw',
    drawRoute.pointer.hitWithin === true && drawBefore?.visible === true
      && drawBefore.credits === 350 && drawBefore.spins === 0
      && drawBefore.cost === '350 AC' && /350\s*AC/.test(drawBefore.button)
      && JSON.stringify(drawBefore.pool) === JSON.stringify(['HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR'])
      && JSON.stringify([...drawBefore.labels].sort()) === JSON.stringify(['HUNTER', 'CRYSTALA', 'MAGNET', 'FROST', 'MIRROR'].sort())
      && drawBefore.futureInPool === false
      && firstSpin.hitWithin === true && drawResult?.resultVisible === true
      && drawResult.credits === 0 && drawResult.totalSpins === 1
      && drawResult.newlyOwned.length === 1 && CORE_SIX.includes(drawResult.newlyOwned[0])
      && drawResult.pool.length === 4 && drawResult.futureOwned.length === 0
      && secondSpin.hitWithin === true && /NEED\s+350\s+AC/.test(secondDraw.message)
      && secondDraw.denial?.ok === false && secondDraw.denial?.reason === 'need'
      && secondDraw.credits === 0 && secondDraw.totalSpins === 1
      && secondDraw.owned.length === 2
      && drawBack.hitWithin === true && drawReturned?.visible === true && drawReturned?.gameState === 'MENU',
    { route: drawRoute, before: drawBefore, firstSpin, result: drawResult,
      secondSpin, secondAttempt: secondDraw, back: drawBack, returned: drawReturned });
  evidence.push(await screenshot('prepilot-lucky-draw-one-legal-result-and-denied-retry'));

  // The admin seam launches the real neutral Lab; the menu graph remains free
  // of an Arsenal Lab action before and after the API call.
  const beforeLab = await evaluate(`(() => ({
    ids: [...document.querySelectorAll('#menu-screen [data-product-surface]')].map(card => card.dataset.productSurface),
    labCard: !!document.querySelector('#menu-screen [data-product-surface="arsenal-lab"]'),
    navHasLab: /ARSENAL LAB/i.test(document.getElementById('menu-screen')?.innerText || ''),
    api: typeof window.apexLaunchArsenalLab,
  }))()`);
  const labLaunch = await evaluate(`(async () => {
    const launched = await window.apexLaunchArsenalLab?.();
    const debug = window.getArsenalBattleDebugState?.();
    return {
      launched: launched === true,
      state: typeof gameState === 'undefined' ? null : gameState,
      debug,
      fighters: typeof fighters !== 'undefined' && fighters ? fighters.map(f => f.name) : [],
      labPanel: !!document.getElementById('aq-lab-panel'),
      battleRuntime: window.apexArsenalBattleRuntime || null,
      neutralScriptLoaded: [...document.scripts].some(node => /\\/game\\/modes\\/arsenalBattleRuntime\\.js(?:[?#]|$)/.test(node.src)),
    };
  })()`);
  evidence.push(await screenshot('prepilot-admin-lab-real-neutral-runtime'));
  pass('admin-lab-absent-publicly-launchable-only-by-api-on-neutral-core',
    beforeLab.labCard === false && beforeLab.navHasLab === false && beforeLab.api === 'function'
      && JSON.stringify(beforeLab.ids) === JSON.stringify(PUBLIC_IDS)
      && labLaunch.launched === true && labLaunch.state === 'ARSENAL'
      && labLaunch.debug?.active === true && labLaunch.debug?.labMode === true
      && labLaunch.fighters.join(',') === 'ROBOT,ROBOT' && labLaunch.labPanel === true
      && labLaunch.battleRuntime === 'ready' && labLaunch.neutralScriptLoaded === true,
    { before: beforeLab, lab: labLaunch });
  const labExit = await clickVisible('#aq-lab-panel .aq-lab-exit');
  const labReturned = await awaitMenu();
  const afterLabMenu = await evaluate(`(() => ({
    ids: [...document.querySelectorAll('#menu-screen [data-product-surface]')].map(card => card.dataset.productSurface),
    labCard: !!document.querySelector('#menu-screen [data-product-surface="arsenal-lab"]'),
  }))()`);
  pass('admin-lab-physical-exit-returns-without-public-lab-link',
    labExit.hitWithin === true && labReturned?.visible === true && labReturned?.gameState === 'MENU'
      && afterLabMenu.labCard === false && JSON.stringify(afterLabMenu.ids) === JSON.stringify(PUBLIC_IDS),
    { exit: labExit, returned: labReturned, menu: afterLabMenu });

  result.summary = {
    total: Object.keys(result).filter(key => result[key]?.pass !== undefined).length,
    passed: Object.values(result).filter(value => value?.pass === true).length,
    failed: Object.entries(result).filter(([, value]) => value?.pass === false).map(([key]) => key),
  };
  return result;
}
