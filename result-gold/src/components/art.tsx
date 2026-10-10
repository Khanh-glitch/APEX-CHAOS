import { useId } from "react";
import type { PlayerResult, WeaponDef } from "../data/types";

/**
 * PLACEHOLDER ART — deliberately designed stand-ins, NOT official game assets.
 * Real assets plug in through `character.portraitSrc` / `weapon.artSrc`; when present,
 * these SVGs are not rendered at all.
 */

/* ───────────────────────────────────────── Heroes */

function BreacherBust({ uid }: { uid: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#434c58" />
          <stop offset="1" stopColor="#171a1f" />
        </linearGradient>
        <linearGradient id={`${uid}-glow`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--team)", stopOpacity: 0.55 }} />
          <stop offset="0.5" stopColor="#fff3dc" stopOpacity="0.95" />
          <stop offset="1" style={{ stopColor: "var(--team)", stopOpacity: 0.55 }} />
        </linearGradient>
        <radialGradient id={`${uid}-core`}>
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.35" style={{ stopColor: "var(--team)" }} />
          <stop offset="1" style={{ stopColor: "var(--team)", stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <polygon points="20,520 60,330 140,270 260,270 340,330 380,520" fill="#0d0f12" />
      {/* torso */}
      <polygon points="86,520 104,336 166,296 234,296 296,336 314,520" fill="#242930" />
      <polygon points="128,520 138,356 198,334 198,520" fill="#343b45" />
      <polygon points="272,520 262,356 202,334 202,520" fill="#2a3038" />
      <polygon points="150,282 250,282 262,330 200,350 138,330" fill="#1d2127" />
      <polygon points="176,230 224,230 230,290 170,290" fill="#121418" />
      {/* pauldrons */}
      <polygon points="34,336 84,258 160,268 176,334 156,384 52,392" fill={`url(#${uid}-steel)`} />
      <polygon points="84,258 160,268 150,296 96,290" fill="#6b7785" />
      <polygon points="44,350 60,312 72,314 58,354" style={{ fill: "var(--team)" }} />
      <polygon points="366,336 316,258 240,268 224,334 244,384 348,392" fill={`url(#${uid}-steel)`} />
      <polygon points="316,258 240,268 250,296 304,290" fill="#59636f" />
      <polygon points="356,350 340,312 328,314 342,354" style={{ fill: "var(--team)" }} />
      {/* core */}
      <circle cx="200" cy="424" r="34" fill={`url(#${uid}-core)`} opacity="0.55" />
      <circle cx="200" cy="424" r="19" fill="#090b0d" stroke="var(--team)" strokeWidth="3" />
      <circle cx="200" cy="424" r="9" fill="#fff4de" />
      <rect x="150" y="468" width="100" height="5" fill="#0b0d10" />
      <rect x="164" y="482" width="72" height="5" fill="#0b0d10" />
      {/* helmet */}
      <polygon points="200,40 266,66 290,126 284,196 250,250 150,250 116,196 110,126 134,66" fill={`url(#${uid}-steel)`} />
      <polygon points="134,66 200,40 200,122 112,128" fill="#566170" />
      <polygon points="200,40 266,66 288,126 200,122" fill="#363d48" />
      <polygon points="193,32 207,32 215,118 185,118" style={{ fill: "var(--team)" }} opacity="0.92" />
      <polygon points="116,196 150,214 152,252 130,228" fill="#2b3139" />
      <polygon points="284,196 250,214 248,252 270,228" fill="#222830" />
      <polygon points="156,196 244,196 234,248 166,248" fill="#1a1e24" />
      <g stroke="#3d4551" strokeWidth="3">
        <line x1="172" y1="210" x2="228" y2="210" />
        <line x1="174" y1="222" x2="226" y2="222" />
        <line x1="178" y1="234" x2="222" y2="234" />
      </g>
      <polygon points="130,140 270,140 284,168 258,186 142,186 116,168" fill="#06080a" />
      <polygon points="140,151 260,151 271,168 252,177 148,177 129,168" fill={`url(#${uid}-glow)`} />
      <line x1="150" y1="163" x2="250" y2="163" stroke="#fff" strokeOpacity="0.85" strokeWidth="2" />
      {/* rim light */}
      <g fill="none" stroke="var(--team)" strokeOpacity="0.75" strokeWidth="2.5" strokeLinejoin="round">
        <polyline points="134,66 110,126 116,196 150,250" />
        <polyline points="34,336 84,258 160,268" />
      </g>
      <g fill="#8794a3" opacity="0.8">
        <circle cx="146" cy="82" r="3" />
        <circle cx="254" cy="82" r="3" />
        <circle cx="76" cy="352" r="3.5" />
        <circle cx="324" cy="352" r="3.5" />
      </g>
    </>
  );
}

function WraithBust({ uid }: { uid: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b434e" />
          <stop offset="1" stopColor="#14171b" />
        </linearGradient>
        <linearGradient id={`${uid}-eye`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9fbff" />
          <stop offset="0.5" style={{ stopColor: "var(--team)" }} />
          <stop offset="1" style={{ stopColor: "var(--team)", stopOpacity: 0.35 }} />
        </linearGradient>
      </defs>
      <polygon points="24,520 70,350 150,298 250,298 330,350 376,520" fill="#0c0e11" />
      <polygon points="50,520 84,372 160,322 240,322 316,372 350,520" fill="#1c2026" />
      <polygon points="84,372 160,322 176,346 120,424" fill="#2a3038" />
      <polygon points="316,372 240,322 224,346 280,424" fill="#171b20" />
      <polygon points="170,520 176,340 224,340 230,520" fill="#111317" />
      <g stroke="var(--team)" strokeWidth="2.5" strokeOpacity="0.8">
        <line x1="188" y1="362" x2="188" y2="520" />
        <line x1="212" y1="362" x2="212" y2="520" />
      </g>
      <polygon points="192,396 200,408 208,396" style={{ fill: "var(--team)" }} />
      <polygon points="192,440 200,452 208,440" style={{ fill: "var(--team)" }} opacity="0.7" />
      <polygon points="58,378 118,306 170,300 176,354 112,406" fill={`url(#${uid}-steel)`} />
      <polygon points="342,378 282,306 230,300 224,354 288,406" fill={`url(#${uid}-steel)`} />
      <polygon points="118,306 170,300 168,322 126,326" fill="#58636f" />
      <polygon points="148,290 252,290 234,338 166,338" fill="#21262d" />
      <polygon points="180,244 220,244 224,296 176,296" fill="#0f1114" />
      {/* antennae */}
      <polygon points="116,106 84,14 108,22 130,98" fill="#2d343d" />
      <polygon points="284,106 316,14 292,22 270,98" fill="#252b33" />
      <g stroke="var(--team)" strokeWidth="3" strokeLinecap="round">
        <line x1="84" y1="14" x2="92" y2="44" />
        <line x1="316" y1="14" x2="308" y2="44" />
      </g>
      {/* hood */}
      <polygon points="200,20 270,92 292,196 264,268 136,268 108,196 130,92" fill={`url(#${uid}-steel)`} />
      <polygon points="130,92 200,20 200,142 118,196" fill="#4a5461" />
      <polygon points="200,20 270,92 284,196 200,142" fill="#292f37" />
      <polygon points="162,122 238,122 252,196 200,254 148,196" fill="#040506" />
      <polygon points="190,130 210,130 213,224 187,224" fill={`url(#${uid}-eye)`} />
      <line x1="200" y1="136" x2="200" y2="218" stroke="#fff" strokeWidth="2.5" strokeOpacity="0.9" />
      <circle cx="166" cy="178" r="3.5" style={{ fill: "var(--team)" }} />
      <circle cx="234" cy="178" r="3.5" style={{ fill: "var(--team)" }} />
      <g fill="none" stroke="var(--team)" strokeOpacity="0.75" strokeWidth="2.5" strokeLinejoin="round">
        <polyline points="130,92 108,196 136,268" />
        <polyline points="58,378 118,306 170,300" />
      </g>
    </>
  );
}

function GenericBust({ uid }: { uid: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#434c58" />
          <stop offset="1" stopColor="#171a1f" />
        </linearGradient>
      </defs>
      <polygon points="40,520 70,340 150,296 250,296 330,340 360,520" fill={`url(#${uid}-steel)`} />
      <polygon points="200,60 270,110 280,200 240,260 160,260 120,200 130,110" fill={`url(#${uid}-steel)`} />
      <rect x="150" y="150" width="100" height="14" style={{ fill: "var(--team)" }} />
    </>
  );
}

export function HeroArt({ player }: { player: PlayerResult }) {
  const uid = `h${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const { portraitSrc, artKind, name } = player.character;
  if (portraitSrc) {
    return <img className="hero__img" src={portraitSrc} alt={`${name} — ${player.handle}`} draggable={false} />;
  }
  return (
    <svg
      className="hero__svg"
      viewBox="0 0 400 520"
      preserveAspectRatio="xMidYMax meet"
      role="img"
      aria-label={`${name} — placeholder portrait`}
    >
      {artKind === "breacher" ? <BreacherBust uid={uid} /> : artKind === "wraith" ? <WraithBust uid={uid} /> : <GenericBust uid={uid} />}
    </svg>
  );
}

/* ───────────────────────────────────────── Weapons */

/** Each part carries --ax/--ay (assembly offset) and --ad (delay ms) read by motion.css. */
const part = (ax: number, ay: number, ad: number) =>
  ({ "--ax": `${ax}px`, "--ay": `${ay}px`, "--ad": ad } as React.CSSProperties);

function RailgunArt({ uid }: { uid: string }) {
  const coils = [394, 458, 522, 586];
  return (
    <>
      <defs>
        <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a4afbd" />
          <stop offset="0.35" stopColor="#5d6774" />
          <stop offset="1" stopColor="#242930" />
        </linearGradient>
        <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a414b" />
          <stop offset="1" stopColor="#14171b" />
        </linearGradient>
        <linearGradient id={`${uid}-energy`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--team)" }} />
          <stop offset="0.7" stopColor="#ffd9a0" />
          <stop offset="1" stopColor="#fff7e6" />
        </linearGradient>
      </defs>

      <g className="wp" style={part(-130, 14, 0)}>
        <polygon points="18,96 150,88 158,152 122,164 64,156 18,130" fill={`url(#${uid}-dark)`} />
        <polygon points="18,96 150,88 150,99 18,108" style={{ fill: "var(--team)" }} />
        <line x1="40" y1="124" x2="140" y2="130" stroke="#0b0d10" strokeWidth="3" />
      </g>
      <g className="wp" style={part(10, 96, 90)}>
        <polygon points="206,150 258,150 244,220 196,220" fill={`url(#${uid}-dark)`} />
        <g stroke="#0b0d10" strokeWidth="3">
          <line x1="212" y1="168" x2="252" y2="168" />
          <line x1="210" y1="182" x2="248" y2="182" />
          <line x1="208" y1="196" x2="246" y2="196" />
        </g>
      </g>
      <g className="wp" style={part(0, -90, 170)}>
        <polygon points="140,72 344,64 358,78 358,142 336,154 150,160 134,142" fill={`url(#${uid}-metal)`} />
        <polygon points="140,72 344,64 346,73 142,82" fill="#dfe6ee" opacity="0.55" />
        <rect x="188" y="92" width="116" height="42" rx="3" fill="#06080a" stroke="#5d6774" strokeWidth="2" />
        <rect className="wp-core" x="195" y="99" width="102" height="28" rx="2" fill={`url(#${uid}-energy)`} />
        <g stroke="#06080a" strokeWidth="3">
          <line x1="221" y1="99" x2="221" y2="127" />
          <line x1="247" y1="99" x2="247" y2="127" />
          <line x1="273" y1="99" x2="273" y2="127" />
        </g>
        <g fill="#0b0d10">
          <circle cx="156" cy="88" r="3.5" />
          <circle cx="338" cy="82" r="3.5" />
          <circle cx="156" cy="140" r="3.5" />
          <circle cx="334" cy="140" r="3.5" />
        </g>
      </g>
      <g className="wp" style={part(0, 90, 250)}>
        <polygon points="296,150 358,150 360,198 300,198" fill={`url(#${uid}-dark)`} />
        <rect x="308" y="166" width="12" height="5" style={{ fill: "var(--team)" }} />
        <rect x="326" y="166" width="12" height="5" fill="#fff0cf" />
      </g>
      <g className="wp" style={part(-30, -100, 300)}>
        <polygon points="176,44 300,42 314,60 168,66" fill={`url(#${uid}-dark)`} />
        <rect x="178" y="38" width="118" height="5" fill="#59626f" />
        <circle cx="308" cy="52" r="7.5" fill="#06080a" stroke="var(--team)" strokeWidth="2.5" />
        <circle cx="308" cy="52" r="3" fill="#fff4de" />
      </g>
      <g className="wp" style={part(190, 0, 360)}>
        <polygon points="350,84 624,78 616,99 350,105" fill={`url(#${uid}-metal)`} />
        <polygon points="350,115 616,109 624,130 350,136" fill={`url(#${uid}-metal)`} />
        <rect x="352" y="105" width="262" height="10" fill={`url(#${uid}-energy)`} className="wp-channel" />
      </g>
      {coils.map((x, i) => (
        <g className="wp" key={x} style={part(0, -80 + i * 6, 470 + i * 70)}>
          <rect x={x} y="66" width="20" height="82" rx="4" fill="#161a1f" stroke="var(--team)" strokeWidth="2.5" />
          <rect x={x + 7} y="72" width="6" height="70" style={{ fill: "var(--team)" }} opacity="0.65" className="wp-coil" />
        </g>
      ))}
      <g className="wp" style={part(140, 0, 760)}>
        <polygon points="606,72 640,82 640,126 606,138" fill={`url(#${uid}-dark)`} />
        <line x1="612" y1="105" x2="640" y2="105" stroke="#fff0cf" strokeWidth="3" />
      </g>
    </>
  );
}

function GenericWeaponArt({ uid }: { uid: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9aa5b3" />
          <stop offset="0.4" stopColor="#59626f" />
          <stop offset="1" stopColor="#242930" />
        </linearGradient>
      </defs>
      <g className="wp" style={part(-100, 10, 0)}>
        <polygon points="40,96 170,92 176,150 70,156 40,130" fill="#2b3139" />
      </g>
      <g className="wp" style={part(0, 90, 120)}>
        <polygon points="206,150 258,150 244,216 196,216" fill="#232830" />
      </g>
      <g className="wp" style={part(0, -80, 220)}>
        <polygon points="150,76 380,70 394,86 394,138 372,150 160,156 144,140" fill={`url(#${uid}-metal)`} />
        <rect x="200" y="94" width="96" height="30" rx="3" fill="#06080a" />
        <rect x="206" y="100" width="84" height="18" style={{ fill: "var(--team)" }} opacity="0.8" />
      </g>
      <g className="wp" style={part(160, 0, 340)}>
        <polygon points="388,98 600,94 606,106 606,118 388,122" fill={`url(#${uid}-metal)`} />
        <rect x="596" y="90" width="38" height="34" fill="#2b3139" />
      </g>
    </>
  );
}

export function WeaponArt({ weapon }: { weapon: WeaponDef }) {
  const uid = `w${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (weapon.artSrc) {
    return <img className="wart wart--img" src={weapon.artSrc} alt={weapon.name} draggable={false} />;
  }
  return (
    <svg
      className="wart"
      viewBox="0 0 640 230"
      role="img"
      aria-label={`${weapon.name} — placeholder illustration`}
      preserveAspectRatio="xMidYMid meet"
    >
      {weapon.silhouette === "railgun" ? <RailgunArt uid={uid} /> : <GenericWeaponArt uid={uid} />}
    </svg>
  );
}
