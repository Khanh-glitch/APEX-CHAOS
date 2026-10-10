import type { CSSProperties } from "react";
import { RARITY_LABEL } from "../data/achievements";
import type { AchievementDef, PlayerResult, Rarity } from "../data/types";
import { fmtMetric, rarityPips, type ResolvedAward } from "../lib/match";
import { iconFor } from "./icons";

export const teamVars = (p: Pick<PlayerResult, "accent" | "accentRgb">) =>
  ({ "--team": p.accent, "--team-rgb": p.accentRgb } as CSSProperties);

interface MedalProps {
  def: AchievementDef;
  /** px size of the hexagon. */
  size?: number;
  locked?: boolean;
}

/**
 * Hexagonal medallion. Rarity = material + silhouette detail (never the team colour),
 * so achievements stay readable next to either player's identity colour.
 *  common → iron · rare → polished steel · epic → brass/gold + sheen · legendary → prismatic foil
 */
export function Medal({ def, size = 48, locked = false }: MedalProps) {
  const Icon = iconFor(def.icon);
  return (
    <span
      className={`medal medal--${def.rarity}${locked ? " is-locked" : ""}`}
      style={{ "--m": `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <span className={`medal__rim${def.rarity === "legendary" ? " ac-loop" : ""}`} />
      <span className="medal__core">
        <Icon strokeWidth={1.9} className="medal__icon" />
      </span>
      {(def.rarity === "epic" || def.rarity === "legendary") && (
        <span className="medal__sheen ac-loop" />
      )}
    </span>
  );
}

export function RarityPips({ rarity }: { rarity: Rarity }) {
  const n = rarityPips(rarity);
  return (
    <span className={`pips pips--${rarity}`} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <i key={i} className={i < n ? "on" : ""} />
      ))}
    </span>
  );
}

interface AwardChipProps {
  award: ResolvedAward;
  selected: boolean;
  index: number;
  onSelect: () => void;
}

/** Small artwork, but a full-size touch target. Details open only on activation. */
export function AwardChip({ award, selected, index, onSelect }: AwardChipProps) {
  const { def } = award;
  return (
    <button
      type="button"
      className={`chip chip--${def.rarity}${selected ? " is-selected" : ""}`}
      style={{ "--i": index } as CSSProperties}
      aria-haspopup="dialog"
      aria-expanded={selected}
      aria-controls={selected ? "award-detail" : undefined}
      aria-label={`Xem chi tiết: ${def.name}, ${RARITY_LABEL[def.rarity]}`}
      title={`${def.name} · ${RARITY_LABEL[def.rarity]}`}
      onClick={onSelect}
    >
      <Medal def={def} size={36} />
    </button>
  );
}

/** Progress of a value against its threshold (for readouts and archive rows). */
export function ThresholdMeter({ award }: { award: ResolvedAward }) {
  const { def, value } = award;
  const { threshold, comparator } = def.metric;
  const pct = threshold > 0 ? Math.max(8, Math.min(100, Math.round((comparator === "gte" ? value / (threshold * 1.6) : 1 - value / (threshold * 1.6) + 0.4) * 100))) : 100;
  const need = comparator === "gte" ? `≥ ${fmtMetric(threshold, def.metric.unit)}` : `≤ ${fmtMetric(threshold, def.metric.unit)}`;
  return (
    <span className="meter" aria-hidden="true">
      <span className="meter__fill" style={{ width: `${pct}%` }} />
      <span className="meter__need">yêu cầu {need}</span>
    </span>
  );
}
