// Current Arsenal anchor-pair collision seam.
//
// Keep the shared engine's ordinary two-anchor separation, direction reflection,
// and collision hooks. Current Arsenal adds only the arena-bound clamp that the
// legacy FullRoster collision patch used to supply; Hero Rework wraps this seam
// later to observe anchor contact and resolve shared world geometry.
(function installArsenalAnchorCollisionRuntime() {
  if (window.apexArsenalAnchorCollisionRuntime === 'ready') return;

  const baseHandleCollisions = typeof handleCollisions === 'function'
    ? handleCollisions : null;
  if (!baseHandleCollisions) {
    throw new Error('Arsenal anchor collision runtime requires the shared engine');
  }

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function clampAnchor(anchor) {
    if (!anchor) return;
    const radius = Number.isFinite(anchor.radius) ? Math.max(0, anchor.radius) : 0;
    const size = Number.isFinite(GAME_SIZE) && GAME_SIZE > 0 ? GAME_SIZE : 1000;
    const max = Math.max(radius, size - radius);
    if (Number.isFinite(anchor.x)) anchor.x = clamp(anchor.x, radius, max);
    if (Number.isFinite(anchor.y)) anchor.y = clamp(anchor.y, radius, max);
  }

  handleCollisions = function handleArsenalAnchorCollisions(dt) {
    const a = fighters && fighters[0];
    const b = fighters && fighters[1];
    const overlapBefore = !!(a && b && a.hp > 0 && b.hp > 0
      && Math.hypot(b.x - a.x, b.y - a.y) < (a.radius || 0) + (b.radius || 0));

    const result = baseHandleCollisions(dt);
    if (overlapBefore) {
      clampAnchor(a);
      clampAnchor(b);
    }
    return result;
  };

  window.apexArsenalAnchorCollisionRuntime = 'ready';
})();
