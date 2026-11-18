import React from 'react';

// APEX unified icon set — one 24px grid, 1.8 stroke, square caps + a single
// amber/cyan duotone accent. Replaces ad-hoc emoji/unicode glyphs in floating
// UI so every notice, panel and button speaks the same visual language.
const P = {
  coin: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="12" cy="12" r="5.6" className="apx-i-soft" />
      <path d="M9.6 15.6 12 8.4l2.4 7.2M10.5 13.4h3" className="apx-i-accent" />
    </>
  ),
  trophy: (
    <>
      <path d="M7.5 4h9v5.2a4.5 4.5 0 0 1-9 0V4Z" />
      <path d="M7.5 6H4.4c0 3 1.2 4.6 3.4 5M16.5 6h3.1c0 3-1.2 4.6-3.4 5" className="apx-i-soft" />
      <path d="M12 13.7V17M8.6 20h6.8M9.8 17h4.4" className="apx-i-accent" />
    </>
  ),
  star: <path d="m12 3.2 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8L12 3.2Z" className="apx-i-accent" />,
  bolt: <path d="M13.4 2.6 5.2 13.4h5.4l-1 8 8.2-11h-5.4l1-7.8Z" className="apx-i-accent" />,
  shield: (
    <>
      <path d="M12 2.8 4.6 5.6v5.7c0 4.4 3 8.2 7.4 9.8 4.4-1.6 7.4-5.4 7.4-9.8V5.6L12 2.8Z" />
      <path d="m8.6 11.8 2.4 2.4 4.4-4.6" className="apx-i-accent" />
    </>
  ),
  lock: (
    <>
      <rect x="5.4" y="10.4" width="13.2" height="9.8" rx="1.2" />
      <path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6" className="apx-i-soft" />
      <path d="M12 14.2v2.4" className="apx-i-accent" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="m7.8 12.4 3 3 5.6-6" className="apx-i-accent" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 11v5.4" className="apx-i-accent" />
      <circle cx="12" cy="7.8" r=".6" className="apx-i-accent" />
    </>
  ),
  warn: (
    <>
      <path d="M12 3.4 21.2 19.6H2.8L12 3.4Z" />
      <path d="M12 9.6v4.6" className="apx-i-accent" />
      <circle cx="12" cy="16.9" r=".6" className="apx-i-accent" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  help: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M9.4 9.6a2.7 2.7 0 1 1 3.9 2.4c-.9.5-1.3 1-1.3 2" className="apx-i-accent" />
      <circle cx="12" cy="16.9" r=".6" className="apx-i-accent" />
    </>
  ),
  skin: (
    <>
      <path d="M8.4 3.6 3.2 6.4l2.2 4 2.2-1V20.4h8.8V9.4l2.2 1 2.2-4-5.2-2.8c-.5 1.5-1.9 2.4-3.6 2.4S8.9 5.1 8.4 3.6Z" />
      <path d="M10 13.4h4" className="apx-i-accent" />
    </>
  ),
  gift: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="1" />
      <path d="M3 9h18v3.2H3zM12 9v11" className="apx-i-soft" />
      <path d="M12 9S9.2 8.6 8.4 6.8 9.6 4 11 5.4 12 9 12 9Zm0 0s2.8-.4 3.6-2.2S14.4 4 13 5.4 12 9 12 9Z" className="apx-i-accent" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="12" cy="12" r="4.4" className="apx-i-soft" />
      <path d="M12 1.8v4.4M12 17.8v4.4M1.8 12h4.4M17.8 12h4.4" className="apx-i-accent" />
    </>
  ),
  swords: (
    <>
      <path d="m4 4 7.6 7.6M20 4l-7.6 7.6" />
      <path d="m3.4 20.6 4-4m-1.6-1.6 3.2 3.2m12-1.6-4-4m1.6-1.6-3.2 3.2" className="apx-i-accent" />
    </>
  ),
  arrow: <path d="M5 12h13m-5-5.4 5.4 5.4-5.4 5.4" className="apx-i-accent" />,
  refresh: (
    <>
      <path d="M19.6 12a7.6 7.6 0 1 1-2.4-5.5" />
      <path d="M19.8 3.8v4.6h-4.6" className="apx-i-accent" />
    </>
  ),
  fault: (
    <>
      <path d="M12 2.6 20.6 7.4v9.2L12 21.4 3.4 16.6V7.4L12 2.6Z" />
      <path d="M12 8v5" className="apx-i-accent" />
      <circle cx="12" cy="16" r=".7" className="apx-i-accent" />
    </>
  ),
};

export const APEX_ICON_NAMES = Object.keys(P);

export default function ApexIcon({ name, size = 22, className = '', title }) {
  const body = P[name] || P.info;
  return (
    <svg
      className={`apx-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="square"
      strokeLinejoin="miter"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      aria-label={title}
      focusable="false"
    >
      {body}
    </svg>
  );
}
