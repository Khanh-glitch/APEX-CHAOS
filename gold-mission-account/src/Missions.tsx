import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { MISSIONS, type Mission } from "./data";
import { missionProgress, missionStatus, type Game, type MissionStatus } from "./store";
import { Coin, EnergyBar, Glyph, GlyphIcon, fmt } from "./ui";
import { useFx } from "./fx";
import { tr } from "./locale";

const statusLabel = (g: Game, s: MissionStatus) => tr(g.lang, `status.${s}`);
const OFFSETS = ["ml-0", "ml-[9%]", "ml-[2%]", "ml-[12%]", "ml-[5%]"];

function centerOf(e: MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/* ---------------- Node (hex shard with progress ring) ---------------- */
function Node({ m, status, progress }: { m: Mission; status: MissionStatus; progress: number }) {
  const pct = (progress / m.target) * 100;
  const ready = status === "ready";
  const claimed = status === "claimed";
  const stroke = claimed ? "#a67a2c" : ready ? "#fff3c4" : "#ffb21f";
  return (
    <div className="relative w-[76px] h-[88px] sm:w-[88px] sm:h-[102px] shrink-0">
      {ready && <div className="absolute -inset-3 rounded-full bg-amber-400/40 blur-xl" style={{ animation: "pulse-glow 1.4s ease-in-out infinite" }} />}
      <svg viewBox="0 0 100 114" className="absolute inset-0 w-full h-full overflow-visible" style={{ filter: ready ? "drop-shadow(0 0 10px rgba(255,200,80,.9))" : claimed ? "none" : "drop-shadow(0 0 5px rgba(255,140,30,.45))" }}>
        <polygon points="50,3 96,29 96,85 50,111 4,85 4,29" fill={claimed ? "#150f0a" : "#1a0f08"} stroke="#3b2717" strokeWidth="5" strokeLinejoin="round" />
        <polygon
          points="50,3 96,29 96,85 50,111 4,85 4,29"
          fill="none"
          stroke={stroke}
          strokeWidth="5"
          strokeLinejoin="round"
          pathLength={100}
          strokeDasharray={`${Math.max(pct, 0)} 100`}
          style={{ transition: "stroke-dasharray .8s ease" }}
        />
        <polygon points="50,16 84,35 84,79 50,98 16,79 16,35" fill={ready ? "url(#g-coin)" : "none"} fillOpacity={ready ? 0.22 : 0} stroke="#ffffff" strokeOpacity=".06" />
      </svg>
      <div className={`absolute inset-0 grid place-items-center ${claimed ? "text-amber-700/70" : ready ? "text-amber-100" : "text-orange-300"}`}>
        <svg viewBox="0 0 24 24" className="w-9 h-9 sm:w-10 sm:h-10" style={ready ? { animation: "bob 1.6s ease-in-out infinite" } : undefined}>
          <Glyph name={m.glyph} />
        </svg>
      </div>
      {claimed && (
        <div className="absolute -right-1 -top-1 w-7 h-7 hex bg-gold grid place-items-center text-[#2a1000]">
          <GlyphIcon name="check" className="w-4 h-4" />
        </div>
      )}
      {ready && <div className="absolute -right-1 -top-1 w-7 h-7 hex bg-white grid place-items-center text-[#c24a00] font-display font-bold text-sm" style={{ animation: "pulse-glow 1s infinite" }}>!</div>}
    </div>
  );
}

/* ---------------- Detail console ---------------- */
function MissionDetail({ m, g, onClaim }: { m: Mission; g: Game; onClaim: (ids: string[], e: MouseEvent<HTMLElement>) => void }) {
  const status = missionStatus(g.s, m);
  const progress = missionProgress(g.s, m);
  const remaining = m.target - progress;
  return (
    <div key={m.id} className="cut-lg p-[2px] anim-fade-in" style={{ background: "linear-gradient(135deg,#ffd36a,#ff6a1a 45%,rgba(255,106,26,.1))" }}>
      <div className="cut-lg relative overflow-hidden bg-[#0d0806]/95 backdrop-blur-xl p-5 sm:p-7">
        <div className="absolute -right-10 -top-10 w-64 h-64 text-orange-500/10 pointer-events-none" style={{ animation: "spin-slow 40s linear infinite" }}>
          <svg viewBox="0 0 24 24" className="w-full h-full">
            <Glyph name={m.glyph} />
          </svg>
        </div>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 85% 0%, rgba(255,120,20,.28), transparent 55%)" }} />

        <div className="relative flex flex-wrap items-center gap-2 mb-4">
          <span className="slant font-display font-bold text-xs tracking-widest px-4 py-1 bg-orange-500 text-black">{m.mode === "LOCAL" && g.lang === "vie" ? "CÙNG MÁY" : m.mode}</span>
          <span
            className={`slant font-display font-bold text-xs tracking-widest px-4 py-1 ${
              status === "ready" ? "bg-white text-[#b53d00]" : status === "claimed" ? "bg-white/10 text-amber-200/70" : "bg-amber-400/15 text-amber-300"
            }`}
          >
            {statusLabel(g,status)}
          </span>
        </div>

        <p className="relative font-display text-xs tracking-[.35em] text-amber/90 uppercase">{m.flavor}</p>
        <h3 className="relative font-display italic font-bold text-3xl sm:text-4xl leading-[1.05] mt-1 text-white break-words">{m.title}</h3>
        <p className="relative text-[15px] text-orange-100/70 mt-3 max-w-prose">{m.hint}</p>

        <div className="relative mt-6">
          <div className="flex items-end justify-between mb-2">
            <span className="font-display text-xs tracking-[.3em] text-orange-200/60">{tr(g.lang,"progress")}</span>
            <span className="font-display font-bold text-2xl leading-none">
              <span className={status === "active" ? "text-gold" : "text-white"}>{progress}</span>
              <span className="text-white/40"> / {m.target}</span>
            </span>
          </div>
          <EnergyBar value={progress} max={m.target} height={20} />
        </div>

        <div className="relative mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="flex items-center gap-3">
            <Coin size={54} spin={status !== "claimed"} />
            <div>
              <div className="font-display text-[11px] tracking-[.3em] text-orange-200/60">{tr(g.lang,"reward")}</div>
              <div className="font-display italic font-bold text-4xl leading-none text-molten">
                +{fmt(m.reward)} <span className="text-xl">AC</span>
              </div>
            </div>
          </div>

          <button
            disabled={status !== "ready"}
            onClick={(e) => onClaim([m.id], e)}
            className={`gold-mission-claim-button relative cut-sm font-display font-bold italic tracking-wider text-base sm:text-lg px-4 sm:px-6 py-3.5 flex-1 min-w-[190px] ${
              status === "ready" ? "btn-claim shine" : "bg-white/8 text-white/45 border border-white/10"
            }`}
          >
            {status === "ready" ? tr(g.lang,"claim") : status === "claimed" ? tr(g.lang,"claimed") : `${tr(g.lang,"remaining")} ${remaining} ${tr(g.lang,m.metric === "botWon" ? "wins" : "matches")}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Main view ---------------- */
export function Contracts({ g }: { g: Game }) {
  const fx = useFx();
  const [sel, setSel] = useState(() => {
    const ready = MISSIONS.find((m) => missionStatus(g.s, m) === "ready");
    return (ready ?? MISSIONS[0])?.id || "";
  });
  const wrap = useRef<HTMLDivElement>(null);
  const nodes = useRef<(HTMLDivElement | null)[]>([]);
  const [pts, setPts] = useState<{ x: number; y: number }[]>([]);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const w = wrap.current;
      if (!w) return;
      const wr = w.getBoundingClientRect();
      setBox({ w: wr.width, h: wr.height });
      setPts(
        nodes.current.map((n) => {
          const r = n!.getBoundingClientRect();
          return { x: r.left - wr.left + r.width / 2, y: r.top - wr.top + r.height / 2 };
        }),
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const current = MISSIONS.find((m) => m.id === sel) || MISSIONS[0];
  const ready = MISSIONS.filter((m) => missionStatus(g.s, m) === "ready");
  const readyTotal = ready.reduce((a, m) => a + m.reward, 0);
  const total = MISSIONS.reduce((a, m) => a + m.reward, 0);
  const claimedTotal = MISSIONS.filter((m) => g.s.claimed.includes(m.id)).reduce((a, m) => a + m.reward, 0);
  const doneCount = MISSIONS.filter((m) => missionStatus(g.s, m) !== "active").length;

  const onClaim = (ids: string[], e: MouseEvent<HTMLElement>) => {
    const { x, y } = centerOf(e);
    const amount = g.claim(ids);
    if (amount > 0) fx.burst(amount, x, y);
  };



  if (!MISSIONS.length) return <div className="mt-8 cut-lg bg-black/65 border border-gold/40 p-8" role="status">{tr(g.lang,"missions.empty")}</div>;
  return (
    <div>
      {/* Charge strip */}
      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4 cut bg-black/55 backdrop-blur-md border-l-4 border-gold px-5 py-4">
        <div>
          <div className="font-display text-[11px] tracking-[.35em] text-orange-200/60">{tr(g.lang,"claimable")}</div>
          <div className="flex items-center gap-2 font-display italic font-bold text-3xl leading-none mt-1">
            <Coin size={30} />
            <span className={readyTotal > 0 ? "text-molten" : "text-white/40"}>{fmt(readyTotal)} AC</span>
          </div>
        </div>
        <div className="flex-1 min-w-[180px]">
          <div className="flex justify-between font-display text-[11px] tracking-[.25em] text-orange-200/60 mb-1.5">
            <span>
              {tr(g.lang,"completed")} {doneCount}/{MISSIONS.length}
            </span>
            <span>
              {fmt(claimedTotal)} / {fmt(total)} AC
            </span>
          </div>
          <EnergyBar value={claimedTotal + readyTotal} max={total} cells={MISSIONS.length * 3} height={10} />
        </div>
        <button
          disabled={ready.length === 0}
          onClick={(e) => onClaim(ready.map((m) => m.id), e)}
          className={`cut-sm font-display font-bold italic tracking-wider px-6 py-3 ${ready.length ? "btn-claim shine" : "bg-white/8 text-white/40 border border-white/10"}`}
        >
          {tr(g.lang,"claim.all")} {ready.length > 0 && `(${ready.length})`}
        </button>
      </div>

      <div className="mt-8 grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-8 lg:gap-12 items-start">
        {/* Path */}
        <div ref={wrap} className="relative">
          <svg className="absolute inset-0 pointer-events-none overflow-visible" width={box.w} height={box.h}>
            {pts.length === MISSIONS.length &&
              pts.slice(0, -1).map((p, i) => {
                const q = pts[i + 1];
                const my = (p.y + q.y) / 2;
                const d = `M${p.x},${p.y} C${p.x},${my} ${q.x},${my} ${q.x},${q.y}`;
                const lit = missionStatus(g.s, MISSIONS[i]) !== "active";
                return (
                  <g key={i}>
                    <path d={d} fill="none" stroke="#3b2717" strokeWidth="6" strokeLinecap="round" />
                    <path d={d} fill="none" stroke={lit ? "#ffb21f" : "#6a4a2c"} strokeWidth={lit ? 3 : 2} strokeDasharray="6 8" strokeLinecap="round" style={{ animation: lit ? "dash-flow 0.9s linear infinite" : undefined, filter: lit ? "drop-shadow(0 0 6px #ff8a2a)" : undefined }} />
                  </g>
                );
              })}
          </svg>

          <ol className="relative flex flex-col gap-5 sm:gap-7">
            {MISSIONS.map((m, i) => {
              const status = missionStatus(g.s, m);
              const progress = missionProgress(g.s, m);
              const selected = sel === m.id;
              return (
                <li key={m.id} className="anim-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
                  <div className={OFFSETS[i]}>
                  <button
                    onClick={() => setSel(m.id)}
                    aria-pressed={selected}
                    className={`group relative w-full text-left flex items-center gap-3 sm:gap-5 p-2 pr-4 transition-all duration-300 slant-r ${
                      selected ? "bg-gradient-to-r from-orange-600/45 via-black/75 to-black/70 backdrop-blur-md" : "bg-black/50 backdrop-blur-sm hover:bg-black/70 hover:translate-x-1"
                    }`}
                  >
                    <div ref={(el) => { nodes.current[i] = el; }} className="shrink-0 transition-transform duration-300 group-hover:scale-105">
                      <Node m={m} status={status} progress={progress} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-display font-bold text-[10px] tracking-widest px-2 py-[1px] bg-orange-500 text-black slant">{m.mode === "LOCAL" && g.lang === "vie" ? "CÙNG MÁY" : m.mode}</span>
                        <span className={`font-display text-[10px] tracking-[.2em] ${status === "ready" ? "text-white" : status === "claimed" ? "text-amber-200/50" : "text-amber-300/80"}`}>{statusLabel(g,status)}</span>
                      </div>
                      <div className={`font-display font-bold text-lg sm:text-xl leading-tight break-words ${status === "claimed" ? "text-white/50 line-through decoration-amber-500/50" : "text-white"}`}>{m.title}</div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex-1 max-w-[220px]">
                          <EnergyBar value={progress} max={m.target} height={7} glow={false} />
                        </div>
                        <span className="font-display text-xs text-orange-200/70 tabular-nums">
                          {progress}/{m.target}
                        </span>
                      </div>
                    </div>
                    <div className={`flex flex-col items-center shrink-0 ${status === "claimed" ? "opacity-40" : ""}`}>
                      <Coin size={26} />
                      <span className="font-display font-bold text-sm text-gold mt-0.5">+{m.reward}</span>
                    </div>
                  </button>
                  </div>
                  {selected && (
                    <div className="lg:hidden mt-3">
                      <MissionDetail m={m} g={g} onClaim={onClaim} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {/* Desktop console */}
        <div className="hidden lg:block sticky top-24">
          {current && <MissionDetail m={current} g={g} onClaim={onClaim} />}
        </div>
      </div>

      {/* Prototype demo controls intentionally removed. Gold production progress
          is driven only by the host's sealed match-result wallet authority. */}
    </div>
  );
}
