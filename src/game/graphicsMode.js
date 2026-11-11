// R5 opt-in graphics mode. HIGH is the untouched default.
// This is initialized before classic Gold/BOT WAVE runtimes load.
const STORAGE_KEY = 'apex.graphics.mode';
const normalize = (value) => value === 'performance' || value === 'high' ? value : null;
function readStorage() {
  try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function storeMode(value) {
  try { window.localStorage.setItem(STORAGE_KEY, value); } catch { /* storage disabled */ }
}
const urlMode = (() => {
  try { return normalize(new URL(window.location.href).searchParams.get('graphics')); }
  catch { return null; }
})();
let mode = urlMode || normalize(readStorage()) || 'high';
if (urlMode) storeMode(mode);
export function getGraphicsMode() { return mode; }
export function installGraphicsMode() {
  if (window.APEX_GRAPHICS_MODE) return window.APEX_GRAPHICS_MODE;
  function switchMode(next) {
    const value = normalize(next);
    if (!value || value === mode) return false;
    mode = value;
    storeMode(value);
    // Explicit reload is required to recreate the canvas at the selected DPR;
    // never resize its backing store halfway through a live battle frame.
    const url = new URL(window.location.href);
    url.searchParams.set('graphics', value);
    window.location.assign(url.href);
    return true;
  }
  const api = Object.freeze({
    get: getGraphicsMode,
    set: switchMode,
    toggle: () => switchMode(mode === 'high' ? 'performance' : 'high'),
  });
  window.APEX_GRAPHICS_MODE = api;
  window.addEventListener('keydown', (event) => {
    if (!event.ctrlKey || !event.shiftKey || event.code !== 'F6' || event.repeat) return;
    event.preventDefault();
    api.toggle();
  }, true);
  return api;
}
