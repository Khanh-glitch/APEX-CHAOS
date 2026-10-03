# APEX CHAOS — OPENING PLAYER JOURNEY AUTHORITY v1
## FIRST BOOT → QUEST 01 → POST-QUEST STATE

**Status:** owner-approved product flow for the opening player journey.
**Scope:** account entry, fresh/returning routing, Quest 01 entry, post-Quest unlocks and first safe product handoff.

---

# 0. PRINCIPLES

1. A new player should reach APEX CHAOS gameplay before being asked to understand the product shell.
2. Account creation must not block first play.
3. Returning players should be recognized and allowed to continue quickly.
4. Quest 01 is the first real experience, not one menu option among legacy modes.
5. Story emotion must not be interrupted by economy/account popups.
6. Local guest and cloud/account play must eventually use the same player-profile schema.
7. Legacy main-menu modes are not part of the fresh-player journey.

---

# 1. SESSION RESOLUTION

On boot, resolve three states.

## STATE A — no local profile / no active account session

Primary:
**START PLAYING**

Secondary:
**LOG IN**

START PLAYING creates a local guest profile and enters Quest 01.

Do not require email, username, password, account creation, hero selection or mode selection.

## STATE B — local guest profile exists

Primary:
**CONTINUE**

Secondary:
**LOG IN**

CONTINUE resumes the last safe checkpoint / last safe product state.

Do not restart Quest 01 unless player deliberately chooses New Game through a later account/profile surface.

## STATE C — active signed-in account session exists

Primary:
**CONTINUE**

The product should restore the account session without asking for credentials every launch when session validity allows.

Account authentication implementation details remain outside this document, but passwords must never be stored directly in local game state.

---

# 2. PLAYER PROFILE AUTHORITY

Before cloud-account work, create one canonical profile schema.

Conceptual authority:

profile
- identity
- story
- economy
- fighters
- upgrades
- discovery
- missions
- achievements
- statistics
- settings
- checkpoints

Local guest profile and account-backed profile must use the same schema.

Account creation after play should protect/associate the existing guest profile rather than create a second independent save.

Do not build account synchronization over scattered feature-specific localStorage islands.

Existing storage such as Arsenal meta and old Arsenal Quest save must be migrated or adapted behind the unified authority during product cutover.

---

# 3. FRESH PLAYER INITIAL STATE

On START PLAYING:

- create local guest profile;
- NEWBOT is the default owned/playable hero;
- starting economy value remains 350 AC as current pilot baseline;
- AC does not need to be surfaced before the world introduces economy;
- Quest 01 checkpoint state = opening;
- begin Story immediately.

Player-facing hero name:
**NEWBOT**

Internal storage may retain ROBOT where needed for safe migration.

---

# 4. NO LEGACY MENU BEFORE QUEST 01

Fresh player must not land on the current legacy menu containing Play, APEX CONTROL, 3-Phase Battle, Saitama test, Tournament, old Solo or old Arsenal Quest.

Quest 01 begins as the first product experience.

The old 20-stage Arsenal Quest ladder is not part of this journey.

Admin/dev access is a separate concern.

---

# 5. FIRST 60 SECONDS

Target:
- cinematic/in-engine wake sequence begins immediately;
- NEWBOT crawls out of scrap;
- Scrap Basin scale is revealed;
- first Weapon Drop appears within roughly 45–60 seconds maximum;
- transition into REFLEX without loading into a separate-looking game mode.

Do not front-load cosmology, faction history, Crystala, account education, Shop, Draw, Missions or upgrade tutorials.

---

# 6. QUEST 01 JOURNEY

The player goes directly through:

WAKE
→ REFLEX
→ RIVET WORKSHOP
→ FIRST WAKE
→ SCRAP SWARM
→ WEAPON RAIN
→ CHARGE THE BREAKER
→ BREACH WAVES
→ RIVET OVERRIDDEN
→ T.O.T: LAST CHOICE
→ OUTSIDE

The detailed truth is owned by:
APEX_CHAOS_QUEST_01_IMPLEMENTATION_AUTHORITY_V1_2026-10-03.md

Expected first-play duration:
roughly 32–42 minutes.

Autosave occurs at authored checkpoints.

If the player quits during Quest 01, next launch should offer **CONTINUE** and restore the latest safe checkpoint.

Long cinematics should not be replayed unnecessarily after retry/resume.

---

# 7. QUEST 01 ENDING HANDOFF

After T.O.T's sacrifice:

- NEWBOT exits into a quiet wider region;
- civilization is visible only at distance;
- no immediate settlement NPC;
- no Shop;
- no Lucky Draw;
- no account prompt;
- no reward shower.

Show:

**QUEST 01 COMPLETE**
**THE ONES THROWN AWAY**

Primary action:
**CONTINUE STORY**

The ending should retain emotional silence long enough for T.O.T's death to land.

Profile rewards/progress may commit silently.

---

# 8. POST-QUEST UNLOCK STATE

After Quest 01, the product shell begins opening gradually.

## Immediately available

### CONTINUE STORY
Primary.

### DICTIONARY
Initial discovered entries may include:
- NEWBOT
- T.O.T
- RIVET
- THE BOT Project
- Scrap Basin
- Weapon Drop
- Stormbreaker

Dictionary entries must only contain knowledge NEWBOT/player has actually earned.

### FREE BATTLE — BOT
May unlock as the first replayable combat activity.

At this point the player owns only NEWBOT by default.

Therefore Free Battle must not require two owned collectible heroes.

Initial form:
- NEWBOT vs generic training/combat/scrap Bot opponent;
- same Arsenal combat truth.

As roster ownership expands, Free Battle opponent/fighter selection can expand.

---

# 9. SYSTEMS NOT YET SURFACED

Do not surface immediately after Quest 01:
- Fighter Shop
- Lucky Draw
- Fighter Upgrade
- full Missions UI
- full Achievements UI
- economy tutorial

These should be introduced when NEWBOT reaches appropriate civilization/world context.

Achievements and Missions may track silently before their UI is introduced.

Starting 350 AC may exist silently in profile.

---

# 10. ACCOUNT PROMPT TIMING

Do not ask for account creation on the Quest 01 death/ending screen.

Valid later moments include:
- player deliberately opens Account;
- player reaches a safe hub/settlement;
- player attempts to exit after meaningful progress;
- another calm product moment where protecting progress is relevant.

Suggested product intent:
**Protect your progress**

Account remains optional for first play.

---

# 11. GUEST → ACCOUNT

If a guest player creates a new account:
- associate/protect the current guest profile;
- do not reset progress;
- do not create duplicate NEWBOT/economy/story state.

If a guest player logs into an already-existing account:
- do not silently merge currencies, ownership or progression;
- present an explicit profile choice/restore flow when account implementation is designed.

Exact merge UX is open, but silent merge is forbidden.

---

# 12. RETURNING PLAYER

Returning player with saved state:

Boot
→ session resolution
→ **CONTINUE**
→ last safe location/checkpoint.

Examples:
- mid-Quest 01 → latest Quest checkpoint;
- Quest 01 complete → post-Quest outside/safe shell state;
- later story → later authored checkpoint/hub.

Do not force replay of opening Story merely because no account is attached.

---

# 13. PRODUCT SHELL DIRECTION AFTER OPENING

Long-term Arsenal product shell remains:
- Battle
- Quest
- Shop
- Draw
- Upgrade
- Dictionary
- Missions
- Account

But these do not appear as eight equal choices on first boot.

They are progressively introduced.

Admin Arsenal Lab remains outside normal player journey.

---

# 14. PILOT BLOCKERS

Before pilot/release flow is considered valid:

1. Remove the 12,000 AC owner-test grant from normal player profiles.
2. Bypass/remove the old seven-button legacy main menu from fresh-player routing.
3. Remove old 20-stage Arsenal Quest from normal Story routing.
4. Establish unified Player Profile Authority.
5. Implement Quest 01 autosave/resume.
6. Prove fresh player can START PLAYING with no account.
7. Prove returning guest sees CONTINUE.
8. Prove signed-in returning player can continue without unnecessary re-login.
9. Keep account creation away from T.O.T's ending beat.

---

# 15. OPENING JOURNEY SUCCESS CONDITION

A new player should finish the opening session feeling:
- “I know how APEX CHAOS combat works.”
- “I care about what happened to T.O.T.”
- “I want to know what is controlling the Bots.”
- “NEWBOT is different, but I do not yet know why.”
- “There is a much larger living world outside this wall.”
- “I know what to press next: CONTINUE STORY.”

The player should **not** finish the opening thinking:
- “Which of seven modes was the real game?”
- “Why did I need an account before I knew if I liked this?”
- “Why am I shopping immediately after a death scene?”
- “Why did the game explain its entire lore in the first hour?”
