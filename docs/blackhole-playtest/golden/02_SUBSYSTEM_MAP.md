# GOLDEN SUBSYSTEM MAP

All ranges refer to `01_GOLDEN_BASELINE.html`.

| Subsystem | Lines | What it actually does | Reuse rule |
|---|---:|---|---|
| Shared shader toolkit | 71–114 | Hoskins-style hash, quintic gradient noise, periodic noise, rotated-octave fBm, segment SDF | Preserve unless a proven replacement improves output |
| Cosmic interior | 165–235 | two depth-slice nebula flow, variance-preserving crossfade, 4-layer stars, distant galaxies, log-polar forehead vortex | Primary cosmic-material vocabulary |
| Rupture eyes | 237–299 | eye cavity geometry, torn noise rim, inner plasma, temple crack, inner hook, surrounding fracture veins | Do not revert to decal eyes |
| Eye suction streams | 308–335 | quadratic Bézier-like sampled paths from eyes to singularity | Reusable as a controlled “information drain” primitive |
| Matter sheets | 337–397 | stacked domain-warped sheets, perforations, faux normals/specular, stress lighting, embedded stars | Primary matter-material vocabulary |
| Scene composition | 428–482 | egg head, cosmic interior, eyes, band layers, flank stress, shards | Golden identity composition |
| Spacetime lens | 488–550 | signed radial collapse/rebound, frame dragging, shock front, motion trails, horizon, accretion inflow, photon ring | Primary singularity primitive |
| Particles | 552–575 + 839–951 | GPU point/line rendering with CPU orbital/capture simulation | Primary debris/mote motion vocabulary |
| Bloom/composite | 577–634 | mip-like downsample/blur chain, ACES, local chromatic aberration, vignette, grain | Keep separate from main geometry; do not smear the scene |
| Spring bank | 728–747 | independent physical controls for tension, K, radius, suction, stress, band speed, swirl, twist, eyes, spin, fall | This is the key composition interface |
| Golden opening timeline | 765–819 | pre-tension → horizon birth → active → elastic close, with phase clocks integrated over time | Never replace with simple tween/rotate-scale without evidence |
| Blink | 821–837 | 75ms close, 40ms hold, 215ms slower open, 22% double blink | Preserve behavior; geometry can evolve |
| Render pipeline | 1005–1071 | scene FBO → lens FBO → additive particles → 4 bloom mips → final composite | Core production architecture |
| Adaptive quality | 1077–1092 | lowers/raises internal resolution from measured frame cost | Useful but should not be allowed to blur the main effect excessively |

## Why this matters
The Opus result is not “one clever shader”. Its quality comes from the **interaction** of these systems. Future work should therefore reuse combinations of subsystems, not imitate the screenshot.
