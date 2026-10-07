# R59 Owner Checkpoint — STOP POINT — 2026-10-07

This is a docs-only stop checkpoint. Do not continue feature work from assumptions outside this file.

## Branch / stop point

- Branch: `arena/01a10c3e-apex-chaos`
- Product HEAD immediately before this checkpoint: `9f63a03c172589c5dcd8c22adb7d197bb1e8ac12`
- Recovery-session baseline: `f8be073654bdc7d3518274747dd280518cd764d5`
- Gold BOT and Gold Local are DIFFERENT authored Battle-HUD layouts.
- Never "fix" BOT by replacing it with Local geometry.
- Do not use whole-HUD scaling or skill zoom as a responsive fix.
- One writer per branch. Other agents should be read-only or use another branch.

## Owner-accepted / do not revisit unless a regression is observed

- ROBOT vs ROBOT J/K causing A2 visual on both sides: fixed.
- Local P2 ability trigger: fixed.
- Magnet missing battle visual: fixed.
- Post-match return / quick rematch flow: accepted.
- Phone HUD major empty-space issue: no longer a priority.
- Lucky Draw reel silhouette -> real art reveal: accepted for now.
- Home real AC / 12,000 AC seed: accepted.
- Background/foreground/tab-switch audio layering: accepted.
- Frost Pick scale ~1.53: accepted; do not enlarge again.
- Gold battle-entry transition works; owner may request aesthetic polish later.

## Implemented since latest owner playtest — requires owner verification

### 1. Local / BOT / iPad Battle HUD
- Battle mode is now live production truth every frame, not only a one-shot handoff.
- This specifically targets the bug: play Local first -> enter BOT -> HUD remains Local-like.
- Local tablet received a dedicated allocation tier: more weapon space and a shorter HP read.
- BOT keeps canonical Gold geometry.
- BOT tablet skill media uses square art wells + `object-fit: contain` so landscape skill images should no longer be stretched.
- Portrait tablet BOT received more strip allocation to reduce weapon/footer clipping.

Owner should test:
- iPad Local: gun should not feel tiny; HP should not feel absurdly long.
- Home -> BOT directly.
- Local -> BOT -> Local -> BOT.
- BOT iPad with both portrait and landscape skill art.
- Both BOT weapon areas at multiple aspect ratios.

### 2. BOT intelligence — "can cast" is NOT "knows how to use"
Contextual AI policies now exist for:
- Robot:
  - A1 requires a real eligible pickup.
  - A2 requires a real threat: incoming projectile or armed rival in fighting range.
- Magnet:
  - A1 waits for an eligible firearm/projectile influence target.
  - A2 waits for a real body/gun/projectile target.
- Frost:
  - casts now depend on authored lane/reach geometry.
- Mirror:
  - A1 does not deliberately whiff without a copyable weapon.
  - Mirror tactical context has dedicated gameplay gates.

Acceptance rule:
- Idle / irrelevant situation -> BOT should preserve cooldown.
- Useful tactical situation -> BOT may spend cooldown.
- Cast counts alone are not evidence of intelligence.

Still not fully reviewed:
- Hunter and Crystala need the same contextual review before "Core Six BOT AI" can be called complete.

### 3. SFX first-use
- First-use hero SFX now warm through an awaited readiness contract before battle live.
- Improvement was observed by owner, but owner explicitly wants more observation.
- Do not mark final until repeated cold-start playtests show first-use cues no longer lag.

### 4. Theme music at boot
Root race identified and fixed:
- React previously attempted to bind music before the Tier-1 music runtime existed.
- Home is now announced immediately after Tier-1 runtimes finish while the boot transition still covers the page.
- If the browser permits audible autoplay, music should begin without waiting for the first game button.
- If the browser explicitly blocks autoplay (`NotAllowedError`), first-gesture unlock is browser policy and must not be confused with game logic.

### 5. Frost Pick
- Scale remains `1.53`.
- Frost source art uses hero-specific reverse facing (`flip:true`) instead of generic side facing.
- Vertical anchor moved lower: `y:16 -> y:23`.
- Owner still needs to verify both sides visually against multiple other heroes.

### 6. Skill cooldown / active state readability
- Cooldown now has strong blackout/progress treatment + remaining seconds.
- Active state has accent edge/glow + active-duration progress.
- No skill zoom or layout reflow was introduced.
- Owner should verify the state is obvious at a glance during combat.

### 7. Lucky Draw bottom button press
- Press stays dark metal.
- Slight compression + subtle orange border/glow.
- Text forced visible.
- No full orange fill.
- Owner should verify tactile feel.

### 8. Magnet A2 outer-screen vector
Root cause fixed:
- capture VFX previously read `nx/ny` from a plan that never stored them.
- That became `(0,0)`, and `atan2(0,0)` produced a 0-degree horizontal corridor for every reflection.
- Capture telemetry now publishes the real field-entry normal/tangential direction.
- Multi-origin direction gates were added.

Owner should fire/reflect from left, right, top and diagonal and verify the outer effect changes direction accordingly.

### 9. Magnet / Frost slow battle entry
Why these two were slower:
- Magnet: many independent image/decode jobs and multiple visual channel variants.
- Frost: fewer source images, but expensive canvas mip-chain/preprocessing and presentation surfaces before first live frame.
- Raw MB alone was not the cause.

Changes now present:
- Selected fighter intent warms/decodes that hero's battle rig while the player is still in Pick.
- Gold/runtime stale R50K cache keys were removed and gated.
- Frost presentation now builds Gold mip art during battle readiness instead of first live frame.
- Magnet Gold exposes asset completion as an awaitable transition-readiness promise.
- Battle reveal now waits for selected Frost/Magnet presentation readiness.

Do NOT reduce Frost resolution/VFX/mip quality before profiling.

### 10. Crit / Heavy hitch + cinematic FX
- Full-screen shake/flash targets the full Battle HUD compositor.
- Heavy keeps its full visual system: Voronoi shards, panel snapshots, SVG turbulence/displacement, spectral ghosts, flash and shake.
- DOM construction for Heavy shards/spectral ghosts is now batched off-tree and appended once.
- This removes repeated live-DOM commits WITHOUT reducing visual count or quality.

Status: optimization landed, but hitch is NOT declared solved. Owner/perf observation still required.

## Current highest-priority verification sequence

1. iPad Local Battle HUD proportions.
2. Local -> BOT state transition; repeat twice.
3. BOT iPad with horizontal skill art.
4. BOT weapon/footer clipping at several ratios.
5. Frost Pick both sides vs 2-3 different heroes.
6. Robot BOT: start with no gun/no threat; A1/A2 should not fire pointlessly.
7. Magnet BOT: empty field should preserve cooldown; add real targets and confirm response.
8. Frost/Mirror BOT: verify casts happen for understandable tactical reasons.
9. Magnet A2 reflect from multiple incoming angles.
10. Cold boot: theme before first in-game button when browser autoplay permits.
11. Cold first-use SFX for multiple heroes.
12. Repeated Crit/Heavy impacts; judge hitch without sacrificing quality.
13. Only after the above: full cross-device / full-game audit.

## Still OPEN after this checkpoint

- iPad Local composition acceptance.
- BOT iPad horizontal skill-art acceptance.
- BOT footer clipping acceptance.
- Local -> BOT state-leak acceptance.
- Hunter/Crystala BOT tactical AI review.
- First-use SFX repeated cold-start acceptance.
- Theme boot behavior verification under the owner's real browser autoplay policy.
- Frost Pick final visual acceptance.
- Skill-state visual acceptance.
- Lucky Draw press visual acceptance.
- Magnet A2 directional VFX live acceptance.
- Magnet/Frost cold-entry timing measurement after readiness work.
- Crit/Heavy performance measurement after DOM batching.
- Battle-entry transition aesthetic polish if owner wants it.
- Final full-game / all-ratio audit.

## Explicitly superseded old conclusions

- "BOT panel = Local panel" is WRONG and superseded.
- "BOT AI is done because A1/A2 both cast" is WRONG and superseded.
- Old phone occupancy measurements made under the wrong BOT=Local architecture are not valid BOT acceptance.
- "SFX cached" alone is not proof first-use latency is solved.
