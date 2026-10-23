import ownerDecisions from '../../result-gold/src/data/ownerDecisions.json';
import { AWARD_RULE_TEMPLATES } from '../game/localeAwardRules.js';

// CP3 display catalog. The owner-approved 47 keep decisions remain the one
// achievement list; this module only joins their display metadata to the
// existing bilingual rule templates. Thresholds and predicates stay owned
// by APEX_RESULT_OWNER_CATALOG + matchResultAuthority.

const RULE_BY_ID = new Map(AWARD_RULE_TEMPLATES.map((item) => [item.id, item]));
const RESULT_BY_ENGINE = Object.freeze({ ROBOT: 'NEWBOT', ICE: 'FROST', CRYSTAL: 'CRYSTALA' });
const ENGINE_BY_RESULT = Object.freeze({ NEWBOT: 'ROBOT', FROST: 'ICE', CRYSTALA: 'CRYSTAL' });

export const MASTERY_HEROES = Object.freeze([
  Object.freeze({ engineId: 'ROBOT', resultId: 'NEWBOT', name: 'NEWBOT' }),
  Object.freeze({ engineId: 'HUNTER', resultId: 'HUNTER', name: 'HUNTER' }),
  Object.freeze({ engineId: 'CRYSTAL', resultId: 'CRYSTALA', name: 'CRYSTALA' }),
  Object.freeze({ engineId: 'MAGNET', resultId: 'MAGNET', name: 'MAGNET' }),
  Object.freeze({ engineId: 'ICE', resultId: 'FROST', name: 'FROST' }),
  Object.freeze({ engineId: 'MIRROR', resultId: 'MIRROR', name: 'MIRROR' }),
]);

export const MASTERY_CATEGORIES = Object.freeze([
  'offense', 'precision', 'weapon', 'survival', 'tactics', 'chaos', 'signature',
]);

export const CATEGORY_LABELS = Object.freeze({
  offense: Object.freeze({ eng: 'OFFENSE', vie: 'HỎA LỰC' }),
  precision: Object.freeze({ eng: 'PRECISION', vie: 'CHÍNH XÁC' }),
  weapon: Object.freeze({ eng: 'WEAPONS', vie: 'VŨ KHÍ' }),
  survival: Object.freeze({ eng: 'SURVIVAL', vie: 'SINH TỒN' }),
  tactics: Object.freeze({ eng: 'TACTICS', vie: 'CHIẾN THUẬT' }),
  chaos: Object.freeze({ eng: 'CHAOS', vie: 'HỖN LOẠN' }),
  signature: Object.freeze({ eng: 'SIGNATURE', vie: 'DANH HIỆU RIÊNG' }),
});

export const RARITY_WEIGHT = Object.freeze({
  common: 1, rare: 2, epic: 3, legendary: 4,
});

export const RARITY_LABELS = Object.freeze({
  common: Object.freeze({ eng: 'COMMON', vie: 'THƯỜNG' }),
  rare: Object.freeze({ eng: 'RARE', vie: 'HIẾM' }),
  epic: Object.freeze({ eng: 'EPIC', vie: 'SỬ THI' }),
  legendary: Object.freeze({ eng: 'LEGENDARY', vie: 'HUYỀN THOẠI' }),
});

// CP4: rarity must survive grayscale and small viewports without relying
// on color. Shape + pip count are the shared toast/Vault visual authority.
export const RARITY_PRESENTATION = Object.freeze({
  common: Object.freeze({ shape: 'circle', pips: 1, pattern: 'plain' }),
  rare: Object.freeze({ shape: 'octagon', pips: 2, pattern: 'facet' }),
  epic: Object.freeze({ shape: 'shield', pips: 3, pattern: 'chevron' }),
  legendary: Object.freeze({ shape: 'starburst', pips: 4, pattern: 'rays' }),
});

export function rarityPresentation(rarity) {
  return RARITY_PRESENTATION[rarity] || RARITY_PRESENTATION.common;
}

const ICON_GLYPHS = Object.freeze({
  Radar: '◎', Droplet: '◍', Hammer: '⚒', Zap: '⚡', Axe: '⚔', Gem: '◆',
  Target: '⌖', Skull: '☠', Eye: '◉', Hand: '✋', Flame: '♨', CircleDot: '◉',
  Waypoints: '⌘', Shell: '◐', Gauge: '◔', List: '☰', Binoculars: '∞',
  Focus: '⌖', Sword: '⚔', Repeat: '↻', Package: '▣', HeartPulse: '♥',
  Shield: '⛨', Mountain: '▲', Ghost: '☾', Recycle: '♻', Wind: '≋',
  Layers: '▤', HeartCrack: '♡', TrendingUp: '↗', Feather: '⌒', Cpu: '▦',
  Footprints: '⋯', Puzzle: '✚', Link: '∞', Syringe: '†', Hourglass: '⧗',
  Swords: '⚔', Rabbit: '➤', Dices: '⚄', Siren: '✺', Bot: '▣', Bug: '✕',
  Diamond: '◆', Magnet: '∪', Snowflake: '❄', ScanFace: '◎',
});

function displayNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace(/\.0+$/, '');
}

function fillRule(template, params) {
  return String(template || '').replace(/\{([a-zA-Z0-9_-]+)\}/g, (_whole, key) => {
    const param = params.find((item) => item.key === key);
    return param ? displayNumber(param.value) : `{${key}}`;
  });
}

function localizedRule(item) {
  const params = Array.isArray(item.params) ? item.params : [];
  const localized = RULE_BY_ID.get(item.id) || {};
  if (item.id === 'overkill') {
    const hit = displayNumber(params[0]?.value);
    return Object.freeze({
      eng: `Deal at least ${hit} actual damage within a 0.1-second window.`,
      vie: `Gây ≥ ${hit} DMG thực tế trong cửa sổ 0,1 giây.`,
    });
  }
  return Object.freeze({
    eng: fillRule(localized.en || item.rule, params),
    vie: fillRule(localized.vi || item.rule, params),
  });
}

export const MASTERY_ACHIEVEMENTS = Object.freeze(
  ownerDecisions.items
    .filter((item) => item.decision === 'keep')
    .map((item) => Object.freeze({
      id: item.id,
      slot: item.slot,
      heroId: item.heroId || null,
      name: item.name,
      category: item.category,
      rarity: item.rarity,
      icon: item.icon,
      iconGlyph: ICON_GLYPHS[item.icon] || '◆',
      params: Object.freeze((item.params || []).map((param) => Object.freeze({ ...param }))),
      rule: localizedRule(item),
      rarityWeight: RARITY_WEIGHT[item.rarity] || 0,
      rarityPresentation: rarityPresentation(item.rarity),
    })),
);

export const MASTERY_BY_ID = Object.freeze(Object.fromEntries(
  MASTERY_ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]),
));

export function masteryResultHeroId(id) {
  const raw = String(id || '').trim().toUpperCase();
  return RESULT_BY_ENGINE[raw] || raw;
}

export function masteryEngineHeroId(id) {
  const raw = String(id || '').trim().toUpperCase();
  return ENGINE_BY_RESULT[raw] || raw;
}

export function applicableAchievements(resultHeroId) {
  const hero = masteryResultHeroId(resultHeroId);
  return MASTERY_ACHIEVEMENTS.filter((achievement) => !achievement.heroId || achievement.heroId === hero);
}

export function formatMasteryValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString('en-US');
  return displayNumber(n);
}

export function primaryProgress(achievement, best, earned) {
  const primary = achievement?.params?.[0] || null;
  if (!primary) {
    const current = earned ? 1 : Math.max(0, Math.min(1, Number(best) || 0));
    return { current, target: 1, unit: '', compare: 'event', percent: current * 100 };
  }
  const target = Number(primary.value);
  const current = Number(best);
  if (!Number.isFinite(current)) {
    return { current: null, target, unit: primary.unit || '', compare: primary.compare, percent: 0 };
  }
  let percent = 0;
  if (primary.compare === 'lte') {
    percent = current <= target ? 100 : Math.max(0, Math.min(100, (target / Math.max(current, 0.0001)) * 100));
  } else {
    percent = target > 0 ? Math.max(0, Math.min(100, (current / target) * 100)) : (current > 0 ? 100 : 0);
  }
  return { current, target, unit: primary.unit || '', compare: primary.compare, percent };
}

export function masteryTier(earned, total) {
  const count = Math.max(0, Number(earned) || 0);
  const size = Math.max(0, Number(total) || 0);
  if (!size || count === 0) return { id: 'unranked', eng: 'UNRANKED', vie: 'CHƯA XẾP HẠNG' };
  const ratio = count / size;
  if (ratio >= 1) return { id: 'legendary', eng: 'LEGENDARY', vie: 'HUYỀN THOẠI' };
  if (ratio >= 0.75) return { id: 'epic', eng: 'EPIC', vie: 'SỬ THI' };
  if (ratio >= 0.5) return { id: 'gold', eng: 'GOLD', vie: 'VÀNG' };
  if (ratio >= 0.25) return { id: 'silver', eng: 'SILVER', vie: 'BẠC' };
  return { id: 'bronze', eng: 'BRONZE', vie: 'ĐỒNG' };
}
