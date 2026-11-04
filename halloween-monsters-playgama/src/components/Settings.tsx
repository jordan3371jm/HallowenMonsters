import { Language, languageNames } from '../i18n';
import type { GameSettings } from '../settings';
import { playSfx } from '../audio';

interface SettingsProps {
  lang: Language;
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onLangChange: (lang: Language) => void;
  onBack: () => void;
}

const FLAGS: Record<Language, string> = { en: '🇬🇧', it: '🇮🇹', fr: '🇫🇷', es: '🇪🇸', tr: '🇹🇷' };

const TEXT: Record<Language, Record<string, string>> = {
  en: {
    autopilotTitle: 'Autopilot', autopilot: 'Autopilot', autopilotDesc: 'Plays for you: fights, catches monsters, uses potions, shops and farms coins',
    autoUpgrade: 'Auto upgrades', autoUpgradeDesc: 'Spends coins in the Meta Shop between runs',
    autoRestart: 'Keep farming', autoRestartDesc: 'Starts a new run by itself after a defeat',
    autopilotNote: 'Go back to the main menu and it starts on its own. Tap "Stop" at the top to take control again. It never watches ads.',
    title: 'Settings', back: 'Back', language: 'Language', audio: 'Audio', graphics: 'Graphics & Battle',
    music: 'Music', musicDesc: 'Spooky background music', sfx: 'Sound Effects', sfxDesc: 'Moves, hits, menus and captures',
    effects: 'Battle Effects', effectsDesc: 'Particles and flashes for every move type',
    shake: 'Screen Shake', shakeDesc: 'Shake on super effective and critical hits',
    animations: 'Animations', animationsDesc: 'Monster and text animations',
    fast: 'Fast Battles', fastDesc: 'Shorter messages and animations',
    on: 'On', off: 'Off', credits: 'Credits',
    creditsText: 'Sound effects: Kenney (kenney.nl) and "80 CC0 RPG SFX" by rubberduck. Music: "Lanterns in the Hollowed Forest" by Tsorthan Grove and "Void Estate" by Zane Little Music. All CC0 (public domain).',
  },
  it: {
    autopilotTitle: 'Autopilota', autopilot: 'Autopilota', autopilotDesc: 'Gioca al posto tuo: lotta, cattura mostri, usa pozioni, compra nei negozi e farma monete',
    autoUpgrade: 'Potenziamenti automatici', autoUpgradeDesc: 'Spende le monete nel Meta Negozio tra una partita e l\'altra',
    autoRestart: 'Continua a farmare', autoRestartDesc: 'Dopo la sconfitta inizia da solo una nuova partita',
    autopilotNote: 'Torna al menu principale e parte da solo. Tocca "Ferma" in alto per riprendere il controllo. Non guarda mai pubblicità.',
    title: 'Impostazioni', back: 'Indietro', language: 'Lingua', audio: 'Audio', graphics: 'Grafica e Battaglia',
    music: 'Musica', musicDesc: 'Musica di sottofondo spettrale', sfx: 'Effetti Sonori', sfxDesc: 'Mosse, colpi, menu e catture',
    effects: 'Effetti di Battaglia', effectsDesc: 'Particelle e lampi per ogni tipo di mossa',
    shake: 'Scuotimento Schermo', shakeDesc: 'Scossa sui colpi superefficaci e brutti colpi',
    animations: 'Animazioni', animationsDesc: 'Animazioni dei mostri e dei testi',
    fast: 'Battaglie Veloci', fastDesc: 'Messaggi e animazioni più brevi',
    on: 'Attivo', off: 'Disattivo', credits: 'Crediti',
    creditsText: 'Effetti sonori: Kenney (kenney.nl) e "80 CC0 RPG SFX" di rubberduck. Musica: "Lanterns in the Hollowed Forest" di Tsorthan Grove e "Void Estate" di Zane Little Music. Tutto CC0 (pubblico dominio).',
  },
  fr: {
    autopilotTitle: 'Pilote auto', autopilot: 'Pilote auto', autopilotDesc: 'Joue à ta place : combat, capture, utilise des potions, achète et récolte des pièces',
    autoUpgrade: 'Améliorations auto', autoUpgradeDesc: 'Dépense les pièces dans la Méta Boutique entre les parties',
    autoRestart: 'Continuer à farmer', autoRestartDesc: 'Lance une nouvelle partie tout seul après une défaite',
    autopilotNote: 'Reviens au menu principal et il démarre tout seul. Touche « Arrêter » en haut pour reprendre la main. Il ne regarde jamais de pubs.',
    title: 'Paramètres', back: 'Retour', language: 'Langue', audio: 'Audio', graphics: 'Graphismes et Combat',
    music: 'Musique', musicDesc: "Musique d'ambiance effrayante", sfx: 'Effets Sonores', sfxDesc: 'Attaques, coups, menus et captures',
    effects: 'Effets de Combat', effectsDesc: "Particules et éclairs pour chaque type d'attaque",
    shake: "Tremblement d'Écran", shakeDesc: 'Tremblement sur les coups super efficaces et critiques',
    animations: 'Animations', animationsDesc: 'Animations des monstres et des textes',
    fast: 'Combats Rapides', fastDesc: 'Messages et animations plus courts',
    on: 'Activé', off: 'Désactivé', credits: 'Crédits',
    creditsText: 'Effets sonores : Kenney (kenney.nl) et « 80 CC0 RPG SFX » de rubberduck. Musique : « Lanterns in the Hollowed Forest » de Tsorthan Grove et « Void Estate » de Zane Little Music. Tout en CC0 (domaine public).',
  },
  es: {
    autopilotTitle: 'Piloto automático', autopilot: 'Piloto automático', autopilotDesc: 'Juega por ti: combate, captura, usa pociones, compra y farmea monedas',
    autoUpgrade: 'Mejoras automáticas', autoUpgradeDesc: 'Gasta las monedas en la Meta Tienda entre partidas',
    autoRestart: 'Seguir farmeando', autoRestartDesc: 'Empieza solo una nueva partida tras una derrota',
    autopilotNote: 'Vuelve al menú principal y empieza solo. Toca "Parar" arriba para retomar el control. Nunca ve anuncios.',
    title: 'Configuración', back: 'Volver', language: 'Idioma', audio: 'Audio', graphics: 'Gráficos y Combate',
    music: 'Música', musicDesc: 'Música de fondo terrorífica', sfx: 'Efectos de Sonido', sfxDesc: 'Movimientos, golpes, menús y capturas',
    effects: 'Efectos de Combate', effectsDesc: 'Partículas y destellos para cada tipo de movimiento',
    shake: 'Vibración de Pantalla', shakeDesc: 'Vibración en golpes súper eficaces y críticos',
    animations: 'Animaciones', animationsDesc: 'Animaciones de monstruos y textos',
    fast: 'Combates Rápidos', fastDesc: 'Mensajes y animaciones más cortos',
    on: 'Activado', off: 'Desactivado', credits: 'Créditos',
    creditsText: 'Efectos de sonido: Kenney (kenney.nl) y "80 CC0 RPG SFX" de rubberduck. Música: "Lanterns in the Hollowed Forest" de Tsorthan Grove y "Void Estate" de Zane Little Music. Todo CC0 (dominio público).',
  },
  tr: {
    autopilotTitle: 'Otopilot', autopilot: 'Otopilot', autopilotDesc: 'Senin yerine oynar: savaşır, yakalar, iksir kullanır, alışveriş yapar ve para kasar',
    autoUpgrade: 'Otomatik geliştirmeler', autoUpgradeDesc: 'Oyunlar arasında paraları Meta Mağaza\'da harcar',
    autoRestart: 'Kasmaya devam', autoRestartDesc: 'Yenilgiden sonra kendiliğinden yeni oyun başlatır',
    autopilotNote: 'Ana menüye dön, kendiliğinden başlar. Kontrolü geri almak için üstteki "Durdur"a dokun. Asla reklam izlemez.',
    title: 'Ayarlar', back: 'Geri', language: 'Dil', audio: 'Ses', graphics: 'Grafik ve Savaş',
    music: 'Müzik', musicDesc: 'Ürkütücü arka plan müziği', sfx: 'Ses Efektleri', sfxDesc: 'Hamleler, vuruşlar, menüler ve yakalamalar',
    effects: 'Savaş Efektleri', effectsDesc: 'Her hamle türü için parçacıklar ve parlamalar',
    shake: 'Ekran Sarsıntısı', shakeDesc: 'Süper etkili ve kritik vuruşlarda sarsıntı',
    animations: 'Animasyonlar', animationsDesc: 'Canavar ve metin animasyonları',
    fast: 'Hızlı Savaşlar', fastDesc: 'Daha kısa mesajlar ve animasyonlar',
    on: 'Açık', off: 'Kapalı', credits: 'Emeği Geçenler',
    creditsText: 'Ses efektleri: Kenney (kenney.nl) ve rubberduck imzalı "80 CC0 RPG SFX". Müzik: Tsorthan Grove imzalı "Lanterns in the Hollowed Forest" ve Zane Little Music imzalı "Void Estate". Tümü CC0 (kamu malı).',
  },
};

export default function Settings({ lang, settings, onChange, onLangChange, onBack }: SettingsProps) {
  const tx = TEXT[lang] || TEXT.en;

  const Toggle = ({ k, label, desc, icon }: { k: keyof GameSettings; label: string; desc: string; icon: string }) => (
    <div className="bg-gray-900/70 rounded-xl p-3 md:p-4 border border-purple-800/60 flex justify-between items-center gap-3">
      <div className="min-w-0">
        <h3 className="text-white font-bold text-base md:text-lg">{icon} {label}</h3>
        <p className="text-gray-400 text-xs md:text-sm">{desc}</p>
      </div>
      <button
        role="switch"
        aria-checked={settings[k]}
        onClick={() => { playSfx('ui_click'); onChange({ ...settings, [k]: !settings[k] }); }}
        className={`relative shrink-0 w-[72px] h-9 rounded-full transition-colors border-2 ${settings[k] ? 'bg-green-600 border-green-300' : 'bg-gray-700 border-gray-500'}`}
      >
        <span className={`absolute top-0.5 w-7 h-7 rounded-full bg-white shadow transition-all ${settings[k] ? 'left-[38px]' : 'left-0.5'}`} />
        <span className="sr-only">{settings[k] ? tx.on : tx.off}</span>
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-950 via-gray-900 to-black p-3 md:p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-black/60 rounded-2xl p-4 md:p-6 border-2 border-purple-600 mb-6">
          <div className="flex justify-between items-center mb-5 gap-2">
            <h1 className="text-2xl md:text-3xl font-black text-purple-300">⚙️ {tx.title}</h1>
            <button onClick={() => { playSfx('ui_back'); onBack(); }} className="px-4 py-2 min-h-[44px] bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-bold">
              ← {tx.back}
            </button>
          </div>

          <h2 className="text-lg md:text-xl font-bold text-orange-400 mb-3">🌍 {tx.language} / Language</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-6">
            {(Object.keys(languageNames) as Language[]).map(code => (
              <button
                key={code}
                lang={code}
                onClick={() => { playSfx('ui_click'); onLangChange(code); }}
                className={`p-3 rounded-xl border-2 font-bold transition-all ${lang === code ? 'bg-purple-600 border-purple-300 text-white' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}`}
              >
                <span className="mr-1.5">{FLAGS[code]}</span>{languageNames[code]}
              </button>
            ))}
          </div>

          <h2 className="text-lg md:text-xl font-bold text-orange-400 mb-3">🔊 {tx.audio}</h2>
          <div className="space-y-2 mb-6">
            <Toggle k="music" label={tx.music} desc={tx.musicDesc} icon="🎵" />
            <Toggle k="sfx" label={tx.sfx} desc={tx.sfxDesc} icon="🔔" />
          </div>

          <h2 className="text-lg md:text-xl font-bold text-orange-400 mb-3">🎨 {tx.graphics}</h2>
          <div className="space-y-2 mb-6">
            <Toggle k="effects" label={tx.effects} desc={tx.effectsDesc} icon="✨" />
            <Toggle k="shake" label={tx.shake} desc={tx.shakeDesc} icon="📳" />
            <Toggle k="animations" label={tx.animations} desc={tx.animationsDesc} icon="🎞️" />
            <Toggle k="fastBattle" label={tx.fast} desc={tx.fastDesc} icon="⏩" />
          </div>

          <h2 className="text-lg md:text-xl font-bold text-orange-400 mb-3">🤖 {tx.autopilotTitle}</h2>
          <div className="space-y-2 mb-2">
            <Toggle k="autopilot" label={tx.autopilot} desc={tx.autopilotDesc} icon="🤖" />
            <Toggle k="autoUpgrade" label={tx.autoUpgrade} desc={tx.autoUpgradeDesc} icon="🛍️" />
            <Toggle k="autoRestart" label={tx.autoRestart} desc={tx.autoRestartDesc} icon="🔁" />
          </div>
          <p className="text-purple-300 text-xs md:text-sm mb-6">ℹ️ {tx.autopilotNote}</p>

          <h2 className="text-lg md:text-xl font-bold text-orange-400 mb-2">📜 {tx.credits}</h2>
          <p className="text-gray-400 text-xs md:text-sm leading-relaxed">{tx.creditsText}</p>
        </div>
      </div>
    </div>
  );
}
