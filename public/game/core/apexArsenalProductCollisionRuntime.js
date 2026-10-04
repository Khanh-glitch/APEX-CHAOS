// Current Arsenal/Core Six two-anchor collision seam.
//
// This replaces only the neutral physical separation that the current product
// previously inherited from apexFullRosterQa.js. Hero Rework remains the
// higher-level collision observer/world-wall authority and wraps this function
// after its runtime loads.
(function installArsenalProductCollision() {
  const live = (fighter) => fighter && fighter.hp > 0;

  function clampAnchor(fighter) {
    if (!fighter) return;
    fighter.x = clamp(fighter.x, fighter.radius, GAME_SIZE - fighter.radius);
    fighter.y = clamp(fighter.y, fighter.radius, GAME_SIZE - fighter.radius);
    if (!Number.isFinite(fighter.x) || !Number.isFinite(fighter.y)) {
      fighter.x = GAME_SIZE / 2;
      fighter.y = GAME_SIZE / 2;
      if (typeof fighter.setDir === 'function') fighter.setDir(rand(-1, 1), rand(-1, 1));
    }
  }

  handleCollisions = function handleArsenalProductCollisions(dt) {
    const a = fighters[0];
    const b = fighters[1];
    if (!live(a) || !live(b)) return;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const minD = a.radius + b.radius;
    if (d >= minD) return;

    const nx = dx / d;
    const ny = dy / d;
    const overlap = minD - d;

    a.x -= nx * overlap * 0.5;
    a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5;
    b.y += ny * overlap * 0.5;

    clampAnchor(a);
    clampAnchor(b);

    a.dir = reflectDir(a.dir, -nx, -ny);
    b.dir = reflectDir(b.dir, nx, ny);
  };

  window.apexArsenalProductCollisionRuntime = 'ready';
})();
