import { useEffect, useRef, useState } from "react";
import { MISSIONS, ACHIEVEMENTS, fighterById, isDone } from "./data";
import { missionStatus, useGame, type Game } from "./store";
import { AnimatedNumber, Coin, GlobalDefs, Stage, type StageVariant } from "./ui";
import { tr } from "./locale";
import { FxProvider } from "./fx";
import { Contracts } from "./Missions";
import { Mastery } from "./Mastery";
import { Account } from "./Account";

type Screen = "missions" | "account";
type Tab = "ops" | "mastery";

function Hud({ g }: { g: Game }) {
  const [hit, setHit] = useState(false);
  const prev = useRef(g.s.ac);
  useEffect(() => {
    if (g.s.ac > prev.current) {
      prev.current = g.s.ac;
      const t = setTimeout(() => setHit(true), 1000);
      const t2 = setTimeout(() => setHit(false), 1700);
      return () => {
        clearTimeout(t);
        clearTimeout(t2);
      };
    }
    prev.current = g.s.ac;
  }, [g.s.ac]);

  const av = fighterById(g.s.avatar);


  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 h-16" style={{ background: "linear-gradient(180deg,rgba(7,5,10,.95),rgba(7,5,10,.6) 70%,transparent)" }}>
        <div className="max-w-[1280px] mx-auto h-full px-4 sm:px-8 flex items-center justify-between gap-4">
          <button aria-label={tr(g.lang,"back")} title={tr(g.lang,"back")} onClick={() => { try { (window.parent as any).__APEX_GOLD_BRIDGE__?.close(); } catch {} }} className="shrink-0 min-w-0 bg-transparent border-0 p-0 text-left"><img className="block w-[142px] sm:w-[190px] max-h-[54px] object-contain object-left" src="./assets/gold/apex-chaos-wordmark.png" alt="APEX CHAOS" draggable={false} /></button>
          <div className="flex items-center gap-3">
            <div id="ac-chip" className={`slant-r flex items-center gap-2 pl-2 pr-5 py-1 bg-black/70 border-b-2 border-gold ${hit ? "anim-hit" : ""}`}>
              <Coin size={26} />
              <span className="font-display font-bold text-lg tabular-nums leading-none">
                <AnimatedNumber value={g.s.ac} delay={950} />
              </span>
              <span className="font-display text-[10px] tracking-[.2em] text-gold -ml-0.5">AC</span>
            </div>
            <div aria-label={tr(g.lang,"profile")} className="hidden sm:flex items-center gap-2 group">
              <div className="w-10 h-11 hex p-[2px]" style={{ background: av.color }}>
                <div className="w-full h-full hex overflow-hidden bg-black">
                  <img src={av.img} alt="" className="w-full h-full object-cover" style={{ objectPosition: av.pos }} />
                </div>
              </div>
              <span className="hidden lg:block font-display font-semibold text-sm max-w-[120px] truncate">{g.s.name}</span>
            </div>
          </div>
        </div>
      </header>


    </>
  );
}

function Shell() {
  const g = useGame();
  const [screen, setScreen] = useState<Screen>(() => new URLSearchParams(location.search).get("screen") === "account" ? "account" : "missions");
  const [tab, setTab] = useState<Tab>(() => new URLSearchParams(location.search).get("tab") === "mastery" ? "mastery" : "ops");
  const [wipe, setWipe] = useState<{ n: number; label: string }>({ n: 0, label: "" });
  const busy = useRef(false);

  const run = (label: string, fn: () => void) => {
    if (busy.current) return;
    busy.current = true;
    setWipe((w) => ({ n: w.n + 1, label }));
    setTimeout(() => {
      fn();
      window.scrollTo(0, 0);
    }, 400);
    setTimeout(() => (busy.current = false), 850);
  };
  const goTab = (t: Tab) => t !== tab && run(tr(g.lang, t === "ops" ? "contracts" : "mastery"), () => setTab(t));

  useEffect(() => {
    document.documentElement.lang = g.lang === "vie" ? "vi" : "en";
    document.documentElement.dataset.apexLanguage = g.lang;
  }, [g.lang]);
  useEffect(() => {
    const onEscape=(e:KeyboardEvent)=>{
      if(e.key==='Escape' && !document.querySelector('.sheet')){
        try {(window.parent as any).__APEX_GOLD_BRIDGE__?.close();}catch{}
      }
    };
    window.addEventListener('keydown',onEscape);
    return()=>window.removeEventListener('keydown',onEscape);
  },[]);
  const variant: StageVariant = screen === "account" ? "account" : tab === "mastery" ? "mastery" : "missions";
  const ready = MISSIONS.filter((m) => missionStatus(g.s, m) === "ready").length;
  const done = ACHIEVEMENTS.filter(isDone).length;

  const tabBtn = (id: Tab, label: string, badge: string, hot?: boolean) => (
    <button
      key={id}
      role="tab"
      aria-selected={tab === id}
      onClick={() => goTab(id)}
      className={`slant font-display font-bold italic tracking-[.12em] text-sm sm:text-base px-5 sm:px-8 py-3 flex items-center gap-2.5 transition-all ${tab === id ? "bg-gradient-to-b from-gold to-orange-500 text-black shadow-[0_0_24px_rgba(255,140,20,.55)]" : "bg-black/55 text-white/75 hover:bg-white/15"}`}
    >
      {label}
      <span className={`not-italic text-[11px] px-2 py-[1px] ${tab === id ? "bg-black/80 text-gold" : hot ? "bg-orange-500 text-black" : "bg-white/15 text-white/80"}`}>{badge}</span>
    </button>
  );

  if (!g.ready) return <div role="alert" className="p-8 text-gold">{tr(g.lang,"unavailable")}</div>;
  return (
    <div className="relative min-h-screen">
      <GlobalDefs />
      <Stage variant={variant} />
      <Hud g={g} />

      <main className="max-w-[1280px] mx-auto min-w-0 px-4 sm:px-8 pt-24 pb-20">
        <div key={screen + tab} className="anim-fade-up">
          {screen === "missions" ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-5">
                <div>
                  <p className="font-display text-xs tracking-[.5em] text-amber">{tr(g.lang,"missions.kicker")}</p>
                  <h1 className="font-display italic font-bold text-5xl sm:text-8xl leading-[1.02] sm:leading-[0.9] break-words text-molten" style={{ filter: "drop-shadow(0 6px 30px rgba(255,100,10,.45))" }}>
                    {tr(g.lang,"missions.title")}
                  </h1>
                </div>
                <div role="tablist" className="flex gap-1.5">
                  {tabBtn("ops", tr(g.lang,"contracts"), ready > 0 ? `${ready} ${tr(g.lang,"ready.short")}` : tr(g.lang,"earn.ac"), ready > 0)}
                  {tabBtn("mastery", tr(g.lang,"mastery"), `${done}/${ACHIEVEMENTS.length}`)}
                </div>
              </div>
              {tab === "ops" ? <Contracts g={g} /> : <Mastery lang={g.lang} />}
            </>
          ) : (
            <>
              <p className="font-display text-xs tracking-[.5em] text-amber">{tr(g.lang,"account.kicker")}</p>
              <h1 className="font-display italic font-bold text-5xl sm:text-8xl leading-[1.02] sm:leading-[0.9] break-words text-molten" style={{ filter: "drop-shadow(0 6px 30px rgba(255,100,10,.45))" }}>
                {tr(g.lang,"account.title")}
              </h1>
              <Account g={g} />
            </>
          )}
        </div>
      </main>

      {wipe.n > 0 && (
        <div key={wipe.n} className="fixed inset-0 z-[80] pointer-events-none overflow-hidden">
          <div className="absolute inset-y-0 -left-[20%] w-[140%] grid place-items-center" style={{ animation: "wipe .85s cubic-bezier(.7,0,.3,1) both", background: "linear-gradient(100deg,#ff5a0a,#ffb21f 50%,#ff5a0a)" }}>
            <span className="font-display italic font-bold text-5xl sm:text-8xl text-[#1a0900] tracking-tight" style={{ transform: "skewX(16deg)" }}>
              {wipe.label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <FxProvider>
      <Shell />
    </FxProvider>
  );
}
