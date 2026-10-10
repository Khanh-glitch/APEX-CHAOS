import type { PlayerResult } from "../data/types";
import type { ResolvedAward } from "../lib/match";
import { useReveal } from "../lib/motion";
import { AwardChip, teamVars } from "./Medal";

interface RackProps {
  player: PlayerResult;
  awards: ResolvedAward[];
  phase: number;
  force: boolean;
  active: boolean;
  selected: number | null;
  onSelect: (index: number) => void;
}

export function CommendationRack({
  player,
  awards,
  phase,
  force,
  active,
  selected,
  onSelect,
}: RackProps) {
  const { ref, revealed } = useReveal<HTMLElement>(phase, 5, force);

  return (
    <section
      ref={ref}
      className={`rack rack--${player.slot}${revealed ? " is-in" : ""}`}
      style={teamVars(player)}
      data-active={active}
      id={`rack-${player.slot}`}
      aria-label={`${awards.length} danh hiệu của ${player.handle}. Bấm vào huy hiệu để xem chi tiết.`}
    >
      <header className="rack__head">
        <h3 className="rack__title">
          <i className="rack__dot" aria-hidden="true" />
          <span>Danh hiệu</span>
          <span className="rack__count">{awards.length}</span>
        </h3>
        <span className="rack__hint">Bấm để xem chi tiết</span>
      </header>

      <ul className="rack__chips" aria-label={`Danh hiệu của ${player.handle}`}>
        {awards.map((award, index) => (
          <li key={award.def.id}>
            <AwardChip
              award={award}
              index={index}
              selected={selected === index}
              onSelect={() => onSelect(index)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
