// Sandbox / LAN live-preview dev server config ONLY.
// The main vite.config.js intentionally keeps a strict host policy (see commit
// 7837389); this wrapper exists so proxied preview hosts can load the app.
// Run with: pnpm exec vite --host 0.0.0.0 --config vite.preview.config.js
import base from './vite.config.js';

export default {
  ...base,
  server: {
    ...(base.server || {}),
    allowedHosts: true,
  },
};
