import React, { useCallback, useEffect, useRef, useState } from 'react';
import './firstPlayGuide.css';

// APEX CHAOS — First-Play Guide (owner Requirement B, redesign).
// Compact, docked, NON-BLOCKING: the wrapper is pointer-events:none and
// only the card itself captures input, so FREE BATTLE (and every other
// Home control outside the card) stays usable while the guide is open.
// No dim backdrop, no full-screen takeover, Gold visual language.
//
// Controls copy is SOURCE-VERIFIED against the Free Battle runtime:
// fighters auto-move/auto-strike; J = Skill 1, K = Skill 2 (P2 in LOCAL
// uses Numpad 1 / 2); touch uses the two HUD skill cards; T = rematch,
// B / Esc = back home. (Verified 2026-10-20 — do not "improve" inventing
// keys; there is no guard key and no L/U/I skill mapping in Free Battle.
// BOT WAVE is a separate runtime with its own on-screen buttons and is
// deliberately out of scope for this copy.)
//
// Auto-show rule: first visit (flag unset) AND zero sealed matches in
// the wallet. The flag is written only when the player dismisses or
// finishes the guide — never merely for having booted. Replay anytime
// via the "?" control mounted in the top utility cluster.

const KEY = 'apex.alpha.guide.v1';

const COPY = {
  eng: {
    kicker: 'APEX CHAOS · FIRST-PLAY GUIDE',
    skip: 'SKIP', back: 'BACK', next: 'NEXT', play: 'START PLAYING',
    keyboard: 'KEYBOARD', touch: 'TOUCH',
    keys: 'J = Skill 1 · K = Skill 2 — P2 in LOCAL: Numpad 1 / 2 · T = rematch · B / Esc = back',
    touchLine: 'Tap the two skill cards on the bottom corners of the battle HUD.',
    steps: [
      { title: 'PICK YOUR FIGHT', body: 'FREE BATTLE → VS BOT or LOCAL 1V1. Choose your fighters, lock in — the arena does the rest.' },
      { title: 'IN THE ARENA', body: 'Fighters move and strike on their own. Your job: time the skills.' },
      { title: 'WIN · EARN · UNLOCK', body: 'Beat the BOT: +200 AC. Finished matches fill your MISSIONS. 350 AC spins the LUCKY DRAW for a new fighter.' },
    ],
  },
  vie: {
    kicker: 'APEX CHAOS · HƯỚNG DẪN NGƯỜI MỚI',
    skip: 'BỎ QUA', back: 'QUAY LẠI', next: 'TIẾP', play: 'VÀO CHƠI',
    keyboard: 'BÀN PHÍM', touch: 'CẢM ỨNG',
    keys: 'J = Kỹ năng 1 · K = Kỹ năng 2 — P2 ở LOCAL: Numpad 1 / 2 · T = đấu lại · B / Esc = quay lại',
    touchLine: 'Chạm hai thẻ kỹ năng ở hai góc dưới màn hình trận đấu.',
    steps: [
      { title: 'CHỌN TRẬN ĐẤU', body: 'ĐẤU TỰ DO → ĐẤU BOT hoặc LOCAL 1V1. Chọn tướng, khóa lựa chọn — đấu trường sẽ lo phần còn lại.' },
      { title: 'TRONG ĐẤU TRƯỜNG', body: 'Tướng tự di chuyển và tự đánh thường. Việc của bạn: canh thời điểm tung kỹ năng.' },
      { title: 'THẮNG · NHẬN AC · MỞ TƯỚNG', body: 'Thắng BOT: +200 AC. Trận hoàn thành sẽ tính vào NHIỆM VỤ. 350 AC quay LUCKY DRAW mở tướng mới.' },
    ],
  },
};

function currentLanguage() {
  try { return window.APEX_I18N?.getLanguage?.() === 'vie' ? 'vie' : 'eng'; } catch { return 'eng'; }
}
function seen() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
function markSeen() {
  try { localStorage.setItem(KEY, '1'); } catch { /* storage unavailable: guide simply re-offers next visit */ }
}
function sealedMatches() {
  try {
    const state = window.APEX_ARSENAL_META?.getState?.();
    if (!state) return null;
    return (state.botMatches || 0) + (state.localMatches || 0);
  } catch { return null; }
}

export default function FirstPlayGuide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState(currentLanguage);
  const coarse = useRef(false);
  try { coarse.current = window.matchMedia?.('(pointer: coarse)').matches; } catch { /* default keyboard-first */ }

  const show = useCallback(() => { setLang(currentLanguage()); setStep(0); setOpen(true); }, []);
  const close = useCallback(() => { markSeen(); setOpen(false); }, []);

  useEffect(() => {
    window.APEX_FIRST_PLAY_GUIDE = { open: show, close: () => setOpen(false), isOpen: () => open };
    const onOpen = () => show();
    const onLanguage = () => setLang(currentLanguage());
    window.addEventListener('apex:guide-open', onOpen);
    window.addEventListener('apex:language-changed', onLanguage);

    // Auto-show only for genuinely new players: flag unset and no
    // sealed match yet. Poll until the wallet authority is mounted.
    let tries = 0;
    const poll = window.setInterval(() => {
      tries += 1;
      const played = sealedMatches();
      if (played !== null || tries > 40) {
        window.clearInterval(poll);
        if (!seen() && played === 0) show();
      }
    }, 500);

    // "?" replay control, mounted into the Gold stage beside the
    // language cluster (same pattern as the ENG|VIE picker). The CSS
    // hides it whenever the stage leaves Home, so it can never sit on
    // top of battle controls.
    let guideBtn = null;
    const mountBtn = () => {
      if (guideBtn?.isConnected) return;
      const host = document.querySelector('#gold-shell-host');
      const stage = host?.querySelector('#stage') || document.querySelector('#stage');
      if (!stage) return;
      guideBtn = document.createElement('button');
      guideBtn.type = 'button';
      guideBtn.id = 'apex-guide-open';
      guideBtn.dataset.apexNoLocalize = '';
      guideBtn.setAttribute('aria-label', 'How to play / Hướng dẫn chơi');
      guideBtn.textContent = '?';
      guideBtn.addEventListener('click', () => show());
      stage.appendChild(guideBtn);
    };
    mountBtn();
    const guard = new MutationObserver(mountBtn);
    guard.observe(document.body, { subtree: true, childList: true });

    return () => {
      window.clearInterval(poll);
      window.removeEventListener('apex:guide-open', onOpen);
      window.removeEventListener('apex:language-changed', onLanguage);
      guard.disconnect();
      guideBtn?.remove();
      if (window.APEX_FIRST_PLAY_GUIDE?.open === show) delete window.APEX_FIRST_PLAY_GUIDE;
    };
  }, [show, open]);

  // Scene-exit guard: the card must never cover match controls. When the
  // stage leaves Home (mode select / fighter select / battle), hide the
  // guide. This is NOT a dismissal — the seen flag is untouched — but a
  // player who starts a match no longer meets the auto-show rule anyway
  // (sealed matches > 0), while the "?" control can always replay it.
  // A MutationObserver (not polling) watches the stage class: the Gold
  // screen classes flap during transitions, and under load a 250ms
  // poll can miss the window entirely, stranding the card over the
  // fighter picker (CI + single-CPU reproduction: details button
  // covered by the card's own heading). The predicate matches the
  // codebase Home convention (App.jsx / FieldArchiveC03): Home is the
  // absence of every screen-* class.
  useEffect(() => {
    if (!open) return undefined;
    const AWAY = ['screen-mode', 'screen-fighter', 'screen-draw', 'screen-battle'];
    const leftHome = () => {
      const stage = document.querySelector('#gold-shell-host #stage');
      if (stage && AWAY.some((c) => stage.classList.contains(c))) setOpen(false);
    };
    leftHome();
    // Observe the shell host subtree: catches the stage mounting late
    // AND every class change on it, with no polling window to miss.
    const host = document.querySelector('#gold-shell-host') || document.body;
    const observer = new MutationObserver(leftHome);
    observer.observe(host, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
    return () => observer.disconnect();
  }, [open ]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      // Only own the Escape key while Home is the visible scene; in a
      // battle Escape belongs to the battle exit contract.
      const stage = document.querySelector('#gold-shell-host #stage');
      if (stage && ['screen-mode', 'screen-fighter', 'screen-draw', 'screen-battle'].some((c) => stage.classList.contains(c))) return;
      event.preventDefault();
      close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, close]);

  if (!open) return null;
  const copy = COPY[lang] || COPY.eng;
  const item = copy.steps[step];
  const last = step === copy.steps.length - 1;
  const controls = [
    { tag: copy.keyboard, line: copy.keys },
    { tag: copy.touch, line: copy.touchLine },
  ];
  if (coarse.current) controls.reverse();

  return (
    <div className="apex-guide-dock">
      <section className="apex-guide-card" role="dialog" aria-modal="false" aria-labelledby="apex-guide-title" data-apex-no-localize="">
        <header>
          <div>
            <p className="apex-guide-kicker">{copy.kicker}</p>
            <h2 id="apex-guide-title">{item.title}</h2>
          </div>
          <button type="button" className="apex-guide-close" aria-label={lang === 'vie' ? 'Đóng hướng dẫn' : 'Close guide'} onClick={close}>✕</button>
        </header>
        <p className="apex-guide-body">{item.body}</p>
        {step === 1 && (
          <div className="apex-guide-controls">
            {controls.map((lane) => (
              <p key={lane.tag}><span>{lane.tag}</span>{lane.line}</p>
            ))}
          </div>
        )}
        <footer>
          <div className="apex-guide-dots" aria-hidden="true">
            {copy.steps.map((_, index) => <span key={index} className={index === step ? 'is-current' : ''} />)}
          </div>
          <div className="apex-guide-actions">
            <button type="button" className="is-ghost" onClick={close}>{copy.skip}</button>
            {step > 0 && <button type="button" className="is-ghost" onClick={() => setStep((n) => n - 1)}>{copy.back}</button>}
            <button type="button" className="is-primary" onClick={() => (last ? close() : setStep((n) => n + 1))}>
              {last ? copy.play : `${copy.next} →`}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
