import { useEffect } from 'react';

const HEX_COIN_SVG = `
<svg width="22" height="22" viewBox="0 0 36 36" fill="none" aria-hidden="true" style="display:block">
  <defs>
    <linearGradient id="acHomeRim" x1="4" y1="2" x2="32" y2="34" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFF6D6" />
      <stop offset="30%" stop-color="#FFC84A" />
      <stop offset="68%" stop-color="#D48318" />
      <stop offset="100%" stop-color="#6E3B04" />
    </linearGradient>
    <linearGradient id="acHomeCore" x1="8" y1="6" x2="28" y2="30" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#3B2309" />
      <stop offset="50%" stop-color="#1C1105" />
      <stop offset="100%" stop-color="#0E0803" />
    </linearGradient>
    <linearGradient id="acHomeGlyph" x1="12" y1="9" x2="24" y2="27" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFF9E6" />
      <stop offset="45%" stop-color="#FFD264" />
      <stop offset="100%" stop-color="#E08A1E" />
    </linearGradient>
  </defs>
  <polygon points="18,1.8 32.2,9.9 32.2,26.1 18,34.2 3.8,26.1 3.8,9.9" fill="url(#acHomeRim)" stroke="#FFF3C4" stroke-width="0.9" stroke-opacity="0.65" />
  <polygon points="18,5.2 29.2,11.6 29.2,24.4 18,30.8 6.8,24.4 6.8,11.6" fill="url(#acHomeCore)" stroke="#FFB940" stroke-width="0.8" stroke-opacity="0.5" />
  <path d="M18 10.2L24.2 24.4H20.9L19.6 21.2H16.4L15.1 24.4H11.8L18 10.2ZM18 14.8L16.9 18.2H19.1L18 14.8Z" fill="url(#acHomeGlyph)" />
</svg>`;

export default function AaaVisualPolishController() {
  useEffect(() => {
    const enhanceDomIcons = () => {
      if (document.body?.classList?.contains('battle-open')) return;
      const acMark = document.querySelector('#gold-shell-host #stage .profile .ac .acMark');
      if (acMark && acMark.dataset.aaaCoin !== '1') {
        acMark.dataset.aaaCoin = '1';
        acMark.innerHTML = HEX_COIN_SVG;
        acMark.style.background = 'transparent';
        acMark.style.boxShadow = 'none';
        acMark.style.clipPath = 'none';
      }
    };

    enhanceDomIcons();
    const observer = new MutationObserver(enhanceDomIcons);
    observer.observe(document.body, { childList: true, subtree: true });

    const onPointerDown = (e) => {
      const btn = e.target?.closest?.(
        '.ab-config-btn, .ab-seg-btn, .apex-skill-details-btn, .fa3-pick-equip-entry, #apex-utility-toggle'
      );
      if (!btn || btn.disabled) return;
      try {
        window.apexUiSfx?.play?.('ui.button.press');
      } catch {
        /* optional sfx */
      }
    };

    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => {
      observer.disconnect();
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  return null;
}
