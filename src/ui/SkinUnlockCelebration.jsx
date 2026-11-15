import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cosmetics } from '../game/cosmetics/cosmeticAuthority.js';
import '../game/cosmetics/approvedGoldSkins.js';
import { formatMasteryValue } from './masteryCatalog.js';
import './skinUnlockCelebration.css';

// CP3 skin unlock celebration. The wallet records a transition into the
// ECOBOT/VUA HỀ entitlement and stores it in unseenSkinUnlocks. This card
// waits until the battle scene is gone, then offers the real cosmetic
// authority equip action. It cannot grant a skin by itself.

const SKINS = Object.freeze({
  'hero:ROBOT:ecobot': Object.freeze({
    key: 'hero:ROBOT:ecobot',
    kind: 'hero',
    baseId: 'ROBOT',
    skinId: 'ecobot',
    mark: '♻',
    fallbackLabel: 'ECOBOT — RECYCLE CORE V17',
    condition: Object.freeze({
      eng: 'All NEWBOT mastery achievements complete.',
      vie: 'Đã hoàn thành toàn bộ thành tựu tinh thông của NEWBOT.',
    }),
  }),
  'weapon:RPG_7:vua-he': Object.freeze({
    key: 'weapon:RPG_7:vua-he',
    kind: 'weapon',
    baseId: 'RPG_7',
    skinId: 'vua-he',
    mark: '✦',
    fallbackLabel: 'VUA HỀ — THE LAST LAUGH',
    condition: Object.freeze({
      eng: 'Lifetime RPG-7 damage is now greater than 1,000.',
      vie: 'Tổng sát thương RPG-7 trọn đời đã lớn hơn 1.000.',
    }),
  }),
});

const COPY = {
  eng: {
    kicker: 'MASTERY SKIN UNLOCKED',
    equip: 'EQUIP FOR P1',
    later: 'LATER',
    equipped: 'EQUIPPED',
    failed: 'UNABLE TO EQUIP',
    more: (n) => `${n} SKIN UNLOCK${n === 1 ? '' : 'S'} WAITING`,
    progress: (text) => text,
  },
  vie: {
    kicker: 'ĐÃ MỞ SKIN TINH THÔNG',
    equip: 'TRANG BỊ CHO P1',
    later: 'ĐỂ SAU',
    equipped: 'ĐÃ TRANG BỊ',
    failed: 'CHƯA THỂ TRANG BỊ',
    more: (n) => `${n} SKIN ĐANG CHỜ`,
    progress: (text) => text,
  },
};

function currentLanguage() {
  try { return window.APEX_I18N?.getLanguage?.() === 'vie' ? 'vie' : 'eng'; }
  catch { return 'eng'; }
}

function battleVisible() {
  try {
    // Battle HUD mounts outside the Gold shell stage and hides that stage;
    // body/host/live-state are the reliable combat-visible signals. Without
    // them a live-recorded ECOBOT unlock could celebrate mid-match.
    if (document.body?.classList?.contains('battle-hud-open')) return true;
    if (document.querySelector('#battleHudHost.is-open')) return true;
    if (window.APEX_ARSENAL?.state?.active) return true;
    return [...document.querySelectorAll('#stage')].some((el) => el.classList.contains('screen-battle'));
  } catch { return false; }
}

function metaAuthority() {
  return typeof window !== 'undefined' ? window.APEX_ARSENAL_META : null;
}

function readPending() {
  const meta = metaAuthority();
  const mastery = meta?.getMastery?.();
  const unseen = Array.isArray(mastery?.unseenSkinUnlocks) ? mastery.unseenSkinUnlocks : [];
  return unseen.filter((key) => {
    const skin = SKINS[key];
    if (!skin) return false;
    try {
      return typeof meta?.skinEntitlement !== 'function'
        || meta.skinEntitlement(skin.kind, skin.baseId, skin.skinId) === true;
    } catch { return false; }
  });
}

function progressLabel(skin) {
  const meta = metaAuthority();
  try {
    const progress = meta?.skinProgress?.(skin.kind, skin.baseId, skin.skinId);
    if (!progress) return '';
    if (skin.kind === 'hero') return `${formatMasteryValue(progress.current)}/${formatMasteryValue(progress.target)}`;
    return `${formatMasteryValue(progress.current)} DMG`;
  } catch { return ''; }
}

export default function SkinUnlockCelebration() {
  const [pending, setPending] = useState([]);
  const [inBattle, setInBattle] = useState(battleVisible);
  const [language, setLanguage] = useState(currentLanguage);
  const [message, setMessage] = useState('');
  const soundedRef = useRef(new Set());

  const sync = useCallback(() => {
    setInBattle(battleVisible());
    const next = readPending();
    setPending((previous) => (previous.join('|') === next.join('|') ? previous : next));
  }, []);

  useEffect(() => {
    const onSkin = (event) => {
      const key = event?.detail?.skin?.key;
      if (SKINS[key]) {
        setPending((previous) => (previous.includes(key) ? previous : [...previous, key]));
      }
      sync();
    };
    const onLanguage = () => setLanguage(currentLanguage());
    sync();
    const poll = window.setInterval(sync, 700);
    const observer = typeof MutationObserver !== 'undefined'
      ? new MutationObserver(sync)
      : null;
    observer?.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('apex:skin-unlocked', onSkin);
    window.addEventListener('apex:mastery-unlocked', sync);
    window.addEventListener('apex:language-changed', onLanguage);
    return () => {
      window.clearInterval(poll);
      observer?.disconnect();
      window.removeEventListener('apex:skin-unlocked', onSkin);
      window.removeEventListener('apex:mastery-unlocked', sync);
      window.removeEventListener('apex:language-changed', onLanguage);
    };
  }, [sync]);

  const currentKey = pending[0] || null;
  const skin = currentKey ? SKINS[currentKey] : null;
  const visible = !!skin && !inBattle;

  useEffect(() => {
    if (!visible || !currentKey || soundedRef.current.has(currentKey)) return;
    soundedRef.current.add(currentKey);
    try { window.apexUiSfx?.play?.('skin.unlock'); } catch { /* sound is optional */ }
  }, [visible, currentKey]);

  if (!visible) return null;

  const lang = language === 'vie' ? 'vie' : 'eng';
  const t = COPY[lang];
  const variant = cosmetics.variants(skin.kind, skin.baseId).find((item) => item.id === skin.skinId);
  const equipped = cosmetics.selected('p1', skin.kind, skin.baseId)?.id === skin.skinId;
  const progress = progressLabel(skin);

  const finish = () => {
    try { metaAuthority()?.markSkinUnlockSeen?.(skin.key); } catch { /* wallet remains source of truth */ }
    setPending((previous) => previous.filter((key) => key !== skin.key));
    setMessage('');
  };

  const equip = () => {
    const result = cosmetics.equip('p1', skin.kind, skin.baseId, skin.skinId);
    if (result?.ok) {
      try { window.apexUiSfx?.play?.('skin.equip'); } catch { /* sound is optional */ }
      finish();
      return;
    }
    try { window.apexUiSfx?.play?.(result?.reason === 'SKIN_LOCKED' ? 'ui.locked' : 'ui.error'); } catch { /* sound is optional */ }
    setMessage(`${t.failed}: ${result?.reason || 'unavailable'}`);
  };

  return (
    <div className="apex-skin-unlock-dock" data-apex-no-localize="">
      <section className="apex-skin-unlock-card" role="dialog" aria-modal="false" aria-labelledby="apex-skin-unlock-title">
        <div className="apex-skin-unlock-visual" aria-hidden="true">
          {variant?.preview
            ? <img src={variant.preview} alt="" />
            : <span>{skin.mark}</span>}
        </div>
        <div className="apex-skin-unlock-copy">
          <p>{t.kicker}{progress ? ` · ${progress}` : ''}{pending.length > 1 ? ` · ${t.more(pending.length)}` : ''}</p>
          <h2 id="apex-skin-unlock-title">{variant?.label || skin.fallbackLabel}</h2>
          <span>{skin.condition[lang]}</span>
          {message && <small role="alert">{message}</small>}
        </div>
        <div className="apex-skin-unlock-actions">
          <button type="button" className="is-ghost" onClick={finish}>{t.later}</button>
          <button type="button" className="is-primary" onClick={equip} disabled={equipped}>
            {equipped ? t.equipped : t.equip}
          </button>
        </div>
      </section>
    </div>
  );
}
