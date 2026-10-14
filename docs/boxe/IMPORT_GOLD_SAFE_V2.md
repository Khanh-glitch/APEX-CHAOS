# BOXE owner Gold — Safe Git Import V2

> **The previous Gold import ZIP (public/gold target) is superseded.**
> Use only `BOXE_GOLD_GIT_IMPORT_SAFE_V2.zip`, prepared from owner-supplied exact source.

- Checkout this PR branch `feature/boxe-bot-wave-gold-intake-20261014` (based on owner-reviewed Dictionary C04).
- `git pull --ff-only`; confirm clean `git status`.
- Extract Safe V2 ZIP **outside** the repo (the package is provided separately to the owner).
- Run: `python import_gold_to_git.py "C:\\path\\to\\APEX-CHAOS"`.
- It performs original HTML SHA-256, deembedded HTML SHA-256, all ten PNG SHA-256 checks, then runs the repo's Gold gate, commits and pushes to the same branch.
- **Destination:** `masters/boxe-gold/` (nonshipping, never under `public/`).
- Expected 12 files: 1 original HTML + 1 deembedded HTML + 10 source-identical PNG.
- Source SHA256 `ccb889bb08cb2e741c4f7f5e0b33d08047c08fb28bfc1c31ae9401604444e2b2`.
- Do not mark BOXE as ACTIVE or ship the Gold standalone to production. Gameplay adapters must selectively package approved runtime assets and preserve Gold VFX after actual Chrome verification.

## Safety gates
1. Previous ZIP is invalid for the new storage policy.
2. The owner-provided 25.7MB Gold is still **not committed** merely by this guide's presence.
3. Import script was tested end-to-end against a disposable Git remote and preserved all file hashes.
4. Work on actual Fighter Pick, Arena, BOT WAVE UI and VFX parity can be promoted only after the branch contains the binaries and CI verifies this immutable source.
