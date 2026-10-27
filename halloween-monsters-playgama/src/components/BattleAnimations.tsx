import { useState, useEffect } from 'react';
import { MonsterType } from '../types';

type AnimationType = 'idle' | 'attack' | 'hit' | 'death' | 'special' | 'heal' | 'status';

interface BattleAnimationProps {
  type: AnimationType;
  moveType?: MonsterType;
  isPlayer?: boolean;
  onComplete?: () => void;
}

// Colori per tipo di mossa
const typeColors: Record<MonsterType, string> = {
  fuoco: '#ff4500',
  acqua: '#1e90ff',
  erba: '#32cd32',
  buio: '#4b0082',
  spettro: '#9370db',
  tuono: '#ffd700',
  ghiaccio: '#87ceeb',
  veleno: '#9400d3',
  osso: '#f5f5dc',
  ragno: '#2f4f4f',
  zucca: '#ff8c00',
};

export default function BattleAnimation({ type, moveType, isPlayer = true, onComplete }: BattleAnimationProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (type !== 'idle') {
      const timer = setTimeout(() => {
        setVisible(false);
        if (onComplete) onComplete();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [type, onComplete]);

  if (!visible || type === 'idle') return null;

  const color = moveType ? typeColors[moveType] : '#ffffff';
  const direction = isPlayer ? 'right' : 'left';

  // Animazioni di attacco
  if (type === 'attack') {
    return (
      <div className="absolute inset-0 pointer-events-none z-20">
        {/* Slash effect */}
        <div
          className="absolute w-32 h-32 animate-slash"
          style={{
            top: '50%',
            [direction === 'right' ? 'right' : 'left']: '30%',
            transform: 'translateY(-50%)',
          }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <path
              d="M 20 80 L 80 20"
              stroke={color}
              strokeWidth="4"
              fill="none"
              className="animate-draw-line"
              style={{ filter: `drop-shadow(0 0 10px ${color})` }}
            />
            <path
              d="M 30 70 L 70 30"
              stroke={color}
              strokeWidth="3"
              fill="none"
              opacity="0.7"
              className="animate-draw-line-delayed"
              style={{ filter: `drop-shadow(0 0 8px ${color})` }}
            />
          </svg>
        </div>
        {/* Impact flash */}
        <div
          className="absolute w-24 h-24 rounded-full animate-impact"
          style={{
            top: '50%',
            [direction === 'right' ? 'right' : 'left']: '35%',
            transform: 'translateY(-50%)',
            background: `radial-gradient(circle, ${color}88, transparent)`,
          }}
        />
      </div>
    );
  }

  // Animazione di esplosione
  if (type === 'special') {
    return (
      <div className="absolute inset-0 pointer-events-none z-20">
        {/* Explosion particles */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-4 h-4 rounded-full animate-particle"
            style={{
              top: '50%',
              left: '50%',
              background: color,
              boxShadow: `0 0 10px ${color}`,
              animationDelay: `${i * 0.05}s`,
              transform: `rotate(${i * 45}deg) translateX(50px)`,
            }}
          />
        ))}
        {/* Central explosion */}
        <div
          className="absolute w-40 h-40 rounded-full animate-explosion"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, ${color}, transparent)`,
          }}
        />
      </div>
    );
  }

  // Animazione di danno ricevuto
  if (type === 'hit') {
    return (
      <div className="absolute inset-0 pointer-events-none z-20">
        <div className="absolute inset-0 animate-hit-flash bg-red-500/30" />
        {/* Damage numbers */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-damage-number">
          <span className="text-4xl font-bold text-red-500" style={{ textShadow: '0 0 10px rgba(255,0,0,0.8)' }}>
            💥
          </span>
        </div>
      </div>
    );
  }

  // Animazione di morte
  if (type === 'death') {
    return (
      <div className="absolute inset-0 pointer-events-none z-20">
        <div className="absolute inset-0 animate-death-fade bg-black/50" />
        {/* Dissolve particles */}
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full animate-dissolve"
            style={{
              top: `${30 + Math.random() * 40}%`,
              left: `${30 + Math.random() * 40}%`,
              background: '#666',
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    );
  }

  // Animazione di cura
  if (type === 'heal') {
    return (
      <div className="absolute inset-0 pointer-events-none z-20">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute text-2xl animate-heal-particle"
            style={{
              left: `${20 + Math.random() * 60}%`,
              animationDelay: `${i * 0.15}s`,
            }}
          >
            ✨
          </div>
        ))}
        <div
          className="absolute inset-0 animate-heal-glow"
          style={{
            background: 'radial-gradient(circle, rgba(0,255,100,0.3), transparent)',
          }}
        />
      </div>
    );
  }

  // Animazione di status
  if (type === 'status') {
    return (
      <div className="absolute inset-0 pointer-events-none z-20">
        <div className="absolute inset-0 animate-status-pulse" style={{ background: `${color}33` }} />
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 rounded-full animate-status-orb"
            style={{
              top: `${30 + Math.random() * 40}%`,
              left: `${30 + Math.random() * 40}%`,
              background: color,
              boxShadow: `0 0 15px ${color}`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    );
  }

  return null;
}

// Componente per shake screen dinamico
export function useScreenShake() {
  const [shake, setShake] = useState(false);
  const [intensity, setIntensity] = useState(5);

  const triggerShake = (level: 'light' | 'medium' | 'heavy' = 'medium') => {
    const intensities = { light: 3, medium: 6, heavy: 10 };
    setIntensity(intensities[level]);
    setShake(true);
    setTimeout(() => setShake(false), 300);
  };

  return { shake, intensity, triggerShake };
}

// Componente per transizioni fluide
export function ScreenTransition({ children, isTransitioning }: { children: React.ReactNode; isTransitioning: boolean }) {
  return (
    <div className={`transition-all duration-500 ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
      {children}
    </div>
  );
}
