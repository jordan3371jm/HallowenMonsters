// Impostazioni del giocatore (salvate nello Storage di Playgama in un'unica chiave)
export interface GameSettings {
  music: boolean;
  sfx: boolean;
  effects: boolean; // particelle e lampi in battaglia
  shake: boolean; // scuotimento dello schermo
  animations: boolean; // animazioni dei mostri e dell'interfaccia
  fastBattle: boolean; // messaggi e animazioni più rapidi
}

export const defaultSettings: GameSettings = {
  music: true,
  sfx: true,
  effects: true,
  shake: true,
  animations: true,
  fastBattle: false,
};

export function normalizeSettings(raw: any, legacy?: { battleEffects?: any; screenShake?: any; animations?: any }): GameSettings {
  const s = raw && typeof raw === 'object' ? raw : {};
  const bool = (v: any, d: boolean) => (typeof v === 'boolean' ? v : d);
  return {
    music: bool(s.music, defaultSettings.music),
    sfx: bool(s.sfx, defaultSettings.sfx),
    effects: bool(s.effects, bool(legacy?.battleEffects, defaultSettings.effects)),
    shake: bool(s.shake, bool(legacy?.screenShake, defaultSettings.shake)),
    animations: bool(s.animations, bool(legacy?.animations, defaultSettings.animations)),
    fastBattle: bool(s.fastBattle, defaultSettings.fastBattle),
  };
}
