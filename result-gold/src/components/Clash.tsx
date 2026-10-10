import type { CSSProperties } from "react";
import type { MatchResult } from "../data/types";
import type { DamageShare } from "../lib/match";
import { fmt } from "../lib/match";
import { CountUp, useReveal } from "../lib/motion";
import { teamVars } from "./Medal";

interface ClashProps {
  match: MatchResult;
  share: DamageShare;
  phase: number;
  force: boolean;
}

/** Fixed spark vectors (deterministic — no runtime randomness). */
const SPARKS: [number, number][] = [
  [-46, -34],
  [-28, -52],
  [-12, -40],
  [10, -58],
  [30, -44],
  [48, -30],
  [-38, 18],
  [40, 20],
];

/**
 * Unified damage bar. One track, two bodies. P1 rushes in from the left, P2 from the right,
 * they collide at 50% and the stronger side pushes the seam to its true ratio.
 * Final geometry is exact: P1 = d1/(d1+d2) · 100%, P2 = remainder → always 100% total.
 * Labelled as DAMAGE DEALT with tick marks so it can't be mistaken for an HP bar.
 */
export function DamageClash({ match, share, phase, force }: ClashProps) {
  const { ref, revealed } = useReveal<HTMLElement>(phase, 3, force);
  const [p1, p2] = match.players;
  const leader = share.leaderSlot;

  const side = (p: typeof p1, pct: string) => (
    <div
      className={`clash__side clash__side--${p.slot}${leader === p.slot ? " is-lead" : ""}`}
      style={teamVars(p)}
    >
      <span className="clash__who">
        <i className="clash__dot" aria-hidden="true" />
        <span className="clash__handle">{p.handle}</span>
        <em className="clash__pct" title="Thị phần tổng sát thương">
          {pct}%
        </em>
        {leader === p.slot && <em className="clash__tag">▲ Dẫn đầu</em>}
      </span>
      <span className="clash__num">
        <CountUp value={p.damage.dealt} active={revealed} instant={force} duration={1500} />
        <small className="clash__unit">DMG</small>
      </span>
    </div>
  );

  return (
    <section
      ref={ref}
      className={`clash${revealed ? " is-in" : ""}`}
      style={
        {
          "--p": String(share.aPct),
          // overshoot of the collision "push" (in % of bar width) — toward the stronger side's target
          "--o": String(((share.aPct - 50) * 0.55).toFixed(3)),
        } as CSSProperties
      }
      aria-label="So sánh tổng sát thương gây ra"
    >
      <div className="clash__head">
        {side(p1, share.aLabel)}
        <div className="clash__mid">
          <span className="clash__title">Tổng sát thương gây ra</span>
          <span className="clash__lead">
            Chênh lệch <b>{fmt(share.lead)}</b>
          </span>
        </div>
        {side(p2, share.bLabel)}
      </div>

      <div className="clash__bar">
        <div
          className="clash__track"
          role="img"
          aria-label={`${p1.handle} gây ${fmt(p1.damage.dealt)} sát thương, chiếm ${share.aLabel}%. ${p2.handle} gây ${fmt(p2.damage.dealt)} sát thương, chiếm ${share.bLabel}%.`}
        >
          <div className="clash__seg clash__seg--2" style={teamVars(p2)} />
          <div className="clash__seg clash__seg--1" style={teamVars(p1)} />
          <div className="clash__ticks" />
        </div>
        <div className="clash__fx" aria-hidden="true">
          <div className="clash__blade" />
          {SPARKS.map(([dx, dy], i) => (
            <span
              key={i}
              className="clash__spark"
              style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, "--si": i } as CSSProperties}
            />
          ))}
        </div>
        <span className="clash__half" aria-hidden="true">
          <i>50</i>
        </span>
      </div>
    </section>
  );
}
