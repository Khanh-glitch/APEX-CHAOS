// R91 label-fit patch. Source-owned; never edit only generated HUD.
// Gold donor unchanged. All functional event and pixel coordinate paths remain intact.
//
// Owner-directed HUD Preservation & Defect Audit follow-up (D1/D2 re-audit).
// Browser-runtime measurement (Chromium, production built donor + shell
// fonts.css, worst-case production strings, 13 viewport/mode contexts x
// EN/VI) proved that long production skill names elide on the PRIMARY decks
// in every band: MAGNETIC ATTRACTION (19ch) +18..78px and
// KHO VU KHI PHAN CHIEU (21ch, VI) +31..84px past their .sk-name boxes,
// including desktop 1920x1080; portrait Local 2P weapon names elide too
// (MOSSBERG 500, +24..31px). Font shrink alone would need -12% (desk) to
// -39% (360x640 portrait 2P) and was rejected for readability.
//
// Minimal Gold-preserving mechanism, per band (chosen from the same
// measurements, iteration 2 after browser A/B):
// - land/port primary decks: .sk-name/.wp-name may wrap to a SECOND line
//   instead of eliding. Names that already fit render identically (one
//   line, same size); tile internal overflow verified unchanged there.
// - desk primary decks: wrap was REJECTED by measurement (at 1366x768 the
//   second line overflows the fixed 108px skill tile by 22px and clips
//   tile content). Desk instead steps the skill-name size down along the
//   donor cqh curve (21->18px cap, 16 floor->13) with tighter tracking;
//   desk overflow ratios are only 1.12-1.19, so one line always fits and
//   tile geometry is untouched.
// - portrait Local 2P .wp-name additionally steps 15->12.5px: wrapping
//   alone cannot fit the longest single word (JACKHAMMER = 119px @15px in
//   a 101px box); at 12.5px the word is ~99px and fits its line.
// No grid geometry, colors, arena, or choreography values change.
//
// Deliberate exclusions (donor behaviour kept):
// - CPU tertiary readouts in 1p (#p2Side mini skill/weapon strips,
//   56-64px @9.5px): status columns keep donor elision by design.
// - Portrait 1p CPU weapon NAME: already hidden by existing Gold law
//   (#hud[port][1p] #p2Side .wp-txt{display:none}); icon+ammo only.
// - Quest composition (#hud[data-quest="1"]): untouched.
// - Hero names, tags, rails, control metadata: untouched (reported in the
//   audit as separate, unscoped observations).
export const R91_LABEL_FIT_CSS = `/* R91 LABEL-FIT: primary-deck skill/weapon names fit whole instead of
   eliding (audit D1/D2, browser-measured). land/port wrap to a second
   line; desk steps size along the donor cqh curve (wrap clips the fixed
   desk tile at short heights). Short names render unchanged; CPU 1p mini
   readouts and Quest keep donor elision. */
#hud:not([data-quest="1"]):not([data-layout="desk"])[data-mode="2p"] .sk-name,
#hud:not([data-quest="1"]):not([data-layout="desk"])[data-mode="1p"] #p1Side .sk-name{
  white-space:normal;
  display:-webkit-box;
  -webkit-box-orient:vertical;
  -webkit-line-clamp:2;
  line-clamp:2;
  line-height:1.15;
}
#hud:not([data-quest="1"])[data-layout="desk"][data-mode="2p"] .sk-name,
#hud:not([data-quest="1"])[data-layout="desk"][data-mode="1p"] #p1Side .sk-name{
  font-size:clamp(13px,1.7cqh,18px);
  letter-spacing:.02em;
}
#hud:not([data-quest="1"]):not([data-layout="desk"])[data-mode="2p"] .wp-name,
#hud:not([data-quest="1"]):not([data-layout="desk"])[data-mode="1p"] #p1Side .wp-name{
  white-space:normal;
  display:-webkit-box;
  -webkit-box-orient:vertical;
  -webkit-line-clamp:2;
  line-clamp:2;
  line-height:1.12;
}
#hud:not([data-quest="1"])[data-layout="desk"][data-mode="2p"] .wp-name,
#hud:not([data-quest="1"])[data-layout="desk"][data-mode="1p"] #p1Side .wp-name{
  font-size:clamp(13px,1.85cqh,14.5px);
  letter-spacing:.02em;
}
#hud:not([data-quest="1"])[data-layout="port"][data-mode="2p"] .wp-name{
  font-size:12.5px;
  letter-spacing:.05em;
}
`;
export function adaptGoldBattleHudR91LabelFit(out) {
  if (out.includes('R91 LABEL-FIT')) throw new Error('R91 duplicate law');
  const anchor = '</style>';
  const index = out.indexOf(anchor);
  if (index === -1) throw new Error('R91 expected Gold battle HUD stylesheet');
  return out.slice(0, index) + R91_LABEL_FIT_CSS + out.slice(index);
}
