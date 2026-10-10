import { useMemo, useState } from "react";
import { Check, ChevronDown, Lock, X } from "lucide-react";
import { CATEGORY_LABEL, RARITY_LABEL } from "../data/achievements";
import type { AchievementCategory, AchievementDef, MatchResult } from "../data/types";
import { fmt, fmtMetric, type IntegrityReport, type ResolvedAward } from "../lib/match";
import { Dialog } from "./Dialog";
import { Medal, RarityPips, teamVars, ThresholdMeter } from "./Medal";

export type ArchiveTab = "p1" | "p2" | "codex" | "sources";

interface ArchiveProps {
  open: boolean;
  tab: ArchiveTab;
  onTab: (t: ArchiveTab) => void;
  onClose: () => void;
  match: MatchResult;
  catalog: AchievementDef[];
  awards: [ResolvedAward[], ResolvedAward[]];
  integrity: IntegrityReport;
}

const CATS = Object.keys(CATEGORY_LABEL) as AchievementCategory[];

/** Optional full archive; its internal scrolling never moves the results screen. */
export function Archive({ open, tab, onTab, onClose, match, catalog, awards, integrity }: ArchiveProps) {
  if (!open) return null;
  const [p1, p2] = match.players;
  const tabs: { id: ArchiveTab; label: string; count?: number; color?: string }[] = [
    { id: "p1", label: p1.handle, count: awards[0].length, color: p1.accent },
    { id: "p2", label: p2.handle, count: awards[1].length, color: p2.accent },
    { id: "codex", label: "Codex", count: catalog.length },
    { id: "sources", label: "Nguồn sát thương" },
  ];

  return (
    <Dialog id="commendation-archive" titleId="arch-title" className="archive-modal" onClose={onClose}>
      <div className="arch__panel">
        <header className="arch__head">
          <div>
            <p className="arch__kicker">APEX CHAOS · {match.meta.id}</p>
            <h2 id="arch-title" className="arch__title">Hồ sơ danh hiệu</h2>
          </div>
          <button type="button" className="iconbtn iconbtn--sq" onClick={onClose} aria-label="Đóng hồ sơ" autoFocus>
            <X size={20} />
          </button>
        </header>

        <nav className="arch__tabs" role="tablist" aria-label="Chế độ xem">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`archive-tab-${t.id}`}
              aria-controls="archive-content"
              aria-selected={tab === t.id}
              tabIndex={tab === t.id ? 0 : -1}
              className={`arch__tab${tab === t.id ? " is-on" : ""}`}
              style={t.color ? ({ "--tab": t.color } as React.CSSProperties) : undefined}
              onClick={() => onTab(t.id)}
              onKeyDown={(event) => {
                const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
                if (!keys.includes(event.key)) return;
                event.preventDefault();
                const current = tabs.findIndex((item) => item.id === t.id);
                const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
                  : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
                onTab(tabs[next].id);
                document.getElementById(`archive-tab-${tabs[next].id}`)?.focus({ preventScroll: true });
              }}
            >
              {t.color && <i aria-hidden="true" />}
              <span>{t.label}</span>
              {t.count != null && <em>{t.count}</em>}
            </button>
          ))}
        </nav>

        <div className="arch__body" key={tab} id="archive-content" role="tabpanel" aria-labelledby={`archive-tab-${tab}`} tabIndex={0}>
          {tab === "p1" && <PlayerList key="p1" awards={awards[0]} color={p1} />}
          {tab === "p2" && <PlayerList key="p2" awards={awards[1]} color={p2} />}
          {tab === "codex" && <Codex catalog={catalog} match={match} />}
          {tab === "sources" && <Sources match={match} />}
        </div>

        <footer className="arch__foot">
          <span className={`integrity${integrity.issues.length ? " is-bad" : ""}`}>
            {integrity.issues.length ? <X size={14} /> : <Check size={14} />}
            Fixture {integrity.issues.length ? `có ${integrity.issues.length} lỗi` : `nhất quán · ${integrity.checks}/${integrity.checks} kiểm tra`}
          </span>
          <span className="arch__note">Dữ liệu cố định, không thay đổi khi tải lại / đổi cỡ / xem lại.</span>
        </footer>
      </div>
    </Dialog>
  );
}

/* ───────── player list with expandable rows */

function PlayerList({ awards, color }: { awards: ResolvedAward[]; color: { accent: string; accentRgb: string; handle: string } }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set([awards[0]?.def.id]));
  const allOpen = open.size === awards.length;
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="plist" style={teamVars(color)}>
      <div className="plist__bar">
        <p>
          <b>{awards.length}</b> danh hiệu · sắp theo độ hiếm
        </p>
        <button
          type="button"
          className="linkbtn"
          onClick={() => setOpen(allOpen ? new Set() : new Set(awards.map((a) => a.def.id)))}
        >
          {allOpen ? "Thu gọn tất cả" : "Mở rộng tất cả"}
        </button>
      </div>
      <ul className="plist__rows">
        {awards.map((a, i) => {
          const isOpen = open.has(a.def.id);
          return (
            <li key={a.def.id} className={`arow arow--${a.def.rarity}${isOpen ? " is-open" : ""}`} style={{ "--i": i } as React.CSSProperties}>
              <button type="button" className="arow__head" aria-expanded={isOpen} onClick={() => toggle(a.def.id)}>
                <Medal def={a.def} size={46} />
                <span className="arow__main">
                  <span className="arow__name">{a.def.name}</span>
                  <span className="arow__meta">
                    <RarityPips rarity={a.def.rarity} />
                    {RARITY_LABEL[a.def.rarity]} · {CATEGORY_LABEL[a.def.category]}
                  </span>
                </span>
                <span className="arow__val">{a.def.conditions.length ? fmtMetric(a.value, a.def.metric.unit) : "Đã kích hoạt"}</span>
                <ChevronDown className="arow__chev" size={18} aria-hidden="true" />
              </button>
              <div className="arow__panel">
                <div>
                  <p className="arow__desc">{a.def.description}</p>
                  <p className="arow__metric">
                    <span>{a.def.metric.label}</span>
                    <b>{a.def.conditions.length ? fmtMetric(a.value, a.def.metric.unit) : "Đã kích hoạt"}</b>
                  </p>
                  <p className="arow__desc">{a.def.conditions.length
                    ? a.def.conditions.map((c) => `${c.label} ${c.compare === "gte" ? "≥" : "≤"} ${fmtMetric(c.value, c.unit)}`).join(" · ")
                    : "Sự kiện combat hợp lệ"}</p>
                  <ThresholdMeter award={a} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ───────── codex of all 50 */

function Codex({ catalog, match }: { catalog: AchievementDef[]; match: MatchResult }) {
  const [cat, setCat] = useState<AchievementCategory | "all">("all");
  const [earnedOnly, setEarnedOnly] = useState(false);
  const earnedBy = useMemo(() => {
    const m: Record<string, number[]> = {};
    for (const p of match.players) for (const a of p.awards) (m[a.achievementId] ||= []).push(p.slot);
    return m;
  }, [match]);

  const list = catalog.filter((a) => (cat === "all" || a.category === cat) && (!earnedOnly || earnedBy[a.id]));
  const [p1, p2] = match.players;

  return (
    <div className="codex">
      <div className="codex__filters" role="group" aria-label="Lọc danh hiệu">
        <button type="button" className={`fchip${cat === "all" ? " is-on" : ""}`} onClick={() => setCat("all")}>
          Tất cả
        </button>
        {CATS.map((c) => (
          <button key={c} type="button" className={`fchip${cat === c ? " is-on" : ""}`} onClick={() => setCat(c)}>
            {CATEGORY_LABEL[c]}
          </button>
        ))}
        <button type="button" className={`fchip fchip--toggle${earnedOnly ? " is-on" : ""}`} aria-pressed={earnedOnly} onClick={() => setEarnedOnly((v) => !v)}>
          <Check size={14} aria-hidden="true" /> Đã đạt trong trận
        </button>
      </div>
      <p className="codex__count">
        Hiển thị <b>{list.length}</b> / {catalog.length}
      </p>
      <ul className="codex__grid">
        {list.map((a) => {
          const who = earnedBy[a.id] ?? [];
          return (
            <li key={a.id} className={`cell cell--${a.rarity}${who.length ? "" : " is-locked"}`}>
              <Medal def={a} size={40} locked={!who.length} />
              <div className="cell__main">
                <p className="cell__name">{a.name}</p>
                <p className="cell__desc">{a.rule}</p>
                <p className="cell__foot">
                  <RarityPips rarity={a.rarity} />
                  <span>{RARITY_LABEL[a.rarity]}</span>
                  {who.length === 0 && (
                    <span className="cell__lock">
                      <Lock size={12} aria-hidden="true" /> Chưa ai đạt
                    </span>
                  )}
                  {who.map((s) => (
                    <span key={s} className="cell__who" style={{ "--c": s === 1 ? p1.accent : p2.accent } as React.CSSProperties}>
                      {s === 1 ? p1.handle : p2.handle}
                    </span>
                  ))}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ───────── damage sources */

function Sources({ match }: { match: MatchResult }) {
  const top = match.weaponOfTheBattle;
  return (
    <div className="sources">
      {match.players.map((p) => {
        const max = Math.max(1, ...p.damage.sources.map((s) => s.damage));
        return (
          <section key={p.id} className="sources__col" style={teamVars(p)}>
            <h3>
              <i aria-hidden="true" />
              {p.handle}
              <b>{fmt(p.damage.dealt)}</b>
            </h3>
            <dl className="sources__stats">
              <div><dt>Chính xác</dt><dd>{p.stats.accuracy}%</dd></div>
              <div><dt>Chí mạng</dt><dd>{p.stats.critRate}%</dd></div>
              <div><dt>Hồi phục</dt><dd>{fmt(p.stats.healing)} HP</dd></div>
              <div><dt>Kỹ năng</dt><dd>{p.stats.skillCasts} lần</dd></div>
            </dl>
            <ul>
              {[...p.damage.sources]
                .sort((a, b) => b.damage - a.damage)
                .map((s) => (
                  <li key={s.id} className={s.weaponId === top.weaponId ? "is-top" : ""}>
                    <span className="sources__label">
                      {s.label}
                      {s.weaponId === top.weaponId && <em>Weapon of the Battle</em>}
                    </span>
                    <span className="sources__val">{fmt(s.damage)}</span>
                    <span className="sources__bar">
                      <i style={{ width: `${(s.damage / max) * 100}%` }} />
                    </span>
                    <span className="sources__pct">{(p.damage.dealt > 0 ? (s.damage / p.damage.dealt) * 100 : 0).toFixed(1)}%</span>
                  </li>
                ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
