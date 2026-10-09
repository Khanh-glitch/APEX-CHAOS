# B4 temporary Quest stage HUD — read-only replay architecture

The 2026-10-09 owner requested a temporary Quest HUD to choose and replay encounters. This implementation reuses the existing Director chapter panel and its Gold buttons. No duplicate battle UI is created.

The permanent `apex-chaos.quest01.progress.v1` store remains authoritative. Only encounters with a lower node index than the saved checkpoint are replayable. Entry at E02 reuses WORKSHOP→FIRST_WAKE, E01 reuses WAKE→REFLEX; E03–E05 use their own entry. The replay Director is a private in-memory `create(storage)` instance, so all actual Arsenal hit/KO/Story acknowledgement rules still apply, but their resulting writes stay in RAM and vanish on Exit or reload. Future or current incomplete encounters cannot be jumped to through the replay API.

**Not yet a final HUD**: visual proportions need real Chrome mobile/tablet review. B4 stage replay must also undergo real battle E01–E05 smoke to verify no leaked temporary state or double reward when a user exits mid-transition. E06–E08 remain locked until implemented.
