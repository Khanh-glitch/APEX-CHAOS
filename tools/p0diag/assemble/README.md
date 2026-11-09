# P0 diagnosis package — download and run

The package ZIP is ~100 MB. The GitHub release-asset upload host is blocked
from the build machine, so the ZIP is stored here in the repository as nine
12 MB parts and reassembled on your machine by a double-click.

## What to download

Everything in this folder (`tools/p0diag/assemble/`):

* `ASSEMBLE-PACKAGE.cmd` — one double-click
* `parts/part-000.bin` … `parts/part-008.bin`

Keep the folder structure: the script expects a `parts` subfolder beside it.

## How to run it

1. Download the folder (or clone the branch) so `parts/` sits next to the `.cmd`.
2. Double-click `ASSEMBLE-PACKAGE.cmd`.
   It joins the parts, verifies the SHA-256, and opens the folder.
3. Extract the resulting `APEX-CHAOS-P0-Diagnosis-44ba89c.zip`.
4. Double-click `RUN-DIAGNOSIS.cmd` inside the extracted folder.
5. Leave it alone for 8–12 minutes, then send back
   `tools\p0diag\results\p0-diagnosis-latest.json`.

## Expected integrity

```
sha256 c625d2856401d7fab84d63818b753d6668e18074d9b30586b05dc79a649f1559
bytes  99469262
```

The assembler checks this itself and refuses to continue on a mismatch.

## What the package contains

* the game, built from the frozen baseline tag `p0-baseline-44ba89c`
  (`PACKAGE.json.gameBuild` and the in-ZIP `ITCH_GUEST_BUILD_SHA.txt` both say
  `44ba89c1f0d36422c1b08412dfeeb66863662a1c`)
* the diagnosis tool (`p0diag.js`, `p0serve.mjs`, `p0run.mjs`)
* a Windows x64 `node.exe`, so nothing has to be installed
* `RUN-DIAGNOSIS.cmd`

No GitHub Actions are involved anywhere: the game is built and the package is
verified locally.
