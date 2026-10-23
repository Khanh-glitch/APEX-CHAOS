import { useEffect, useState } from "react";
import { MatchResults } from "./components/MatchResults";
import { ACHIEVEMENTS } from "./data/achievements";
import type { MatchResult } from "./data/types";

/**
 * Production-only data seam: the Gold source owns every visual and animation.
 * It never fabricates match state, assigns economy, or reads the demo fixture.
 * Parent origin AND parent window identity are checked on every message.
 */
/**
 * CP4: payload art URLs arrive in whichever spelling the host produced
 * ('/assets/…', './assets/…', '../assets/…'). The Result document always
 * lives at <app>/result-gold/, so every first-party asset resolves against
 * its parent directory — correct on root deploys and nested itch subpaths.
 */
function normalizeMatchArt(match: MatchResult): MatchResult {
  let appRoot = "";
  try { appRoot = new URL("../", window.location.href).href; } catch { return match; }
  const fix = (src?: string): string | undefined => {
    if (!src) return src;
    const m = String(src).match(/^\/?(?:\.\.\/|\.\/)?(assets\/.*)$/);
    if (!m) return src;
    try { return new URL(m[1], appRoot).href; } catch { return src; }
  };
  return {
    ...match,
    players: match.players.map((p) => ({
      ...p,
      character: { ...p.character, portraitSrc: fix(p.character.portraitSrc) },
    })) as MatchResult["players"],
    weapons: match.weapons.map((w) => ({
      ...w,
      artSrc: fix(w.artSrc),
      skinArtBySide: w.skinArtBySide
        ? Object.fromEntries(Object.entries(w.skinArtBySide).map(([k, v]) => [k, fix(v) || v]))
        : w.skinArtBySide,
    })),
  };
}

export default function App() {
  const [match, setMatch] = useState<MatchResult | null>(null);
  useEffect(() => {
    const origin = window.location.origin;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== origin) return;
      if (event.data?.type !== "APEX_RESULT_GOLD_PAYLOAD") return;
      const incoming = event.data.match as MatchResult | null;
      if (!incoming || !Array.isArray(incoming.players) || incoming.players.length !== 2 ||
          !incoming.meta?.id || !Array.isArray(incoming.weapons)) return;
      setMatch(normalizeMatchArt(incoming));
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "APEX_RESULT_GOLD_READY" }, origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!match) return <div className="ac-root" role="status" aria-label="Đang nhận kết quả trận đấu" />;
  return <MatchResults key={match.meta.id} match={match} catalog={ACHIEVEMENTS}
    onContinue={() => window.parent.postMessage({ type: "APEX_RESULT_GOLD_CONTINUE", matchId: match.meta.id }, window.location.origin)} />;
}
