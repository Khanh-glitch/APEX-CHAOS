import { useEffect, useRef, useState } from 'react';
import type { GameState } from './game/core';
import { dispatch, markDirty } from './game/engine';
import { settle } from './game/sim';
import { load, save } from './game/persist';
import { getArt } from './game/art';
import { getWorld } from './game/world';
import { resetRenderCaches, cam } from './game/render';
import { setVolume, initAudio } from './game/audio';
import { mkIntent } from './ui/common';
import Title from './ui/Title';
import Game from './ui/Game';

export default function App() {
  const gsRef = useRef<GameState | null>(null);
  const [screen, setScreen] = useState<'loading' | 'title' | 'game'>('loading');
  const [note, setNote] = useState<string | undefined>(); const [report, setReport] = useState<string[] | null>(null);
  const [summary, setSummary] = useState<GameState['profile']['history'][number] | null>(null);
  useEffect(() => { (async () => { getWorld(); getArt(); const { gs, note } = await load(); gsRef.current = gs; setNote(note); setVolume(gs.profile.settings.volume, gs.profile.settings.muted); setScreen('title'); })(); }, []);
  const gs = gsRef.current;
  if (screen === 'loading' || !gs) return <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', color: '#ffd98a', fontSize: 22 }} className="title-font">Raising the island…</div>;
  const enter = () => { markDirty(); resetRenderCaches(); cam.init = false; setScreen('game'); };
  return screen === 'title'
    ? <Title gs={gs} note={note} summary={summary} clearSummary={() => setSummary(null)}
        onContinue={() => { initAudio(); const rep = settle(gs, Date.now()); save(gs); if (!gs.run) { setSummary(gs.profile.history[0]); return; } setReport(rep.length ? rep : null); enter(); }}
        onStart={(c, region) => { initAudio(); const res = dispatch(gs, mkIntent('startRun', { character: c, region }), Date.now()); if (res.ok) { save(gs); setReport(null); enter(); } }} />
    : <Game gs={gs} report={report} onExit={() => setScreen('title')} onRunEnd={() => { setSummary(gs.profile.history[0] || null); setScreen('title'); }} />;
}
