# Safari and capture R2

Based on retained R1 (`dedd602f`). Runtime revision: `20261114-safari-capture-r2`.

- Safari without CSSScopeRule now receives parsed, selector-scoped Gold CSS.
  Declarations, media/supports groups and global keyframes are preserved to the
  extent supported by that browser. Modern browsers retain native @scope.
  This targets Safari 16 on iPhone 8; it is not a blanket promise of support
  for all older iOS versions (Gold also uses container units and modern colors).
- The live gameplay canvas fits its arena with explicit equal CSS dimensions.
  Its 1000x1000 drawing buffer is unchanged. ResizeObserver follows the arena
  slot and disconnects when the canvas returns to the engine wrapper.
- Fighter sparks stop scheduling RAF while outside Fighter Pick, while the
  battle hides the shell, or while the document is hidden. Visible effects keep
  their particle counts, resolution and update cadence. Hidden Home CSS
  animations pause during battle. The Gold generator retains these changes.
- F7 carries the fractional RAF scheduling remainder instead of discarding it
  after every captured frame. When a source frame counter is available, an
  unchanged source frame is not copied twice. The source callback scheduler
  remains RAF; the rejected requestVideoFrameCallback change is not restored.
- Studio crop geometry is cached until resize, scroll or stage style changes.
- F7 queries encoding capabilities at full output quality. A codec replaces the
  original preference only if supported, smooth and power-efficient are all true.
  Otherwise the previous supported-codec preference remains. The output stays
  1080x1920, target 30 FPS, requested 22 Mbps video and 256 kbps audio. The full
  frame clear, high-quality scaling and real tab audio are retained.

No art, VFX layers, combat particle budgets, simulation settings or video
resolution were reduced. Home's visible artwork/filter composition is retained;
this does not claim that every source of Home stutter has been eliminated.

Build: `node tools/buildRetainedItch.mjs`; ZIP the contents of dist-itch-html5.
Owner requested no automated tests, browser runs, benchmarks or GitHub Actions.
Only source review and build/packaging guards are used for this delivery. Actual
Safari rendering and recording smoothness still require owner acceptance.
