// APEX CHAOS current product graph.
//
// This is the single semantic authority for what the product exposes. It is
// intentionally framework-free so React, the neutral Arsenal runtime,
// acceptance gates, and developer tooling all query one graph rather than
// maintaining parallel route or roster allowlists.

export const PRODUCT_AVAILABILITY = Object.freeze({
  ACTIVE: 'ACTIVE',
  LOCKED: 'LOCKED',
  ADMIN: 'ADMIN',
});

const { ACTIVE, LOCKED, ADMIN } = PRODUCT_AVAILABILITY;

// Stable storage IDs stay canonical. ICE may be displayed as FROST by the
// Hero Registry; display copy is resolved at render time rather than duplicated
// as another naming authority here.
const VISIBLE_ROSTER_IDS = Object.freeze([
  'ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR', 'BOXE', 'SHURI',
  'BLACK_HOLE', 'MATH_V2', 'RUBBER', 'TIME', 'SLIME', 'SNIPER',
]);
const PLAYABLE_ROSTER_IDS = Object.freeze([
  'ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR', 'BOXE', 'SHURI',
]);
const VISIBLE_LOCKED_ROSTER_IDS = Object.freeze([
  'BLACK_HOLE', 'MATH_V2', 'RUBBER', 'TIME', 'SLIME', 'SNIPER',
]);

function surface(id, title, availability, detail, extra = {}) {
  return Object.freeze({ id, title, availability, detail, ...extra });
}

// Ordering is intentional: playable product surfaces appear first, followed
// by the six remaining locked roadmap surfaces. ADMIN is separate from public
// navigation and can only launch through its explicit owner seam.
const PUBLIC_SURFACES = Object.freeze([
  surface('bot-battle', 'Bot Battle', ACTIVE, 'Choose a fighter and face the accepted Arsenal CPU.', { route: 'bot' }),
  surface('local-1v1', 'Local 1v1', ACTIVE, 'Choose two available fighters and launch Arsenal Battle.', { route: 'local' }),
  surface('bot-wave', 'BOT WAVE', ACTIVE, 'BOXE / ARSENAL SURVIVAL — open-ended five-beat chapters with BOXE and 41 native Arsenal weapons.', { route: 'wave', special: true, preview: true }),
  surface('cosmetic-locker', 'Cosmetic Locker', ACTIVE, 'Choose original or registered Fighter and Weapon skin presentations per player.', { route: 'skins' }),
  // DOUBLE_AUDIT_2026-10-04: Fighter Shop conflicts with the Gold product
  // direction for this cutover, so it is a LIGHTLY LOCKED extension point —
  // visible in the product graph, not launchable. The route stays declared
  // (no future-surface metadata is rewritten); only its availability changes.
  surface('fighter-shop', 'Fighter Shop', LOCKED, 'Fighter Shop is not available yet.'),
  surface('lucky-draw', 'Lucky Draw', ACTIVE, 'Draw one available fighter for 350 AC.', { route: 'draw' }),
  surface('quest-01', 'Quest 01', LOCKED, 'Quest 01 is a future surface and is not available yet.'),
  surface('fighter-upgrade', 'Fighter Upgrade', LOCKED, 'Fighter Upgrade is not available yet.'),
  surface('dictionary', 'Field Archive', ACTIVE, 'Browse playable fighters and Arsenal, inspect approved Gold art and equip cosmetic skins for P1/P2.', { route: 'skins' }),
  surface('missions', 'Missions', ACTIVE, 'Earn bonus Apex Credits from completed battles.', { route: 'progress' }),
  surface('achievements', 'Achievements', ACTIVE, 'One-time milestones and bonus Apex Credits.', { route: 'progress' }),
  surface('account-profile', 'Account / Profile', LOCKED, 'Account / Profile is not available yet.'),
]);

const ADMIN_SURFACES = Object.freeze([
  surface('arsenal-lab', 'Arsenal Lab', ADMIN,
    'Developer-only real Arsenal Lab. Launch deliberately through the admin seam.',
    { route: 'lab', publicNavigation: false, launchHint: 'window.apexLaunchArsenalLab()' }),
]);

const ALL_SURFACES = Object.freeze([...PUBLIC_SURFACES, ...ADMIN_SURFACES]);
const SURFACES_BY_ID = new Map(ALL_SURFACES.map((entry) => [entry.id, entry]));

function normalizeId(id) {
  return String(id == null ? '' : id).trim().toLowerCase();
}

function cloneSurface(entry) {
  return entry ? { ...entry } : null;
}

export function getProductSurface(id) {
  return cloneSurface(SURFACES_BY_ID.get(normalizeId(id)));
}

export function listProductSurfaces({ includeAdmin = false } = {}) {
  const list = [...PUBLIC_SURFACES];
  if (includeAdmin) list.push(...ADMIN_SURFACES);
  return list.map(cloneSurface);
}

export function productAvailability(id) {
  return SURFACES_BY_ID.get(normalizeId(id))?.availability || null;
}

export function canLaunchProductSurface(id, { admin = false } = {}) {
  const availability = productAvailability(id);
  return availability === ACTIVE || (admin && availability === ADMIN);
}

export function isPublicPlayableFighter(id) {
  return PLAYABLE_ROSTER_IDS.includes(String(id == null ? '' : id).toUpperCase());
}

export function isVisibleProductFighter(id) {
  return VISIBLE_ROSTER_IDS.includes(String(id == null ? '' : id).toUpperCase());
}

export const PRODUCT_ROSTER = Object.freeze({
  visibleIds: VISIBLE_ROSTER_IDS,
  playableIds: PLAYABLE_ROSTER_IDS,
  lockedIds: VISIBLE_LOCKED_ROSTER_IDS,
});

export const PRODUCT_ECONOMY = Object.freeze({
  shopCost: 1000,
  drawCost: 350,
  // A1 production law: a genuinely new player profile starts at exactly
  // 350 AC with ROBOT (NEWBOT) as the only owned fighter. The r44
  // owner-playtest 12,000 AC seed is retired; existing balances are
  // preserved by the meta runtime and are never refilled.
  cleanStateCredits: 350,
  // Match rewards (committed only by the wallet authority in
  // arsenalMetaRuntime.awardBattleResult): BOT win 200, BOT loss 25
  // (provisional legacy), LOCAL valid completion 50 for either winner.
  // Lab/Admin/Quest/incomplete matches pay 0.
  matchRewards: Object.freeze({ botWin: 200, botLoss: 25, localComplete: 50 }),
});

function makeAuthority() {
  return Object.freeze({
    version: 'arsenal-product-graph-v1',
    Availability: PRODUCT_AVAILABILITY,
    roster: PRODUCT_ROSTER,
    economy: PRODUCT_ECONOMY,
    get: getProductSurface,
    list: listProductSurfaces,
    publicNavigation: () => listProductSurfaces(),
    availabilityOf: productAvailability,
    canLaunch: canLaunchProductSurface,
    isPublicPlayableFighter,
    isVisibleProductFighter,
  });
}

export function installProductSurfaceAuthority(scope = globalThis) {
  const current = scope && scope.APEX_PRODUCT_SURFACE;
  if (current && current.version === 'arsenal-product-graph-v1') return current;
  const authority = makeAuthority();
  if (scope) scope.APEX_PRODUCT_SURFACE = authority;
  return authority;
}

// The React entry is evaluated before deferred classic scripts. Registering
// here gives the active runtimes one authoritative global seam without making
// the product graph depend on a second /public copy.
if (typeof window !== 'undefined') installProductSurfaceAuthority(window);
