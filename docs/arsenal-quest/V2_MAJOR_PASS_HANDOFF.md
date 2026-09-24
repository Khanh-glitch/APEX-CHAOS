# ARSENAL QUEST V2 — MAJOR MOTION / VISUAL / UI PASS

Status: AUTHORITATIVE V2 HANDOFF  
Base branch: `prototype/arsenal-v2-motion-ui`  
Base lineage: latest playable Arsenal packaging branch at task creation.

This pass exists because the current prototype is functionally clearer than P0 but still does not feel like a finished game. The owner has identified several non-negotiable issues. Do NOT treat this as a cosmetic-only polish pass: the first checkpoint corrects aiming/movement/reveal semantics before motion and UI are layered on top.

## Product rule

**Fighter movement and weapon presentation are separate systems.**

A weapon may aim, recoil, spin, thrust, swing, block, or animate without rewriting the fighter's movement direction.

In Arsenal V2:

`fighter movement direction != weapon aim direction`

No weapon should call `fighter.setDir(...)` merely to aim at the opponent.

---

# CHECKPOINT A — CORE FEEL CORRECTION

Do this first. Stop after A and provide a playable/evidence build before starting B.

## A1. Weapons must not steer fighters

Known current cause:
`arsenalWeaponRuntime.js` contains `aimAtHolder(ctx)` which calls:

`fighter.setDir(cos(angleToEnemy), sin(angleToEnemy))`

This is used by melee and Sniper aiming and can visibly bend the fighter trajectory.

### Required law

- Weapon aim must never mutate `fighter.dir`.
- Weapon aim must never rewrite the normal Apex bounce trajectory.
- Weapon recoil is visual weapon motion only, not fighter displacement.
- Melee windup is visual weapon motion only.
- Keep target knockback/status effects when they are intentional weapon effects.
- Tower Shield may keep its intended speed penalty; it must not rotate fighter movement.
- For this V2 test pass, Dagger's attack should NOT dash/move the fighter body. Convert the feeling of the dash-stab into a weapon-only forward lunge/thrust while the fighter continues its original Apex movement trajectory.

## A2. Independent weapon aim angle

Introduce a presentation/runtime concept such as:

`weaponAimAngle`

Logical value each frame:

`atan2(enemy.y - fighter.y, enemy.x - fighter.x)`

Rules:
- every equipped weapon visually faces the opponent continuously;
- guns point their barrel toward the opponent;
- dagger/sabre/spear/axe/club point their attack-facing side toward the opponent;
- shields face the opponent;
- projectiles/attacks use the opponent-facing attack angle without changing fighter movement;
- logical aim may be exact; visual angle may use a very short damped interpolation (<= ~60ms) only to remove jitter.

## A3. 32 fighter test shells for both players

Arsenal prototype should allow P1 and P2 to choose from these canonical 32 shells:

1. RUBBER
2. ICE
3. VAMPIRE
4. STRING
5. VOLCANO
6. MAGNET
7. FLASH
8. ELECTRIC
9. ORBIT
10. TOXIC
11. MIRROR
12. BLACK_HOLE
13. SAW
14. BLADE
15. NOVA
16. HUNTER
17. CRYSTAL
18. VIRUS
19. DRUM
20. CARD
21. MATH
22. MATH_V2
23. SNIPER
24. SLIME
25. TIME
26. WOLF
27. WIND
28. WITCH
29. PIRATE
30. PAINTER
31. MONK
32. SUPERSTAR

Purpose: they are **visual test bodies**, not 32 additional gameplay kits.

For Arsenal V2:
- reuse each fighter's existing draw identity / body art;
- normalize match HP to Arsenal rules;
- normalize movement to Arsenal movement tuning unless an explicit body-size reason requires otherwise;
- native abilities, rage abilities, native attacks, special passives, summons, and fighter-specific damage mechanics must be disabled in Arsenal mode;
- do not allow fighter identity to contaminate weapon balance testing;
- selection is available independently for P1 and P2;
- reuse existing roster cards/previews where practical instead of building a second roster renderer.

A later experiment may re-enable fighter abilities, but NOT in this pass.

## A4. Temporarily remove slash / swipe VFX

The current imported slash-family effects are hurting readability.

Disable normal-gameplay use of:
- orange melee slash sequences;
- blue slash/streak sequences;
- generic swipe trails;
- slash effects on shield events.

Keep:
- bomb/grenade explosion atlas;
- muzzle flash may remain because it is a gun-specific muzzle event rather than a slash trail;
- small particles/shock feedback already native to Apex may remain only if they are not reading as swipe/slash art.

The weapon sprite's own motion should communicate melee attacks.

## A5. Replace proximity predictor with strict 1-second centerline reveal

Old V2 predecessor behavior:
- simulate future contact with broad touch radii;
- reveal when predicted ETA enters 1.2–1.8s.

New required behavior:

### Fixed lead
`REVEAL_LEAD_SECONDS = 1.0`

### Centerline gate
A hidden pickup reveals only when an eligible fighter's **current movement line is actually passing through the item's center corridor** and the center crossing is <= 1.0s away.

Do not reveal merely because the fighter's body/touch radius is predicted to clip the pickup.

Operational first-pass geometry:

Given:
- normalized movement vector `v`
- fighter center `F`
- pickup center `P`
- `r = P - F`

Compute:
- forward distance: `dot(r, v)`
- cross-track distance: `abs(cross(r, v))`
- ETA to centerline crossing: `forwardDistance / fighterSpeed`

Reveal only if:
1. fighter is living and eligible to pick up;
2. forward distance > 0;
3. cross-track distance <= a tight center tolerance (first pass ~12–18 px; do NOT use full fighter/pickup collision radius);
4. ETA > 0 and ETA <= 1.0s;
5. the fighter will not hit an arena wall before that center crossing. Evaluate only the current straight movement segment; after a wall bounce, recompute using the new direction.

This intentionally means:
- grazing the pickup collision circle is not enough;
- a broad future contact predictor is not enough;
- future post-bounce paths do not reveal before the bounce;
- reveal happens only when the current trajectory visually commits through the pickup center.

### Reveal presentation
Before gate:
- neutral hidden telegraph;
- no weapon identity;
- non-collectable.

At gate:
- choose weapon identity;
- weapon sprite pops from ~0.25 scale -> ~1.15 -> 1.0 over roughly 150–200ms;
- it becomes collectible;
- no slash VFX.

---

# CHECKPOINT B — WEAPON MOTION LANGUAGE

Start only after owner approves Checkpoint A gameplay feel.

Create an isolated weapon pose/motion layer. Suggested state:

`weaponPose = { aimAngle, rotationOffset, localX, localY, scaleX, scaleY, recoil, phase }`

The pose layer must not change the fighter's movement vector.

Motion should come from transforming the real weapon sprite.

## B1. Motion recipes — first-pass direction

### Pistol
- always points at enemy;
- each of 3 shots: crisp recoil backward ~12–16px;
- small rotational kick;
- ~60ms kick, ~100–140ms spring return;
- three pulses must be visually countable.

### Shotgun
- heavy single recoil ~24–32px;
- larger kick;
- slower settle ~180–240ms;
- optional pump/rack motion after blast if existing audio supports it.

### SMG
- 8 distinct micro-recoil pulses;
- ~8–12px back per shot;
- tiny alternating rotational shake;
- no fighter-body movement;
- motion must track the actual fire interval.

### Sniper
- continues aiming at opponent during charge;
- during the long pre-fire window, add a distinctive preparation motion;
- recommended: short stylized 360-degree weapon flourish/spin during the latter half of aim, then snap exactly back to target;
- pair flourish with metal latch / reload/chamber sound;
- fire only after weapon has re-aligned;
- strong long recoil after shot.

### Grenade
- short backward draw;
- forward throw motion;
- grenade leaves weapon/hand position;
- retain bomb explosion VFX.

### Sabre
- no slash VFX;
- short backswing + fast weapon-body cut/snap;
- motion itself communicates strike.

### Battle Axe
- pronounced raise/windup;
- heavy forward/down chop;
- slower recovery than Sabre.

### Dagger
- no fighter dash;
- ~60–90px weapon-only straight thrust toward opponent;
- quick retract.

### Spear
- long narrow weapon-only thrust;
- ~90–120px extension;
- controlled return.

### Spiked Club
- backswing + blunt forward smash;
- heavier ease-in/ease-out than blade weapons.

### Swirl Shield
- always faces opponent;
- subtle idle settle;
- successful reflect: brief forward pop/tilt and return.

### Tower Shield
- always faces opponent;
- guard pose visibly forward;
- hit/block: short push-back/tilt on the shield sprite only.

## B2. Motion architecture acceptance

- no animation is implemented by rewriting `fighter.dir`;
- no recoil changes fighter position;
- timelines are weapon-specific and data-driven where practical;
- motion can be debugged without VFX enabled;
- gameplay timing and visual timing are explicitly synchronized.

---

# CHECKPOINT C — FULL UI / UX OVERHAUL

Do not start until owner has played Checkpoints A + B.

## C1. Visual direction

Target: **dark tactical test-lab / premium arcade arena**, not neon soup.

Useful framing:
`ARSENAL QUEST // FIELD TEST`

The 32 fighters are test subjects; weapons are the star.

Use:
- near-black / graphite base;
- restrained metallic / warm neutral surfaces;
- P1 and P2 accents for orientation;
- weapon art as focal visual;
- controlled glow only for state communication;
- strong typography hierarchy;
- minimal center-screen obstruction.

## C2. Match HUD

Left panel:
- P1 fighter shell portrait/preview;
- fighter name;
- HP bar/value;
- current weapon icon + name;
- weapon state: READY / AIM / FIRING / GUARD / etc.;
- shot/ammo pips only when useful.

Right panel mirrors P2.

Center/top:
- mode title / field-test identity;
- compact drop cadence indicator, but never leak hidden weapon identity;
- no giant debug text.

World pickup:
- neutral hidden telegraph;
- strict centerline gate;
- 1-second reveal pop;
- revealed weapon sprite visually dominant.

## C3. Match transitions

Add deliberate motion for:
- match intro;
- fighter lock-in;
- weapon reveal;
- pickup;
- weapon consume/return-to-unarmed;
- KO / round result;
- rematch.

Prefer short, high-quality motions over many effects.

## C4. Selection UX

Before match:
- P1 and P2 select independently from the canonical 32;
- reuse existing roster preview rendering;
- two clear selected-fighter panels;
- quick Random option is useful;
- selected fighter is a shell only; UI should not advertise native abilities in Arsenal V2.

## C5. UI acceptance

- normal gameplay has no debug labels;
- weapon state is understandable in <1 second;
- center arena remains visually open;
- HP / holder state readable without looking away from fight;
- no UI element leaks unrevealed weapon identity;
- 32-fighter selection remains usable on a normal laptop viewport;
- motion feels consistent with weapon motion language.

---

# IMPLEMENTATION ORDER / STOP RULES

Do NOT implement A+B+C in one uninterrupted agent run.

Run:
1. Checkpoint A only -> build -> browser evidence -> owner playtest -> STOP.
2. Checkpoint B only -> build -> weapon-by-weapon evidence -> owner playtest -> STOP.
3. Checkpoint C -> UI evidence + playable build.

Do not over-engineer CI. Existing build/headless/browser checks are sufficient unless a new rule needs one focused gate.

Do not spend time creating new packaging infrastructure during A/B/C. Existing packaging flow is separate.

Do not modify `main`.

---

# CHECKPOINT A ACCEPTANCE GATES

1. No Arsenal weapon aim path calls `fighter.setDir`.
2. Normal fighter trajectory is unchanged when gun/melee begins aiming or firing.
3. Dagger no longer moves the fighter body for its attack.
4. Real equipped weapon continuously faces opponent.
5. All 32 canonical fighter shells are selectable for P1 and P2.
6. Fighter native abilities/passives/rage are inactive in Arsenal.
7. Imported slash/swipe sequences are absent in normal gameplay.
8. Bomb explosion remains.
9. Hidden pickup uses fixed 1.0-second centerline gate.
10. A trajectory that only clips pickup radius but misses center corridor does NOT reveal.
11. A center-aligned trajectory with center ETA <=1.0s DOES reveal.
12. A path that would require a wall bounce does NOT reveal before the bounce.
13. Spawn cadence/multiple slots/one-held-weapon rules remain intact.
14. Existing 12 weapon identity/damage behavior remains unless specifically changed above.
15. Browser evidence includes P1/P2 shell selection, movement-with-aim proof, centerline reveal positive/negative cases, and no-slash combat.
