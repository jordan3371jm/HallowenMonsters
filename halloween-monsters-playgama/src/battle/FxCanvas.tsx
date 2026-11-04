// Effetti visivi di battaglia su canvas: particelle per ogni tipo di mossa,
// proiettili, cure, modificatori, stati e cattura. Leggero (un solo canvas,
// requestAnimationFrame attivo solo mentre ci sono particelle).
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export type FxKind =
  | 'fuoco' | 'acqua' | 'erba' | 'buio' | 'spettro' | 'tuono' | 'ghiaccio' | 'veleno' | 'osso' | 'ragno' | 'zucca'
  | 'heal' | 'statup' | 'statdown' | 'magic' | 'stars' | 'smoke' | 'gold' | 'hit';

type Shape = 'glow' | 'spark' | 'leaf' | 'shard' | 'bone' | 'ring' | 'bolt' | 'web' | 'seed' | 'smoke' | 'plus' | 'arrow' | 'star' | 'wisp';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string; shape: Shape;
  rot: number; vr: number; gravity: number; drag: number; additive: boolean; grow: number;
  points?: { x: number; y: number }[];
}

export interface FxHandle {
  burst: (kind: FxKind, x: number, y: number, power?: number) => void;
  projectile: (kind: FxKind, from: { x: number; y: number }, to: { x: number; y: number }, durationMs: number) => void;
  aura: (kind: FxKind, x: number, y: number) => void;
}

const PALETTE: Record<FxKind, string[]> = {
  fuoco: ['#fff1a8', '#ffb340', '#ff6a00', '#ff2d00'],
  acqua: ['#e6fbff', '#8fe3ff', '#3aa8ff', '#1f5fff'],
  erba: ['#d9ff9a', '#8be04e', '#3fae3a', '#1f7a35'],
  buio: ['#8a3cff', '#4b1580', '#24063f', '#000000'],
  spettro: ['#f3e6ff', '#c79bff', '#9a5cff', '#6a2bd9'],
  tuono: ['#ffffff', '#fff7a8', '#ffe14d', '#ffc400'],
  ghiaccio: ['#ffffff', '#dff8ff', '#a8e9ff', '#6cc9ff'],
  veleno: ['#f2b8ff', '#d070ff', '#9b30d9', '#5e138f'],
  osso: ['#fffaf0', '#f2e6c8', '#d9c79c', '#b8a375'],
  ragno: ['#ffffff', '#dddddd', '#9a9a9a', '#3a3a3a'],
  zucca: ['#ffe2a8', '#ffb347', '#ff8000', '#c45200'],
  heal: ['#eaffea', '#9dff9d', '#3ddc84', '#16a34a'],
  statup: ['#ffd1c1', '#ff8a65', '#ff5722', '#e64a19'],
  statdown: ['#c7ddff', '#7fb2ff', '#3b82f6', '#1d4ed8'],
  magic: ['#ffffff', '#ffd6ff', '#ff9cf5', '#b44bff'],
  stars: ['#ffffff', '#fff6b0', '#ffd84d', '#ffb300'],
  smoke: ['#d8d0e8', '#a99cc0', '#776a8f', '#4a3f5e'],
  gold: ['#ffffff', '#fff3b0', '#ffd700', '#ffa000'],
  hit: ['#ffffff', '#fff2cc', '#ffd27a', '#ff9f43'],
};

const SHAPES: Record<FxKind, Shape[]> = {
  fuoco: ['glow', 'glow', 'spark'],
  acqua: ['ring', 'glow', 'glow'],
  erba: ['leaf', 'leaf', 'glow'],
  buio: ['smoke', 'spark', 'glow'],
  spettro: ['wisp', 'glow', 'ring'],
  tuono: ['bolt', 'spark', 'glow'],
  ghiaccio: ['shard', 'shard', 'spark'],
  veleno: ['ring', 'glow', 'smoke'],
  osso: ['bone', 'spark', 'glow'],
  ragno: ['web', 'spark', 'glow'],
  zucca: ['seed', 'glow', 'spark'],
  heal: ['plus', 'glow', 'spark'],
  statup: ['arrow', 'glow'],
  statdown: ['arrow', 'glow'],
  magic: ['star', 'glow', 'spark'],
  stars: ['star', 'spark'],
  smoke: ['smoke'],
  gold: ['star', 'spark', 'glow'],
  hit: ['spark', 'glow'],
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pickOf = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

const FxCanvas = forwardRef<FxHandle, { enabled: boolean }>(function FxCanvas({ enabled }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const raf = useRef<number | null>(null);
  const last = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Ridimensiona il canvas al contenitore (con densità di pixel limitata)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      const ctx = canvas.getContext('2d');
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);
    window.addEventListener('resize', resize);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', resize);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  const loop = (time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) { raf.current = null; return; }
    const dt = Math.min(0.05, (time - (last.current || time)) / 1000);
    last.current = time;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    const list = particles.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) { list.splice(i, 1); continue; }
      p.vx *= 1 - p.drag * dt;
      p.vy = p.vy * (1 - p.drag * dt) + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.size = Math.max(0.5, p.size + p.grow * dt);
      draw(ctx, p);
    }
    if (list.length) raf.current = requestAnimationFrame(loop);
    else { raf.current = null; last.current = 0; ctx.clearRect(0, 0, w, h); }
  };

  const ensureLoop = () => {
    if (!raf.current) raf.current = requestAnimationFrame(loop);
  };

  const spawn = (p: Partial<Particle> & { x: number; y: number }) => {
    if (particles.current.length > 420) return;
    particles.current.push({
      vx: 0, vy: 0, life: 0.8, max: 0.8, size: 6, color: '#fff', shape: 'glow', rot: 0, vr: 0,
      gravity: 0, drag: 1.5, additive: true, grow: 0, ...p,
    } as Particle);
  };

  const burstImpl = (kind: FxKind, x: number, y: number, power = 1) => {
    const colors = PALETTE[kind];
    const shapes = SHAPES[kind];
    const n = Math.round((kind === 'smoke' ? 14 : 26) * Math.min(1.8, power));
    for (let i = 0; i < n; i++) {
      const shape = pickOf(shapes);
      const angle = rand(0, Math.PI * 2);
      let speed = rand(60, 220) * power;
      let gravity = 0;
      let vy = Math.sin(angle) * speed;
      let vx = Math.cos(angle) * speed;
      let life = rand(0.45, 0.9);
      let size = rand(4, 10);
      let additive = true;
      let grow = 0;
      switch (kind) {
        case 'fuoco': vy = -Math.abs(vy) * 0.8 - 40; size = rand(6, 16); grow = -8; break;
        case 'acqua': gravity = 260; size = rand(4, 11); break;
        case 'erba': gravity = 90; speed *= 0.8; size = rand(6, 11); break;
        case 'buio': additive = shape !== 'smoke'; size = shape === 'smoke' ? rand(18, 34) : rand(3, 6); grow = shape === 'smoke' ? 22 : 0; life = rand(0.6, 1.1); break;
        case 'spettro': vx *= 0.6; vy = -Math.abs(vy) * 0.6; size = rand(6, 14); life = rand(0.7, 1.2); break;
        case 'tuono': size = rand(10, 26); life = rand(0.18, 0.4); break;
        case 'ghiaccio': gravity = 140; size = rand(6, 14); break;
        case 'veleno': vy = -Math.abs(vy) * 0.5 - 20; size = rand(5, 12); life = rand(0.7, 1.1); break;
        case 'osso': gravity = 320; size = rand(8, 14); break;
        case 'ragno': size = rand(12, 26); life = rand(0.5, 0.9); speed *= 0.5; break;
        case 'zucca': gravity = 220; size = rand(4, 9); break;
        case 'heal': vx *= 0.3; vy = -rand(40, 120); size = rand(5, 10); life = rand(0.8, 1.3); break;
        case 'statup': vx *= 0.15; vy = -rand(80, 170); size = rand(8, 14); life = rand(0.6, 1); break;
        case 'statdown': vx *= 0.15; vy = rand(80, 170); size = rand(8, 14); life = rand(0.6, 1); break;
        case 'smoke': additive = false; size = rand(16, 30); grow = 30; vy = -rand(10, 60); vx *= 0.3; life = rand(0.8, 1.4); break;
        case 'gold': size = rand(5, 12); life = rand(0.7, 1.3); break;
        default: break;
      }
      spawn({
        x: x + rand(-14, 14), y: y + rand(-14, 14), vx, vy, life, max: life, size,
        color: pickOf(colors), shape, rot: rand(0, Math.PI * 2), vr: rand(-6, 6), gravity, drag: 1.2, additive, grow,
      });
    }
    // Lampo centrale
    if (kind !== 'smoke' && kind !== 'statdown') {
      spawn({ x, y, life: 0.25, max: 0.25, size: 42 * Math.min(1.6, power), color: colors[1], shape: 'glow', grow: 90, drag: 0 });
    }
    if (kind === 'tuono') {
      for (let i = 0; i < 3; i++) spawn({ x: x + rand(-30, 30), y: y - 120, life: 0.22, max: 0.22, size: 3, color: '#fffbd0', shape: 'bolt', points: boltPoints(0, 0, rand(-20, 20), 130), drag: 0 });
    }
    if (kind === 'ragno') {
      spawn({ x, y, life: 0.9, max: 0.9, size: 60, color: '#f5f5f5', shape: 'web', drag: 0, additive: false });
    }
    ensureLoop();
  };

  useImperativeHandle(ref, () => ({
    burst: (kind, x, y, power) => { if (enabledRef.current) burstImpl(kind, x, y, power); },
    aura: (kind, x, y) => {
      if (!enabledRef.current) return;
      const colors = PALETTE[kind];
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        spawn({
          x: x + Math.cos(a) * 46, y: y + Math.sin(a) * 18 + 10, vx: -Math.sin(a) * 30, vy: kind === 'statdown' ? 60 : -70,
          life: 0.9, max: 0.9, size: rand(5, 9), color: pickOf(colors), shape: SHAPES[kind][0], drag: 0.4,
        });
      }
      ensureLoop();
    },
    projectile: (kind, from, to, durationMs) => {
      if (!enabledRef.current) return;
      const colors = PALETTE[kind];
      const steps = 16;
      const dur = durationMs / 1000;
      for (let s = 0; s < steps; s++) {
        const t0 = (s / steps) * dur;
        setTimeout(() => {
          const t = s / steps;
          const arc = Math.sin(t * Math.PI) * -40;
          const px = from.x + (to.x - from.x) * t;
          const py = from.y + (to.y - from.y) * t + arc;
          for (let k = 0; k < 3; k++) {
            spawn({
              x: px + rand(-6, 6), y: py + rand(-6, 6), vx: rand(-30, 30), vy: rand(-30, 30),
              life: rand(0.25, 0.45), max: 0.45, size: rand(5, 11), color: pickOf(colors), shape: pickOf(SHAPES[kind]),
              rot: rand(0, 6), vr: rand(-8, 8), drag: 2,
            });
          }
          ensureLoop();
        }, t0 * 1000);
      }
    },
  }));

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 w-full h-full z-30" aria-hidden="true" />;
});

function boltPoints(x: number, y: number, dx: number, len: number) {
  const pts = [{ x, y }];
  const segs = 6;
  for (let i = 1; i <= segs; i++) {
    pts.push({ x: x + (dx * i) / segs + rand(-14, 14), y: y + (len * i) / segs });
  }
  return pts;
}

function draw(ctx: CanvasRenderingContext2D, p: Particle) {
  const alpha = Math.max(0, Math.min(1, p.life / p.max));
  ctx.save();
  ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over';
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.fillStyle = p.color;
  ctx.strokeStyle = p.color;
  const s = p.size;
  switch (p.shape) {
    case 'glow': {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
      g.addColorStop(0, p.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'smoke': {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
      g.addColorStop(0, p.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = alpha * 0.55;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'spark':
      ctx.lineWidth = Math.max(1, s / 4);
      ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke();
      break;
    case 'leaf':
      ctx.beginPath(); ctx.ellipse(0, 0, s, s / 2.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alpha * 0.6; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke();
      break;
    case 'shard':
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s / 3, 0); ctx.lineTo(0, s); ctx.lineTo(-s / 3, 0); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = alpha * 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
      break;
    case 'bone':
      ctx.fillRect(-s, -s / 6, s * 2, s / 3);
      for (const sx of [-s, s]) for (const sy of [-s / 5, s / 5]) { ctx.beginPath(); ctx.arc(sx, sy, s / 4, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'ring':
      ctx.lineWidth = Math.max(1, s / 5);
      ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = alpha * 0.8; ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-s / 3, -s / 3, s / 5, 0, Math.PI * 2); ctx.fill();
      break;
    case 'bolt': {
      const pts = p.points || boltPoints(0, -s, 0, s * 2);
      ctx.lineWidth = 3; ctx.shadowColor = p.color; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      pts.forEach(pt => ctx.lineTo(pt.x, pt.y));
      ctx.stroke();
      break;
    }
    case 'web':
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s); ctx.stroke();
      }
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const rr = (s * r) / 3.2;
          if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.stroke();
      }
      break;
    case 'seed':
      ctx.beginPath(); ctx.ellipse(0, 0, s / 1.6, s, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'plus':
      ctx.fillRect(-s / 5, -s, (s * 2) / 5, s * 2);
      ctx.fillRect(-s, -s / 5, s * 2, (s * 2) / 5);
      break;
    case 'arrow':
      ctx.rotate(-p.rot + (p.vy > 0 ? Math.PI : 0));
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, 0); ctx.lineTo(s * 0.25, 0); ctx.lineTo(s * 0.25, s);
      ctx.lineTo(-s * 0.25, s); ctx.lineTo(-s * 0.25, 0); ctx.lineTo(-s * 0.7, 0); ctx.closePath(); ctx.fill();
      break;
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? s : s / 2.4;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'wisp': {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.4);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, p.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, s * 1.4, s * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

export default FxCanvas;
