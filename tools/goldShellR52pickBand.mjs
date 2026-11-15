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

// Owner-approved compact short-landscape sub-band. It is emitted INSIDE the
// R52 law so deck clearance and lock footprint still have a single authority.
// The fighter arena/identity panels, roster page behavior, art, and colors are
// intentionally untouched.
export const SHORT_LANDSCAPE_PICK_FIT = Object.freeze({
  marker: 'id="apex-approved-landscape-fighter-fit"',
  media: '@media (max-width:980px) and (orientation:landscape) and (max-height:500px)',
  css: [
    '#stage{--apexLockH:34px;--apexLockB:4.5vh;--apexLockGap:3px}',
    '#stage.screen-fighter .selectionDeckV6{top:71.5vh!important;bottom:calc(var(--apexLockB) + var(--apexLockH) + var(--apexLockGap))!important;height:auto!important;min-height:0!important}',
    '#stage.screen-fighter .selectionHeadV6{top:-2px!important;height:12px!important}',
    '#stage.screen-fighter .selectionDeckV6 .roster{height:100%!important;min-height:0!important;max-height:none!important}',
    '#stage.screen-fighter .lockMechanismV6{bottom:var(--apexLockB)!important;height:var(--apexLockH)!important;min-height:var(--apexLockH)!important;width:30vw!important;min-width:175px!important}',
  ].join(String.fromCharCode(10)),
});

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

// One law, per band:
//   1. the band's lock footprint variables (declared on #stage, the common
//      ancestor of BOTH the deck and the lock mechanism),
//   2. the deck band (authored top kept, bottom never below the lock band),
//   3. the lock band's authored footprint, pinned so no ambient rule can raise
//      it (the app's legacy global `button{min-height:44px}` tap-target floor
//      silently made the canonical 30px compact / 42px portrait lock 44px tall,
//      which is exactly what kept the 932x430 crop alive after the first pass),
//   4. roster REACHABILITY inside the band (below): the roster outgrew the
//      deck width the composition was authored for, so it scrolls
//      horizontally within its own band at the authored card size. The band
//      geometry from 1-3 is untouched — only the inside of the roster moves.
function bandRules(band, gapVh) {
  const vars = `#stage{--apexLockH:${num(band.lockHeightPx)}px;--apexLockB:${num(band.lockBottomVh)}vh;--apexLockGap:${num(gapVh)}vh}`;
  const deck = `#stage .selectionDeckV6{top:${num(band.deckTopVh)}vh!important;`
    + `bottom:max(${num(band.deckBottomVh)}vh,calc(var(--apexLockB) + var(--apexLockH) + var(--apexLockGap)))!important;`
    + 'height:auto!important;min-height:0!important}';
  const lock = '#stage .lockMechanismV6{min-height:var(--apexLockH)!important}';
  const rules = [vars, deck, lock];
  if (band.id === 'desk') {
    // Unqueried base band: also the cascade base the compact-landscape and
    // portrait bands then specialize. Canonical lays the roster out as a
    // flex row of `flex:1 1 0` cards — authored when the roster had six
    // fighters, so fourteen production fighters (8 playable + 6 visible
    // locked) crush into equal slivers. Pin each card to the authored
    // six-across width (5px gaps) and scroll the surplus sideways; the
    // authored P2-selected widening (flex 1.20) is re-asserted on the same
    // basis so the selection emphasis survives. Scroll container basics are
    // declared here once and inherited by the portrait grid (flex on the
    // cards is simply inert there: grid items ignore it).
    rules.push('#stage .selectionDeckV6 .roster{overflow-x:auto!important;'
      + 'overflow-y:hidden!important;scroll-snap-type:x proximity;'
      + 'scrollbar-width:thin;scrollbar-color:rgba(255,140,0,.55) transparent}');
    rules.push('#stage .selectionDeckV6 .rosterCard{'
      + 'flex:0 0 calc((100% - 25px)/6)!important;scroll-snap-align:start}');
    rules.push('#stage .selectionDeckV6 .rosterCard.p2-selected{'
      + 'flex-basis:calc((100% - 25px)/6*1.2)!important}');
    rules.push('#stage .selectionDeckV6 .roster::-webkit-scrollbar{height:4px}');
    rules.push('#stage .selectionDeckV6 .roster::-webkit-scrollbar-thumb{'
      + 'background:rgba(255,140,0,.55)}');
  }
  if (band.id === 'compact-landscape') {
    // Same six-across authored card width, on this band's tighter 3px gap.
    rules.push('#stage .selectionDeckV6 .rosterCard{'
      + 'flex-basis:calc((100% - 15px)/6)!important}');
    rules.push('#stage .selectionDeckV6 .rosterCard.p2-selected{'
      + 'flex-basis:calc((100% - 15px)/6*1.2)!important}');
    // Landscape phones page by the same six (see roster pager law below).
    rules.push(...ROSTER_PAGER_BAND_RULES);
  }
  if (band.id === 'portrait') {
    // The portrait deck is the only band that lays the roster out as a GRID.
    // Its canonical `.roster{inset:0;height:auto}` makes an absolutely
    // positioned box content-sized (both top and bottom specified with an auto
    // height => the box grows past its band: 692..922 inside a 692..839 band),
    // so the 2x1fr rows resolved against content instead of the band and the
    // LOCK bar cut straight through the second row of cards. Give the roster
    // the band's definite height so the rows mean what they say.
    // (`min-height`/`max-height` are pinned because the retired React menu's
    // global stylesheet still ships `@media(max-width:680px) .roster
    // {min-height:230px;max-height:52dvh}` — the same class name, so an ambient
    // floor used to decide the Gold band's height instead of the band itself.)
    // The authored page is 3 columns x 2 rows. This rule once also pinned
    // `grid-auto-rows:0` + `overflow:hidden`, so every fighter past the
    // sixth landed in a zero-height implicit row and was simply GONE (the
    // 14-fighter production roster made BOXE/SHURI unpickable in portrait).
    // Keep the page; flow surplus fighters into further COLUMNS of the same
    // width (4px gaps) and scroll them through the desk band's scrollport.
    // `scroll-padding-left` matches the roster's 4px inline padding: without
    // it mandatory snap rested at scrollLeft 4 (aligning card 1's border box
    // to the snapport origin), which leaked a 4px sliver of the next page's
    // first column into the port at every rest and pushed that column's
    // name glyphs to within ~6px of the stage's right edge.
    rules.push('#stage .selectionDeckV6 .roster{height:100%!important;'
      + 'min-height:0!important;max-height:none!important;'
      + 'grid-template-columns:none!important;'
      + 'grid-template-rows:repeat(2,minmax(0,1fr))!important;'
      + 'grid-auto-flow:column!important;scroll-padding-left:4px!important;'
      + 'grid-auto-columns:calc((100% - 8px)/3)!important}');
    // The 3x2 grid page becomes explicit navigation (see roster pager law).
    rules.push(...ROSTER_PAGER_BAND_RULES);
  }
  const joined = rules.join('\n');
  return band.query ? `@media${band.query}{\n${joined}\n}` : joined;
}

// ── Roster pager (owner Fighter-Select completion law) ──────────────────────
// The reachability pass above made the 14-fighter roster scrollable, but a bare
// scrollport is not navigation: on a phone nothing said more fighters existed.
// Owner law: the portrait phone roster is a 3x2 PAGE (six fighters per view)
// with explicit page navigation — indicator dots in the deck header, prev/next
// chevrons in the deck's side margins, and swipe that settles on whole pages.
// Compact-landscape phones page by the same six. The desk band keeps the
// canonical scrollport untouched (owner: desktop Gold stays).
//
// Ownership boundaries stay exactly where they were: the canonical shell logic
// owns selection (selectHero/moveHero/lockCurrent), this controller only moves
// the scrollport by whole pages and mirrors state. It also keeps two pieces of
// roster metadata honest that the six-fighter authoring left stale: the
// selection track cursor scale (--cursor-n; the canonical width assumed 6
// fighters, so the cursor ran off the track from the 7th) and the header meta
// fighter count.
export const ROSTER_PAGER_MARKER = 'R52 ROSTER PAGER';
export const ROSTER_PAGER_SCRIPT_ID = 'apex-roster-pager';
export const ROSTER_PAGER_PAGE = 6;

// Page-snap + pager visibility rules appended to the portrait and
// compact-landscape band blocks. Page starts are every 6th card (the authored
// six-per-view width law); mandatory snap makes raw swipes settle on pages,
// and the canonical card reveal lands exactly on page boundaries.
export const ROSTER_PAGER_BAND_RULES = [
  '#stage .selectionHeadV6 .apexRosterPager{display:flex}',
  '#stage .selectionDeckV6 .rosterPagerBtn{display:block}',
  '#stage .selectionDeckV6 .roster{scroll-snap-type:x mandatory!important;touch-action:pan-x}',
  '#stage .selectionDeckV6 .rosterCard{scroll-snap-align:none}',
  `#stage .selectionDeckV6 .rosterCard:nth-child(${ROSTER_PAGER_PAGE}n+1){scroll-snap-align:start}`,
];

// Unqueried base: pager chrome (hidden unless a pager band shows it) plus the
// selection-cursor scale fix, which applies wherever the track renders.
export function rosterPagerCss() {
  return [
    `#stage .selectionCursorV6{width:calc(100%/var(--cursor-n,${ROSTER_PAGER_PAGE}))}`,
    '#stage .selectionHeadV6 .apexRosterPager{display:none;align-items:center;gap:6px;margin-left:auto}',
    // min-height/min-width are pinned: the retired React menu's global
    // `button{min-height:44px}` tap-target floor (see header) would otherwise
    // blow the 7px dots up into 44px slivers inside the 18px header row.
    // pointer-events:auto: the canonical deck is pointer-transparent and only
    // re-enables its interactive children; the pager must opt back in.
    '#stage .apexRosterPager .rosterPagerDot{appearance:none;-webkit-appearance:none;width:7px;height:7px;min-width:0;min-height:0;padding:0;border:0;background:rgba(238,231,219,.28);transform:rotate(45deg);cursor:pointer;pointer-events:auto}',
    '#stage .apexRosterPager .rosterPagerDot[aria-current="true"]{background:#ff8c1a;box-shadow:0 0 6px rgba(255,140,26,.85)}',
    '#stage .apexRosterPager .rosterPagerDot:focus-visible{outline:1px solid #ff8c1a;outline-offset:2px}',
    '#stage .selectionDeckV6 .rosterPagerBtn{display:none;position:absolute;top:50%;translate:0 -50%;z-index:5;width:22px;height:46px;min-width:0;min-height:0;padding:0;appearance:none;-webkit-appearance:none;background:rgba(10,10,12,.78);border:1px solid rgba(255,148,31,.55);color:#ffb35c;font:800 16px/1 var(--fUi);cursor:pointer;pointer-events:auto;clip-path:polygon(20% 0,100% 0,80% 100%,0 100%)}',
    '#stage .selectionDeckV6 .rosterPagerPrev{left:-24px}',
    '#stage .selectionDeckV6 .rosterPagerNext{right:-24px}',
    '#stage .selectionDeckV6 .rosterPagerBtn[disabled]{opacity:.22;pointer-events:none}',
    '#stage .selectionDeckV6 .rosterPagerBtn:focus-visible{outline:1px solid #ff8c1a;outline-offset:1px}',
  ].join('\n');
}

// The pager controller. Inserted as the last body script so both the mounted
// Gold document and a direct shell.html load run it exactly once, after the
// canonical shell script. Fully defensive: picking must never depend on it.
export function rosterPagerScript() {
  return `<script id="${ROSTER_PAGER_SCRIPT_ID}">
/* ${ROSTER_PAGER_MARKER} — whole-page navigation for the six-per-view roster
   scrollport (portrait 3x2 + compact-landscape). Canonical shell logic owns
   selection; this only pages the scrollport, mirrors the page in header
   dots, and keeps the track cursor + header count scaled to the live roster. */
(() => {
  try {
    var PAGE = ${ROSTER_PAGER_PAGE};
    var stage = document.getElementById('stage');
    var deck = stage ? stage.querySelector('.selectionDeckV6') : null;
    var head = deck ? deck.querySelector('.selectionHeadV6') : null;
    var roster = deck ? deck.querySelector('.roster') : null;
    if (!deck || !head || !roster) return;
    var cursor = document.getElementById('selectionCursorV6');
    var meta = head.querySelector('.selectionMeta');
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var pager = document.createElement('div');
    pager.className = 'apexRosterPager';
    pager.setAttribute('role', 'group');
    pager.setAttribute('aria-label', 'Roster pages');
    var equip = head.querySelector('.fa3-pick-equip-entry');
    if (equip) head.insertBefore(pager, equip); else head.appendChild(pager);

    function makeBtn(cls, label, text) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = cls; b.setAttribute('aria-label', label);
      b.textContent = text;
      return b;
    }
    var prev = makeBtn('rosterPagerBtn rosterPagerPrev', 'Previous roster page', '‹');
    var next = makeBtn('rosterPagerBtn rosterPagerNext', 'Next roster page', '›');
    deck.appendChild(prev);
    deck.appendChild(next);

    var dots = [];
    var page = 0;
    var pages = 1;

    function cards() { return roster.querySelectorAll('.rosterCard'); }
    function starts() {
      // Page starts are the settled scroll positions of every 6th card. The
      // last page is partial (14 = 6+6+2), so its start clamps to the maximum
      // scroll: the final page is end-aligned, exactly where mandatory snap
      // leaves the scrollport, and the dots agree with what is on screen.
      var list = cards(); var out = [];
      var rr = roster.getBoundingClientRect();
      var maxSl = Math.max(0, roster.scrollWidth - roster.clientWidth);
      // scroll-snap-align:start targets the snapport, not the scrollport edge.
      // Portrait owns 4px of scroll-padding so the first card's border stays
      // clear of the bezel; page offsets must mirror that same inset or taps,
      // swipes, and keyboard-follow report a false 4px miss after snapping.
      var snapInset = parseFloat(getComputedStyle(roster).scrollPaddingLeft) || 0;
      for (var i = 0; i < list.length; i += PAGE) {
        out.push(Math.min(maxSl, Math.max(0, Math.round(roster.scrollLeft + list[i].getBoundingClientRect().left - rr.left - snapInset))));
      }
      return out.length ? out : [0];
    }
    function buildDots() {
      pager.innerHTML = ''; dots = [];
      for (var i = 0; i < pages; i++) {
        (function (idx) {
          var d = makeBtn('rosterPagerDot', 'Roster page ' + (idx + 1) + ' of ' + pages, '');
          d.addEventListener('click', function () { goTo(idx); });
          pager.appendChild(d); dots.push(d);
        })(i);
      }
    }
    function sync() {
      var list = cards();
      var st = starts();
      if (st.length !== pages) { pages = st.length; buildDots(); }
      var sl = roster.scrollLeft; var best = 0; var bd = Infinity;
      for (var i = 0; i < st.length; i++) { var dd = Math.abs(st[i] - sl); if (dd < bd) { bd = dd; best = i; } }
      page = best;
      dots.forEach(function (d, i) { d.setAttribute('aria-current', i === page ? 'true' : 'false'); });
      prev.disabled = page <= 0;
      next.disabled = page >= pages - 1;
      if (cursor && list.length) cursor.style.setProperty('--cursor-n', String(list.length));
      if (meta && list.length) {
        var want = list.length + ' FIGHTERS // ONE CONFLICT';
        if (meta.textContent !== want) meta.textContent = want;
      }
    }
    function goTo(p, instant) {
      var st = starts(); pages = st.length;
      p = Math.max(0, Math.min(pages - 1, p));
      roster.scrollTo({ left: st[p], behavior: instant || reduced ? 'auto' : 'smooth' });
      page = p;
      requestAnimationFrame(sync);
    }
    prev.addEventListener('click', function () { goTo(page - 1); });
    next.addEventListener('click', function () { goTo(page + 1); });
    // Arrow keys deliberately stay with the canonical shell (hero move):
    // the pager buttons are native buttons (Tab + Enter/Space), and the
    // selection-follow below keeps the page honest when arrows move the
    // selection across a page boundary.
    var ticking = false;
    roster.addEventListener('scroll', function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () { ticking = false; sync(); });
    }, { passive: true });
    new MutationObserver(function () { sync(); }).observe(roster, { childList: true });
    // Selection/page consistency: the canonical reveal scrolls the minimum
    // distance to show a card, which under mandatory page snap can settle on
    // a neighbouring page and leave the selected fighter off-view. When the
    // SELECTION itself changes (either side), the pager aligns the port to
    // the selected fighter's page. Free paging never triggers this — only a
    // selection identity change does.
    var lastSel = { p1: null, p2: null };
    var alignT = null;
    function alignToSelection() {
      if (getComputedStyle(pager).display === 'none') return;
      [['p1', 'p1-selected'], ['p2', 'p2-selected']].forEach(function (pair) {
        var el = roster.querySelector('.rosterCard.' + pair[1]);
        var id = el ? el.getAttribute('data-hero') : null;
        if (!id) return;
        // First sighting per side is the baseline (the pick screen opens on
        // page 1 with the shell's default fighter already selected — that is
        // canonical composition, not a selection change to chase).
        var changed = lastSel[pair[0]] !== null && id !== lastSel[pair[0]];
        lastSel[pair[0]] = id;
        if (!changed) return;
        var list = cards();
        var idx = Array.prototype.indexOf.call(list, el);
        if (idx < 0) return;
        var target = Math.floor(idx / PAGE);
        var st = starts();
        if (st[target] != null && Math.abs(roster.scrollLeft - st[target]) > 3) {
          clearTimeout(alignT);
          // Selection reveal is IMMEDIATE (like the resize re-align below):
          // the chosen fighter must never sit half-severed at the port edge
          // while a glide settles, with the dots/page state disagreeing
          // with the port until it lands. Browsing (buttons, dots, swipe)
          // still glides; only the selection-follow jumps.
          alignT = setTimeout(function () { goTo(target, true); }, 60);
        }
      });
    }
    new MutationObserver(function () { alignToSelection(); })
      .observe(roster, { attributes: true, subtree: true, attributeFilter: ['class'] });
    var rzT = null;
    window.addEventListener('resize', function () {
      clearTimeout(rzT);
      rzT = setTimeout(function () {
        var sel = roster.querySelector('.rosterCard.p1-selected, .rosterCard.p2-selected');
        if (sel) {
          var list = cards();
          var idx = Array.prototype.indexOf.call(list, sel);
          if (idx >= 0) roster.scrollTo({ left: starts()[Math.floor(idx / PAGE)], behavior: 'auto' });
        }
        sync();
      }, 120);
    });
    buildDots();
    sync();
    window.APEX_ROSTER_PAGER = {
      goTo: goTo,
      sync: sync,
      get page() { return page; },
      get pages() { return pages; }
    };
  } catch (e) { /* pager is an aid; canonical picking must never depend on it */ }
})();
</script>`;
}

// The exact text this adapter inserts (exported so gates can locate the law).
export function pickBandLawCss(law) {
  if (!law || !Array.isArray(law.bands)) {
    throw new Error('R52 pick band: pickBandLawCss() needs a resolved law');
  }
  // Pager base comes FIRST so the per-band visibility/snap rules override it
  // by plain cascade order (equal specificity) inside their media blocks.
  return `\n/* ${PICK_BAND_MARKER} — the deck is the band ABOVE the LOCK band (see adapter header). */\n`
    + `/* ${ROSTER_PAGER_MARKER} — pager chrome + cursor scale (see adapter). */\n`
    + rosterPagerCss() + '\n'
    + law.bands.map((band) => bandRules(band, law.gapVh)).join('\n') + '\n'
    + `/* ${SHORT_LANDSCAPE_PICK_FIT.marker} — owner-approved short-landscape Fighter Select sub-band */\n`
    + `${SHORT_LANDSCAPE_PICK_FIT.media}{\n${SHORT_LANDSCAPE_PICK_FIT.css}\n}\n`;
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

  // Roster pager controller: one guarded end-of-body script, after the law.
  const script = '\n' + rosterPagerScript() + '\n';
  const bodyEnd = out.lastIndexOf('</body>');
  if (bodyEnd < 0 || out.indexOf('</body>') !== bodyEnd) {
    throw new Error('R52 roster pager: expected exactly one </body> seam');
  }
  const finalOut = out.slice(0, bodyEnd) + script + out.slice(bodyEnd);
  if (count(finalOut, ROSTER_PAGER_MARKER) !== 2) {
    throw new Error('R52 roster pager: marker must appear once in the CSS law and once in the script');
  }
  if (count(finalOut, `id="${ROSTER_PAGER_SCRIPT_ID}"`) !== 1
    || count(finalOut, rosterPagerScript()) !== 1
    || count(finalOut, rosterPagerCss()) !== 1) {
    throw new Error('R52 roster pager: emitted pager law mismatch');
  }
  return finalOut;
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
  const shortLandscape = applied && band.id === 'compact-landscape' && height <= 500;
  const lockOffset = shortLandscape ? 4.5 / 100 * height : band.lockBottomVh / 100 * height;
  const lockHeight = shortLandscape ? 34 : band.lockHeightPx;
  const lockTopY = height - lockOffset - lockHeight;
  const deckTopY = (shortLandscape ? 71.5 : band.deckTopVh) / 100 * height;
  const deckOffsetY = shortLandscape
    ? lockOffset + lockHeight + 3
    : applied
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
