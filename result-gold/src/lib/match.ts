import { RARITY_WEIGHT } from "../data/achievements";
import type {
  AchievementDef,
  MatchResult,
  PlayerResult,
  Rarity,
  WeaponDef,
} from "../data/types";

/** Thousands separator is fixed to en-US so "6,240" is identical on every device. */
export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function fmtMetric(value: number, unit: string) {
  const v = Number.isInteger(value) ? fmt(value) : value.toFixed(1);
  if (!unit) return v;
  if (unit === "%" || unit === "s" || unit === "×") return `${v}${unit}`;
  return `${v} ${unit}`;
}

export function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ───────────────────────── damage comparison */

export interface DamageShare {
  /** Exact percentages. a + b === 100 by construction. */
  aPct: number;
  bPct: number;
  /** Display strings with 1 decimal that always sum to 100.0. */
  aLabel: string;
  bLabel: string;
  lead: number;
  leaderSlot: 1 | 2 | null;
}

export function getDamageShare(match: MatchResult): DamageShare {
  const [p1, p2] = match.players;
  const a = p1.damage.dealt;
  const b = p2.damage.dealt;
  const total = a + b;
  const aPct = total === 0 ? 50 : (a / total) * 100;
  const bPct = 100 - aPct; // exact complement → bar always totals 100%
  const aLabel = aPct.toFixed(1);
  const bLabel = (100 - Number(aLabel)).toFixed(1);
  return {
    aPct,
    bPct,
    aLabel,
    bLabel,
    lead: Math.abs(a - b),
    leaderSlot: a === b ? null : a > b ? 1 : 2,
  };
}

/* ───────────────────────── weapon of the battle */

export interface WeaponSpotlight {
  weapon: WeaponDef;
  owner: PlayerResult;
  damage: number;
  shareOfOwner: number;
  shareOfMatch: number;
  runnerUp: { weapon: WeaponDef; damage: number; owner: PlayerResult } | null;
  leadOverRunnerUp: number;
}

function weaponDamageList(match: MatchResult) {
  const byId = new Map<string, {weapon: WeaponDef; owner: PlayerResult; damage: number; ownerDamage: number}>();
  for (const p of match.players) {
    for (const src of p.damage.sources) {
      if (src.kind !== "weapon" || !src.weaponId || !(src.damage > 0)) continue;
      const weapon = match.weapons.find(w => w.id === src.weaponId);
      if (!weapon) continue;
      let entry = byId.get(src.weaponId);
      if (!entry) { entry = { weapon, owner: p, damage: 0, ownerDamage: 0 }; byId.set(src.weaponId, entry); }
      entry.damage += src.damage;
    }
  }
  // The same ID across BOTH players is ONE candidate. Owner field means the
  // side that actually contributed the most weapon damage, NOT the winner.
  for (const entry of byId.values()) {
    const sums = match.players.map(p => p.damage.sources.filter(src => src.kind === "weapon" &&
      src.weaponId === entry!.weapon.id).reduce((total, src) => total + src.damage, 0));
    const ownerSide = sums[1] > sums[0] ? 1 : 0;
    entry.owner = match.players[ownerSide];
    entry.ownerDamage = sums[ownerSide];
  }
  return [...byId.values()].sort((x, y) => y.damage - x.damage || x.weapon.id.localeCompare(y.weapon.id));
}

/** One Weapon ID across both fighters, ranked only by real HP damage. */
export function deriveWeaponOfTheBattle(match: MatchResult) {
  return weaponDamageList(match)[0] ?? null;
}

export function getWeaponSpotlight(match: MatchResult): WeaponSpotlight | null {
  const ranked = weaponDamageList(match);
  const top = ranked[0];
  if (!top) return null; // Zero weapon damage is a genuine empty result.
  const second = ranked[1] ?? null;
  const total = match.players[0].damage.dealt + match.players[1].damage.dealt;
  return {
    weapon: top.weapon,
    owner: top.owner,
    damage: top.damage,
    shareOfOwner: total > 0 ? 100 * top.damage / total : 0,
    shareOfMatch: total > 0 ? 100 * top.damage / total : 0,
    runnerUp: second ? { weapon: second.weapon, damage: second.damage, owner: second.owner } : null,
    leadOverRunnerUp: second ? top.damage - second.damage : top.damage,
  };
}

/* ───────────────────────── achievements */

export interface ResolvedAward {
  def: AchievementDef;
  value: number;
  /** How far past the threshold, as a ratio (1 = exactly at threshold). */
  ratio: number;
  passed: boolean;
}

/**
 * Presentation accepts only PRE-AWARDED events from the authoritative engine.
 * This defensive guard rejects incomplete/failed awards; it never grants awards.
 * The engine must calculate all simultaneous conditions, hero IDs and events.
 */
export function resolveAwards(
  player: PlayerResult,
  index: Record<string, AchievementDef>
): ResolvedAward[] {
  const resolved: ResolvedAward[] = [];
  player.awards.forEach((a) => {
    const def = index[a.achievementId];
    if (!def || (def.heroId && def.heroId !== player.character.heroId)) return;
    const actual: Record<string, number> = { ...(a.observedParams ?? {}) };
    if (def.conditions[0] && actual[def.conditions[0].key] === undefined) {
      actual[def.conditions[0].key] = a.value;
    }
    const passed = def.conditions.length
      ? def.conditions.every((c) => Number.isFinite(actual[c.key]) &&
          (c.compare === "gte" ? actual[c.key] >= c.value : actual[c.key] <= c.value))
      : Number.isFinite(a.value) && a.value > 0;
    if (!passed) return; // incomplete telemetry must NOT earn a medal
    const t = def.metric.threshold;
    const ratio = t > 0 && Number.isFinite(a.value)
      ? def.metric.comparator === "gte" ? a.value / t : t / Math.max(a.value, 0.0001)
      : 1;
    resolved.push({ def, value: a.value, ratio, passed });
  });
  return resolved
    .map((r, i) => ({ r, i }))
    .sort((x, y) => RARITY_WEIGHT[y.r.def.rarity] - RARITY_WEIGHT[x.r.def.rarity] || x.i - y.i)
    .map((x) => x.r);
}

export function rarityPips(r: Rarity) {
  return RARITY_WEIGHT[r];
}

/* ───────────────────────── fixture integrity */

export interface IntegrityReport {
  checks: number;
  issues: string[];
}

/**
 * Cross-checks the dataset the way the game engine would need it to be consistent.
 * The UI shows the result in the footer so a reviewer can see the data is coherent.
 */
export function validateMatch(match: MatchResult, catalog: AchievementDef[]): IntegrityReport {
  const issues: string[] = [];
  let checks = 0;
  const check = (ok: boolean, msg: string) => {
    checks++;
    if (!ok) issues.push(msg);
  };
  const index = Object.fromEntries(catalog.map((a) => [a.id, a]));
  check(catalog.length === 47, `Owner active catalogue must contain 47 (has ${catalog.length}).`);
  check(new Set(catalog.map((a) => a.id)).size === catalog.length, "Duplicate achievement IDs.");
  check(new Set(catalog.map((a) => a.icon)).size === catalog.length, "Duplicate medal icon keys.");
  check(match.players[0].id !== match.players[1].id, "P1 and P2 must have distinct participant IDs.");
  check(match.players.filter((p) => p.outcome === "victory").length === 1, "Duel requires one winner.");
  for (const p of match.players) {
    const sum = p.damage.sources.reduce((total, source) => total + source.damage, 0);
    check(Math.abs(sum - p.damage.dealt) < 0.001, `${p.handle}: source sum and damage dealt disagree.`);
    check(new Set(p.awards.map((a) => a.achievementId)).size === p.awards.length, `${p.handle}: duplicate award.`);
    for (const award of p.awards) {
      const def = index[award.achievementId];
      check(!!def, `${p.handle}: unknown/dropped award ${award.achievementId}.`);
      if (!def) continue;
      check(!def.heroId || def.heroId === p.character.heroId, `${p.handle}: ${def.id} belongs to another hero.`);
      const observed: Record<string, number> = { ...(award.observedParams ?? {}) };
      if (def.conditions[0] && observed[def.conditions[0].key] === undefined) observed[def.conditions[0].key] = award.value;
      for (const c of def.conditions) {
        const actual = observed[c.key];
        check(Number.isFinite(actual), `${p.handle}: ${def.id}.${c.key} missing actual value.`);
        if (Number.isFinite(actual)) check(c.compare === "gte" ? actual >= c.value : actual <= c.value,
          `${p.handle}: ${def.id}.${c.key} value ${actual} fails ${c.compare} ${c.value}.`);
      }
      if (def.conditions.length === 0) check(award.value > 0, `${p.handle}: ${def.id} requires confirmed event.`);
      if (def.id === "legend-survivor") check(award.value === p.stats.healing, `${p.handle}: healing mismatch.`);
      if (def.id === "skill-focus") check(award.value === p.stats.skillCasts, `${p.handle}: skill casts mismatch.`);
      if (def.id === "comeback" || def.id === "last-stand") check(p.outcome === "victory", `${p.handle}: ${def.id} needs victory.`);
    }
  }
  // No global assert winner.damage >= loser.damage, nor perfectly mirrored damage/taken.
  // Environment damage, healing and overkill semantics can differ.
  const [p1, p2] = match.players;
  for (const p of [p1, p2]) check(Number.isFinite(p.damage.dealt) && p.damage.dealt >= 0, `${p.handle}: invalid damage.`);
  return { checks, issues };
}
