# P0 diagnosis package — download and run

The package ZIP is ~74 MB. The GitHub release-asset upload host is blocked
from the build machine, so the ZIP is stored here in the repository as six
12 MB parts and reassembled on your machine by a double-click.

## What to download

Everything in this folder (`tools/p0diag/assemble/`):

* `ASSEMBLE-PACKAGE.cmd` — one double-click
* `parts/part-000.bin` … `parts/part-005.bin`

Keep the folder structure: the script expects a `parts` subfolder beside it.

## How to run it

1. Download the folder (or clone the branch) so `parts/` sits next to the `.cmd`.
2. Double-click `ASSEMBLE-PACKAGE.cmd`.
   It joins the parts, verifies the SHA-256, and opens the folder.
3. Extract the resulting `APEX-CHAOS-P0-Diagnosis-44ba89c-fixed.zip`.
4. Double-click `RUN-DIAGNOSIS.cmd` inside the extracted folder.
5. Leave it alone for 8–12 minutes, then send back
   `tools\\p0diag\\results\\p0-diagnosis-latest.json`.

## Expected integrity

```
sha256 8fbf345eee46f6f7a1eb460ac99ad31f38a9e062a822d6de103129362399fec8
bytes  74027901
```

The assembler checks this itself and refuses to continue on a mismatch.

## What the package contains

* the game, built from the frozen baseline tag `p0-baseline-44ba89c`
  (`PACKAGE.json.gameBuild` and the in-ZIP `ITCH_GUEST_BUILD_SHA.txt` both say
  `44ba89c1f0d36422c1b08412dfeeb66863662a1c`)
* the diagnosis tool (`p0diag.js`, `p0serve.mjs`, `p0run.mjs`)
* `RUN-DIAGNOSIS.cmd`
* No `node.exe` is bundled: `RUN-DIAGNOSIS.cmd` falls back to a Node already on
  PATH if `runtime\node.exe` is absent.

No GitHub Actions are involved anywhere: the game is built and the package is
verified locally.
