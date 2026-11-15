# APEX CHAOS first-match review — evidence bundle

**Status: PARTIAL / NOT ACCEPTED.** Exact-SHA build and live Home → Mode → Fighter Select → BOT Battle were exercised. A real KO, Match Result, P90 result case, and Continue activation were **not** reached. No application source was edited.

- Build / preview SHA: `18bc21b07d73b881dafbb732630ca6bcd1c21214`
- Exact-SHA production build: passed (receipt `20261021-cp5-r1`, value `70`)
- Evidence timestamp: 2026-10-23 (local review session)
- Main real run: run06, 2026-10-23T03:47:01Z to 03:53:43Z; screenshot markers and clocks are in `logs/run06-frame-timeline.csv`.
- Run06 reached a live NEWBOT vs NEWBOT BOT fight and ended at match clock `21.866 s`, P1 `835.5/1000`, P2 `871.13/1000`, both alive. The result iframe was never created.
- Gameplay events and 1-second runtime snapshots: `logs/run06-gameplay-events.json`.
- An independently captured second real attempt did produce one successful P1 J cast; exact event excerpt and its live frame are `logs/attempt02-successful-J-cast.json` and `screens/11-separate-attempt-J-success-1440x900.png`. That second attempt also did **not** reach KO/Result.

## Capture limitation

Continuous video is deliberately **not supplied**. Chromium’s headless software-compositor CDP screencast materially slowed the running simulation: two capture trials emitted 338 frames over 480.6 wall-seconds and 248 frames over 506.9 wall-seconds. Encoding those at ordinary frame rates produces a time-compressed clip, not a faithful continuous gameplay recording. It was rejected as misleading. The full-run captures therefore use timestamped production-runtime screenshots plus the AIL event log instead. The headless environment also has no audio loopback; audible feedback is **UNVERIFIED**. The `844×390` sample is an emulated CSS viewport, not a physical phone/touch-device run.

## Files

- `screens/01`–`04`: real production Home, first-play prompt, Mode, and Fighter Select.
- `screens/05`–`09`: real run06 coach/J prompt, mobile coach, K attempt, later battle frame, and live-fight cutoff.
- `screens/10`–`11`: another real attempt showing a failed J condition and a successful J cast respectively; see the run label in the JSON excerpt.
- `logs/run06-gameplay-events.json`: AIL events, key log, runtime snapshots, route/actions, and errors from the main run.
- `logs/run06-frame-timeline.csv`: wall-clock screenshot times, match clock, viewport, HP, and weapons.
- `ab/*-A-live-*`: unmodified real battle screenshots.
- `ab/*-B-combat-first-proposal-*`: **static evidence-only re-compositions** of the matching A screenshots using only their existing canonical Gold HUD/art pixels. These are not interactive builds or gameplay and do not change app source.
- `first-match-review.md`: runtime-supported agency map, pain-point timeline, HUD proposal/trade-offs, Result status, and requested owner decision.
- `result-p90-status.json`: explicit UNVERIFIED Result diagnosis record; no fixture is presented as runtime evidence.

Do not treat this bundle as proof of design acceptance, a complete first match, release readiness, or owner approval.
