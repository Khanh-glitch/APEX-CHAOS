// Test-only profile seeding (never shipped). A fresh browser profile owns only
// ROBOT/HUNTER, so cross-hero A/B profiling needs an owned Core Six roster.
// Writes the SAME production save key through the meta runtime's documented
// shape; it changes no gameplay code and no public roster rule.
(() => {
  try {
    const KEY = 'apexChaos.arsenalMeta.v1';
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    const base = raw && typeof raw === 'object' ? raw : {};
    const owned = new Set(Array.isArray(base.ownedFighters) ? base.ownedFighters : ['ROBOT']);
    for (const id of ['ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR', 'BOXE', 'SHURI']) owned.add(id);
    base.version = base.version || 1;
    base.ownedFighters = [...owned];
    base.unlockedAt = Object.assign({}, base.unlockedAt || {});
    for (const id of base.ownedFighters) if (base.unlockedAt[id] == null) base.unlockedAt[id] = 0;
    base.lastSelectedP1 = base.lastSelectedP1 || 'ROBOT';
    base.lastSelectedP2 = base.lastSelectedP2 || 'HUNTER';
    localStorage.setItem(KEY, JSON.stringify(base));
    window.__APEX_QA_SEEDED = true;
  } catch (e) { window.__APEX_QA_SEED_ERROR = String(e); }
})();
