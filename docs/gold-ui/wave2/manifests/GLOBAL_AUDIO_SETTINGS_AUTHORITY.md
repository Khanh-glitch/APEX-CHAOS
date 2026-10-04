# APEX CHAOS — Global Audio + Device Settings Authority

This is product behavior authority for future integration. It does not modify Wave 1 code by itself.

## Theme authority

Theme track authority: **Forward Drive** as selected by owner.

There must be exactly one persistent theme playback authority per app session.

Navigation must not recreate the theme audio element or reset its playhead unless the app itself is reloaded or the owner explicitly changes this law.

## Surface policy

Theme CONTINUES:
- Home;
- Profile / Account;
- Dictionary / Combat Archive;
- Free Battle navigation;
- Fighter Pick.

Theme SUPPRESSED:
- Fighter Shop;
- Lucky Draw;
- Upgrade;
- Missions;
- active Battle;
- Battle Result.

Story / Quest: **TBD — no authority until story flow exists.**

Transitions between two suppressed surfaces must not briefly resume the theme.

## Suppression state model

Audibility depends on independent causes:
- `userMuted`;
- `surfaceSuppressed`;
- `visibilitySuppressed`.

Audible only if all are false and playback is allowed by browser policy.

Surface suppression pauses/fades while preserving playhead.

Window/tab hidden or blurred pauses the theme; returning resumes only if the active surface allows it and the user has not muted.

## M key

`M` = music mute/unmute only.

It must not:
- change BOT/LOCAL mode;
- mute combat SFX;
- reset playhead;
- toggle a donor/demo feature.

Unmute restores the previous music volume.

## Fade law

Fade only when audibility changes.

Examples:
- Home -> Profile: no fade.
- Home -> Dictionary: no fade.
- Home -> Pick: no fade.
- Pick -> Battle: fade out.
- Home -> Shop: fade out.
- Shop -> Home: fade in from same playhead.
- Shop -> Lucky Draw: remain suppressed; no music burst.
- Result -> Pick/Home: resume from same preserved playhead.

## Settings V1

Player-facing settings:
### Audio
- Music volume.
- SFX volume.
- Music on/off.

### Effects
- Screen Shake: Full / Reduced / Off.
- Flash Intensity: Full / Reduced.
- Screen Crack: Full / Reduced / Off.
- Ambient Effects: Full / Reduced.
- Reduced Motion: On / Off.

### Controls
- canonical control reference only in V1;
- no key rebinding until a centralized binding authority exists.

Do not expose a vague Low/Medium/High graphics selector merely to hide implementation performance problems.

## Device-local ownership

Audio/effects/control preferences are device-local by default.

They must not share the economic/player progression lifecycle.

A phone and a laptop may legitimately use different effect and control settings.

## Accessibility law

Reducing spectacle may never remove gameplay truth.

Examples:
- crack can be disabled;
- camera shake can be disabled;
- decorative particles can be reduced;
- critical/heal/skill availability distinction must remain readable;
- gameplay-relevant ice/trajectory/arena geometry remains represented.
