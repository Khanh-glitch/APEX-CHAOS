# Q5 / E03 — SCRAP SWARM: real two-wave cutover

Base: isolated Quest Q4I acceptance head `972c97ffa6bac2392e8b33d3c54e6faa3e95d36d`.

**Phase Q5a: native roster policy only; NOT E03 runtime completion.**

Canon: wave A exactly 3 hostiles ×280 HP, wave B exactly 4 ×220 HP. NEWBOT alone fights; T.O.T remains workshop-side. Real Arsenal damage, HP, pickups, J/K, cooldown and weapon spawning remain engine-owned, cadence 4.5 s and offensive cap 5. Never allow a timer, simulated KO, preset reward or checkpoint setter to sign a wave.

The Q5 pure module implements read-only authored roster/validation and a NEXT_WAVE/RETRY/COMPLETE classification over the ACTUAL Fighters supplied by the native runtime. It does not write HP, reset gun slots or award a win.

**Pending before E03 can PASS**: Gold-hosted E03 entry, native physical A→B seam keeping the same NEWBOT instance and Arsenal state, B's four true KOs, authenticated story acknowledgement to WEAPON_RAIN, desktop/mobile Chrome receipts, and owner visual sign-off. DO NOT mark E03 as implemented on the strength of the pure test.

Visual kinds `scout`, `bulwark`, `sentinel` provisionally reuse three original Gold families; final separation from the approved ROBOT PUNK RIVET requires source-image sign-off. No invented hero abilities or lore.

## Q5b implementation (feature cutover candidate, pending CI)
- Gold-owned checkpoint entry: SCRAP_SWARM -> mounted real Arsenal -> first real 1v3 roster.
- Wave A transitions ONLY after all three physical hostiles reach KO; no second match is started.
- 1.8 s authored alert/pulse/amber warning telegraphs the four wave-B spawn positions. Simulation freezes through the interlude (HP, weapon holders, cooldown, floor slots and active projectiles retained).
- Replaces only defeated A Fighter objects with four B Fighter instances. The original NEWBOT and real Arsenal match state, gun slots and projectiles remain unchanged.
- Wave B genuine last KO emits a real Quest result comic and only its acknowledgement can commit WEAPON_RAIN. NEWBOT KO leaves SCRAP_SWARM for retry. No fabricated story dialogue.
- Pending before FINAL: natural Chrome win+retry and actual-device visual/audio signoff; E04–E08 remain untouched.

## Q5o balancing iteration
A/B HP, unique real Fighter KOs, gun cap 5, fixed 4.5s cadence and NEWBOT status persistence are unchanged. One Quest-only immutable tuning object specifies slower scavenger body movement A=0.52, B=0.61 relative to normal Hero speed, one genuine PISTOL pickup on the first regular spawn cadence, and 1.8s Gold wave interlude. This is a readability and encounter-difficulty iteration; it must still pass natural Chrome victories and owner audiovisual signoff. It is not a license for forced KO or fake heals.
