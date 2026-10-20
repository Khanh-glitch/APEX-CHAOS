import React from 'react';
import { createRoot } from 'react-dom/client';
import { installProductSurfaceAuthority } from './game/productSurface.js';
import { installPlayerAccountAuthority } from './game/playerAccount.js';
import { installAdminAuthority } from './game/adminAuthority.js';
import { installCloudAccount, initCloudAccount } from './game/cloudAccount.js';
import App from './App.jsx';
import './styles.css';
import './game/mobileViewportAudit.js';
import { installLocalization } from './game/localizationRuntime.js';
import './game/localization.css';

// Install before React and before any deferred classic runtime can evaluate.
installProductSurfaceAuthority(window);
// A1: identity + admin authorities must exist before classic runtimes probe
// them (economy selection override, Ctrl+Shift+F8). Cloud init is async and
// env-gated; without Supabase env vars it reports 'cloud-unconfigured'.
installPlayerAccountAuthority(window);
installAdminAuthority(window);
installCloudAccount(window);
void initCloudAccount();
installLocalization();

createRoot(document.getElementById('root')).render(<App />);
