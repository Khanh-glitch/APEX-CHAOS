`forgeFireGold.js` is the unmodified `createForgeFire` function extracted from
`public/game/bot-wave/botWavePresentationV2.js` at baseline
`cccc6acac918e9b5f05891641f9fed2fcc044175`.

This is an immutable test oracle, never a shipping runtime. The browser test
locks its SHA-256, compares the exact shader source, then checks WebGL framebuffer
bytes and Canvas particle bytes against the production renderer. Do not update
this fixture to make a candidate pass.
