# APEX CHAOS // ARSENAL QUEST — CHAT HANDOFF

**Handoff date:** 2026-09-24  
**Purpose:** transfer the important project state into a new ChatGPT conversation without re-deriving decisions.  
**Repository:** `Khanh-glitch/APEX-CHAOS`

---

# 1. WORKING ROLES / PROCESS

The owner wants strict role separation:

- **ChatGPT = product lead / creative director / technical reviewer.**
- **Arena/Coding Agent = implementer.**

Do not jump in and code/fix runtime/build tasks unless the owner explicitly asks.

If Agent work is interrupted or ambiguous:
1. read the full Agent report/log;
2. inspect branch/SHA/diff/runtime evidence;
3. identify done vs unfinished;
4. preserve good work;
5. diagnose spec vs implementation vs environment;
6. write a precise continuation/recovery prompt;
7. let Agent continue;
8. independently audit result;
9. only then advance owner playtest branch.

The owner cares more about **actual playable visual quality / feel** than green QA. Passing tests are evidence, not proof of fun, beauty, impact or readability.

Communication style:
- Vietnamese;
- concise but substantial;
- direct product judgment;
- do not defend failed ideas;
- avoid gratuitous complexity.

---

# 2. PRODUCT THESIS

Mode/project:

**APEX CHAOS // ARSENAL QUEST**

Core fantasy:

> **The fighter creates the opportunity. The weapon delivers the payoff.**

Core loop:
- 2 fighters use existing Apex Chaos auto-movement/bounce law;
- weapons spawn randomly;
- first eligible fighter touching a revealed weapon equips it;
- weapons are temporary/consumable;
- no weapon-seeking AI;
- multiple weapon slots may coexist;
- an armed fighter normally cannot pick another weapon;
- eventual direction is offline PvE/quest/progression, but current work is focused on 1v1 combat feel.

Desired “wow”:
- understood in ~5–10 seconds;
- visually legible;
- emergent/unpredictable;
- GIF/TikTok friendly;
- fun before progression;
- feasible for small/solo development;
- reuse existing Apex engine rather than reinventing it.

---

# 3. VERIFIED GIT STATE — 2026-09-24

## main

`main` SHA:

`ee4420f27882bc0ea15a844a0fc915d1af43c426`

**Do not modify main without explicit owner approval.**

## Arena branch

`arena/01a0cf5e-apex-chaos`

Verified HEAD before this handoff file:

`261c29f29cc199bb9596955cb3b487bcce9bd261`

Checkpoint B gameplay owner-playtest baseline:

`16b62f15b7c44f0005326f6a67d3f1a6ddefe0f2`

Important: Arena is ahead of B by docs/evidence commits only; **no Checkpoint C gameplay implementation is approved/shipped yet**.

Post-B docs include:
- `V2_CHECKPOINT_C_IDENTITY_COMBAT_DIRECTION.md`
- `C1_FREE_ASSET_SHORTLIST.md` (old 3D-first research, now superseded for weapon art)
- `C1_FREE_2D_ASSET_SHORTLIST.md` (current 2D-first weapon research)

## Playtest branch

`playtest/arsenal`

Verified SHA:

`16b62f15b7c44f0005326f6a67d3f1a6ddefe0f2`

Keep frozen until a reviewed C build is ready.

## Cloudflare Pages workflow

Cloudflare Pages is connected to Git and auto-deploys the playtest branch.

Desired workflow:
1. Agent works on Arena branch.
2. ChatGPT audits.
3. If owner-playtest-ready, fast-forward `playtest/arsenal` once.
4. Cloudflare deploys one build.
5. Owner refreshes stable URL.

Do not deploy every Agent commit.  
Do not create Windows ZIP for routine playtests.  
ZIP = milestone/release only.

---

# 4. ISSUE STATUS WARNING

Several completed issues remain open. Open state does not mean unfinished.

Relevant:
- #1 core Arsenal mode — historical/completed
- #2 AV integration — historical
- #4 Windows packaging — historical milestone
- #5 Checkpoint A — completed
- #6 Checkpoint B — completed
- #7 duplicate B issue created by Agent — ignore
- #8 Checkpoint C1 style proof — **open but its original Agent-led art-direction workflow is superseded**

Critical process correction:
**Do not send Issue #8 to Agent as-is.**
Owner does not trust Agent to choose art direction. Creative direction must be ChatGPT + owner; Agent only implements a locked reference/spec.

---

# 5. CANONICAL P0 WEAPONS

Ranged:
1. PISTOL
2. SHOTGUN
3. SMG
4. SNIPER
5. GRENADE

Melee:
6. SABRE
7. BATTLE_AXE
8. DAGGER
9. SPEAR
10. SPIKED_CLUB

Defense:
11. SWIRL_SHIELD
12. TOWER_SHIELD

Current config highlights:
- MATCH_HP = 100
- FIGHTER_SPEED = 520
- SPAWN_CADENCE_SECONDS = 4.5
- FIRST_SPAWN_DELAY_SECONDS = 1.0
- REVEAL_CIRCLE_RADIUS = 42
- REVEAL_LEAD_SECONDS = 2.0
- FORCE_REVEAL_AGE_SECONDS = 3.0
- MAX_ACTIVE_SLOTS = 8
- PICKUP_LIFETIME_SECONDS = 20

Current weapon tuning is prototype-only:
- Pistol: 3 shots, 0.22s interval, 4.5 dmg/shot, speed 780
- Shotgun: 8 pellets, 3.6 dmg/pellet, speed ~640
- SMG: 8 shots, 0.085s interval, 2.4 dmg/shot, speed 820
- Sniper: 0.8s aim, 26 dmg, speed 1450
- Grenade: throw 540, fuse 1.4s, blast radius 155, max dmg 20
- Sabre 12 dmg
- Battle Axe 26 dmg
- Dagger 9 dmg
- Spear 15 dmg
- Spiked Club 18 dmg + stun
- Swirl Shield reflect duration 8
- Tower Shield duration 2.8, damage taken ×0.25, speed ×0.55

Owner says game balance is still not good.

---

# 6. 32-FIGHTER ROSTER

Canonical:
RUBBER, ICE, VAMPIRE, STRING, VOLCANO, MAGNET, FLASH, ELECTRIC, ORBIT, TOXIC, MIRROR, BLACK_HOLE, SAW, BLADE, NOVA, HUNTER, CRYSTAL, VIRUS, DRUM, CARD, MATH, MATH_V2, SNIPER, SLIME, TIME, WOLF, WIND, WITCH, PIRATE, PAINTER, MONK, SUPERSTAR.

Live identity aliases discovered:
- NOVA -> GALAXY
- WIND -> PUPPET
- MONK -> KUNGFU

Checkpoint B compatibility:
- 30 KEEP
- 2 ADAPT: VAMPIRE, MONK/KUNGFU
- rage suppressed roster-wide

Specific B adaptations:
- VAMPIRE latch -> 2.5s
- MONK/KUNGFU rush/pin -> 2.5s

History:
- Checkpoint A made roster too inert by disabling kits.
- Checkpoint B restored compatible native kits.
- Owner B playtest then found native damage too strong, overshadowing Arsenal weapons.

Current Checkpoint C rule:
- preserve fighter identity;
- normalize fighter lethality;
- native kits should primarily create setup/control/mobility/sustain/defense/positioning;
- Arsenal weapons own the lethal payoff.

Initial design target:
- Arsenal weapons ~70–80% meaningful direct damage
- native kit ~20–30%

Not implemented yet.

---

# 7. CHECKPOINT A SUMMARY

Hard law:

`fighter movement direction != weapon aim direction`

Weapon aim/recoil/thrust/spin/swing/guard must not rewrite normal fighter movement.

A also:
- enabled independent P1/P2 selection from 32 fighters;
- disabled generic orange/blue slash/swipe VFX;
- retained grenade explosion/muzzle flash.

A’s strict centerline reveal was rejected by owner and replaced in B.

---

# 8. CHECKPOINT B — SHIPPED / VERIFIED / PLAYTESTED

Gameplay implementation commit:

`3ef1aea76126d1d9ee4117f0cab01ff3f5d26044`

CI run:

`35973561501`

Verified:
- completed
- success
- run head SHA = `3ef1aea...`

Final owner-playtest SHA:

`16b62f15b7c44f0005326f6a67d3f1a6ddefe0f2`

Agent reported:
- headless 90/90
- Chrome 69/69
- 5-minute mixed-fighter stress with no uncaught errors

B spawn/reveal:
- spawn cadence 3.0s -> 4.5s
- reveal uses whole visible 42px question-mark circle, not center
- movement-trigger lead = 2.0s
- no reveal before wall bounce
- hidden slot force-reveals after 3.0s
- force reveal != auto-pickup
- identity hidden before reveal

B motion architecture:
- Pistol: 3 recoil pulses
- Shotgun: heavy recoil
- SMG: 8 micro pulses
- Sniper: aim/flourish/snap/recoil
- Grenade: draw/throw
- Sabre: backswing/strike
- Axe: heavy windup/strike
- Dagger: weapon-only thrust
- Spear: longer weapon-only thrust
- Club: backswing/smash
- Swirl Shield: settle/reflect pop
- Tower Shield: guard/block response

No weapon motion should steer fighter body.

---

# 9. OWNER PLAYTEST FEEDBACK AFTER B — CURRENT ROOT PROBLEM

Owner says:

1. weapon image assets look bad / visually irritating;
2. SFX selection is weak, especially melee;
3. weapon movements are technically present but not iconic, exciting or viewer-triggering;
4. fade-out after use looks cheap;
5. grenade pickup/equipped visual differs from thrown grenade;
6. native fighter skills deal too much damage and overshadow weapon fantasy;
7. current battlefield is not designed for Arsenal;
8. bullets look strange, slow and toy-like; balance is poor.

Conclusion:

**Do not proceed straight to UI polish.**

Problem = no unified visual/combat identity.

---

# 10. CHECKPOINT C — CURRENT DESIGN DIRECTION

Source of truth:

`docs/arsenal-quest/V2_CHECKPOINT_C_IDENTITY_COMBAT_DIRECTION.md`

Checkpoint C = **ARSENAL IDENTITY & COMBAT FEEL**

Checkpoint D later = full UI/UX.

North star:

> **The fighter creates the opportunity. The weapon delivers the payoff.**

Creative directions explored:

A. Tactical Test Chamber
- clean
- premium
- highly readable
- graphite tactical lab

B. Gladiator Arsenal Show
- theatrical
- clip-friendly
- stronger signature beats

C. Brutal Scrap Arena
- heavy
- raw impact
- excellent for heavy melee/shields/shotgun/grenade

Recommended working direction:

**Hybrid A + B + C**
- world/readability = A
- showmanship/iconic beats = B
- impact weight = C

Working arena name:

**ARSENAL FIELD TEST // CHAMBER 01**

---

# 11. CREATIVE PROCESS — HARD RULE

Owner rejected Agent-led art direction.

Do NOT ask Agent:
- which style is best;
- which asset pack looks best;
- what arena should look like;
- how to make motion iconic.

ChatGPT + owner decide:
- visual direction;
- asset family;
- color/contrast;
- motion signatures;
- audio personality;
- arena composition;
- exact implementation spec.

Agent later only:
- uses named assets;
- wires renderer;
- implements exact animation/collision/audio;
- runs QA/evidence.

Agent must not invent a new style.

---

# 12. OWNER’S CURRENT ART PREFERENCE — VERY IMPORTANT

**Native 2D first.**

Preferred:
- non-pixel;
- bold/crisp linework;
- strong silhouette;
- high local contrast;
- clearly separated weapon colors/classes;
- saturated, visually exciting accents;
- transparent PNG or SVG/vector ideal;
- usable while rotating toward target.

Rejected / low priority:
- washed-out art;
- grey-on-grey / samey palettes;
- low-poly 3D as default;
- realistic-photo military cutouts;
- pale/desaturated rendering;
- tiny inventory icons;
- pixel art for main weapon set.

Owner specifically says 3D sources often feel pale/samey and wants 2D with firmer lines, stronger contrast and more color distinction.

Scope correction:

**GUN FAMILY, not Pistol-only.**

When judging gun art, show at least:
- compact/automatic: SMG / compact rifle
- heavy/close: Shotgun
- long: Sniper / rifle

from one visual family.

---

# 13. CURRENT FREE 2D ASSET RESEARCH

Current source of truth:

`docs/arsenal-quest/C1_FREE_2D_ASSET_SHORTLIST.md`

This supersedes `C1_FREE_ASSET_SHORTLIST.md` for weapon art.

## Gun candidates

### senko_otter — weapon 2d models pack
https://senko-otter.itch.io/weapon-2d-models

- native 2D vector
- SVG
- free-use stated by author
- latest listing showed ~21 weapons + skins
- easy to recolor/reprocess

Status: audition candidate, not auto-approved.

### ItzNinjaFool — 2D Gun Pack
https://opengameart.org/content/2d-gun-pack

- 2D
- CC0
- guns/rifles/grenades
- potentially good for gun + grenade continuity

Status: candidate.

### Kay Lousberg — CRITICAL CORRECTION
https://kaylousberg.itch.io/gun-assets

- CC0
- PNG/@2x/SVG
- pistol/revolver/shotgun/sniper/SMG/AR + grenade/accessories

BUT:

**This is already the source family used by the current P0 gun atlas.**

Owner dislikes current result aesthetically.

Therefore:
- do not present Kay as a new solution;
- keep only as baseline/reference/fallback;
- next source must beat it substantially.

This corrects an earlier recommendation that mistakenly suggested downloading Kay again.

## Battle Axe

### Kutejnikov — Axes
https://opengameart.org/content/axes-0

- native 2D
- hand-painted
- CC0
- high-res PNG
- multiple battle variants

### RGSDev — Free CC0 Melee Weapon Vector Sprites
https://opengameart.org/content/free-cc0-melee-weapon-vector-sprites

- CC0
- customizable vector construction
- fallback for style normalization

## Shields

### CraftPix — Free Shield 2D Game Assets Pack
https://craftpix.net/freebies/free-shield-2d-game-assets-pack/

- vector / PNG
- many shield variants
- stronger color separation
- CraftPix royalty-free license, not CC0; preserve terms

## Grenade

First preference:
- grenade from the **winning gun family** to preserve continuity.

Backup/reference:

### Selfish_babu — Cartoon Characters and Objects Vector Pack
https://opengameart.org/content/cartoon-characters-and-objects-vector-pack

- CC0
- colorful vectors
- includes gun/bomb/grenade

---

# 14. ASSET-SELECTION TASK IS NOT FINISHED

Owner does not want 20 unrelated links and to be forced to choose.

Owner wants ChatGPT to select a **small coherent download set** that is:
- free / commercially usable;
- 2D-first;
- high contrast;
- bold/firm lines;
- visually related;
- not wildly different pack-to-pack;
- assessed as a gun family, not one pistol;
- clearly better than the current Kay baseline.

Do not assume the previous “download Kay + SunGraphica + senko” recommendation is final. Kay is already the rejected baseline.

Next chat should continue research and produce a tighter decisive set, ideally at most ~1–2 source families after controlled reprocessing.

---

# 15. CURRENT CODE-LEVEL PRESENTATION PROBLEMS

## Bullets

Current Arsenal gun projectile is an outlined ellipse with bright dot.

Current speeds:
- Pistol 780
- Shotgun ~640
- SMG 820
- Sniper 1450

Owner says slow/toy-like.

C first-pass target idea:
- Pistol ~2400–2800 px/s
- SMG ~2800–3400
- Shotgun ~2200–2800 with short life
- Sniper ~5000–6500 or hitscan/swept ray

If speed increases, use **swept/continuous collision**. Do not fix tunneling by enlarging projectiles.

Visual target = tracer/streak, not floating balls.

Not implemented yet.

## Fade-out

`arsenalPresentationRuntime.js` has `drawPoseGhost()` with alpha fade.

Owner dislikes this.

New rule = physical exit:
- eject
- toss
- spin off
- ricochet
- drop
- collapse/retract
- alpha only in final cleanup

## Grenade mismatch

Floor/equipped grenade = atlas sprite.  
Thrown grenade = procedural generic green circle.

Hard future rule:

**floor pickup == equipped object == thrown object**

Same canonical grenade sprite in flight; may rotate/blink.

## Arena

Arsenal still uses base Apex background.

Future C arena:
**ARSENAL FIELD TEST // CHAMBER 01**

Desired:
- dark graphite/charcoal;
- restrained range/grid markings;
- clear bounce walls;
- neutral pickup projection;
- low-contrast background;
- weapon/fighter/projectile dominant;
- no fake pickup-like decoration;
- no neon soup.

---

# 16. MOTION DIRECTION AFTER B

Universal grammar:

1. anticipation
2. commit
3. impact
4. physical recovery/exit

Not:

`small transform -> spring -> fade`

Signature targets:
- Pistol: 3 crisp punctuation beats
- Shotgun: one huge body-punch recoil
- SMG: progressive climb
- Sniper: controlled ceremony -> violent single shot; avoid goofy spin
- Grenade: wind-up -> visible release -> same sprite spinning in flight
- Sabre: elegant draw-cut
- Axe: hang -> crush -> stuck/yank
- Dagger: needle-fast retract/thrust/yank
- Spear: long line/retract
- Club: deep swing-through/blunt rebound
- Swirl Shield: catch -> reject
- Tower Shield: plant -> absorb -> withdraw/fall

These are creative targets, not implemented final motion yet.

---

# 17. AUDIO / SFX DIRECTION

Current AV mainly uses:
- Kenney Impact Sounds
- Kenney RPG Audio
- Kenney Sci-Fi Sounds
- OpenGameArt gunshot/muzzle/explosion/slash sources

Owner especially dislikes melee SFX.

Desired event grammar:
1. motion/whoosh/mechanism
2. transient/attack onset
3. contact/body impact

Melee:
- Dagger = thin fast air + sharp contact
- Sabre = clean metallic air + bright contact
- Spear = directional thrust + hard puncture
- Axe = slow heavy air + chop + low body
- Club = dull heavy whoosh + blunt thump

Guns:
- Pistol = short dry crack
- SMG = repeated compact crack, short tails
- Shotgun = broad low transient + rack
- Sniper = sharp crack + restrained low tail, chamber separate

Avoid native fighter “skill” audio muddying Arsenal weapon audio.

---

# 18. SONNISS GDC 2026 — LARGE AUDIO LIBRARY WORKFLOW

Owner has **five large Sonniss GDC 2026 ZIP/folders** and does not want to upload them.

Correct method:

**Do not upload the five ZIPs.**

Use manifest curation:
1. keep ZIPs on owner PC;
2. read ZIP directory table only;
3. export path/name/extension/size CSV;
4. upload CSV;
5. ChatGPT filters candidate sounds;
6. owner extracts shortlisted subset;
7. audition;
8. choose final Arsenal SFX Core Library.

PowerShell:

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem

$rows = @()

Get-ChildItem -Filter *.zip | ForEach-Object {
    $zipPath = $_.FullName
    $zipName = $_.Name

    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)

    foreach ($entry in $zip.Entries) {
        if ($entry.Length -gt 0) {
            $rows += [PSCustomObject]@{
                ZIP       = $zipName
                Path      = $entry.FullName
                FileName  = $entry.Name
                Extension = [System.IO.Path]::GetExtension($entry.Name)
                SizeMB    = [math]::Round($entry.Length / 1MB, 3)
            }
        }
    }

    $zip.Dispose()
}

$rows | Export-Csv ".\sonniss_manifest.csv" -NoTypeInformation -Encoding UTF8
Write-Host "DONE -> sonniss_manifest.csv"
```

Likely filters:
- gunshot/firearm/rifle/shotgun/SMG/sniper
- reload/chamber/bolt/rack/mechanism
- sword/blade/axe/club/spear
- whoosh/swing/thrust
- metal/impact/body/hit
- grenade/explosion/debris
- shield/clang/ricochet

Do not import raw Sonniss bundles into Git. Preserve license with selected sounds.

---

# 19. CURRENT P0 ASSET PROVENANCE

Current weapon atlas:
- gun family: **Kay Lousberg 2D Guns**
- melee/shield family: **JoeRaig Ancient Armory**

Files:
- `public/assets/arsenal/weapons/arsenal_p0_weapon_atlas.png`
- `public/assets/arsenal/weapons/arsenal_p0_weapon_atlas.json`
- `public/assets/arsenal/weapons/PROVENANCE.md`

Mixed visual families contribute to asset-collage feeling.

---

# 20. FILES TO READ FIRST IN A NEW CHAT

Before implementation decisions, inspect:

1. `docs/arsenal-quest/V2_CHECKPOINT_B_REPORT.md`
2. `docs/arsenal-quest/V2_ROSTER_COMPATIBILITY_MATRIX.md`
3. `docs/arsenal-quest/V2_CHECKPOINT_C_IDENTITY_COMBAT_DIRECTION.md`
4. `docs/arsenal-quest/C1_FREE_2D_ASSET_SHORTLIST.md`
5. `docs/arsenal-quest/C1_FREE_ASSET_SHORTLIST.md` — historical/superseded for weapon art
6. `public/game/arsenal/arsenalQuestConfig.js`
7. `public/game/arsenal/arsenalWeaponRuntime.js`
8. `public/game/arsenal/arsenalPresentationRuntime.js`
9. `public/game/arsenal/arsenalShellSelectRuntime.js`
10. `public/game/modes/arsenalQuestRuntime.js`
11. `public/assets/arsenal/av/PROVENANCE.md`
12. `public/assets/arsenal/av/MANIFEST.csv`

Do not rely only on conversational memory when making branch/code decisions.

---

# 21. EXACT NEXT STEP

**Do not send Agent a new implementation task yet.**

Current phase = **C1 creative / asset / audio lock**, led by ChatGPT + owner.

## Priority 1 — finish coherent free 2D asset selection

Requirements:
- free/commercially usable;
- native 2D;
- non-pixel;
- high contrast;
- bold/firm lines;
- strong color separation;
- related source families;
- evaluate full GUN family;
- clearly improve over Kay baseline.

Next action:
1. continue web research for coherent colorful/high-contrast native 2D vector/PNG weapon families;
2. prioritize families covering multiple Arsenal categories;
3. if one family cannot cover all 12, choose at most ~2 source families that can be normalized/reprocessed;
4. do not send owner 20 choices;
5. give a decisive “download these X packs” recommendation;
6. flag attribution/license requirements.

## Priority 2 — Sonniss curation

When owner uploads `sonniss_manifest.csv`, return exact files/folders to extract.

## Priority 3 — real visual comparison board

After candidate art is available:
- ChatGPT defines exact candidates/layout;
- Agent may automate contact sheet/rendering only;
- Agent does not choose winner.

Minimum board:
- compact/automatic gun
- shotgun
- long/sniper
- Battle Axe
- Grenade
- Tower Shield

Owner judges coherence + color + contrast + silhouette.

## Priority 4 — only after art/audio lock, create Agent implementation spec

Rewrite/re-scope #8 or create new issue with:
- exact asset files;
- exact crop/pivot/scale/orientation;
- exact reprocess rules;
- exact motion timeline;
- exact projectile language;
- exact SFX mapping;
- exact arena reference;
- exact balance constraints.

No open-ended “make it prettier”.

---

# 22. ROADMAP

## C0 — direction lock
Conceptually done: hybrid A+B+C.

## C1 — asset / visual / audio lock
**Current active phase.**

Must result in owner-approved references/assets, not just markdown.

## C2 — combat feel implementation
After C1:
- coherent 12 weapon visuals;
- grenade continuity;
- physical-exit motion V2;
- SFX V2;
- tracer/projectile redesign;
- swept collision;
- Chamber 01 arena.

Stop for playtest.

## C3 — power hierarchy / balance
After C2:
- native fighter damage normalization;
- weapon tuning;
- damage-share telemetry;
- matchup suite.

Stop for playtest.

## D — UI/UX overhaul
Only after combat identity/balance is correct.

---

# 23. DO-NOT-DO LIST

- Do not modify `main`.
- Do not blindly continue Issue #8’s Agent-led art-direction plan.
- Do not let Agent choose visual identity.
- Do not treat open issues as proof work is unfinished.
- Do not deploy every Arena commit.
- Do not create ZIPs for routine playtests.
- Do not restore centerline-only reveal.
- Do not make fighters inert shells again.
- Do not keep full native fighter lethality unchanged.
- Do not re-enable generic slash-sheet VFX.
- Do not use fade-out as primary weapon consume animation.
- Do not change grenade visual identity when thrown.
- Do not keep slow oval bullets as final projectile language.
- Do not default back to washed-out low-poly 3D weapon art.
- Do not recommend Kay Lousberg as if it were a new visual improvement.
- Do not overwhelm owner with dozens of asset links and make them do art-direction curation manually.

---

# 24. ONE-PARAGRAPH RESUME BRIEF

We are developing **Apex Chaos // Arsenal Quest** in `Khanh-glitch/APEX-CHAOS`. Checkpoint B is implemented and owner-playtested at `playtest/arsenal` SHA `16b62f15...`; Arena HEAD before this handoff is `261c29f...`, with post-B changes being docs/evidence only. B fixed spawn/reveal, restored compatible 32-fighter kits, and added independent 12-weapon motion, but owner feedback says the asset look is ugly/samey, melee SFX weak, motions not iconic, fade exits cheap, grenade visuals inconsistent, native fighter damage too dominant, arena unsuitable, and bullets too slow/toy-like. We paused UI work and moved to Checkpoint C: identity/combat feel. Creative direction is a hybrid of tactical test chamber readability + showmanship + heavy impact, but owner explicitly wants **native 2D, non-pixel, bold/high-contrast/color-separated weapon art**, not washed-out 3D. ChatGPT/owner must choose the art direction and asset family; Agent only implements locked references. Current active task is to finish a decisive coherent **free 2D asset download set** (evaluate a full gun family, not just pistol), while recognizing current Kay Lousberg 2D Guns is already used and aesthetically rejected. For Sonniss GDC 2026, owner has five very large ZIPs; do not upload them — use a lightweight ZIP manifest CSV, then curate a small SFX subset. Do not send Agent a new implementation task until assets/audio direction is locked.
