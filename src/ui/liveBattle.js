// Issue #105 owner rejection R2 (P0-D): one presentation authority for "a battle is
// running right now". Mission/achievement popups must never present during a live
// battle. Read-only: this changes no combat state, ledger, reward or claim.
export function isLiveBattleActive() {
  try { return window.APEX_ARSENAL?.state?.active === true; } catch { return false; }
}
