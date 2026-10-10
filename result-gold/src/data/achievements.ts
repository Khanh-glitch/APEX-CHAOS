import type { AchievementCategory, AchievementCondition, AchievementDef, Rarity } from "./types";
import ownerDecisions from "./ownerDecisions.json";

/**
 * OWNER APPROVAL — authoritative source: src/data/ownerDecisions.json.
 * 50 reviewed slots = 47 keep + 3 drop. Only the 47 "keep" items may be awarded.
 * Never recompute thresholds from old Gold rows or from designNote text.
 * Full numeric conditions are in `conditions`; `metric` is a legacy readout ONLY.
 */
export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  offense: "Hỏa Lực", precision: "Chính Xác", weapon: "Vũ Khí",
  survival: "Sinh Tồn", tactics: "Chiến Thuật", chaos: "Hỗn Loạn",
  signature: "Danh hiệu riêng",
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Thường", rare: "Hiếm", epic: "Sử Thi", legendary: "Huyền Thoại",
};
export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 1, rare: 2, epic: 3, legendary: 4,
};

const formatNumber = (n: number): string => Number.isInteger(n) ? String(n) : String(n);

function ruleWithNumbers(template: string, conditions: AchievementCondition[]) {
  return template.replace(/\{([a-zA-Z0-9_-]+)\}/g, (_whole, key: string) => {
    const param = conditions.find((c) => c.key === key);
    return param ? formatNumber(param.value) : `{${key}}`;
  });
}

type Decision = (typeof ownerDecisions.items)[number];
function toAchievement(item: Decision): AchievementDef {
  const conditions: AchievementCondition[] = item.params.map((p) => ({
    key: p.key,
    label: p.label,
    value: p.value,
    unit: p.unit,
    compare: p.compare as "gte" | "lte",
  }));
  const primary = conditions[0];
  // Owner note wins over stale rule/explain wording. Original JSON remains byte-for-byte preserved.
  const defaultRule = ruleWithNumbers(item.rule, conditions);
  const rule = item.id === "overkill"
    ? `Gây ≥ ${formatNumber(conditions[0].value)} DMG thực tế trong cửa sổ 0,1 giây.`
    : item.id === "signature-magnet"
      ? `Trong cùng một lần Attraction, kéo và nhặt các súng hợp lệ rồi gây tổng ≥ ${formatNumber(conditions[0].value)} DMG bằng TẤT CẢ những súng đó.`
      : defaultRule;
  return {
    id: item.id,
    name: item.name,
    category: item.category as AchievementCategory,
    rarity: item.rarity as Rarity,
    icon: item.icon,
    description: rule,
    rule,
    conditions,
    explain: item.explain,
    heroId: item.heroId,
    slot: item.slot,
    metric: primary ? {
      label: primary.label, unit: primary.unit, threshold: primary.value,
      comparator: primary.compare,
    } : {
      label: "Điều kiện sự kiện", unit: "", threshold: 1, comparator: "gte",
    },
  };
}

/** Only earned-eligible achievements; exactly 47 per owner decisions. */
export const ACHIEVEMENTS: AchievementDef[] = ownerDecisions.items
  .filter((item) => item.decision === "keep")
  .map(toAchievement);
/** Audit-only: never display as earnable. */
export const REMOVED_ACHIEVEMENTS = ownerDecisions.items.filter((item) => item.decision === "drop");
export const ACHIEVEMENT_INDEX: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);
