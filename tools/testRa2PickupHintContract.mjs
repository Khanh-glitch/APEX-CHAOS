// RA-2.3 negative-condition contract: live identity must exist, P1 must be
// genuinely unarmed, and only a revealed production-configured gun qualifies.
import assert from 'node:assert/strict';
import { hasRevealedGun, isPlayerUnarmed } from '../src/ui/firstPlayGuidePickupHints.js';

assert.equal(isPlayerUnarmed(null), false, 'missing fighter fails closed');
assert.equal(isPlayerUnarmed({}), false, 'missing fighter data fails closed');
assert.equal(isPlayerUnarmed({ data: null }), false, 'null fighter data fails closed');
assert.equal(isPlayerUnarmed({ data: { arsenal: null } }), true, 'engine null holder means genuinely unarmed');
assert.equal(isPlayerUnarmed({ data: { arsenal: {} } }), true, 'empty holder has no owned weapon');
assert.equal(isPlayerUnarmed({ data: { arsenal: { weaponId: 'TEC_9' } } }), false, 'an owned weapon suppresses the pickup hint');

const isProductionGun = (id) => ['TEC_9', 'GLOCK_17', 'RPG_7'].includes(id);
assert.equal(hasRevealedGun(null, isProductionGun), false, 'missing slot data fails closed');
assert.equal(hasRevealedGun([], isProductionGun), false, 'empty slot list offers no pickup');
assert.equal(hasRevealedGun([{ phase: 'TELEGRAPH', weaponId: 'TEC_9' }], isProductionGun), false, 'telegraph is not yet available');
assert.equal(hasRevealedGun([{ phase: 'REVEALED', weaponId: 'HEAL_H5' }], isProductionGun), false, 'health pickup is not a gun');
assert.equal(hasRevealedGun([{ phase: 'REVEALED', weaponId: 'UNKNOWN' }], isProductionGun), false, 'non-production weapon ID is rejected');
assert.equal(hasRevealedGun([{ phase: 'REVEALED', weaponId: 'TEC_9' }], isProductionGun), true, 'real revealed gun is eligible');
assert.equal(hasRevealedGun([{ phase: 'REVEALED', weaponId: 'TEC_9' }], null), false, 'missing gun authority fails closed');

console.log('RA-2.3 pickup eligibility contract PASS (13 assertions)');
