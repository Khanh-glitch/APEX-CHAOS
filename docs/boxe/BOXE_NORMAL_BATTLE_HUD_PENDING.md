# BOXE — Normal Battle integration checkpoint (HUD artwork pending)

- BOXE is a seventh product fighter with **normal BOT Battle + Local 1v1** mechanics and the actual Gold visual-only body/glove/motion renderer.
- These are **NOT** temporary placeholder hero images. Gold Fighter Pick, HUD and Dictionary must derive the same BOXE production ID and text-only skill names until owner supplies approved HUD assets.
- Owner-supplied media to bind **later**, without gameplay or source-Gold edits: pick roster cover, large selected portrait/pose, battle HUD avatar, 1:1 Passive icon, A1 icon, A2 icon. No image is invented for these roles. Existing fallback text/empty presentation is intentional, NOT an indication that BOXE is locked.
- New SFX Gold is also pending; normal mode Gold render is `sound:false`, and combat damage is owned only by Arsenal. Do not insert temporary oscillator/synthetic battle SFX.
- Gold source SHA-256 = `ccb889bb08cb2e741c4f7f5e0b33d08047c08fb28bfc1c31ae9401604444e2b2`; source PNGs are staged without lossy transforms. The visual-only extraction shares source methods and only disables the second Gold gameplay loop.
- Approval gates: native fighter pick P1/P2/BOT; Rocket distinct impact 0 HP stun + disarm; one weapon pickup post-catch, queue after fire cycle; A2 unavailable during A1; passive 300 realized HP/3s extra cooldown; A2 only 10% *remaining* HP; Gold return/catch, proper cleanup on rematch; six original heroes unchanged; desktop and mobile Chrome; THEN Cloudflare owner playtest.
- **No build preview/deploy/promotion until the build gates and source-integrity checks pass.**
