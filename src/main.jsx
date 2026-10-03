import React from 'react';
import { createRoot } from 'react-dom/client';
import { installProductSurfaceAuthority } from './game/productSurface.js';
import App from './App.jsx';
import './styles.css';

// Install before React and before any deferred classic runtime can evaluate.
installProductSurfaceAuthority(window);

createRoot(document.getElementById('root')).render(<App />);
