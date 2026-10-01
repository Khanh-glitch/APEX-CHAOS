# Stormbreaker — Approved Visual + Gameplay Spec

## 1. Product role

Stormbreaker is the first red-tier fantasy weapon in APEX CHAOS.

It should create a clear rarity escalation:
ordinary weapons feel like weapons;
Stormbreaker should feel like a dangerous supernatural event entering the arena.

The goal is **spectacle with hierarchy**, not maximum particle count.

---

# 2. Spawned / unclaimed state

While Stormbreaker is lying on the arena floor:

### Visual

- Stormbreaker remains visually alive.
- Electricity should link across the weapon itself, especially:
  - axe head
  - head-to-handle transition
  - multiple handle sections
  - pommel / rear section
- Small arcs should visibly connect different parts of the weapon instead of appearing as unrelated sparks.
- The weapon periodically emits ground-running lightning across the arena.
- Ground lightning should use a clear hero-bolt hierarchy:
  - one strong floor bolt
  - a supporting floor bolt where appropriate
  - short secondary branches
- More than one lightning event may be active during strong pulses, but avoid filling every frame with maximum brightness.
- Lightning topology may mutate quickly between frames so it feels electrical rather than like a static PNG.
- Arena illumination may pulse slightly with stronger discharges.
- Camera/arena shake is subtle on ordinary pulses and stronger on occasional heavy pulses.

### Gameplay

While Stormbreaker remains spawned and unclaimed:

- both fighters are continuously slowed
- slow is removed immediately when Stormbreaker is claimed / leaves the floor state

The global slow is part of Stormbreaker's red-tier presence.

Do not implement the slow inside the renderer. Use APEX's real status/movement system.

---

# 3. Pickup / held state

On pickup:

- brief claim flash
- electricity can connect:
  ground → fighter → weapon
- ambient global floor-slow ends
- electricity becomes more concentrated around:
  - Stormbreaker
  - wielder
- held-state crackle should remain readable but calmer than impact

Do not obscure fighter readability.

---

# 4. Attack identity

The attack fantasy is inspired by a very heavy divine-weapon throw:

- committed wind-up / heavy release
- Stormbreaker launches toward opponent
- spins extremely fast
- weapon becomes visually semi-abstract due to speed / rotational ghosts
- electricity remains attached to and around the whole spinning weapon
- impact is the major payoff

## Locked throw-tail decision

**NO LONG LIGHTNING TAIL.**

Explicitly reject:

- blue ribbon trail
- single centerline lightning rope
- long bolt chasing behind the center of the sprite
- vortex halo trailing behind the weapon
- multiple long parallel tail streams
- tail emitter fixed to one middle point
- persistent beam from throw origin to current weapon position

The owner repeatedly tested these ideas and rejected them.

Instead, flight VFX should consist of:

- fast weapon rotation
- a small number of cached rotational ghost images / afterimages
- short electrical links across the whole weapon
- a few short outward electrical snaps from different positions on the weapon
- these local arcs may change rapidly
- arcs travel WITH the weapon and disappear near it
- they should never visually organize into one long tail

This keeps Stormbreaker reading as:
**a violently spinning electrified axe**
rather than:
**a projectile dragging a blue effect behind it**.

---

# 5. Flight performance contract

The approved smooth prototype achieved its improvement by avoiding many spawned procedural bolt entities during flight.

Production implementation should preserve that philosophy.

Preferred:

- pre-scaled / cached weapon sprite where useful
- fixed small number of rotational ghosts
- fixed-cost local electrical geometry around weapon
- no per-frame explosion of transient bolt objects
- no expensive blur filters per ghost
- no rebuilding dozens of branched bolts per animation frame

The throw must remain visually smooth.

Do not solve performance by slowing the actual animation.

---

# 6. Impact

Impact must be a clear high-value event.

At the exact hit point:

1. very bright white/cyan contact flash
2. strong but brief camera/arena shake
3. victim enters stun
4. large arena electrical discharge begins
5. Stormbreaker visually disappears immediately after the flash

The weapon must NOT remain standing/embedded visibly in the opponent after impact.

This is intentional.

The impact flash should momentarily hide the transition, then the weapon is gone.

---

# 7. Arena-wide impact discharge

After a successful hit:

- one dominant hero discharge should control the composition
- several large floor branches may spread toward arena edges
- short body crackle remains on victim
- scene gets a brief illumination pulse

Avoid:
- uniform 360° starburst
- 20 equally bright bolts
- full-screen cyan clutter
- constant maximum bloom
- symmetric branching

Use hierarchy:

1. hero bolt
2. major floor branches
3. body crackle
4. minor sparks

---

# 8. Stun

Successful Stormbreaker hit stuns the victim.

Use the game's actual stun/status system if one exists.

Do not fake stun only through animation.

The precise duration should be treated as a balance parameter and verified against the current game balance, rather than blindly hardcoding the prototype's demo duration.

Prototype visual reference used roughly ~1.18 s only for demonstration.

---

# 9. Slow

While Stormbreaker is unclaimed on the floor:

- both fighters are slowed continuously

Prototype used an exaggerated visible movement multiplier to communicate the concept.

Production value must be balance-reviewed in APEX.

Treat exact slow percentage as a balance parameter, not visual authority.

But the mechanic itself is locked unless current project authority explicitly overrides it.

---

# 10. Color / material language

Lightning:

- white-hot core
- cyan inner body
- blue atmospheric outer energy
- short-lived topology mutation

Avoid:
- flat solid blue line
- neon ribbon
- uniform glow
- additive visual noise everywhere

Stormbreaker itself should remain readable inside the electricity.

---

# 11. Camera feedback

Spawn pulses:
- subtle shake
- occasional stronger pulse

Throw:
- mild kinetic shake only
- do not shake so much that the spinning weapon becomes unreadable

Impact:
- strongest shake

Use existing APEX camera feedback architecture.

Do not build a competing shake system.

Repeated VFX must not create runaway stacked shake.

---

# 12. Visual hierarchy rule

Every state has one primary read:

### Spawn
"dangerous divine weapon is charging the arena"

### Held
"power concentrated in wielder + weapon"

### Throw
"violently spinning Stormbreaker"

### Impact
"divine electrical detonation"

Do not allow secondary effects to become more visually important than the weapon/event itself.