import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Coin, GlyphIcon } from "./ui";

interface CoinP {
  id: number;
  x: number;
  y: number;
  ox: number;
  oy: number;
  dx: number;
  dy: number;
  delay: number;
}
interface Pop {
  id: number;
  amount: number;
  x: number;
  y: number;
}
interface Toast {
  id: number;
  msg: string;
  kind: "ok" | "warn";
}

interface FxApi {
  burst: (amount: number, x: number, y: number) => void;
  toast: (msg: string, kind?: "ok" | "warn") => void;
}

const Ctx = createContext<FxApi>({ burst: () => {}, toast: () => {} });
export const useFx = () => useContext(Ctx);

export function FxProvider({ children }: { children: ReactNode }) {
  const [coins, setCoins] = useState<CoinP[]>([]);
  const [pops, setPops] = useState<Pop[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [flash, setFlash] = useState(0);
  const uid = useRef(1);

  const burst = useCallback((amount: number, x: number, y: number) => {
    const chip = document.getElementById("ac-chip");
    const r = chip?.getBoundingClientRect();
    const tx = r ? r.left + r.width / 2 : window.innerWidth - 80;
    const ty = r ? r.top + r.height / 2 : 30;
    const id = uid.current++;
    const n = Math.min(24, 9 + Math.round(amount / 40));
    const list: CoinP[] = Array.from({ length: n }, (_, i) => {
      const a = Math.random() * Math.PI * 2;
      const d = 50 + Math.random() * 100;
      return { id: id * 100 + i, x, y, ox: Math.cos(a) * d, oy: Math.sin(a) * d - 30, dx: tx - x, dy: ty - y, delay: Math.random() * 180 };
    });
    setCoins((c) => [...c, ...list]);
    setPops((p) => [...p, { id, amount, x, y }]);
    setFlash((f) => f + 1);
    setTimeout(() => {
      setCoins((c) => c.filter((k) => !list.includes(k)));
      setPops((p) => p.filter((k) => k.id !== id));
    }, 1800);
  }, []);

  const toast = useCallback((msg: string, kind: "ok" | "warn" = "ok") => {
    const id = uid.current++;
    setToasts((t) => [...t.slice(-2), { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((k) => k.id !== id)), 2600);
  }, []);

  const api = useMemo(() => ({ burst, toast }), [burst, toast]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed inset-0 z-[70] pointer-events-none overflow-hidden">
        {flash > 0 && <div key={flash} className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 60%, rgba(255,190,70,.5), transparent 60%)", animation: "flash .7s ease-out forwards", opacity: 0 }} />}
        {coins.map((c) => (
          <div
            key={c.id}
            className="absolute"
            style={{
              left: c.x,
              top: c.y,
              animation: `coin-fly 1.25s cubic-bezier(.4,.1,.3,1) ${c.delay}ms both`,
              ["--ox" as string]: `${c.ox}px`,
              ["--oy" as string]: `${c.oy}px`,
              ["--dx" as string]: `${c.dx}px`,
              ["--dy" as string]: `${c.dy}px`,
            }}
          >
            <Coin size={26} />
          </div>
        ))}
        {pops.map((p) => (
          <div
            key={p.id}
            className="absolute font-display italic font-bold text-4xl sm:text-5xl text-molten whitespace-nowrap"
            style={{ left: Math.min(Math.max(p.x, 110), window.innerWidth - 110), top: p.y, animation: "pop-text 1.6s ease-out forwards", filter: "drop-shadow(0 0 14px rgba(255,140,20,.9))" }}
          >
            +{p.amount.toLocaleString("vi-VN")} AC
          </div>
        ))}
      </div>
      <div className="fixed top-[72px] inset-x-0 z-[90] flex flex-col items-center gap-2 pointer-events-none px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`cut-sm flex items-center gap-2 px-4 py-2.5 text-sm font-semibold backdrop-blur-md ${t.kind === "ok" ? "bg-black/85 text-amber-100 border-l-4 border-gold" : "bg-[#2a0d06]/90 text-orange-200 border-l-4 border-red-500"}`}
            style={{ animation: "toast-in .3s ease both" }}
          >
            <GlyphIcon name={t.kind === "ok" ? "check" : "lock"} className="w-4 h-4 shrink-0" />
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
