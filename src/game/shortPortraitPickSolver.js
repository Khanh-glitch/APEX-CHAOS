// R85 candidate — numeric layout authority, evaluated from actual CSS viewport.
// Shared mathematical authority for short portrait Pick; no side effects.
export function solveShortPortraitPick({ width, height, lockHeight = 42 }) {
  if (!Number.isFinite(width) || !Number.isFinite(height) ||
      width <= 0 || height <= 0 || width >= height || height > 700) return null;
  const lockReserve = Math.max(height * 0.10, height * 0.032 + lockHeight + height * 0.008);
  const deckHeight = 128;
  const deckTop = Math.min(height * 0.65, height - lockReserve - deckHeight);
  const deckBottom = height - deckTop - lockReserve;
  return {
    width, height, lockReserve, deckTop, deckBottom,
    heroTop: height * 0.117,
    heroWidth: width * 1.04,
    heroLeft: width * -0.02,
    infoBottom: height - deckTop + 8,
    // Hero ends above the reserved info dock, measured after compact CSS applies.
    heroBottomForInfoHeight(infoHeight) {
      return height - deckTop + 8 + infoHeight + 2;
    }
  };
}
