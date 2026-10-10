import { useState } from "react";
import { ArrowLeft, DoorOpen } from "lucide-react";
import { Dialog } from "./components/Dialog";
import { MatchResults } from "./components/MatchResults";
import { ACHIEVEMENTS } from "./data/achievements";
import { MATCH_FIXTURE } from "./data/fixture";

/**
 * Standalone prototype shell. In the game, replace MATCH_FIXTURE / ACHIEVEMENTS with the
 * engine's payload and route `onContinue` to the lobby.
 */
export default function App() {
  const [left, setLeft] = useState(false);

  return (
    <>
      <MatchResults match={MATCH_FIXTURE} catalog={ACHIEVEMENTS} onContinue={() => setLeft(true)} />

      {left && (
        <Dialog id="handoff" titleId="handoff-title" className="handoff-modal" onClose={() => setLeft(false)}>
          <div className="handoff__card">
            <DoorOpen size={30} aria-hidden="true" />
            <p className="handoff__kicker">Prototype · onContinue()</p>
            <h2 id="handoff-title">Đã rời màn hình kết quả</h2>
            <p>
              Trong game, hành động này sẽ chuyển người chơi về sảnh hoặc bước tiếp theo. Dữ liệu trận đấu vẫn giữ
              nguyên để bạn có thể quay lại đánh giá.
            </p>
            <button type="button" className="btn btn--primary" onClick={() => setLeft(false)} autoFocus>
              <ArrowLeft size={18} aria-hidden="true" />
              <span className="btn__label">Quay lại kết quả</span>
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
