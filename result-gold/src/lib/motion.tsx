import { useCallback, useEffect, useRef, useState } from "react";
import { fmt } from "./match";

/**
 * Choreography timeline (ms from run start).
 *
 *  1 CONCLUDE    blast-door intro, "MATCH CONCLUDED"
 *  2 PLAYERS     verdict + hero reveal (winner slams, loser drifts)
 *  3 DAMAGE      numbers count, bar rushes from both ends and collides
 *  4 WEAPON      spotlight + mechanical assembly
 *  5 AWARDS      commendation stamps
 *  6 INTERACTIVE settled, controls unlocked
 */
export const PHASE_AT: Record<number, number> = {
  1: 0,
  2: 1000,
  3: 2250,
  4: 3750,
  5: 5450,
  6: 6900,
};
export const LAST_PHASE = 6;

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export interface Choreography {
  phase: number;
  skipped: boolean;
  done: boolean;
  run: number;
  skip: () => void;
  replay: () => void;
}

/** Drives the reveal sequence. Pure timers → state; all visuals are CSS keyed off `phase`. */
export function useChoreography(reduced: boolean): Choreography {
  const [phase, setPhase] = useState(reduced ? LAST_PHASE : 0);
  const [skipped, setSkipped] = useState(reduced);
  const [run, setRun] = useState(0);
  const timers = useRef<number[]>([]);

  const clear = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const schedule = useCallback(() => {
    clear();
    for (let p = 1; p <= LAST_PHASE; p++) {
      timers.current.push(
        window.setTimeout(() => setPhase(p), PHASE_AT[p] + 30)
      );
    }
  }, [clear]);

  useEffect(() => {
    if (reduced) {
      clear();
      setSkipped(true);
      setPhase(LAST_PHASE);
      return;
    }
    schedule();
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const skip = useCallback(() => {
    clear();
    setSkipped(true);
    setPhase(LAST_PHASE);
  }, [clear]);

  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const replay = useCallback(() => {
    clear();
    setRun((r) => r + 1);
    if (reducedRef.current) {
      // Reduced motion: "replay" simply re-renders the settled state (no intro, no movement).
      setSkipped(true);
      setPhase(LAST_PHASE);
      return;
    }
    setSkipped(false);
    setPhase(0);
    schedule();
  }, [clear, schedule]);

  return { phase, skipped, done: phase >= LAST_PHASE, run, skip, replay };
}

/** All sections now share one viewport; no scroll observer is needed to reveal them. */
export function useReveal<T extends HTMLElement>(
  phase: number,
  at: number,
  force: boolean
) {
  const ref = useRef<T>(null);
  return { ref, revealed: force || phase >= at };
}

interface CountUpProps {
  value: number;
  active: boolean;
  /** Snap straight to the final value (skip / reduced motion). */
  instant?: boolean;
  delay?: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}

/**
 * Number tween that never shifts layout: an invisible "ghost" of the final value
 * reserves the exact width; the live number is overlaid. Updates go straight to the
 * DOM (no React renders per frame).
 */
export function CountUp({
  value,
  active,
  instant = false,
  delay = 0,
  duration = 1400,
  format = fmt,
  className = "",
}: CountUpProps) {
  const liveRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = liveRef.current;
    if (!el) return;
    if (instant) {
      el.textContent = format(value);
      return;
    }
    if (!active) {
      el.textContent = format(0);
      return;
    }
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - t0) / duration));
      const eased = t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); // easeOutExpo
      el.textContent = format(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, active, instant, delay, duration, format]);

  return (
    <span className={`count ${className}`}>
      <span className="sr-only">{format(value)}</span>
      <span className="count__ghost" aria-hidden="true">
        {format(value)}
      </span>
      <span ref={liveRef} className="count__live" aria-hidden="true">
        {format(0)}
      </span>
    </span>
  );
}
