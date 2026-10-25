# Issue #105 BEFORE / AFTER gallery (real Chromium, real app)

BEFORE = `7ef2dc0` (owner-rejected build), served on the baseline worktree.
AFTER = the commit that contains this file (HEAD of `arena/99851aa2-apex-chaos`).
No mockups. No zoomed-out-only PNG is used as PASS evidence; the functional proof is in the gate logs.

## 1. Missions and Mastery (P0-A)
| Surface | BEFORE | AFTER |
|---|---|---|
| Missions, phone 390×844 | `before/missions-phone-390x844.png` | `after/missions-phone-390x844.png` |
| Missions, desktop 1440×900 | `before/missions-desktop-1440x900.png` | `after/missions-desktop-1440x900.png` |
| Mastery, phone 390×844 | `before/mastery-phone-390x844.png` | `after/mastery-phone-390x844.png` |
| Mastery, desktop 1440×900 | `before/mastery-desktop-1440x900.png` | `after/mastery-desktop-1440x900.png` |

BEFORE is a floating dialog. Measured: 390×844 scrollHeight 1091 vs clientHeight 758; 320×568 1179 vs 509.
AFTER is an edge-to-edge scene with pages (1/2 shown). Gate: `gate-progress-pages` 135/135, `gate-progress-surface` 15/15, `gate-progress-keyboard` 40/40, `gate-progress-title` 24/24.

## 2. In-battle popup (P0-D)
| Case | BEFORE | AFTER |
|---|---|---|
| Live battle, same provisional event, phone 390×844 | `before/battle-live-phone-390x844-toast-1.png` (toast count 1) | `after/battle-live-phone-390x844-toast-0.png` (toast count 0) |
| Menu control, same event (toast MUST show) | `before/menu-control-toast-phone-390x844.png` (1) | `after/menu-control-toast-phone-390x844.png` (1) |

The control shows the toast still works outside battle. Ledger, stats, sealed result and claim are unchanged (`gate-battle-no-popup` 6/6).

## 3. Side outline on heroes (P0-B)
- `edge/before/newbot-dpr2-crop-2x.png`, `edge/after/newbot-dpr2-crop-2x.png`
- `edge/before/hunter-dpr2-crop-2x.png`, `edge/after/hunter-dpr2-crop-2x.png`

These are 2× crops of the live main canvas from the outline gate, on the same hero (ROBOT for NEWBOT, HUNTER). They are different sampled moments, NOT the same frame. The edge is intermittent (it appears while fighters overlap), so a same-frame A/B needs a deterministic overlap trigger that this session did not build. This is a known gap; the owner visual review should check the battle directly.
Gate: `gate-no-side-outline` measures edge coverage in exact Gold side colours; HEAD 0 at all 8 heroes × DPR1/DPR2; BEFORE shows 0.007–0.059 in samples.

## 4. Roster pairs (P0-B)
- `pick/bot-p1-robot-vs-p2-hunter-pick.png`
- `pick/bot-p1-hunter-vs-p2-robot-pick.png`
- `pick/local-p1-robot-p2-hunter-pick.png`
- `pick-bot-desktop-1440x900.png` in `before/` and `after/` (pre-lock Fighter Pick).
Gate: `gate-roster-pairs` 24/24 (fresh Guest owns ROBOT+HUNTER, 350 AC; BOT default HUNTER; P1 HUNTER→BOT ROBOT; Local cannot mirror; reload; additive migration).

## 5. Result Gold first entry (P0-C)
- BEFORE (`7ef2dc0`, real played match): `result/before/settled-900x560.png` and `result/before/settled-390x844.png`. The Skip control overlaps the REPLAY control (`iconbtn|skip` overlap in every after-intro frame) and, at 390×844, the racktab overlaps Skip.
- AFTER (played match, no resize for entry): `result/after/settled-900x560.png`, `result/after/settled-390x844.png`, `result/after/settled-320x568.png`.
- AFTER after a resize control (+1px and back): `result/after/after-resize-900x560.png`, `result/after/after-resize-390x844.png`. Gate A/B: settled geometry equals post-resize geometry at all six sizes.
- Not saved: a literal first-entry frame image. The gate samples every frame and asserts on them, but the saved PNGs are the settled first entry (after intro) and the post-resize frame.
- Not saved: BEFORE at 320×568. Before the weapon-row fix the 320×568 weapon name overlapped the banner and the weapon info overflowed its cell. Fixed by `--weapon-h: 112px`, 0.85/1.15 columns, 2-line clamp on long names.

## 6. Chip (first-play)
Chip absence at opening cooldowns is correct (`chosenSlot` needs a castable skill). Gate G now samples from the battle-ready point. No image; the receipts are in the gate JSON.

## Known gaps (honest)
- Edge on/off is not a same-frame A/B.
- No literal first-entry frame image; no BEFORE 320×568 Result image.
- Owner visual review is still required for the fighter size at 320×568 (the hero art is smaller there, a trade-off for the no-overlap fix).
