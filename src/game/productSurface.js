// APEX CHAOS pre-pilot product graph.
//
// This is the single semantic authority for what the product exposes. It is
// intentionally framework-free so React, classic Arsenal runtimes, headless
// gates, and developer tooling all query the same graph rather than keeping
// their own route/roster allowlists.

export const PRODUCT_AVAILABILITY = Object.freeze({
  ACTIVE: 'ACTIVE',
  LOCKED: 'LOCKED',
  ADMIN: 'ADMIN',
  LEGACY_DETACHED: 'LEGACY / DETACHED',
});

const { ACTIVE, LOCKED, ADMIN, LEGACY_DETACHED } = PRODUCT_AVAILABILITY;

// Stable storage IDs stay canonical. ICE may be displayed as FROST by the
// Hero Registry; display copy is deliberately resolved at render time rather
// than duplicating a second name authority here.
const VISIBLE_ROSTER_IDS = Object.freeze([
  'ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR',
  'BLACK_HOLE', 'MATH_V2', 'RUBBER', 'TIME', 'SLIME', 'SNIPER',
]);
const PLAYABLE_ROSTER_IDS = Object.freeze([
  'ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR',
]);
const VISIBLE_LOCKED_ROSTER_IDS = Object.freeze([
  'BLACK_HOLE', 'MATH_V2', 'RUBBER', 'TIME', 'SLIME', 'SNIPER',
]);

function surface(id, title, availability, detail, extra = {}) {
  return Object.freeze({ id, title, availability, detail, ...extra });
}

// Ordering is intentional: it is the normal-public navigation graph. ADMIN
// and detached entries remain queryable below but do not appear here.
const PUBLIC_SURFACES = Object.freeze([
  surface('quest-01', 'Quest 01', LOCKED, 'Quest 01 is not available in the pre-pilot build.'),
  surface('bot-battle', 'Bot Battle', ACTIVE, 'Choose a fighter and face the accepted Arsenal CPU.', { route: 'bot' }),
  surface('local-1v1', 'Local 1v1', ACTIVE, 'Choose two owned Core Six fighters and launch Arsenal Free Battle.', { route: 'local' }),
  surface('fighter-shop', 'Fighter Shop', ACTIVE, 'Unlock available Core Six fighters for 1000 AC.', { route: 'shop' }),
  surface('lucky-draw', 'Lucky Draw', ACTIVE, 'Draw one available Core Six fighter for 350 AC.', { route: 'draw' }),
  surface('fighter-upgrade', 'Fighter Upgrade', LOCKED, 'Fighter Upgrade is not available in the pre-pilot build.'),
  surface('dictionary', 'Dictionary', LOCKED, 'Dictionary is not available in the pre-pilot build.'),
  surface('missions', 'Missions', LOCKED, 'Missions are not available in the pre-pilot build.'),
  surface('achievements', 'Achievements', LOCKED, 'Achievements are not available in the pre-pilot build.'),
  surface('account-profile', 'Account / Profile', LOCKED, 'Account / Profile is not available in the pre-pilot build.'),
]);

const ADMIN_SURFACES = Object.freeze([
  surface('arsenal-lab', 'Arsenal Lab', ADMIN,
    'Developer-only real Arsenal Lab. Launch deliberately through the admin seam.',
    { route: 'lab', publicNavigation: false, launchHint: 'window.apexLaunchArsenalLab()' }),
]);

// These names remain queryable so compatibility code cannot silently become
// product authority. They are explicitly non-launchable from normal UI.
const DETACHED_SURFACES = Object.freeze([
  surface('classic-play', 'Classic Play', LEGACY_DETACHED, 'Retired public route.'),
  surface('apex-control', 'APEX CONTROL', LEGACY_DETACHED, 'Retired public route.'),
  surface('three-phase-battle', '3-Phase / Tam Chien', LEGACY_DETACHED, 'Retired public route.'),
  surface('saitama-trial', 'Saitama Trial', LEGACY_DETACHED, 'Retired public route.'),
  surface('tournament', 'Tournament', LEGACY_DETACHED, 'Retired public route.'),
  surface('standalone-solo', 'Standalone Solo', LEGACY_DETACHED, 'Retired public route.'),
  surface('arsenal-quest-ladder', 'Arsenal Quest Ladder', LEGACY_DETACHED, 'Retired compatibility route.'),
]);

const ALL_SURFACES = Object.freeze([...PUBLIC_SURFACES, ...ADMIN_SURFACES, ...DETACHED_SURFACES]);
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

export function listProductSurfaces({ includeAdmin = false, includeDetached = false } = {}) {
  const list = [...PUBLIC_SURFACES];
  if (includeAdmin) list.push(...ADMIN_SURFACES);
  if (includeDetached) list.push(...DETACHED_SURFACES);
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
  cleanStateCredits: 350,
});

function makeAuthority() {
  return Object.freeze({
    version: 'pre-pilot-product-graph-v1',
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
  if (current && current.version === 'pre-pilot-product-graph-v1') return current;
  const authority = makeAuthority();
  if (scope) scope.APEX_PRODUCT_SURFACE = authority;
  return authority;
}

// The React entry is evaluated before deferred classic scripts. Registering
// here gives legacy-compatible runtimes one authoritative global seam without
// making the product graph depend on a second /public copy.
if (typeof window !== 'undefined') installProductSurfaceAuthority(window);
