import React from 'react';
import {
  Radar,
  Droplet,
  Hammer,
  Zap,
  Axe,
  Gem,
  Target,
  Skull,
  Eye,
  Hand,
  Flame,
  CircleDot,
  Waypoints,
  Shell,
  Gauge,
  List,
  Binoculars,
  Focus,
  Sword,
  Repeat,
  Package,
  HeartPulse,
  Shield,
  Mountain,
  Ghost,
  Recycle,
  Wind,
  Layers,
  HeartCrack,
  TrendingUp,
  Feather,
  Cpu,
  Footprints,
  Puzzle,
  Link,
  Syringe,
  Hourglass,
  Swords,
  Rabbit,
  Dices,
  Siren,
  Bot,
  Bug,
  Diamond,
  Magnet,
  Snowflake,
  ScanFace,
  CloudHail,
  Timer,
  Award,
  Sparkles,
  Lock,
  Check,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowUpRight,
  SlidersHorizontal,
  Compass,
  Volume2,
  VolumeX,
  Crosshair,
  Activity,
  Crown,
} from 'lucide-react';

const MASTERY_ICON_MAP = Object.freeze({
  Radar,
  Droplet,
  Hammer,
  Zap,
  Axe,
  Gem,
  Target,
  Skull,
  Eye,
  Hand,
  Flame,
  CircleDot,
  Waypoints,
  Shell,
  Gauge,
  List,
  Binoculars,
  Focus,
  Sword,
  Repeat,
  Package,
  HeartPulse,
  Shield,
  Mountain,
  Ghost,
  Recycle,
  Wind,
  Layers,
  HeartCrack,
  TrendingUp,
  Feather,
  Cpu,
  Footprints,
  Puzzle,
  Link,
  Syringe,
  Hourglass,
  Swords,
  Rabbit,
  Dices,
  Siren,
  Bot,
  Bug,
  Diamond,
  Magnet,
  Snowflake,
  ScanFace,
  CloudHail,
  Timer,
});

export function MasteryVectorIcon({ name, size = 22, strokeWidth = 2.25, className = '' }) {
  const IconComponent = MASTERY_ICON_MAP[name] || Award;
  return (
    <IconComponent
      size={size}
      strokeWidth={strokeWidth}
      className={`apex-vector-icon ${className}`.trim()}
      aria-hidden="true"
    />
  );
}

export function ApexCreditCoinIcon({ size = 28, className = '' }) {
  const uid = React.useId ? React.useId().replace(/:/g, '') : 'ac';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      className={`apex-ac-coin-svg ${className}`.trim()}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`acRim-${uid}`} x1="4" y1="2" x2="32" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF6D6" />
          <stop offset="30%" stopColor="#FFC84A" />
          <stop offset="68%" stopColor="#D48318" />
          <stop offset="100%" stopColor="#6E3B04" />
        </linearGradient>
        <linearGradient id={`acCore-${uid}`} x1="8" y1="6" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B2309" />
          <stop offset="50%" stopColor="#1C1105" />
          <stop offset="100%" stopColor="#0E0803" />
        </linearGradient>
        <linearGradient id={`acGlyph-${uid}`} x1="12" y1="9" x2="24" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF9E6" />
          <stop offset="45%" stopColor="#FFD264" />
          <stop offset="100%" stopColor="#E08A1E" />
        </linearGradient>
      </defs>
      {/* Outer Hexagonal Rim */}
      <polygon
        points="18,1.8 32.2,9.9 32.2,26.1 18,34.2 3.8,26.1 3.8,9.9"
        fill={`url(#acRim-${uid})`}
        stroke="#FFF3C4"
        strokeWidth="0.9"
        strokeOpacity="0.65"
      />
      {/* Inner recessed Obsidian-Bronze Core */}
      <polygon
        points="18,5.2 29.2,11.6 29.2,24.4 18,30.8 6.8,24.4 6.8,11.6"
        fill={`url(#acCore-${uid})`}
        stroke="#FFB940"
        strokeWidth="0.8"
        strokeOpacity="0.5"
      />
      {/* Corner Facet Accents */}
      <circle cx="18" cy="7.4" r="1" fill="#FFE699" opacity="0.8" />
      <circle cx="18" cy="28.6" r="1" fill="#FFE699" opacity="0.6" />
      {/* Stylized APEX "A" Emblem */}
      <path
        d="M18 10.2L24.2 24.4H20.9L19.6 21.2H16.4L15.1 24.4H11.8L18 10.2ZM18 14.8L16.9 18.2H19.1L18 14.8Z"
        fill={`url(#acGlyph-${uid})`}
      />
    </svg>
  );
}

export function ApexImpulseBoltIcon({ size = 15, deflect = false, className = '' }) {
  if (deflect) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path
          d="M12 2L20 6V12.5C20 17.4 16.6 20.9 12 22C7.4 20.9 4 17.4 4 12.5V6L12 2Z"
          fill="rgba(110, 255, 211, 0.22)"
          stroke="#6EFFD3"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="M13 7L9 13H13L11 17L15 11H11L13 7Z" fill="#FFFFFF" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M13.5 2L4.5 13.5H11.5L10.2 22L19.5 10.5H12.5L13.5 2Z"
        fill="currentColor"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ApexArenaCrestIcon({ themeId = '', size = 13, color = '#f0a642' }) {
  const id = String(themeId || '').toLowerCase();
  if (id.includes('cryo') || id.includes('ice') || id.includes('vault')) {
    return <Snowflake size={size} strokeWidth={2.4} style={{ color }} aria-hidden="true" />;
  }
  if (id.includes('rail') || id.includes('lorentz') || id.includes('train')) {
    return <Zap size={size} strokeWidth={2.4} style={{ color }} aria-hidden="true" />;
  }
  if (id.includes('prism') || id.includes('obsidian') || id.includes('sanctum')) {
    return <Diamond size={size} strokeWidth={2.4} style={{ color }} aria-hidden="true" />;
  }
  if (id.includes('pro') || id.includes('tour') || id.includes('apex')) {
    return <Crown size={size} strokeWidth={2.4} style={{ color }} aria-hidden="true" />;
  }
  return <Cpu size={size} strokeWidth={2.4} style={{ color }} aria-hidden="true" />;
}

export function ApexSkinEmblemIcon({ skinId = '', kind = 'hero', size = 28 }) {
  if (skinId === 'ecobot') {
    return <Recycle size={size} strokeWidth={2.2} aria-hidden="true" />;
  }
  if (skinId === 'vua-he') {
    return <Sparkles size={size} strokeWidth={2.2} aria-hidden="true" />;
  }
  return kind === 'weapon' ? (
    <Crosshair size={size} strokeWidth={2.2} aria-hidden="true" />
  ) : (
    <Award size={size} strokeWidth={2.2} aria-hidden="true" />
  );
}

export {
  Sparkles,
  Lock,
  Check,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowUpRight,
  SlidersHorizontal,
  Compass,
  Volume2,
  VolumeX,
  Crosshair,
  Activity,
  Crown,
  Shield,
  Swords,
  Flame,
  Zap,
  Target,
  Award,
};
