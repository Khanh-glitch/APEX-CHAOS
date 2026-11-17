import { useSyncExternalStore, useEffect, useState } from 'react';
import { installGraphicsQuality } from '../game/graphicsQuality.js';

export function useGraphics() {
  const api = installGraphicsQuality();
  return [useSyncExternalStore(api.subscribe, api.getSnapshot), api.update];
}

export function useGameLanguage() {
  const read = () => window.APEX_I18N?.getLanguage?.() === 'vie';
  const [vietnamese, setVietnamese] = useState(read);
  useEffect(() => {
    const sync = () => setVietnamese(read());
    window.addEventListener('apex:language-changed', sync);
    return () => window.removeEventListener('apex:language-changed', sync);
  }, []);
  return vietnamese;
}
