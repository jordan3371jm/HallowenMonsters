// Campione di prestazioni per la telemetria Playgama (evento `performance_sample`).
// Misura i frame solo durante il gameplay attivo e visibile (le lotte) e invia
// un aggregato circa ogni 30 secondi. Un solo adattatore: trackEvent().
// La misura usa requestAnimationFrame, che costringe il browser ad aggiornare
// stili e animazioni sul thread principale a ogni frame: per non pesare sul
// gioco si misura un campione di SAMPLE_MS ogni PERIOD_MS invece che sempre.
import { trackEvent } from './playgama';

export const BUILD_VERSION = '2.6.2';
const PERIOD_MS = 30000;
const SAMPLE_MS = 6000;
const WINDOW_MS = SAMPLE_MS;

let active = false;
let raf = 0;
let pauseTimer: ReturnType<typeof setTimeout> | 0 = 0;
let last = 0;
let windowStart = 0;
let activeMs = 0;
let frames: number[] = [];
let jsErrors = 0;
let rejections = 0;

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

function flush() {
  if (frames.length < 30) { reset(); return; }
  const sorted = [...frames].sort((a, b) => a - b);
  const fpsList = frames.map(f => 1000 / Math.max(1, f)).sort((a, b) => a - b);
  const over = (ms: number) => frames.filter(f => f > ms).length;
  trackEvent('performance_sample', {
    target_fps: 60,
    window_ms: Math.round(performance.now() - windowStart),
    active_ms: Math.round(activeMs),
    frame_count: frames.length,
    fps_avg: Math.round((frames.length / Math.max(1, activeMs)) * 1000 * 10) / 10,
    fps_p10: Math.round(pct(fpsList, 10) * 10) / 10,
    frame_time_p50_ms: Math.round(pct(sorted, 50) * 10) / 10,
    frame_time_p95_ms: Math.round(pct(sorted, 95) * 10) / 10,
    frame_time_p99_ms: Math.round(pct(sorted, 99) * 10) / 10,
    frame_time_max_ms: Math.round(sorted[sorted.length - 1]),
    frames_over_50ms: over(50),
    frames_over_100ms: over(100),
    frames_over_250ms: over(250),
    frames_over_500ms: over(500),
    frames_over_1000ms: over(1000),
    js_error_count: jsErrors,
    unhandled_rejection_count: rejections,
    build_version: BUILD_VERSION,
  });
  reset();
}

function reset() {
  frames = [];
  activeMs = 0;
  jsErrors = 0;
  rejections = 0;
  windowStart = performance.now();
}

function tick(now: number) {
  if (!active) return;
  if (last && !document.hidden) {
    const dt = now - last;
    // Un intervallo lungo dopo un ritorno dallo sfondo non è un frame bloccato
    if (dt < 2000) {
      frames.push(dt);
      activeMs += dt;
    }
  }
  last = now;
  if (activeMs >= WINDOW_MS) {
    flush();
    // Pausa fino al prossimo campione (nessun requestAnimationFrame nel frattempo)
    last = 0;
    pauseTimer = setTimeout(() => {
      pauseTimer = 0;
      if (active) raf = requestAnimationFrame(tick);
    }, PERIOD_MS - SAMPLE_MS);
    return;
  }
  raf = requestAnimationFrame(tick);
}

/** Attiva/disattiva la misura (true solo durante il gameplay attivo). */
export function setPerfActive(on: boolean) {
  if (on === active) return;
  active = on;
  if (on) {
    last = 0;
    if (!windowStart) reset();
    if (!pauseTimer) raf = requestAnimationFrame(tick);
  } else {
    cancelAnimationFrame(raf);
    if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = 0; }
    last = 0;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', () => { jsErrors++; });
  window.addEventListener('unhandledrejection', () => { rejections++; });
  document.addEventListener('visibilitychange', () => { last = 0; });
}
