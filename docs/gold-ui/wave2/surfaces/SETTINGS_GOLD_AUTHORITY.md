# APEX CHAOS — Settings Gold Product Authority

Status: PRODUCT/UX LOCKED — VISUAL GOLD PENDING.

## Role

Settings is a lightweight **global service overlay**, not another destination/world.

It must not compete visually with Home, Pick, Battle or Lucky Draw.

## Entry

Global gear opens the same Settings overlay from supported non-battle surfaces.

Do not build separate settings implementations per surface.

Active Battle Settings requires an explicit pause/input lifecycle authority; do not invent pause semantics merely to expose the drawer during combat.

## Visual identity

A compact mechanical service drawer/chassis integrated over the current surface.

Background remains perceptible.

No full-screen “systems laboratory.”

No giant blur.

Short 180–250 ms class of open/close motion is appropriate unless accepted visual source authors a different exact timing.

## V1 categories

Only:
- AUDIO
- EFFECTS
- CONTROLS

Do not add General/Account/Cloud/Notifications merely to fill navigation.

Account security belongs to Profile.

Language appears only when localization actually exists.

## Audio controls

- Music volume;
- SFX volume;
- Music on/off.

M key and UI toggle share one canonical `musicMuted` state.

Muting must not destroy remembered volume.

## Effects

- Screen Shake: Full / Reduced / Off.
- Flash Intensity: Full / Reduced.
- Screen Crack: Full / Reduced / Off.
- Ambient Effects: Full / Reduced.
- Reduced Motion: On / Off.

These control presentation only.

Do not expose Low/Medium/High graphics tiers until profiling demonstrates a real user need and defines what each tier changes.

## Controls

V1 is canonical control reference.

Known Gold authority includes:
- P1 J = A1;
- P1 K = A2;
- Local P2 1 = A1;
- Local P2 2 = A2;
- M = music.

Other movement/fire/pickup bindings must come from the real input authority, not this document.

No key rebinding until conflict resolution, save format and HUD hint propagation are centralized.

## Persistence

Settings save immediately; no SAVE SETTINGS button.

Device-local by default.

Do not sync graphics/touch settings blindly across devices.

## Performance

Changing effect preferences must not:
- remount arena;
- reset fight;
- recreate hero runtime;
- decode large assets on demand.

Expensive crack/result layers should already be persistent and conditionally presented.

## Accessibility

Reduced effects preserve combat readability and semantic states.

See `../manifests/GLOBAL_AUDIO_SETTINGS_AUTHORITY.md`.

## Prohibited drift

No account management.
No developer graphics panel.
No fake effect preview sandbox required in V1.
No duplicate music states.
No screen-specific settings forks.
