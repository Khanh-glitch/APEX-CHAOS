# APEX CHAOS — HUNTER SFX GAME-READY REFERENCE

This mapping is owner-authoritative. Do not remap by filename.

Git reference archive: `APEX_HUNTER_SFX_GAME_READY.zip`  
Materialize: `node tools/materializeHunterSfxPrep.mjs`  
Reconstructed archive SHA-256: `e1aedcd48f5dc136fbf12aeb95145f87a9fc2ea2ff92ecb6bf21fe2146845014`

Contents:

| Runtime file | Semantic event |
| --- | --- |
| `hunter_a1_charge_personal.mp3` | A1 charge/prep; personal/local controller only |
| `hunter_a1_deploy_mechanism.mp3` | A1 placement/mechanical deploy |
| `hunter_a1_unfold_blade.mp3` | A1 blade unfold/open beat |
| `hunter_a1_clamp.mp3` | A1 real opponent trap-trigger/clamp only |
| `hunter_a2_pounce_sweep.mp3` | A2 real launch/travel sweep |
| `hunter_a2_catch_flesh.mp3` | A2 real swept catch/contact only |

The MP3s preserve full source duration. Use runtime playback offsets/durations/fades where choreography needs a subsection; do not destructively trim or replace them.

Original source lineage used to create these game-ready files:

- `mixkit-gaming-lock-2848.wav`
- `daviddumaisaudio-spinning-steampunk-gadget-open-close-188050.mp3`
- `mixkit-swift-sword-strike-2166.wav`
- `rison8-dbd-bear-trap-being-disarmed-135902.mp3`
- `mixkit-futuristic-metal-transition-sweep-2636.wav`
- `universfield-sword-blade-slicing-flesh-352708.mp3`

Do not reinterpret cue ownership from the original filenames. The semantic table above wins.


Per-file SHA-256 after materialization:

- `hunter_a1_charge_personal.mp3` — `a481406872ae4062fc426af296137804cd04c6380126363730f497dd0f52f511`
- `hunter_a1_clamp.mp3` — `bef29c9ef4b686fc4462ec97224798fc69545976fd64faae3eb5c7aa64fd1af6`
- `hunter_a1_deploy_mechanism.mp3` — `b38a31f5cbb833fb6339b307e6e9b49a17fc5298d8236da4b4f0a5ec4fbf8a8e`
- `hunter_a1_unfold_blade.mp3` — `5b8e0fdc220386f4fae3b2e036fa2fc384e95b47ed36efb08464c02f70fd2b54`
- `hunter_a2_catch_flesh.mp3` — `4d195cc24fffec6e972b1470a5fec0e25e87bc10b6814dd6e4bd25825a23791d`
- `hunter_a2_pounce_sweep.mp3` — `a0781b5f58df749f8e2c7c9ca636aeb2b73a4e7dcec236f0fa8fd6f660044270`

The staged ZIP is reference transport only. Never load it at runtime.
