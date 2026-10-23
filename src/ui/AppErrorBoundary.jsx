import React from 'react';
import './appErrorBoundary.css';

// Catch React render/lifecycle failures at the application root so a transient
// UI exception does not leave a blank black screen. This is presentation-only;
// it does not retry gameplay, mutate saves, or claim the match was accepted.
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
    return (
      <main className="apex-fatal-error" role="alert" aria-labelledby="apex-fatal-title">
        <div className="apex-fatal-mark" aria-hidden="true">APEX CHAOS</div>
        <p className="apex-fatal-kicker">UI RECOVERY</p>
        <h1 id="apex-fatal-title">A system fault interrupted this screen.</h1>
        <p>Your local save was not intentionally changed. Reload to try again.</p>
        <button type="button" onClick={() => window.location.reload()}>RELOAD GAME</button>
      </main>
    );
  }
}
