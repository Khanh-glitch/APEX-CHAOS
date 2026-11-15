# Evolution VFX source pack

The VFX runtime bakes an atlas once per session and draws pooled alpha sprites. Skills/Ultimates combine that atlas with existing art textures, real projectile trajectories, material-specific arena responses, and bounded camera/screen feedback. WebGL2 is optional and quality-selectable; all gameplay VFX have a Canvas fallback. See `../REFERENCES.md` for the repositories studied and their licenses.
