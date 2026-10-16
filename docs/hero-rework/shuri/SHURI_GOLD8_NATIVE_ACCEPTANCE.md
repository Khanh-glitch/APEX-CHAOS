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

## Global surface coverage (all required, not selectively checked)

1. **Gold Home and Fighter Pick:** SHURI in canonical product playable roster for P1/P2/BOT, approved original portrait and selected original art; no broken URL or stock/shape fallback. Transition waits until Gold assets are actually usable.
2. **Battle hero:** original core, ponytail, gripping/tool/collector actors, head expression, body motion, HUD glasses and correctly mounted native weapon. No additional synthetic body, no duplicated bullets or gun SFX.
3. **Ability HUD:** Passive/A1/A2 from registry, SHURI imagery, native cooldown/charges, native Scrap balance, build HP/mode. No developer/lab progress HUD replacing Gold HUD.
4. **Field Archive (Dictionary):** all three skill descriptions from same registry/runtime, Gold identity art, 3 skill images, Quick Equip when applicable.
5. **Cosmetics:** default SHURI presentation unchanged; equip/reload does not substitute art with another hero or break mounted gun identity.
6. **Match Result:** SHURI as real fighter owner (P1/P2), correct weapon MVP/HP/damage, no additional 'Gun Rack player'.
7. **BOT mode / rematch:** same skills, no leaked timers, old structures, silent SFX tasks or stale visual world records.

## High-value interruption scenes

- Passive visual ghost disassembles a finished real gun while SHURI picks another; actual gun artwork and ownership never duplicate.
- A1 bomb is silent/inert before the authored landing/arm; confirmed hit plays EMP and **native** stun-confirm once; idle timeout does not.
- A1 recoil against arena wall uses native collision and reflected motion; Gold does not teleport the Fighter.
- A2 can be destroyed at build 2.5/5s; render collapse from the already assembled parts with the Gold source motions and clips.
- Gun Rack fires one already-committed final shot before A1 morph; Arsenal gunshots from real weapon only, not Gold audition `shot1–shot5`.
- Med Station pump audio must correspond to native realized HP; structure HP decreases 1:1. Repair does not charge on incomplete build.
- Gold machine wreck and residue can remain visible after SHURI KO independently of `Fighter.draw`.

## Evidence and release conditions

- `pnpm test:product-graph` and SHURI native/Gold tests must pass on **the exact commit**.
- Full runtime revision lock must be re-established **after implementation stabilizes**, not bypassed. Chrome gameplay, V43, cross-hero, BOT/P1/P2/rematch and Gold fidelity screens are mandatory.
- Gold visuals must pass review at real match scale and have no missing sprite/blank frames; gold visual comparison must use owner Gold (8), not V4/6 or a fake redrawn HTML.
- No merge without explicit owner playtest acceptance.

## SFX rights and credits — publication hold

Gold mixer embeds 40 processed excerpts. Mecha sounds by **Helton Yan**, [Retro Mecha SFX](https://heltonyan.itch.io/retro-mecha-sfx), used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), trimmed/edited/mixed for SHURI. Attribution must be shown in released game credits. Foley sounds by **Chequered Ink**, [400 Sounds Pack](https://ci.itch.io/400-sounds-pack); license document was missing from the uploaded source archive. **Verify the author's distribution/redistribution terms before publicly shipping the audio bundle or enabling download of individual samples.** This document is not proof of permission.
