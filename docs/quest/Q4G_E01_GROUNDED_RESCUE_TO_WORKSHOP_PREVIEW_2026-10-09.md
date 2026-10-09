# Q4G — Story E01 full native-to-panel rescue flow, preview only

Parent accepted Q4F: `25e0d2b0881a1972f5d4f2b568afd682159e7a55` (clean source from previously green HR-aware floor strike). Branch `quest/q4g-e01-rescue-story-from-q4f`.

Q4G does NOT convert the developer-only REFLEX preview into a production Story checkpoint. It makes the opt-in Story Preview play all E01 narrative beats in order, with the true Arena running only when no panel is being viewed:

1. R1 actual PISTOL accepted on T.O.T → first physical comic hold (Q4E3).
2. R2 reciprocal PISTOL on NEWBOT → retaliation comic → J system reveal.
3. Accepted HeroRework J then K via real executor; neither keydown nor opening/closing a comic equals a valid skill.
4. Both fighters truly <=500 HP and alive → one RIVET warning story hold. Physical Continue/Skip releases exactly ONE real Stormbreaker with the Quest-only closed, scoped rig authorization. Public technical release does NOT receive this capability. No hero control or fake HP setters.
5. Exact original Arsenal `aq_thrown` physically strikes the computed arena midpoint via Hero Rework's authoritative projectile pass; screen V9 discharge at that contact, 0 added HP damage. The Q4D technical proof checks the genuine floor-hit metadata; a miss never advances to cinematic.
6. Final grounded rescue scene → full black curtain → WORKSHOP **preview panel**, with approved network-identity system text only. No fabricated spoken lines or artistic assertion about ROBOT PUNK before exact Gold source asset is found. The white Gold OPERATOR is T.O.T; the other character's authoritative sprite remains a known presentation gap.
7. WORKSHOP Continue ends the preview while Arsenal stays in its proved safe-hold. Story Director and local save remain WAKE, and E02 cannot be reached via a fake preview. Exit cleans up.

Q4G Chrome harness tests the full real progression and physical clicks, accepted J/K, HP+projectile invariants, exact ground contact and V9, no save drift, WORKSHOP panel on 360x640 and desktop/mobile inputs. Existing Q4A headless eight native trials, CP04 FIRST WAKE, Bot/Local, all previous Q4E3 R1 checks and production build must stay green.

**Still outstanding for shipping:** author-approved RIVET "ROBOT PUNK" exact Gold asset provenance (V12 donor variants only scout/bulwark/reaver/sentinel/operator), final WORKSHOP dialogue/illustrations, authenticated WAKE entry and WORKSHOP Director save, E02 Story cutover, visual owner review. Current Story preview is not a completed encounter. No global Gold CSS/layout changes or production deployment.

## Native/Chrome acceptance — final Q4G runtime checkpoint

- Tested runtime commit: `384cef7b30e5ce43f53083a43c1191eb20ed425e`, clean after Q4F code-path debugging.
- Workflow: https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/37882746239 — **SUCCESS** (desktop and touch-mobile Chrome, Q4A 8-native organic E01, FIRST WAKE, Bot/Local, prod build).
- GitHub Actions screenshots, viewport reports and browser logs: artifact ID `11595211786`, `quest-q2-real-n-actors-and-browser` (53,300,166 bytes). Samples: `14-q4g-real-stormbreaker-ground-story*.png`, `15-q4g-workshop-preview-blackout*.png`, `16-q4g-workshop-phone*.png`.
- The real R2 pistol return-fire, accepted J cast, accepted K cast, both real <=500 HP, RIVET native rig release, one Arsenal Stormbreaker floor contact, V9 impact, final rescue panel, blackout and WORKSHOP preview each passed through Chrome mouse and emulated physical touch. HP preserved during story holds and floor suppression. No Story save/Director advancement.
- **Two real failures resolved rather than waived:** (1) Q4G.5 deferred the RIVET story modal until an already-established Q4B Arsenal safe hold, so Continue cannot race ahead of its authority. (2) Q4G.7 kept Continue/Skip **stationary** during entry animation; only artwork moves. Before Q4G.7 a fast mobile touch could land while the button was moving, leaving the scene one tap behind; the earlier Q4G.6 polling-only workaround was insufficient and CI stayed red. The final run passed both touch and desktop without synthetic `element.click()` or unbounded retriggering.
- **No art/Story acceptance implied.** WORKSHOP narrative is still a non-saving preview; startup WAKE and the Director transition must be authored/validated separately. Gold's global responsive overhaul belongs to the other owner branch. RIVET owner-identified "ROBOT PUNK" exact sprite mapping still needs provenance; do not assert unknown variant.
