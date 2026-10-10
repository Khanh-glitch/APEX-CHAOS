import type { MatchResult, PlayerResult, WeaponDef } from "./types";

/**
 * FIXTURE — one frozen match used for design review.
 *
 * Rules:
 *  - No Math.random(), no Date.now(), nothing computed at runtime from the environment.
 *  - The 20 DEMO awards below (10 per player) were hand-picked ONCE while building the
 *    fixture and are stored literally. Reload / resize / replay can never change them.
 *  - Every number that must agree with another number is derived from the same constant.
 *
 * IMPORTANT: preview fixture numbers are NOT canonical game telemetry.
 * The actual game must calculate awards and values independently.
 * Narrative: REDLINE_KAI (P1) trailed by 1,120 damage around 2:05, survived on 7% HP and
 * flipped the duel with railgun + shotgun pressure. NULL.SPECTRE (P2) played the
 * long-range / skill / sustain game, was more accurate, healed more — and still lost.
 */

// ─────────── Damage per weapon / source (single source of truth)
const P1_RAILGUN = 2680;
const P1_SHOTGUN = 1540;
const P1_SMG = 980;
const P1_SKILL = 1040;
const P1_TOTAL = P1_RAILGUN + P1_SHOTGUN + P1_SMG + P1_SKILL; // 6,240

const P2_MARKSMAN = 2210;
const P2_SMG = 1120;
const P2_LAUNCHER = 830;
const P2_SKILL = 550;
const P2_TOTAL = P2_MARKSMAN + P2_SMG + P2_LAUNCHER + P2_SKILL; // 4,710

// ─────────── Per-player metrics reused by awards
const P1_STATS = { accuracy: 68, critRate: 34, healing: 620, skillCasts: 11 };
const P2_STATS = { accuracy: 82, critRate: 19, healing: 1950, skillCasts: 32 };

const weapons: WeaponDef[] = [
  {
    id: "razorback-x",
    name: "RAZORBACK-X",
    weaponClass: "railgun",
    classLabel: "Pháo Ray",
    tierLabel: "Hạng nặng",
    tagline: "Đường ray kép xuyên giáp",
    ownerId: "p1",
    silhouette: "railgun",
    stats: { shotsFired: 11, shotsHit: 8, bestHit: 412 },
  },
  {
    id: "ironhide-12",
    name: "IRONHIDE-12",
    weaponClass: "shotgun",
    classLabel: "Shotgun",
    tierLabel: "Hạng trung",
    tagline: "Nòng kép cận chiến",
    ownerId: "p1",
    silhouette: "generic",
    stats: { shotsFired: 38, shotsHit: 29, bestHit: 188 },
  },
  {
    id: "pitbull-9",
    name: "PITBULL-9",
    weaponClass: "smg",
    classLabel: "Tiểu Liên",
    tierLabel: "Hạng nhẹ",
    tagline: "Nhịp bắn dồn dập",
    ownerId: "p1",
    silhouette: "generic",
    stats: { shotsFired: 210, shotsHit: 131, bestHit: 24 },
  },
  {
    id: "vesper-7",
    name: "VESPER-7",
    weaponClass: "marksman",
    classLabel: "Súng Bắn Tỉa",
    tierLabel: "Hạng trung",
    tagline: "Tầm xa, độ chính xác cao",
    ownerId: "p2",
    silhouette: "generic",
    stats: { shotsFired: 34, shotsHit: 29, bestHit: 301 },
  },
  {
    id: "hailstorm-m3",
    name: "HAILSTORM-M3",
    weaponClass: "smg",
    classLabel: "Tiểu Liên",
    tierLabel: "Hạng nhẹ",
    tagline: "Cơn mưa đạn",
    ownerId: "p2",
    silhouette: "generic",
    stats: { shotsFired: 188, shotsHit: 152, bestHit: 22 },
  },
  {
    id: "siren-arc",
    name: "SIREN ARC",
    weaponClass: "launcher",
    classLabel: "Súng Phóng",
    tierLabel: "Hạng nặng",
    tagline: "Đạn nổ hồ quang",
    ownerId: "p2",
    silhouette: "generic",
    stats: { shotsFired: 9, shotsHit: 7, bestHit: 240 },
  },
];

const player1: PlayerResult = {
  id: "p1",
  slot: 1,
  handle: "REDLINE_KAI",
  level: 47,
  rankTitle: "Foundry Elite II",
  outcome: "victory",
  accent: "#ff6a1a",
  accentRgb: "255 106 26",
  character: {
    name: "CINDER",
    className: "Breacher",
    tagline: "Xung phong hạng nặng",
    artKind: "breacher",
  },
  damage: {
    dealt: P1_TOTAL,
    taken: P2_TOTAL,
    sources: [
      { id: "src-razorback", label: "RAZORBACK-X", kind: "weapon", weaponId: "razorback-x", damage: P1_RAILGUN },
      { id: "src-ironhide", label: "IRONHIDE-12", kind: "weapon", weaponId: "ironhide-12", damage: P1_SHOTGUN },
      { id: "src-pitbull", label: "PITBULL-9", kind: "weapon", weaponId: "pitbull-9", damage: P1_SMG },
      { id: "src-skill-1", label: "Kỹ năng · Phá Cổng Nhiệt", kind: "skill", damage: P1_SKILL },
    ],
  },
  stats: P1_STATS,
  // Authored order = display priority (legendary → epic → rare → common).
  awards: [
    { achievementId: "comeback", value: 1120 },
    { achievementId: "no-escape", value: 1840, observedParams: { damage: 1840, gap: 1.2 } },
    { achievementId: "mastery-auto", value: P1_SMG },
    { achievementId: "assassin", value: P1_STATS.critRate, observedParams: { crit: P1_STATS.critRate, hits: 10 } },
    { achievementId: "last-stand", value: 7 },
    { achievementId: "mastery-shotgun", value: P1_SHOTGUN },
    { achievementId: "executioner", value: 15 },
    { achievementId: "point-blank", value: 1610, observedParams: { damage: 1610, distance: 170 } },
    { achievementId: "kiter", value: 2310, observedParams: { damage: 2310, speed: 275 } },
    { achievementId: "first-blood", value: 1 },
  ],
};

const player2: PlayerResult = {
  id: "p2",
  slot: 2,
  handle: "NULL.SPECTRE",
  level: 52,
  rankTitle: "Static Veteran I",
  outcome: "defeat",
  accent: "#27d3ff",
  accentRgb: "39 211 255",
  character: {
    name: "STATIC",
    className: "Wraith",
    tagline: "Du kích tầm xa",
    artKind: "wraith",
  },
  damage: {
    dealt: P2_TOTAL,
    taken: P1_TOTAL,
    sources: [
      { id: "src-vesper", label: "VESPER-7", kind: "weapon", weaponId: "vesper-7", damage: P2_MARKSMAN },
      { id: "src-hailstorm", label: "HAILSTORM-M3", kind: "weapon", weaponId: "hailstorm-m3", damage: P2_SMG },
      { id: "src-siren", label: "SIREN ARC", kind: "weapon", weaponId: "siren-arc", damage: P2_LAUNCHER },
      { id: "src-skill-2", label: "Kỹ năng · Xung Tĩnh Điện", kind: "skill", damage: P2_SKILL },
    ],
  },
  stats: P2_STATS,
  awards: [
    { achievementId: "chaos-bringer", value: 20, observedParams: { window: 20, sources: 3 } },
    { achievementId: "sure-shot", value: P2_STATS.accuracy, observedParams: { accuracy: P2_STATS.accuracy, shots: 34 } },
    { achievementId: "legend-survivor", value: P2_STATS.healing },
    { achievementId: "combo-artist", value: 3, observedParams: { chains: 3, window: 2 } },
    { achievementId: "mastery-precision", value: P2_MARKSMAN },
    { achievementId: "skill-focus", value: P2_STATS.skillCasts },
    { achievementId: "eagle-eye", value: 1350, observedParams: { damage: 1350, distance: 700 } },
    { achievementId: "adrenaline", value: 300, observedParams: { damage: 300, hp: 24 } },
    { achievementId: "scavenger", value: 20 },
    { achievementId: "pacifist", value: 52, observedParams: { seconds: 52, travel: 520 } },
  ],
};

export const MATCH_FIXTURE: MatchResult = {
  meta: {
    id: "AC-26-0417-3305",
    map: "Rust Basin Foundry",
    mode: "Đấu Tay Đôi · Xếp Hạng",
    season: "Mùa 7",
    durationSec: 252,
    playedAt: "2026-04-17T14:32:00Z",
  },
  players: [player1, player2],
  weapons,
  weaponOfTheBattle: { weaponId: "razorback-x", ownerId: "p1", damage: P1_RAILGUN },
};
