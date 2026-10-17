// Resolve a Fighter Pick label through the existing product/Gold/Registry identity
// contracts. This is presentation-only; it never grants ownership or playability.
import {PRODUCT_ROSTER} from '../productSurface.js';

const normalized = value => String(value ?? '').trim().toUpperCase();

export function resolveGoldPickHeroId(label, {goldRoster, registry} = {}) {
  const requested = normalized(label);
  if (!requested) return null;
  const playable = new Set(PRODUCT_ROSTER.playableIds);
  const definitions = registry && typeof registry === 'object' ? registry : {};
  // Gold Bridge exposes the presentation shell key together with the canonical
  // productionId, so no manually maintained ROBOT/NEWBOT or FROST/ICE map is needed.
  if (goldRoster && typeof goldRoster === 'object') {
    for (const [shellKey, hero] of Object.entries(goldRoster)) {
      const id = normalized(hero?.productionId);
      if (!playable.has(id)) continue;
      const names = [shellKey, id, hero?.name, definitions[id]?.name, definitions[id]?.displayName];
      if (names.some(value => normalized(value) === requested)) return id;
    }
  }
  // Safe startup fallback: the canonical product list plus the actual Hero
  // Registry already provide canonical IDs and approved display names.
  for (const id of PRODUCT_ROSTER.playableIds) {
    const names = [id, definitions[id]?.name, definitions[id]?.displayName];
    if (names.some(value => normalized(value) === requested)) return id;
  }
  return null;
}
