import { useEffect, useState } from "react";
import { MatchResults } from "./components/MatchResults";
import { ACHIEVEMENTS } from "./data/achievements";
import type { MatchResult } from "./data/types";

/**
 * Production-only data seam: the Gold source owns every visual and animation.
 * It never fabricates match state, assigns economy, or reads the demo fixture.
 * Parent origin AND parent window identity are checked on every message.
 */
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
      setMatch(incoming);
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "APEX_RESULT_GOLD_READY" }, origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!match) return <div className="ac-root" role="status" aria-label="Đang nhận kết quả trận đấu" />;
  return <MatchResults key={match.meta.id} match={match} catalog={ACHIEVEMENTS}
    onContinue={() => window.parent.postMessage({ type: "APEX_RESULT_GOLD_CONTINUE", matchId: match.meta.id }, window.location.origin)} />;
}
