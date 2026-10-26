import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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
        <div className="gold-hud-header-inner max-w-[1280px] mx-auto h-full px-4 sm:px-8 flex items-center justify-between gap-3 sm:gap-4">
          <div className="gold-hud-nav">
            <button type="button" className="gold-session-back" aria-label={tr(g.lang,"back")} title={tr(g.lang,"back")}
              onClick={() => { try { (window.parent as any).__APEX_GOLD_BRIDGE__?.close(); } catch {} }}>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5m7-7-7 7 7 7" />
              </svg>
              <span>{g.lang === "vie" ? "VỀ" : "BACK"}</span>
            </button>
            <button type="button" aria-label={tr(g.lang,"back")} title={tr(g.lang,"back")} onClick={() => { try { (window.parent as any).__APEX_GOLD_BRIDGE__?.close(); } catch {} }} className="gold-hud-wordmark shrink-0 min-w-0 bg-transparent border-0 p-0 text-left"><img className="block w-full h-auto max-h-[54px] object-contain object-left" src="./assets/gold/apex-chaos-wordmark.png" alt="APEX CHAOS" draggable={false} /></button>
          </div>
          <div className="gold-hud-identity flex min-w-0 items-center gap-2 sm:gap-3">
            <div id="ac-chip" className={`gold-ac-chip slant-r flex shrink-0 items-center gap-1.5 sm:gap-2 pl-2 pr-3 sm:pr-5 py-1 bg-black/70 border-b-2 border-gold ${hit ? "anim-hit" : ""}`}>
              <Coin size={26} />
              <span className="font-display font-bold text-lg tabular-nums leading-none">
                <AnimatedNumber value={g.s.ac} delay={950} />
              </span>
              <span className="font-display text-[10px] tracking-[.2em] text-gold -ml-0.5">AC</span>
            </div>
            <div aria-label={tr(g.lang,"profile")} className="hidden md:flex min-w-0 items-center gap-2 group">
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
  const swipeStart = useRef<{id:number;x:number;y:number;at:number}|null>(null);
  const swallowSwipeClick = useRef(0);
  const [showSwipeCoach, setShowSwipeCoach] = useState(false);
  const sectionIndex = screen === "account" ? 2 : tab === "mastery" ? 1 : 0;
  const SWIPE_HINT_KEY = "apex.gold.sections.swipe.v1";
  useEffect(() => {
    if (!g.ready) return;
    try {
      if (localStorage.getItem(SWIPE_HINT_KEY) === "seen") return;
      localStorage.setItem(SWIPE_HINT_KEY, "seen");
    } catch { /* Private browsing still gets this one entry's tutorial. */ }
    setShowSwipeCoach(true);
    const timer = window.setTimeout(() => setShowSwipeCoach(false), 6200);
    return () => window.clearTimeout(timer);
  }, [g.ready]);

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
  const goSection = (index: number) => {
    if (index < 0 || index > 2 || index === sectionIndex || busy.current) return;
    const nextScreen: Screen = index === 2 ? "account" : "missions";
    const nextTab: Tab = index === 1 ? "mastery" : "ops";
    const label = index === 2 ? tr(g.lang, "account.title") : tr(g.lang, index === 1 ? "mastery" : "contracts");
    setShowSwipeCoach(false);
    run(label, () => { setScreen(nextScreen); setTab(nextTab); });
  };
  const goTab = (t: Tab) => t !== tab && goSection(t === "ops" ? 0 : 1);
  // A horizontal swipe changes the Gold section; native vertical scrolling,
  // tappable contract cards, modal sheets, and editable account fields remain intact.
  const onSwipeDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!e.isPrimary || (e.pointerType !== "touch" && e.pointerType !== "pen" && e.pointerType !== "mouse")) return;
    if (e.pointerType === "mouse" && (e.button !== 0 || (e.target as HTMLElement)?.closest("button,a,[role='button']"))) return;
    if ((e.target as HTMLElement)?.closest("input,textarea,select,[contenteditable],.sheet,[role='dialog'],[data-gold-swipe-ignore],.overflow-x-auto")) return;
    swipeStart.current = {id:e.pointerId,x:e.clientX,y:e.clientY,at:performance.now()};
  };
  const onSwipeEnd = (e: ReactPointerEvent<HTMLElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.45 || performance.now() - start.at > 1400) return;
    swallowSwipeClick.current = performance.now();
    goSection(sectionIndex + (dx < 0 ? 1 : -1));
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      if ((e.target as HTMLElement)?.closest("input,textarea,select,[contenteditable],.sheet,[role='dialog']")) return;
      if (document.querySelector(".sheet")) return;
      e.preventDefault();
      goSection(sectionIndex + (e.key === "ArrowRight" ? 1 : -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sectionIndex, g.lang]);

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
      className={`slant font-display font-bold italic tracking-[.07em] sm:tracking-[.12em] text-xs sm:text-base px-4 sm:px-8 py-3 flex min-w-0 items-center gap-1.5 sm:gap-2.5 transition-all ${tab === id ? "bg-gradient-to-b from-gold to-orange-500 text-black shadow-[0_0_24px_rgba(255,140,20,.55)]" : "bg-black/55 text-white/75 hover:bg-white/15"}`}
    >
      {label}
      <span className={`not-italic text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-[1px] ${tab === id ? "bg-black/80 text-gold" : hot ? "bg-orange-500 text-black" : "bg-white/15 text-white/80"}`}>{badge}</span>
    </button>
  );

  if (!g.ready) return <div role="alert" className="p-8 text-gold">{tr(g.lang,"unavailable")}</div>;
  return (
    <div className="relative min-h-screen">
      <GlobalDefs />
      <Stage variant={variant} />
      <Hud g={g} />

      <main className="gold-swipe-surface max-w-[1280px] mx-auto min-w-0 px-4 sm:px-8 pt-24 pb-20"
        onPointerDownCapture={onSwipeDown} onPointerUpCapture={onSwipeEnd}
        onPointerCancelCapture={() => { swipeStart.current = null; }}
        onClickCapture={(e) => { if (performance.now() - swallowSwipeClick.current < 450) { e.preventDefault(); e.stopPropagation(); swallowSwipeClick.current = 0; } }}>
        <div key={screen + tab} className="anim-fade-up">
          {screen === "missions" ? (
            <>
              <div className="gold-page-hero flex min-w-0 flex-wrap items-end justify-between gap-5">
                <div className="min-w-0 w-full">
                  <p className="gold-page-kicker font-display text-[10px] sm:text-xs tracking-[.18em] sm:tracking-[.3em] text-amber">{tr(g.lang,"missions.kicker")}</p>
                  <h1 className="gold-page-heading font-display italic font-bold text-molten" style={{ filter: "drop-shadow(0 6px 30px rgba(255,100,10,.45))" }}>
                    {tr(g.lang,"missions.title")}
                  </h1>
                </div>
                <div role="tablist" className="gold-page-tabs flex flex-wrap gap-1.5 max-w-full">
                  {tabBtn("ops", tr(g.lang,"contracts"), ready > 0 ? `${ready} ${tr(g.lang,"ready.short")}` : tr(g.lang,"earn.ac"), ready > 0)}
                  {tabBtn("mastery", tr(g.lang,"mastery"), `${done}/${ACHIEVEMENTS.length}`)}
                </div>
              </div>
              {tab === "ops" ? <Contracts g={g} /> : <Mastery lang={g.lang} />}
            </>
          ) : (
            <>
              <p className="gold-page-kicker font-display text-[10px] sm:text-xs tracking-[.18em] sm:tracking-[.3em] text-amber">{tr(g.lang,"account.kicker")}</p>
              <h1 className="gold-page-heading font-display italic font-bold text-molten" style={{ filter: "drop-shadow(0 6px 30px rgba(255,100,10,.45))" }}>
                {tr(g.lang,"account.title")}
              </h1>
              <Account g={g} />
            </>
          )}
        </div>
      </main>

      {showSwipeCoach && (
        <div className="gold-swipe-coach" role="status" aria-live="polite" data-testid="gold-swipe-coach">
          <div className="gold-swipe-coach-copy">
            <span className="gold-swipe-coach-kicker">{g.lang === "vie" ? "MẸO ĐIỀU HƯỚNG" : "NAVIGATION TIP"}</span>
            <strong>{g.lang === "vie" ? "VUỐT TRÁI / PHẢI" : "SWIPE LEFT / RIGHT"}</strong>
            <small>{g.lang === "vie" ? "ĐỔI MỤC · MISSIONS / MASTERY / ACCOUNT" : "CHANGE SECTION · MISSIONS / MASTERY / ACCOUNT"}</small>
          </div>
          <div className="gold-swipe-coach-track" aria-hidden="true">
            <span className="gold-swipe-coach-arrow">‹</span>
            <svg className="gold-swipe-coach-hand" viewBox="0 0 56 68" width="56" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 30v-6a4 4 0 018 0V11a4 4 0 018 0v17-9a4 4 0 018 0v12-7a4 4 0 018 0v19c0 8-4 14-12 17l-10 3-11-9L5 42a5 5 0 017-6l8 6V30" fill="#FFE5AE" stroke="#78380F" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              <path d="M23 27v13m8-13v13m8-10v10" stroke="#AA6F3F" strokeWidth="2" strokeLinecap="round" />
              <path d="M20 43l-5-3" stroke="#AA6F3F" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="gold-swipe-coach-arrow">›</span>
          </div>
          <button type="button" className="gold-swipe-coach-dismiss" onClick={() => setShowSwipeCoach(false)}
            aria-label={g.lang === "vie" ? "Đóng hướng dẫn vuốt" : "Dismiss swipe tutorial"}>×</button>
        </div>
      )}
      <div className="gold-section-position" aria-label={g.lang === "vie" ? "Vị trí mục hiện tại" : "Current section"} aria-live="off">
        {[0,1,2].map((i) => <span key={i} className={i === sectionIndex ? "is-current" : ""} aria-current={i === sectionIndex ? "step" : undefined} />)}
      </div>
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
