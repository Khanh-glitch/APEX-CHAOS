# SHURI Gold (8) — Native admission and fidelity acceptance

Status: **DRAFT / NOT MERGEABLE**. The owner’s `shuri-gold-visual-lab (8).zip` plus SHA-checked `SHURI_SFX_ONLY_ADDON.zip` are the visual/audio authority. The battle engine is **not**.

## Authority boundaries

| Authority | May change | Cannot change |
| --- | --- | --- |
| Hero Rework / AIL | cooldown, stun, collision, HP, positions and cast acceptance | Gold rig, image pixels, timelines or SFX recipes |
| Arsenal | weapon classification, actual fire/projectiles/ownership, public pickup transaction | Gun Rack lab audition bullets or Gold fake gun mechanics |
| Gold 8 presentation | original rig, choreographies, visual-only bomb/structure, 40 audition/mixed OGG clips | real player health, damage, Scrap, projectile spawning, pickup rights |
| Gold UI / Product roster | SHURI canonical ID & approved original raster roles | donor art substitution, a second menu or HUD |

**Never replace** Gold's original `render.ts`, `rigging.ts`, `rig.ts`, `rig.json`, or the already-authored images. Native bridge excludes Gold's separate arena/training dummy only. Original WebP from Gold are mirrored byte-exact under `public/assets/gold-ui/heroes/shuri/source/`; no generated face/artwork.

Gold’s 120-Hz script has native anchor beats: bomb placement 0.40s, arm 0.47s, recoil 0.52s and machine signal 0.72s. Native expiry is NOT an unsolicited discharge. Recycle Scrap settles on the original compressor beat; playback never grants the resource itself.

## Owner update 2026-10-17 — native skill law (runtime `20261017-shuri-rework-r3`)

- **Passive (unchanged intake):** a gun/launcher Holder that completes in SHURI’s own hands recycles for Scrap equal to its tier on the 3s compressor beat.
- **A1 no longer switches the machine.** The Gold 0.72s self-morph remains inside the immutable library but is neutralized by the adapter, which owns the visual machine form from native state every sync. A shocked enemy holding a gun/launcher (T1–T5 incl. V43 specials) is disarmed through the canonical Arsenal `consume('shuri-a1-disarm')`; the stolen gun enters the same recycle queue and pays its tier in Scrap.
- **A2 is one contextual cast** resolved by a single branch resolver: build (20 Scrap at the A1 anchor) → while holding a gun/launcher, mark it to **mount the rack when its current Holder completes** (an interrupted Holder cancels the mark; the donated first magazine is free) → unarmed and hurt inside the operating range, enter the **recovery hold** (below) → otherwise efficient repair (spends only absorbable Scrap, `ceil(missing/10)`).
- **Gun Rack auto-turret:** the mounted gun re-seats forever; every reload pays Scrap equal to its tier before the fresh Holder may advance. Out of Scrap the rack is starved — the gun stays mounted and visible, inert, and auto-resumes when Scrap returns. A new donation replaces the mounted gun without Scrap.
- **One operating range:** 200 measured from the structure circumference (275 from its centre at radius 75). It gates only READY target acquisition and recovery admission; a magazine already firing always finishes.
- **Recovery hold:** free heal 20 HP/s, SHURI position-locked, machine off (no firing; the mounted gun sinks in with the authored med morph visual). Exits: full HP, leaving range, realized damage to SHURI or the structure, A1 cast, or A2 again (manual cancel, cooldown consumed). The old structure-HP-for-heal exchange law is deleted.
- **No floor interaction:** the rack never sucks or consumes floor guns; the retired suction/intake registrations and all morph/mode native state are removed, not layered over.

## Motion fidelity acceptance (2026-10-17)

- The adapter measures native fighter velocity and feeds velocity, position and aim target into the Gold world **before** substeps (position is restored exactly after stepping). Gold’s hair chain, head lean/tilt and glance are velocity-driven: teleport-only feeding starved them (hair-tip excursion 7.2, lean 0 in Gold-world simulation) versus velocity-fed (37.6, lean 3.38). `tools/testShuriGoldIntegration.mjs` guards this numerically.
- Grip/tool/collector adherence firms up with movement speed by scaling their spring `k0` (Gold derives damping as `2·z·√k`, so the damping ratio is unchanged — tighter tracking, never rigid; at rest the authored loose float is fully preserved). Simulated tracking lag while running drops ~45%.
- The electric bomb is drawn centred: the authored `bomb.webp` body sits at sprite (−25.5, +27.5) px from its 123×122 canvas centre (measured from alpha), so the adapter compensates the rotated offset around rendering only. Gold state/task math is never touched; the Gold library remains byte-immutable.

## Playtest fix round 2026-10-17 (runtime `20261017-shuri-rework-r4`)

Owner playtest of r3 produced nine findings; all were presentation-layer except one cosmetic-authority gap. Native skill law is unchanged.

- **Rack gun bound to the head frame (findings 1, 5, 8):** the adapter now owns the rack-head angle with Gold’s own authored springs (aim k55/z.7; idle sway k30/z.8 toward −π/2+sin(t·.6)·.5) and writes it into Gold `headAng`, so the Gold ring and the native mounted gun share one pivot and one angle — sway stays lively, the gun can no longer orbit the hub, and long barrels cross the hub like the authored rack gun (the “clipped muzzle” was the hair-thin barrel vanishing against the pale plate plus a 0.78r orbiting centre; no clip rectangle ever existed). Arsenal pose/recoil still owns kickback; the pose is merely re-solved on the hub, and native meta is restored after the draw. `shuri:rack-mount` flies the native skinned sprite hand→hub in 0.55 s and spins a replaced gun away (authored `gunfly`/`gundrop` timing) instead of teleporting it onto the rack. Gold’s internal gunfly is never enabled (it would fly tier art and charge native structure HP).
- **Emitter cosmetics (finding 4):** `cosmeticAuthority.sideOf` resolves a remote weapon emitter through `__arsenalEmitterOwner` — the same seam projectile capture already used — so the player’s equipped weapon skin renders on the rack gun and on its transfer flights.
- **Recycle visual queue (finding 2):** a `shuri:recycle-start` arriving while a Gold snap is still running now queues (max 3) and flushes when the snap ends; Gold `startRecycle` silently dropped it while `w.snap` was active, stranding the visual.
- **Satellite adherence + hair (findings 6, 7):** machine spring *states* are delta-carried by SHURI’s exact frame movement (tool exempt during its world-anchored repair task), so the authored local float/overshoot is preserved while the frame of reference follows her — no more stranded collector; the speed-firmness curve is stronger (norm 650, ≤~6.2×, collector extra ×1.35). Hair velocity is shaped fast (16/s) and fed ×1.6: Gold’s chain is excited by per-substep velocity deltas, and slow blends erased the whip of short combat bursts. Adapter-numeric A/B at 560 px/s: hair-tip deflection −45.6 → −71.8 asset px (+57 %, matching the standalone Gold law), collector distance during glide 110 → 103 px (idle formation 102 px).
- **Bomb debris (finding 3):** the authored bomb canvas carries a disconnected 583 px dark strip above the 3653 px body — the owner-visible “black bar”. With the Gold library immutable, the adapter cleans its own loaded copy via alpha connected-components (largest component plus bound-overlapping detail) and regenerates `sil.bomb` the Gold way (blur 7, pad 18). Body pixels and the centre compensation above are untouched.
- **Arena floor (finding 9):** default `graphite-mid` chamber palette darkened one notch toward `graphite-dark` (base `#626A74` → `#4E565F`, family shifted in step; sampled floor luminance 105 → 85).

## Global surface coverage (all required, not selectively checked)

1. **Gold Home and Fighter Pick:** SHURI in canonical product playable roster for P1/P2/BOT, approved original portrait and selected original art; no broken URL or stock/shape fallback. Transition waits until Gold assets are actually usable.
2. **Battle hero:** original core, ponytail, gripping/tool/collector actors, head expression, body motion, HUD glasses and correctly mounted native weapon. No additional synthetic body, no duplicated bullets or gun SFX.
3. **Ability HUD:** Passive/A1/A2 from registry, SHURI imagery, native cooldown/charges, native Scrap balance, build HP, mounted-gun and recovery state. No developer/lab progress HUD replacing Gold HUD.
4. **Field Archive (Dictionary):** all three skill descriptions from same registry/runtime, Gold identity art, 3 skill images, Quick Equip when applicable.
5. **Cosmetics:** default SHURI presentation unchanged; equip/reload does not substitute art with another hero or break mounted gun identity.
6. **Match Result:** SHURI as real fighter owner (P1/P2), correct weapon MVP/HP/damage, no additional 'Gun Rack player'.
7. **BOT mode / rematch:** same skills, no leaked timers, old structures, silent SFX tasks or stale visual world records.

## High-value interruption scenes

- Passive visual ghost disassembles a finished real gun while SHURI picks another; actual gun artwork and ownership never duplicate.
- A1 bomb is silent/inert before the authored landing/arm; confirmed hit plays EMP and **native** stun-confirm once; idle timeout does not. A shocked gun-holder is disarmed with no pose ghost, and the stolen gun pays Scrap only on the compressor beat; a shocked non-gun holder keeps their weapon.
- A1 recoil against arena wall uses native collision and reflected motion; Gold does not teleport the Fighter.
- A2 can be destroyed at build 2.5/5s; render collapse from the already assembled parts with the Gold source motions and clips.
- A marked gun that gets disarmed/destroyed before completion never mounts and pays no Scrap; a completed marked gun mounts instead of paying Passive Scrap (never both).
- Rack target leaves the operating range mid-magazine: the magazine finishes; the next acquisition waits for a target inside 200-from-circumference. A starved rack keeps its gun visibly mounted and resumes by itself when Scrap returns.
- Recovery pump audio must correspond to native realized HP; any realized damage to SHURI or the structure releases the hold immediately. Repair does not charge on incomplete build and never spends unabsorbable Scrap.
- Arsenal gunshots come from the real mounted weapon only, not Gold audition `shot1–shot5`.
- Gold machine wreck and residue can remain visible after SHURI KO independently of `Fighter.draw`.

## Evidence and release conditions

- `pnpm test:product-graph` and SHURI native/Gold tests must pass on **the exact commit**.
- Full runtime revision lock must be re-established **after implementation stabilizes**, not bypassed. Chrome gameplay, V43, cross-hero, BOT/P1/P2/rematch and Gold fidelity screens are mandatory.
- Gold visuals must pass review at real match scale and have no missing sprite/blank frames; gold visual comparison must use owner Gold (8), not V4/6 or a fake redrawn HTML.
- No merge without explicit owner playtest acceptance.

## SFX rights and credits — publication hold

Gold mixer embeds 40 processed excerpts. Mecha sounds by **Helton Yan**, [Retro Mecha SFX](https://heltonyan.itch.io/retro-mecha-sfx), used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), trimmed/edited/mixed for SHURI. Attribution must be shown in released game credits. Foley sounds by **Chequered Ink**, [400 Sounds Pack](https://ci.itch.io/400-sounds-pack); license document was missing from the uploaded source archive. **Verify the author's distribution/redistribution terms before publicly shipping the audio bundle or enabling download of individual samples.** This document is not proof of permission.
