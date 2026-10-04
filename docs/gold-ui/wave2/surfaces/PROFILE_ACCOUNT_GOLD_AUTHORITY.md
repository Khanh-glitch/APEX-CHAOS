# APEX CHAOS — Profile / Account Gold Product Authority

Status: PRODUCT/UX LOCKED — VISUAL GOLD PENDING.

## Purpose

Answer four questions only:
1. Who is this player profile?
2. What broad progression/roster state belongs to it?
3. What records/achievements has it earned?
4. Is its progress device-only or secured?

Do not turn Profile into a second Home, Fighter Pick, Store or account-administration portal.

## Naming / lore safety

Do not canonically call the player “Pilot” until Story/lore explicitly establishes that role.

Implementation/data vocabulary: Player Profile.

World-facing prototype may use neutral registry/record language without inventing faction ownership.

## Surface identity

A quiet **APEX Player Record** / combat registry terminal integrated with the Home world.

Profile should feel calmer than Pick, Battle, Lucky Draw or Story.

It is information machinery, not a cinematic destination.

## Entry / exit

Home -> Profile should feel like opening an embedded terminal/drawer rather than traveling to a new world.

Preferred behavior:
- current Home context remains perceptible;
- short mechanical open/close;
- no large loading transition;
- no theme interruption.

## Primary structure

Main record has three content modes:
- ROSTER
- PROGRESS
- RECORD

Account/security is a secondary identity control, not a fourth equal gameplay tab.

### Identity strip
Required:
- avatar/portrait;
- display name;
- save status.

Do not require:
- title;
- emblem;
- frame;
- public ID;
- device count

until those systems have real product value.

### Roster
Shows ownership summary and owned fighter records.
Not a Shop. No purchase CTA.

### Progress
May show real progression domains only.
Story data must remain absent/neutral until Story authority exists.
Do not fabricate chapter values in production.

### Record
Contains combat record when canonical metrics exist.
Achievements belong here.
Do not add match-history infrastructure before it has product value.

## Save states

Player-facing:
- DEVICE SAVE
- SECURED
- SYNCING
- OFFLINE

Primary guest CTA:
**SECURE PROGRESS**

## Secure Progress interaction

Remain inside Profile via an inner tray/modal.

Supported product choices may include:
- Google;
- email code / OTP.

Do not show passwords unless authentication product direction changes.

Provider identity must not overwrite APEX avatar/profile identity.

## Existing-account conflict

Cloud economic identity is canonical once authenticated.

Do not ask the player to manually act as a database administrator.

Only surface a conflict UI when a real safe migration decision cannot be automated.

Never blindly add local AC or economic fighter entitlements to cloud state after public economy launch.

## Avatar

V1 may reuse owned fighter avatar art.

Locked fighters are not selectable.

Do not add hero-specific full-screen VFX merely for Profile.

## Audio

Theme continues with the same playhead.

No new music track.

Small UI/mechanical SFX may be used.

## Responsive

Desktop: one physical record chassis, not a grid of cards.

Mobile portrait:
- identity strip/top;
- compact ROSTER / PROGRESS / RECORD selector;
- scrollable content;
- Secure Progress CTA visible without excessive scrolling when relevant.

Mobile landscape:
- compact identity area + record content;
- not a desktop stage uniformly scaled down.

## Data boundary

Reads PlayerProfileAuthority and Auth/Sync projection.

Does not read localStorage or provider SDK directly.

## Prohibited drift

No:
- “Pilot” lore lock without story authority;
- giant hero showcase;
- Store CTA;
- AC-as-profile-centerpiece;
- 20-stat dashboard;
- fake progression values;
- separate Achievements Home route;
- account SDK queries inside visual source.
