// Cache-bust classic runtime scripts that live under /public and therefore do
// not receive Vite content hashes. This Phase 2C product-runtime transition
// from r41 to r42 consolidates current combat HUD state/projection authority
// before the Gold HUD/UI/UX overhaul. The 2026-10-05 Gold product cutover
// correction slice (r43) re-keys every versioned runtime and the Gold shell /
// bridge / Lucky Draw URLs so no prior cutover artifact can be served from a
// stale cache during owner browser verification.
export const APEX_ARSENAL_RUNTIME_REVISION = '20261008-r76-shell-cache-boundary';

// ─────────────────────────────────────────────────────────────────────────────
// Runtime loading is classified by NEED, not by historical placement.
//   Tier 0  critical boot shell      — React bundle + loader art (index.html).
//   Tier 1  menu interactive         — engine + menu audio bridge.
//   Tier 2  likely-next warmup       — active Arsenal product core, then select.
//   Tier 3  intent-based             — a product action raises only its active
//                                      shared-engine/runtime group to priority.
//   Tier 4  match-specific           — assets required by the selected fighters
//                                      or arena are loaded by their runtimes.
// ─────────────────────────────────────────────────────────────────────────────

// Tier 1 — menu interactive. The engine's menu navigation uses the audio
// session runtime, and the ONE product music authority (Forward Drive theme,
// single persistent media element, surface policy + fades + M mute) installs
// here so every later surface — including the Gold product shell — talks to
// exactly one music owner. Nothing else is needed before a product surface.
// E1 boot-audio dependency: this one tiny runtime is requested as soon as the
// initial Mechanical Door transition starts. MENU_INTERACTIVE reuses the exact
// same tuple, so there is still one script identity / one music authority.
export const PRODUCT_MUSIC_BOOT_RUNTIMES = [
  ['/game/product/productMusicAuthority.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'productMusicAuthority'],
];

export const MENU_INTERACTIVE_RUNTIMES = [
  ['/game/core/apexBattleAudioRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexBattleAudioRuntime'],
  ...PRODUCT_MUSIC_BOOT_RUNTIMES,
  ['/game/product/productAssetRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'productAssetRuntime'],
];

// Current-neutral combat services shared by Arsenal and the generic engine.
export const CURRENT_COMBAT_CORE_RUNTIMES = [
  ['/game/core/apexBattleSfxRuntime.js', 'apexBattleSfxRuntime'],
  ['/game/core/apexRenderPrimitives.js', 'apexRenderPrimitives'],
  ['/game/core/apexCombatEffectsRuntime.js', 'apexCombatEffectsRuntime'],
];

// Universal combat HUD state adapter + renderer.
export const HUD_RUNTIMES = [
  ['/game/ui/apexCombatHudRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexCombatHudRuntime'],
];

// Gold owns Fighter Pick presentation. No legacy picker runtime ships on the
// production graph; the empty exports remain only as stable diagnostic API.
export const PICK_RUNTIMES = [];

// The ONE semantic UI/UX/HUD SFX authority (owner law 2026-10-05): a single
// cached media element per cue for the whole 18-key UI SFX pack — no element is
// constructed per interaction, no audio graph is built per event, and the UI
// volume/mute is separate from the MUSIC mute. Loaded before every screen that
// can make a sound.
export const UI_SFX_RUNTIMES = [
  ['/game/ui/uiSfxAuthority.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'uiSfxAuthority'],
];

// Fighter Pick is authored inside the Gold shell and needs no deferred
// presentation runtime. Combat dependencies stay lazy until battle intent.
export const SELECT_RUNTIMES = [];

// Current Arsenal engine chain. Collision, renderer/HUD and draw recovery are
// now product-owned current seams. No legacy roster or generic-Battle runtime
// is exported from the production manifest; historical compatibility lives
// only in tools/legacyRuntimeManifest.mjs.
export const ARSENAL_SHARED_ENGINE_RUNTIMES = [
  ...CURRENT_COMBAT_CORE_RUNTIMES,
  ['/game/core/apexArsenalProductCollisionRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalProductCollisionRuntime'],
  ['/game/core/apexArsenalProductRenderHudRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalProductRenderHudRuntime'],
  ['/game/core/apexArsenalProductDrawRecoveryRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalProductDrawRecoveryRuntime'],
  ...HUD_RUNTIMES,
];

// Active neutral Arsenal product runtime. Bot Battle, Local 1v1, Shop/Draw,
// and the admin-only Lab share this chain. It has product-owned engine seams
// and no production dependency on the legacy roster/runtime graph.
export const ARSENAL_PRODUCT_RUNTIMES = [
  ...ARSENAL_SHARED_ENGINE_RUNTIMES,
  ['/game/gold/goldProductBridge.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexGoldProductBridge'],
  ['/game/arsenal/arsenalCWeaponSet.generated.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalCSet'],
  ['/game/arsenal/arsenalConfig.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalConfig'],
  ['/game/arsenal/arsenalIdentityRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalIdentityRuntime'],
  ['/game/arsenal/arsenalWeaponRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalWeaponRuntime'],
  ['/game/arsenal/arsenalSpawnRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalSpawnRuntime'],
  ['/game/arsenal/arsenalPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalPresentationRuntime'],
  ['/game/arsenal/arsenalFeelRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalFeelRuntime'],
  ['/game/arsenal/arsenalStormbreakerVfxRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalStormbreakerVfxRuntime'],
  ['/game/arsenal/arsenalManualSkillGate.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalManualSkillGate'],
  ['/game/hero-rework/ailRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHeroReworkAil'],
  ['/game/hero-rework/heroRegistry.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHeroReworkRegistry'],
  ['/game/arsenal/arsenalShellSelectRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalShellSelectRuntime'],
  ['/game/arsenal/arsenalChamberPaletteRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalChamberPaletteRuntime'],
  ['/game/arsenal/arsenalMetaRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalMetaRuntime'],
  // CP04 branch-only: side-effect-free Quest selectors, inactive in BOT/LOCAL.
  ['/game/quest/questMultiActorCore.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexQuestMultiActorCore'],
  ['/game/quest/questReflexReceipts.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexQuestReflexReceipts'],
  ['/game/quest/questGoldV12Rig.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexQuestV12Rig'],
  ['/game/quest/questGoldEnemyVisuals.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexQuestGoldEnemyVisuals'],
  ['/game/modes/arsenalBattleRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalBattleRuntime'],
  ['/game/hero-rework/crystalaGoldV6.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexCrystalaGoldV6'],
  ['/game/hero-rework/crystalGameplayRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexCrystalGameplayRuntime'],
  ['/game/hero-rework/frostGameplayRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexFrostGameplayRuntime'],
  ['/game/hero-rework/magnetGameplayRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexMagnetGameplayRuntime'],
  ['/game/hero-rework/magnetGoldV1.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexMagnetGoldV1'],
  ['/game/hero-rework/mirrorGoldV1.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexMirrorGoldV1'],
  ['/game/hero-rework/heroMechanicsRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHeroReworkMechanics'],
  ['/game/hero-rework/heroReworkRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHeroReworkRuntime'],
  ['/game/hero-rework/robotPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexRobotPresentationRuntime'],
  ['/game/hero-rework/hunterGoldV10.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHunterGoldV10'],
  ['/game/hero-rework/hunterPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHunterPresentationRuntime'],
  ['/game/hero-rework/crystalaPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexCrystalaPresentationRuntime'],
  ['/game/hero-rework/frostGoldV1.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexFrostGoldV1'],
  ['/game/hero-rework/frostPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexFrostPresentationRuntime'],
  ['/game/hero-rework/magnetPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexMagnetPresentationRuntime'],
  ['/game/hero-rework/mirrorPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexMirrorPresentationRuntime'],
  // The ONE curated hero-SFX authority for the four newer Core Six heroes
  // (CRYSTALA / MAGNET / FROST / MIRROR), plus its production event bridge.
  // ROBOT and HUNTER keep their existing accepted SFX authorities untouched.
  ['/game/heroes/coreSixCuratedSfxAuthority.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexCoreSixCuratedSfxAuthority'],
  ['/game/heroes/coreSixCuratedSfxBridge.js', 'apexCoreSixCuratedSfxBridge'],
];

// E4 — battle runtime selection. ARSENAL_PRODUCT_RUNTIMES above remains the
// ONE canonical full graph (Lab/diagnostics/compatibility). Public battle entry
// takes a filtered VIEW of that same ordered graph so only the two selected
// fighters pay hero-specific evaluation cost. Filtering instead of concatenating
// sub-groups preserves every historical dependency edge and script order.
export const CORE_SIX_BATTLE_RUNTIME_PATHS = Object.freeze({
  newbot: Object.freeze([
    '/game/hero-rework/robotPresentationRuntime.js',
  ]),
  hunter: Object.freeze([
    '/game/hero-rework/hunterGoldV10.js',
    '/game/hero-rework/hunterPresentationRuntime.js',
  ]),
  crystala: Object.freeze([
    '/game/hero-rework/crystalaGoldV6.js',
    '/game/hero-rework/crystalGameplayRuntime.js',
    '/game/hero-rework/crystalaPresentationRuntime.js',
  ]),
  magnet: Object.freeze([
    '/game/hero-rework/magnetGameplayRuntime.js',
    '/game/hero-rework/magnetGoldV1.js',
    '/game/hero-rework/magnetPresentationRuntime.js',
  ]),
  frost: Object.freeze([
    '/game/hero-rework/frostGameplayRuntime.js',
    '/game/hero-rework/frostGoldV1.js',
    '/game/hero-rework/frostPresentationRuntime.js',
  ]),
  mirror: Object.freeze([
    '/game/hero-rework/mirrorGoldV1.js',
    '/game/hero-rework/mirrorPresentationRuntime.js',
  ]),
});

const CORE_SIX_RUNTIME_KEY_ALIASES = Object.freeze({
  newbot: 'newbot', robot: 'newbot',
  hunter: 'hunter',
  crystala: 'crystala', crystal: 'crystala',
  magnet: 'magnet',
  frost: 'frost', ice: 'frost',
  mirror: 'mirror',
});
const BATTLE_RUNTIME_OWNER_BY_PATH = new Map();
for (const [hero, paths] of Object.entries(CORE_SIX_BATTLE_RUNTIME_PATHS)) {
  for (const path of paths) BATTLE_RUNTIME_OWNER_BY_PATH.set(path, hero);
}
function battleRuntimeHeroKey(value) {
  return CORE_SIX_RUNTIME_KEY_ALIASES[String(value || '').trim().toLowerCase()] || null;
}
export function arsenalBattleRuntimesFor(heroIds) {
  const raw = Array.isArray(heroIds) ? heroIds.filter(Boolean) : [];
  // Fail open to the canonical full graph when a caller supplies no selection
  // or a future/unknown fighter. Optimization may never break future content.
  if (!raw.length) return ARSENAL_PRODUCT_RUNTIMES.slice();
  const normalized = raw.map(battleRuntimeHeroKey);
  if (normalized.some((hero) => !hero)) return ARSENAL_PRODUCT_RUNTIMES.slice();
  const selected = new Set(normalized);
  return ARSENAL_PRODUCT_RUNTIMES.filter(([src]) => {
    const path = String(src).split(/[?#]/, 1)[0];
    const owner = BATTLE_RUNTIME_OWNER_BY_PATH.get(path);
    return !owner || selected.has(owner);
  });
}

// Shipping product groups only. Historical generic Battle groups are
// test-only fixtures and are intentionally absent from this production map.
export const MODE_DEFERRED_RUNTIMES = {
  arsenalProduct: ARSENAL_PRODUCT_RUNTIMES,
};

function uniqueRuntimeEntries(groups) {
  const seen = new Set();
  return groups.filter(([src]) => {
    const key = String(src).split(/[?#]/, 1)[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Current-only aggregate retained for diagnostics/prefetch helpers.
export const DEFERRED_GAME_RUNTIMES = uniqueRuntimeEntries([
  ...ARSENAL_PRODUCT_RUNTIMES,
]);

// Tier 2 — background warmup after the menu is interactive. These are the
// only groups that benefit the current product's first interactions.
// Heavy product groups are route-intent only. Home idle must never silently
// download/evaluate Battle runtime graphs; Gold Mode/Fighter Pick is shell-owned
// and arsenalProduct is requested only at BATTLE/transition intent.
export const WARMUP_GROUP_SEQUENCE = [];

// Product meta's critical path. Shop/Draw/selection needs save/config/shell
// scripts; combat presentation and AV remain lazy until the battle is entered.
export const ARSENAL_HUB_RUNTIMES = [
  ['/game/arsenal/arsenalConfig.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalConfig'],
  ['/game/hero-rework/ailRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHeroReworkAil'],
  ['/game/hero-rework/heroRegistry.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHeroReworkRegistry'],
  ['/game/arsenal/arsenalShellSelectRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalShellSelectRuntime'],
  ['/game/arsenal/arsenalChamberPaletteRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalChamberPaletteRuntime'],
  ['/game/arsenal/arsenalMetaRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalMetaRuntime'],
];

// Production boot is menu-only; test-only legacy BOOT lives under tools/.
export const REQUIRED_GAME_RUNTIMES = MENU_INTERACTIVE_RUNTIMES;

export function hintRuntimeSources(runtimes, rel = 'preload') {
  for (const [src] of runtimes) {
    if (document.head.querySelector(`link[data-apex-runtime-hint="${rel}:${src}"]`)) continue;
    const link = document.createElement('link');
    link.rel = rel;
    link.as = 'script';
    link.href = src;
    link.dataset.apexRuntimeHint = `${rel}:${src}`;
    document.head.appendChild(link);
  }
}

export function preloadRuntimeSources() {
  hintRuntimeSources(MENU_INTERACTIVE_RUNTIMES, 'preload');
}

export function prefetchDeferredRuntimeSources() {
  hintRuntimeSources(DEFERRED_GAME_RUNTIMES, 'prefetch');
}
