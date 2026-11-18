import React from 'react';
import ApexIcon from './premium/ApexIcon.jsx';
import './appErrorBoundary.css';

// Catch React render/lifecycle failures at the application root so a transient
// UI exception does not leave a blank black screen. This is presentation-only;
// it does not retry gameplay, mutate saves, or claim the match was accepted.
const COPY = {
  eng: {
    kicker: 'APEX // UI RECOVERY',
    title: 'A system fault interrupted this screen.',
    body: 'Your local progress and save data remain untouched. Reload to return safely.',
    reload: 'RELOAD GAME',
  },
  vie: {
    kicker: 'APEX // KHÔI PHỤC GIAO DIỆN',
    title: 'Đã xảy ra lỗi hiển thị tạm thời.',
    body: 'Dữ liệu lưu trên thiết bị của bạn vẫn nguyên vẹn. Hãy tải lại để tiếp tục.',
    reload: 'TẢI LẠI TRÒ CHƠI',
  },
};

export default class AppErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('[apex-ui-boundary] application render failed', error, info?.componentStack || '');
  }

  render() {
    if (!this.state.failed) return this.props.children;
    let lang = 'eng';
    try {
      const live = window.APEX_I18N?.getLanguage?.() || window.localStorage?.getItem('apex.language.v1');
      if (live === 'vie') lang = 'vie';
    } catch { /* fallback eng */ }
    const t = COPY[lang];
    return (
      <main className="apex-fatal-error" role="alert" aria-labelledby="apex-fatal-title">
        <section className="apex-fatal-card">
          <span className="apex-fatal-icon"><ApexIcon name="fault" size={56} /></span>
          <div className="apex-fatal-mark" aria-hidden="true">APEX CHAOS</div>
          <p className="apex-fatal-kicker">{t.kicker}</p>
          <h1 id="apex-fatal-title">{t.title}</h1>
          <p className="apex-fatal-body">{t.body}</p>
          <button type="button" className="apex-fatal-reload" onClick={() => window.location.reload()}>
            <ApexIcon name="refresh" size={18} /> {t.reload}
          </button>
        </section>
      </main>
    );
  }
}
