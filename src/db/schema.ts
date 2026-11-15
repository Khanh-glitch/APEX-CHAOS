import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const battleMatches = pgTable("battle_matches", {
  id: serial("id").primaryKey(),
  matchCode: text("match_code").notNull(),
  mode: text("mode").notNull().default("bot"),
  ruleset: text("ruleset").notNull().default("standard"),
  arenaId: text("arena_id").notNull().default("scrap_foundry"),
  aiTier: text("ai_tier").notNull().default("veteran"),
  p1Hero: text("p1_hero").notNull(),
  p2Hero: text("p2_hero").notNull(),
  winnerSide: text("winner_side").notNull(),
  durationSec: integer("duration_sec").notNull().default(0),
  p1Damage: integer("p1_damage").notNull().default(0),
  p2Damage: integer("p2_damage").notNull().default(0),
  p1Parries: integer("p1_parries").notNull().default(0),
  p2Parries: integer("p2_parries").notNull().default(0),
  p1Overdrives: integer("p1_overdrives").notNull().default(0),
  p2Overdrives: integer("p2_overdrives").notNull().default(0),
  maxComboRank: text("max_combo_rank").notNull().default("B"),
  topWeapon: text("top_weapon").notNull().default("UNARMED"),
  topWeaponDamage: integer("top_weapon_damage").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fighterTelemetry = pgTable("fighter_telemetry", {
  heroId: text("hero_id").primaryKey(),
  matchesPlayed: integer("matches_played").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  totalDamage: integer("total_damage").notNull().default(0),
  perfectParries: integer("perfect_parries").notNull().default(0),
  overdrivesCast: integer("overdrives_cast").notNull().default(0),
  fastestWinSec: integer("fastest_win_sec").notNull().default(999),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const commanderProfiles = pgTable("commander_profiles", {
  profileKey: text("profile_key").primaryKey(),
  callsign: text("callsign").notNull().default("BASIN VANGUARD"),
  eloRating: integer("elo_rating").notNull().default(1200),
  matchesTotal: integer("matches_total").notNull().default(0),
  winsTotal: integer("wins_total").notNull().default(0),
  winStreak: integer("win_streak").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
