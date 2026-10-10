import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { CATEGORY_LABEL, RARITY_LABEL } from "../data/achievements";
import type { PlayerResult } from "../data/types";
import { fmtMetric, type ResolvedAward } from "../lib/match";
import { Dialog } from "./Dialog";
import { Medal, RarityPips, teamVars } from "./Medal";

interface AwardDetailsProps {
  player: PlayerResult;
  awards: ResolvedAward[];
  index: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

export function AwardDetails({ player, awards, index, onSelect, onClose }: AwardDetailsProps) {
  const award = awards[index];
  if (!award) return null;
  const { def, value } = award;
  const threshold = def.conditions.length
    ? def.conditions.map((c) => `${c.label}: ${c.compare === "gte" ? "≥" : "≤"} ${fmtMetric(c.value, c.unit)}`).join(" · ")
    : "Sự kiện combat hợp lệ";

  return (
    <Dialog
      id="award-detail"
      titleId="award-detail-title"
      descriptionId="award-detail-description"
      className={`award-detail award-detail--${def.rarity}`}
      style={teamVars(player)}
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" && index > 0) {
          event.preventDefault();
          onSelect(index - 1);
        }
        if (event.key === "ArrowRight" && index < awards.length - 1) {
          event.preventDefault();
          onSelect(index + 1);
        }
      }}
    >
      <header className="award-detail__header">
        <span>APEX CHAOS / DANH HIỆU</span>
        <button type="button" className="iconbtn iconbtn--sq" onClick={onClose} aria-label="Đóng chi tiết danh hiệu" autoFocus>
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="award-detail__body" key={def.id} aria-live="polite" aria-atomic="true">
        <div className="award-detail__emblem">
          <Medal def={def} size={88} />
        </div>
        <p className="award-detail__rarity">
          <RarityPips rarity={def.rarity} />
          <span>{RARITY_LABEL[def.rarity]} / {CATEGORY_LABEL[def.category]}</span>
        </p>
        <h2 id="award-detail-title">{def.name}</h2>
        <p className="award-detail__owner"><i aria-hidden="true" />{player.handle}</p>
        <p id="award-detail-description" className="award-detail__description">{def.rule}</p>
        <dl className="award-detail__metric">
          <dt>{def.metric.label}</dt>
          <dd>{def.conditions.length ? fmtMetric(value, def.metric.unit) : "Đã kích hoạt"}</dd>
        </dl>
        <p className="award-detail__threshold">
          <Check size={14} aria-hidden="true" /> Đã đạt / Yêu cầu {threshold}
        </p>
      </div>

      <footer className="award-detail__footer">
        <nav className="award-detail__nav" aria-label="Chọn danh hiệu">
          <button type="button" className="iconbtn iconbtn--sq" disabled={index === 0} onClick={() => onSelect(index - 1)} aria-label="Danh hiệu trước">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span>{String(index + 1).padStart(2, "0")} / {String(awards.length).padStart(2, "0")}</span>
          <button type="button" className="iconbtn iconbtn--sq" disabled={index === awards.length - 1} onClick={() => onSelect(index + 1)} aria-label="Danh hiệu tiếp theo">
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </nav>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Đóng</button>
      </footer>
    </Dialog>
  );
}