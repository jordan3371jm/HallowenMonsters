(function(){
  const listeners = {};
  const on = (n, f) => { (listeners[n] = listeners[n] || []).push(f); };
  const off = (n, f) => { listeners[n] = (listeners[n] || []).filter(x => x !== f); };
  const emit = (n, v) => (listeners[n] || []).slice().forEach(f => f(v));
  const store = {};
  let rewardedCalls = 0;
  window.__adLog = [];
  const ad = {
    isRewardedSupported: true, isInterstitialSupported: true, rewardedState: 'closed', interstitialState: 'closed',
    on, off,
    showRewarded(p) {
      rewardedCalls++; window.__adLog.push('showRewarded:' + p);
      if (rewardedCalls === 1 && false) return; // prima richiesta ignorata in silenzio (come Bridge quando un ad è in corso)
      const set = s => { ad.rewardedState = s; emit('rewarded_state_changed', s); window.__adLog.push(s); };
      set('loading'); setTimeout(() => set('opened'), 300); setTimeout(() => set('rewarded'), 900);
      // nessun 'closed' dopo 'rewarded' (alcune piattaforme)
    },
    isAdvancedBannersSupported: true, advancedBannersState: 'hidden',
    showAdvancedBanners(p) { window.__adLog.push('banner:show:' + p); const set = x => { ad.advancedBannersState = x; emit('advanced_banners_state_changed', x); };
      set('loading'); setTimeout(() => { let d = document.getElementById('mockban'); if (!d) { d = document.createElement('div'); d.id = 'mockban'; d.style.cssText = 'position:fixed;left:0;bottom:0;width:100%;height:'+((window.__dev||'desktop')==='mobile'?(innerWidth>innerHeight?12:7):(window.__dev==='tablet'?8:10))+'%;background:rgba(0,160,255,.8);z-index:9999;pointer-events:none'; document.body.appendChild(d); } d.style.display = 'block'; set('shown'); }, 200); },
    hideAdvancedBanners() { window.__adLog.push('banner:hide'); const d = document.getElementById('mockban'); if (d) d.style.display = 'none'; ad.advancedBannersState = 'hidden'; emit('advanced_banners_state_changed', 'hidden'); },
    showInterstitial(p) { window.__adLog.push('showInterstitial:' + p); },
  };
  window.bridge = {
    EVENT_NAME: { ADVANCED_BANNERS_STATE_CHANGED: 'advanced_banners_state_changed', PAUSE_STATE_CHANGED: 'pause_state_changed', AUDIO_STATE_CHANGED: 'audio_state_changed', REWARDED_STATE_CHANGED: 'rewarded_state_changed', INTERSTITIAL_STATE_CHANGED: 'interstitial_state_changed' },
    initialize: () => Promise.resolve(),
    platform: { id: 'mock', language: 'it', isAudioEnabled: true, isPaused: false, on, off, sendMessage: m => window.__adLog.push('msg:' + m) },
    storage: {
      get: keys => Promise.resolve(keys.map(k => store[k] ?? null)),
      set: (keys, vals) => { keys.forEach((k, i) => store[k] = vals[i]); window.__saved = Object.keys(store); return Promise.resolve(); },
    },
    advertisement: ad,
    device: { type: window.__dev || 'desktop', on, off, safeArea: { top: 0, bottom: 0, left: 0, right: 0 } },
    analytics: { send: (n) => window.__adLog.push('evt:' + n) },
  };
})();
