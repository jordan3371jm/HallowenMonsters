// Timer che non rallentano quando la pagina è nascosta.
// I browser rallentano setTimeout/setInterval delle pagine in background
// (al massimo uno al secondo, e dopo 5 minuti uno al minuto): l'autopilota si
// fermava appena il giocatore apriva un'altra finestra o un'altra scheda.
// I timer di un Web Worker non vengono rallentati, quindi qui il conto del
// tempo lo fa un piccolo worker e la funzione gira sul thread principale.
// Se il worker non si può creare (es. regole di sicurezza della pagina) si
// usano i timer normali del browser: il gioco funziona come prima.
// Stessa firma di setTimeout/setInterval: i moduli del gioco li importano al
// posto di quelli globali.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Callback = (...args: any[]) => unknown;

interface Pending {
  fn: Callback;
  ms: number;
  repeat: boolean;
  due: number;
  native?: ReturnType<typeof globalThis.setTimeout>;
}

const pending = new Map<number, Pending>();
let nextId = 1;
let worker: Worker | null = null;
let useNative = typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined';

const WORKER_SOURCE = `
const timers = new Map();
onmessage = (e) => {
  const d = e.data;
  if (d.c === 'set') {
    const run = () => postMessage(d.id);
    timers.set(d.id, { h: d.r ? setInterval(run, d.ms) : setTimeout(run, d.ms), r: d.r });
  } else {
    const t = timers.get(d.id);
    if (t) { (t.r ? clearInterval : clearTimeout)(t.h); timers.delete(d.id); }
  }
};
`;

function scheduleNative(id: number, p: Pending): void {
  const delay = Math.max(0, p.due - Date.now());
  const run = () => {
    if (!pending.has(id)) return;
    if (p.repeat) {
      p.due = Date.now() + p.ms;
      scheduleNative(id, p);
    } else {
      pending.delete(id);
    }
    p.fn();
  };
  p.native = globalThis.setTimeout(run, delay);
}

/** Il worker non funziona: tutti i timer in attesa passano a quelli del browser. */
function fallBackToNative(): void {
  if (useNative) return;
  useNative = true;
  try { worker?.terminate(); } catch { /* ignora */ }
  worker = null;
  pending.forEach((p, id) => scheduleNative(id, p));
}

function getWorker(): Worker | null {
  if (worker || useNative) return worker;
  try {
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    worker = new Worker(url);
    worker.onmessage = (e: MessageEvent<number>) => {
      const id = e.data;
      const p = pending.get(id);
      if (!p) return;
      if (p.repeat) p.due = Date.now() + p.ms;
      else pending.delete(id);
      p.fn();
    };
    worker.onerror = () => fallBackToNative();
  } catch {
    fallBackToNative();
  }
  return worker;
}

function start(fn: Callback, ms: number | undefined, repeat: boolean): number {
  const id = nextId++;
  const delay = Math.max(0, Number(ms) || 0);
  const p: Pending = { fn, ms: repeat ? Math.max(1, delay) : delay, repeat, due: Date.now() + delay };
  pending.set(id, p);
  const w = getWorker();
  if (w) {
    try {
      w.postMessage({ c: 'set', id, ms: p.ms, r: repeat });
      return id;
    } catch {
      fallBackToNative();
      return id; // fallBackToNative ha già programmato questo timer
    }
  }
  scheduleNative(id, p);
  return id;
}

function stop(id: number | undefined | null): void {
  if (id == null) return;
  const p = pending.get(id);
  if (!p) return;
  pending.delete(id);
  if (p.native !== undefined) globalThis.clearTimeout(p.native);
  if (worker) {
    try { worker.postMessage({ c: 'clear', id }); } catch { /* ignora */ }
  }
}

export function setTimeout(fn: Callback, ms?: number): number {
  return start(fn, ms, false);
}

export function setInterval(fn: Callback, ms?: number): number {
  return start(fn, ms, true);
}

export function clearTimeout(id: number | undefined | null): void {
  stop(id);
}

export function clearInterval(id: number | undefined | null): void {
  stop(id);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => { setTimeout(resolve, ms); });
}
