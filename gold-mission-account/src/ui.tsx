import { useEffect, useMemo, useRef, useState } from "react";
import { arena, type Tier } from "./data";

/* ------------------------------------------------------------------ */
/* Global SVG gradients (referenced by url(#id) everywhere)            */
/* ------------------------------------------------------------------ */
export function GlobalDefs() {
  const lin = (id: string, stops: [number, string][], x2 = 0, y2 = 1) => (
    <linearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
      {stops.map(([o, c]) => (
        <stop key={o} offset={o} stopColor={c} />
      ))}
    </linearGradient>
  );
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        {lin("g-rim-common", [[0, "#e4e9ef"], [0.5, "#8e98a4"], [1, "#4a525c"]])}
        {lin("g-rim-rare", [[0, "#c6f4ff"], [0.5, "#35bfe6"], [1, "#0b5f86"]])}
        {lin("g-rim-epic", [[0, "#ffc4f2"], [0.5, "#d04bff"], [1, "#5a1a9c"]])}
        {lin("g-rim-legendary", [[0, "#fff6c9"], [0.35, "#ffc43d"], [0.7, "#ff8a1a"], [1, "#8a3600"]])}
        {lin("g-rim-locked", [[0, "#5b524b"], [1, "#2a2420"]])}
        {lin("g-face", [[0, "#2a1d15"], [1, "#0b0706"]])}
        {lin("g-face-locked", [[0, "#1a1512"], [1, "#0a0807"]])}
        <radialGradient id="g-coin" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fff6c9" />
          <stop offset="0.4" stopColor="#ffc43d" />
          <stop offset="1" stopColor="#c45a00" />
        </radialGradient>
        {lin("g-coin-rim", [[0, "#fff0b0"], [1, "#a64600"]])}
      </defs>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Glyphs (24×24 grid)                                                 */
/* ------------------------------------------------------------------ */
export function Glyph({ name }: { name: string }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (name) {
    case "bolt":
      return <path d="M13.5 1.5 4 14h6.5l-1.5 8.5L20 10h-6.5z" fill="currentColor" />;
    case "flame":
      return <path d="M12 1.5c.6 3.8 6 6.4 6 12a6 6 0 0 1-12 0c0-2.2 1-3.8 2.2-5 .3 1.6 1 2.4 2.1 2.8C9.8 8 10.9 4.8 12 1.5z" fill="currentColor" />;
    case "blade":
      return (
        <g {...s}>
          <path d="M21 3 11 13M21 3h-6M21 3v6M8 13l3 3M6.5 17.5 3 21M10 14l-3.5 3.5" />
        </g>
      );
    case "swords":
      return (
        <g {...s}>
          <path d="M4 4l11 11M20 4 9 15M13 17l3 3M11 17l-3 3M4 4h4M20 4h-4" />
        </g>
      );
    case "crown":
      return <path d="M2.5 8 7.5 12 12 4.5 16.5 12 21.5 8 19.5 19.5h-15z" fill="currentColor" />;
    case "skull":
      return (
        <path
          fillRule="evenodd"
          fill="currentColor"
          d="M12 2.5a8.5 8.5 0 0 0-5.5 15V21h3.2v-2h4.6v2h3.2v-3.5A8.5 8.5 0 0 0 12 2.5zM8.6 10.4a1.9 1.9 0 1 0 .01 0zm6.8 0a1.9 1.9 0 1 0 .01 0z"
        />
      );
    case "shield":
      return <path d="M12 1.8 20 5v6.2c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z" fill="currentColor" />;
    case "fist":
      return <path d="M6 11V6.5a2 2 0 0 1 4 0V5a2 2 0 0 1 4 0v1.2a2 2 0 0 1 4 .8v6.5A6.5 6.5 0 0 1 11.5 20H11a6 6 0 0 1-5-2.7z" {...s} fill="currentColor" fillOpacity=".25" />;
    case "star":
      return <path d="M12 1.8 15 8.6l7.2.7-5.4 4.8 1.6 7.2L12 17.6l-6.4 3.7 1.6-7.2-5.4-4.8 7.2-.7z" fill="currentColor" />;
    case "target":
      return (
        <g {...s}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4.8" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
        </g>
      );
    case "robot":
      return (
        <g {...s}>
          <rect x="4.5" y="7.5" width="15" height="11.5" rx="2.5" />
          <path d="M12 7.5V3.5M2.5 12.5v3M21.5 12.5v3M9 16h6" />
          <circle cx="9" cy="12" r="1.3" fill="currentColor" />
          <circle cx="15" cy="12" r="1.3" fill="currentColor" />
        </g>
      );
    case "drop":
      return <path d="M12 2c4.3 5 6.5 8.2 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10.2 7.7 7 12 2z" fill="currentColor" />;
    case "gem":
      return (
        <g {...s}>
          <path d="M6.5 3h11l4 6L12 21 2.5 9z" fill="currentColor" fillOpacity=".25" />
          <path d="M2.5 9h19M9.5 3 8 9l4 12 4-12-1.5-6" />
        </g>
      );
    case "dice":
      return (
        <g {...s}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
          <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" />
          <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" />
          <circle cx="8.5" cy="15.5" r="1.2" fill="currentColor" />
          <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" />
        </g>
      );
    case "lock":
      return (
        <g {...s}>
          <rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor" fillOpacity=".25" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </g>
      );
    case "check":
      return <path d="M4.5 12.5 10 18 20 6.5" {...s} strokeWidth={3} />;
    case "pen":
      return <path d="M4 20l1-4.5L16.5 4a2 2 0 0 1 3 0l.5.5a2 2 0 0 1 0 3L8.5 19zM14 6.5l3.5 3.5" {...s} />;
    case "copy":
      return (
        <g {...s}>
          <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
          <path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
        </g>
      );
    case "x":
      return <path d="M5 5l14 14M19 5 5 19" {...s} strokeWidth={2.4} />;
    case "disk":
      return (
        <g {...s}>
          <path d="M4 4h13l3 3v13H4z" />
          <path d="M8 4v5h7V4M8 20v-6h8v6" />
        </g>
      );
    case "user":
      return (
        <g {...s}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c.7-4.2 4-6 8-6s7.3 1.8 8 6" />
        </g>
      );
    default:
      return <circle cx="12" cy="12" r="8" fill="currentColor" />;
  }
}

export function GlyphIcon({ name, className = "w-5 h-5" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <Glyph name={name} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* AC Coin                                                             */
/* ------------------------------------------------------------------ */
export function Coin({ size = 28, spin = false, className = "" }: { size?: number; spin?: boolean; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      style={spin ? { animation: "bob 2.6s ease-in-out infinite", filter: "drop-shadow(0 0 10px rgba(255,170,40,.75))" } : { filter: "drop-shadow(0 0 4px rgba(255,170,40,.5))" }}
      aria-hidden
    >
      <polygon points="20,1.5 36,10.5 36,29.5 20,38.5 4,29.5 4,10.5" fill="url(#g-coin-rim)" />
      <polygon points="20,5 33,12.2 33,27.8 20,35 7,27.8 7,12.2" fill="url(#g-coin)" />
      <polygon points="20,8.5 30,14 30,26 20,31.5 10,26 10,14" fill="none" stroke="#a24a00" strokeOpacity=".5" strokeWidth="1" />
      <path d="M22.5 9 13 21.5h6l-1.5 9.5L27.5 18.5h-6z" fill="#3a1600" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Logo                                                                */
/* ------------------------------------------------------------------ */
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2 select-none">
      <svg viewBox="0 0 48 48" className={small ? "w-8 h-8" : "w-10 h-10"} aria-hidden>
        <polygon points="24,2 45,40 3,40" fill="none" stroke="url(#g-rim-legendary)" strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M27 13 17 29h7l-2 9 11-17h-7z" fill="url(#g-rim-legendary)" />
      </svg>
      <div className="font-display italic font-bold leading-[0.85] tracking-tight">
        <div className="text-molten text-[19px]">APEX</div>
        <div className="text-[13px] tracking-[0.42em] text-orange-200/90 pl-0.5">CHAOS</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Medal                                                               */
/* ------------------------------------------------------------------ */
const star = (n: number, r1: number, r2: number) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    return `${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`;
  }).join(" ");

const SHAPES: Record<Tier, { outer: string; inner: string; color: string; glyph: string }> = {
  common: {
    outer: "50,4 90,27 90,73 50,96 10,73 10,27",
    inner: "50,13 82,31.5 82,68.5 50,87 18,68.5 18,31.5",
    color: "#b8c0c9",
    glyph: "#e5eaf0",
  },
  rare: {
    outer: "50,2 95,26 95,74 50,98 5,74 5,26",
    inner: "50,14 84,32 84,68 50,86 16,68 16,32",
    color: "#35bfe6",
    glyph: "#a8ecff",
  },
  epic: {
    outer: "50,2 70,12 97,8 88,38 92,68 50,98 8,68 12,38 3,8 30,12",
    inner: "50,15 66,22 84,20 78,42 81,64 50,86 19,64 22,42 16,20 34,22",
    color: "#d04bff",
    glyph: "#ffc4f2",
  },
  legendary: {
    outer: star(14, 49, 40),
    inner: star(14, 35, 31),
    color: "#ffc43d",
    glyph: "#ffe9a0",
  },
};

export function Medal({
  tier,
  glyph,
  unlocked,
  size = 88,
  className = "",
}: {
  tier: Tier;
  glyph: string;
  unlocked: boolean;
  size?: number;
  className?: string;
}) {
  const sh = SHAPES[tier];
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      {unlocked && tier === "legendary" && <div className="medal-aura" />}
      <svg
        viewBox="0 0 100 100"
        className="relative w-full h-full overflow-visible"
        style={{ filter: unlocked ? `drop-shadow(0 0 ${size / 9}px ${sh.color}aa)` : "none" }}
      >
        <polygon points={sh.outer} fill={unlocked ? `url(#g-rim-${tier})` : "url(#g-rim-locked)"} strokeLinejoin="round" stroke={unlocked ? "#fff" : "#000"} strokeOpacity={unlocked ? 0.35 : 0.5} strokeWidth="1" />
        <polygon points={sh.inner} fill={unlocked ? "url(#g-face)" : "url(#g-face-locked)"} />
        {unlocked && <polygon points={sh.inner} fill="none" stroke={sh.color} strokeOpacity=".5" strokeWidth="1" />}
        <g transform="translate(29 29) scale(1.75)" style={{ color: unlocked ? sh.glyph : "#5d544c" }}>
          <Glyph name={unlocked ? glyph : "lock"} />
        </g>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Animated number                                                     */
/* ------------------------------------------------------------------ */
export function AnimatedNumber({ value, delay = 0, duration = 900, className = "" }: { value: number; delay?: number; duration?: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / duration));
      const e = 1 - Math.pow(1 - k, 3);
      const v = Math.round(start + (value - start) * e);
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delay, duration]);
  return <span className={className}>{shown.toLocaleString("vi-VN")}</span>;
}

/* ------------------------------------------------------------------ */
/* Stage background                                                    */
/* ------------------------------------------------------------------ */
export type StageVariant = "missions" | "mastery" | "account";

export function Stage({ variant }: { variant: StageVariant }) {
  const embers = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 2 + Math.random() * 5,
        dur: 8 + Math.random() * 12,
        delay: -Math.random() * 20,
        dx: (Math.random() - 0.5) * 140,
      })),
    [],
  );
  const acc = variant === "account";
  const mas = variant === "mastery";
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-ink" aria-hidden>
      <img
        src={arena}
        alt=""
        className="absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-out"
        style={{
          opacity: acc ? 0.5 : mas ? 0.34 : 0.78,
          filter: acc ? "blur(7px) brightness(.55) saturate(1.2)" : mas ? "blur(3px) brightness(.7) saturate(1.1)" : "brightness(.78) saturate(1.1)",
          transform: acc ? "scale(1.12)" : mas ? "scale(1.06) translateX(2%)" : "scale(1)",
        }}
      />
      <div className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: acc ? 1 : 0, background: "radial-gradient(ellipse at 75% 40%, rgba(255,150,30,.25), transparent 55%)" }} />
      <div className={`absolute inset-0 hexgrid transition-opacity duration-1000 ${acc ? "opacity-100" : "opacity-0"}`} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 20%, transparent 0%, rgba(7,5,10,.55) 70%, rgba(7,5,10,.92) 100%), linear-gradient(180deg, rgba(7,5,10,.5) 0%, rgba(7,5,10,.1) 30%, rgba(7,5,10,.85) 100%)" }} />
      <div className="absolute inset-0 scan opacity-60" />
      {embers.map((e) => (
        <span
          key={e.id}
          className="ember"
          style={{ left: `${e.left}%`, width: e.size, height: e.size, animationDuration: `${e.dur}s`, animationDelay: `${e.delay}s`, ["--dx" as string]: `${e.dx}px` }}
        />
      ))}
      <div className="absolute inset-0 grain" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented energy bar                                                */
/* ------------------------------------------------------------------ */
export function EnergyBar({ value, max, cells, color = "#ffb21f", height = 14, glow = true }: { value: number; max: number; cells?: number; color?: string; height?: number; glow?: boolean }) {
  const n = cells ?? Math.min(max, 10);
  const filled = (value / max) * n;
  return (
    <div className="flex gap-[3px] w-full" style={{ height }} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      {Array.from({ length: n }, (_, i) => {
        const f = Math.max(0, Math.min(1, filled - i));
        return (
          <div key={i} className="relative flex-1 bg-white/10 overflow-hidden" style={{ clipPath: "polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)" }}>
            <div
              className="absolute inset-y-0 left-0 transition-[width] duration-700 ease-out"
              style={{ width: `${f * 100}%`, background: `linear-gradient(180deg, #fff3c4, ${color} 55%, #ff6a1a)`, boxShadow: glow && f > 0 ? `0 0 12px ${color}` : "none" }}
            />
          </div>
        );
      })}
    </div>
  );
}

export const fmt = (n: number) => n.toLocaleString("vi-VN");
