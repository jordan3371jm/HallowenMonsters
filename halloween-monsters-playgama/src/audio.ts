// Audio del gioco (Web Audio API): effetti sonori e musica.
// - si sblocca al primo tocco/click (regola dei browser)
// - rispetta l'audio della piattaforma Playgama (AUDIO_STATE_CHANGED),
//   la pausa (PAUSE_STATE_CHANGED: pubblicità, cambio scheda) e le impostazioni
// Suoni: pacchetti CC0 (vedi public/audio/CREDITS.txt).

const base = (import.meta as any).env?.BASE_URL || './';

export type SfxName =
  | 'ui_click' | 'ui_open' | 'ui_back' | 'ui_error' | 'ui_confirm'
  | 'coin' | 'levelup' | 'evolve' | 'heal' | 'stat_up' | 'stat_down' | 'status'
  | 'throw' | 'shake' | 'catch' | 'breakfree' | 'faint'
  | 'hit' | 'hit_super' | 'hit_weak' | 'crit' | 'miss'
  | 'victory' | 'defeat' | 'appear'
  | 't_fuoco' | 't_acqua' | 't_erba' | 't_buio' | 't_spettro' | 't_tuono' | 't_ghiaccio'
  | 't_veleno' | 't_osso' | 't_ragno' | 't_zucca' | 't_magic';

export type MusicName = 'menu' | 'battle';

let ctx: AudioContext | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
const buffers = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<AudioBuffer | null>>();

let sfxEnabled = true;
let musicEnabled = true;
let sfxVolume = 0.8;
let musicVolume = 0.45;
let platformAudio = true;
let platformPaused = false;
let pageHidden = false;

let unlocked = false; // il contesto audio si crea solo dopo il primo gesto dell'utente
let currentMusic: MusicName | null = null;
let wantedMusic: MusicName | null = null;
let musicSource: AudioBufferSourceNode | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  if (!unlocked) return null;
  try {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor() as AudioContext;
    sfxGain = ctx.createGain();
    musicGain = ctx.createGain();
    sfxGain.connect(ctx.destination);
    musicGain.connect(ctx.destination);
    applyVolumes();
  } catch {
    ctx = null;
  }
  return ctx;
}

function audible(): boolean {
  return platformAudio && !platformPaused && !pageHidden;
}

function applyVolumes() {
  if (!ctx || !sfxGain || !musicGain) return;
  const now = ctx.currentTime;
  sfxGain.gain.setTargetAtTime(sfxEnabled && audible() ? sfxVolume : 0, now, 0.02);
  musicGain.gain.setTargetAtTime(musicEnabled && audible() ? musicVolume : 0, now, 0.15);
}

function syncSuspend() {
  if (!ctx) return;
  if (!audible()) {
    ctx.suspend().catch(() => {});
  } else if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

function load(name: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(name);
  if (cached) return Promise.resolve(cached);
  const pending = loading.get(name);
  if (pending) return pending;
  const c = getCtx();
  if (!c) return Promise.resolve(null);
  const promise = fetch(`${base}audio/${name}.mp3`)
    .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then(data => new Promise<AudioBuffer>((resolve, reject) => c.decodeAudioData(data, resolve, reject)))
    .then(buffer => {
      buffers.set(name, buffer);
      return buffer;
    })
    .catch(() => null)
    .finally(() => loading.delete(name));
  loading.set(name, promise);
  return promise;
}

/** Da chiamare a ogni interazione: sblocca l'AudioContext su mobile. */
export function unlockAudio(): void {
  unlocked = true;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended' && audible()) c.resume().catch(() => {});
  if (wantedMusic && currentMusic !== wantedMusic) startMusic(wantedMusic);
}

export function preloadSfx(names: SfxName[]): void {
  if (!getCtx()) return;
  names.forEach(n => { load(n); });
}

export function playSfx(name: SfxName, opts: { volume?: number; rate?: number; delay?: number } = {}): void {
  if (!sfxEnabled || !audible()) return;
  const c = getCtx();
  if (!c || !sfxGain) return;
  load(name).then(buffer => {
    if (!buffer || !ctx || !sfxGain || !sfxEnabled || !audible()) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = opts.rate ?? (0.96 + Math.random() * 0.08);
      const gain = ctx.createGain();
      gain.gain.value = opts.volume ?? 1;
      src.connect(gain);
      gain.connect(sfxGain);
      src.start(ctx.currentTime + (opts.delay ?? 0));
    } catch {
      /* ignore */
    }
  });
}

function stopMusicSource() {
  if (musicSource) {
    try { musicSource.stop(); } catch { /* ignore */ }
    musicSource.disconnect();
    musicSource = null;
  }
  currentMusic = null;
}

function startMusic(name: MusicName) {
  const c = getCtx();
  if (!c || !musicGain || !musicEnabled) return;
  currentMusic = name;
  load(`music_${name}`).then(buffer => {
    if (!buffer || !ctx || !musicGain || wantedMusic !== name) return;
    if (musicSource) {
      try { musicSource.stop(); } catch { /* ignore */ }
      musicSource.disconnect();
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(musicGain);
    src.start();
    musicSource = src;
  });
}

/** Cambia la traccia musicale (null = silenzio). */
export function setMusic(name: MusicName | null): void {
  wantedMusic = name;
  if (!name) { stopMusicSource(); return; }
  if (currentMusic === name) return;
  // Se il contesto è ancora bloccato, la traccia suonerà al primo sblocco
  startMusic(name);
}

export function setAudioSettings(s: { sfx?: boolean; music?: boolean; sfxVolume?: number; musicVolume?: number }): void {
  if (s.sfx !== undefined) sfxEnabled = s.sfx;
  if (s.music !== undefined) {
    musicEnabled = s.music;
    if (!musicEnabled) stopMusicSource();
    else if (wantedMusic && !musicSource) startMusic(wantedMusic);
  }
  if (s.sfxVolume !== undefined) sfxVolume = s.sfxVolume;
  if (s.musicVolume !== undefined) musicVolume = s.musicVolume;
  applyVolumes();
}

export function setPlatformAudio(enabled: boolean): void {
  platformAudio = enabled;
  applyVolumes();
  syncSuspend();
}

export function setPlatformPaused(paused: boolean): void {
  platformPaused = paused;
  applyVolumes();
  syncSuspend();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    pageHidden = document.hidden;
    applyVolumes();
    syncSuspend();
  });
  const unlock = () => unlockAudio();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}

/** Suono della mossa in base al tipo. */
export function moveSfx(type: string, power: number): SfxName {
  if (power === 0) return 't_magic';
  return (`t_${type}` as SfxName);
}
