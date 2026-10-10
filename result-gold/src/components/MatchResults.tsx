import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { AchievementDef, MatchResult } from "../data/types";
import {
  getDamageShare,
  getWeaponSpotlight,
  resolveAwards,
  validateMatch,
} from "../lib/match";
import { useChoreography, usePrefersReducedMotion } from "../lib/motion";
import { Archive, type ArchiveTab } from "./Archive";
import { AwardDetails } from "./AwardDetails";
import { ActionDock, AmbientFX, Backdrop, IntroDoor, SkipPill, TopBar } from "./Chrome";
import { DamageClash } from "./Clash";
import { HeroPanel } from "./Hero";
import { CommendationRack } from "./Rack";
import { WeaponSpotlightPanel } from "./Weapon";

interface MatchResultsProps {
  /** Real match data from the game engine (or the frozen fixture). */
  match: MatchResult;
  /** Owner-approved earnable catalogue (47 of 50 reviewed slots). */
  catalog: AchievementDef[];
  /** Called when the player presses "Tiếp tục". */
  onContinue?: () => void;
}

/**
 * Post-match results screen. Pure presentation: everything it shows comes from `match` +
 * `catalog`; nothing is randomised, so replay / resize / reload never alter the result.
 */
export function MatchResults({ match, catalog, onContinue }: MatchResultsProps) {
  const reduced = usePrefersReducedMotion();
  const ch = useChoreography(reduced);
  const [p1, p2] = match.players;
  const winner = (match.players.find((p) => p.outcome === "victory") ?? p1).slot;

  const index = useMemo(() => Object.fromEntries(catalog.map((a) => [a.id, a])), [catalog]);
  const share = useMemo(() => getDamageShare(match), [match]);
  const spot = useMemo(() => getWeaponSpotlight(match), [match]);
  const awards1 = useMemo(() => resolveAwards(p1, index), [p1, index]);
  const awards2 = useMemo(() => resolveAwards(p2, index), [p2, index]);
  const integrity = useMemo(() => validateMatch(match, catalog), [match, catalog]);

  const [rackTab, setRackTab] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<{ slot: 1 | 2; index: number } | null>(null);
  const [archive, setArchive] = useState<{ open: boolean; tab: ArchiveTab }>({ open: false, tab: "p1" });

  const openArchive = useCallback((tab: ArchiveTab) => setArchive({ open: true, tab }), []);
  const closeArchive = useCallback(() => setArchive((a) => ({ ...a, open: false })), []);
  const closeDetails = useCallback(() => setSelected(null), []);

  useEffect(() => {
    if (integrity.issues.length) console.warn("[APEX CHAOS] fixture integrity issues:", integrity.issues);
  }, [integrity]);

  // Keyboard: Space / Enter / Esc skips the intro, R replays.
  const { skip, replay, done } = ch;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (archive.open || document.querySelector("dialog[open]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const interactive = !!el?.closest("button, a, input, select, textarea, [role='tab']");
      if (!done && !interactive && (e.key === " " || e.key === "Enter" || e.key === "Escape")) {
        e.preventDefault();
        skip();
      } else if (!done && e.key === "Escape") {
        skip();
      } else if ((e.key === "r" || e.key === "R") && !interactive) {
        replay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [archive.open, done, skip, replay]);

  const runClass = [
    "ac-run",
    ch.phase >= 1 ? "is-started" : "",
    ch.skipped ? "is-skip" : "",
    ch.done ? "is-done" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const rootStyle = { "--p1-rgb": p1.accentRgb, "--p2-rgb": p2.accentRgb, "--p1": p1.accent, "--p2": p2.accent } as CSSProperties;

  return (
    <div className="ac-root" data-reduced={reduced} data-winner={winner} style={rootStyle}>
      <Backdrop />
      <AmbientFX
        active={ch.phase >= 2}
        paused={reduced || archive.open || selected !== null}
        p1Rgb={p1.accentRgb}
        p2Rgb={p2.accentRgb}
        winnerSlot={winner}
      />

      <div key={ch.run} className={runClass}>
        <IntroDoor meta={match.meta} />

        <div className="ac-shell">
          <TopBar meta={match.meta} onReplay={ch.replay} />

          <main className="ac-stage" aria-label="Kết quả trận đấu">
            <HeroPanel player={p1} phase={ch.phase} force={ch.skipped} />
            <HeroPanel player={p2} phase={ch.phase} force={ch.skipped} />
            <DamageClash match={match} share={share} phase={ch.phase} force={ch.skipped} />
            <WeaponSpotlightPanel spot={spot} phase={ch.phase} force={ch.skipped} />

            <div className={`racktabs${ch.phase >= 5 ? " is-in" : ""}`} role="group" aria-label="Chọn người chơi để xem danh hiệu đạt được">
              {[p1, p2].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={rackTab === p.slot}
                  aria-controls={`rack-${p.slot}`}
                  className={`racktab${rackTab === p.slot ? " is-on" : ""}`}
                  style={{ "--team": p.accent, "--team-rgb": p.accentRgb } as CSSProperties}
                  onClick={() => setRackTab(p.slot)}
                >
                  <i aria-hidden="true" />
                  <span>{p.handle}</span>
                  <em>{p.awards.length}</em>
                </button>
              ))}
            </div>

            <CommendationRack
              player={p1}
              awards={awards1}
              phase={ch.phase}
              force={ch.skipped}
              active={rackTab === 1}
              selected={selected?.slot === 1 ? selected.index : null}
              onSelect={(index) => setSelected({ slot: 1, index })}
            />
            <CommendationRack
              player={p2}
              awards={awards2}
              phase={ch.phase}
              force={ch.skipped}
              active={rackTab === 2}
              selected={selected?.slot === 2 ? selected.index : null}
              onSelect={(index) => setSelected({ slot: 2, index })}
            />
            <ActionDock
              phase={ch.phase}
              force={ch.skipped}
              done={ch.done}
              onContinue={() => onContinue?.()}
              onArchive={() => openArchive("codex")}
            />
          </main>
        </div>
      </div>

      <SkipPill visible={!ch.done} onSkip={ch.skip} />

      {selected && (
        <AwardDetails
          player={selected.slot === 1 ? p1 : p2}
          awards={selected.slot === 1 ? awards1 : awards2}
          index={selected.index}
          onSelect={(index) => setSelected({ slot: selected.slot, index })}
          onClose={closeDetails}
        />
      )}

      <Archive
        open={archive.open}
        tab={archive.tab}
        onTab={(t) => setArchive({ open: true, tab: t })}
        onClose={closeArchive}
        match={match}
        catalog={catalog}
        awards={[awards1, awards2]}
        integrity={integrity}
      />
    </div>
  );
}
