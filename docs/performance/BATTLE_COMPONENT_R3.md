# Gold Battle component R3

This replaces the R2 browser-specific CSS workaround at the integration boundary.

- `tools/buildGoldBattleComponent.mjs` parses the exact embedded Battle Gold
  payload with PostCSS during build. Every normal selector is scoped under
  battleHudHost; declarations, conditional rules and keyframes are retained.
  Shell CSS is emitted once, with a donor CSS fingerprint. Browsers no longer
  transform donor CSS, parse temporary stylesheets or choose an @scope fallback.
- Both the normal build/dev scripts and the test-free itch build run this
  compiler. The canonical Gold cutover generator invokes the same compiler.
- The bridge requires the compiled component. ArenaViewport alone controls the
  hosted gameplay canvas CSS dimensions; Gold supplies its square slot and the
  engine retains its drawing buffer. Legacy battle sizing rules now apply only
  within the legacy battle-shell, not to a canvas moved into Gold. Teardown
  disconnects the slot observer and restores the original canvas style.
- Before startMatch, the bridge requires two consecutive valid layout samples:
  the component CSS marker, a size-container stage, a grid HUD, a square arena
  and a square attached gameplay canvas. Invalid layout times out before engine
  startup; cancellation cannot tear down a newer session.

R1 performance improvements and R2 recording improvements remain. No artwork,
material pass, visual effect, particle budget, drawing-buffer size or video
quality setting is reduced by R3. This is a change to the shared Gold UI
integration, not a replacement of the combat engine or a Safari UA exception.

Source review and compilation/packaging only, per owner instruction. No browser
playtest, automated tests, benchmarks or GitHub Actions. Physical-device Safari
behavior and actual recording performance still need owner acceptance. This
does not promise compatibility with browsers lacking other Gold requirements
such as size containers or container query units.
