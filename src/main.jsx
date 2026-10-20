import React from 'react';
import { createRoot } from 'react-dom/client';
import { installProductSurfaceAuthority } from './game/productSurface.js';
import { installPlayerAccountAuthority } from './game/playerAccount.js';
import { installAdminAuthority } from './game/adminAuthority.js';
import { installCloudAccount, initCloudAccount } from './game/cloudAccount.js';
import { GUEST_ONLY_RELEASE } from './game/releasePolicy.js';
import App from './App.jsx';
// Montserrat 900 is self-hosted (Fontsource, OFL) so the shell renders
// identically offline and inside the itch.io iframe — no third-party
// font request may gate first paint.
import '@fontsource/montserrat/900.css';
import './styles.css';
import './game/mobileViewportAudit.js';
import { installLocalization } from './game/localizationRuntime.js';
import './game/localization.css';
import './game/sideIdentity.css';

// Install before React and before any deferred classic runtime can evaluate.
installProductSurfaceAuthority(window);
// A1: identity + admin authorities must exist before classic runtimes probe
// them (economy selection override, Ctrl+Shift+F8). Cloud init is async and
// env-gated; without Supabase env vars it reports 'cloud-unconfigured'.
installPlayerAccountAuthority(window);
installAdminAuthority(window);
// Keep the immutable fail-closed facade for compatibility and security
// tests, but never open a network Auth session in the itch Guest release.
installCloudAccount(window);
if (!GUEST_ONLY_RELEASE) void initCloudAccount();
installLocalization();

createRoot(document.getElementById('root')).render(<App />);
