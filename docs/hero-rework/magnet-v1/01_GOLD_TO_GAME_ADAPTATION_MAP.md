# MAGNET V1 — GOLD TO REAL GAME ADAPTATION MAP

Canonical Gold:
`gold/MAGNET_FINAL_DONOR_MAX.html`
SHA-256 `468f7b2aa34588c2c52bf23fb5202c507ff5d584d423ea9f1a9232d751247d8b`

## A. Gold is presentation authority, not demo gameplay authority
Preserve actual authored algorithms and visual identity. Do not "make something similar."

Gold owns:
- Reference-A visible identity;
- six-part articulated cutout rig: core, spine, left/right pole, left/right lobe;
- authored pivots and hidden-surface reconstruction;
- native gold emission channels: core.main, core.eyes, spine.main, pole inner/outer;
- inertial secondary motion, delayed acceleration history and hard-turn/start/stop/wall reactions;
- A1 gold-current routing;
- A1 selection/bracket language;
- bowed pole-tip partial-Bezier force filaments and travelling beads;
- true-history object ribbons;
- pressure fronts;
- local floor distortion;
- A2 angular hot-bin reactive sectors;
- A2 local object-pressure arcs;
- sparse field accents instead of a filled bubble;
- impact/coherence/recovery motion;
- presentation rhythm and hierarchy.

## B. Asset law
Visible Magnet must come from the approved Reference-A raster embedded in Gold.
No vector redraw, generic mech replacement, screenshot simplification, or alternate identity.

Gold runtime prototype derives segmentation/masks/material layers from the 1254x1254 raster.
Production should PRE-BAKE immutable outputs once:
- six source parts;
- alpha/material masks;
- native-gold masks;
- dim masks;
- glow support;
- pivot/part metadata.

Normal battle runtime must not rerun full flood-fill / dilation / inpainting / wide blur derivation every match.
Optimization is allowed only if normal-scale output remains visually faithful.

## C. Motion law
Gold uses a fixed 1/120 s presentation simulation.
Preserve this for articulated presentation springs/history.
Never feed raw hitch/frame dt directly into high-energy springs.

Presentation motion must not mutate gameplay position/velocity as a shortcut.
Real APEX body movement is gameplay truth.
Gold rig follows that truth and adds local articulation.

Do not import Gold demo's multipart collision circles as gameplay hitboxes.
Real APEX fighter collision/hitbox remains authority.
Impact point may select a visual reaction only.

## D. A1 mapping
KEEP visually:
- staged spine -> core/eyes -> pole inner -> pole outer current route;
- selection acknowledgement;
- bowed force filaments;
- travelling pressure bead;
- firearm history trail;
- pressure fronts;
- local floor deformation;
- proximity/contact visual response.

ADAPT:
- gameplay may cast with zero floor guns.
- visual target selector must therefore consider currently influenced floor firearms AND influenced hostile firearm bullets.
- keep the display sparse: at most 1-2 highest-value filament targets.
- late-revealed firearm gets a localized acknowledgement using existing Gold vocabulary.

DO NOT PORT:
- Gold fail-with-no-gun gameplay condition;
- Gold demo 2000->3000 gun force / 1100 cap as final balance;
- Gold strong `exp(-6dt)` floor drag;
- Gold missing real 480 px bullet-force gate;
- demo pickup code;
- demo gun sprites;
- demo opponent.

## E. A2 mapping
KEEP:
- 225 px authored field scale;
- hot-bin angular response;
- local pressure arcs;
- sparse sectors;
- pressure/local distortion connected to real affected objects.

DO NOT replace with a solid circular shield/bubble.
DO NOT port Gold demo force equations as final gameplay law.
Final gameplay uses quadratic `u^2` falloff from `00`.

## F. Passive mapping
Gold contains a ~55 ms showcase PREP before it spawns its demo bullet.
That delay is presentation-only reference.

Production firearm timing remains authored Arsenal timing.
Apply x1.18 once at the real emission hook.
Drive pole/core/corridor/muzzle presentation around the real fire event; never delay the real bullet to satisfy the demo.

## G. Timeline mapping
Gold's visual intensity envelopes ramp in.
Gameplay force does not.
At cast acceptance gameplay field is effective immediately.

Gold keeps A1 visual state to about 1.6 s and A2 to about 2.3 s.
Production gameplay force windows are exactly 1.00 s and 1.80 s.
Presentation recovery must never extend mutual-exclusion gameplay lock.

## H. Render isolation
Every Magnet draw pass must save/restore:
- transform;
- globalAlpha;
- globalCompositeOperation;
- filter;
- shadow state;
- clip/path assumptions;
- image smoothing if changed.

Never mutate unrelated fighter scale/radius/camera/HUD.
No second global Magnet actor may compete for the same fighter.
No legacy/new double-render path.

Use local seeded PRESENTATION RNG for cosmetic variation where practical.
Presentation RNG must never consume or alter gameplay RNG.

## I. Demo-only systems rejected
Do not port:
- prototype floor;
- prototype camera and zoom controls;
- demo HUD/toasts;
- fake weapons/projectiles;
- dummy fighter;
- demo damage/hit logic;
- demo hit circles;
- keyboard test controls;
- standalone cooldown implementation;
- synthesized logic that duplicates Arsenal ownership/pickup/projectile truth.
