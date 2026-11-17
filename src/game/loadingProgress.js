// Observable work counts, not a timer pretending to be download progress.
let snapshot = { label: 'boot', completed: 0, total: 0, busy: true, error: false };
const listeners = new Set();
let sequence = 0;
export const getLoadingSnapshot = () => snapshot;
export const subscribeLoading = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const publish = patch => { snapshot = { ...snapshot, ...patch }; listeners.forEach(fn => fn()); };
export function beginLoading(label, total = 0) {
  const id = ++sequence;
  publish({ label, completed: 0, total, busy: true, error: false });
  return {
    step() { if (id === sequence) publish({ completed: Math.min(snapshot.total, snapshot.completed + 1) }); },
    finish() { if (id === sequence) publish({ completed: total, busy: false }); },
    fail() { if (id === sequence) publish({ busy: false, error: true }); },
  };
}
export function failLoading() { publish({ error: true, busy: false }); }
