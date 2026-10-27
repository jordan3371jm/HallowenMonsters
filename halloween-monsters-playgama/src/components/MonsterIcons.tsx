import React from 'react';
import { getMonsterIconPath } from '../data/monsterPNGIcons';

interface MonsterIconProps {
  monsterId: string;
  emoji: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}


export default function MonsterIcon({ monsterId, emoji, size = 'md', className = '' }: MonsterIconProps) {
  const sizeMap = {
    sm: 48,
    md: 64,
    lg: 80,
    xl: 120
  };

  const pixelSize = sizeMap[size];

  // React state tracks whether the PNG failed to load, so we can
  // re-render with the SVG / emoji fallback (no DOM manipulation).
  const [pngFailed, setPngFailed] = React.useState(false);

  const pngPath = getMonsterIconPath(monsterId);
  if (pngPath && !pngFailed) {
    return (
      <div className={`inline-flex items-center justify-center ${className}`} style={{ minWidth: pixelSize, minHeight: pixelSize }}>
        <img
          src={pngPath}
          alt=""
          aria-hidden="true"
          width={pixelSize}
          height={pixelSize}
          className="object-contain"
          style={{ imageRendering: 'auto' }}
          decoding="async"
          draggable={false}
          onError={() => setPngFailed(true)}
        />
      </div>
    );
  }

  // La mappa SVG dei vecchi mostri e' stata rimossa (dead code):
  // fallback finale all'emoji con stile appropriato
  const textSizeClasses = {
    sm: 'text-4xl',
    md: 'text-5xl',
    lg: 'text-6xl',
    xl: 'text-8xl'
  };

  return (
    <span className={`${textSizeClasses[size]} emoji ${className}`} style={{ display: 'inline-block', lineHeight: 1 }}>
      {emoji}
    </span>
  );
}
