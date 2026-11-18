// Transizione tra le schermate (le vecchie animazioni di battaglia sono state
// sostituite da src/battle/FxCanvas.tsx e battle.css).
import type { ReactNode } from 'react';

export function ScreenTransition({ children, isTransitioning }: { children: ReactNode; isTransitioning: boolean }) {
  return (
    <div className={`transition-all duration-500 ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
      {children}
    </div>
  );
}
