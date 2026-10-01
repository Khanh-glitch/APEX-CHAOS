# ROBOT FINAL — REPO ASSET MAP

This branch is self-contained. Arena must not ask the owner for a ZIP.

## Visual authority
- `docs/hero-rework/robot-final/reference/ROBOT_VISUAL_AUTHORITY.html`

## Exact owner-source SFX masters
- `tools/hero-rework/source/robot-final/source-sfx/robot_a1_lock.wav`
- `tools/hero-rework/source/robot-final/source-sfx/robot_a1_no_weapon.mp3`
- `tools/hero-rework/source/robot-final/source-sfx/robot_a1_dash.wav`
- `tools/hero-rework/source/robot-final/source-sfx/robot_a2_activate.wav`
- `tools/hero-rework/source/robot-final/source-sfx/robot_a2_armor_hit.wav`
- `tools/hero-rework/source/robot-final/source-sfx/robot_a2_end.wav`
- `tools/hero-rework/source/robot-final/source-sfx/robot_passive_milestone.mp3`
- `tools/hero-rework/source/robot-final/source-sfx/robot_passive_upgrade.mp3`

These are the exact owner-provided bytes. Verify against `SHA256SUMS.txt` before coding.

## Pre-bridged runtime copies
The same eight cues are also present under:

`tools/hero-rework/source/robot-final/sfx/`

as mono 48 kHz / 160 kbps MP3 delivery copies. These were made only to fit APEX's existing compressed runtime-delivery pattern. They are convenience inputs, not a new sound design. The Agent may rematerialize from the exact source masters if the project's audio policy requires a different encoder/path, but it must not substitute, layer, remix or re-author the sounds.

## Critical A2 correction
- ACTIVATE = `robot_a2_activate` (Robot Step)
- ARMOR HIT = `robot_a2_armor_hit` (Mechanical Crate Pick Up)
- END/CLOSE = `robot_a2_end` (Robotic Engine Malfunction)
- rejected Shuffling Gear file is absent
- no clamp SFX
- no separate heavy armor-hit SFX

## Agent task
Read `docs/hero-rework/robot-final/AGENT_PROMPT.md` and execute it in one serious implementation pass from this branch.
