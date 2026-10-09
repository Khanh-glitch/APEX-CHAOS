# B6f — TRUE Fighter/Arsenal integration fixture (NOT public E06)

This is a deliberate halfway **native proof** before gameplay/Gold ownership. Gated behind `__APEX_TEST_MODE` AND localhost only. It creates three real Fighter allies and actual A/B/C enemies from the owner canon. It uses the same `Fighter.update`, reflect collisions, `Fighter.takeDamage`, native Arsenal `SPAWN.trySpawnSlot`, gun holders, and queued projectile collision. The B6d transactional lifecycle replaces defeated hostiles *without replacing allies*, their HP, cooldown or guns. B6e intercepts accepted real Fighter damage at the retreat threshold before a KO occurs. Only real KO and all-withdrawn receipts can complete/retry.

Do not mistake `QUEST_BREACH_WAVES_COMPLETE` in internal fixture logs for a signed Quest story checkpoint. No E06 player entry, story result or reward is wired; Director still disallows E06 native completion. RIVET rig-to-frontline choreography and allied J/K behavior require further native design and QA, not a silent automatic rig or fabricated kit. Everything outside the localhost test fixture remains the previously green B5g Gold E01–E05 gameplay.

Next gates: native four-wave no-skip negative tests, physical bullet KO on all 3 waves, genuine 100HP damage interception in Arsenal, then Gold E06 story route and manual playtest for rig/camera/J-K.
