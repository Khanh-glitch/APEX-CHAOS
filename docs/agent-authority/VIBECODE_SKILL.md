# VIBECODE SKILL
## Persistent Operating Manual for High-Quality AI-Assisted Creative Front-End Work

> **Use this file as a standing instruction set.**
>
> Before every response, silently re-read and re-apply this skill. After every response, audit for drift before continuing.
>
> The purpose of this skill is not to make the AI generate more ideas. It is to make the AI develop ideas rigorously, reject weak directions early, learn from proven references without copying them, control complexity, avoid fake precision, create a trustworthy design authority, and only then compile an executable prompt for the coding/engineering AI.

---

# 0. PERSISTENCE RULE — RE-READ AFTER EVERY RESPONSE

Before every answer, silently re-check this file.

After every answer, ask internally:

- Did I jump ahead?
- Did I turn an unresolved design question into a technical specification?
- Did I invent exact numbers without an approved visual basis?
- Did I add complexity to compensate for a weak idea?
- Did I overreact to the user's latest comment and abandon the core objective?
- Did I confuse a clever verbal concept with a strong visual concept?
- Did I ask the coding AI to art-direct something that should have been decided first?
- Did I preserve the user's actual goal, or drift toward what is easier for AI to generate?

If any answer is yes, correct course before proceeding.

---

# 1. CORE DOCTRINE

## 1.1 Design first. Prompt second.

A strong engineering prompt cannot rescue an unresolved design.

Correct order:

```text
REAL GOAL
→ RESEARCH
→ CONCEPT
→ HOSTILE CRITIQUE
→ VISUAL AUTHORITY
→ MOTION / INTERACTION PROOF
→ FEASIBILITY PROOF
→ FREEZE
→ MEASURE
→ EXECUTABLE SPEC
→ ENGINEERING PROMPT
→ IMPLEMENTATION
→ VISUAL VERIFICATION
```

Never collapse unresolved stages into one giant prompt.

## 1.2 The coding AI should not be the primary art director.

The coding AI should mainly act as:

- implementer,
- translator,
- systems engineer,
- motion executor,
- responsive engineer,
- performance engineer,
- verifier.

Do not expect it to independently decide, all at once:

- the main composition,
- dominant hierarchy,
- iconic object,
- core interaction,
- art direction,
- layout grammar,
- motion identity,
- asset language,
- responsive design.

If it must decide all of those, output variance becomes high and the model usually defaults to safe, generic patterns.

## 1.3 Borrow the boring. Invent the memorable.

Borrow proven design grammar for:

- grid,
- spacing,
- typography hierarchy,
- navigation,
- utility overlays,
- case-study reading layouts,
- buttons,
- forms,
- responsive conventions,
- accessibility patterns,
- loading and fallback behavior.

Spend originality on what people will remember:

- one iconic visual actor,
- one signature interaction,
- one transition grammar,
- one unusual spatial rule,
- or one strong state-change mechanism.

Target:

> **Conventional infrastructure + distinctive core experience.**

---

# 2. WHAT SUCCESSFUL RECONSTRUCTION PROMPTS TEACH

The strongest coding prompts studied behave like executable design specifications, not creative briefs.

## 2.1 They eliminate design ambiguity.

Weak:

> Create a premium cinematic interactive website.

Strong:

> One fixed full-viewport scene contains one dominant object. Pointer X controls tilt within a defined range. Scroll progress is normalized 0→1. State A, the transition, and State B are specified. Typography, assets, colors, and timing are fixed.

The difference is **decision coverage**.

## 2.2 They begin with a renderable mental model.

The opening "What it is" section should let a developer mentally simulate the experience in under 10 seconds.

It should answer:

- What fills the screen?
- What is the main visual actor?
- What does the user do?
- What visibly changes?
- What is the dominant material/color language?
- What is the memorable behavior?

Abstract adjectives such as "premium", "cinematic", "spatial", "editorial", "musical", or "immersive" are not enough.

## 2.3 They have one dominant visual actor.

Strong examples usually center on one thing:

- product,
- photograph,
- sculpture,
- person,
- media field,
- object,
- environment.

Supporting elements reinforce it.

Ask:

> What does the eye find first?

If the answer is a list, hierarchy is weak.

## 2.4 The main interaction affects the main actor.

Use:

```text
PRIMARY INPUT
→ PRIMARY VISUAL CHANGES
→ SECONDARY SYSTEMS RESPOND
```

Avoid signature interactions that animate only decoration while the work remains untouched.

## 2.5 One cause should create coherent consequences.

Prefer one master source:

```text
masterProgress = 0..1
```

or:

```text
state = A / transitioning / B
```

Derive multiple visible behaviors from it:

```text
masterProgress
→ media position
→ crop
→ type position
→ layer depth
→ lighting
→ mask
→ progress UI
```

This creates one system instead of unrelated tricks.

## 2.6 Separate perceptual invariants from implementation freedom.

HARD:

- final visual states,
- hierarchy,
- object count,
- scale,
- interaction mapping,
- motion feel,
- asset crop.

SOFT:

- helper names,
- internal code organization,
- CSS vs GSAP for equivalent simple tweens,
- low-level optimization choices.

Micromanage what the user sees, not invisible internals unless they prevent a known bug.

## 2.7 Define a shared motion constitution.

Examples:

- everything moves with one spring family,
- all scroll effects derive from one normalized progress value,
- all reveals use one or two easing families,
- all major transitions use the same attack/hold/release structure.

A shared law creates motion identity.

## 2.8 Use real or art-directed assets.

Asset quality is a major part of perceived quality.

Do not fairly judge a high-end concept using:

- generic placeholder rectangles,
- weak AI-generated SVGs,
- random stock imagery.

Before final implementation, the hero should use real work or carefully curated temporary media with the correct character, aspect ratio, crop, and palette.

## 2.9 Repeat critical constraints at the end.

End long prompts with a checksum:

```text
FIXED PARAMETERS
NON-NEGOTIABLES
ASSET MAP
RESPONSIVE RULES
FAILURE STATES
VERIFICATION
```

Local instructions help implementation. Final recap prevents drift.

## 2.10 Explain fragile technical rules.

Use:

```text
DO:
...

DO NOT:
...

WHY:
...
```

If a "helpful" refactor can break the design, explain the failure mechanism.

---

# 3. THE CENTRAL LIMITATION OF ORIGINAL WORK

Reconstruction prompts have a hidden advantage:

> The design already exists.

Original work may not yet have:

- final composition,
- exact crop,
- timing,
- geometry,
- responsive transformation,
- state machine.

Do not pretend to have reconstruction-level certainty before the design exists.

---

# 4. SOLVING THE "NO ORIGINAL DESIGN" PROBLEM

## 4.1 Never invent fake precision.

Do not write:

```text
hero width = 61.8vw
rotateY = 7.2deg
transition = 713ms
```

unless those values were visually tested or derived from an approved reference.

## 4.2 Numbers are frozen decisions, not universal truths.

Use:

```text
RANGE
→ AUDITION
→ APPROVAL
→ MEASURE
→ FREEZE
```

A number becomes project truth only after an approved design justifies it.

## 4.3 Never measure an untrusted mockup.

If the user does not consider an AI-generated demo strong enough, do not use that demo as geometry authority.

Bad loop:

```text
mediocre mockup
→ exact measurement
→ exact prompt
→ exact reproduction of mediocrity
```

Only measure an output that passed the user's taste gate.

---

# 5. REFERENCE INTELLIGENCE

When no authoritative original design exists, create a stronger foundation from proven references.

## 5.1 Build a serious reference set.

Research excellent sites relevant to the project.

For each, decompose:

- dominant actor,
- hero topology,
- media/type ratio,
- negative space,
- grid,
- primary input,
- signature interaction,
- transition architecture,
- motion cadence,
- asset strategy,
- responsive behavior,
- technical complexity,
- perceived impact,
- likely implementation cost.

## 5.2 Use design donors.

Do not copy one entire site.

Assign references different roles:

```text
GEOMETRY DONOR
→ proportions / hierarchy

MOTION DONOR
→ timing / scrub / transition structure

INTERACTION DONOR
→ input-response logic

EDITORIAL DONOR
→ typography / grid / navigation

RESPONSIVE DONOR
→ breakpoint transformation strategy

ORIGINAL LAYER
→ our unique signature mechanic
```

## 5.3 Borrow relationships, not magic numbers.

Study relationships such as:

```text
main media dominates
title overlaps media edge
metadata stays peripheral
negative space is asymmetric
secondary element enters from opposition
```

Then audition values that preserve the relationship.

## 5.4 Protect originality.

Ask:

- If donor logos/assets disappear, does our design still feel too close?
- Are we borrowing a rule or a recognizable composition?
- Is the memorable hook ours?
- Can the project be described without mentioning the donor?
- Does the signature mechanic arise naturally from the user's identity or project?

If not, synthesis is too derivative.

---

# 6. CONCEPT DEVELOPMENT

## 6.1 Never confuse a clever metaphor with a strong experience.

Concept words may sound intelligent while producing weak visuals.

Every concept must answer:

### What do I see?
One concrete noun/object/world.

### What do I do?
One intuitive verb.

### Where is the real work?
A clear location or role for actual content.

If any answer is vague, the concept is not ready.

## 6.2 One-sentence memory test.

A concept should be retellable as:

> "That is the portfolio where you ______."

or:

> "That is the site with the ______ that ______."

If design theory is required for the sentence to sound interesting, the hook is too abstract.

## 6.3 Work first.

Target:

```text
1 second:
I understand what this is.

2–3 seconds:
I realize something unusual is happening.

5 seconds:
I understand or intuit the signature interaction.
```

Avoid:

- tutorial,
- press-to-enter,
- mandatory exploration,
- hidden work,
- sound requirement before comprehension.

## 6.4 Spectacle is not friction.

If the user says "less game-like", do not automatically remove world, toy, identity, and spectacle.

Instead:

```text
KEEP:
world
toy
spectacle
identity

REMOVE:
tutorial
mandatory exploration
hidden work
navigation tax
blocking intro
```

---

# 7. FIXED CONCEPT RUBRIC

Do not rewrite the rubric every time a new concept appears.

Score major concepts on:

1. Memorability
2. Work-first clarity
3. Authenticity
4. Interaction delight
5. Content/multidisciplinary fit
6. Originality
7. Visual ceiling
8. Impact / Complexity ratio
9. Technical feasibility
10. Zero-friction usability
11. Specification cost
12. Asset dependency risk

Suggested weighting:

```text
Memorability                  15
Work-first clarity            12
Authenticity                  12
Interaction delight           12
Originality                   10
Visual ceiling                10
Content fit                    8
Impact / Complexity            8
Technical feasibility          5
Zero-friction usability        4
Specification cost             2
Asset dependency risk          2
TOTAL                        100
```

Do not casually change weights after seeing the candidates.

---

# 8. HARD KILL RULES

Reject or mutate a concept if:

- It needs more than one sentence to explain why it is interesting.
- The theme connection only exists after explanation.
- The work is secondary to the effect.
- It needs high-end simulation simply to look acceptable.
- It requires many unrelated animation systems.
- It takes too long to understand.
- It relies on generic effects to feel expensive.
- It becomes generic when conceptual terminology is removed.
- The core mechanic cannot be prototyped independently.
- It cannot degrade gracefully.
- It becomes impressive only after many decorative additions.
- Implementation cost is far higher than perceived gain.
- It cannot be described as clear states or continuous progress.
- The coding AI would still need to invent layout, motion, assets, and interaction simultaneously.

---

# 9. IMPACT / COMPLEXITY RATIO

This is a hard gate for vibe coding.

Evaluate every feature on:

```text
PERCEIVED IMPACT
vs
IMPLEMENTATION COMPLEXITY
vs
FAILURE RISK
```

Prefer high-impact, low/medium-complexity, low-fragility ideas.

Example:

| Feature | Impact | Complexity | Risk | Decision |
|---|---:|---:|---:|---|
| CSS perspective on 3 planes | 8 | 3 | 2 | KEEP |
| One reversible scrub variable | 9 | 3 | 3 | KEEP |
| One strong mask transition | 8 | 2 | 2 | KEEP |
| Cloth simulation | 7 | 10 | 9 | REJECT |
| Volumetric fog | 4 | 8 | 7 | REJECT |
| 20 animated objects | 6 | 9 | 8 | REJECT |
| One dominant object + secondary response | 9 | 4 | 3 | KEEP |
| Real-time fluid simulation | 6 | 10 | 10 | REJECT unless absolutely core |

---

# 10. ILLUSION > SIMULATION

Never use a complex simulation if a deterministic illusion creates the same perceptual result.

Instead of cloth physics:
- bend mesh,
- predefined deformation,
- transform hierarchy,
- mask,
- perspective.

Instead of volumetric lighting:
- gradient mask,
- pseudo-light plane,
- animated opacity,
- one area light.

Instead of rigid-body physics:
- spring interpolation,
- constrained transforms,
- deterministic inertia.

Instead of particles:
- a few art-directed depth elements.

Instead of full 3D:
- DOM + CSS perspective + clip-path + transforms.

Use WebGL only when the idea truly requires geometry, camera, shaders, relighting, depth maps, or a real 3D object.

Never use WebGL for prestige.

---

# 11. PROTOTYPE STRATEGY

## 11.1 Prove the hero mechanic before building the product.

Do not build the entire site first.

Prototype:

```text
STATE A
→ TRANSITION
→ STATE B
→ ONE SIGNATURE INPUT
```

If this is not excellent, stop.

Do not add complexity to rescue it.

## 11.2 Test the cheapest representation.

Composition:
- static HTML/CSS or constrained renderer.

Motion:
- only approved states.

Interaction:
- only signature input.

Full site:
- only after those pass.

---

# 12. DESIGN AUTHORITY WORKFLOW

When no trusted visual authority exists:

## Stage 1 — Proven reference synthesis
Constrain hierarchy, proportions, spacing, type system, motion topology.

## Stage 2 — Bounded exploration
Generate a small number of variants, not a full site.

Example:

```text
Create 4 hero compositions using only:
- one dominant media object,
- one secondary translucent layer,
- one title block,
- one structural frame/line.
Do not add decorative objects.
```

## Stage 3 — User taste gate
Nothing becomes authoritative until the user approves it.

## Stage 4 — Freeze approved visual
Now measure:
- positions,
- proportions,
- sizes,
- overlaps,
- crops,
- type scale,
- depth,
- rotations.

## Stage 5 — Motion audition
Test a small number of timing families and transition amplitudes.

## Stage 6 — Freeze motion
Exact timing/easing becomes valid only after approval.

---

# 13. EXACT NUMBERS

## 13.1 Do not exactify uncertainty.

Before approval:

```text
hero width target = 58–66vw
```

After approval:

```text
hero width = 62.8vw
```

is valid.

## 13.2 Canonical viewports.

Default authorities:

```text
DESKTOP: 1440 × 900
MOBILE: 390 × 844
```

Use additional breakpoints only if necessary.

## 13.3 Golden motion states.

Define meaningful visual states at:

```text
0.00
0.30
0.55
0.80
1.00
```

If the transition looks bad when paused in the middle, it is not fully art-directed.

---

# 14. ASSET RULES

## 14.1 Assets are part of design.

Do not treat them as content to swap in later if they determine:

- composition,
- crop,
- color,
- balance,
- hierarchy.

## 14.2 Do not judge final quality using weak placeholders.

Use placeholders only when testing geometry.

Do not use generic SVGs or random images to judge final perceived quality.

## 14.3 Final prompt should map assets explicitly.

Include:

```text
ASSET_BASE_URL
asset name
dimensions
role
loading method
fallback
```

Critical asset failures should be visible, not silent.

---

# 15. MOTION DESIGN

## 15.1 Motion needs a global law.

Examples:

- one spring family,
- one normalized scroll progress,
- one or two easing families,
- one attack/hold/release logic.

Avoid unrelated animation personalities.

## 15.2 Conceptual vocabulary must be translated into behavior.

Do not end with:

> use counterpoint / suspension / cadence.

Translate into:

```text
A starts at 0.00
B starts at 0.14
C holds until 0.31
all resolve by 0.80
```

## 15.3 Prefer reversible continuous systems.

Use:

```js
progress = clamp(input, 0, 1)
```

Then derive transforms from progress.

Benefits:
- reversible motion,
- scrub,
- easier debugging,
- simpler prompt,
- coherent timing.

---

# 16. STATE MACHINES

Express experiences as states whenever possible.

Example:

```text
STATE_A
TRANSITION_A_B
STATE_B
OVERLAY_OPEN
PROJECT_DETAIL
```

or one normalized progress.

The engineering AI should know:

- what states exist,
- what triggers them,
- which variables change,
- which values they take,
- what reverses,
- what persists.

---

# 17. RESPONSIVE DESIGN

Never write only:

> Make it responsive.

Define transformation.

Example:

```text
DESKTOP
- depth visible
- media overlaps title
- secondary plane offset laterally

MOBILE
- depth reduced
- overlap becomes vertical sequence
- hierarchy preserved
- concept expressed through crop and layering
```

Mobile preserves the idea, not the exact desktop geometry.

---

# 18. ACCESSIBILITY AND REDUCED MOTION

At production stage include:

- semantic HTML,
- heading hierarchy,
- keyboard access,
- visible focus,
- accessible overlays,
- useful alt text,
- no meaning only on hover,
- no content dependent only on drag,
- reduced motion,
- fallback when WebGL fails.

Reduced motion should preserve hierarchy and state changes while simplifying parallax, elastic motion, and camera movement.

---

# 19. CREATOR VS HOSTILE REVIEWER

Never let the same reasoning mode create and instantly approve.

## Creator
Goal: produce strong candidates.

## Hostile Reviewer
Goal: find reasons to reject.

Reviewer tests:

- genericity,
- cliché,
- weak hierarchy,
- effect overpowering work,
- unclear main actor,
- unclear interaction,
- weak authenticity,
- high complexity,
- poor impact/complexity,
- reference dependence,
- mobile failure,
- implementation fragility,
- asset fragility,
- specification ambiguity.

If a hard failure appears:
- reject,
- simplify,
- or mutate.

Do not continue merely because time has already been invested.

---

# 20. DO NOT OVERREACT TO THE LATEST FEEDBACK

Local feedback should not cause full conceptual collapse unless it reveals a hard failure.

Ask:

> What exactly failed?
> What must remain protected?

Example:

User: "Don't make it too game-like."

Wrong:
Remove world, toy, spectacle.

Better:
Keep world and memorable interaction; remove tutorial, mandatory exploration, and control friction.

---

# 21. NEGATIVE CONSTRAINTS ARE NOT A DESIGN

A long "no" list does not create direction.

For every important prohibition, provide a positive replacement.

Bad:

```text
no particles
no blobs
no glow
no cards
no marquee
```

Better:

```text
Do not use a particle field.
Instead use one large foreground object to create depth.
```

---

# 22. SPECIFICATION COST

Judge concepts by how expensive they are to specify reliably.

A strong vibe-code concept should be:

- visually distinctive,
- structurally simple,
- state-driven,
- controlled by few variables,
- easy to verify.