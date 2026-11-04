// Impostazioni del giocatore (salvate nello Storage di Playgama in un'unica chiave)
export interface GameSettings {
  music: boolean;
  sfx: boolean;
  effects: boolean; // particelle e lampi in battaglia
  shake: boolean; // scuotimento dello schermo
  animations: boolean; // animazioni dei mostri e dell'interfaccia
  fastBattle: boolean; // messaggi e animazioni più rapidi
  autopilot: boolean; // l'IA gioca al posto del giocatore (non riparte da sola dopo un riavvio)
  autoUpgrade: boolean; // autopilota: spende le monete nel Meta Negozio tra le partite
  autoRestart: boolean; // autopilota: dopo la sconfitta inizia subito una nuova partita
}

export const defaultSettings: GameSettings = {
  music: true,
  sfx: true,
  effects: true,
  shake: true,
  animations: true,
  fastBattle: false,
  autopilot: false,
  autoUpgrade: true,
  autoRestart: true,
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
    // Spento a ogni avvio: il gioco non deve mai partire da solo all'apertura
    autopilot: false,
    autoUpgrade: bool(s.autoUpgrade, defaultSettings.autoUpgrade),
    autoRestart: bool(s.autoRestart, defaultSettings.autoRestart),
  };
}
