// Notifica leggera senza React, al posto di alert() (che nelle piattaforme
// iframe puo' essere bloccato o congelare il gioco).
export function showToast(message: string, durationMs = 3500): void {
  if (typeof document === 'undefined') return;
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.textContent = message;
  Object.assign(el.style, {
    position: 'fixed',
    left: '50%',
    top: 'max(16px, env(safe-area-inset-top))',
    transform: 'translateX(-50%) translateY(-12px)',
    maxWidth: '90vw',
    padding: '12px 18px',
    borderRadius: '12px',
    background: 'rgba(30, 20, 50, 0.96)',
    color: '#fff',
    border: '1px solid rgba(255, 140, 0, 0.6)',
    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
    font: '600 15px system-ui, sans-serif',
    textAlign: 'center',
    zIndex: '99999',
    opacity: '0',
    transition: 'opacity .25s ease, transform .25s ease',
    pointerEvents: 'none',
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, durationMs);
}
