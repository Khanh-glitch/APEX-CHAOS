# B7d — isolated REAL RIVET E07 Fighter encounter (not unlocked)
Date: 2026-10-09.

Baseline B7c native accepted-damage hook and E06 regression: `4ba27cb76b50d6b9df3b59c75d89a88e6e5c174e`, run 37939131719 SUCCESS.

This branch adds a **localhost + __APEX_TEST_MODE gated 1v1 E07 fixture**.
It is not a public entry, not a Gold story button, not an E06 save shortcut and not a narrative completion.
It uses real Arsenal Fighter/weapon projectiles with exactly NEWBOT 1000HP vs RIVET 1000HP (Iron Bulwark Gold V12).
RIVET's existing B7c physical damage adapter caps realized HP loss at 180. Cues 750/450/180 are recorded after accepted damage from native Fighter. NEWBOT KO can only retry; RIVET cannot die; natural settlement does not call Director.

The fixture deliberately cannot be opened in production and never fabricates E06 unlock or the visible E07 repair, L-01 dialogue, final Story panel or E08 continuation. Those require owner-authorized canon handoff and a full Chrome/Gold acceptance.
Next gate after this isolated slice: explicit E06 closure and Owner X-03 companion kits; then authored visible repair + RIVET involuntary cable/line and signed E07 result, without changing the engine damage arithmetic.
