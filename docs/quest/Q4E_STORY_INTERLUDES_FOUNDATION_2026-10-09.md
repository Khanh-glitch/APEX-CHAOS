# Quest Q4E.1 — Story beats authority (NOT completed comic/cinematic)
Base Q4D.2 `afe591287e0a0a527f4913a5afd43fa2ed6e0ba8`. Branch `quest/q4e-story-interludes-from-q4d`.

Decision: Build the narrative layer NOW so E01 has actual story entry, in-engine reactions after accepted pistol impact, a real ground-suppression cinematic, and WORKSHOP arrival. Delaying this until all eight encounters exist would force rewrites of combat holds, transition ownership and checkpoints.

The future presentation uses three forms: IN_ENGINE_HOLD, PANELS (illustrated comic/visual-novel beats), and CINEMATIC. One schema controls cue IDs, speaker/media placeholders, voice/subtitle and skip/retry semantics. Locked dialogue is reused verbatim; currently missing exact dialogue remains EMPTY, not manufactured. Existing Gold responsive-grid owner is independent. Existing Gold door transition remains one transition owner, not a separate full-screen mechanism.

**This slice only:** pure per-match receipt-driven narrative cue collector, strict R1/R2/real J/K/HP checks, Q4D rig-technical settlement condition, ordered exactly-once cue queue. Draining/skip cannot save or complete the Quest. Includes WAKE and WORKSHOP scenes as *catalog metadata only*; neither is automatically entered. It does NOT yet stop fighters after first R1 hit, draw panels, perform ground Stormbreaker contact, blackout or advance checkpoint. The dedicated in-engine hold and rich scene compositor are the NEXT slices, before E01 is shipped.

Owner mapping: T.O.T is milky-white Gold OPERATOR. RIVET identity is owner-selected Gold ROBOT PUNK (exact source asset provenance must be verified). Only the other three Gold creatures are distinct regular enemy designs. RIVET's Stormbreaker strikes the floor between the two fighters, not either already-low-HP ally.

Architecture gate: Do NOT write combat HP/projectiles or Quest localStorage from story view. Scene rendering and combat pause need a single authenticated lease with cancel/timeout, responsive/adaptive Gold design and Chrome real-frame screenshots. Real 45–60s first drop, retry/resume/skip and QIA Story checkpoints remain acceptance gates.