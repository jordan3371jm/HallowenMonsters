// Icone vettoriali dei tipi (stile badge dei giochi Pokémon): cerchio colorato
// con un glifo bianco disegnato in SVG, nitido a ogni dimensione.
import type { MonsterType } from '../types';
import { typeColors } from '../data/monsters';

const GLYPHS: Record<MonsterType, JSX.Element> = {
  fuoco: <path d="M12 3c1 3.2-1.6 4.6-1.6 7.2 0 1.2.8 2 1.8 2 1.2 0 1.8-1 1.6-2.4 2 1.4 3.2 3.4 3.2 5.6A5 5 0 0 1 12 20.4a5 5 0 0 1-5-5c0-4.4 4.6-6.6 5-12.4z" />,
  acqua: <path d="M12 3.2c3.2 4.2 5.6 7.4 5.6 10.6a5.6 5.6 0 0 1-11.2 0c0-3.2 2.4-6.4 5.6-10.6zm-2.4 10.4a2.6 2.6 0 0 0 2.6 2.8v-1.4a1.3 1.3 0 0 1-1.2-1.4z" />,
  erba: <path d="M19 4.4C11.2 4.4 6 8.6 6 14.2c0 1.4.4 2.6 1 3.6L5 20l1.2 1 2-2.2c1 .6 2.2 1 3.6 1C17.8 19.8 19.6 12 19 4.4zm-9.6 13 6.2-7.2-7 5.6z" />,
  buio: <path d="M14.8 3.6A8.4 8.4 0 1 0 20.4 15 6.8 6.8 0 0 1 14.8 3.6z" />,
  spettro: <path d="M12 3a6.4 6.4 0 0 0-6.4 6.4V20l2.1-1.6L9.8 20l2.2-1.6 2.2 1.6 2.1-1.6 2.1 1.6V9.4A6.4 6.4 0 0 0 12 3zM9.6 8.4a1.3 1.6 0 1 1 0 3.2 1.3 1.6 0 0 1 0-3.2zm4.8 0a1.3 1.6 0 1 1 0 3.2 1.3 1.6 0 0 1 0-3.2z" />,
  tuono: <path d="M13.6 2.6 5.8 13.4h5l-1.4 8 7.8-10.8h-5z" />,
  ghiaccio: <path d="M11 2.6h2v4.1l2.6-1.5 1 1.7L13 9v2.3l2-1.2 3.5-2 1 1.7-3.5 2L14 13l2 1.2 3.5 2-1 1.7-3.5-2L13 14.8V17l3.6 2.1-1 1.7-2.6-1.5v4.1h-2v-4.1l-2.6 1.5-1-1.7L11 17v-2.2l-2 1.1-3.5 2-1-1.7 3.5-2L10 13 8 11.8l-3.5-2 1-1.7 3.5 2L11 11.2V9L7.4 6.9l1-1.7L11 6.7z" />,
  veleno: <path d="M12 3a7 7 0 0 0-4 12.7V18h2v-1.6h1V18h2v-1.6h1V18h2v-2.3A7 7 0 0 0 12 3zm-2.6 9.4a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2zm5.2 0a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2zM8 19.4h8v1.6H8z" />,
  osso: <path d="M7.4 4.4a2.4 2.4 0 0 1 2.2 3.3l6.7 6.7a2.4 2.4 0 1 1 1.6 4.5 2.4 2.4 0 1 1-4.5 1.6l-6.7-6.7A2.4 2.4 0 1 1 5.1 9.2 2.4 2.4 0 1 1 7.4 4.4z" />,
  ragno: <path d="M12 8.2a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8zm0 5.4a3.4 3.6 0 1 1 0 7.2 3.4 3.6 0 0 1 0-7.2zM3.4 6.4l4.8 3.4-.6.9L3 7.6zm17.2 0 .4 1.2-4.6 3.1-.6-.9zM2.6 13h5v1h-5zm13.8 0h5v1h-5zM4 19.2l3.6-3.8.8.7-3.4 3.9zm16 0-1 .8-3.4-3.9.8-.7z" />,
  zucca: <path d="M12.8 4.2c.4-1 1.4-1.6 2.6-1.4l-.2 1.2c-.6 0-1 .3-1.2.8.8.2 1.4.4 2 .8 1-.6 2.4-.5 3.4.4 1.8 1.6 2 6.8.2 10.2-1 2-2.6 3.4-4.6 3.2-1 .6-2 .8-3 .8s-2-.2-3-.8c-2 .2-3.6-1.2-4.6-3.2C2.6 12.8 2.8 7.6 4.6 6c1-.9 2.4-1 3.4-.4.9-.6 2-1 3.2-1h1.6zM8.4 10.4 7.2 13h2.4zm7.2 0-1.2 2.6h2.4zm-6.4 4.4.8 1.2 1-1 1 1 1-1 1 1 .8-1.2z" />,
};

export function TypeIcon({ type, size = 18 }: { type: MonsterType; size?: number }) {
  return (
    <span
      className="type-icon"
      style={{ width: size, height: size, background: `radial-gradient(circle at 35% 30%, #ffffff55, transparent 60%), ${typeColors[type]}` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width={size * 0.72} height={size * 0.72} fill={type === 'osso' ? '#4a3f2a' : '#fff'}>{GLYPHS[type]}</svg>
    </span>
  );
}

export function TypeBadge({ type, label, small }: { type: MonsterType; label: string; small?: boolean }) {
  return (
    <span className={`type-badge ${small ? 'type-badge-sm' : ''}`} style={{ background: typeColors[type], color: type === 'osso' || type === 'tuono' || type === 'ghiaccio' ? '#2b2116' : '#fff' }}>
      <TypeIcon type={type} size={small ? 14 : 18} />
      {label}
    </span>
  );
}
