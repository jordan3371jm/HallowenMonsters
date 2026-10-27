import React from 'react';

// ============================================================
// Icone UI in SVG inline: identiche su PC, mobile e qualsiasi OS
// (le emoji Unicode 13+ come la moneta o la lapide non vengono
// renderizzate da molti browser desktop, risultando invisibili)
// ============================================================

interface IconProps {
  size?: number;
  className?: string;
}

/** Moneta maledetta: moneta d'oro con gemma viola */
export const CoinIcon: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <defs>
      <radialGradient id="coinGold" cx="35%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#fff3b0" />
        <stop offset="45%" stopColor="#f6c453" />
        <stop offset="100%" stopColor="#c07a17" />
      </radialGradient>
      <linearGradient id="coinGem" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#c084fc" />
        <stop offset="100%" stopColor="#6d28d9" />
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="28" fill="url(#coinGold)" stroke="#8a5a12" strokeWidth="3.5" />
    <circle cx="32" cy="32" r="21.5" fill="none" stroke="#a0670f" strokeWidth="2" opacity="0.85" />
    <circle cx="32" cy="32" r="19" fill="none" stroke="#ffe9a8" strokeWidth="1.4" opacity="0.8" />
    {/* gemma viola centrale */}
    <polygon points="32,20 41,27 38,40 26,40 23,27" fill="url(#coinGem)" stroke="#4c1d95" strokeWidth="2" strokeLinejoin="round" />
    <polygon points="32,23 37,28 35,36 29,36 27,28" fill="#e9d5ff" opacity="0.45" />
    {/* bagliori */}
    <path d="M19 15 l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6 z" fill="#ffffff" opacity="0.9" />
    <path d="M45 40 l1.1 2.3 2.3 1.1 -2.3 1.1 -1.1 2.3 -1.1 -2.3 -2.3 -1.1 2.3 -1.1 z" fill="#ffffff" opacity="0.7" />
  </svg>
);

/** Negozio: bancarella con tenda stregata */
export const ShopIcon: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <defs>
      <linearGradient id="shopAwning" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a855f7" />
        <stop offset="100%" stopColor="#7e22ce" />
      </linearGradient>
      <linearGradient id="shopBody" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3b0764" />
        <stop offset="100%" stopColor="#1e0933" />
      </linearGradient>
    </defs>
    {/* corpo negozio */}
    <rect x="12" y="28" width="40" height="26" rx="3" fill="url(#shopBody)" stroke="#a855f7" strokeWidth="2.5" />
    {/* tenda */}
    <path d="M8 28 L14 12 h36 l6 16 z" fill="url(#shopAwning)" stroke="#d8b4fe" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M8 28 a5 5 0 0 0 10 0 a5 5 0 0 0 10 0 a5 5 0 0 0 10 0 a5 5 0 0 0 10 0 a5 5 0 0 0 10 0 a5 5 0 0 0 10 0" fill="url(#shopAwning)" stroke="#d8b4fe" strokeWidth="2" />
    {/* insegna zucca */}
    <circle cx="32" cy="20" r="5.5" fill="#fb923c" stroke="#c2410c" strokeWidth="1.6" />
    <path d="M30 19 l1.5 2 1.5-2" stroke="#422006" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    {/* porta con luce */}
    <rect x="26" y="38" width="12" height="16" rx="2" fill="#facc15" stroke="#a16207" strokeWidth="2" />
    <circle cx="35" cy="46" r="1.4" fill="#713f12" />
    {/* finestre */}
    <rect x="15" y="35" width="7" height="7" rx="1.5" fill="#facc15" opacity="0.9" />
    <rect x="42" y="35" width="7" height="7" rx="1.5" fill="#facc15" opacity="0.9" />
  </svg>
);

/** Bersaglio (obiettivi giornalieri) */
export const TargetIcon: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <circle cx="30" cy="34" r="22" fill="#eff6ff" stroke="#1d4ed8" strokeWidth="3" />
    <circle cx="30" cy="34" r="14.5" fill="#3b82f6" />
    <circle cx="30" cy="34" r="7.5" fill="#eff6ff" />
    <circle cx="30" cy="34" r="3" fill="#ef4444" />
    {/* freccia */}
    <line x1="36" y1="28" x2="54" y2="10" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
    <polygon points="54,10 45,11 53,19" fill="#f59e0b" />
    <polygon points="54,10 53,19 45,11" fill="none" />
  </svg>
);

/** Trofeo (obiettivi/achievements) */
export const TrophyIcon: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <defs>
      <linearGradient id="trophyGold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fde047" />
        <stop offset="100%" stopColor="#ca8a04" />
      </linearGradient>
    </defs>
    {/* manici */}
    <path d="M14 14 h-2 a8 8 0 0 0 8 12" fill="none" stroke="#ca8a04" strokeWidth="4" strokeLinecap="round" />
    <path d="M50 14 h2 a8 8 0 0 1 -8 12" fill="none" stroke="#ca8a04" strokeWidth="4" strokeLinecap="round" />
    {/* coppa */}
    <path d="M14 10 h36 v12 a18 18 0 0 1 -36 0 z" fill="url(#trophyGold)" stroke="#a16207" strokeWidth="2.5" />
    {/* stella */}
    <path d="M32 16 l2.4 4.8 5.3.8 -3.8 3.7 .9 5.3 -4.8 -2.5 -4.8 2.5 .9 -5.3 -3.8 -3.7 5.3 -.8 z" fill="#fff7cc" stroke="#a16207" strokeWidth="1" />
    {/* stelo e base */}
    <rect x="28" y="38" width="8" height="7" fill="#ca8a04" />
    <rect x="20" y="45" width="24" height="6" rx="2" fill="url(#trophyGold)" stroke="#a16207" strokeWidth="2" />
    <rect x="16" y="51" width="32" height="5" rx="2" fill="#a16207" />
  </svg>
);

/** Grafico a barre (statistiche) */
export const ChartIcon: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <rect x="10" y="34" width="10" height="20" rx="2" fill="#22d3ee" stroke="#0e7490" strokeWidth="2" />
    <rect x="27" y="24" width="10" height="30" rx="2" fill="#67e8f9" stroke="#0e7490" strokeWidth="2" />
    <rect x="44" y="14" width="10" height="40" rx="2" fill="#a5f3fc" stroke="#0e7490" strokeWidth="2" />
    <polyline points="8,26 24,18 40,12 56,6" stroke="#f472b6" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    <polygon points="56,6 47,6 55,14" fill="#f472b6" />
  </svg>
);

/** Ingranaggio (impostazioni) */
export const GearIcon: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <defs>
      <linearGradient id="gearMetal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#d1d5db" />
        <stop offset="100%" stopColor="#6b7280" />
      </linearGradient>
    </defs>
    <g fill="url(#gearMetal)" stroke="#374151" strokeWidth="2">
      <circle cx="32" cy="32" r="16" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <rect key={deg} x="28.5" y="6" width="7" height="12" rx="2" transform={`rotate(${deg} 32 32)`} />
      ))}
    </g>
    <circle cx="32" cy="32" r="7" fill="#1f2937" stroke="#9ca3af" strokeWidth="2.5" />
  </svg>
);

/** Play (inizia partita) */
export const PlayIcon: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <circle cx="32" cy="32" r="27" fill="rgba(255,255,255,0.18)" stroke="#ffffff" strokeWidth="3" />
    <polygon points="26,20 46,32 26,44" fill="#ffffff" strokeLinejoin="round" />
  </svg>
);

/** Ciak / video (pubblicita' premiate) */
export const FilmIcon: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <rect x="8" y="22" width="48" height="32" rx="5" fill="#1f2937" stroke="#facc15" strokeWidth="2.5" />
    <path d="M10 22 L16 10 h40 l-6 12 z" fill="#374151" stroke="#facc15" strokeWidth="2.5" strokeLinejoin="round" />
    <line x1="22" y1="12.5" x2="18" y2="20" stroke="#facc15" strokeWidth="2.5" />
    <line x1="34" y1="12.5" x2="30" y2="20" stroke="#facc15" strokeWidth="2.5" />
    <line x1="46" y1="12.5" x2="42" y2="20" stroke="#facc15" strokeWidth="2.5" />
    <polygon points="27,31 43,38 27,45" fill="#facc15" strokeLinejoin="round" />
  </svg>
);

/** Lapide (meta negozio / cimitero) */
export const TombstoneIcon: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <defs>
      <linearGradient id="tombStone" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#9ca3af" />
        <stop offset="100%" stopColor="#4b5563" />
      </linearGradient>
    </defs>
    <path d="M16 54 V24 a16 16 0 0 1 32 0 V54 Z" fill="url(#tombStone)" stroke="#1f2937" strokeWidth="3" strokeLinejoin="round" />
    <rect x="11" y="52" width="42" height="6" rx="3" fill="#374151" stroke="#1f2937" strokeWidth="2" />
    {/* battito RIP stilizzato */}
    <path d="M24 34 h16 M32 26 v8" stroke="#e5e7eb" strokeWidth="3" strokeLinecap="round" />
    <circle cx="32" cy="42" r="3.5" fill="#a855f7" opacity="0.9" />
    {/* crepa */}
    <path d="M40 26 l-3 5 4 4 -3 5" stroke="#1f2937" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);

/** Freccia indietro */
export const BackIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <circle cx="32" cy="32" r="27" fill="rgba(255,255,255,0.08)" stroke="currentColor" strokeWidth="3" />
    <polyline points="36,20 24,32 36,44" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);
