import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  isCloudConfigured,
  isGoogleSignInEnabled,
  signInWithGoogle,
  signInWithEmailOtp,
  signOutCloud,
  requestAccountDeletion,
  uploadProgressSnapshot,
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
  const [linkSent, setLinkSent] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletionPending, setDeletionPending] = useState(false);
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const invokerRef = useRef(null);

  const refresh = useCallback(() => { setTick((n) => n + 1); stampHomeChip(); }, []);

  const openCenter = useCallback((invoker) => {
    invokerRef.current = invoker || document.activeElement || null;
    setMessage('');
    setConfirmDelete(false);
    setLinkSent(false);
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

  const run = async (fn) => {
    setBusy(true);
    setMessage('');
    try {
      const result = await fn();
      if (result && result.ok === false && result.reason) setMessage(String(result.reason).toUpperCase());
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
              <span>APEX CREDITS</span>
              <b data-account-credits>{credits == null ? '—' : `${credits} AC`}</b>
            </div>
            <div className="apex-account-stat">
              <span>OWNED FIGHTERS</span>
              <b data-account-owned>{`${ownedIds.length} / ${playable.length}`}</b>
            </div>
            <div className="apex-account-stat">
              <span>TOTAL DRAWS</span>
              <b>{totalSpins}</b>
            </div>
          </div>

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
            {isCloud && (
              <div className="apex-account-actions" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="apex-account-btn"
                  disabled={busy}
                  onClick={() => run(() => uploadProgressSnapshot())}
                >
                  UPLOAD SNAPSHOT
                </button>
              </div>
            )}
          </section>

          {!isCloud ? (
            <section className="apex-account-section" aria-label="SIGN IN">
              <h3>{cloudConfigured ? 'SIGN IN' : 'CLOUD NOT CONFIGURED'}</h3>
              <div className="apex-account-actions">
                <button
                  type="button"
                  className="apex-account-btn is-primary"
                  disabled={busy || !googleEnabled}
                  onClick={() => run(() => signInWithGoogle())}
                >
                  SIGN IN WITH GOOGLE
                </button>
                {cloudConfigured && !googleEnabled && (
                  <p className="apex-account-note">
                    Google sign-in is not enabled for this environment. Use the email sign-in link.
                  </p>
                )}
                <div className="apex-account-row">
                  <input
                    className="apex-account-input"
                    type="email"
                    value={email}
                    placeholder="EMAIL ADDRESS"
                    aria-label="EMAIL ADDRESS"
                    disabled={!cloudConfigured}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <button
                    type="button"
                    className="apex-account-btn"
                    disabled={busy || !cloudConfigured}
                    onClick={() => run(async () => {
                      const result = await signInWithEmailOtp(email);
                      if (result && result.ok) setLinkSent(true);
                      return result;
                    })}
                  >
                    SEND SIGN-IN LINK
                  </button>
                </div>
                {linkSent && (
                  <p className="apex-account-note" role="status">
                    Check your email and open the sign-in link. APEX CHAOS will
                    open in a new tab, already signed in. No code is needed.
                  </p>
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
