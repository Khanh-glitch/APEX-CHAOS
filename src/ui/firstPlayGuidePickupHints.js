// Pure eligibility checks for the Learn by Playing pickup hint.
// Keep these separate from UI/layout so missing runtime data fails closed and
// the P1/weapon requirements are directly testable without a battle fixture.
export function isPlayerUnarmed(fighter) {
  if (!fighter || !fighter.data || typeof fighter.data !== 'object') return false;
  // The production Arsenal represents an empty hand with a null holder.
  return !fighter.data.arsenal?.weaponId;
}

export function hasRevealedGun(slots, isGun) {
  if (!Array.isArray(slots) || typeof isGun !== 'function') return false;
  return slots.some((slot) => slot?.phase === 'REVEALED'
    && typeof slot.weaponId === 'string' && isGun(slot.weaponId) === true);
}
