import type { CSSProperties } from "react";
import { Crown } from "lucide-react";
import type { PlayerResult } from "../data/types";
import { fmt } from "../lib/match";
import { useReveal } from "../lib/motion";
import { HeroArt } from "./art";
import { teamVars } from "./Medal";

interface HeroProps {
  player: PlayerResult;
  phase: number;
  force: boolean;
}

/**
 * One side of the confrontation. Winner and loser share the same structure but get
 * different motion (slam vs. drift), type treatment and light — the loser stays fully legible.
 */
export function HeroPanel({ player, phase, force }: HeroProps) {
  const { ref, revealed } = useReveal<HTMLElement>(phase, 2, force);
  const win = player.outcome === "victory";
  const word = win ? "VICTORY" : "DEFEAT";
  const sub = win ? "CHIẾN THẮNG" : "THẤT BẠI";

  return (
    <section
      ref={ref}
      className={`hero hero--${win ? "win" : "lose"}${revealed ? " is-in" : ""}`}
      style={teamVars(player)}
      data-slot={player.slot}
      aria-label={`Player ${player.slot}: ${player.handle} — ${win ? "chiến thắng" : "thất bại"}`}
    >
      <div className="hero__status">
        <span className="hero__slot">
          {win && <Crown size={14} strokeWidth={2.4} aria-hidden="true" />}
          PLAYER {player.slot}
        </span>
        <h2 className="hero__verdict" aria-label={word}>
          <span className="hero__word" aria-hidden="true">
            {[...word].map((c, i) => (
              <span key={i} className="ch" style={{ "--i": i } as CSSProperties}>
                {c}
              </span>
            ))}
          </span>
          <span className="hero__sub" aria-hidden="true">
            {sub}
          </span>
        </h2>
      </div>

      <div className="hero__stage">
        <div className="hero__halo" aria-hidden="true" />
        <span className="hero__shock" aria-hidden="true" />
        <div className="hero__art">
          <HeroArt player={player} />
        </div>
        {!player.character.portraitSrc && (
          <span className="art-tag">Ảnh nhân vật · placeholder</span>
        )}
      </div>

      <div className="hero__plate">
        <p className="hero__who">{player.handle}</p>
        <p className="hero__char">
          <b>{player.character.name}</b>
          <span>{player.character.className}</span>
          <span className="hero__lv">
            Lv {player.level} · {player.rankTitle}
          </span>
        </p>
        <dl className="hero__stats">
          <div>
            <dt>Chính xác</dt>
            <dd>{player.stats.accuracy}%</dd>
          </div>
          <div>
            <dt>Chí mạng</dt>
            <dd>{player.stats.critRate}%</dd>
          </div>
          <div>
            <dt>Hồi phục</dt>
            <dd>{fmt(player.stats.healing)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
