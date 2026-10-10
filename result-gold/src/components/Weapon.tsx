import { useRef } from "react";
import type { CSSProperties } from "react";
import type { PointerEvent } from "react";
import type { WeaponSpotlight } from "../lib/match";
import { fmt } from "../lib/match";
import { CountUp, useReveal } from "../lib/motion";
import { WeaponArt } from "./art";
import { teamVars } from "./Medal";

interface WeaponProps {
  spot: WeaponSpotlight | null;
  phase: number;
  force: boolean;
}

/**
 * Weapon of the Battle — the centrepiece. Intro: light cone ignites → title opens from the
 * centre → the weapon is mechanically assembled part by part → a scan-sweep "locks" it →
 * the energy core ignites → name / damage / owner resolve. Afterwards it idles (float +
 * slow rotating dials) and tilts gently with the pointer on devices that have one.
 */
export function WeaponSpotlightPanel({ spot, phase, force }: WeaponProps) {
  const { ref, revealed } = useReveal<HTMLElement>(phase, 4, force);

  const tiltRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = tiltRef.current;
    if (!el) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.setProperty("--ry", `${(x * 5).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${(-y * 4).toFixed(2)}deg`);
    });
  };
  const onLeave = () => {
    const el = tiltRef.current;
    if (!el) return;
    cancelAnimationFrame(raf.current);
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--rx", "0deg");
  };

  if (!spot) return (
    <section ref={ref} className={`weapon${revealed ? " is-in" : ""}`} aria-labelledby="wob-title">
      <header className="weapon__banner"><span className="weapon__rule weapon__rule--l" aria-hidden="true" />
        <h2 id="wob-title" className="weapon__title"><span>WEAPON OF THE BATTLE</span></h2>
        <span className="weapon__rule weapon__rule--r" aria-hidden="true" /></header>
      <div className="weapon__dais"><div className="weapon__cone" aria-hidden="true" />
        <div className="weapon__floor" aria-hidden="true" />
        <span className="art-tag">Không có sát thương từ vũ khí</span></div>
      <div className="weapon__info"><h3 className="weapon__name">KHÔNG CÓ VŨ KHÍ NỔI BẬT</h3>
        <p className="weapon__class">Trận đấu chưa ghi nhận sát thương vũ khí.</p></div>
    </section>
  );
  const { weapon, owner, damage, shareOfOwner, leadOverRunnerUp, runnerUp } = spot;

  return (
    <section
      ref={ref}
      className={`weapon${revealed ? " is-in" : ""}`}
      style={{ ...teamVars(owner), "--weapon-tier": weapon.tierColor || "var(--team)",
        "--weapon-tier-rgb": weapon.tierRgb || owner.accentRgb } as CSSProperties}
      aria-labelledby="wob-title"
    >
      <header className="weapon__banner">
        <span className="weapon__rule weapon__rule--l" aria-hidden="true" />
        <h2 id="wob-title" className="weapon__title">
          <span>WEAPON OF THE BATTLE</span>
        </h2>
        <span className="weapon__rule weapon__rule--r" aria-hidden="true" />
      </header>

      <div className="weapon__dais" onPointerMove={onMove} onPointerLeave={onLeave}>
        <div className="weapon__cone" aria-hidden="true" />
        <div className="weapon__floor" aria-hidden="true" />
        <svg className="weapon__rings" viewBox="0 0 400 400" aria-hidden="true">
          <g className="weapon__ring weapon__ring--a ac-loop">
            <circle cx="200" cy="200" r="190" className="r-ticks" />
            <circle cx="200" cy="200" r="176" className="r-line" />
          </g>
          <g className="weapon__ring weapon__ring--b ac-loop">
            <circle cx="200" cy="200" r="150" className="r-dash" />
            <path d="M200 38 L212 62 L188 62 Z" className="r-mark" />
            <path d="M200 362 L212 338 L188 338 Z" className="r-mark" />
          </g>
          <circle cx="200" cy="200" r="118" className="r-inner" />
        </svg>
        <div className="weapon__tilt" ref={tiltRef}>
          <div className="weapon__float ac-loop">
            <WeaponArt weapon={weapon} />
          </div>
        </div>
        <div className="weapon__sweep" aria-hidden="true" />
        {!weapon.artSrc && <span className="art-tag">Minh họa vũ khí · placeholder</span>}
      </div>

      <div className="weapon__info">
        <h3 className="weapon__name">
          <span className="mask">
            <span>{weapon.name}</span>
          </span>
        </h3>
        <p className="weapon__class">
          {weapon.classLabel}
          <span className="weapon__rarity" aria-label={`Độ hiếm ${weapon.tierLabel}`}>
            <i aria-hidden="true" />{weapon.tierLabel}
          </span>
        </p>

        <p className="weapon__dmg">
          <CountUp
            value={damage}
            active={revealed}
            instant={force}
            delay={1250}
            duration={1300}
            className="weapon__dmg-num"
          />
          <span className="weapon__unit">Sát thương vũ khí</span>
        </p>

        <ul className="weapon__facts">
          <li>
            <b>{shareOfOwner.toFixed(1)}%</b>
            <span>tổng sát thương cả trận</span>
          </li>
          {runnerUp && (
            <li>
              <b>+{fmt(leadOverRunnerUp)}</b>
              <span>hơn {runnerUp.weapon.name} (hạng 2)</span>
            </li>
          )}
          <li>
            <b>{weapon.stats.bestHit}</b>
            <span>đòn mạnh nhất · trúng {weapon.stats.shotsHit}/{weapon.stats.shotsFired}</span>
          </li>
        </ul>

        <p className="weapon__owner" aria-label={`Đóng góp cao nhất: ${owner.handle}`}>
          <span className="weapon__owner-dot" aria-hidden="true" />
          <span className="weapon__owner-label">Đóng góp cao nhất</span>
          <b>{owner.handle}</b>
        </p>
      </div>
    </section>
  );
}
