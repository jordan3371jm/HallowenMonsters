// Notifica leggera senza React, al posto di alert() (che nelle piattaforme
// iframe puo' essere bloccato o congelare il gioco).
// Le notifiche vanno in coda (una alla volta, niente sovrapposizioni) e
// compaiono sotto la fascia alta dello schermo, dove stanno il titolo
// dell'ondata, l'etichetta della lotta e il pulsante "Ferma" dell'autopilota.
import { setTimeout } from './bgTimers'; // timer che non rallentano in background

const queue: { message: string; durationMs: number }[] = [];
let showing = false;
const MAX_QUEUE = 6;

export function showToast(message: string, durationMs = 3000): void {
  if (typeof document === 'undefined') return;
  // Due messaggi uguali di fila (es. doppio clic) contano come uno
  if (queue.some(q => q.message === message)) return;
  queue.push({ message, durationMs });
  if (queue.length > MAX_QUEUE) queue.shift();
  if (!showing) next();
}

function next(): void {
  const item = queue.shift();
  if (!item) { showing = false; return; }
  showing = true;
  // Con altri messaggi in attesa ognuno resta un po' meno
  const duration = queue.length ? Math.min(item.durationMs, 2200) : item.durationMs;
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.textContent = item.message;
  Object.assign(el.style, {
    position: 'fixed',
    left: '50%',
    top: 'calc(max(0px, env(safe-area-inset-top)) + 22vh)',
    transform: 'translateX(-50%) translateY(-8px)',
    maxWidth: 'min(90vw, 420px)',
    padding: '9px 14px',
    borderRadius: '12px',
    background: 'rgba(30, 20, 50, 0.94)',
    color: '#fff',
    border: '1px solid rgba(255, 140, 0, 0.6)',
    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
    font: '600 14px/1.3 system-ui, sans-serif',
    textAlign: 'center',
    zIndex: '99999',
    opacity: '0',
    transition: 'opacity .2s ease, transform .2s ease',
    pointerEvents: 'none',
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => { el.remove(); next(); }, 220);
  }, duration);
}
