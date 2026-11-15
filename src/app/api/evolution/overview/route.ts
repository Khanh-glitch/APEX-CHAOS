import { NextResponse } from "next/server";
import { db } from "@/db";
import { battleMatches, fighterTelemetry, commanderProfiles } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const DEFAULT_HEROES = [
  { heroId: "ROBOT", matchesPlayed: 28, wins: 17, totalDamage: 42850, perfectParries: 34, overdrivesCast: 22, fastestWinSec: 39 },
  { heroId: "HUNTER", matchesPlayed: 24, wins: 14, totalDamage: 38120, perfectParries: 29, overdrivesCast: 19, fastestWinSec: 36 },
  { heroId: "CRYSTAL", matchesPlayed: 21, wins: 13, totalDamage: 33490, perfectParries: 41, overdrivesCast: 17, fastestWinSec: 44 },
  { heroId: "MAGNET", matchesPlayed: 19, wins: 10, totalDamage: 31200, perfectParries: 26, overdrivesCast: 15, fastestWinSec: 42 },
  { heroId: "ICE", matchesPlayed: 22, wins: 12, totalDamage: 34900, perfectParries: 31, overdrivesCast: 18, fastestWinSec: 41 },
  { heroId: "MIRROR", matchesPlayed: 18, wins: 10, totalDamage: 29840, perfectParries: 37, overdrivesCast: 14, fastestWinSec: 47 },
  { heroId: "BOXE", matchesPlayed: 26, wins: 16, totalDamage: 45100, perfectParries: 48, overdrivesCast: 24, fastestWinSec: 34 },
  { heroId: "SHURI", matchesPlayed: 17, wins: 9, totalDamage: 28760, perfectParries: 22, overdrivesCast: 13, fastestWinSec: 45 },
  { heroId: "BLACK_HOLE", matchesPlayed: 20, wins: 13, totalDamage: 39600, perfectParries: 33, overdrivesCast: 21, fastestWinSec: 37 },
  { heroId: "TIME", matchesPlayed: 19, wins: 11, totalDamage: 35420, perfectParries: 39, overdrivesCast: 18, fastestWinSec: 40 },
];

const SEED_MATCHES = [
  {
    matchCode: "SB-9041",
    mode: "bot",
    ruleset: "mythic_mayhem",
    arenaId: "scrap_foundry",
    aiTier: "grandmaster",
    p1Hero: "BLACK_HOLE",
    p2Hero: "BOXE",
    winnerSide: "p1",
    durationSec: 48,
    p1Damage: 1840,
    p2Damage: 1410,
    p1Parries: 4,
    p2Parries: 2,
    p1Overdrives: 2,
    p2Overdrives: 1,
    maxComboRank: "APEX",
    topWeapon: "STORMBREAKER",
    topWeaponDamage: 892,
  },
  {
    matchCode: "SB-9040",
    mode: "bot",
    ruleset: "standard",
    arenaId: "lorentz_railyard",
    aiTier: "veteran",
    p1Hero: "TIME",
    p2Hero: "HUNTER",
    winnerSide: "p1",
    durationSec: 54,
    p1Damage: 1620,
    p2Damage: 1290,
    p1Parries: 3,
    p2Parries: 1,
    p1Overdrives: 1,
    p2Overdrives: 1,
    maxComboRank: "S",
    topWeapon: "SZECSEI_FUCHS",
    topWeaponDamage: 615,
  },
  {
    matchCode: "SB-9039",
    mode: "local",
    ruleset: "championship_bo3",
    arenaId: "cryo_vault",
    aiTier: "local",
    p1Hero: "ICE",
    p2Hero: "CRYSTAL",
    winnerSide: "p2",
    durationSec: 67,
    p1Damage: 1510,
    p2Damage: 1735,
    p1Parries: 2,
    p2Parries: 5,
    p1Overdrives: 1,
    p2Overdrives: 2,
    maxComboRank: "S",
    topWeapon: "AK_47",
    topWeaponDamage: 540,
  },
  {
    matchCode: "SB-9038",
    mode: "bot",
    ruleset: "standard",
    arenaId: "prism_sanctum",
    aiTier: "nemesis",
    p1Hero: "ROBOT",
    p2Hero: "MIRROR",
    winnerSide: "p1",
    durationSec: 43,
    p1Damage: 1790,
    p2Damage: 1380,
    p1Parries: 4,
    p2Parries: 3,
    p1Overdrives: 2,
    p2Overdrives: 1,
    maxComboRank: "APEX",
    topWeapon: "M249_SAW",
    topWeaponDamage: 710,
  },
];

async function ensureSeeded(profileKey: string) {
  const existingHeroes = await db.select().from(fighterTelemetry);
  if (existingHeroes.length === 0) {
    await db.insert(fighterTelemetry).values(DEFAULT_HEROES).onConflictDoNothing();
  }
  const existingMatches = await db.select().from(battleMatches).limit(1);
  if (existingMatches.length === 0) {
    await db.insert(battleMatches).values(SEED_MATCHES);
  }
  const existingProfile = await db
    .select()
    .from(commanderProfiles)
    .where(eq(commanderProfiles.profileKey, profileKey));
  if (existingProfile.length === 0) {
    await db
      .insert(commanderProfiles)
      .values({
        profileKey,
        callsign: "BASIN VANGUARD",
        eloRating: 1280,
        matchesTotal: 4,
        winsTotal: 3,
        winStreak: 2,
        bestStreak: 4,
      })
      .onConflictDoNothing();
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profileKey = (searchParams.get("profileKey") || "local-vanguard").slice(0, 64);
    await ensureSeeded(profileKey);

    const [matches, fighters, profiles] = await Promise.all([
      db.select().from(battleMatches).orderBy(desc(battleMatches.id)).limit(20),
      db.select().from(fighterTelemetry).orderBy(desc(fighterTelemetry.wins)),
      db.select().from(commanderProfiles).where(eq(commanderProfiles.profileKey, profileKey)),
    ]);

    return NextResponse.json({
      ok: true,
      profile: profiles[0] || null,
      fighters,
      matches,
    });
  } catch (error) {
    console.error("[api/evolution/overview] GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Database telemetry unavailable", fighters: DEFAULT_HEROES, matches: SEED_MATCHES, profile: null },
      { status: 200 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const profileKey = String(body?.profileKey || "local-vanguard").slice(0, 64);
    const callsign = String(body?.callsign || "BASIN VANGUARD")
      .trim()
      .toUpperCase()
      .slice(0, 24) || "BASIN VANGUARD";
    await ensureSeeded(profileKey);
    const [updated] = await db
      .update(commanderProfiles)
      .set({ callsign, updatedAt: new Date() })
      .where(eq(commanderProfiles.profileKey, profileKey))
      .returning();
    return NextResponse.json({ ok: true, profile: updated });
  } catch (error) {
    console.error("[api/evolution/overview] PATCH error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
