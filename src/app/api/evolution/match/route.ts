import { NextResponse } from "next/server";
import { db } from "@/db";
import { battleMatches, fighterTelemetry, commanderProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const AI_ELO_BONUS: Record<string, number> = {
  recruit: 14,
  veteran: 22,
  grandmaster: 32,
  nemesis: 42,
  local: 18,
};

async function bumpFighter(
  heroId: string,
  won: boolean,
  damage: number,
  parries: number,
  overdrives: number,
  durationSec: number
) {
  const key = String(heroId || "ROBOT").toUpperCase();
  const rows = await db.select().from(fighterTelemetry).where(eq(fighterTelemetry.heroId, key));
  if (rows.length === 0) {
    await db.insert(fighterTelemetry).values({
      heroId: key,
      matchesPlayed: 1,
      wins: won ? 1 : 0,
      totalDamage: Math.max(0, Math.round(damage)),
      perfectParries: Math.max(0, Math.round(parries)),
      overdrivesCast: Math.max(0, Math.round(overdrives)),
      fastestWinSec: won && durationSec > 0 ? Math.round(durationSec) : 999,
    });
    return;
  }
  const cur = rows[0];
  const nextFastest =
    won && durationSec > 3
      ? Math.min(cur.fastestWinSec || 999, Math.round(durationSec))
      : cur.fastestWinSec;
  await db
    .update(fighterTelemetry)
    .set({
      matchesPlayed: cur.matchesPlayed + 1,
      wins: cur.wins + (won ? 1 : 0),
      totalDamage: cur.totalDamage + Math.max(0, Math.round(damage)),
      perfectParries: cur.perfectParries + Math.max(0, Math.round(parries)),
      overdrivesCast: cur.overdrivesCast + Math.max(0, Math.round(overdrives)),
      fastestWinSec: nextFastest,
      updatedAt: new Date(),
    })
    .where(eq(fighterTelemetry.heroId, key));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const profileKey = String(body?.profileKey || "local-vanguard").slice(0, 64);
    const p1Hero = String(body?.p1Hero || "ROBOT").toUpperCase().slice(0, 32);
    const p2Hero = String(body?.p2Hero || "HUNTER").toUpperCase().slice(0, 32);
    const winnerSide = ["p1", "p2", "draw"].includes(body?.winnerSide) ? body.winnerSide : "p1";
    const mode = body?.mode === "local" ? "local" : "bot";
    const ruleset = String(body?.ruleset || "standard").slice(0, 32);
    const arenaId = String(body?.arenaId || "scrap_foundry").slice(0, 32);
    const aiTier = String(body?.aiTier || (mode === "local" ? "local" : "veteran")).slice(0, 24);
    const durationSec = Math.max(1, Math.min(3600, Math.round(Number(body?.durationSec) || 45)));
    const p1Damage = Math.max(0, Math.round(Number(body?.p1Damage) || 0));
    const p2Damage = Math.max(0, Math.round(Number(body?.p2Damage) || 0));
    const p1Parries = Math.max(0, Math.round(Number(body?.p1Parries) || 0));
    const p2Parries = Math.max(0, Math.round(Number(body?.p2Parries) || 0));
    const p1Overdrives = Math.max(0, Math.round(Number(body?.p1Overdrives) || 0));
    const p2Overdrives = Math.max(0, Math.round(Number(body?.p2Overdrives) || 0));
    const maxComboRank = String(body?.maxComboRank || "A").slice(0, 12);
    const topWeapon = String(body?.topWeapon || "UNARMED").slice(0, 40);
    const topWeaponDamage = Math.max(0, Math.round(Number(body?.topWeaponDamage) || 0));
    const matchCode =
      String(body?.matchCode || `SB-${Math.floor(1000 + Math.random() * 9000)}`).slice(0, 24);

    const [inserted] = await db
      .insert(battleMatches)
      .values({
        matchCode,
        mode,
        ruleset,
        arenaId,
        aiTier,
        p1Hero,
        p2Hero,
        winnerSide,
        durationSec,
        p1Damage,
        p2Damage,
        p1Parries,
        p2Parries,
        p1Overdrives,
        p2Overdrives,
        maxComboRank,
        topWeapon,
        topWeaponDamage,
      })
      .returning();

    await bumpFighter(p1Hero, winnerSide === "p1", p1Damage, p1Parries, p1Overdrives, durationSec);
    await bumpFighter(p2Hero, winnerSide === "p2", p2Damage, p2Parries, p2Overdrives, durationSec);

    const existingProfiles = await db
      .select()
      .from(commanderProfiles)
      .where(eq(commanderProfiles.profileKey, profileKey));
    const deltaGain = AI_ELO_BONUS[aiTier] || 20;
    const eloDelta = winnerSide === "p1" ? deltaGain : winnerSide === "draw" ? 2 : -12;

    let profile;
    if (existingProfiles.length === 0) {
      const [created] = await db
        .insert(commanderProfiles)
        .values({
          profileKey,
          callsign: "BASIN VANGUARD",
          eloRating: Math.max(800, 1250 + eloDelta),
          matchesTotal: 1,
          winsTotal: winnerSide === "p1" ? 1 : 0,
          winStreak: winnerSide === "p1" ? 1 : 0,
          bestStreak: winnerSide === "p1" ? 1 : 0,
        })
        .returning();
      profile = created;
    } else {
      const cur = existingProfiles[0];
      const nextStreak = winnerSide === "p1" ? cur.winStreak + 1 : 0;
      const [updated] = await db
        .update(commanderProfiles)
        .set({
          eloRating: Math.max(800, cur.eloRating + eloDelta),
          matchesTotal: cur.matchesTotal + 1,
          winsTotal: cur.winsTotal + (winnerSide === "p1" ? 1 : 0),
          winStreak: nextStreak,
          bestStreak: Math.max(cur.bestStreak, nextStreak),
          updatedAt: new Date(),
        })
        .where(eq(commanderProfiles.profileKey, profileKey))
        .returning();
      profile = updated;
    }

    return NextResponse.json({ ok: true, match: inserted, profile, eloDelta });
  } catch (error) {
    console.error("[api/evolution/match] POST error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
