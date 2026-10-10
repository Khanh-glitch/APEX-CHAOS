/**
 * APEX CHAOS — Post-match data contract.
 *
 * Everything the results screen renders is described by these types.
 * To integrate with the real game, produce a `MatchResult` + `AchievementDef[]`
 * from the engine and pass them to <MatchResults />. No rendering code
 * reads anything outside of these structures.
 */

export type Rarity = "common" | "rare" | "epic" | "legendary";

export type AchievementCategory =
  | "offense"
  | "precision"
  | "weapon"
  | "survival"
  | "tactics"
  | "chaos"
  | "signature";

/** Keys resolved to icons in components/icons.ts (kept as strings so data stays serialisable). */
export type IconKey = string;

export interface MetricSpec {
  /** What the number means, e.g. "Chuỗi sát thương liên tục". */
  label: string;
  /** Display suffix: "DMG", "HP", "%", "s", "×", "lần"... */
  unit: string;
  /** Value needed to earn the achievement. */
  threshold: number;
  /** gte: value must be >= threshold. lte: value must be <= threshold (lower is better). */
  comparator: "gte" | "lte";
}

export interface AchievementCondition {
  key: string;
  label: string;
  value: number;
  unit: string;
  compare: "gte" | "lte";
}

export interface AchievementDef {
  id: string;
  name: string;
  category: AchievementCategory;
  rarity: Rarity;
  icon: IconKey;
  description: string;
  /** Fully resolved rule, including *every* owner-approved numeric condition. */
  rule: string;
  /** All numeric predicates from the owner's JSON; never use metric alone for eligibility. */
  conditions: AchievementCondition[];
  /** Short technical explanation, if supplied in owner JSON. */
  explain: string;
  heroId: string | null;
  slot: number;
  /** Backward-compatible first metric for Gold readouts only. */
  metric: MetricSpec;
}

export interface AwardedAchievement {
  achievementId: string;
  /** The player's actual value for the achievement's metric. */
  value: number;
  /** Values for every numeric predicate; primary condition can fall back to value. */
  observedParams?: Record<string, number>;
}

export type WeaponClass =
  | "railgun"
  | "shotgun"
  | "smg"
  | "marksman"
  | "launcher"
  | "plasma";

export interface WeaponDef {
  id: string;
  name: string;
  weaponClass: WeaponClass;
  classLabel: string;
  tierLabel: string;
  tagline: string;
  ownerId: string;
  /** Which built-in placeholder silhouette to draw when no artSrc is given. */
  silhouette: "railgun" | "generic";
  /** Replace with real art (transparent PNG/WebP, ~3:1). */
  artSrc?: string;
  stats: { shotsFired: number; shotsHit: number; bestHit: number };
}

export interface DamageSource {
  id: string;
  label: string;
  kind: "weapon" | "skill";
  /** Present when kind === "weapon". */
  weaponId?: string;
  damage: number;
}

export interface PlayerStats {
  accuracy: number; // %
  critRate: number; // %
  healing: number; // HP
  skillCasts: number;
}

export interface PlayerResult {
  id: string;
  slot: 1 | 2;
  handle: string;
  level: number;
  rankTitle: string;
  outcome: "victory" | "defeat";
  /** Team identity colour as hex + space separated rgb (for alpha mixing in CSS). */
  accent: string;
  accentRgb: string;
  character: {
    name: string;
    className: string;
    tagline: string;
    artKind: "breacher" | "wraith" | "generic";
    /** Stable production hero identity; required when awarding signature commendations. */
    heroId?: string;
    /** Replace with real portrait (transparent PNG/WebP, ~3:4). */
    portraitSrc?: string;
  };
  damage: {
    dealt: number;
    taken: number;
    sources: DamageSource[];
  };
  stats: PlayerStats;
  /** Exactly the awards earned in this match. Order is the authored order. */
  awards: AwardedAchievement[];
}

export interface MatchMeta {
  id: string;
  map: string;
  mode: string;
  season: string;
  durationSec: number;
  playedAt: string;
}

export interface MatchResult {
  meta: MatchMeta;
  players: [PlayerResult, PlayerResult];
  weapons: WeaponDef[];
  /** Explicit engine-provided value. The validator re-derives it from sources and compares. */
  weaponOfTheBattle: { weaponId: string; ownerId: string; damage: number };
}
