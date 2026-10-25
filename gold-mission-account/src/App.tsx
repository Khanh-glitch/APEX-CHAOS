import { useEffect, useRef, useState } from "react";
import { MISSIONS, ACHIEVEMENTS, fighterById, isDone } from "./data";
import { missionStatus, useGame, type Game } from "./store";
import { AnimatedNumber, Coin, GlobalDefs, GlyphIcon, Logo, Stage, type StageVariant } from "./ui";
import { FxProvider } from "./fx";
import { Contracts } from "./Missions";
import { Mastery } from "./Mastery";
import { Account } from "./Account";

type Screen = "missions" | "account";
type Tab = "ops" | "mastery";

function Hud({ g, screen, go }: { g: Game; screen: Screen; go: (s: Screen) => void }) {
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

  const readyCount = MISSIONS.filter((m) => missionStatus(g.s, m) === "ready").length;
  const av = fighterById(g.s.avatar);

  const nav = (id: Screen, label: string) => (
    <button
      key={id}
      onClick={() => go(id)}
      aria-current={screen === id}
      className={`relative slant font-display font-bold italic tracking-[.18em] text-sm px-8 py-2.5 transition-all ${screen === id ? "bg-gradient-to-b from-gold to-orange-500 text-black shadow-[0_0_24px_rgba(255,140,20,.6)]" : "bg-white/8 text-white/75 hover:bg-white/15 hover:text-white"}`}
    >
      {label}
      {id === "missions" && readyCount > 0 && <span className="absolute top-1 right-3 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_#fff]" style={{ animation: "pulse-glow 1s infinite" }} />}
    </button>
  );

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 h-16" style={{ background: "linear-gradient(180deg,rgba(7,5,10,.95),rgba(7,5,10,.6) 70%,transparent)" }}>
        <div className="max-w-[1280px] mx-auto h-full px-4 sm:px-8 flex items-center justify-between gap-4">
          <button aria-label="Đóng Gold và trở về APEX CHAOS" title="Trở về game" onClick={() => { try { (window.parent as any).__APEX_GOLD_BRIDGE__?.close(); } catch {} }} className="shrink-0 bg-transparent border-0 p-0 text-left"><Logo /></button>
          <nav className="hidden md:flex gap-2" aria-label="Điều hướng chính">
            {nav("missions", "MISSIONS")}
            {nav("account", "ACCOUNT")}
          </nav>
          <div className="flex items-center gap-3">
            <div id="ac-chip" className={`slant-r flex items-center gap-2 pl-2 pr-5 py-1 bg-black/70 border-b-2 border-gold ${hit ? "anim-hit" : ""}`}>
              <Coin size={26} />
              <span className="font-display font-bold text-lg tabular-nums leading-none">
                <AnimatedNumber value={g.s.ac} delay={950} />
              </span>
              <span className="font-display text-[10px] tracking-[.2em] text-gold -ml-0.5">AC</span>
            </div>
            <button onClick={() => go("account")} aria-label="Hồ sơ" className="hidden sm:flex items-center gap-2 group">
              <div className="w-10 h-11 hex p-[2px]" style={{ background: av.color }}>
                <div className="w-full h-full hex overflow-hidden bg-black">
                  <img src={av.img} alt="" className="w-full h-full object-cover" style={{ objectPosition: av.pos }} />
                </div>
              </div>
              <span className="hidden lg:block font-display font-semibold text-sm max-w-[120px] truncate group-hover:text-gold">{g.s.name}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-2 bg-black/90 backdrop-blur-lg border-t border-orange-500/40" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-label="Điều hướng chính">
        {(
          [
            ["missions", "MISSIONS", "target"],
            ["account", "ACCOUNT", "user"],
          ] as const
        ).map(([id, label, icon]) => (
          <button key={id} onClick={() => go(id)} aria-current={screen === id} className={`relative flex flex-col items-center gap-0.5 py-2.5 font-display font-bold italic tracking-[.15em] text-xs ${screen === id ? "text-gold" : "text-white/55"}`}>
            {screen === id && <span className="absolute top-0 inset-x-6 h-[3px] bg-gold shadow-[0_0_12px_#ffc43d]" />}
            <GlyphIcon name={icon} className="w-6 h-6" />
            {label}
            {id === "missions" && readyCount > 0 && <span className="absolute top-2 right-[calc(50%-26px)] w-2.5 h-2.5 rounded-full bg-orange-400 shadow-[0_0_8px_#ff8a2a]" />}
          </button>
        ))}
      </nav>
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
  const go = (s: Screen) => s !== screen && run(s === "account" ? "ACCOUNT" : "MISSIONS", () => setScreen(s));
  const goTab = (t: Tab) => t !== tab && run(t === "ops" ? "CHAOS CONTRACTS" : "MASTERY", () => setTab(t));

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

  if (!g.ready) return <div role="alert" className="p-8 text-gold">Gold cần được mở từ APEX CHAOS. Dữ liệu chưa sẵn sàng.</div>;
  return (
    <div className="relative min-h-screen">
      <GlobalDefs />
      <Stage variant={variant} />
      <Hud g={g} screen={screen} go={go} />

      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-24 pb-28 md:pb-20">
        <div key={screen + tab} className="anim-fade-up">
          {screen === "missions" ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-5">
                <div>
                  <p className="font-display text-xs tracking-[.5em] text-amber">APEX CHAOS // NHIỆM VỤ</p>
                  <h1 className="font-display italic font-bold text-6xl sm:text-8xl leading-[0.9] text-molten" style={{ filter: "drop-shadow(0 6px 30px rgba(255,100,10,.45))" }}>
                    MISSIONS
                  </h1>
                </div>
                <div role="tablist" className="flex gap-1.5">
                  {tabBtn("ops", "CONTRACTS", ready > 0 ? `${ready} SẴN SÀNG` : "NHẬN AC", ready > 0)}
                  {tabBtn("mastery", "MASTERY", `${done}/${ACHIEVEMENTS.length}`)}
                </div>
              </div>
              {tab === "ops" ? <Contracts g={g} /> : <Mastery />}
            </>
          ) : (
            <>
              <p className="font-display text-xs tracking-[.5em] text-amber">APEX CHAOS // HỒ SƠ NGƯỜI CHƠI</p>
              <h1 className="font-display italic font-bold text-6xl sm:text-8xl leading-[0.9] text-molten" style={{ filter: "drop-shadow(0 6px 30px rgba(255,100,10,.45))" }}>
                ACCOUNT
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
