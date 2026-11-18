// Copia profonda di dati semplici (oggetti, array, numeri, stringhe, booleani).
// Prende il posto di JSON.parse(JSON.stringify(...)): stesso risultato per lo
// stato del gioco, ma molte volte più veloce. Il motore di battaglia copia lo
// stato a ogni messaggio della lotta (per le animazioni), quindi conta.
// Come la versione JSON salta le proprietà undefined e le funzioni.
export function clone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const out = new Array(value.length);
    for (let i = 0; i < value.length; i++) {
      const v = value[i];
      // JSON trasforma undefined/funzioni negli array in null
      out[i] = v === undefined || typeof v === 'function' ? null : clone(v);
    }
    return out as T;
  }
  const out: Record<string, unknown> = {};
  for (const key in value as Record<string, unknown>) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const v = (value as Record<string, unknown>)[key];
    if (v === undefined || typeof v === 'function') continue;
    out[key] = typeof v === 'object' && v !== null ? clone(v) : v;
  }
  return out as T;
}
