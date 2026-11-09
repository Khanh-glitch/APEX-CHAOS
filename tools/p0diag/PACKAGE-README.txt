APEX CHAOS - P0 PERFORMANCE DIAGNOSIS
=====================================

WHAT THIS IS
  A one-click measurement of the skill-cast stutter on THIS computer.
  It plays one CRYSTALA vs FROST BOT match by itself with a fixed cast
  sequence and writes one JSON report.

HOW TO RUN IT
  1. Extract this ZIP somewhere normal (Desktop is fine).
     Do not run it from inside the ZIP preview.
  2. Double-click:  RUN-DIAGNOSIS.cmd
  3. A browser window opens and the game starts playing itself.
     Leave both windows alone for about 4 minutes.
     Do not click the game, do not resize the window, do not switch tabs.
  4. When it finishes, the report is here:
         tools\p0diag\results\p0-diagnosis-latest.json
     Send that file back.

IF SOMETHING GOES WRONG
  * "Windows protected your PC"  -> More info -> Run anyway.
    The file is a plain batch script; you can open it in Notepad to read it.
  * No browser opens -> Chrome or Edge is required. Install one, or set the
    P0_BROWSER environment variable to the browser's .exe path.
  * The console window closes immediately -> run it from a Command Prompt
    inside this folder so the message stays visible.

WHAT IT CHANGES
  Nothing in the game. The tool serves the game's own files, adds one
  measurement script to the page in memory, and writes JSON inside this
  folder. It does not install anything, does not use the internet, and does
  not touch your normal browser profile (it uses .p0profile next to itself).

WHAT IT MEASURES
  Frame pacing (rAF intervals) for five interleaved passes over the same match:
     1. full gameplay            (control)
     2. FROST ice renderer off
     3. auxiliary ambient VFX off
     4. CRYSTALA bloom off
     5. full gameplay again      (control repeat)

  Each pass records p50/p95/p99, the JS work the game itself does, long
  tasks, and Long Animation Frames when the browser supports them. Each pass
  also carries a proof that the subsystem really was switched off, so a pass
  that silently did nothing is reported as invalid instead of being counted.

  The tool does NOT report FPS and does not claim anything improved.
