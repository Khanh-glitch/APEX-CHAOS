import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GUEST_ONLY_RELEASE } from '../game/releasePolicy.js';
import {
  isCloudConfigured, signInWithGoogle, signInWithEmailOtp,
  verifyEmailOtp, signOutCloud, requestAccountDeletion,
  uploadProgressSnapshot, recordGuestMigration,
} from '../game/cloudAccount.js';
import { GoldShell, GoldWallet, GoldHeroArt, acText } from './GoldMissionAccountKit.jsx';

// Entire legacy Account HUD removed. Live authority contract stays untouched:
// player identity: APEX_PLAYER_ACCOUNT; wallet/roster: APEX_ARSENAL_META.
// No prototype localStorage, fake credits, client-only inventory, or demo actions.
function readAccount() {
  const account = window.APEX_PLAYER_ACCOUNT;
  const meta = window.APEX_ARSENAL_META;
  const surface = window.APEX_PRODUCT_SURFACE;
  const profile = account?.profile?.() || null;
  const sync = account?.syncStatus?.() || { status:'local-only', lastSyncAt:null };
  const state = meta?.getState?.() || null;
  const playable = [...(surface?.roster?.playableIds || [])];
  const owned = playable.filter(id => !!state?.ownedFighters?.includes(id));
  return { account, meta, profile, sync, state, playable, owned,
    credits: state?.credits, draws: state?.totalSpins || 0 };
}
function displayHero(id, meta) {
  return meta?.displayNameFor?.(id) || ({ ROBOT:'NEWBOT', CRYSTAL:'CRYSTALA', ICE:'FROST' }[id] || id);
}
function focusable(parent) {
  return [...(parent?.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]') || [])]
    .filter(el => !el.hidden && el.getClientRects().length > 0);
}
export default function AccountCenter() {
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletionPending, setDeletionPending] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const invoker = useRef(null);
  const closeRef = useRef(null);
  const refresh = useCallback(() => tick(v => v + 1), []);
  const openCenter = useCallback((element) => {
    invoker.current = element || document.activeElement;
    const { profile } = readAccount();
    setDraft(profile?.displayName || '');
    setEditing(false);setMessage('');setOtp('');setOtpSent(false);setConfirmDelete(false);
    try { const probe='apex-ui-save-probe'; localStorage.setItem(probe, '1'); localStorage.removeItem(probe); setStorageAvailable(true); }
    catch { setStorageAvailable(false); }
    setOpen(true); refresh();
  }, [refresh]);
  const closeCenter = useCallback(() => {
    setOpen(false);
    const previous=invoker.current;
    if(previous?.isConnected && typeof previous.focus==='function') previous.focus({preventScroll:true});
    invoker.current=null;
  },[]);
  useEffect(() => {
    window.APEX_ACCOUNT_CENTER = Object.freeze({
      open: () => openCenter(null), close: closeCenter, isOpen: () => open,
    });
    return () => { delete window.APEX_ACCOUNT_CENTER; };
  }, [open,openCenter,closeCenter]);
  useEffect(() => {
    const onNav = e => {
      const target=e.target?.closest?.('#apexAccountOpen');
      if (!target) return;
      e.preventDefault(); e.stopPropagation(); openCenter(target);
    };
    const onOpen = () => openCenter(null);
    document.addEventListener('click',onNav,true);
    window.addEventListener('apex:open-account',onOpen);
    window.addEventListener('apex:account',refresh);
    window.addEventListener('apex:credits',refresh);
    window.addEventListener('apex:mastery-unlocked',refresh);
    return () => {
      document.removeEventListener('click',onNav,true);
      window.removeEventListener('apex:open-account',onOpen);
      window.removeEventListener('apex:account',refresh);
      window.removeEventListener('apex:credits',refresh);
      window.removeEventListener('apex:mastery-unlocked',refresh);
    };
  },[openCenter,refresh]);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus({preventScroll:true});
    const onKey = e => {
      if(e.key === 'Escape'){e.preventDefault();e.stopPropagation();closeCenter();return;}
      if(e.key !== 'Tab')return;
      const parent=document.querySelector('.agm-account');
      const nodes=focusable(parent); if(!nodes.length)return;
      if(e.shiftKey && document.activeElement===nodes[0]){e.preventDefault();nodes[nodes.length-1].focus();}
      if(!e.shiftKey && document.activeElement===nodes[nodes.length-1]){e.preventDefault();nodes[0].focus();}
    };
    window.addEventListener('keydown',onKey,true);
    return()=>window.removeEventListener('keydown',onKey,true);
  },[open,closeCenter]);
  const run = async fn => {
    if(busy)return null;setBusy(true);setMessage('');
    try{
      const result=await fn();
      if(result?.ok===false)setMessage(String(result.reason || 'ACTION FAILED').toUpperCase());
      refresh();return result;
    }catch(error){setMessage(String(error?.message || error));return null;}
    finally{setBusy(false);}
  };

  const {account,meta,profile,sync,playable,owned,credits,draws} = readAccount();
  if(!open)return null;
  const name = profile?.displayName || 'GUEST';
  const isCloud = profile?.kind === 'cloud';
  const art = owned.includes(selected) ? selected : owned[0] || playable[0] || 'ROBOT';
  const selectedName=displayHero(art,meta);
  const saveLabel = !storageAvailable ? 'TRÌNH DUYỆT ĐANG CHẶN LƯU' :
    isCloud ? String(sync.status || 'local-only').toUpperCase() : 'LƯU TRÊN THIẾT BỊ';
  const saveDesc = GUEST_ONLY_RELEASE
    ? 'Tiến trình, AC và tướng của bạn lưu trong trình duyệt này. Xóa dữ liệu trang sẽ làm mất tiến trình; Alpha chưa có đồng bộ tài khoản.'
    : isCloud ? `Trạng thái đồng bộ: ${sync.status || 'unknown'}` : 'Chỉ lưu trên thiết bị này, chưa có đồng bộ đám mây.';
  const saveName = () => {
    const clean = draft.trim().replace(/\s+/g,' ');
    if(!clean || clean.length>24 || !/^[\p{L}\p{N} _-]+$/u.test(clean)){
      setMessage('Tên cần 1–24 ký tự: chữ, số, dấu cách, _ hoặc -');return;
    }
    account?.setDisplayName?.(clean);setEditing(false);setMessage('ĐÃ LƯU TÊN');refresh();
  };
  const copyId = async () => {
    try { await navigator.clipboard.writeText(String(profile?.profileId || ''));setMessage('ĐÃ SAO CHÉP PLAYER ID'); }
    catch {setMessage('KHÔNG THỂ SAO CHÉP TỰ ĐỘNG');}
  };

  return (
    <GoldShell type="account" title="ACCOUNT" subtitle="HỒ SƠ NGƯỜI CHƠI"
      legacyClass="apex-account-overlay is-open" roleTitleId="apex-account-title"
      closeRef={closeRef} onClose={closeCenter}>
      <div className="agm-account-layout">
        <section className="agm-panel agm-license" aria-label="PILOT LICENSE">
          <div className="agm-license-head">
            <div><span className="agm-mini">APEX CHAOS // OFFICIAL</span><strong>PILOT LICENSE</strong></div>
            <span className="agm-guest-stamp">{isCloud ? 'PILOT' : 'GUEST'}</span>
          </div>
          <div className="agm-license-player">
            <GoldHeroArt id={art} name={selectedName} large/>
            <div style={{minWidth:0,flex:1}}>
              <span className="agm-mini">TÊN HIỂN THỊ</span>
              {editing ? (
                <div className="agm-name-editor">
                  <input autoFocus aria-label="DISPLAY NAME" maxLength={24} value={draft}
                    onChange={e=>setDraft(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter')saveName();if(e.key==='Escape'){e.stopPropagation();setEditing(false);}}}/>
                  <button type="button" className="agm-button" onClick={saveName}>LƯU</button>
                  <button type="button" className="agm-button is-secondary" onClick={()=>setEditing(false)}>HỦY</button>
                </div>
              ):(
                <div><h3>{name}</h3>
                  {!isCloud && <button type="button" className="agm-button is-secondary"
                    onClick={()=>{setDraft(name);setEditing(true);}}>✎ ĐỔI TÊN</button>}
                </div>
              )}
              <span className="agm-mini" style={{marginTop:16}}>TƯỚNG TRƯNG BÀY · {selectedName}</span>
            </div>
          </div>
          <div className="agm-profile-id">
            <span className="agm-mini">PLAYER ID · NHẤN ĐỂ SAO CHÉP</span>
            <button type="button" onClick={copyId} title="Sao chép Player ID">
              {profile?.profileId || '—'}　▢
            </button>
          </div>
          <div className="agm-profile-actions" style={{marginTop:24}}>
            <span className="agm-mini">PLAY INSTANTLY · NO SIGN-IN REQUIRED</span>
          </div>
        </section>
        <div className="agm-account-side">
          <section className="agm-panel">
            <GoldWallet amount={credits} large caption="SỐ DƯ APEX CREDITS" />
          </section>
          <div className="agm-stat-grid">
            <section className="agm-panel agm-stat">
              <span className="agm-mini">TƯỚNG SỞ HỮU</span>
              <b data-account-owned>{owned.length} <span style={{fontSize:15,color:'#b79272'}}> / {playable.length}</span></b>
            </section>
            <section className="agm-panel agm-stat">
              <span className="agm-mini">TỔNG LƯỢT LUCKY DRAW</span>
              <b>{acText(draws)}</b>
            </section>
          </div>
          <section className="agm-panel">
            <span className="agm-mini">BỘ SƯU TẬP TƯỚNG · CHỌN TƯỚNG TRƯNG BÀY</span>
            <div className="agm-portraits">
              {playable.map(id=>{
                const has=owned.includes(id);
                return <button key={id} type="button" className={has?'agm-portrait-item':'agm-portrait-item is-locked'}
                  title={displayHero(id,meta)} aria-pressed={art===id}
                  disabled={!has} onClick={()=>setSelected(id)}>
                  <GoldHeroArt id={id} name={displayHero(id,meta)}/>
                  <span>{displayHero(id,meta)}</span>
                  {!has&&<small>LOCKED</small>}
                </button>;
              })}
            </div>
          </section>
          <section className="agm-panel agm-save" aria-label="SAVE STATUS">
            <span className={`agm-save-dot${!storageAvailable||(!GUEST_ONLY_RELEASE&&sync.status!=='saved')?' is-offline':''}`}/>
            <div><span className="agm-mini">SAVE STATUS</span><strong data-account-sync>{saveLabel}</strong><p>{saveDesc}</p></div>
          </section>
          {!GUEST_ONLY_RELEASE && (
            <section className="agm-panel agm-signin">
              <span className="agm-mini">{isCloud?'CLOUD ACCOUNT':'CLOUD SIGN-IN'}</span>
              {!isCloud?<>
                {!isCloudConfigured()?<p>Đồng bộ chưa được cấu hình trên bản phát hành này.</p>:<>
                  <button type="button" className="agm-button" disabled={busy} onClick={()=>run(()=>signInWithGoogle())}>GOOGLE SIGN-IN</button>
                  <input type="email" aria-label="EMAIL" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
                  <button type="button" className="agm-button is-secondary" disabled={busy} onClick={()=>run(async()=>{const r=await signInWithEmailOtp(email);if(r?.ok)setOtpSent(true);return r;})}>GỬI MÃ</button>
                  {otpSent&&<><input aria-label="OTP" value={otp} onChange={e=>setOtp(e.target.value)} placeholder="Verification code"/>
                    <button type="button" className="agm-button" disabled={busy} onClick={()=>run(async()=>{const r=await verifyEmailOtp(email,otp);if(r?.ok){await recordGuestMigration().catch(()=>null);await uploadProgressSnapshot().catch(()=>null);}return r;})}>XÁC NHẬN</button></>}
                </>}
              </>:<>
                <button className="agm-button is-secondary" disabled={busy} onClick={()=>run(()=>uploadProgressSnapshot())}>UPLOAD SNAPSHOT</button>
                <button className="agm-button is-secondary" disabled={busy} onClick={()=>run(()=>signOutCloud())}>SIGN OUT</button>
                <button className="agm-button is-secondary" disabled={busy || deletionPending} onClick={async()=>{
                  if(!confirmDelete){setConfirmDelete(true);return;}
                  const r=await run(()=>requestAccountDeletion());
                  if(r?.ok&&r.status==='pending'){setDeletionPending(true);setMessage('DELETION REQUESTED — PENDING');}
                }}>{deletionPending?'DELETION PENDING':confirmDelete?'CONFIRM REQUEST':'REQUEST DELETION'}</button>
                <p>Xóa tài khoản là yêu cầu xử lý phía máy chủ; dữ liệu chưa bị xóa khi mới gửi yêu cầu.</p>
              </>}
            </section>
          )}
          <div className="agm-status" aria-live="polite" role="status">{message}</div>
        </div>
      </div>
    </GoldShell>
  );
}
