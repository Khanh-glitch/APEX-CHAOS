# APEX CHAOS Evolution — Visual Research & Asset Provenance

## Open-source implementation research (study only; no upstream source copied)

- **pixelfx** — https://github.com/patch-gg/pixelfx — MIT. Studied its authored effect choreography, wind-up → snap → hit-stop → recovery sequence, and how impacts are previewed as acting rather than a single particle burst. Evolution does **not** bundle this project's source, sprites, or font.
- **Particlus** — https://github.com/Raveler/particlus — MIT (author attribution requested in its README). Studied its pre-generated sprite/color/size tables and bounded particle-pool approach. Evolution uses an independently authored pool/atlas implementation; no Particlus source is shipped.
- **PixiJS filters documentation** — https://pixijs.com/8.x/guides/components/filters — studied filter ordering, displacement maps, and keeping post-process quality configurable.
- **Khronos WebGL conformance tests** — https://github.com/KhronosGroup/WebGL — consulted for framebuffer/feedback-loop correctness. The compositor samples the game canvas into a separate WebGL texture; it never samples its own output canvas.

## Evolution hero atlases

`fighters/black-hole/*.png` and `fighters/chrono/*.png` are original APEX CHAOS Gold key/skill art already present in the project, cropped into 512×512, radially feathered RGBA textures for combat-scale sprites. Original art remains in `assets/gold-ui/heroes/{black_hole,time}/`. The atlas is project-authored derivative art, not an upstream repository asset.

## Arena base materials

The photographs under `materials/` are Pexels License materials, modified/tinted and composited under APEX CHAOS-authored arena architecture. See `materials/PROVENANCE.md` for individual creators and source URLs. Pexels License allows commercial use and modification; the sources are not redistributed as standalone originals outside the game/asset packs.
