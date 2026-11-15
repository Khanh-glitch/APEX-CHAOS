import { useMemo, useState, type MouseEvent } from "react";
import { FIGHTERS, fighterById } from "./data";
import type { Game } from "./store";
import { AnimatedNumber, Coin, GlyphIcon, fmt } from "./ui";
import { useFx } from "./fx";
import { tr } from "./locale";

const NAME_RE = /^[\p{L}\p{N} _]+$/u;

function Wheel({ spin }: { spin: number }) {
  const n = 8;
  const seg = (i: number) => {
    const a0 = ((i * 360) / n - 90) * (Math.PI / 180);
    const a1 = (((i + 1) * 360) / n - 90) * (Math.PI / 180);
    const p = (a: number) => `${50 + Math.cos(a) * 46},${50 + Math.sin(a) * 46}`;
    return `M50,50 L${p(a0)} A46,46 0 0 1 ${p(a1)}Z`;
  };
  const cols = ["#ffb21f", "#2a1a10", "#ff6a1a", "#1a0f09", "#ffd36a", "#2a1a10", "#e8480a", "#1a0f09"];
  return (
    <div className="relative w-[104px] h-[104px] shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full" style={{ transform: `rotate(${spin}deg)`, transition: "transform 3.2s cubic-bezier(.12,.7,.1,1)", filter: "drop-shadow(0 0 12px rgba(255,150,30,.5))" }}>
        {cols.map((c, i) => (
          <path key={i} d={seg(i)} fill={c} stroke="#07050a" strokeWidth="1" />
        ))}
        <circle cx="50" cy="50" r="46" fill="none" stroke="url(#g-rim-legendary)" strokeWidth="3" />
        <circle cx="50" cy="50" r="9" fill="url(#g-coin)" stroke="#3a1600" strokeWidth="1.5" />
      </svg>
      <div className="absolute left-1/2 -top-2 -translate-x-1/2 w-0 h-0 border-x-[7px] border-x-transparent border-t-[14px] border-t-white drop-shadow" />
    </div>
  );
}

export function Account({ g }: { g: Game }) {
  const fx = useFx();
  const { s } = g;
  const t=(key:string)=>tr(g.lang,key);
  const fighter = fighterById(s.avatar);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(s.name);
  const [err, setErr] = useState("");
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 50, my: 30 });
  const [spin, setSpin] = useState(0);
  const [shake, setShake] = useState(0);

  const bars = useMemo(() => Array.from(s.playerId).flatMap((c, i) => [(c.charCodeAt(0) % 3) + 1, ((c.charCodeAt(0) + i) % 2) + 1]), [s.playerId]);

  const startEdit = () => {
    setDraft(s.name);
    setErr("");
    setEditing(true);
  };
  const commit = () => {
    const v = draft.trim().replace(/\s+/g, " ");
    if (v.length < 3 || v.length > 16) return setErr(t("name.length"));
    if (!NAME_RE.test(v)) return setErr(t("name.characters"));
    if (v === s.name) return setEditing(false);
    g.patch({ name: v });
    setEditing(false);
    fx.toast(`${t("name.changed")} “${v}”`);
  };

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({ ry: (px - 0.5) * 12, rx: (0.5 - py) * 9, mx: px * 100, my: py * 100 });
  };

  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      fx.toast(msg);
    } catch {
      fx.toast(t("copy.denied"), "warn");
    }
  };
  const backup = () => copy(s.playerId, t("copy.id.warning"));

  

  return (
    <div className="relative">
      {/* Giant fighter portrait */}
      <div className="gold-account-hero-art hidden lg:block absolute -right-16 -top-10 w-[60%] h-[760px] pointer-events-none" style={{ WebkitMaskImage: "linear-gradient(90deg,transparent,#000 40%), linear-gradient(180deg,#000 55%,transparent)", WebkitMaskComposite: "source-in", maskComposite: "intersect", maskImage: "linear-gradient(90deg,transparent,#000 40%), linear-gradient(180deg,#000 55%,transparent)" }}>
        <img key={fighter.id} src={fighter.img} alt="" className="w-full h-full object-cover anim-fade-in" style={{ objectPosition: fighter.pos, opacity: 0.8 }} />
      </div>

      <div className="relative mt-6 grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-8 lg:gap-12 items-start">
        {/* LEFT: license + avatar */}
        <div className="min-w-0 max-w-full">
          <div style={{ perspective: 1100 }}>
            <div
              onMouseMove={onMove}
              onMouseLeave={() => setTilt({ rx: 0, ry: 0, mx: 50, my: 30 })}
              className="gold-account-license w-full min-w-0 max-w-full cut-lg p-[2px] transition-transform duration-200 ease-out"
              style={{ background: "linear-gradient(135deg,#fff0b0,#ffa31a 30%,#ff5a0a 60%,#5a2000)", transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`, boxShadow: "0 30px 80px -20px rgba(255,120,20,.45)" }}
            >
              <div className="cut-lg relative min-w-0 overflow-hidden p-5 sm:p-8" style={{ background: "linear-gradient(135deg,#1c100a 0%,#0a0605 70%)" }}>
                <div className="absolute inset-0 hexgrid opacity-60 pointer-events-none" />
                <div className="absolute inset-0 pointer-events-none mix-blend-screen" style={{ background: `radial-gradient(circle at ${tilt.mx}% ${tilt.my}%, rgba(255,214,120,.38), transparent 45%), conic-gradient(from ${tilt.mx * 3}deg at 50% 50%, rgba(255,90,10,.14), rgba(255,220,100,.12), rgba(255,90,10,.14))` }} />

                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-[11px] tracking-[.4em] text-amber">APEX CHAOS</p>
                    <p className="font-display font-bold text-sm tracking-[.25em] text-white/80">{t("pilot.license")}</p>
                  </div>
                  <div className="gold-account-guest-badge shrink-0 font-display font-bold tracking-[.17em] sm:tracking-[.3em] text-xs sm:text-sm text-orange-400 border-2 border-orange-500/80 px-3 py-1 -rotate-6" style={{ boxShadow: "0 0 14px rgba(255,100,20,.35) inset" }}>
                    {t("guest")}
                  </div>
                </div>

                <div className="relative mt-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  <div className="relative w-[170px] h-[190px] shrink-0">
                    <svg viewBox="0 0 100 114" className="absolute -inset-3 w-[calc(100%+24px)] h-[calc(100%+24px)] overflow-visible" style={{ animation: "spin-slow 40s linear infinite" }}>
                      <circle cx="50" cy="57" r="62" fill="none" stroke="#ffb21f" strokeOpacity=".55" strokeDasharray="3 7" />
                    </svg>
                    <div className="absolute inset-0 hex p-[4px]" style={{ background: `linear-gradient(160deg,#fff0b0,${fighter.color} 55%,#ff5a0a)` }}>
                      <div className="w-full h-full hex overflow-hidden bg-black">
                        <img key={fighter.id} src={fighter.img} alt={fighter.name} className="w-full h-full object-cover anim-fade-in" style={{ objectPosition: fighter.pos }} />
                      </div>
                    </div>
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 slant font-display font-bold text-[11px] tracking-[.2em] px-3 py-1 text-black whitespace-nowrap" style={{ background: fighter.color }}>
                      {fighter.name}
                    </div>
                  </div>

                  <div className="min-w-0 w-full flex-1 text-center sm:text-left">
                    <p className="font-display text-[11px] tracking-[.35em] text-orange-200/60">{t("display.name")}</p>
                    {!editing ? (
                      <div className="flex items-start justify-center sm:justify-start gap-3 mt-1">
                        <h2 className="font-display italic font-bold text-4xl sm:text-5xl leading-[1.05] break-all text-white" style={{ textShadow: "0 0 30px rgba(255,150,30,.35)" }}>
                          {s.name}
                        </h2>
                        <button onClick={startEdit} aria-label={t("rename")} title={t("rename")} className="mt-1 shrink-0 w-10 h-10 hex bg-gold text-black grid place-items-center hover:scale-110 transition">
                          <GlyphIcon name="pen" className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 anim-fade-in">
                        <div className="flex items-stretch gap-2">
                          <input
                            autoFocus
                            value={draft}
                            maxLength={16}
                            onChange={(e) => {
                              setDraft(e.target.value);
                              setErr("");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commit();
                              if (e.key === "Escape") setEditing(false);
                            }}
                            className="min-w-0 flex-1 cut-sm bg-black/60 border-2 border-gold/80 focus:border-white outline-none px-4 py-2.5 font-display font-bold text-2xl text-white"
                            aria-label={t("new.name")}
                          />
                          <button onClick={commit} aria-label={t("save.name")} className="w-12 cut-sm btn-claim grid place-items-center">
                            <GlyphIcon name="check" className="w-5 h-5" />
                          </button>
                          <button onClick={() => setEditing(false)} aria-label={t("cancel")} className="w-12 cut-sm bg-white/10 hover:bg-white/20 grid place-items-center">
                            <GlyphIcon name="x" className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex justify-between mt-1.5 text-xs">
                          <span className={err ? "text-red-400 font-semibold" : "text-orange-100/60"}>{err || t("name.hint")}</span>
                          <span className="text-white/50 tabular-nums">{draft.length}/16</span>
                        </div>
                      </div>
                    )}

                    <p className="font-display text-[11px] tracking-[.35em] text-orange-200/60 mt-5">{t("player.id")}</p>
                    <button onClick={() => copy(s.playerId, t("copy.id"))} className="gold-player-id group mt-1 flex w-full max-w-full min-w-0 items-start gap-2 text-left font-display font-bold text-sm sm:text-xl tracking-[.015em] sm:tracking-[.06em] text-gold hover:text-white transition">
                      <span className="gold-player-id-value block min-w-0 flex-1 break-all">{s.playerId}</span>
                      <GlyphIcon name="copy" className="mt-0.5 w-4 h-4 shrink-0 opacity-60 group-hover:opacity-100" />
                    </button>
                  </div>
                </div>

                <div className="relative mt-8 flex min-w-0 items-end justify-between gap-3 sm:gap-4">
                  <div className="flex min-w-0 max-w-[54%] flex-1 items-end gap-[2px] h-9 opacity-80 overflow-hidden">
                    {bars.map((w, i) => (
                      <span key={i} className="bg-amber-200/80 h-full" style={{ width: w * 1.5 }} />
                    ))}
                  </div>
                  <span className="min-w-0 flex-1 font-display text-[9px] sm:text-[10px] tracking-[.1em] sm:tracking-[.3em] leading-snug text-white/40 text-right break-words">{t("local.account")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Avatar picker */}
          <div className="mt-8">
            <p className="font-display text-xs tracking-[.4em] text-amber mb-3">{t("avatar.choose")}</p>
            <div className="flex flex-wrap gap-2.5 sm:gap-3">
              {FIGHTERS.map((f) => {
                const on = f.id === s.avatar;
                return (
                  <button key={f.id} onClick={() => f.owned && g.patch({ avatar: f.id })} disabled={!f.owned} aria-pressed={on} aria-label={f.name} title={f.name} className={`relative w-[62px] h-[70px] sm:w-[72px] sm:h-[82px] hex p-[3px] transition-all ${on ? "scale-110" : "opacity-70 hover:opacity-100 hover:scale-105"}`} style={{ background: on ? `linear-gradient(160deg,#fff0b0,${f.color})` : "#3a2f28" }}>
                    <div className="w-full h-full hex overflow-hidden bg-black">
                      <img src={f.img} alt="" className="w-full h-full object-cover" style={{ objectPosition: f.pos }} />
                    </div>
                  </button>
                );
              })}
              {[0, 1].map((i) => (
                <div key={i} className="w-[62px] h-[70px] sm:w-[72px] sm:h-[82px] hex grid place-items-center bg-white/5 text-white/25" title={t("not.owned")}>
                  <GlyphIcon name="lock" className="w-5 h-5" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: stats, save, guest */}
        <div className="space-y-5">
          {/* AC */}
          <div className="relative cut-lg p-[2px]" style={{ background: "linear-gradient(135deg,#ffd36a,#ff6a1a 50%,transparent)" }}>
            <div className="relative cut-lg overflow-hidden bg-[#0d0806]/92 backdrop-blur-md p-5 sm:p-6 flex items-center gap-5">
              <div className="absolute -left-10 top-1/2 -translate-y-1/2 w-56 h-56 pointer-events-none" style={{ background: "conic-gradient(from 0deg, transparent, rgba(255,190,60,.35), transparent 25%, rgba(255,120,20,.3), transparent 50%, rgba(255,190,60,.35), transparent 75%)", WebkitMaskImage: "radial-gradient(circle,#000 20%,transparent 68%)", maskImage: "radial-gradient(circle,#000 20%,transparent 68%)", animation: "spin-slow 12s linear infinite" }} />
              <div className="relative">
                <Coin size={84} spin />
              </div>
              <div className="relative min-w-0">
                <p className="font-display text-[11px] tracking-[.35em] text-orange-200/60">{t("ac.balance")}</p>
                <div className="font-display italic font-bold text-5xl sm:text-6xl leading-none text-molten mt-1">
                  <AnimatedNumber value={s.ac} delay={0} /> <span className="text-2xl">AC</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {/* Fighters owned */}
            <div className="cut bg-black/60 backdrop-blur-md border-l-4 border-gold p-5">
              <p className="font-display text-[11px] tracking-[.3em] text-orange-200/60">{t("fighters.owned")}</p>
              <div className="flex items-center justify-between gap-3 mt-2">
                <div className="font-display italic font-bold text-5xl leading-none text-white">{FIGHTERS.filter(f => f.owned).length}</div>
                <div className="flex pl-4">
                  {FIGHTERS.filter(f => f.owned).map((f, i) => (
                    <div key={f.id} className="w-10 h-11 hex p-[2px] -ml-4 transition-transform hover:-translate-y-1" style={{ background: f.color, zIndex: 10 - i }}>
                      <div className="w-full h-full hex overflow-hidden bg-black">
                        <img src={f.img} alt={f.name} className="w-full h-full object-cover" style={{ objectPosition: f.pos }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Lucky draw */}
            <button onClick={() => setSpin((v) => v + 720 + Math.round(Math.random() * 360))} className="text-left cut bg-black/60 backdrop-blur-md border-l-4 border-gold p-5 group" aria-label={t("wheel.demo")}>
              <p className="font-display text-[11px] tracking-[.3em] text-orange-200/60">{t("lucky.spins")}</p>
              <div className="flex items-center justify-between gap-3 mt-2">
                <div className="font-display italic font-bold text-5xl leading-none text-white">{fmt(s.lucky)}</div>
                <Wheel spin={spin} />
              </div>
            </button>
          </div>

          {/* Save status */}
          <div className="cut bg-black/65 backdrop-blur-md p-5">
            <div className="flex items-start gap-4">
              <div className="relative mt-1 shrink-0">
                <span className={`block w-4 h-4 rounded-full ${!g.persisted ? "bg-red-500" : g.syncing ? "bg-amber-400" : "bg-emerald-400"}`} style={{ boxShadow: `0 0 14px ${!g.persisted ? "#ef4444" : g.syncing ? "#fbbf24" : "#34d399"}`, animation: g.syncing ? "pulse-glow .5s infinite" : "pulse-glow 2.4s infinite" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold tracking-[.2em] text-sm">{t(!g.persisted ? "storage.failed" : g.syncing ? "storage.sync" : "storage.saved")}</p>
                <p className="text-sm text-orange-100/65 mt-0.5">{t("storage.note")}</p>
                <div className="relative h-1.5 bg-white/10 mt-3 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-gold" style={{ transform: g.syncing ? undefined : "translateX(0)", animation: g.syncing ? "sync .9s ease-in-out" : undefined }} />
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => { g.saveNow(); fx.toast(t("storage.checked")); }} className="cut-sm btn-claim font-display font-bold tracking-wider text-sm px-5 py-2.5 inline-flex items-center gap-2">
                <GlyphIcon name="disk" className="w-4 h-4" /> {t("storage.check")}
              </button>
              <button onClick={backup} className="cut-sm bg-white/10 hover:bg-white/20 transition font-display font-bold tracking-wider text-sm px-5 py-2.5 inline-flex items-center gap-2">
                <GlyphIcon name="copy" className="w-4 h-4" /> {t("player.id.copy")}
              </button>
            </div>
          </div>

          {/* Guest note */}
          <div key={shake} className={`relative cut overflow-hidden ${shake ? "anim-shake" : ""}`}>
            <div className="hazard h-1.5" />
            <div className="bg-[#1a0d06]/90 backdrop-blur-md p-5">
              <div className="flex items-start gap-3">
                <GlyphIcon name="user" className="w-6 h-6 text-gold shrink-0 mt-0.5" />
                <div>
                  <p className="font-display font-bold tracking-[.2em] text-sm text-gold">{t("guest.account")}</p>
                  <p className="text-[15px] text-orange-50/85 mt-1">{t("guest.warning")}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShake((v) => v + 1);
                  fx.toast(t("online.unavailable"), "warn");
                }}
                className="mt-4 w-full cut-sm break-words px-3 border border-white/15 bg-white/5 text-white/55 font-display font-bold tracking-[.2em] text-sm py-3 inline-flex items-center justify-center gap-2 hover:bg-white/10"
              >
                <GlyphIcon name="lock" className="w-4 h-4" /> {t("online.soon")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
