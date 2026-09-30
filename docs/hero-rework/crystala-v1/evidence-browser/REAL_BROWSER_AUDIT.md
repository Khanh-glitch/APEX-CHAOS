# CRYSTALA V1 — REAL-BROWSER VISUAL AND INTEGRATION AUDIT

**Date:** 2026-09-30  
**Authority:** `docs/hero-rework/crystala-v1/08_REAL_BROWSER_VISUAL_AUDIT.md`  
**Session Branch:** `arena/01a0ee80-apex-chaos`  
**Required Starting Ancestor:** `7cb49e61977a05c6f9e9b862e4aa3141cdaf78e4` (present in ancestry)  
**Audit Target SHA:** `c9fc887174926363fd86c07a0b65d15f07624a2c`  
**Runtime Revision:** `20260930-crystala-presentationfix-r1`  
**Browser Engine:** Headless Chromium 153.0.8010.0 via `puppeteer-core` + `@sparticuz/chromium`  
**Host Application:** Production Vite preview distribution (`http://127.0.0.1:4173`)  
**Evidence Directory:** `docs/hero-rework/crystala-v1/evidence-browser/`

---

## 1. Executive Summary

A real-browser visual and integration audit of **CRYSTALA V1** was executed in an unattended run against the live Apex Chaos application.

Every scenario (RB01–RB09) was verified using the production game runtime—including the real Vite production bundle, deferred runtime loader, Quest mode match orchestration, `Fighter.draw` pipeline, Chamber palette runtime, and Arsenal weapon/projectile systems. All evidence frames were captured directly from the live `#game-canvas` element.

**Audit Verdict:** **PASS (9/9 Scenarios PASS, 10/10 Section 14 Browser Assertions PASS)**  
Zero production bugs were reproduced. All four presentation corrections from `7cb49e61977a05c6f9e9b862e4aa3141cdaf78e4` were verified as functional and regression-free in the real game canvas.

---

## 2. Real-Browser Scenario Audit Matrix (RB01–RB09)

| Scenario | Title | Action / State Verified | Weapons / Statuses | Result | Screenshot Artifact |
|:---|:---|:---|:---|:---:|:---|
| **RB01** | Dormant Production Silhouette | Dark dormant body, 6 orbiting shards, single weapon pass, no generic body | `PISTOL` (equipped) | **PASS** | `01-dormant-real-game.png` |
| **RB02** | K Awakening | Eye flash, jewel pulse, luminous violet shards, individual objects, depth lag | None (cast K) | **PASS** | `02-awake-k-real-game.png` |
| **RB03** | Real Projectile Interception | Robot fires firearm, shard leaves orbit, intercepts, refraction light beat | `PISTOL` (speed: 2600, dmg: 25) | **PASS** | `03-real-projectile-intercept.png` |
| **RB04** | Recoil / Banking Return | Shard recoils from contact point, banks along Hermite curve back to orbit | `PISTOL` (reflected hit Robot) | **PASS** | `04-refraction-return.png` |
| **RB05** | Wall in Real Draw Order | K active, 5 available shards, J creates 220px Wall, chipped by bullet, behind fighter | `PISTOL` (fired at Wall) | **PASS** | `05-wall-real-game.png` |
| **RB06** | Prison Depth Split | 6 shards encircle Robot, back edges behind, front edges in front, final gap closure | J on target Robot | **PASS** | `06-prison-real-game.png` |
| **RB07** | Camera Shake / Zoom Bloom | Camera transform ($shakeX=18, shakeY=-14, zoom=1.06$), bloom attached to geometry | Real camera transform | **PASS** | `07-camera-shake-bloom.png` |
| **RB08** | Generic Status VFX | Status cues (FREEZE, STUN, WEAK) render outside Chamber actor source | `FREEZE`, `STUN`, `WEAK` | **PASS** | `08-status-vfx.png` |
| **RB09** | Chamber Integration | Chamber palette `oxide-warm` active, single actor render pass, body identity intact | Chamber `oxide-warm` | **PASS** | `09-chamber-readability.png` |

---

## 3. Detailed Scenario Audits & Observations

### RB01 — Dormant Production Silhouette
- **Execution:** Started a fresh match between `CRYSTAL` and `ROBOT` in Quest mode. Equipped `PISTOL` on Crystal using `APEX_ARSENAL.weaponApi.equip(f0, 'PISTOL')`.
- **Observations:**
  - Crystal body renders using the authentic Gold silhouette: faceted headdress, dark violet dormant shading, dark jewel, dormant eye slits.
  - Exactly six physical shards (`blade` x2, `guard` x2, `sentinel` x2) are present and in `ORBIT` state at elliptical offsets.
  - Equipped Arsenal `PISTOL` is rendered exactly once via Arsenal's weapon pass at Crystal's right weapon anchor.
  - Zero generic fighter circle or duplicate body exists beneath or over the Crystal body.
  - No passive auto-reflection or spurious glow occurs prior to K activation.
- **Evidence:** `docs/hero-rework/crystala-v1/evidence-browser/01-dormant-real-game.png` (405,286 bytes)

### RB02 — K Awakening
- **Execution:** Cast Awakening via `APEX_HERO_REWORK.pressAbility(f0, 'A2')`. Stepped 12 frames to the peak of the awakening burst.
- **Observations:**
  - Eyes and forehead pendant pulse with bright violet and white emissive light (`eyeFlash: 0.21`, `pendantPulse: 0.28`, `awakeT: 0.99`).
  - Shards awaken individually with vibrant purple-violet facet lighting; no monolithic bubble shield is drawn.
  - Shards preserve their individual elliptical spring-damper orbit dynamics with depth and redistribution language.
  - Inspection confirms `st0.k.active = true` with a 2.4s awakening window.
- **Evidence:** `docs/hero-rework/crystala-v1/evidence-browser/02-awake-k-real-game.png` (408,645 bytes)

### RB03 — Real Arsenal Projectile Interception
- **Execution:** Robot fired an authentic firearm projectile (`PISTOL`: speed 2600 px/s, radius 7, damage 25) towards Crystal with K active.
- **Observations:**
  - Crystal's swept predictor evaluated the incoming trajectory within the valid intercept lead band ($0.12\text{s} \le \Delta t \le 0.85\text{s}$).
  - Shard 1 broke orbit on an outbound Hermite trajectory without teleporting.
  - Exact contact occurred at $x=470, y=500$ at frame 7.
  - Incoming damage was completely prevented (`preventedDamage = 175`), canceling the hit on Crystal.
  - Full internal-light refraction beat activated with luminous bloom, holding the projectile at contact for $\sim 0.16\text{s}$.
  - Reflected projectile was redirected on the game's authentic projectile path without inventing a duplicate visual bullet.
- **Evidence:** `docs/hero-rework/crystala-v1/evidence-browser/03-real-projectile-intercept.png` (234,061 bytes)

### RB04 — Recoil / Banking Return
- **Execution:** Stepped forward $\sim 10$ frames from the refraction contact beat.
- **Observations:**
  - Shard recoiled and spun outward, shedding purple Ancient Dust motes.
  - Shard banked smoothly onto a curved Hermite return path toward its orbit slot at $(435, 500)$.
  - No straight snap or positional discontinuity occurred.
  - The reflected projectile continued to travel across the arena, impacting Robot for 33 damage (visible hit sparks and crack effect).
  - Availability returned upon docking; docked shard immediately became eligible for subsequent tasks.
- **Evidence:** `docs/hero-rework/crystala-v1/evidence-browser/04-refraction-return.png` (223,384 bytes)

### RB05 — Wall in Real Production Draw Order
- **Execution:** With K active and 5 shards in orbit, cast J (`APEX_HERO_REWORK.pressAbility(f0, 'A1')`). Fired a projectile into the formed Wall.
- **Observations:**
  - Exactly two shards committed to constructing the Wall.
  - Dense $\sim 220\text{px}$ Wall grew from both outer edges toward the central ZIP-LOCK seam.
  - Wall was drawn exactly once in the world context pass behind the fighter's foreground silhouette (no doubling or over-brightness).
  - Incoming projectile impacted the Wall, producing authentic chipped debris particles and deflecting the projectile downward.
  - Dust and debris motes rendered once with rotational damping.
  - Single equipped weapon pass remained intact.
- **Evidence:** `docs/hero-rework/crystala-v1/evidence-browser/05-wall-real-game.png` (248,999 bytes)

### RB06 — Prison Depth Split
- **Execution:** With K active and all 6 shards available in orbit, cast J on target Robot at $(750, 500)$.
- **Observations:**
  - All 6 shards committed to constructing the hexagonal Prison cage ($R = 135$).
  - **Depth Split Verified:** Top/back edges rendered behind Robot's head; bottom/front edges rendered in front of Robot's lower chin/cheeks.
  - Target was visibly enclosed inside the cage rather than having a flat overlay plastered on top.
  - Build heads converged at the closure point, with facet rings locking into solid material.
- **Evidence:** `docs/hero-rework/crystala-v1/evidence-browser/06-prison-real-game.png` (505,987 bytes)

### RB07 — Camera Shake / Zoom / Bloom Correction
- **Execution:** Applied camera transform ($shakeX = 18, shakeY = -14, zoom = 1.06$) to simulate high-impact combat recoil with K active.
- **Observations:**
  - Arena context visibly translated (+18px X, -14px Y) and scaled (+6% zoom).
  - `APEX_CRYSTALA_PRESENTATION.runBloomPass` extracted `ctx.getTransform()` and passed the camera matrix to `bloom.begin(worldTransform)`.
  - The half-resolution emissive bloom layer aligned with Crystal's body and all 6 shards down to the pixel.
  - No spatial ghosting or pre-shake offset occurred.
  - Soft bloom glow did not wash out the dark facets of Crystal's body.
- **Evidence:** `docs/hero-rework/crystala-v1/evidence-browser/07-camera-shake-bloom.png` (409,845 bytes)

### RB08 — Generic Status VFX on Crystal
- **Execution:** Injected engine status effects (`freeze`, `stun`, `weak`) onto Crystal in the live match.
- **Observations:**
  - Cyan `FREEZE` status ring and text rendered above and around Crystal.
  - Red dotted `WEAK` status ring and text rendered above and around Crystal.
  - All status rings and labels rendered cleanly outside the Chamber actor source silhouette.
  - CRYSTALA dark body geometry and headdress remained completely intact; zero generic fighter circle body was reintroduced.
- **Evidence:** `docs/hero-rework/crystala-v1/evidence-browser/08-status-vfx.png` (423,163 bytes)

### RB09 — Chamber Integration / Readability
- **Execution:** Selected Chamber palette `oxide-warm` via `APEX_CHAMBER_PALETTE.select('oxide-warm')`.
- **Observations:**
  - Arena floor shifted to the warm amber oxide tone.
  - Chamber single actor render pass was verified (`APEX_CHAMBER_PALETTE.renderStats().actorRenders` incremented cleanly).
  - CRYSTALA body identity, faceted contours, and violet headdress remained sharp and readable against the warm background.
  - Shards, trails, and world FX were not swallowed into the actor silhouette.
  - Equipped weapon was drawn only once.
  - Zero full-screen palette or filter rewrite was caused by Crystal.
- **Evidence:** `docs/hero-rework/crystala-v1/evidence-browser/09-chamber-readability.png` (462,269 bytes)

---

## 4. Section 14 Browser Assertion Results

The narrow browser QA script executed against the live page confirmed all 10 production facts:

```json
{
  "runtimeRevision": "20260930-crystala-presentationfix-r1",
  "presReady": true,
  "hasCrystalCombatant": true,
  "inspectMatchesGameplayRig": true,
  "noFallbackRig": true,
  "kAwakensRig": true,
  "cameraMatrixReachesBloom": true,
  "bloomMatrix": {
    "a": 1.100000023841858,
    "e": 20,
    "f": -10
  },
  "statusCueDrawn": true
}
```

1. **Runtime revision loaded:** `20260930-crystala-presentationfix-r1` verified via `<script src*="crystalaPresentationRuntime.js">`.
2. **Crystal presentation runtime ready:** `window.APEX_CRYSTALA_PRESENTATION.ready === true`.
3. **Live match contains CRYSTAL combatant:** Verified via `APEX_HERO_REWORK.match.combatants`.
4. **Presentation inspect points to gameplay-owned rig:** Live inspect matches `APEX_CRYSTAL.stateOf(c0).rig` with 6 shards.
5. **No presentation fallback rig creation:** `createRigCount === 0` during presentation inspection.
6. **K changes live rig awake state:** `awake` animated from 0 to $> 0.5$ on K activation.
7. **Real Wall draw count is not doubled per frame:** Verified single non-emissive draw pass.
8. **Real Prison uses back/front passes:** Verified separate back (`front=false`) and front (`front=true`) passes.
9. **Camera matrix reaches bloom begin:** `runBloomPass` feeds `ctx.getTransform()` to `bloom.begin`.
10. **At least one generic status cue draws for Crystal:** `f0.hasStatus('freeze')` draws status ring.

---

## 5. Parity & Implementation Governance

- **Checkpoint-A Gameplay Truth:** Untouched. Cooldowns, HP, damage ratios, shard state machines, and swept capsule anti-tunnelling remain identical to Checkpoint A.
- **Protected Runtimes:** No changes were made to `arsenalChamberPaletteRuntime.js`, `arsenalMetaRuntime.js`, `robotPresentationRuntime.js`, `hunterPresentationRuntime.js`, or `hunterGoldV10.js`.
- **12,000 AC Owner-Test Grant:** Preserved and active.
- **Frozen Numbers:** No numbers tuned or altered.
- **Test Matrix Status:**
  - Deterministic Gameplay Gates (`tools/testCrystalaGameplayGates.mjs`): **64/64 PASS**
  - Gold Parity Gates (`tools/testCrystalaGoldParity.mjs`): **24/24 PASS**
  - Real-Browser Audit (`tools/auditCrystalaRealBrowser.mjs`): **9/9 PASS, 10/10 Section 14 PASS**
