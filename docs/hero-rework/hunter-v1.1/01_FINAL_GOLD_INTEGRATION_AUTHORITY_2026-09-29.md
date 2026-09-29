# HUNTER FINAL GOLD INTEGRATION AUTHORITY — 2026-09-29

Status: OWNER-APPROVED GOLD PRESENTATION + GAMEPLAY V1.1 integration authority.

## Required source file

Canonical in-repo Gold authority:
`docs/hero-rework/hunter-v1.1/reference/HUNTER_GOLD_V10_EXACT_ROOT_TRAP.html`

This canonical repo file was bridged byte-for-byte from the owner-provided:
`HUNTER_ALT_FINAL_V10_EXACT_ROOT_TRAP(1).html`

Exact owner-source properties:
- SHA-256: `447cf549cceb955459eda4b74ef5a561c77fc2f574252783bc7921663578ae65`
- bytes: 3,671,159
- logical lines: 3,209

This exact V10 source supersedes:
- `HUNTER_ALT_FINAL_V9_ROOT_TRAP_SAFE_P(1).html`
- SHA-256 `c8cde28f346bbbd99de0c448ccfb396eae210e4928436850ef82b488d765fc88`

Read:
`docs/hero-rework/hunter-v1.1/03_GOLD_V10_SUPERSESSION_AUDIT_2026-09-29.md`

The V10 file still contains historical embedded labels such as `HUNTER FINAL V9 ROOT TRAP` / `FINAL V9`. Source identity is the canonical repo path + SHA-256 above; do not reject it because of stale internal labels.

The visible skill grammar remains:
- A2: `read -> coil -> snap -> correct -> catch`
- A1: `deploy -> unfold -> snap -> pin -> release`
- Passive: `incoming shot -> foreleg slip`

Do not substitute V9 or any older Hunter prototype.

No Arena/chat attachment is required for implementation. The canonical in-repo file above is the source of truth and MUST be verified from Git before Hunter work.

## Gameplay authority

Read:
`docs/hero-rework/hunter-v1.1/00_GAMEPLAY_CHECKPOINT_2026-09-29.md`

That checkpoint supersedes old Hunter gameplay where conflicting.

### A1 SNARE

- max charges 3
- starts 3/3
- recharge 6.5s per charge
- recharge sequentially
- max active traps 3
- the old single-cast 11s A1 cooldown is SUPERSEDED and must not remain as an additional cast lock
- trap trigger radius 46
- lifetime 6.0s
- root duration 1.25s

Three charges mean three available casts; they do NOT authorize skipping/compressing the gold body-placement choreography. A subsequent cast may occur when the signature cast animation is ready under normal ability-control rules.

Charge law:
- one successful accepted A1 cast consumes exactly one charge;
- if at least one charge remains, Hunter may cast A1 again after the authored cast/recovery is ready even while another charge is recharging;
- the old 11s `cdLeft` must not block these remaining-charge casts;
- when going from full to one missing charge, start one 6.5s recharge timer;
- spending another charge while that timer is already running does NOT reset the current recharge progress;
- when the timer completes, restore exactly one charge; if still below 3, immediately begin the next 6.5s sequential recharge;
- at 3/3, recharge stops;
- failed casts (dead/CC/condition/max-active-trap blocker) do not consume a charge and do not reset recharge progress;
- new match/rematch starts at 3/3;
- recharge should follow the same global cooldown-pause semantics as other ability recharge where applicable.

Registry/progression law:
- remove/supersede obsolete A1 `cooldown: 11` production gating;
- the cooldown-like progression knob for A1 should bind to the approved recharge interval, not an obsolete single-cast cooldown, while preserving the one-progression-knob structural law.

Charge truth must be visible in the existing skill/cooldown HUD or mode slot. Do not create a new Hunter-only HUD panel. At minimum the player must be able to read current A1 charges and the next-charge recharge state/time.

Each active production trap must own an independent copy of the gold trap presentation/lifecycle. Do not visually collapse three logical traps into one shared mutable trap state. A new cast must never reset, hide, or mutate an older still-active trap.

A1 event authority:
- ability activation begins the Hunter body deploy choreography;
- consume one charge only on a successful accepted cast;
- spawn/arm the logical trap at the authored PLANT moment, not immediately at button-down while the visual is still deploying;
- the logical trap center uses Hunter's authoritative production position at plant time;
- real opponent body entry into the armed trigger is the ONLY authority for captured/rooted state;
- trap snap/pin/capture presentation must follow that real trigger;
- an untriggered trap expiry must never fake a capture;
- release/cleanup follows real root/expiry lifecycle.

### A2 POUNCE

- cooldown 12s
- coil/wind-up 0.16s
- physical chase speed target ~2200 px/s
- max chase 0.50s
- continuously re-target/steer toward current opponent position
- swept body contact to prevent high-speed tunneling
- no teleport
- direct damage 0
- successful contact -> WEAK 3.0s
- WEAK incoming damage multiplier 1.25

Normal movement should be meaningfully chaseable. Exceptional relocation can still escape.

### PASSIVE KILLER INSTINCT

Enabled while opponent is Trapped OR Weak.

- eligible incoming projectile collision course only
- dodge chance 24%
- physical dodge distance 95
- anti-chain lockout 0.45s
- no invisibility
- no post-dodge invulnerability
- T6 excluded

## HARD presentation authority — what the HTML owns

The HTML is the golden master for what the player can perceive.

Preserve as faithfully as technically possible:

- Hunter silhouette and material identity;
- head/body/arm/scythe articulation;
- idle motion;
- anticipation and recovery;
- A1 body deploy motion;
- A1 authored post-plant snap/retreat/recover motion;
- V10 exact ROOT trap presentation and material/state renderer;
- trap unfolding, root-like mechanical tension, snap, pin, hold/release language;
- V10 segmented color/edge/glow/shadow material treatment;
- V10 late additive trap FX pass and depth layering;
- A2 read/coil/snap/correction/catch choreography;
- visual timing and rhythm;
- distortion/refractive language where safe;
- particles, dust, sparks, glints, ribbons and contact language;
- passive foreleg-slip presentation;
- prey/WEAK/snared visual treatment where applicable;
- authored relative scale/hierarchy;
- hit-stop / dilation / camera handshake translated into APEX without taking over global camera authority.

### A1 gold-motion mapping

For A1 specifically: do NOT invent new recoil duration or easing. Follow the gold HTML implementation.

The standalone HTML stages Hunter on one side of a horizontal demo and therefore uses fixed world-X offsets such as:
- trap presentation staged slightly forward from Hunter;
- RECOVER pulling `h.x` toward `h.px - 55`.

Those fixed left/right coordinates are DEMO staging, not permission to make production Hunter always recoil left.

Production mapping law:
- capture Hunter's last meaningful pre-cast movement direction;
- map the gold forward/retreat axis onto that direction;
- the post-plant yank must travel opposite the pre-cast movement direction;
- if pre-cast speed is effectively zero, use the last meaningful locomotion/facing direction as fallback;
- preserve the gold temporal profile, articulation, spring response and perceptual strength;
- the logical trap placement/collision center follows the production gameplay authority, not a demo-only fixed world offset.

The snap-back is GAMEPLAY PHYSICAL MOVEMENT:
- authoritative Hunter body/hitbox and rendered rig remain aligned;
- it is not a renderer-only offset;
- resolve/clamp against arena/world collision rather than passing through geometry;
- if geometry blocks the full retreat, shorten the physical displacement instead of visually separating the actor from its hitbox;
- after the gold recovery completes, hand control back to normal APEX locomotion cleanly without a stale forced velocity.

### A2 gold-motion mapping

There is an explicit owner-approved conflict between the standalone demo timing and Hunter V1.1 usability.

The gold HTML standalone prelaunch contains a long READ + COIL + HOLD sequence (approximately 0.665s total), while production V1.1 explicitly requires a short 0.16s prelaunch/coil for easier play.

Therefore:
- production TOTAL prelaunch is 0.16s;
- do NOT restore the standalone ~0.665s delay;
- preserve the gold ordering, poses, compression, anticipation, energy convergence, silhouette transformation and snap language;
- proportionally compress/re-time those prelaunch sub-beats into the approved 0.16s envelope rather than inventing a different anticipation;
- once launched, world movement uses continuous live-target chase and ~2200 px/s production authority;
- preserve the gold travel pose, ribbons/echoes, catch language and a readable correction accent;
- continuous steering must not spam a correction burst every frame: use the gold correction effect as a meaningful presentation beat while physics may steer continuously underneath.

Do not revert mechanics to the old one-vector or one-correction-only miss behavior merely to copy demo plumbing.

A2 event authority:
- launch presentation begins from the accepted cast after the 0.16s prelaunch;
- continuous steering controls the authoritative body path;
- a SWEPT REAL BODY COLLISION is the ONLY authority for a successful catch;
- apply WEAK and enter the gold CATCH/close presentation from that same real contact event;
- do not show a successful catch merely because an authored path endpoint/distance was reached;
- if the chase genuinely times out after an exceptional escape/relocation, recover without fake contact, Weak, or catch-close.

## SOFT adaptation authority — what APEX owns

Allowed to adapt only as necessary:

- world/local coordinate conversion;
- opponent and projectile source data;
- current movement vector mapping;
- swept collision implementation;
- wall/arena/body collision;
- multiple active trap ownership;
- ability-controller charge/recharge state;
- status storage;
- event routing;
- audio routing;
- render caching / DPR / performance implementation;
- teardown and lifecycle;
- camera integration so existing APEX camera remains authoritative;
- replacing demo prey/fake projectile with real opponent/projectile truth.

These adaptations must preserve the visible gold identity rather than redesign it.

Production asset/runtime law:
- store the exact V10 HTML in-repo as immutable authority/reference only;
- do NOT execute or parse the 3.67 MB authority HTML as part of normal production gameplay;
- extract/bridge the required source art into stable production assets/runtime structures as needed;
- decode/cache immutable Hunter/trap art once;
- generate V10-derived trap color/edge/glow/shadow material layers once per immutable source part;
- never rerun V10 image-data derivation independently for each active trap;
- three active traps share immutable source/material caches but own independent small mutable animation/lifecycle state;
- preserve V10's articulated per-root/per-blade/core spring behavior rather than restoring old whole-trap global squash/grow;
- do not create three redundant copies of decoded source imagery or large offscreen atlases merely because three traps exist;
- any optimization must be visually checked against the gold at normal game scale.

Precedence when there is a real conflict:
1. explicit owner-approved Hunter V1.1 gameplay/usability law;
2. gold HTML presentation/choreography;
3. APEX plumbing constraints.

This means A1 authored timing/easing is hard, while its fixed demo world-axis must be remapped to production movement direction. It also means A2's gold choreography is hard in identity/order, but the old long standalone prelaunch duration is superseded by the approved 0.16s production envelope.

## Forbidden shortcuts

Do not:
- replace Hunter with generic particles/shapes while leaving the gold rig unused;
- approximate the A1 snap-back with a generic reverse velocity if it visibly differs from gold;
- lock A2 to one initial heading;
- teleport A2;
- make a single mutable trap represent all three charges;
- invent new A1 visual timing/easing;
- restore the old long A2 standalone prelaunch delay in conflict with the approved 0.16s production usability law;
- use demo prey/fake bullets as production truth;
- rotate/redesign the entire actor based on convenience;
- weaken APEX locomotion globally to make the prototype fit;
- remove gold details solely to pass performance without first proving a bottleneck.

## Evidence requirement

Real-browser production evidence must include at minimum:

1. idle + normal locomotion;
2. A1 full body deploy -> plant -> authored snap/recover while moving in at least two opposite directions, proving the recoil maps against movement rather than always world-left;
3. one V10 trap full lifecycle clearly showing unfold -> armed -> tension -> snap -> pin -> release at normal game scale;
4. three separate A1 trap placements visible/owned independently plus truthful A1 charge/recharge HUD;
5. one trap root on real opponent body, with V10 snap/pin beginning from that real trigger;
6. clean ARMED trap with no permanent generic orb;
7. PIN mechanical pull/tension life without excessive visual noise;
8. trap expiry/release cleanup with V10 retract/fade;
9. A2 coil -> high-speed continuous chase -> real body contact;
10. A2 target changes direction during chase and Hunter follows;
11. A2 WEAK applied with zero direct skill damage;
12. passive projectile collision-course dodge while prey is Trapped/Weak;
13. passive does not trigger when prey state is absent;
14. T6 exclusion;
15. interaction with real Arsenal weapon/projectile environment;
16. no runtime errors / leaks after repeated skill use;
17. three simultaneous traps + normal Hunter rendering do not cause a material frame-time/memory regression, repeated source-art decode, or repeated V10 material derivation.

This is a gold-port task, not a new art-direction task.
