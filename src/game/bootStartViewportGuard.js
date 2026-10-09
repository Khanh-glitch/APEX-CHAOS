// Mobile boot START protection. Geometry-only; preserves the supplied START art
// and its click/transition lifetime. Never moves it when entirely visible.
export function computeStartLift({
  unshiftedBottom, visibleBottom, safety = 12
}) {
  if (![unshiftedBottom, visibleBottom, safety].every(Number.isFinite)) return 0;
  return Math.max(0, Math.ceil(unshiftedBottom - (visibleBottom - Math.max(0, safety))));
}
export function attachBootStartViewportGuard(button) {
  if (!button || typeof window === 'undefined') return () => {};
  let lift = 0;
  let raf = 0;
  let disposed = false;
  const measure = () => {
    raf = 0;
    if (disposed || !button.isConnected) return;
    const visual = window.visualViewport;
    const visibleBottom = Math.min(window.innerHeight,
      visual ? visual.offsetTop + visual.height : window.innerHeight);
    // getBoundingClientRect already includes our previous CSS translate offset.
    const unshiftedBottom = button.getBoundingClientRect().bottom + lift;
    const next = computeStartLift({unshiftedBottom, visibleBottom});
    if (next !== lift) {
      lift = next;
      // Separate CSS translate does not overwrite Gold's transform keyframes.
      if (lift) button.style.translate = '0px -' + lift + 'px';
      else button.style.removeProperty('translate');
    }
  };
  const request = () => {
    if (!disposed && !raf) raf = window.requestAnimationFrame(measure);
  };
  const observer = new ResizeObserver(request);
  observer.observe(button);
  window.addEventListener('resize',request,{passive:true});
  window.addEventListener('orientationchange',request,{passive:true});
  window.visualViewport?.addEventListener('resize',request,{passive:true});
  window.visualViewport?.addEventListener('scroll',request,{passive:true});
  request();
  return () => {
    disposed = true;
    if (raf) window.cancelAnimationFrame(raf);
    observer.disconnect();
    window.removeEventListener('resize',request);
    window.removeEventListener('orientationchange',request);
    window.visualViewport?.removeEventListener('resize',request);
    window.visualViewport?.removeEventListener('scroll',request);
    button.style.removeProperty('translate');
  };
}
