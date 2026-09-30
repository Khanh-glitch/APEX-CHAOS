# CRYSTALA V2 — MINIMAL DELTA AUTHORITY
Date: 2026-09-30
Status: owner scope correction; supersedes the earlier over-broad V2 draft
Target branch: arena/01a0ee80-apex-chaos

## 0. Hard scope rule

This is NOT a redesign of CRYSTALA.

Only the items explicitly listed in Sections 1–3 are allowed to change.

Everything else that is currently correct stays exactly as it is:
- HEXA condition/path/mechanic/numbers/visuals remain unchanged;
- Passive Refraction remains unchanged;
- Gold motion/VFX remain unchanged except K timing/radius retiming required below;
- six independent shard occupancy remains unchanged;
- current construct placement/orientation remains unchanged;
- current performance optimizations/caches remain unchanged;
- T6, provenance, anti-loop and shared projectile authority remain unchanged.

Do not invent new weaknesses, new status tags, new HUD systems, new resource layers, new escape laws, new Hexa rules, new reflection rules, or new cross-hero mechanics unless strictly required to implement the three deltas below.

---

## 1. J WALL — ONLY FOUR CHANGES

### 1.1 Wall availability / shard choice
WALL no longer universally requires K.

Preserve the current HEXA path exactly as live code resolves it today.

Routing rule:
1. First evaluate the existing live HEXA eligibility/path with no semantic changes.
2. If live HEXA is not eligible, J may attempt WALL.
3. WALL always uses the two largest Gold shards:
   - BLADE L = shard id 0
   - BLADE R = shard id 1
4. WALL succeeds only if both Blade shards are currently free/ORBIT.
5. If either Blade is busy/returning/anchored, WALL fails with no cooldown.
6. WALL may therefore be cast while K is off, or while K is on but the existing HEXA path is not eligible.

Do not alter HEXA to make this routing work. Isolate the new Wall fallback.

### 1.2 Wall HP
Change WALL total HP:
- 120 -> **80**

Keep:
- width 220
- current smart placement between Crystal/opponent
- current Gold build/material timing
- current max solid lifetime 4.0 s
- current physical collision geometry
- current fixed-plane/specular reflection behavior

### 1.3 Breaking-shot law
Current live Wall reflects first and then applies structural damage.

Change WALL only:

If incoming projectile structural damage is LESS than remaining Wall HP:
- reflect exactly as current live Wall does;
- apply Passive exactly as current live Wall does;
- then reduce Wall HP.

If incoming projectile structural damage is GREATER THAN OR EQUAL TO remaining Wall HP:
- apply the structural hit;
- destroy/break the Wall;
- that SAME breaking projectile is NOT reflected by Wall;
- it keeps its current owner/controller, velocity, crit/provenance and full current damage;
- it continues through the broken Wall.

Do not apply this rule to HEXA. HEXA keeps its live break/reflect ordering unchanged.

Do not invent residual-damage arithmetic. The breaking projectile keeps full current projectile damage.

### 1.4 J cooldown
Successful J cooldown:
- current 1.5 s -> **8.0 s**

Failure still consumes no cooldown.

Do not change HEXA's internal mechanic/numbers because J cooldown changed.

---

## 2. K — ONLY ALGORITHM, RADII AND TUNING NUMBERS CHANGE

Current K's six independent shard slots are already correct and must remain.

### 2.1 Remove smart hit prediction
Remove K's requirement to predict:
- whether the projectile will definitely hit Crystal;
- earliest body-hit target;
- damage priority;
- blocker-first body prediction used as a prerequisite for assigning a shard.

New trigger is deliberately simpler:

An eligible hostile reflectable projectile entering K's read radius is enough to request one free shard.

This intentionally means spray, spread and near-miss projectiles can waste shard capacity.

Keep existing exclusions:
- T6/non-reflectable exclusions
- already Crystal-reflected exclusions
- same projectile cannot own multiple shard jobs
- one shard cannot own multiple jobs

Do not add extra new categories of counterplay beyond the natural consequences of this simpler acquisition rule.

### 2.2 K radii
Live fighter radius = 75 px.
Live fighter diameter = 150 px.

Owner target:
successful interception should happen about 1.5 fighter diameters outside the fighter edge.

Therefore fixed first-pass values:
- K projectile read radius: **450 px**
- K successful interception/contact ring: **300 px from Crystal center**

The 300 px contact ring comes from:
75 + (1.5 × 150) = 300.

Remove the current inward rescue sequence:
- 180
- 150
- 120
- 90

Successful K interception should target the real 300 px ring instead of collapsing inward near the body.

The shard may travel faster to reach that far contact point, but:
- keep Gold Hermite/facet motion grammar;
- keep real moving-shard/projectile swept contact;
- never teleport;
- never consume/delete the projectile merely because it was assigned.

### 2.3 K return time
Increase successful contact -> visible dock total:
- 1.20 s -> **1.60 s**

Preserve the existing Gold internal-refraction and recoil beats.
Retune only the return leg as necessary to reach the new 1.60 s total.

Each shard remains independent:
- shard A returning never blocks shards B–F from accepting jobs;
- a shard becomes available exactly when that shard visibly docks.

### 2.4 K cooldown
Change K cooldown:
- 8.0 s -> **12.0 s**

Keep K active duration:
- **2.4 s**

Keep six shards.

Keep Passive reflection at its existing value.

---

## 3. HEXA — EXPLICIT NON-CHANGE

HEXA exists only in this document to prevent accidental edits.

Do NOT change:
- its existing live eligibility logic;
- its relationship to K;
- its requirement for six free shards as currently implemented;
- radius;
- facet count;
- facet HP;
- build/closure timing;
- solid lifetime;
- reflect-first/break ordering;
- physical gap behavior;
- Gold visuals;
- control behavior;
- own-projectile interaction;
- T6 behavior.

In particular:
- DO NOT change facet HP from 75.
- DO NOT add a new two-facet escape requirement.
- DO NOT add a new "resonant" mechanic; current behavior already remains authority.
- DO NOT reinterpret the owner's explanation of why Hexa is useful as a request to redesign Hexa.

If implementing Wall/K would require modifying Hexa semantics, stop and report the conflict instead of silently changing Hexa.

---

## 4. Why these deltas exist

This section explains intent only; it does not authorize extra mechanics.

WALL:
- smart fixed-position defense;
- strong against a spray/burst wave;
- weak against high single-shot structural damage;
- breaking shot passing through creates the intended sniper/Magnum/precision weakness.

K:
- preferred answer to isolated heavy/precision shots because shards have no structural HP;
- weaker into many bullets because each projectile can occupy one of six independent shards;
- simple radius acquisition intentionally wastes capacity on spray/spread/near misses;
- farther 300 px contact makes the defense visually readable and powerful.

HEXA:
- already serves a different role: spatial control / trapping / zoning;
- its current mechanic already expresses that role;
- no redesign is needed.

---

## 5. Minimal acceptance gates

### Wall
1. Existing live HEXA-eligible state still produces the exact existing HEXA behavior.
2. K off + Blade 0 and 1 ORBIT + J ready -> Wall succeeds.
3. Either Blade busy -> Wall fails, no cooldown.
4. Wall shardIds are exactly [0,1].
5. Wall HP exactly 80.
6. J successful cooldown exactly 8.0 s.
7. Low-damage projectile that does not break Wall reflects exactly as before.
8. Projectile whose structural damage >= remaining Wall HP breaks Wall and is NOT reflected.
9. That breaking projectile preserves full current damage/provenance and continues.

### K
10. K cooldown exactly 12.0 s; active remains 2.4 s.
11. Read radius exactly 450 px.
12. Successful contact target radius approximately 300 px.
13. Old 180/150/120/90 inward rescue is absent from gameplay assignment.
14. A hostile eligible projectile entering 450 can claim a free shard even if the old body-hit predictor would have classified it as a miss.
15. Six independent simultaneous jobs still use six distinct shards.
16. Individual dock reopens only that shard.
17. Successful contact->dock is approximately 1.60 s.
18. Real swept shard/projectile collision remains mandatory.

### Regression / non-change
19. HEXA live numbers and semantics unchanged.
20. Passive unchanged.
21. T6 unchanged.
22. Gold visual language unchanged.
23. Current no-quality-cut performance optimizations unchanged.
24. Robot/Hunter/other heroes unchanged.

---

## 6. Complexity / file locality

Expected primary edits:
- public/game/hero-rework/heroRegistry.js
- public/game/hero-rework/crystalGameplayRuntime.js
- tools/testCrystalaGameplayGates.mjs
- tools/analyzeCrystalaDecisionTradeoffs.mjs only as needed to reflect Wall/K changes
- runtime revision + lock after final implementation

Touch shared runtime only if the breaking Wall projectile cannot continue correctly using the existing Crystal collision contract.
If shared runtime must be touched:
- keep the edit Crystal-specific and minimal;
- add a deterministic regression gate;
- do not refactor unrelated projectile authority.

Presentation code should not need redesign. Only adjust truthful timing/readability if the new 300 px K contact cannot be represented by existing Gold motion without a small adaptation.
