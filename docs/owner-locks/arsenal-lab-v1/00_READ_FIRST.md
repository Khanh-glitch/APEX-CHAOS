# APEX CHAOS — OWNER LOCK: ARSENAL LAB + SPLATTER CONTROL + STORMBREAKER FLOOR POSE V1
Date: 2026-09-26
Prepared branch: arena/arsenal-lab-splatter-control
Prepared base: 47578e9cf28bfd5abb329c86f2dcab99f8d5037b

## 0. OWNER INTENT

This pass exists to make Arsenal equipment easy to inspect and repeatedly playtest before any further Stormbreaker VFX revision.

The owner has explicitly PAUSED Stormbreaker VFX redesign. Do not use this task as permission to improve, reinterpret, simplify, or rewrite Stormbreaker VFX.

This pass has exactly three product goals:

1. Add ARSENAL LAB.
2. Add a two-mode splatter color control.
3. Make the unclaimed/floor Stormbreaker lie horizontally.

Everything else is protected unless a narrow dependency is proven.

## 1. FROZEN STORMBREAKER FEEDBACK — RECORD ONLY, DO NOT FIX IN THIS PASS

Owner playtest feedback from the current Stormbreaker build:
- the VFX feels inspired by the approved prototype rather than visually matching it;
- the port did not carry enough of the prototype's weapon-body electricity;
- Stormbreaker is rare enough that normal playtest is inefficient;
- the floor/spawn read currently feels dominated by a circular aura instead of electricity distributed around the weapon body.

Important code-audit observation for the future VFX pass:
- arsenalStormbreakerVfxRuntime.js builds and reshuffles `rec.activeLinks` for floor Stormbreaker;
- current audit did not find those `rec.activeLinks` being consumed by a floor weapon-body linked-arc draw path;
- this is a plausible lead for the missing body-lightning complaint, but it is NOT part of this task.

Do not change bolt density, linked-arc grammar, circle/aura design, impact, held VFX, flight VFX, spawn pulse cadence, caps, audio, damage, stun, slow, rarity, or throw behavior in this pass.

## 2. ARSENAL LAB — PRODUCT CONTRACT

### 2.1 Entry

Add a fifth tile to the existing ARSENAL QUEST hub:

`05 · TESTING`
`ARSENAL LAB`

It must live beside the existing:
- FREE BATTLE
- QUEST MAP
- FIGHTER SHOP
- LUCKY DRAW

Do not replace or reorder away existing functions unless layout responsiveness requires a harmless reflow.

Selecting ARSENAL LAB enters the lab directly. There is NO fighter picker.

### 2.2 Fighters

The lab always starts:
- P1 = NEWBIE
- P2 = NEWBIE
- both use the real Arsenal NEWBIE shell/runtime;
- both retain normal movement and combat behavior;
- both have infinite health for the lab.

"Infinite health" means:
- real hits still travel through the real damage/collision path;
- true damage amount is still measured and displayed;
- blood/splatter still fires;
- hit stop, shake, stun, knockback, impact VFX, audio and weapon consumption still fire;
- after the hit is resolved, lab health is restored/held at max before a KO/result state can occur;
- no winner screen;
- no match completion;
- no AC rewards;
- no quest progress;
- no meta progression.

Do NOT make fighters invulnerable by skipping damage callbacks. The lab exists to inspect real combat feedback.

### 2.3 No automatic pickups — hard law

On Lab entry:
- zero weapon/heal slots are present;
- normal 4.5s offensive spawn cadence is disabled;
- emergency firearm spawn is disabled;
- automatic heal support is disabled;
- rarity rolling is disabled for lab-requested items.

If the owner presses nothing, the arena must remain without spawned equipment indefinitely.

This is a hard acceptance condition:
`NO CLICK => NO SPAWN`.

### 2.4 Lab weapon panel

While in Lab, show a dedicated in-battle panel for manual equipment spawning.

The panel must:
- use the current real Arsenal equipment list from `CFG.P0_WEAPON_IDS`;
- therefore include the 24 current firearms, grenade, five standard melee weapons, STORMBREAKER, SWIRL_SHIELD and TOWER_SHIELD;
- use real committed weapon art where practical, not placeholder rectangles;
- show a readable weapon name;
- be scrollable/collapsible or otherwise non-destructive on desktop and phone;
- keep the arena usable and visible;
- include a clear way back to ARSENAL HUB.

Do not add heals to the panel in V1 unless they are required by existing equipment plumbing. The owner's request is weapon/equipment testing.

### 2.5 Manual spawn behavior

Click/tap one item:
- spawn exactly one pickup of that exact ID;
- at any valid free arena position chosen by the existing spawn-point law;
- directly as a real REVEALED pickup;
- do not run normal rarity/random weapon selection;
- do not require waiting for the normal hidden telegraph;
- once spawned, all normal pickup/equip/use/throw/fire/hit/consume behavior must use the real production pipeline.

Manual Stormbreaker must therefore be immediately repeatable in the Lab regardless of its real-mode rarity.

Normal Free Battle / Quest rarity and spawn behavior remain unchanged.

If the normal active-slot cap would make manual testing frustrating, Lab may own a separate bounded manual-slot cap, but it must remain bounded and must not change the production-mode cap.

## 3. SPLATTER COLOR CONTROL

### 3.1 Two modes only

Add a persistent Arsenal splatter setting with exactly two modes:

1. `BLOOD`
   - current accepted behavior, byte/visually equivalent in color to the existing crimson blood implementation.

2. `FIGHTER COLOR`
   - splatter uses the color of the fighter who RECEIVES the hit.
   - P1 hit => P1/victim color.
   - P2 hit => P2/victim color.
   - derive darker/lighter material shades from that victim color so the existing depth/layering remains readable.

The default for existing users must remain `BLOOD`.

### 3.2 Scope

The setting applies across Arsenal combat, not only Lab.

Expose the setting from the Arsenal Hub using a small, clear two-state control. It may also be mirrored in Lab for convenience, but Hub must remain the authoritative discoverable location.

Persist it separately (for example a dedicated versioned localStorage key) rather than silently mutating the established Arsenal meta-save schema.

### 3.3 What changes / what does not

Only splatter pigment changes.

Do NOT change:
- V1 blood geometry;
- streak/drop/micro counts;
- velocity;
- drag;
- lifetime;
- decal placement;
- floor-stain geometry;
- opacity timing;
- pooling/caps;
- firearm impact-point truth;
- existing non-firearm splatter motion;
- normal damage-number red;
- critical damage-number orange;
- healing green.

Both the legacy splatter path and V1 firearm path must honor the selected pigment. Do not leave hard-coded crimson remnants in V1 core/floor gradients when FIGHTER COLOR is active.

## 4. STORMBREAKER FLOOR/SPAWN POSE

When STORMBREAKER is REVEALED and unclaimed on the floor, its sprite must lie horizontally instead of vertically.

Hard boundaries:
- rotate only the floor/spawn presentation;
- held pose remains unchanged;
- windup remains unchanged;
- flight/spin remains unchanged;
- impact remains unchanged;
- asset file itself remains unchanged.

Use one shared floor-angle authority, preferably under `CFG.STORMBREAKER`, so the floor sprite and any floor-local Stormbreaker anchor calculations cannot drift.

Because the existing Stormbreaker floor VFX computes anchor-origin positions in weapon-local space, any floor-local anchor origin that is retained must use the same floor rotation as the sprite.

This orientation synchronization is permitted. It is NOT permission to redesign the VFX.

## 5. LIKELY INTEGRATION POINTS

Audit first; these are likely homes, not permission to rewrite broadly:

- `public/game/arsenal/arsenalMetaRuntime.js`
  - fifth hub tile
  - global splatter mode control
  - Lab entry

- `public/game/modes/arsenalQuestRuntime.js`
  - Lab state/entry/exit
  - NEWBIE vs NEWBIE
  - suppress auto spawn/heals/emergency
  - infinite-health / no-KO invariant
  - Lab DOM panel
  - no rewards/progression

- `public/game/arsenal/arsenalSpawnRuntime.js`
  - dedicated exact-ID manual spawn API
  - direct REVEALED real slot
  - floor Stormbreaker angle

- `public/game/arsenal/arsenalFeelRuntime.js`
  - persistent BLOOD/FIGHTER COLOR mode
  - victim-color palette derivation
  - both V1 firearm and legacy splatter paths

- `public/game/arsenal/arsenalStormbreakerVfxRuntime.js`
  - ONLY synchronize existing floor-local anchor orientation with the new horizontal floor pose.
  - NO visual redesign.

- `tools/testArsenalQuestHeadless.mjs`
- `tools/testArsenalQuestRuntime.mjs`
  - focused acceptance gates.

## 6. ACCEPTANCE GATES

At minimum prove:

### Lab
- Arsenal Hub exposes ARSENAL LAB and existing four entries still work.
- Lab enters with NEWBIE vs NEWBIE.
- After >=30 simulated seconds with no Lab UI input: zero offensive pickups, zero heals, zero emergency pickups.
- A manual normal firearm button creates exactly one REVEALED slot of the requested ID.
- Manual STORMBREAKER creates exactly one REVEALED STORMBREAKER without rarity roll or telegraph wait.
- Manually spawned items still use real pickup/equip/attack paths.
- Repeated lethal-equivalent hits cannot end Lab.
- Damage numbers, splatter and statuses still execute.
- Lab produces zero AC reward and zero progression.
- exiting Lab returns to Arsenal Hub.

### Splatter
- BLOOD mode reproduces current crimson behavior.
- FIGHTER COLOR uses the VICTIM's fighter color for V1 firearm splatter.
- FIGHTER COLOR also affects the existing non-firearm/legacy splatter path.
- mode persists through mode exit/re-entry/reload.
- damage-number semantic colors are unchanged.

### Stormbreaker floor pose
- floor/revealed STORMBREAKER is horizontal.
- held orientation unchanged.
- thrown/flight orientation unchanged.
- floor-local VFX anchor origins use the same floor rotation.

### Regression
- all pre-existing headless gates remain green.
- all pre-existing real-browser gates remain green.
- production build remains green.
- no unrelated files/behaviors changed.

## 7. BRANCH / RELEASE LAW

The owner-playtested branch `arena/01a0dc5e-apex-chaos@47578e9...` is a comparison baseline and must remain untouched.

Work from:
`arena/arsenal-lab-splatter-control@47578e9cf28bfd5abb329c86f2dcab99f8d5037b`

Do NOT promote `playtest/arsenal`.
Do NOT modify production.
Do NOT change Stormbreaker rarity in real modes.
Do NOT start the Stormbreaker VFX correction pass yet.

Owner playtest is required before any promotion.
