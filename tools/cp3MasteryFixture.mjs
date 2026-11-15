// CP3 browser-test fixture: a legitimate saved wallet profile that has
// already earned the ECOBOT/VUA HỀ mastery entitlements. Tests seed this
// through the one production localStorage wallet before page load; product
// code still has to sanitize it and prove both gates at runtime.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ownerDecisions = JSON.parse(
  readFileSync(path.join(ROOT, 'result-gold/src/data/ownerDecisions.json'), 'utf8'),
);

export const CP3_NEWBOT_ACHIEVEMENT_IDS = Object.freeze(
  ownerDecisions.items
    .filter((item) => item.decision === 'keep' && (!item.heroId || item.heroId === 'NEWBOT'))
    .map((item) => item.id),
);

export function cp3EntitledMastery() {
  return {
    earned: {
      NEWBOT: Object.fromEntries(
        CP3_NEWBOT_ACHIEVEMENT_IDS.map((id, index) => [id, index + 1]),
      ),
    },
    best: {},
    weaponDamage: { RPG_7: 1001 },
    recent: [],
    unseenSkinUnlocks: [],
  };
}

export function cp3EntitledProfile(overrides = {}) {
  return {
    version: 1,
    credits: 350,
    ownedFighters: ['ROBOT'],
    lastSelectedP1: 'ROBOT',
    lastSelectedP2: 'ROBOT',
    totalSpins: 0,
    unlockedAt: { ROBOT: 0 },
    arenaPaletteId: null,
    claimedMatchIds: [],
    progression: { botMatches: 0, botWins: 0, localMatches: 0, claimedIds: [] },
    ...overrides,
    mastery: cp3EntitledMastery(),
  };
}

export async function seedCp3EntitledProfile(page, overrides = {}) {
  const profile = JSON.stringify(cp3EntitledProfile(overrides));
  await page.evaluateOnNewDocument((serializedProfile) => {
    try { localStorage.setItem('apexChaos.arsenalMeta.v1', serializedProfile); } catch { /* test will fail at the real entitlement assertion */ }
  }, profile);
}
