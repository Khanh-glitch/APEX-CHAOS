// Unified notice bus. Anything (React, classic runtimes, console) can raise a
// premium in-game notice:
//   window.APEX_NOTIFY.push({ variant:'reward'|'success'|'info'|'warn'|'error',
//                             kicker, title, body, value, icon, life })
// Presentation-only: it never reads or writes game/economy state.
const listeners = new Set();
let items = [];
let seq = 0;
const MAX_VISIBLE = 4;

function emit() {
  const snapshot = items.slice();
  listeners.forEach((fn) => { try { fn(snapshot); } catch { /* listener fault must never break gameplay */ } });
}

export function pushNotice(input = {}) {
  const id = ++seq;
  const life = Math.max(1200, Math.min(12000, Number(input.life) || 3800));
  // identical consecutive notices collapse (anti-spam) instead of stacking
  const key = input.key || null;
  if (key) {
    const dup = items.find((n) => n.key === key && !n.leaving);
    if (dup) { dismissNotice(dup.id, true); }
  }
  items = [...items, { variant: 'info', ...input, id, life, key, leaving: false, at: Date.now() }];
  const live = items.filter((n) => !n.leaving);
  if (live.length > MAX_VISIBLE) dismissNotice(live[0].id);
  emit();
  return id;
}

export function dismissNotice(id, instant = false) {
  const target = items.find((n) => n.id === id);
  if (!target || target.leaving) return;
  if (instant) {
    items = items.filter((n) => n.id !== id);
    emit();
    return;
  }
  items = items.map((n) => (n.id === id ? { ...n, leaving: true } : n));
  emit();
  window.setTimeout(() => {
    items = items.filter((n) => n.id !== id);
    emit();
  }, 300);
}

export function clearNotices() {
  items.forEach((n) => dismissNotice(n.id));
}

export function subscribeNotices(fn) {
  listeners.add(fn);
  fn(items.slice());
  return () => listeners.delete(fn);
}

export function installNotifyApi(target = window) {
  if (target.APEX_NOTIFY) return;
  target.APEX_NOTIFY = Object.freeze({ push: pushNotice, dismiss: dismissNotice, clear: clearNotices });
  target.addEventListener('apex:notify', (event) => {
    if (event?.detail) pushNotice(event.detail);
  });
}
