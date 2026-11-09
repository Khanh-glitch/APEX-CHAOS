APEX CHAOS - P0 PERFORMANCE DIAGNOSIS
=====================================

WHAT THIS IS
  A one-click measurement of the skill-cast stutter on THIS computer.
  It plays one CRYSTALA vs FROST match by itself with a fixed cast
  sequence and writes one JSON report.

HOW TO RUN IT
  1. Extract this ZIP somewhere normal (Desktop is fine).
     Do not run it from inside the ZIP preview.
  2. Double-click:  RUN-DIAGNOSIS.cmd
  3. A browser window opens and the game starts playing itself.
     Leave both windows alone for 2 to 4 minutes.
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
  * The report says a fighter was LOCKED -> this browser profile does not own
    CRYSTALA and FROST yet. See WHAT IT CHANGES above.
  * The report says the controls disagreed -> close other programs and run it
    again; a busy machine cannot be measured.

WHAT IT CHANGES
  Nothing in the game. The tool serves the game's own files, adds one
  measurement script to the page in memory, and writes JSON inside this
  folder. It does not install anything and does not use the internet.

  It starts the browser on a SEPARATE copy of your own browser profile
  (discovered automatically), because the match needs the fighters you have
  unlocked. Your daily browsing profile is not modified: the copy is
  discarded afterwards. If the report says a fighter was LOCKED, run the tool
  once more after a normal game session on that profile, or set the
  P0_PROFILE environment variable to your Chrome "User Data" folder.

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

  If any pass fails its own proof, it is reported invalid and excluded from
  the comparison. If the two control passes disagree by more than 20%, or if
  a pass produced too few frames, the report says so and names NO subsystem:
  the tool would rather answer "not enough evidence" than guess.

  The tool does NOT report FPS and does not claim anything improved.
