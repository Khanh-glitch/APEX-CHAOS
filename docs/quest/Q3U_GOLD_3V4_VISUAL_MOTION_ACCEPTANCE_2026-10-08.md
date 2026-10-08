# APEX CHAOS Quest 01 — Q3u staged acceptance and open visual findings

Date: 2026-10-08. Status: **TECHNICAL CI GREEN, VISUAL OWNER SIGN-OFF STILL OPEN**.

## SHA law
- Branch: `quest/q3-gold-v12-presentation-from-q2`
- Tested code HEAD: `41b50220b8d2be223e1c0baba2fbd3ae891f0876`.
- Exact-SHA workflow: https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/37814576057 — **SUCCESS** (Director, FIRST WAKE, generalized N-actor real Arsenal regression, production build, desktop Chrome and emulated mobile Chrome).
- Previous Q3t: `25df4aa61d76954ecb579677c59f0828095c3a24`, also SUCCESS.
- Not merged to R59, not deployed to Cloudflare production.

## Changes made in Q3u — authoritative separation
1. `public/game/arsenal/arsenalPresentationRuntime.js` scales the **visible held-weapon image and its drawing offset** with the exact current Quest V12 owner art scale. T.O.T (Gold fifth OPERATOR), Scout and Bulwark carry Q3t `0.82` factor. No change to NEWBOT, Reaver/Sentinel, gun muzzle physics, weapon type, projectile/damage, collider, AI or skill ownership. This is a presentation-only rendering correction and can still need owner eye review for specific guns.
2. `tools/testQuestDirectorQ1Browser.mjs` now measures the native PISTOL on the original 256×256 **Chamber Palette offscreen canvas**. Gold's weapon draw wrapper intentionally returns `undefined`; a DOM canvas spy gives false FAIL. The acceptance intercepts the actual authored PISTOL image draw, restores the native canvas method synchronously and compares its transform to independent physical muzzle coordinates. Desktop and mobile PASS: visual offset **47.9699707 px** against expected **47.97**, original PISTOL art **103.32×64.97 px**, authentic image ready, physical muzzle unchanged (**121.7973 px** from Fighter origin in this fixture).
3. **Visible 3v4 QA**, not a fake story branch: while FIRST WAKE's production Gold HUD is already mounted, a loopback-only protected test hook restarts Arsenal with the canonical 3v4 fixture. Gold canvas remains visible; both new enemy kinds `reaver` and `sentinel` use real donor V12 rigs, `failed=0`, and the DOM Gold side bars show **3** and **4** individual HP segments. Their full-health totals are **3000/3000** and **1140/1140**. Test exits through Gold and preserves Story checkpoint WAKE.
4. Browser viewport acceptance screenshots and measured visible rail positions:
   - **320×568**, arena 252×252 CSS px, rails within viewport, 3+4 segments.
   - **360×560**, arena 244×244 CSS px, rails within viewport, 3+4 segments.
   - **1024×768 landscape tablet**, arena 636×636 CSS px, rails within viewport, 3+4 segments.
   - Desktop and 390×844 baseline still run. All green for **geometry/accessibility of the arena and rails**. This test does **not** claim perfect aesthetic composition.
5. 3v4 private fixture is for QA only. It does NOT mark any Quest encounter complete, expose a public stage skip or create a story-wave/quest director.

## Visual evidence
GitHub Actions run 37814576057 artifact `quest-q2-real-n-actors-and-browser` contains:
- `quest-q2-browser/06-q3u-seven-fighter-chrome.png`
- `quest-q2-browser/06-q3u-seven-fighter-chrome-mobile.png`
- `quest-q2-browser/07-q3u-iphone-se-mobile.png`
- `quest-q2-browser/07-q3u-compact-phone-mobile.png`
- `quest-q2-browser/07-q3u-tablet-landscape-mobile.png`
Plus JSON browser reports. These are actual in-browser screenshots, not generated illustrations.

## Open findings — do not silently mark PASS
- **U-01 Visual clipping at arena edges**: geometry gates establish view/rail accessibility but do NOT verify no sprite pixels clip against arena edges when a large robot gets to x/y physical boundary. Specific perimeter motion playtest and/or sprite-bounds instrumentation still required. Do not move physics colliders or fake hitboxes to hide art.
- **U-02 320×568 copy layout**: the K skill name can truncate (e.g. `VIRTUAL ARM…`) and the hostile `SCRAP` label sits apart above rails. This is a readability/design review, even though no arena/bar bounding box is cut.
- **U-03 tablet landscape content**: Gold left side panel remains quite sparse with large black spaces and shortened J/K labels. No fabricated NPC skill tiles should be reintroduced; native Gold visual hierarchy to be reviewed.
- **U-04 RIVET** is still a plain brown placeholder in 3v4. The temporary white/amber Gold fifth OPERATOR is assigned ONLY to T.O.T per owner intent; do not invent or substitute a final RIVET asset.
- **U-05 FX concurrency/readability**: after switching between separate QA match fixtures, old CRITICAL/DEVASTATING panel effects can overlap the fresh 3v4 view. Audit reset timing and high-entity popup policy for future real multi-wave story; same-named Scrap Bots may legitimately aggregate **on side panels**, while field impact popups remain per real Fighter.
- **U-06 Held-weapon grip acceptance**: proven native PISTOL pose transform; other gun families/angles, projectile tip alignment, post-KO and edge cases remain owner visual validation items.
- **U-07 Real 3v4 wave playtest** and native Quest encounter pacing are not covered by a private fixture. Q4 encounter/wave implementation remains future work.

## Safe resumption
Compare remote branch HEAD and this green code SHA before new changes. Read Q0 contract and Q3 stage evidence. Keep only one canonical Arsenal combat loop, no synthetic damage, no invented skills, no debug/meta flooding the user HUD. For Gold battle HUD edits, synchronize `public/gold/battle-hud.html` and the embedded `battleHudPayload` in `public/gold/shell.html` byte-for-byte, and test the ACTUAL mounted product. The next work should target U-01 boundary art and actual 3v4 UX/readability, not reopen the already green Q3t recoil/scale gates.
