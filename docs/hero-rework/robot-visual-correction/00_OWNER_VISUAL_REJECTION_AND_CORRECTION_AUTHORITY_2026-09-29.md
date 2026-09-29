# ROBOT OWNER VISUAL REJECTION + CORRECTION AUTHORITY — 2026-09-29

## Status

The technical integration at `4c4e369614fd92df6e172d4b6b449d0837393823` is **NOT owner-accepted visually**.

This branch exists specifically to correct the owner-visible Robot presentation without reopening unrelated gameplay/system work.

- repository: `Khanh-glitch/APEX-CHAOS`
- correction branch: `director/robot-owner-visual-correction-20260929`
- exact technical base: `4c4e369614fd92df6e172d4b6b449d0837393823`
- do not start from `main`
- do not start from `arena/01a0e9c1-apex-chaos@061435...`; that commit is evidence/browser churn after the technical base
- complete golden master: `docs/hero-rework/robot-final/reference/ROBOT_VISUAL_AUTHORITY.html`
- expected authority SHA-256: `bd0cc64fbeea94969fbef0b4bc4de690a19e85fafe93cb4a12c9b3accf095f75`

## Owner-visible rejection

The current production Robot differs too much from the approved HTML. The owner specifically rejects:

1. unexpected/noisy fragments and visual artifacts around Robot;
2. bullet/environment interactions that look exaggerated, detached, or broken compared with the HTML;
3. A1 and A2 motion that do not feel like the HTML choreography;
4. A1 producing an accumulated/tangled trajectory instead of one clean authored dash trace;
5. many expected Robot SFX feeling absent in real play;
6. equipped weapons appearing detached/misaligned instead of sitting naturally in the approved jaw/grip;
7. the whole Robot rotating with movement/aim. The owner requires the Robot to preserve the HTML's original world-facing orientation wherever it translates.

The HTML is unusually strong and is the owner-approved golden master. Production is not allowed to reinterpret it.

## Important isolation finding

The huge RED / BLUE / GOLD translucent lanes and the card labeled `GOLD` visible in the owner's noisy screenshots are PAINTER/global hero presentation from `public/apexEngine.js`, not Robot-generated VFX.

Do NOT delete, redesign, or suppress PAINTER globally as part of this task.

All Robot visual checkpoint evidence must therefore use a neutral opponent (prefer ICE), AI disabled, and no unrelated skill/VFX activity except the exact controlled projectile/hit being tested.

## Verified implementation defects / root causes

These are source-audited, not guesses.

### RVC-1 — whole-body rotation violates HTML

Current `robotPresentationRuntime.js` wraps `Fighter.prototype.draw` and executes:

`ctx.rotate(Math.atan2(this.dir.y, this.dir.x))`

The HTML renderer does not rotate the whole body to its movement/aim heading. It translates the Robot while internal springs/calipers/tilt carry the motion.

**Correction law:** the production Robot body keeps a fixed world-facing base orientation. Movement, dash heading, target direction, weapon aim, wall contact, and enemy position must not rotate the whole chassis.

Internal `R.tilt`, caliper articulation, spin, inertia and recoil remain allowed exactly as authored.

### RVC-2 — weapon socket inherits the same wrong body heading

`getRobotWeaponSocketWorld()` rotates the HTML-derived local jaw socket by `fighter.dir`. This makes the grip orbit the body as direction changes and contributes to detached-looking weapons.

**Correction law:** derive world socket from the fixed HTML body frame. The weapon may rotate about the actual socket to satisfy the real weapon's aim, but its anchor must remain visually attached to the jaw/grip. No extra positional drift. Audit the current double use of `gunKick` between `heldGunLocal()` and the equipped-weapon wrapper.

### RVC-3 — A1 trail lifecycle is broken

Production sets `st.trailOn = true` on dash launch, but the current contact handler never performs the HTML authority's:

`at(.55, () => { trailOn = false; });`

and a new dash does not first reset the previous trail.

The HTML explicitly starts a fresh trail on launch and fades/stops it after contact.

**Correction law:** each A1 owns exactly one fresh trail. Clear/reset at launch; begin at actual launch; on real equip/contact set `contactT`; fade with the HTML's 0.5 s law; turn it off at the authority-equivalent 0.55 s. No old path may survive into a later A1.

### RVC-4 — A1 choreography is temporally misaligned

The HTML has:
- recognize/focus;
- +0.13 s commit/lock;
- +0.13 s launch;
- physical dash;
- contact;
- +0.20 s settle;
- +0.55 s trail-off;
- later return/normalization.

Current mechanics emits `RobotA1DashLaunch` on the first tick after cast, while presentation schedules commit at +0.13 s. The Robot can therefore translate before its approved visual wind-up has occurred.

**Correction law:** real translation must not visually outrun the approved recognize → commit → launch choreography. Synchronize the real dash launch with the approved HTML sequence. Preserve A1 identity/laws (real physical dash, real pickup/equip authority, no teleport, T6 exclusion, no-target no cooldown, dash max window once launched) while aligning presentation timing. Do not invent an alternate motion.

### RVC-5 — hit/wall particle coordinate spaces are mixed

`impactLocal()` and wall hooks pass several world-space `worldPt.x/y` values into `sparksState/chipsState/dustState`, while those particle arrays are rendered inside the Robot-local/head-space renderer and multiplied by `HSC`.

This can visually detach fragments from the actual contact point.

**Correction law:** every Robot effect must have one explicit coordinate owner: head-local, fighter-local, or world. Convert exactly once. Do not mix world coordinates into the local renderer.

### RVC-6 — A2 incoming hit direction is currently degenerate

`heroMechanicsRuntime.js` emits `RobotA2Hit.point = { x: body.x, y: body.y }`, i.e. the victim body's own position.

Presentation then computes direction using `fighter - payload.point`, which becomes zero and falls back to +X. Therefore real hit direction is not faithfully represented.

The damage packet already carries `packet.source`.

**Correction law:** derive A2 impact side/direction from the real incoming source/projectile information available in the damage path. A right-side and left-side controlled hit must visibly route force to the corresponding side exactly like the HTML's structural impact language.

### RVC-7 — mechanical Robot must not visually produce organic blood as its own hit material

The HTML hit language is mechanical: sparks, chips, stress, pulses, recoil. The generic Arsenal feel layer emits blood/splatter for normal damage victims.

For Robot-as-victim, organic blood is visually incompatible with the approved authority and contributes severe noise.

**Correction law:** when the damage victim is ROBOT, suppress only the organic victim blood/splatter contribution and let Robot's approved mechanical hit presentation own the hit. Do not suppress blood globally and do not change blood for the opponent/other heroes.

### RVC-8 — current SFX tests do not prove audible playback

`playRobotSfx()` increments `__robotSfxCounts` **before** checking whether:
- an AudioContext exists;
- the buffer is decoded;
- a source is actually started.

Therefore prior “1 SFX” gates prove semantic invocation, not audible playback.

**Correction law:** keep the approved 8-file mapping unchanged, but add an audible-playback diagnostic that distinguishes requested / decoded / source-started. In a real browser after audio unlock, verify the intended A1/A2 events actually start their approved buffers. Do not source or invent replacement sounds in this visual checkpoint.

## Golden-master laws

- No whole-body heading rotation.
- No generic 3D/realistic reinterpretation.
- No giant shield fields, lanes, debug circles, navigation tunnels or spectacle added to Robot.
- A1 = recognize → commit → clean physical launch → one controlled calibrated trail → real pickup/contact → settle.
- A2 = index → structural lock → mechanical force-routing on hit → release.
- Real game physics, collision, inventory and damage remain authoritative.
- HTML owns visible shape, materials, hierarchy, internal articulation, motion language and restraint.
- Real weapon art remains APEX authority, but its socket/attachment presentation must visually fit the HTML Robot.
- Do not solve visual mismatch by hiding other heroes' legitimate global systems.

## Scope

This is a bounded visual correction pass, not another final-integration marathon.

Allowed implementation surfaces:
- `public/game/hero-rework/robotPresentationRuntime.js`
- minimal Robot-specific semantic payload/timing changes in Hero Rework mechanics/runtime if required for true source direction or A1 launch synchronization;
- minimal Robot-specific Arsenal feel exception for victim-material presentation if required to suppress blood only for ROBOT;
- focused visual/audio diagnostic tooling.

Do not rebalance unrelated heroes or weapons.

## Owner checkpoint — mandatory stop

Produce exactly these five clean real-browser production proofs against a neutral ICE opponent with AI disabled:

1. `01-idle-move-fixed-orientation` — multiple movement directions; body world rotation visibly unchanged, internal inertia remains.
2. `02-real-weapon-socket` — real PISTOL acquired through A1 and visibly attached to the correct jaw/grip throughout movement/aim.
3. `03-a1-sequence` — recognize, commit, launch, single fresh trail, real contact, settle. No tangled historical path.
4. `04-a2-sequence` — index, lock, active hold, release with HTML-like articulation.
5. `05-a2-controlled-gunfire` — controlled PISTOL hits from both sides; correct mechanical force routing; no Robot blood; no detached particle artifacts.

Also include a compact SFX runtime table for the controlled checkpoint:
`event | requested | buffer decoded | source started | approved file`.

Then STOP and wait for owner visual approval.

Do not run a giant final regression suite, do not rewrite completion reports, and do not call Robot final before owner approval.
