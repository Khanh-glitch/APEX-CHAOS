import React from 'react';
import { createRoot } from 'react-dom/client';
import { installProductSurfaceAuthority } from './game/productSurface.js';
import App from './App.jsx';
import './styles.css';
import './game/mobileViewportAudit.js';
import { installLocalization } from './game/localizationRuntime.js';
import './game/localization.css';

// Install before React and before any deferred classic runtime can evaluate.
installProductSurfaceAuthority(window);
installLocalization();

createRoot(document.getElementById('root')).render(<App />);
