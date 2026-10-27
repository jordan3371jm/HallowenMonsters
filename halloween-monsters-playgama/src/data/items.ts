import type { ItemType } from '../types';

// Oggetti della run (nomi e descrizioni tradotti in i18n: tItem / tItemDesc)
export const defaultItems: ItemType[] = [
  { id: 'pozione_sangue', name: 'Pozione Sangue di Zucca', description: 'Ripristina 30 HP', quantity: 2, category: 'potion', power: 30, emoji: '🧪' },
  { id: 'super_pozione', name: 'Super Pozione di Sangue', description: 'Ripristina 50 HP', quantity: 1, category: 'potion', power: 50, emoji: '🧪' },
  { id: 'iper_pozione', name: 'Iper Pozione Maledetta', description: 'Ripristina 120 HP', quantity: 0, category: 'potion', power: 120, emoji: '🧪' },
  { id: 'elisir_spettrale', name: 'Elisir Spettrale', description: 'Cura tutti gli status alterati', quantity: 1, category: 'potion', power: 0, emoji: '⚗️' },
  { id: 'candela_protettiva', name: 'Candela Protettiva', description: 'Cura status + 10 HP', quantity: 0, category: 'tool', power: 10, emoji: '🕯️' },
  { id: 'lacrime_banshee', name: 'Lacrime di Banshee', description: 'Resuscita un mostro a metà HP', quantity: 0, category: 'tool', power: 0, emoji: '💧' },
  { id: 'frammento_luna', name: 'Frammento di Luna', description: 'Recupera 30 HP a tutta la squadra', quantity: 0, category: 'potion', power: 30, emoji: '🌙' },
  { id: 'nettare_zucca', name: 'Nettare di Zucca', description: '+10 HP massimi permanenti (in-run)', quantity: 0, category: 'tool', power: 10, emoji: '🍯' },
  { id: 'pozione_non_morte', name: 'Pozione della Non-Morte', description: 'Evita un KO una volta per battaglia', quantity: 0, category: 'tool', power: 0, emoji: '💀' },
  { id: 'caramella_stregata', name: 'Caramella Stregata', description: 'Cattura mostri (1x)', quantity: 3, category: 'capture', power: 30, emoji: '🍬' },
  { id: 'zucca_vuota', name: 'Zucca Vuota', description: 'Cattura mostri (1.5x)', quantity: 1, category: 'capture', power: 50, emoji: '🎃' },
  { id: 'bara_antica', name: 'Bara Antica', description: 'Cattura mostri (2x)', quantity: 0, category: 'capture', power: 75, emoji: '⚰️' },
  { id: 'amuleto_maledetto', name: 'Amuleto Maledetto', description: 'Cattura mostri (3x)', quantity: 0, category: 'capture', power: 100, emoji: '🔮' },
  { id: 'rete_becchino', name: 'Rete del Becchino', description: 'Cattura automatica sotto 20% HP', quantity: 0, category: 'capture', power: 999, emoji: '🕸️' },
  { id: 'sfera_re_zucche', name: 'Sfera del Re delle Zucche', description: 'Cattura garantita su mostri non boss', quantity: 0, category: 'capture', power: 9999, emoji: '👑' },
  { id: 'cristallo_pp', name: 'Cristallo PP', description: 'Ripristina 10 PP a una mossa', quantity: 1, category: 'tool', power: 10, emoji: '💎' },
  { id: 'cristallo_pp_totale', name: 'Cristallo PP Totale', description: 'Ripristina tutti i PP di tutte le mosse', quantity: 0, category: 'tool', power: 999, emoji: '💠' },
];

/** Prezzi del negozio della mappa (dolcetti). */
export const shopPrices: { id: string; key: string; cost: number }[] = [
  { id: 'pozione_sangue', key: 'potion_blood', cost: 20 },
  { id: 'super_pozione', key: 'super_potion', cost: 50 },
  { id: 'iper_pozione', key: 'iper_potion', cost: 120 },
  { id: 'elisir_spettrale', key: 'elixir', cost: 60 },
  { id: 'candela_protettiva', key: 'candle', cost: 40 },
  { id: 'lacrime_banshee', key: 'banshee_tears', cost: 200 },
  { id: 'frammento_luna', key: 'moon_fragment', cost: 150 },
  { id: 'caramella_stregata', key: 'candy', cost: 15 },
  { id: 'zucca_vuota', key: 'pumpkin', cost: 35 },
  { id: 'bara_antica', key: 'coffin', cost: 70 },
  { id: 'amuleto_maledetto', key: 'cursed_amulet', cost: 150 },
  { id: 'rete_becchino', key: 'gravedigger_net', cost: 250 },
  { id: 'sfera_re_zucche', key: 'pumpkin_king_sphere', cost: 500 },
  { id: 'cristallo_pp', key: 'pp_crystal', cost: 25 },
  { id: 'cristallo_pp_totale', key: 'pp_crystal_total', cost: 60 },
  { id: 'nettare_zucca', key: 'pumpkin_nectar', cost: 90 },
  { id: 'pozione_non_morte', key: 'undeath_potion', cost: 120 },
];
