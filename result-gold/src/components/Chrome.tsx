import { useEffect, useRef } from "react";
import { ArrowRight, ChevronsRight, LayoutGrid, RotateCcw } from "lucide-react";
import type { MatchMeta } from "../data/types";
import { fmtDuration } from "../lib/match";
import { useReveal } from "../lib/motion";

/* ───────────── static backdrop: industrial plate, team light, grain, hazard strip */
export function Backdrop() {
  return (
    <div className="bg" aria-hidden="true">
      <i className="bg__glow bg__glow--1" />
      <i className="bg__glow bg__glow--2" />
      <i className="bg__plates" />
      <i className="bg__noise" />
      <i className="bg__hazard" />
      <i className="bg__vignette" />
    </div>
  );
}

/* ───────────── top bar */
function Logo() {
  return (
    <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
      <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="none" stroke="currentColor" strokeWidth="2" />
      <polygon points="17.5,8 11,17.5 15.5,17.5 14.5,24 21,14.5 16.5,14.5" fill="currentColor" />
    </svg>
  );
}

export function TopBar({ meta, onReplay }: { meta: MatchMeta; onReplay: () => void }) {
  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <span className="brand__name">
          APEX<b>CHAOS</b>
        </span>
        <span className="brand__tag">Match Report</span>
      </div>
      <ul className="topbar__meta" aria-label="Thông tin trận đấu">
        <li>{meta.map}</li>
        <li>{meta.mode}</li>
        <li>{fmtDuration(meta.durationSec)}</li>
        <li className="mono">#{meta.id}</li>
      </ul>
      <button type="button" className="iconbtn" onClick={onReplay} title="Xem lại hiệu ứng (R)" aria-label="Xem lại hiệu ứng">
        <RotateCcw size={18} aria-hidden="true" />
        <span>Xem lại</span>
      </button>
    </header>
  );
}

/* ───────────── Phase 1: blast door */
export function IntroDoor({ meta }: { meta: MatchMeta }) {
  return (
    <div className="intro" aria-hidden="true">
      <div className="intro__door intro__door--top" />
      <div className="intro__door intro__door--bottom" />
      <div className="intro__seam" />
      <div className="intro__copy">
        <span className="intro__kicker">
          APEX CHAOS · {meta.map}
        </span>
        <strong className="intro__title">
          {[..."MATCH CONCLUDED"].map((c, i) => (
            <span key={i} className="intro__ch" style={{ ["--i" as string]: i }}>
              {c === " " ? "\u00A0" : c}
            </span>
          ))}
        </strong>
        <span className="intro__sub">Đang tổng kết kết quả…</span>
      </div>
    </div>
  );
}

/* Intro skip occupies the replay control's position until the reveal is complete. */
export function SkipPill({ visible, onSkip }: { visible: boolean; onSkip: () => void }) {
  return (
    <button
      type="button"
      className={`skip${visible ? "" : " is-hidden"}`}
      onClick={onSkip}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
    >
      <ChevronsRight size={18} aria-hidden="true" />
      <span>Bỏ qua</span>
      <kbd>Space</kbd>
    </button>
  );
}

/* ───────────── action dock */
interface DockProps {
  phase: number;
  force: boolean;
  done: boolean;
  onContinue: () => void;
  onArchive: () => void;
}
export function ActionDock({ phase, force, done, onContinue, onArchive }: DockProps) {
  const { ref, revealed } = useReveal<HTMLDivElement>(phase, 5, force);
  return (
    <div ref={ref} className={`dock${revealed ? " is-in" : ""}${done ? " is-ready" : ""}`}>
      <button type="button" className="btn btn--primary" onClick={onContinue} disabled={!done}>
        <span className="btn__label">{done ? "Tiếp tục" : "Đang tổng kết…"}</span>
        <ArrowRight size={20} aria-hidden="true" />
      </button>
      <button type="button" className="btn btn--ghost" onClick={onArchive} aria-label="Mở hồ sơ và danh hiệu đang được áp dụng">
        <LayoutGrid size={18} aria-hidden="true" />
        <span>Hồ sơ danh hiệu</span>
      </button>
    </div>
  );
}

/* ───────────── ambient particles: embers on the winning side, faint static on the other.
   Seeded PRNG → identical every run. Single canvas, ≤ 46 particles, paused when hidden. */
interface FxProps {
  active: boolean;
  paused: boolean;
  p1Rgb: string;
  p2Rgb: string;
  winnerSlot: 1 | 2;
}
export function AmbientFX({ active, paused, p1Rgb, p2Rgb, winnerSlot }: FxProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !active || paused) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();

    let seed = 0x1badf00d;
    const rnd = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      cv.width = Math.floor(w * dpr);
      cv.height = Math.floor(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const rgb = (s: string) => s.split(" ").join(",");
    const win = winnerSlot === 1 ? rgb(p1Rgb) : rgb(p2Rgb);
    const lose = winnerSlot === 1 ? rgb(p2Rgb) : rgb(p1Rgb);
    const total = w < 700 ? 26 : 44;

    interface P { x: number; y: number; vy: number; sway: number; ph: number; r: number; win: boolean; life: number }
    const mk = (i: number, scatter: boolean): P => {
      const isWin = i % 3 !== 0;
      const bandL = winnerSlot === 1 ? 0 : 0.45;
      const x = (isWin ? bandL + rnd() * 0.55 : (winnerSlot === 1 ? 0.5 : 0) + rnd() * 0.5) * w;
      return {
        x,
        y: scatter ? rnd() * h : h + 10 + rnd() * 80,
        vy: isWin ? 18 + rnd() * 34 : 6 + rnd() * 12,
        sway: 6 + rnd() * 16,
        ph: rnd() * 6.28,
        r: isWin ? 0.8 + rnd() * 1.8 : 0.6 + rnd() * 1.1,
        win: isWin,
        life: rnd(),
      };
    };
    const ps: P[] = Array.from({ length: total }, (_, i) => mk(i, true));

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) {
        last = now;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.y -= p.vy * dt;
        p.life += dt * 0.12;
        p.ph += dt * 1.4;
        const x = p.x + Math.sin(p.ph) * p.sway;
        const edge = Math.min(1, Math.max(0, p.y / (h * 0.25)));
        const a = (p.win ? 0.55 : 0.28) * edge * (0.6 + 0.4 * Math.sin(p.ph * 2.3));
        if (p.y < -10) {
          ps[i] = mk(i, false);
          continue;
        }
        ctx.fillStyle = `rgba(${p.win ? win : lose},${Math.max(0, a).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ctx.clearRect(0, 0, w, h);
    };
  }, [active, paused, p1Rgb, p2Rgb, winnerSlot]);

  return <canvas ref={ref} className="fx" aria-hidden="true" />;
}
