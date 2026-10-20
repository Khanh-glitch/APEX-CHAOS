import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  isCloudConfigured,
  isGoogleSignInEnabled,
  isEmailCodeEnabled,
  signInWithGoogle,
  signInWithEmailOtp,
  verifyEmailOtp,
  signOutCloud,
  requestAccountDeletion,
  previewCloudProgressSnapshot,
  uploadProgressSnapshot,
  importGuestProgress,
} from '../game/cloudAccount.js';
import './accountCenter.css';

// A1.3 — Gold Account Center (presentation only).
// Every value is read live from the real authorities:
//   identity/session → window.APEX_PLAYER_ACCOUNT
//   credits/owned    → window.APEX_ARSENAL_META (the one wallet)
//   roster           → window.APEX_PRODUCT_SURFACE
//   cloud actions    → src/game/cloudAccount.js (env-gated, honest states)
// Nothing here is sample data, and nothing here mutates the wallet directly.

const SYNC_LABELS = {
  'local-only': 'LOCAL ONLY',
  'cloud-unconfigured': 'CLOUD NOT CONFIGURED',
  'signed-out': 'SIGNED OUT',
  connected: 'ACCOUNT CONNECTED',
  existing: 'CLOUD BACKUP EXISTS',
  previewed: 'BACKUP PREVIEW READY',
  syncing: 'SYNCING',
  saved: 'SAVED',
  offline: 'OFFLINE',
  conflict: 'CONFLICT',
  error: 'ERROR',
};

function readAuthorities() {
  const account = window.APEX_PLAYER_ACCOUNT || null;
  const meta = window.APEX_ARSENAL_META || null;
  const surface = window.APEX_PRODUCT_SURFACE || null;
  const admin = window.APEX_ADMIN_AUTHORITY || null;
  const profile = account && typeof account.profile === 'function' ? account.profile() : null;
  const sync = account && typeof account.syncStatus === 'function'
    ? account.syncStatus() : { status: 'local-only', lastSyncAt: null };
  const state = meta && typeof meta.getState === 'function' ? meta.getState() : null;
  const playable = surface && surface.roster ? [...surface.roster.playableIds] : [];
  const ownedIds = state ? state.ownedFighters.filter((id) => playable.includes(id)) : [];
  return {
    account, meta, admin, profile, sync, state, playable, ownedIds,
    credits: state ? state.credits : null,
    totalSpins: state ? state.totalSpins : 0,
    cloudConfigured: isCloudConfigured(),
    isAdmin: !!(admin && typeof admin.isAdmin === 'function' && admin.isAdmin()),
    adminSource: admin && typeof admin.adminSource === 'function' ? admin.adminSource() : null,
  };
}

// The Home chip must show the real identity, not the authored placeholder.
function stampHomeChip() {
  try {
    const { profile } = readAuthorities();
    if (!profile) return;
    const nameEl = document.querySelector('.profileIdentity .profileText b');
    const subEl = document.querySelector('.profileIdentity .profileText small');
    if (nameEl) nameEl.textContent = profile.displayName;
    if (subEl) subEl.textContent = profile.kind === 'cloud' ? 'PROFILE' : 'GUEST PROFILE';
  } catch (error) {}
}

export default function AccountCenter() {
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [confirmedEmail, setConfirmedEmail] = useState('');
  const [nextSendAt, setNextSendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [nameDraft, setNameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletionPending, setDeletionPending] = useState(false);
  const [cloudPreview, setCloudPreview] = useState(null);
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const invokerRef = useRef(null);

  const refresh = useCallback(() => { setTick((n) => n + 1); stampHomeChip(); }, []);

  const openCenter = useCallback((invoker) => {
    invokerRef.current = invoker || document.activeElement || null;
    setMessage('');
    setConfirmDelete(false);
    setCodeSent(false);
    setCode('');
    setConfirmedEmail('');
    setNow(Date.now());
    setCloudPreview(null);
    const { profile } = readAuthorities();
    setNameDraft(profile && profile.kind === 'guest' ? profile.displayName : '');
    setOpen(true);
    refresh();
  }, [refresh]);

  const closeCenter = useCallback(() => {
    setOpen(false);
    const invoker = invokerRef.current;
    if (invoker && invoker.isConnected && typeof invoker.focus === 'function') {
      invoker.focus({ preventScroll: true });
    }
    invokerRef.current = null;
  }, []);

  useEffect(() => {
    window.APEX_ACCOUNT_CENTER = Object.freeze({
      open: () => openCenter(null),
      close: closeCenter,
      isOpen: () => open,
    });
    return () => { delete window.APEX_ACCOUNT_CENTER; };
  }, [openCenter, closeCenter, open]);

  useEffect(() => {
    const onAccount = () => refresh();
    const onCredits = () => refresh();
    const onOpenEvent = () => openCenter(null);
    const onDocClick = (event) => {
      const target = event.target && event.target.closest
        ? event.target.closest('.profileIdentity, .profile .ac')
        : null;
      if (target) {
        event.preventDefault();
        event.stopPropagation();
        openCenter(target);
      }
    };
    window.addEventListener('apex:account', onAccount);
    window.addEventListener('apex:credits', onCredits);
    window.addEventListener('apex:open-account', onOpenEvent);
    document.addEventListener('click', onDocClick, true);
    const stamps = [600, 1800, 3500, 7000].map((ms) => window.setTimeout(stampHomeChip, ms));
    return () => {
      window.removeEventListener('apex:account', onAccount);
      window.removeEventListener('apex:credits', onCredits);
      window.removeEventListener('apex:open-account', onOpenEvent);
      document.removeEventListener('click', onDocClick, true);
      stamps.forEach((t) => window.clearTimeout(t));
    };
  }, [openCenter, refresh]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeCenter();
      }
    };
    window.addEventListener('keydown', onKey, true);
    if (closeRef.current) closeRef.current.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, closeCenter]);

  useEffect(() => {
    if (!open || nextSendAt <= Date.now()) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open, nextSendAt]);

  const run = async (fn) => {
    setBusy(true);
    setMessage('');
    try {
      const result = await fn();
      if (result && result.ok === false && result.reason) {
        const help = {
          'email-rate-limited': 'Đã đạt giới hạn gửi email. Đừng bấm lại liên tục; hãy thử sau.',
          'verify-rate-limited': 'Bạn đã thử mã quá nhiều lần. Hãy đợi trước khi thử lại.',
          'invalid-or-expired-code': 'Mã không đúng hoặc đã hết hạn. Kiểm tra email mới nhất.',
          'invalid-code': 'Nhập đủ 6 chữ số trong email.',
          'invalid-email': 'Địa chỉ email không hợp lệ.',
          'email-code-not-ready': 'Đăng nhập email chưa mở trên máy chủ thử nghiệm.',
          'email-send-failed': 'Chưa gửi được email. Thử lại sau.',
        };
        setMessage(help[result.reason] || String(result.reason).toUpperCase());
      }
      refresh();
      return result;
    } catch (error) {
      setMessage(String((error && error.message) || error).toUpperCase());
      return null;
    } finally {
      setBusy(false);
    }
  };

  const {
    account, meta, profile, sync, playable, ownedIds,
    credits, totalSpins, cloudConfigured, isAdmin, adminSource,
  } = readAuthorities();
  const isCloud = !!profile && profile.kind === 'cloud';
  const googleEnabled = cloudConfigured && isGoogleSignInEnabled();
  const emailCodeEnabled = cloudConfigured && isEmailCodeEnabled();
  const waitSeconds = Math.max(0, Math.ceil((nextSendAt - now) / 1000));
  const lockedIds = playable.filter((id) => !ownedIds.includes(id));
  const displayNameFor = (id) => (meta && typeof meta.displayNameFor === 'function' ? meta.displayNameFor(id) : id);
  const syncLabel = SYNC_LABELS[sync.status] || String(sync.status || '').toUpperCase();
  const lastSync = sync.lastSyncAt ? new Date(sync.lastSyncAt).toLocaleTimeString() : '—';

  if (!open) return null;

  return (
    <div
      className="apex-account-overlay is-open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apex-account-title"
      onClick={(e) => { if (e.target === e.currentTarget) closeCenter(); }}
    >
      <div className="apex-account-panel" ref={panelRef}>
        <header className="apex-account-head">
          <img
            className="apex-account-avatar"
            src={(profile && profile.avatarUrl) || '/gold/assets/gold/favicon-apex-chaos.png'}
            alt=""
            draggable="false"
          />
          <div>
            <div className="apex-account-kicker">
              ACCOUNT CENTER · {isCloud ? 'SIGNED IN' : 'LOCAL GUEST'}
            </div>
            <h2 className="apex-account-name" id="apex-account-title">
              {profile ? profile.displayName : 'Player'}
            </h2>
            <div className="apex-account-sub">
              PLAYER ID · {profile ? String(profile.profileId).slice(0, 18) : '—'}
              {isCloud && profile.email ? ` · ${profile.email}` : ''}
            </div>
          </div>
          <button
            type="button"
            className="apex-account-close"
            ref={closeRef}
            aria-label="CLOSE"
            onClick={closeCenter}
          >
            ✕
          </button>
        </header>

        <div className="apex-account-body">
          <div className="apex-account-stats">
            <div className="apex-account-stat">
              <span>{isCloud ? 'DEVICE CREDITS' : 'APEX CREDITS'}</span>
              <b data-account-credits>{credits == null ? '—' : `${credits} AC`}</b>
            </div>
            <div className="apex-account-stat">
              <span>{isCloud ? 'DEVICE FIGHTERS' : 'OWNED FIGHTERS'}</span>
              <b data-account-owned>{`${ownedIds.length} / ${playable.length}`}</b>
            </div>
            <div className="apex-account-stat">
              <span>{isCloud ? 'DEVICE DRAWS' : 'TOTAL DRAWS'}</span>
              <b>{totalSpins}</b>
            </div>
          </div>
          {isCloud && (
            <p className="apex-account-note">
              Credits, fighters and draws above come from THIS DEVICE.
              Cloud wallet and fighter inventory are not enabled yet.
            </p>
          )}

          <section className="apex-account-section" aria-label="OWNED FIGHTERS">
            <h3>OWNED FIGHTERS</h3>
            <div className="apex-account-fighters">
              {ownedIds.map((id) => (
                <span key={id} className="apex-account-fighter" data-owned-fighter={id}>
                  {displayNameFor(id)}
                </span>
              ))}
              {lockedIds.map((id) => (
                <span key={id} className="apex-account-fighter is-locked" data-locked-fighter={id}>
                  {`${displayNameFor(id)} · LOCKED`}
                </span>
              ))}
            </div>
          </section>

          {!isCloud && (
            <section className="apex-account-section" aria-label="DISPLAY NAME">
              <h3>DISPLAY NAME</h3>
              <div className="apex-account-row">
                <input
                  className="apex-account-input"
                  value={nameDraft}
                  maxLength={24}
                  onChange={(e) => setNameDraft(e.target.value)}
                  aria-label="DISPLAY NAME"
                />
                <button
                  type="button"
                  className="apex-account-btn"
                  disabled={busy || !account}
                  onClick={() => run(async () => {
                    account.setDisplayName(nameDraft);
                    return { ok: true };
                  })}
                >
                  SAVE NAME
                </button>
              </div>
            </section>
          )}

          <section className="apex-account-section" aria-label="SYNC STATUS">
            <h3>SYNC STATUS</h3>
            <p className="apex-account-sync" data-account-sync>
              {`${syncLabel} · ${lastSync}`}
            </p>
            {!cloudConfigured && (
              <p className="apex-account-note">Progress is saved on this device only.</p>
            )}
            {isCloud && sync.status === 'connected' && (
              <p className="apex-account-note">
                Account sign-in is verified. Your device progress is not confirmed
                uploaded; use UPLOAD SNAPSHOT to save an unverified backup.
              </p>
            )}
            {isCloud && (
              <div className="apex-account-actions" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="apex-account-btn is-primary"
                  disabled={busy}
                  onClick={() => run(() => importGuestProgress())}
                >
                  BACK UP GUEST PROGRESS
                </button>
                <button
                  type="button"
                  className="apex-account-btn"
                  disabled={busy}
                  onClick={() => run(async () => {
                    const result = await previewCloudProgressSnapshot();
                    setCloudPreview(result?.ok ? result : null);
                    return result;
                  })}
                >
                  REVIEW CLOUD BACKUP
                </button>
                {cloudPreview?.ok && cloudPreview.userId === profile?.profileId && (
                  <p className="apex-account-note" data-cloud-preview="true">
                    {cloudPreview.exists
                      ? `READ ONLY: cloud version ${cloudPreview.version}; unverified device backup:
${cloudPreview.deviceCredits ?? 'unknown'} credits, ${cloudPreview.deviceDraws ?? 'unknown'} draws,
fighters: ${cloudPreview.deviceFighters.join(', ') || 'none'}. Nothing was restored to this device.`
                      : 'No existing Cloud backup. Your device data has not been restored or modified.'}
                  </p>
                )}
                <button
                  type="button"
                  className="apex-account-btn"
                  disabled={busy || !cloudPreview?.ok || cloudPreview.userId !== profile?.profileId || sync.status !== 'previewed'}
                  onClick={() => run(async () => {
                    setCloudPreview(null);
                    return uploadProgressSnapshot();
                  })}
                >
                  UPDATE CLOUD SNAPSHOT (AFTER REVIEW)
                </button>
                <p className="apex-account-note">
                  REVIEW CLOUD BACKUP is read-only and does not restore
                  unverified credits/fighters to this device. Updating requires
                  a fresh preview and checks its exact Cloud version.
                  BACK UP GUEST PROGRESS never overwrites an existing backup.
                  None of these actions grants Cloud AC or fighters.
                </p>
              </div>
            )}
          </section>

          {!isCloud ? (
            <section className="apex-account-section" aria-label="SIGN IN">
              <h3>ĐĂNG NHẬP</h3>
              <div className="apex-account-actions">
                {googleEnabled && (
                  <button
                    type="button"
                    className="apex-account-btn is-primary"
                    disabled={busy}
                    onClick={() => run(() => signInWithGoogle())}
                  >
                    ĐĂNG NHẬP GOOGLE
                  </button>
                )}
                {!emailCodeEnabled && !googleEnabled && (
                  <p className="apex-account-note" role="status">
                    Đăng nhập email đang được nâng cấp sang mã 6 số.
                    Tạm thời bạn có thể tiếp tục chơi Guest.
                  </p>
                )}
                {emailCodeEnabled && !codeSent && (
                  <div className="apex-account-row">
                    <input
                      className="apex-account-input"
                      type="email"
                      autoComplete="email"
                      value={email}
                      placeholder="Email"
                      aria-label="EMAIL ADDRESS"
                      disabled={busy}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.preventDefault();
                      }}
                    />
                    <button
                      type="button"
                      className="apex-account-btn is-primary"
                      disabled={busy || waitSeconds > 0 || !email.trim()}
                      onClick={() => run(async () => {
                        const attempt = Date.now();
                        const result = await signInWithEmailOtp(email);
                        setNow(attempt);
                        if (result?.ok) {
                          setConfirmedEmail(email.trim());
                          setCode('');
                          setCodeSent(true);
                          setNextSendAt(Date.now() + 60_000);
                        } else if (result?.reason === 'email-rate-limited') {
                          setNextSendAt(Date.now() + 5 * 60_000);
                        }
                        return result;
                      })}
                    >
                      {waitSeconds > 0 ? `ĐỢI ${waitSeconds}S` : 'GỬI MÃ'}
                    </button>
                  </div>
                )}
                {emailCodeEnabled && codeSent && (
                  <>
                    <p className="apex-account-note" role="status">
                      Mã xác nhận đã được gửi đến {confirmedEmail}. Nhập 6 số
                      từ email ngay tại đây, không phải chuyển trình duyệt.
                    </p>
                    <div className="apex-account-row">
                      <input
                        className="apex-account-input"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        autoComplete="one-time-code"
                        value={code}
                        placeholder="MÃ 6 SỐ"
                        aria-label="SIX DIGIT EMAIL CODE"
                        disabled={busy}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (code.length === 6 && !busy)
                              run(() => verifyEmailOtp(confirmedEmail, code));
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="apex-account-btn is-primary"
                        disabled={busy || code.length !== 6}
                        onClick={() => run(() => verifyEmailOtp(confirmedEmail, code))}
                      >
                        XÁC NHẬN
                      </button>
                    </div>
                    <div className="apex-account-row">
                      <button type="button" className="apex-account-btn"
                        disabled={busy}
                        onClick={() => {
                          setCodeSent(false);
                          setCode('');
                          setMessage('');
                        }}>
                        ĐỔI EMAIL
                      </button>
                      <button
                        type="button"
                        className="apex-account-btn"
                        disabled={busy || waitSeconds > 0}
                        onClick={() => run(async () => {
                          const result = await signInWithEmailOtp(confirmedEmail);
                          if (result?.ok) {
                            setCode('');
                            setNextSendAt(Date.now() + 60_000);
                          } else if (result?.reason === 'email-rate-limited') {
                            setNextSendAt(Date.now() + 5 * 60_000);
                          }
                          setNow(Date.now());
                          return result;
                        })}
                      >
                        {waitSeconds > 0 ? `GỬI LẠI SAU ${waitSeconds}S` : 'GỬI LẠI MÃ'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>
          ) : (
            <section className="apex-account-section" aria-label="ACCOUNT">
              <h3>PLAYER ACCOUNT</h3>
              <div className="apex-account-actions">
                <button
                  type="button"
                  className="apex-account-btn"
                  disabled={busy}
                  onClick={() => run(() => signOutCloud())}
                >
                  SIGN OUT
                </button>
                {/* Deletion is a backend-processed REQUEST (A1 closeout
                    Blocker 3): the account is NOT erased by this button.
                    Copy and state must say PENDING, never "deleted". */}
                {deletionPending ? (
                  <button
                    type="button"
                    className="apex-account-btn is-danger"
                    disabled
                  >
                    DELETION PENDING
                  </button>
                ) : !confirmDelete ? (
                  <button
                    type="button"
                    className="apex-account-btn is-danger"
                    disabled={busy}
                    onClick={() => setConfirmDelete(true)}
                  >
                    REQUEST DELETION
                  </button>
                ) : (
                  <button
                    type="button"
                    className="apex-account-btn is-danger"
                    disabled={busy}
                    onClick={async () => {
                      const result = await run(() => requestAccountDeletion());
                      if (result && result.ok && result.status === 'pending') {
                        setDeletionPending(true);
                        setConfirmDelete(false);
                        setMessage('DELETION REQUESTED — PENDING');
                      }
                    }}
                  >
                    CONFIRM REQUEST
                  </button>
                )}
              </div>
              <p className="apex-account-note">
                Deletion is processed by the backend. Until then, your account and data still exist and sign-in still works.
              </p>
            </section>
          )}

          {isAdmin && (
            <section className="apex-account-section" aria-label="ADMIN">
              <h3>ADMIN</h3>
              <p className="apex-account-note">
                {`Admin Test Mode: Ctrl + Shift + F8 (${adminSource || 'authorized'}). Test matches never award AC.`}
              </p>
            </section>
          )}

          <div className="apex-account-message" role="status" aria-live="polite">{message}</div>

          <button type="button" className="apex-account-btn is-primary" onClick={closeCenter}>
            CONTINUE PLAYING
          </button>
        </div>
      </div>
    </div>
  );
}
