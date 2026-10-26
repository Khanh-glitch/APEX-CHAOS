import { useEffect, useState } from "react";
import { ACHIEVEMENTS, FIGHTERS, MILESTONE_RANKS, SKIN_FILTERS, TIERS, fighterById, isDone, type Achievement, type Fighter, type Tier } from "./data";
import { EnergyBar, GlyphIcon, Medal, fmt } from "./ui";
import { tr, type Language } from "./locale";
const tierName=(lang:Language,tier:Tier)=>tr(lang,`tier.${tier}`);

const TIER_SIZE: Record<Tier, number> = { legendary: 112, epic: 94, rare: 84, common: 76 };

/* ---------------- Summary ---------------- */
function Summary({lang}:{lang:Language}) {
  const done = ACHIEVEMENTS.filter(isDone).length;
  const total = ACHIEVEMENTS.length;
  const C = 2 * Math.PI * 70;
  return (
    <section className="mt-6 grid md:grid-cols-[auto_1fr] gap-6 md:gap-10 items-center cut-lg bg-black/55 backdrop-blur-md p-5 sm:p-8 relative overflow-hidden">
      <div className="absolute -left-20 -top-20 w-80 h-80 rounded-full bg-orange-500/20 blur-3xl pointer-events-none" />
      <div className="relative mx-auto w-[190px] h-[190px] sm:w-[210px] sm:h-[210px]">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
          <circle cx="80" cy="80" r="70" fill="none" stroke="#2c1d12" strokeWidth="12" />
          <circle cx="80" cy="80" r="70" fill="none" stroke="#ffb21f" strokeWidth="12" strokeLinecap="butt" strokeDasharray={`${(done / Math.max(1,total)) * C} ${C}`} style={{ filter: "drop-shadow(0 0 8px #ff8a2a)", transition: "stroke-dasharray 1s ease" }} />
          <circle cx="80" cy="80" r="56" fill="none" stroke="#ffb21f" strokeOpacity=".25" strokeDasharray="2 6" style={{ transformOrigin: "80px 80px", animation: "spin-slow 30s linear infinite" }} />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="font-display italic font-bold text-6xl leading-none text-molten">{done}</div>
            <div className="font-display text-sm tracking-[.3em] text-orange-200/70 mt-1">/ {total} {tr(lang,"achievements")}</div>
          </div>
        </div>
      </div>

      <div className="relative min-w-0">
        <p className="font-display text-xs tracking-[.4em] text-amber">{tr(lang,"medal.collection")}</p>
        <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
          {TIERS.slice()
            .reverse()
            .map((t) => {
              const all = ACHIEVEMENTS.filter((a) => a.tier === t.id);
              const d = all.filter(isDone).length;
              const sample = all[0];
              return (
                <li key={t.id} className="flex items-center gap-3 min-w-0">
                  <Medal tier={t.id} glyph={sample?.glyph || "star"} unlocked size={46} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between font-display text-sm font-bold" style={{ color: t.color }}>
                      <span className="truncate">{tierName(lang,t.id)}</span>
                      <span className="tabular-nums text-white/80">
                        {d}/{all.length}
                      </span>
                    </div>
                    <EnergyBar value={d} max={all.length} cells={Math.min(all.length, 9)} height={6} color={t.color} glow={false} />
                  </div>
                </li>
              );
            })}
        </ul>
        <div className="mt-5 flex items-start gap-3 bg-amber-400/10 border-l-4 border-gold px-4 py-3 text-[15px] text-amber-100/90">
          <GlyphIcon name="star" className="w-5 h-5 shrink-0 mt-0.5 text-gold" />
          <p>
            {tr(lang,"medal.info.1")} <b className="text-white">{tr(lang,"medal.info.2")}</b>. <b className="text-white">{tr(lang,"medal.info.3")}</b> {tr(lang,"medal.info.4")}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Fighter slat ---------------- */
function Slat({ f, active, onSelect, lang }: { f: Fighter; active: boolean; onSelect: () => void; lang:Language }) {
  const [preview, setPreview] = useState<number | null>(null);
  useEffect(() => {
    if (!active) setPreview(null);
  }, [active]);
  const next = undefined;
  const shown = preview ?? -1;
  const winRate = 0;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={active}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect())}
      className={`relative slat overflow-hidden shrink-0 bg-black lg:-ml-9 lg:first:ml-0 transition-[flex-grow,height] duration-700 ease-[cubic-bezier(.2,.8,.2,1)] ${
        active ? "h-[690px] sm:h-[640px] lg:h-[600px] lg:flex-[6]" : "h-[84px] lg:h-[600px] lg:flex-[1] hover:brightness-125"
      }`}
    >
      <img
        src={f.img}
        alt={f.name}
        className="absolute inset-0 w-full h-full object-cover transition-all duration-700"
        style={{ objectPosition: f.pos, filter: active ? "none" : "brightness(.5) saturate(.75)", transform: active ? "scale(1.04)" : "scale(1.15)" }}
      />
      <div className="absolute inset-0" style={{ background: active ? "linear-gradient(0deg,#050304 6%,rgba(5,3,4,.82) 38%,rgba(5,3,4,0) 72%)" : `linear-gradient(90deg, ${f.color}33, transparent)` }} />
      <div className="absolute inset-y-0 left-0 w-1 lg:w-[3px]" style={{ background: f.color, boxShadow: `0 0 18px ${f.color}` }} />

      {!active && (
        <div className="absolute inset-0 flex items-center justify-between px-5 lg:flex-col-reverse lg:px-0 lg:py-7">
          <span className="font-display font-bold text-xl tracking-[.15em] lg:[writing-mode:vertical-rl] lg:rotate-180 lg:text-2xl" style={{ textShadow: "0 2px 12px #000" }}>
            {f.name}
          </span>
          <span className="font-display font-bold text-sm px-2.5 py-1 slant" style={{ background: f.color, color: "#12090a" }}>
            {f.rank} / {f.xpNext}
          </span>
        </div>
      )}

      {active && (
        <>
          <div className="absolute top-4 right-5 lg:right-16 text-right pointer-events-none anim-fade-in">
            <div className="font-display italic font-bold leading-none text-[84px] sm:text-[110px] text-outline" style={{ WebkitTextStroke: `2px ${f.color}` }}>
              {f.rank}
            </div>
            <div className="font-display text-xs tracking-[.4em] -mt-1" style={{ color: f.color }}>
              {tr(lang,"medals.earned")}
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 px-5 pb-6 sm:px-7 lg:pl-16 lg:pr-16 lg:pb-9 anim-fade-up">
            <span className="slant inline-block font-display font-bold text-xs tracking-[.25em] px-4 py-1" style={{ background: f.color, color: "#12090a" }}>
              {f.element}
            </span>
            <h3 className="font-display italic font-bold text-4xl sm:text-5xl leading-none mt-2 break-words" style={{ textShadow: `0 0 28px ${f.color}66` }}>
              {f.name}
            </h3>
            <p className="text-orange-100/80 text-base mt-1">{f.epithet}</p>

            <div className="mt-4 max-w-md">
              <div className="flex justify-between font-display text-xs tracking-wider text-white/70 mb-1.5">
                <span>
                  {tr(lang,"earned")} {f.xp}/{f.xpNext}
                </span>
                <span>{tr(lang,"real.achievements")}</span>
              </div>
              <EnergyBar value={f.xp} max={f.xpNext} cells={14} height={9} color={f.color} />
            </div>

            <dl className="mt-4 flex gap-6 font-display">
              {[
                [tr(lang,"medals"), f.xp],
                [tr(lang,"total"), f.xpNext],
                [tr(lang,"left"), Math.max(0, f.xpNext - f.xp)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] tracking-[.3em] text-white/50">{k}</dt>
                  <dd className="text-2xl font-bold leading-tight">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5">
              <div className="font-display text-[11px] tracking-[.3em] text-white/60 mb-2">{tr(lang,"mastery.skin")}</div>
              <p className="text-[15px] text-orange-50/90 min-h-[44px]">
                {f.skins.length ? f.skins.join(" · ") : tr(lang,"mastery.no.skin")}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Roster({lang}:{lang:Language}) {
  const [sel, setSel] = useState(FIGHTERS[0]?.id || "");
  return (
    <section className="mt-12">
      <SectionTitle kicker={`${FIGHTERS.length} ${tr(lang,"tracked.fighters")}`} title={tr(lang,"hero.mastery")} />
      <div className="mt-5 flex flex-col lg:flex-row gap-2 lg:gap-0">
        {FIGHTERS.map((f) => (
          <Slat key={f.id} f={f} lang={lang} active={sel === f.id} onSelect={() => setSel(f.id)} />
        ))}
      </div>
    </section>
  );
}

export function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="flex items-end gap-4">
      <div>
        <p className="font-display text-xs tracking-[.4em] text-amber">{kicker}</p>
        <h2 className="font-display italic font-bold text-3xl sm:text-5xl leading-none text-white mt-1">{title}</h2>
      </div>
      <div className="flex-1 h-[2px] mb-2 bg-gradient-to-r from-orange-500/70 to-transparent" />
    </div>
  );
}

/* ---------------- Medal wall ---------------- */
function Wall({lang}:{lang:Language}) {
  const [tier, setTier] = useState<Tier | "all">("all");
  const [status, setStatus] = useState<"all" | "done" | "locked">("all");
  const [open, setOpen] = useState<Achievement | null>(null);

  const list = ACHIEVEMENTS.filter((a) => (tier === "all" || a.tier === tier) && (status === "all" || (status === "done" ? isDone(a) : !isDone(a))));

  const chip = (on: boolean, color?: string) =>
    `slant font-display font-bold text-xs sm:text-sm tracking-wider px-4 py-2 transition ${on ? "text-black" : "bg-white/8 text-white/75 hover:bg-white/15"}` + (on && !color ? " bg-gold" : "");

  return (
    <section className="mt-14">
      <SectionTitle kicker={tr(lang,"battle.achievements")} title={tr(lang,"medal.wall")} />
      <div className="mt-5 flex flex-wrap gap-2 items-center">
        <button className={chip(tier === "all")} onClick={() => setTier("all")}>
          {tr(lang,"all")} {ACHIEVEMENTS.length}
        </button>
        {TIERS.map((t) => (
          <button key={t.id} className={chip(tier === t.id, t.color)} style={tier === t.id ? { background: t.color } : { borderBottom: `2px solid ${t.color}66` }} onClick={() => setTier(t.id)}>
            {tierName(lang,t.id)}
          </button>
        ))}
        <span className="hidden sm:block w-px h-6 bg-white/20 mx-1" />
        {(
          [
            ["all", tr(lang,"status.all")],
            ["done", tr(lang,"status.unlocked")],
            ["locked", tr(lang,"status.locked")],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={chip(status === k) + " !text-[11px]"} onClick={() => setStatus(k)}>
            {l}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-8">
        {TIERS.map((t) => {
          const items = list.filter((a) => a.tier === t.id);
          if (!items.length) return null;
          const all = ACHIEVEMENTS.filter((a) => a.tier === t.id);
          return (
            <div key={t.id} className="relative">
              <div className="flex items-center gap-3 mb-3">
                <span className="font-display font-bold tracking-[.3em] text-sm" style={{ color: t.color }}>
                  {tierName(lang,t.id)}
                </span>
                <span className="font-display text-xs text-white/50">
                  {all.filter(isDone).length}/{all.length}
                </span>
                <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${t.color}88, transparent)` }} />
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-5">
                {items.map((a, i) => (
                  <button
                    key={a.id}
                    onClick={() => setOpen(a)}
                    className="group flex flex-col items-center text-center anim-fade-up"
                    style={{ width: TIER_SIZE[t.id] + 22, animationDelay: `${Math.min(i, 12) * 35}ms` }}
                  >
                    <div className="transition-transform duration-300 group-hover:-translate-y-1.5 group-hover:scale-110">
                      <Medal tier={a.tier} glyph={a.glyph} unlocked={isDone(a)} size={TIER_SIZE[t.id]} />
                    </div>
                    <span className={`mt-1.5 text-[13px] leading-tight font-semibold ${isDone(a) ? "text-white" : "text-white/50"}`}>{a.name}</span>
                    {!isDone(a) && (
                      <span className="font-display text-[11px] text-orange-300/70 tabular-nums">
                        {a.p >= 1000 ? `${Math.round(a.p / 1000)}k` : a.p}/{a.t >= 1000 ? `${Math.round(a.t / 1000)}k` : a.t}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {list.length === 0 && <p className="text-white/60 py-10">{tr(lang,"medal.none")}</p>}
      </div>

      {open && <Drawer a={open} lang={lang} onClose={() => setOpen(null)} />}
    </section>
  );
}

function Drawer({ a, onClose, lang }: { a: Achievement; onClose: () => void; lang:Language }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  const t = TIERS.find((x) => x.id === a.tier)!;
  const done = isDone(a);
  const sf = a.skin ? fighterById(a.skin.fighter) : null;
  const skinIdx = sf && a.skin ? Math.max(0, sf.skins.indexOf(a.skin.name)) : 0;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm anim-fade-in" onClick={onClose} />
      <div className="sheet absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[440px] sm:max-h-none cut-lg p-[2px]" style={{ background: `linear-gradient(160deg, ${t.color}, transparent 60%)` }}>
        <div className="relative h-full cut-lg bg-[#0b0706] p-6 sm:p-8 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-72 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 30%, ${t.color}44, transparent 65%)` }} />
          <button onClick={onClose} aria-label={tr(lang,"close")} className="absolute top-4 right-4 w-10 h-10 hex bg-white/10 hover:bg-white/25 grid place-items-center z-10">
            <GlyphIcon name="x" className="w-4 h-4" />
          </button>

          <div className="relative flex flex-col items-center text-center pt-4">
            <Medal tier={a.tier} glyph={a.glyph} unlocked={done} size={168} />
            <span className="slant mt-5 font-display font-bold text-xs tracking-[.3em] px-5 py-1 text-black" style={{ background: t.color }}>
              {tierName(lang,t.id)}
            </span>
            <h3 className="font-display italic font-bold text-3xl leading-tight mt-3">{a.name}</h3>
            <p className="text-orange-50/80 mt-2 max-w-xs">{a.desc}</p>
          </div>

          <div className="relative mt-6">
            <div className="flex justify-between font-display text-xs tracking-[.25em] text-white/60 mb-1.5">
              <span>{tr(lang,"progress")}</span>
              <span className="text-white tabular-nums">
                {fmt(Math.min(a.p, a.t))} / {fmt(a.t)}
              </span>
            </div>
            <EnergyBar value={Math.min(a.p, a.t)} max={a.t} cells={10} height={14} color={t.color} />
            <div className={`mt-3 font-display font-bold tracking-widest text-sm ${done ? "text-gold" : "text-white/50"}`}>{tr(lang,done ? "unlocked" : "locked")}</div>
          </div>

          <div className="relative mt-6">
            {sf && a.skin ? (
              <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-3 cut-sm">
                <div className="relative w-20 h-24 shrink-0 hex overflow-hidden bg-black">
                  <img src={sf.img} alt="" className="w-full h-full object-cover" style={{ objectPosition: sf.pos, filter: SKIN_FILTERS[skinIdx], opacity: done ? 1 : 0.5 }} />
                  {!done && (
                    <div className="absolute inset-0 grid place-items-center bg-black/50">
                      <GlyphIcon name="lock" className="w-6 h-6 text-white/80" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-display text-[11px] tracking-[.3em] text-amber">{tr(lang,"reward.skin")}</div>
                  <div className="font-display font-bold text-xl leading-tight">{a.skin.name}</div>
                  <div className="text-sm text-white/60">{sf.name}</div>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 p-4 cut-sm text-sm text-white/70">{tr(lang,"medal.no.skin")}</div>
            )}
            <p className="mt-3 text-sm text-white/50">{tr(lang,"achievements.no.ac")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Mastery({lang}:{lang:Language}) {
  return (
    <div>
      <Summary lang={lang} />
      <Roster lang={lang} />
      <Wall lang={lang} />
    </div>
  );
}
