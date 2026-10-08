// R82 opt-in geometry experiment. NEVER enabled without ?apexLayoutLab=home.
// This experiments with design-space scaling of Home UI islands only.
// Gold source, the production generator, battle, and fighter pick stay untouched.
if (new URLSearchParams(window.location.search).get('apexLayoutLab') === 'home') {
  const ROOT = document.documentElement;
  const REF_W = 550;
  const REF_H = 857;
  const REF_ASPECT = REF_W / REF_H;
  const MAX_ASPECT_DELTA = 0.012;
  const CLASS = 'apex-layout-lab-home-active';
  const STYLES = [
    '/* R82: opt-in laboratory ONLY. No production styling without URL switch. */',
    '.' + CLASS + ' #stage:not(.screen-mode):not(.screen-fighter):not(.screen-battle) .story {',
    'left:calc(var(--apexLabX) + 30.8px * var(--apexLabS))!important;',
    'top:calc(var(--apexLabY) + 370.224px * var(--apexLabS))!important;',
    'right:auto!important;width:488.4px!important;',
    'scale:var(--apexLabS)!important;transform-origin:0 0!important;',
    'transition-property:opacity,transform,translate,filter!important;',
    '}',
    '.' + CLASS + ' #stage:not(.screen-mode):not(.screen-fighter):not(.screen-battle) .storyTitle {',
    'font-size:57px!important;line-height:.82!important;',
    '}',
    '.' + CLASS + ' #stage:not(.screen-mode):not(.screen-fighter):not(.screen-battle) .actions {',
    'left:calc(var(--apexLabX) + 27.5px * var(--apexLabS))!important;',
    'top:calc(var(--apexLabY) + 575.047px * var(--apexLabS))!important;',
    'right:auto!important;width:495px!important;gap:8px!important;',
    'scale:var(--apexLabS)!important;transform-origin:0 0!important;',
    'transition-property:opacity,transform,translate,filter!important;',
    '}',
    '.' + CLASS + ' #stage:not(.screen-mode):not(.screen-fighter):not(.screen-battle) .actions .cta {',
    'height:60px!important;',
    '}',
    '.' + CLASS + ' #stage:not(.screen-mode):not(.screen-fighter):not(.screen-battle) .actions .secondary {',
    'height:46px!important;',
    '}',
    '.' + CLASS + ' #stage:not(.screen-mode):not(.screen-fighter):not(.screen-battle) .routes {',
    'left:calc(var(--apexLabX) + 22px * var(--apexLabS))!important;',
    'bottom:calc(var(--safeB, 0px) + var(--apexLabY) + 9.427px * var(--apexLabS))!important;',
    'right:auto!important;width:506px!important;gap:5px!important;',
    'scale:var(--apexLabS)!important;transform-origin:0 100%!important;',
    '}',
    '.' + CLASS + ' #stage:not(.screen-mode):not(.screen-fighter):not(.screen-battle) .routes .route {',
    'height:46px!important;',
    '}',
    '.' + CLASS + ' #stage:not(.screen-mode):not(.screen-fighter):not(.screen-battle) .brand {',
    'left:calc(var(--apexLabX) + 22px * var(--apexLabS))!important;',
    'top:calc(var(--apexLabY) + 11.998px * var(--apexLabS))!important;',
    'width:150px!important;scale:var(--apexLabS)!important;transform-origin:0 0!important;',
    '}',
    '.' + CLASS + ' #stage:not(.screen-mode):not(.screen-fighter):not(.screen-battle) .profile {',
    'right:calc(var(--apexLabX) + 22px * var(--apexLabS))!important;',
    'top:calc(var(--apexLabY) + 15.426px * var(--apexLabS))!important;',
    'scale:var(--apexLabS)!important;transform-origin:100% 0!important;',
    '}',
    '.' + CLASS + ' #stage:not(.screen-mode):not(.screen-fighter):not(.screen-battle) .heroWrap {',
    'top:6.5vh!important;width:91vw!important;',
    '}'
  ].join('\n');
  const style = document.createElement('style');
  style.id = 'apex-r82-home-layout-lab-only';
  style.textContent = STYLES;
  document.head.appendChild(style);

  ROOT.dataset.apexLayoutLab = 'home';
  let last = null;
  let scheduled = false;
  const measure = () => {
    scheduled = false;
    const stage = document.querySelector('#gold-shell-host #stage');
    const width = stage?.offsetWidth || document.documentElement.clientWidth || innerWidth;
    const height = stage?.offsetHeight || document.documentElement.clientHeight || innerHeight;
    const aspect = width / Math.max(1, height);
    const active = Number.isFinite(aspect) && width < height &&
      Math.abs(aspect - REF_ASPECT) <= MAX_ASPECT_DELTA;
    ROOT.classList.toggle(CLASS, active);
    if (!active) {
      last = { active: false, width, height, aspect, reason: 'outside reference portrait aspect band' };
      return;
    }
    const scale = Math.min(width / REF_W, height / REF_H);
    const offsetX = (width - REF_W * scale) / 2;
    const offsetY = (height - REF_H * scale) / 2;
    ROOT.style.setProperty('--apexLabS', String(scale));
    ROOT.style.setProperty('--apexLabX', offsetX.toFixed(4) + 'px');
    ROOT.style.setProperty('--apexLabY', offsetY.toFixed(4) + 'px');
    last = { active: true, width, height, aspect, scale, offsetX, offsetY };
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(measure);
  };
  window.addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('resize', schedule, { passive: true });
  // Mount occurs after entrypoint evaluation, so read stage metrics once it appears.
  const observer = new MutationObserver(() => {
    if (!document.querySelector('#gold-shell-host #stage')) return;
    observer.disconnect();
    schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.__apexHomeLayoutLab = Object.freeze({
    snapshot: () => last && { ...last },
    measure: schedule
  });
  measure();
}
