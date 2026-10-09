// R52 Fighter-Pick bottom band law gate.
//
// PROOF (static, byte-exact): the generated Gold shell carries the R52 pick
// band law, the law is derived from the canonical deck/lock rules, and the
// derived geometry clears the LOCK mechanism at a spread of viewports where the
// canonical composition did not. Live geometry is additionally covered by the
// owner-playtest matrix probe (docs/acceptance/owner-playtest/matrix).
import fs from 'node:fs';
import {
  PICK_BAND_MARKER,
  PICK_BAND_SOURCES,
  pickBandFor,
  pickBandGeometry,
  resolvePickBandLaw,
} from './goldShellR52pickBand.mjs';

const shell = fs.readFileSync('public/gold/shell.html', 'utf8');
const adapter = fs.readFileSync('tools/goldShellR52pickBand.mjs', 'utf8');
const generator = fs.readFileSync('tools/buildGoldCutover.mjs', 'utf8');
const failures = [];
const passes = [];
function check(name, ok, detail = '') {
  (ok ? passes : failures).push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
}
const count = (hay, needle) => hay.split(needle).length - 1;

check('shell carries exactly one pick band law', count(shell, PICK_BAND_MARKER) === 1);
check('generator runs the pick band adapter after the R50K shell adapter',
  /adaptGoldShellR50k\(out\);[\s\S]{0,400}adaptGoldShellR52PickBand\(out\);/.test(generator));
check('generator documents the pick band patch law', generator.includes('PICK \u2014 the Fighter-Pick bottom band'));

// ── canonical provenance: the law overrides, it never rewrites ──────────────
for (const source of PICK_BAND_SOURCES) {
  check(`canonical ${source.id} deck + lock rules survive untouched`,
    source.deck.test(shell) && source.lock.test(shell));
}

const law = resolvePickBandLaw(shell);
check('law derives one entry per canonical band', law.bands.length === PICK_BAND_SOURCES.length);

for (const band of law.bands) {
  const vars = `#stage{--apexLockH:${band.lockHeightPx}px;--apexLockB:${band.lockBottomVh}vh;--apexLockGap:${law.gapVh}vh}`;
  const deck = `#stage .selectionDeckV6{top:${band.deckTopVh}vh!important;`
    + `bottom:max(${band.deckBottomVh}vh,calc(var(--apexLockB) + var(--apexLockH) + var(--apexLockGap)))!important;`
    + 'height:auto!important;min-height:0!important}';
  const lock = '#stage .lockMechanismV6{min-height:var(--apexLockH)!important}';
  check(`law pins the ${band.id} deck band inside its own media block`,
    count(shell, vars) === 1 && count(shell, deck) === 1);
  check(`law pins the ${band.id} lock footprint (one rule per band)`,
    count(shell, lock) === law.bands.length);
}
check('portrait law owns the grid roster height (ambient floor cannot decide it)',
  count(shell, '#stage .selectionDeckV6 .roster{height:100%!important;min-height:0!important;max-height:none!important;'
    + 'grid-template-rows:repeat(2,minmax(0,1fr))!important;grid-auto-rows:0!important;overflow:hidden!important}') === 1);
check('ambient floors the law defeats are documented',
  adapter.includes('min-height:44px') && adapter.includes('min-height:230px'));
// R81's short-portrait Fighter Pick adjusts ONLY the roster's TOP edge to
// keep two card rows legible at 360x560. It comes after the R52 cutover law in
// a separate, guarded stylesheet. The legacy test rejected any later selector,
 // even when it never touched R52's lock clearance (bottom/height).
 // Keep the *real* no-new-writer invariant instead of hiding R81 or
 // weakening the lock-band geometry checks below.
check('R52 remains the sole LOCK-safe bottom/height authority; R81 is guarded and top-only', (() => {
  const tail = shell.slice(shell.indexOf(PICK_BAND_MARKER));
  const firstStyleEnd = tail.indexOf('</style>');
  if (firstStyleEnd < 0) return false;
  const lawCSS = tail.slice(0, firstStyleEnd);
  const emittedDeck = [...lawCSS.matchAll(/#stage \.selectionDeckV6\{([^{}]*)\}/g)];
  if (emittedDeck.length !== law.bands.length
      || (lawCSS.match(/\.selectionDeckV6\{/g) || []).length !== law.bands.length
      || !emittedDeck.every(([, body]) => /top:/.test(body) && /bottom:max\(/.test(body)
        && /height:auto!important/.test(body))) return false;

  const later = tail.slice(firstStyleEnd + '</style>'.length);
  const r81 = later.match(/<style id="r81-portrait-compact">([\s\S]*?)<\/style>/);
  if (!r81 || !/@media\s*\(orientation:portrait\)\s*and\s*\(max-width:420px\)\s*and\s*\(max-height:650px\)/.test(r81[1])) return false;
  const permitted = '#stage.screen-fighter .selectionDeckV6{top:70.8vh!important}';
  if ((r81[1].split(permitted).length - 1) !== 1) return false;
  // R81 can change top only; another late writer to bottom, height or
  // min-height would silently bypass R52 and MUST fail this gate.
  const allLate = [...later.matchAll(/\.selectionDeckV6\{([^{}]*)\}/g)];
  if (allLate.length !== 1 || allLate[0][0] !== '.selectionDeckV6{top:70.8vh!important}') return false;
  return true;
})());
check('no rule after the law re-declares the lock min-height',
  shell.slice(shell.indexOf(PICK_BAND_MARKER)).split('#stage .lockMechanismV6{min-height:var(--apexLockH)!important}').join('')
    .includes('lockMechanismV6{min-height') === false);

// ── derived geometry: overlap must be gone at every band, and the canonical
// composition must actually have had the defect (otherwise the law is noise) ─
const BANDS = [
  [1920, 1080], [2560, 1440], [1440, 900], [1366, 768], [1280, 720], [1024, 768],
  [1194, 834], [932, 430], [844, 390], [820, 1180], [768, 1024], [430, 932], [390, 844], [360, 640],
];
const wasCropped = new Set();
for (const [w, h] of BANDS) {
  const canonical = pickBandGeometry(law, w, h, false);
  const applied = pickBandGeometry(law, w, h, true);
  const label = `${w}x${h}`;
  if (canonical.overlap > 0.6) wasCropped.add(label);
  check(`derived law clears the LOCK band at ${label} (${applied.band})`,
    applied.overlap === 0 && applied.deckHeight >= 40,
    `overlap=${applied.overlap.toFixed(2)} deckH=${applied.deckHeight.toFixed(1)}`);
  check(`derived law preserves the deck top edge at ${label}`,
    Math.abs(applied.deckTopY - canonical.deckTopY) < 0.01);
  check(`derived law never moves the deck below its authored bottom at ${label}`,
    applied.deckBottomY <= canonical.deckBottomY + 0.01);
}
for (const label of ['1366x768', '1280x720', '1024x768', '932x430', '932x430']) {
  check(`canonical composition did crop the roster at ${label}`, wasCropped.has(label));
}
check('1920x1080 is reproduced to within the authored clearance (<3px change)',
  Math.abs(pickBandGeometry(law, 1920, 1080, true).deckBottomY - pickBandGeometry(law, 1920, 1080, false).deckBottomY) < 3);

// ── orientation routing mirrors the CSS media queries ───────────────────────
check('band routing follows the CSS media query order',
  pickBandFor(430, 932) === 'portrait'
  && pickBandFor(932, 430) === 'compact-landscape'
  && pickBandFor(980, 500) === 'compact-landscape'
  && pickBandFor(981, 500) === 'desk'
  && pickBandFor(1920, 1080) === 'desk');

console.log(['R52 PICK BAND LAW GATE', ...passes].join('\n'));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`RESULT: PASS (${passes.length} checks)`);
