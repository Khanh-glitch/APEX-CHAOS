// R52 — deterministic Gold shell adapter: Fighter-Pick bottom-band space law.
//
// OWNER LAW (D matrix): "responsive use of space — no bottom crop" at EVERY
// aspect ratio. The canonical Gold Fighter-Pick bottom layout is authored as
// TWO independent bands:
//
//   deck (roster)      bottom + height, both in `vh`   (scales with the viewport)
//   LOCK mechanism     bottom in `vh` + FIXED height   (keeps its pixels)
//
// Because only the deck scales, the lock's footprint (bottom + height) grows
// relative to the deck as the viewport gets shorter, and the LOCK bar paints
// over the roster's bottom (name) row:
//
//   1366x768   58.1px lock footprint vs 44.5px deck bottom  ->  13.5px overlap
//   1280x720   57.6px                   vs 41.8px           ->  15.8px overlap
//   1024x768   58.1px                   vs 44.5px           ->  13.5px overlap
//    932x430   33.2px                   vs 31.4px           ->   1.8px overlap
//   1920x1080  61.3px                   vs 62.6px           ->   1.3px clear
//
// (The canonical numbers were tuned on a 1080-tall viewport; the deck cannot
// simply move up instead — its authored top edge sits 8-10px under the fighter
// identity/skill block at those same heights: 1366x768 identity bottom 574 vs
// deck top 584, 1280x720 538 vs 546.)
//
// LAW: the deck keeps its authored TOP edge (identity clearance), keeps its
// authored bottom wherever that bottom already cleared the lock (`max()`), and
// its HEIGHT becomes the free variable; its bottom can never sit lower than the
// lock band. At 1920x1080 the authored geometry is reproduced to within 1px; at
// every other viewport the overlap is gone. Nothing else about the canonical
// composition (sizes, colors, clip-paths, animations, hit targets) is touched.
//
// The law's numbers are DERIVED from the canonical deck/lock rules at build
// time (`resolvePickBandLaw`): a canonical drift fails the build loudly instead
// of silently re-introducing the crop. This adapter is the LAST writer of the
// Fighter-Pick bottom band; it runs after adaptGoldShellR50k().
//
// Two ambient floors used to decide this band's geometry instead of the band
// itself, and both are pinned by the law because the retired React menu's global
// stylesheet still ships them under the very same class names:
//   * `button{min-height:44px}` grew the canonical 30px compact / 42px portrait
//     lock to 44px (the last 1-13px of the roster crop), and
//   * `@media(max-width:680px) .roster{min-height:230px}` floored the portrait
//     roster 83px past its own band, which is what let the LOCK bar cut through
//     the second row of cards on a phone.

export const PICK_BAND_MARKER = 'R52 PICK BAND LAW';

// End of the main stylesheet, so this law is the last bottom-band writer.
export const PICK_BAND_SEAM = '.selectionDeckV6 .roster{padding:5px 4px!important}\n}\n</style>';

// The gap the law keeps between the deck and the lock band, in viewport-height
// units (so it scales exactly like the deck's authored offsets do). The roster
// also carries 5px of its own bottom padding, so the visible clearance is
// roughly 5px + this value.
export const PICK_BAND_GAP_VH = 0.2;

const round2 = (n) => Math.round(n * 100) / 100;
const num = (n) => String(round2(n));

// The three canonical bands, in cascade order (base -> compact landscape ->
// portrait). Each entry names the canonical rules whose numbers the law mirrors.
export const PICK_BAND_SOURCES = Object.freeze([
  Object.freeze({
    id: 'desk',
    query: '',
    deck: /\.selectionDeckV6\{left:12\.5vw!important;right:12\.5vw!important;bottom:([0-9.]+)vh!important;height:([0-9.]+)vh!important;min-height:([0-9]+)px!important\}/,
    lock: /\.lockMechanismV6\{position:absolute!important;z-index:35!important;left:50%!important;bottom:([0-9.]+)vh!important;[^}]*height:([0-9]+)px!important/,
  }),
  Object.freeze({
    id: 'compact-landscape',
    query: '(max-width:980px) and (orientation:landscape)',
    deck: /\.selectionDeckV6\{left:12vw!important;right:12vw!important;bottom:([0-9.]+)vh!important;height:([0-9.]+)vh!important;min-height:([0-9]+)px!important\}/,
    lock: /\.lockMechanismV6\{bottom:([0-9.]+)vh!important;width:30vw!important;min-width:205px!important;height:([0-9]+)px!important\}/,
  }),
  Object.freeze({
    id: 'portrait',
    query: '(orientation:portrait)',
    deck: /\.selectionDeckV6\{left:7vw!important;right:7vw!important;bottom:([0-9.]+)vh!important;height:([0-9.]+)vh!important;min-height:([0-9]+)px!important\}/,
    lock: /\.lockMechanismV6\{bottom:([0-9.]+)vh!important;width:72vw!important;min-width:0!important;height:([0-9]+)px!important\}/,
  }),
]);

// Parse the canonical deck + lock rules out of a shell document and return the
// resolved law (authored deck bottom/height/min-height and lock footprint).
export function resolvePickBandLaw(shell) {
  const src = String(shell || '');
  return Object.freeze({
    gapVh: PICK_BAND_GAP_VH,
    bands: Object.freeze(PICK_BAND_SOURCES.map((band) => {
      const deck = src.match(band.deck);
      const lock = src.match(band.lock);
      if (!deck) throw new Error(`R52 pick band: canonical ${band.id} deck rule missing`);
      if (!lock) throw new Error(`R52 pick band: canonical ${band.id} lock rule missing`);
      const deckBottomVh = Number(deck[1]);
      const deckHeightVh = Number(deck[2]);
      const deckMinHeightPx = Number(deck[3]);
      return Object.freeze({
        id: band.id,
        query: band.query,
        // The deck's authored TOP edge is the part of the composition that must
        // not move (the identity block clears it); derive it instead of copying
        // a fourth number that could drift.
        deckTopVh: round2(100 - deckBottomVh - deckHeightVh),
        deckBottomVh,
        deckHeightVh,
        deckMinHeightPx,
        lockBottomVh: Number(lock[1]),
        lockHeightPx: Number(lock[2]),
      });
    })),
  });
}

// One law, three rules per band:
//   1. the band's lock footprint variables (declared on #stage, the common
//      ancestor of BOTH the deck and the lock mechanism),
//   2. the deck band (authored top kept, bottom never below the lock band),
//   3. the lock band's authored footprint, pinned so no ambient rule can raise
//      it (the app's legacy global `button{min-height:44px}` tap-target floor
//      silently made the canonical 30px compact / 42px portrait lock 44px tall,
//      which is exactly what kept the 932x430 crop alive after the first pass).
function bandRules(band, gapVh) {
  const vars = `#stage{--apexLockH:${num(band.lockHeightPx)}px;--apexLockB:${num(band.lockBottomVh)}vh;--apexLockGap:${num(gapVh)}vh}`;
  const deck = `#stage .selectionDeckV6{top:${num(band.deckTopVh)}vh!important;`
    + `bottom:max(${num(band.deckBottomVh)}vh,calc(var(--apexLockB) + var(--apexLockH) + var(--apexLockGap)))!important;`
    + 'height:auto!important;min-height:0!important}';
  const lock = '#stage .lockMechanismV6{min-height:var(--apexLockH)!important}';
  const rules = [vars, deck, lock];
  if (band.id === 'portrait') {
    // The portrait deck is the only band that lays the roster out as a GRID.
    // Its canonical `.roster{inset:0;height:auto}` makes an absolutely
    // positioned box content-sized (both top and bottom specified with an auto
    // height => the box grows past its band: 692..922 inside a 692..839 band),
    // so the 2x1fr rows resolved against content instead of the band and the
    // LOCK bar cut straight through the second row of cards. Give the roster
    // the band's definite height so the rows mean what they say; surplus
    // (locked-placeholder) rows contribute nothing.
    // (`min-height`/`max-height` are pinned because the retired React menu's
    // global stylesheet still ships `@media(max-width:680px) .roster
    // {min-height:230px;max-height:52dvh}` — the same class name, so an ambient
    // floor used to decide the Gold band's height instead of the band itself.)
    rules.push('#stage .selectionDeckV6 .roster{height:100%!important;'
      + 'min-height:0!important;max-height:none!important;'
      + 'grid-template-rows:repeat(2,minmax(0,1fr))!important;'
      + 'grid-auto-rows:0!important;overflow:hidden!important}');
  }
  const joined = rules.join('\n');
  return band.query ? `@media${band.query}{\n${joined}\n}` : joined;
}

// The exact text this adapter inserts (exported so gates can locate the law).
export function pickBandLawCss(law) {
  if (!law || !Array.isArray(law.bands)) {
    throw new Error('R52 pick band: pickBandLawCss() needs a resolved law');
  }
  return `\n/* ${PICK_BAND_MARKER} — the deck is the band ABOVE the LOCK band (see adapter header). */\n`
    + law.bands.map((band) => bandRules(band, law.gapVh)).join('\n') + '\n';
}

export function adaptGoldShellR52PickBand(input) {
  const src = String(input || '');
  const at = src.indexOf(PICK_BAND_SEAM);
  if (at < 0) throw new Error('R52 pick band: end-of-stylesheet seam missing');
  if (src.indexOf(PICK_BAND_SEAM, at + PICK_BAND_SEAM.length) >= 0) {
    throw new Error('R52 pick band: end-of-stylesheet seam duplicated');
  }
  const law = resolvePickBandLaw(src);
  const insertion = pickBandLawCss(law);
  const out = src.slice(0, at)
    + PICK_BAND_SEAM.replace('\n</style>', insertion + '</style>')
    + src.slice(at + PICK_BAND_SEAM.length);

  const count = (haystack, needle) => haystack.split(needle).length - 1;
  if (count(out, PICK_BAND_MARKER) !== 1) {
    throw new Error('R52 pick band: the law must be written exactly once');
  }
  for (const band of law.bands) {
    if (count(out, bandRules(band, law.gapVh)) !== 1) {
      throw new Error(`R52 pick band: ${band.id} rule missing from the emitted law`);
    }
  }
  // Provenance: the canonical deck rules must survive untouched (only overridden).
  for (const band of PICK_BAND_SOURCES) {
    if (!band.deck.test(out) || !band.lock.test(out)) {
      throw new Error(`R52 pick band: canonical ${band.id} rules were modified, not overridden`);
    }
  }
  // The law is the last bottom-band writer: nothing after it may re-declare the
  // deck's bottom/height (that would silently re-open the crop).
  const lawEnd = out.indexOf(PICK_BAND_MARKER) + insertion.length;
  if (/\.selectionDeckV6\{[^}]*bottom:/.test(out.slice(lawEnd))) {
    throw new Error('R52 pick band: a later rule re-declares the deck bottom');
  }
  if (/\.lockMechanismV6\{[^}]*min-height:/.test(out.slice(lawEnd))) {
    throw new Error('R52 pick band: a later rule re-declares the lock min-height');
  }
  return out;
}

// Bands a viewport belongs to, resolved exactly like the CSS media queries do
// (orientation:portrait == height >= width). Exported for the pick-band gate.
export function pickBandFor(width, height) {
  if (height >= width) return 'portrait';
  if (width <= 980) return 'compact-landscape';
  return 'desk';
}

// Deck/lock geometry for one viewport. `applied:false` is the canonical
// composition (independent vh deck + fixed lock), `applied:true` is the law.
export function pickBandGeometry(law, width, height, applied) {
  const band = law.bands.find((candidate) => candidate.id === pickBandFor(width, height));
  if (!band) throw new Error('R52 pick band: no band for ' + width + 'x' + height);
  const lockOffset = band.lockBottomVh / 100 * height;
  const lockHeight = band.lockHeightPx;
  const lockTopY = height - lockOffset - lockHeight;
  const deckTopY = band.deckTopVh / 100 * height;
  const deckOffsetY = applied
    ? Math.max(band.deckBottomVh / 100 * height, lockOffset + lockHeight + law.gapVh / 100 * height)
    : band.deckBottomVh / 100 * height;
  const deckBottomY = height - deckOffsetY;
  const deckHeight = applied
    ? height - deckTopY - deckOffsetY
    : Math.max(band.deckHeightVh / 100 * height, band.deckMinHeightPx);
  return {
    band: band.id,
    width,
    height,
    deckTopY,
    deckBottomY,
    deckHeight,
    lockTopY,
    lockOffset,
    lockHeight,
    overlap: Math.max(0, lockTopY < deckBottomY ? deckBottomY - lockTopY : 0),
  };
}
