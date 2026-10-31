// Playgama Bridge SDK v2 integration.
// Every SDK call of the game goes through this module. It follows the
// official v2 API (wiki.playgama.com/playgama/bridge-sdk):
//  - platform.language / isAudioEnabled are properties, not functions
//  - pause and audio arrive through PAUSE_STATE_CHANGED / AUDIO_STATE_CHANGED
//  - storage has no storage types and accepts arrays of keys (one call)
//  - the reward is granted only after the `rewarded` state
//  - leaderboards live under `bridge.leaderboards` (plural)
//  - game events go through `analytics.send`

import { Language } from './i18n';

declare global {
  interface Window {
    bridge: any;
  }
}

let isInitialized = false;
let platformLanguage: Language | null = null;
let isPaused = false;
let isAudioEnabled = true;
let gameReadySent = false;

type Listener<T> = (value: T) => void;
const pauseListeners = new Set<Listener<boolean>>();
const audioListeners = new Set<Listener<boolean>>();

const EVENT = {
  PAUSE: 'pause_state_changed',
  AUDIO: 'audio_state_changed',
  REWARDED: 'rewarded_state_changed',
  INTERSTITIAL: 'interstitial_state_changed',
};

function eventName(key: keyof typeof EVENT): string {
  const names = window.bridge?.EVENT_NAME;
  const map: Record<keyof typeof EVENT, string> = {
    PAUSE: names?.PAUSE_STATE_CHANGED,
    AUDIO: names?.AUDIO_STATE_CHANGED,
    REWARDED: names?.REWARDED_STATE_CHANGED,
    INTERSTITIAL: names?.INTERSTITIAL_STATE_CHANGED,
  };
  return map[key] || EVENT[key];
}

function bridge(): any {
  return isInitialized && typeof window !== 'undefined' ? window.bridge : null;
}

/**
 * Waits for the CDN script to expose window.bridge. The <script> in <head>
 * is blocking so it is usually ready already; polling covers slow loads.
 */
function waitForBridge(timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.bridge) {
      resolve(true);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      if (window.bridge) {
        clearInterval(timer);
        resolve(true);
      } else if (Date.now() - start >= timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 100);
  });
}

function setPaused(value: boolean) {
  if (isPaused === value) return;
  isPaused = value;
  pauseListeners.forEach(listener => listener(value));
}

function setAudioEnabled(value: boolean) {
  if (isAudioEnabled === value) return;
  isAudioEnabled = value;
  audioListeners.forEach(listener => listener(value));
}

/**
 * Initializes Bridge. Works outside supported platforms too: Bridge then
 * uses its mock platform, so initialize() is always called.
 */
export async function initializePlaygama(): Promise<void> {
  try {
    const available = await waitForBridge();
    if (!available || !window.bridge) {
      console.log('[Playgama] SDK not available, running standalone');
      return;
    }
    await window.bridge.initialize();
    isInitialized = true;

    const b = window.bridge;
    const safe = (fn: () => void) => {
      try { fn(); } catch (e) { console.warn('[Playgama] step skipped:', e); }
    };

    safe(() => {
      const lang = b.platform?.language;
      if (typeof lang === 'string' && lang) platformLanguage = mapPlatformLanguage(lang);
    });

    // Initial audio state must be applied manually: the event only fires on changes.
    safe(() => {
      if (typeof b.platform?.isAudioEnabled === 'boolean') setAudioEnabled(b.platform.isAudioEnabled);
    });
    safe(() => {
      if (typeof b.platform?.isPaused === 'boolean') setPaused(b.platform.isPaused);
    });
    safe(() => {
      // An interstitial may already be open at start.
      if (b.advertisement?.interstitialState === 'opened') setPaused(true);
    });

    if (typeof b.platform?.on === 'function') {
      safe(() => b.platform.on(eventName('PAUSE'), (paused: boolean) => setPaused(Boolean(paused))));
      safe(() => b.platform.on(eventName('AUDIO'), (enabled: boolean) => setAudioEnabled(Boolean(enabled))));
    }

    // Area sicura: la parte di schermo non coperta da notch o interfaccia della
    // piattaforma (es. il banner dell'app Playgama). Diventa variabili CSS.
    safe(() => applySafeArea());
    if (typeof b.device?.on === 'function') {
      safe(() => b.device.on(b.EVENT_NAME?.SCREEN_SIZE_CHANGED || 'screen_size_changed', () => applySafeArea()));
      safe(() => b.device.on(b.EVENT_NAME?.ORIENTATION_STATE_CHANGED || 'orientation_state_changed', () => applySafeArea()));
    }
    window.addEventListener('resize', () => applySafeArea());

    console.log('[Playgama] SDK initialized. Platform:', b.platform?.id, 'Language:', platformLanguage);
  } catch (error) {
    console.error('[Playgama] Initialization error:', error);
  }
}

function applySafeArea() {
  const area = window.bridge?.device?.safeArea;
  const root = document.documentElement.style;
  for (const side of ['top', 'bottom', 'left', 'right'] as const) {
    const v = Number(area?.[side]);
    root.setProperty(`--pg-safe-${side}`, `${Number.isFinite(v) && v > 0 ? Math.round(v) : 0}px`);
  }
}

const SUPPORTED: Language[] =['en', 'it', 'fr', 'es', 'tr'];

function mapPlatformLanguage(platformLang: string): Language {
  const prefix = platformLang.toLowerCase().split(/[-_]/)[0] as Language;
  return SUPPORTED.includes(prefix) ? prefix : 'en';
}

/** Language reported by the platform (falls back to the browser, then English). */
export function getPlatformLanguage(): Language {
  if (platformLanguage) return platformLanguage;
  try {
    return mapPlatformLanguage(navigator.language || 'en');
  } catch {
    return 'en';
  }
}

export function isPlaygamaReady(): boolean {
  return isInitialized;
}

export function getIsPaused(): boolean {
  return isPaused;
}

export function getIsAudioEnabled(): boolean {
  return isAudioEnabled;
}

/** Subscribe to platform pause changes (ads, tab switch, host request). */
export function onPauseChanged(listener: Listener<boolean>): () => void {
  pauseListeners.add(listener);
  return () => pauseListeners.delete(listener);
}

/** Subscribe to platform audio permission changes. */
export function onAudioChanged(listener: Listener<boolean>): () => void {
  audioListeners.add(listener);
  return () => audioListeners.delete(listener);
}

// ============================================================
// PLATFORM MESSAGES
// ============================================================

/** Sends game_ready once, when the first playable frame is on screen. */
export function sendGameReady(): void {
  if (gameReadySent) return;
  const b = bridge();
  if (!b || typeof b.platform?.sendMessage !== 'function') return;
  gameReadySent = true;
  try {
    b.platform.sendMessage('game_ready');
    console.log('[Playgama] game_ready sent');
  } catch (e) {
    console.warn('[Playgama] game_ready failed:', e);
  }
}

type LevelMessage = 'level_started' | 'level_completed' | 'level_failed' | 'level_paused' | 'level_resumed' | 'player_got_achievement';

export function sendPlatformMessage(message: LevelMessage, level?: number): void {
  const b = bridge();
  if (!b || typeof b.platform?.sendMessage !== 'function') return;
  try {
    if (level !== undefined) b.platform.sendMessage(message, { world: 'halloween', level: String(level) });
    else b.platform.sendMessage(message);
  } catch (e) {
    console.warn('[Playgama] sendMessage failed:', message, e);
  }
}

// ============================================================
// STORAGE (one batched call, no direct localStorage on platforms)
// ============================================================

const LOCAL_PREFIX = 'hm_save_';
const unreadableKeys = new Set<string>();
const memoryStore = new Map<string, string>();

function parseEnvelope(raw: any): { savedAt: number; data: any } | null {
  if (raw === null || raw === undefined || raw === '') return null;
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (value && typeof value === 'object' && value.v === 1 && 'data' in value) {
    return { savedAt: Number(value.savedAt) || 0, data: value.data };
  }
  // Values saved before the envelope existed.
  if (value !== null && value !== undefined) return { savedAt: 1, data: value };
  return null;
}

// Standalone fallback only (no Bridge at all, e.g. local development).
function standaloneGet(key: string): string | null {
  try {
    return window.localStorage.getItem(LOCAL_PREFIX + key);
  } catch {
    return memoryStore.get(key) ?? null;
  }
}

function standaloneSet(key: string, value: string) {
  memoryStore.set(key, value);
  try {
    window.localStorage.setItem(LOCAL_PREFIX + key, value);
  } catch {
    /* blocked storage: memory only */
  }
}

/**
 * Loads several keys with a single storage call and returns, per key, the
 * stored value or the provided default.
 */
export async function loadAll<T extends Record<string, any>>(defaults: T): Promise<T> {
  const keys = Object.keys(defaults);
  const result: Record<string, any> = { ...defaults };
  const b = bridge();

  if (b && typeof b.storage?.get === 'function') {
    try {
      const values = await b.storage.get(keys);
      const list: any[] = Array.isArray(values) ? values : keys.map(k => (values as any)?.[k]);
      keys.forEach((key, index) => {
        const parsed = parseEnvelope(list[index]);
        if (parsed) result[key] = parsed.data;
      });
      keys.forEach(key => unreadableKeys.delete(key));
    } catch (error) {
      // Never overwrite progress we could not read.
      console.warn('[Storage] get failed:', error);
      keys.forEach(key => unreadableKeys.add(key));
    }
    return result as T;
  }

  keys.forEach(key => {
    const parsed = parseEnvelope(standaloneGet(key));
    if (parsed) result[key] = parsed.data;
  });
  return result as T;
}

/** Saves several keys with a single storage call. */
export async function saveAll(values: Record<string, any>): Promise<void> {
  const keys = Object.keys(values).filter(key => {
    if (unreadableKeys.has(key)) {
      console.warn('[Storage] read failed for', key, '- save blocked to protect existing progress');
      return false;
    }
    return true;
  });
  if (keys.length === 0) return;
  const payloads = keys.map(key => JSON.stringify({ v: 1, savedAt: Date.now(), data: values[key] }));
  const b = bridge();

  if (b && typeof b.storage?.set === 'function') {
    try {
      await b.storage.set(keys, payloads);
    } catch (error) {
      console.warn('[Storage] set failed:', error);
    }
    return;
  }
  keys.forEach((key, index) => standaloneSet(key, payloads[index]));
}

export function saveData(key: string, value: any): Promise<void> {
  return saveAll({ [key]: value });
}

// ============================================================
// ADVERTISEMENTS
// ============================================================

const BUSY_REWARDED = ['loading', 'opened', 'rewarded'];
const BUSY_INTERSTITIAL = ['loading', 'opened'];
let adInFlight = false;

function adsBusy(): boolean {
  const ad = bridge()?.advertisement;
  if (!ad) return false;
  return BUSY_REWARDED.includes(ad.rewardedState) || BUSY_INTERSTITIAL.includes(ad.interstitialState);
}

/** Waits until no ad is in progress, so Bridge does not silently drop a request. */
function waitForAdsIdle(timeoutMs: number): Promise<void> {
  return new Promise(resolve => {
    if (!adsBusy()) { resolve(); return; }
    const start = Date.now();
    const timer = setInterval(() => {
      if (!adsBusy() || Date.now() - start > timeoutMs) {
        clearInterval(timer);
        resolve();
      }
    }, 150);
  });
}

export function isRewardedAvailable(): boolean {
  const ad = bridge()?.advertisement;
  if (!ad || typeof ad.showRewarded !== 'function') return false;
  return ad.isRewardedSupported !== false;
}

/**
 * Shows an interstitial at a natural pause. Resolves when it is closed or
 * failed, so the caller can continue afterwards. Never throws.
 */
export function showInterstitialAd(placement = 'level_completed'): Promise<boolean> {
  const b = bridge();
  const ad = b?.advertisement;
  if (!ad || typeof ad.showInterstitial !== 'function' || ad.isInterstitialSupported === false || adInFlight || adsBusy()) {
    return Promise.resolve(false);
  }
  return new Promise(resolve => {
    let done = false;
    let started = false;
    const finish = (shown: boolean) => {
      if (done) return;
      done = true;
      try { ad.off?.(eventName('INTERSTITIAL'), handler); } catch { /* ignore */ }
      resolve(shown);
    };
    const handler = (state: string) => {
      if (state === 'loading' || state === 'opened') started = true;
      if (state === 'closed') finish(true);
      else if (state === 'failed') finish(false);
    };
    try {
      ad.on(eventName('INTERSTITIAL'), handler);
      ad.showInterstitial(placement);
    } catch (e) {
      console.warn('[Playgama] interstitial error:', e);
      finish(false);
      return;
    }
    // Bridge skips the call silently when the minimum delay is not over.
    setTimeout(() => { if (!started) finish(false); }, 2500);
    setTimeout(() => finish(started), 120000);
  });
}

// ============================================================
// BANNER: fascia in basso, con spazio riservato così non copre mai i comandi
// ============================================================

/**
 * Altezza del banner in % della finestra per tipo di dispositivo. Deve
 * coincidere con `advancedBanners.game_banner` in playgama-bridge-config.json.
 */
function bannerHeightPct(): number {
  const type = bridge()?.device?.type;
  const landscape = window.innerWidth > window.innerHeight;
  if (type === 'mobile') return landscape ? 12 : 7;
  if (type === 'tablet') return 8;
  return 10;
}

let bannerWanted = false;
let bannerVisible = false;
let bannerListening = false;

function reserveBannerSpace() {
  const on = bannerWanted && bannerVisible;
  document.documentElement.style.setProperty('--pg-banner', on ? `${bannerHeightPct()}dvh` : '0px');
}

/** Mostra o nasconde il banner (Bridge lo nasconde da solo durante le pubblicità a schermo intero). */
export function setGameBanner(show: boolean): void {
  const ad = bridge()?.advertisement;
  if (!ad || !ad.isAdvancedBannersSupported || typeof ad.showAdvancedBanners !== 'function') return;
  if (!bannerListening && typeof ad.on === 'function') {
    bannerListening = true;
    try {
      ad.on(window.bridge.EVENT_NAME?.ADVANCED_BANNERS_STATE_CHANGED || 'advanced_banners_state_changed', (state: string) => {
        bannerVisible = state === 'loading' || state === 'shown';
        reserveBannerSpace();
      });
      window.addEventListener('resize', reserveBannerSpace);
    } catch { /* ignore */ }
  }
  if (show === bannerWanted) return;
  bannerWanted = show;
  try {
    if (show) {
      // Lo spazio si riserva subito, prima che il banner compaia: niente salti sotto il dito
      bannerVisible = true;
      reserveBannerSpace();
      ad.showAdvancedBanners('game_banner');
    } else {
      reserveBannerSpace();
      ad.hideAdvancedBanners();
    }
  } catch (e) {
    console.warn('[Playgama] banner error:', e);
    bannerVisible = false;
    reserveBannerSpace();
  }
}

export type RewardedAdResult = 'rewarded' | 'closed' | 'failed' | 'unavailable';

/**
 * Shows one rewarded ad. Resolves 'rewarded' only after Bridge confirmed the
 * `rewarded` state (and the ad was closed, or after a short grace period).
 * A request that Bridge ignores or that fails to fill is retried once.
 */
export async function showRewardedAd(placement?: string): Promise<RewardedAdResult> {
  const ad = bridge()?.advertisement;
  if (!ad || typeof ad.showRewarded !== 'function' || typeof ad.on !== 'function') return 'unavailable';
  if (ad.isRewardedSupported === false) return 'unavailable';
  if (adInFlight) return 'failed';
  adInFlight = true;
  rewardedCancelled = false;
  try {
    await waitForAdsIdle(3000);
    if (rewardedCancelled) return 'closed';
    let result = await requestRewarded(placement);
    if (result === 'failed' && !rewardedCancelled) {
      // One retry after a short pause, with the fallback placement.
      await new Promise(r => setTimeout(r, 800));
      await waitForAdsIdle(2000);
      if (rewardedCancelled) return 'closed';
      result = await requestRewarded(undefined);
    }
    return result;
  } finally {
    adInFlight = false;
    cancelCurrentRewarded = null;
  }
}

let rewardedCancelled = false;
let cancelCurrentRewarded: (() => void) | null = null;

/**
 * Lets the player give up while the ad is still loading. Has no effect once the
 * ad is on screen (then the platform decides when it closes).
 */
export function cancelRewardedAd(): void {
  rewardedCancelled = true;
  cancelCurrentRewarded?.();
}

function requestRewarded(placement?: string): Promise<RewardedAdResult> {
  const ad = window.bridge.advertisement;
  return new Promise(resolve => {
    let done = false;
    let started = false;
    let opened = false;
    let rewarded = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const finish = (result: RewardedAdResult) => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      try { ad.off?.(eventName('REWARDED'), handler); } catch { /* ignore */ }
      resolve(result);
    };
    const handler = (state: string) => {
      console.log('[Playgama] Rewarded state:', state);
      if (state === 'loading') started = true;
      if (state === 'opened') { started = true; opened = true; }
      if (state === 'rewarded') {
        started = true;
        opened = true;
        rewarded = true;
        // Some platforms never send `closed` after `rewarded`.
        timers.push(setTimeout(() => finish('rewarded'), 2500));
      } else if (state === 'closed') {
        finish(rewarded ? 'rewarded' : 'closed');
      } else if (state === 'failed') {
        finish(rewarded ? 'rewarded' : 'failed');
      }
    };
    cancelCurrentRewarded = () => { if (!opened) finish('closed'); };
    try {
      ad.on(eventName('REWARDED'), handler);
      if (placement) ad.showRewarded(placement);
      else ad.showRewarded();
    } catch (e) {
      console.warn('[Playgama] rewarded error:', e);
      finish('failed');
      return;
    }
    // Request dropped silently (another ad in progress): no state at all.
    timers.push(setTimeout(() => { if (!started) finish('failed'); }, 4000));
    // Stuck in `loading` (no fill, network): give up instead of freezing the game.
    // No retry here: a second request would only make the player wait longer.
    timers.push(setTimeout(() => { if (!opened) finish('unavailable'); }, 10000));
    // Hard stop: never leave the game waiting forever.
    timers.push(setTimeout(() => finish(rewarded ? 'rewarded' : 'failed'), 180000));
  });
}

// ============================================================
// ANALYTICS
// ============================================================

export function trackEvent(name: string, data?: Record<string, string | number | boolean>): void {
  const b = bridge();
  if (!b || typeof b.analytics?.send !== 'function') return;
  try {
    if (data) b.analytics.send(name, data);
    else b.analytics.send(name);
  } catch (e) {
    console.warn('[Playgama] analytics error:', e);
  }
}

// ============================================================
// LEADERBOARDS
// ============================================================

export async function setLeaderboardScore(leaderboardId: string, score: number): Promise<void> {
  const lb = bridge()?.leaderboards;
  if (!lb || typeof lb.setScore !== 'function') return;
  if (lb.type === 'not_available' || lb.type === undefined) return;
  try {
    await lb.setScore(leaderboardId, score);
  } catch (error) {
    console.warn('[Playgama] leaderboard error:', error);
  }
}
