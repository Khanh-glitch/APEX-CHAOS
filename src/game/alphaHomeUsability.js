// Release Alpha home usability layer. Keep the accepted Gold source file untouched.
export function installAlphaHomeUsability() {
  const stage = document.querySelector('#gold-shell-host #stage');
  if (!stage) return () => {};
  const profile = stage.querySelector('.profile');
  // Guest account has one entry, located in the existing lower Home navigation.
  stage.querySelector('.profileIdentity')?.remove();
  // The old top-right gear/sun control does not implement settings/theme.
  stage.querySelector('.profile .settings')?.remove();
  const account = stage.querySelector('[data-locked-route="account-profile"]');
  if (account) {
    account.removeAttribute('data-locked-route');
    account.removeAttribute('aria-disabled');
    account.removeAttribute('title');
    account.setAttribute('aria-label', 'Account');
    account.setAttribute('data-apex-account-entry', '');
    account.classList.remove('is-locked');
  }
  // The lower Missions route owns both Missions and Achievements tabs.
  const missions = stage.querySelector('[data-locked-route="missions"]');
  if (missions) {
    missions.removeAttribute('data-locked-route');
    missions.removeAttribute('aria-disabled');
    missions.removeAttribute('title');
    missions.setAttribute('aria-label', 'Missions and Achievements');
    missions.setAttribute('data-apex-progress-entry', '');
    missions.classList.remove('is-locked');
  }
  // Don't duplicate the current language picker; localization owns its lifecycle.
  const help = document.createElement('button');
  help.type = 'button';
  help.className = 'apex-guide-reopen';
  help.textContent = '?';
  help.title = 'How to play / Hướng dẫn';
  help.setAttribute('aria-label', 'How to play / Hướng dẫn');
  help.addEventListener('click', () => window.dispatchEvent(new Event('apex:guide-open')));
  profile?.prepend(help);

  // These cues are side-based (never compare hero names to decide who is P1).
  // Both fighters may pick the same canonical hero and art must remain intact.
  const p1 = stage.querySelector('#p1Name');
  const p2 = stage.querySelector('#p2Name');
  const badge = stage.querySelector('#fighterModeBadge');
  const updateMirror = () => {
    const visible = stage.classList.contains('screen-fighter');
    const identical = !!p1?.textContent?.trim() && !!p2?.textContent?.trim() &&
      p1.textContent.trim() === p2.textContent.trim();
    stage.classList.toggle('apex-mirror-duel', visible && identical);
  };
  updateMirror();
  const observer = new MutationObserver(updateMirror);
  [p1, p2, badge].filter(Boolean).forEach((node) => observer.observe(node, { childList: true, subtree: true, characterData: true }));
  // Screen changes are class-only, not characterData changes.
  observer.observe(stage, { attributes: true, attributeFilter: ['class'] });
  return () => { observer.disconnect(); help.remove(); };
}
