import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cosmetics } from '../game/cosmetics/cosmeticAuthority.js';
import '../game/cosmetics/approvedGoldSkins.js';
import {
  CATEGORY_LABELS,
  MASTERY_BY_ID,
  MASTERY_CATEGORIES,
  MASTERY_HEROES,
  RARITY_LABELS,
  applicableAchievements,
  formatMasteryValue,
  masteryResultHeroId,
  masteryTier,
  primaryProgress,
} from './masteryCatalog.js';
import './progressionCenter.css';

// CP3 Mastery Vault — presentation over the ONE wallet/profile authority.
// Starter Contracts keep paying through progressionCatalog() +
// claimProgressReward(). Combat achievements, hero bests and lifetime
// weapon damage are read from APEX_ARSENAL_META.getMastery(); nothing in
// this panel can grant an achievement or a skin. ECOBOT/VUA HỀ equip goes
// through cosmeticAuthority, which fail-closes on wallet entitlement.

const COPY = {
  eng: {
    kicker: 'APEX CHAOS · GUEST ALPHA',
    title: 'MASTERY VAULT',
    close: 'Close',
    balance: 'CURRENT BALANCE',
    contracts: 'STARTER CONTRACTS',
    mastery: 'MASTERY VAULT',
    ready: (n) => `CLAIM +${n}`,
    incomplete: 'INCOMPLETE',
    claimed: 'CLAIMED',
    claimedMsg: 'REWARD CLAIMED',
    failedMsg: 'UNABLE TO CLAIM',
    loading: 'Preparing progression…',
    currentObjective: 'CURRENT OBJECTIVE',
    heroMastery: 'HERO MASTERY',
    weaponMastery: 'WEAPON MASTERY',
    totalMastery: 'TOTAL MASTERY',
    recentUnlocks: 'RECENT UNLOCKS',
    noRecent: 'No combat achievements yet. Finish a BOT or LOCAL match to start the record.',
    locked: 'LOCKED',
    inProgress: 'IN PROGRESS',
    unlocked: 'UNLOCKED',
    equipped: 'EQUIPPED',
    equipP1: 'EQUIP FOR P1',
    best: 'BEST',
    need: 'NEED',
    noRecord: 'NO RECORDED BEST YET',
    newBadge: 'NEW',
    remaining: (n) => `${n} ACHIEVEMENTS REMAINING`,
    complete: 'PATH COMPLETE',
    heroSkinCondition: 'Earn every NEWBOT-applicable combat achievement while playing NEWBOT.',
    heroSkinLocked: (earned, total) => `${earned}/${total} — ECOBOT stays locked until the path is complete.`,
    noHeroSkin: 'No exclusive skin is registered for this fighter yet. Every real achievement is still recorded here.',
    lifetimeRpg: 'LIFETIME RPG-7 DAMAGE',
    rpgCondition: 'VUA HỀ unlocks at more than 1,000 lifetime RPG-7 damage from sealed BOT/LOCAL results.',
    rpgProgress: (n) => `${formatMasteryValue(n)} / >1,000 DMG`,
    topWeapons: 'TOP WEAPON RECORDS',
    noWeaponDamage: 'No sealed weapon damage recorded yet.',
    skinEquipped: 'SKIN EQUIPPED FOR P1',
    skinLocked: 'SKIN LOCKED — MASTERY NOT COMPLETE',
    note: 'Only completed BOT/LOCAL matches with a sealed result count. Starter Contracts are the only AC rewards here; combat achievements never pay AC. ECOBOT and VUA HỀ are mastery entitlements: an old stored selection is preserved, but renders ORIGINAL until it is truly earned.',
  },
  vie: {
    kicker: 'APEX CHAOS · BẢN ALPHA KHÁCH',
    title: 'KHO TINH THÔNG',
    close: 'Đóng',
    balance: 'SỐ DƯ HIỆN TẠI',
    contracts: 'HỢP ĐỒNG KHỞI ĐẦU',
    mastery: 'KHO TINH THÔNG',
    ready: (n) => `NHẬN +${n}`,
    incomplete: 'CHƯA ĐẠT',
    claimed: 'ĐÃ NHẬN',
    claimedMsg: 'ĐÃ NHẬN THƯỞNG',
    failedMsg: 'CHƯA THỂ NHẬN',
    loading: 'Đang tải tiến độ…',
    currentObjective: 'MỤC TIÊU HIỆN TẠI',
    heroMastery: 'TINH THÔNG TƯỚNG',
    weaponMastery: 'TINH THÔNG VŨ KHÍ',
    totalMastery: 'TỔNG TINH THÔNG',
    recentUnlocks: 'MỞ KHÓA GẦN ĐÂY',
    noRecent: 'Chưa có thành tựu chiến đấu. Hoàn thành một trận BOT hoặc LOCAL để bắt đầu hồ sơ.',
    locked: 'ĐANG KHÓA',
    inProgress: 'ĐANG TIẾN TRIỂN',
    unlocked: 'ĐÃ MỞ',
    equipped: 'ĐANG TRANG BỊ',
    equipP1: 'TRANG BỊ CHO P1',
    best: 'TỐT NHẤT',
    need: 'CẦN',
    noRecord: 'CHƯA CÓ KỶ LỤC',
    newBadge: 'MỚI',
    remaining: (n) => `CÒN ${n} THÀNH TỰU`,
    complete: 'ĐÃ HOÀN THÀNH',
    heroSkinCondition: 'Đạt mọi thành tựu áp dụng cho NEWBOT khi chơi NEWBOT.',
    heroSkinLocked: (earned, total) => `${earned}/${total} — ECOBOT vẫn khóa đến khi hoàn thành toàn bộ lộ trình.`,
    noHeroSkin: 'Tướng này chưa có skin độc quyền nào được đăng ký. Mọi thành tựu thật vẫn được ghi tại đây.',
    lifetimeRpg: 'SÁT THƯƠNG RPG-7 TRỌN ĐỜI',
    rpgCondition: 'VUA HỀ mở khi tổng sát thương RPG-7 từ kết quả BOT/LOCAL đã chốt lớn hơn 1.000.',
    rpgProgress: (n) => `${formatMasteryValue(n)} / >1.000 DMG`,
    topWeapons: 'KỶ LỤC VŨ KHÍ HÀNG ĐẦU',
    noWeaponDamage: 'Chưa ghi nhận sát thương vũ khí từ trận đã chốt.',
    skinEquipped: 'ĐÃ TRANG BỊ SKIN CHO P1',
    skinLocked: 'SKIN ĐANG KHÓA — CHƯA ĐỦ TINH THÔNG',
    note: 'Chỉ trận BOT/LOCAL đã hoàn thành và có kết quả hợp lệ mới được tính. Hợp đồng khởi đầu là phần thưởng AC duy nhất tại đây; thành tựu chiến đấu không trả AC. ECOBOT và VUA HỀ là quyền mở khóa bằng tinh thông: lựa chọn cũ vẫn được giữ nhưng sẽ hiển thị ORIGINAL cho đến khi đạt thật.',
  },
};

function currentMeta() {
  return typeof window !== 'undefined' ? window.APEX_ARSENAL_META : null;
}

function readMeta() {
  const meta = currentMeta();
  if (!meta) return { meta: null, catalog: [], state: null, mastery: null };
  const state = typeof meta.getState === 'function' ? meta.getState() : null;
  return {
    meta,
    catalog: typeof meta.progressionCatalog === 'function' ? meta.progressionCatalog() : [],
    state,
    mastery: typeof meta.getMastery === 'function' ? meta.getMastery() : (state?.mastery || null),
  };
}

function heroOptions(meta) {
  let roster = [];
  try { roster = typeof meta?.playableRoster === 'function' ? meta.playableRoster() : []; } catch { roster = []; }
  if (!Array.isArray(roster) || !roster.length) return MASTERY_HEROES;
  const options = roster
    .map((engineId) => MASTERY_HEROES.find((hero) => hero.engineId === String(engineId).toUpperCase()))
    .filter(Boolean);
  return options.length ? options : MASTERY_HEROES;
}

function heroProgress(meta, mastery, resultHeroId) {
  try {
    if (typeof meta?.heroMasteryProgress === 'function') return meta.heroMasteryProgress(resultHeroId);
  } catch { /* fall through to the display catalog */ }
  const applicable = applicableAchievements(resultHeroId);
  const earned = mastery?.earned?.[resultHeroId] || {};
  const earnedIds = applicable.filter((item) => Object.prototype.hasOwnProperty.call(earned, item.id)).map((item) => item.id);
  const missingIds = applicable.filter((item) => !Object.prototype.hasOwnProperty.call(earned, item.id)).map((item) => item.id);
  return {
    heroId: resultHeroId,
    earned: earnedIds.length,
    total: applicable.length,
    earnedIds,
    missingIds,
    complete: applicable.length > 0 && missingIds.length === 0,
  };
}

function skinVariant(kind, baseId, skinId) {
  try { return cosmetics.variants(kind, baseId).find((item) => item.id === skinId) || null; }
  catch { return null; }
}

function selectedSkinId(kind, baseId) {
  try { return cosmetics.selected('p1', kind, baseId)?.id || 'default'; }
  catch { return 'default'; }
}

function dateLabel(at, language) {
  const value = Number(at);
  if (!Number.isFinite(value) || value <= 0) return '';
  try {
    return new Date(value).toLocaleDateString(language === 'vie' ? 'vi-VN' : 'en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return ''; }
}

function progressText(achievement, progress, t) {
  if (progress.compare === 'event') return `${t.best} ${formatMasteryValue(progress.current)} / 1`;
  if (progress.current == null) {
    return `${t.need} ${progress.compare === 'lte' ? '≤' : '≥'} ${formatMasteryValue(progress.target)}${progress.unit ? ` ${progress.unit}` : ''}`;
  }
  if (progress.compare === 'lte') {
    return `${t.best} ${formatMasteryValue(progress.current)} · ${t.need} ≤ ${formatMasteryValue(progress.target)}${progress.unit ? ` ${progress.unit}` : ''}`;
  }
  return `${t.best} ${formatMasteryValue(progress.current)} / ${formatMasteryValue(progress.target)}${progress.unit ? ` ${progress.unit}` : ''}`;
}

function MedalCard({ achievement, earnedAt, best, recent, language, t }) {
  const earned = earnedAt !== undefined;
  const progress = primaryProgress(achievement, best, earned);
  const status = earned ? 'unlocked' : (best != null ? 'progress' : 'locked');
  const statusLabel = earned ? t.unlocked : (best != null ? t.inProgress : t.locked);
  const unlockedDate = dateLabel(earnedAt, language);
  return (
    <article className={`apex-mastery-medal rarity-${achievement.rarity} is-${status}`} title={achievement.rule[language]}>
      <div className="apex-mastery-medal-disc" aria-hidden="true">
        <span>{achievement.iconGlyph}</span>
        {recent && <b>{t.newBadge}</b>}
      </div>
      <div className="apex-mastery-medal-copy">
        <div className="apex-mastery-medal-top">
          <span>{RARITY_LABELS[achievement.rarity]?.[language] || achievement.rarity}</span>
          <span>{statusLabel}</span>
        </div>
        <h4>{achievement.name}</h4>
        <p>{achievement.rule[language]}</p>
        <div className="apex-progress-meter" aria-hidden="true">
          <span style={{ width: `${earned ? 100 : progress.percent}%` }} />
        </div>
        <small>
          {earned
            ? `${t.unlocked}${unlockedDate ? ` · ${unlockedDate}` : ''}`
            : (best == null ? t.noRecord : progressText(achievement, progress, t))}
        </small>
      </div>
    </article>
  );
}

export default function ProgressionCenter() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('mission');
  const [, setTick] = useState(0);
  const [message, setMessage] = useState('');
  const [selectedResultHero, setSelectedResultHero] = useState('NEWBOT');
  const [language, setLanguage] = useState(
    () => (typeof window !== 'undefined' && window.APEX_I18N?.getLanguage?.()) || 'eng');
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const invokerRef = useRef(null);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const openPanel = useCallback((nextTab, invoker) => {
    invokerRef.current = invoker || document.activeElement || null;
    setLanguage(window.APEX_I18N?.getLanguage?.() || 'eng');
    setTab(nextTab === 'achievement' ? 'achievement' : 'mission');
    setMessage('');
    setOpen(true);
    refresh();
  }, [refresh]);

  const closePanel = useCallback(() => {
    setOpen(false);
    const invoker = invokerRef.current;
    if (invoker && invoker.isConnected && typeof invoker.focus === 'function') {
      invoker.focus({ preventScroll: true });
    }
    invokerRef.current = null;
  }, []);

  useEffect(() => {
    window.APEX_PROGRESSION_CENTER = Object.freeze({
      open: (nextTab) => openPanel(nextTab, null),
      close: closePanel,
      isOpen: () => open,
    });
    return () => { delete window.APEX_PROGRESSION_CENTER; };
  }, [openPanel, closePanel, open]);

  useEffect(() => {
    const onNav = (event) => {
      const btn = event.target?.closest?.('#apexMissionsOpen');
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      openPanel('mission', btn);
    };
    const onOpenEvent = (event) => openPanel(event?.detail?.tab, null);
    const onCredits = () => refresh();
    const onLanguage = () => setLanguage(window.APEX_I18N?.getLanguage?.() || 'eng');
    const stopCosmetics = cosmetics.subscribe(refresh);
    document.addEventListener('click', onNav, true);
    window.addEventListener('apex:progress-open', onOpenEvent);
    window.addEventListener('apex:credits', onCredits);
    window.addEventListener('apex:mastery-unlocked', onCredits);
    window.addEventListener('apex:skin-unlocked', onCredits);
    window.addEventListener('apex:language-changed', onLanguage);
    return () => {
      document.removeEventListener('click', onNav, true);
      window.removeEventListener('apex:progress-open', onOpenEvent);
      window.removeEventListener('apex:credits', onCredits);
      window.removeEventListener('apex:mastery-unlocked', onCredits);
      window.removeEventListener('apex:skin-unlocked', onCredits);
      window.removeEventListener('apex:language-changed', onLanguage);
      stopCosmetics();
    };
  }, [openPanel, refresh]);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closePanel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, closePanel]);

  if (!open) return null;

  const lang = language === 'vie' ? 'vie' : 'eng';
  const t = COPY[lang];
  const { meta, catalog, state, mastery } = readMeta();
  const safeMastery = mastery || { earned: {}, best: {}, weaponDamage: {}, recent: [], unseenSkinUnlocks: [] };
  const progress = (state && state.progression) || {};
  const claimedIds = progress.claimedIds || [];
  const currentContractId = catalog.find((item) => !claimedIds.includes(item.id))?.id || null;

  const claim = (id) => {
    const current = currentMeta();
    const result = current && typeof current.claimProgressReward === 'function'
      ? current.claimProgressReward(id) : null;
    setMessage(result && result.ok ? t.claimedMsg : `${t.failedMsg}: ${(result && result.reason) || 'unavailable'}`);
    refresh();
  };

  const equipSkin = (kind, baseId, skinId, gateKey) => {
    const result = cosmetics.equip('p1', kind, baseId, skinId);
    if (result?.ok) {
      try { currentMeta()?.markSkinUnlockSeen?.(gateKey); } catch { /* celebration state is presentation-only */ }
      setMessage(t.skinEquipped);
    } else {
      setMessage(result?.reason === 'SKIN_LOCKED' ? t.skinLocked : `${t.failedMsg}: ${result?.reason || 'unavailable'}`);
    }
    refresh();
  };

  const heroes = heroOptions(meta);
  const selectedHero = heroes.find((hero) => hero.resultId === selectedResultHero) || heroes[0] || MASTERY_HEROES[0];
  const selectedProgress = heroProgress(meta, safeMastery, selectedHero.resultId);
  const allProgress = heroes.map((hero) => heroProgress(meta, safeMastery, hero.resultId));
  const totalEarned = allProgress.reduce((sum, item) => sum + item.earned, 0);
  const totalAvailable = allProgress.reduce((sum, item) => sum + item.total, 0);
  const totalPercent = totalAvailable ? (totalEarned / totalAvailable) * 100 : 0;
  const selectedPercent = selectedProgress.total ? (selectedProgress.earned / selectedProgress.total) * 100 : 0;
  const tier = masteryTier(selectedProgress.earned, selectedProgress.total);
  const achievements = applicableAchievements(selectedHero.resultId);
  const earnedMap = safeMastery.earned?.[selectedHero.resultId] || {};
  const bestMap = safeMastery.best?.[selectedHero.resultId] || {};
  const recentItems = Array.isArray(safeMastery.recent) ? safeMastery.recent.slice(0, 8) : [];
  const recentKeys = new Set(recentItems.map((item) => `${item.heroId}:${item.achievementId}`));

  let ecoProgress = null;
  try { ecoProgress = typeof meta?.skinProgress === 'function' ? meta.skinProgress('hero', 'ROBOT', 'ecobot') : null; } catch { ecoProgress = null; }
  if (!ecoProgress) {
    const robotProgress = heroProgress(meta, safeMastery, 'NEWBOT');
    ecoProgress = {
      gated: true,
      entitled: robotProgress.complete,
      key: 'hero:ROBOT:ecobot',
      current: robotProgress.earned,
      target: robotProgress.total,
      remainingIds: robotProgress.missingIds,
    };
  }
  const ecoSkin = skinVariant('hero', 'ROBOT', 'ecobot');
  const ecoEquipped = selectedSkinId('hero', 'ROBOT') === 'ecobot';

  let rpgProgress = null;
  try { rpgProgress = typeof meta?.skinProgress === 'function' ? meta.skinProgress('weapon', 'RPG_7', 'vua-he') : null; } catch { rpgProgress = null; }
  if (!rpgProgress) {
    const current = Number(safeMastery.weaponDamage?.RPG_7) || 0;
    rpgProgress = { gated: true, entitled: current > 1000, key: 'weapon:RPG_7:vua-he', current, target: 1000 };
  }
  const rocketSkin = skinVariant('weapon', 'RPG_7', 'vua-he');
  const rocketEquipped = selectedSkinId('weapon', 'RPG_7') === 'vua-he';
  const rpgPercent = Math.min(100, ((Number(rpgProgress.current) || 0) / 1001) * 100);
  const topWeapons = Object.entries(safeMastery.weaponDamage || {})
    .filter(([, value]) => Number(value) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 5);

  const renderSkinButton = ({ kind, baseId, skinId, gateKey, entitled, equipped }) => (
    <button
      type="button"
      className="apex-mastery-equip"
      disabled={!entitled || equipped}
      onClick={() => equipSkin(kind, baseId, skinId, gateKey)}
    >
      {equipped ? t.equipped : (entitled ? t.equipP1 : t.locked)}
    </button>
  );

  return (
    <div
      className="apex-progress-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      onPointerDown={(e) => { if (e.target === e.currentTarget) closePanel(); }}
    >
      <section className="apex-progress-panel" ref={panelRef} data-apex-no-localize="">
        <header className="apex-progress-head">
          <div>
            <div className="apex-progress-kicker">{t.kicker}</div>
            <h2 className="apex-progress-title">{t.title}</h2>
          </div>
          <button
            type="button"
            ref={closeRef}
            className="apex-progress-close"
            onClick={closePanel}
            aria-label={t.close}
          >
            ✕
          </button>
        </header>
        <div className="apex-progress-body">
          <div className="apex-progress-balance">
            <span>{t.balance}</span>
            <strong>{state && Number.isFinite(state.credits) ? state.credits : 0} AC</strong>
          </div>
          <div className="apex-progress-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'mission'}
              className={tab === 'mission' ? 'is-active' : ''}
              onClick={() => setTab('mission')}
            >
              {t.contracts}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'achievement'}
              className={tab === 'achievement' ? 'is-active' : ''}
              onClick={() => setTab('achievement')}
            >
              {t.mastery}
            </button>
          </div>

          {tab === 'mission' ? (
            <div className="apex-progress-list" role="tabpanel">
              {catalog.length === 0 ? (
                <p className="apex-progress-note">{t.loading}</p>
              ) : catalog.map((d) => {
                const done = claimedIds.includes(d.id);
                const count = Math.min(Math.max(0, Number(progress[d.stat]) || 0), d.target);
                const eligible = count >= d.target && !done;
                const current = d.id === currentContractId;
                return (
                  <article className={`apex-progress-row${done ? ' is-claimed' : ''}${current ? ' is-current' : ''}`} key={d.id}>
                    <div className="apex-progress-row-info">
                      <h3>{language === 'vie' ? d.vie : d.eng}</h3>
                      <p>{count} / {d.target} · +{d.ac} AC{current ? ` · ${t.currentObjective}` : ''}</p>
                      <div className="apex-progress-meter"><span style={{ width: `${(count / d.target) * 100}%` }} /></div>
                    </div>
                    <button
                      type="button"
                      className="apex-progress-claim"
                      disabled={!eligible}
                      onClick={() => claim(d.id)}
                    >
                      {done ? t.claimed : eligible ? t.ready(d.ac) : t.incomplete}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="apex-mastery-vault" role="tabpanel">
              <div className="apex-mastery-total">
                <div>
                  <span>{t.totalMastery}</span>
                  <strong>{totalEarned}/{totalAvailable}</strong>
                </div>
                <div className="apex-progress-meter" aria-hidden="true"><span style={{ width: `${totalPercent}%` }} /></div>
              </div>

              <section className="apex-mastery-recent" aria-labelledby="apex-mastery-recent-title">
                <h3 id="apex-mastery-recent-title">{t.recentUnlocks}</h3>
                {recentItems.length ? (
                  <div className="apex-mastery-recent-row">
                    {recentItems.map((item) => {
                      const achievement = MASTERY_BY_ID[item.achievementId];
                      if (!achievement) return null;
                      const hero = MASTERY_HEROES.find((entry) => entry.resultId === masteryResultHeroId(item.heroId));
                      return (
                        <span className="apex-mastery-recent-chip" key={`${item.heroId}-${item.achievementId}-${item.at}`}>
                          <i aria-hidden="true">{achievement.iconGlyph}</i>
                          <span><b>{achievement.name}</b><small>{hero?.name || item.heroId}{dateLabel(item.at, lang) ? ` · ${dateLabel(item.at, lang)}` : ''}</small></span>
                        </span>
                      );
                    })}
                  </div>
                ) : <p>{t.noRecent}</p>}
              </section>

              <div className="apex-mastery-hero-rail" aria-label={t.heroMastery}>
                {heroes.map((hero) => {
                  const itemProgress = heroProgress(meta, safeMastery, hero.resultId);
                  const owned = typeof meta?.owns === 'function' ? meta.owns(hero.engineId) : true;
                  return (
                    <button
                      type="button"
                      key={hero.resultId}
                      className={hero.resultId === selectedHero.resultId ? 'is-active' : ''}
                      aria-pressed={hero.resultId === selectedHero.resultId}
                      onClick={() => setSelectedResultHero(hero.resultId)}
                    >
                      <b>{hero.name}</b>
                      <span>{itemProgress.earned}/{itemProgress.total}</span>
                      {!owned && <small>{t.locked}</small>}
                    </button>
                  );
                })}
              </div>

              <section className="apex-mastery-summary">
                <div
                  className={`apex-mastery-ring tier-${tier.id}`}
                  style={{ '--mastery-deg': `${selectedPercent * 3.6}deg` }}
                  aria-label={`${selectedHero.name}: ${selectedProgress.earned}/${selectedProgress.total}`}
                >
                  <strong>{selectedProgress.earned}/{selectedProgress.total}</strong>
                  <span>{selectedHero.name}</span>
                </div>
                <div>
                  <p className="apex-mastery-section-kicker">{t.heroMastery}</p>
                  <h3>{selectedHero.name} · {tier[lang]}</h3>
                  <p>{selectedProgress.complete ? t.complete : t.remaining(selectedProgress.missingIds.length)}</p>
                </div>
              </section>

              <div className="apex-mastery-path">
                {MASTERY_CATEGORIES.map((category, chapterIndex) => {
                  const chapter = achievements.filter((item) => item.category === category);
                  if (!chapter.length) return null;
                  const chapterEarned = chapter.filter((item) => Object.prototype.hasOwnProperty.call(earnedMap, item.id)).length;
                  return (
                    <section className="apex-mastery-chapter" key={category}>
                      <header>
                        <span>{String(chapterIndex + 1).padStart(2, '0')}</span>
                        <div>
                          <h3>{CATEGORY_LABELS[category][lang]}</h3>
                          <small>{chapterEarned}/{chapter.length}</small>
                        </div>
                      </header>
                      <div className="apex-mastery-medals">
                        {chapter.map((achievement) => (
                          <MedalCard
                            key={achievement.id}
                            achievement={achievement}
                            earnedAt={earnedMap[achievement.id]}
                            best={bestMap[achievement.id]}
                            recent={recentKeys.has(`${selectedHero.resultId}:${achievement.id}`)}
                            language={lang}
                            t={t}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}

                <section className="apex-mastery-terminal">
                  {selectedHero.resultId === 'NEWBOT' ? (
                    <>
                      <div className="apex-mastery-terminal-mark" aria-hidden="true">♻</div>
                      <p className="apex-mastery-section-kicker">{t.heroMastery}</p>
                      <h3>{ecoSkin?.label || 'ECOBOT — RECYCLE CORE V17'}</h3>
                      <p>{t.heroSkinCondition}</p>
                      <strong>{ecoProgress.current}/{ecoProgress.target}</strong>
                      <div className="apex-progress-meter" aria-hidden="true">
                        <span style={{ width: `${ecoProgress.target ? (ecoProgress.current / ecoProgress.target) * 100 : 0}%` }} />
                      </div>
                      {!ecoProgress.entitled && <p>{t.heroSkinLocked(ecoProgress.current, ecoProgress.target)}</p>}
                      {ecoProgress.remainingIds?.length > 0 && (
                        <details className="apex-mastery-remaining">
                          <summary>{t.remaining(ecoProgress.remainingIds.length)}</summary>
                          <ul>
                            {ecoProgress.remainingIds.map((id) => <li key={id}>{MASTERY_BY_ID[id]?.name || id}</li>)}
                          </ul>
                        </details>
                      )}
                      {renderSkinButton({
                        kind: 'hero', baseId: 'ROBOT', skinId: 'ecobot', gateKey: ecoProgress.key,
                        entitled: ecoProgress.entitled, equipped: ecoEquipped,
                      })}
                    </>
                  ) : (
                    <>
                      <div className="apex-mastery-terminal-mark" aria-hidden="true">★</div>
                      <p className="apex-mastery-section-kicker">{t.heroMastery}</p>
                      <h3>{selectedHero.name}</h3>
                      <p>{t.noHeroSkin}</p>
                      <strong>{selectedProgress.earned}/{selectedProgress.total}</strong>
                      <div className="apex-progress-meter" aria-hidden="true"><span style={{ width: `${selectedPercent}%` }} /></div>
                      <p>{selectedProgress.complete ? t.complete : t.remaining(selectedProgress.missingIds.length)}</p>
                    </>
                  )}
                </section>
              </div>

              <section className="apex-mastery-weapon">
                <div className="apex-mastery-weapon-head">
                  <div>
                    <p className="apex-mastery-section-kicker">{t.weaponMastery}</p>
                    <h3>{rocketSkin?.label || 'VUA HỀ — THE LAST LAUGH'}</h3>
                    <p>{t.rpgCondition}</p>
                  </div>
                  {rocketSkin?.preview && <img src={rocketSkin.preview} alt="" />}
                </div>
                <div className="apex-mastery-rpg-track">
                  <div className="apex-mastery-rpg-score">
                    <span>{t.lifetimeRpg}</span>
                    <strong>{t.rpgProgress(rpgProgress.current)}</strong>
                  </div>
                  <div className="apex-progress-meter" aria-hidden="true"><span style={{ width: `${rpgPercent}%` }} /></div>
                  {renderSkinButton({
                    kind: 'weapon', baseId: 'RPG_7', skinId: 'vua-he', gateKey: rpgProgress.key,
                    entitled: rpgProgress.entitled, equipped: rocketEquipped,
                  })}
                </div>
                <h4>{t.topWeapons}</h4>
                {topWeapons.length ? (
                  <div className="apex-mastery-weapon-records">
                    {topWeapons.map(([weaponId, value]) => (
                      <span key={weaponId}><b>{weaponId.replaceAll('_', ' ')}</b><small>{formatMasteryValue(value)} DMG</small></span>
                    ))}
                  </div>
                ) : <p>{t.noWeaponDamage}</p>}
              </section>
            </div>
          )}

          <p className="apex-progress-note">{t.note}</p>
          <div className="apex-progress-feedback" role="status" aria-live="polite">{message}</div>
        </div>
      </section>
    </div>
  );
}
