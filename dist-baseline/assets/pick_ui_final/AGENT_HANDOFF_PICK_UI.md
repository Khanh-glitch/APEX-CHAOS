# APEX CHAOS Pick UI - Agent Handoff

Use `pick-layout-card-system-v1.json` as the source of truth for layout and slots. Do not redesign the screen.

Important runtime rules:
1. The pick screen uses only three carousel hero-card slots: `carousel-left-slot`, `carousel-center-slot`, `carousel-right-slot`.
2. All nine champions are registered in `assets/champions.json` and in the HTML as `CHAMPIONS`.
3. Create hero cards from `champion.cardArt + champion.icon + champion.name + champion.accent`.
4. The hero-card frame is full-frame. Do not crop, punch, cut out, or use destination-out on the frame.
5. Art may be clipped inside the card art window only. This must not alter the frame image.
6. Side P1/P2 panels bind to selected champion: standing image, name, accent text/frame glow, HP and DMG.
7. Button states use existing assets:
   - Start: 11-start-normal, 12-start-hover, 13-start-pressed
   - Exit: 14-exit-normal, 15-exit-hover, 16-exit-pressed
   - Arrows: 17/18 and 19/20
8. Animation notes are exported in `interactionSpecs` and each layer's `interaction` object.

Give the agent these files together:
- `apex-chaos-ui-ux-studio-card-system-embedded.html` for visual verification.
- `pick-layout-card-system-v1.json` for source-of-truth layout.
- the full `assets/` folder or this ZIP.

Agent implementation instruction:
"Implement the pick screen from this manifest without redesign. Convert hero-card slots into runtime carousel behavior. Use the supplied HeroCardFactory, champion registry, frame assets, icons, and button states. Keep all layer coordinates within 4 design pixels unless explicitly justified."
