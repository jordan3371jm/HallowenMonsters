// Monster PNG icons - 100 artwork originali a tema Halloween
// Bug fix: path relativi con BASE_URL (funzionano su itch.io/CrazyGames in sottocartelle)
const base = (import.meta as any).env?.BASE_URL || './';

export const monsterPNGIcons: Record<string, string> = {
  'lumizucca': base + 'images/monsters/lumizucca.webp',
  'zuccarnivoro': base + 'images/monsters/zuccarnivoro.webp',
  'sovranozucca': base + 'images/monsters/sovranozucca.webp',
  'tizzonetto': base + 'images/monsters/tizzonetto.webp',
  'braciodemonio': base + 'images/monsters/braciodemonio.webp',
  'infernax': base + 'images/monsters/infernax.webp',
  'gocciascura': base + 'images/monsters/gocciascura.webp',
  'maremora': base + 'images/monsters/maremora.webp',
  'abissorrore': base + 'images/monsters/abissorrore.webp',
  'spinarbo': base + 'images/monsters/spinarbo.webp',
  'rovomaledetto': base + 'images/monsters/rovomaledetto.webp',
  'silvanotrico': base + 'images/monsters/silvanotrico.webp',
  'nottolino': base + 'images/monsters/nottolino.webp',
  'vesproscuro': base + 'images/monsters/vesproscuro.webp',
  'umbrapredator': base + 'images/monsters/umbrapredator.webp',
  'fantesmina': base + 'images/monsters/fantesmina.webp',
  'velospettrale': base + 'images/monsters/velospettrale.webp',
  'ombrafunebre': base + 'images/monsters/ombrafunebre.webp',
  'ossetto': base + 'images/monsters/ossetto.webp',
  'scarnatore': base + 'images/monsters/scarnatore.webp',
  'ossariano': base + 'images/monsters/ossariano.webp',
  'tessitelo': base + 'images/monsters/tessitelo.webp',
  'aracnoscuro': base + 'images/monsters/aracnoscuro.webp',
  'vedovamantis': base + 'images/monsters/vedovamantis.webp',
  'rospofango': base + 'images/monsters/rospofango.webp',
  'tossirana': base + 'images/monsters/tossirana.webp',
  'pestilenzio': base + 'images/monsters/pestilenzio.webp',
  'scintillio': base + 'images/monsters/scintillio.webp',
  'voltempesta': base + 'images/monsters/voltempesta.webp',
  'fulminartico': base + 'images/monsters/fulminartico.webp',
  'freddolino': base + 'images/monsters/freddolino.webp',
  'gelartiglio': base + 'images/monsters/gelartiglio.webp',
  'criofante': base + 'images/monsters/criofante.webp',
  'streghetta': base + 'images/monsters/streghetta.webp',
  'fattucchiera': base + 'images/monsters/fattucchiera.webp',
  'megeracle': base + 'images/monsters/megeracle.webp',
  'sfortunino': base + 'images/monsters/sfortunino.webp',
  'gattojella': base + 'images/monsters/gattojella.webp',
  'panteranima': base + 'images/monsters/panteranima.webp',
  'candelino': base + 'images/monsters/candelino.webp',
  'cerofiamma': base + 'images/monsters/cerofiamma.webp',
  'lanternferno': base + 'images/monsters/lanternferno.webp',
  'fanghiglia': base + 'images/monsters/fanghiglia.webp',
  'melmostro': base + 'images/monsters/melmostro.webp',
  'paludivoro': base + 'images/monsters/paludivoro.webp',
  'fungospetto': base + 'images/monsters/fungospetto.webp',
  'micotossico': base + 'images/monsters/micotossico.webp',
  'amaniterror': base + 'images/monsters/amaniterror.webp',
  'lapidino': base + 'images/monsters/lapidino.webp',
  'sepolcrodo': base + 'images/monsters/sepolcrodo.webp',
  'cimiteronte': base + 'images/monsters/cimiteronte.webp',
  'spaventalo': base + 'images/monsters/spaventalo.webp',
  'terrificampo': base + 'images/monsters/terrificampo.webp',
  'pagliaiostro': base + 'images/monsters/pagliaiostro.webp',
  'filospettro': base + 'images/monsters/filospettro.webp',
  'tramante': base + 'images/monsters/tramante.webp',
  'aracnofante': base + 'images/monsters/aracnofante.webp',
  'boccettina': base + 'images/monsters/boccettina.webp',
  'elixirbecco': base + 'images/monsters/elixirbecco.webp',
  'alchimistro': base + 'images/monsters/alchimistro.webp',
  'lenzuolino': base + 'images/monsters/lenzuolino.webp',
  'lenzuolordo': base + 'images/monsters/lenzuolordo.webp',
  'corvaglia': base + 'images/monsters/corvaglia.webp',
  'cornacchionte': base + 'images/monsters/cornacchionte.webp',
  'bulonetto': base + 'images/monsters/bulonetto.webp',
  'golemvite': base + 'images/monsters/golemvite.webp',
  'pinguombroso': base + 'images/monsters/pinguombroso.webp',
  'criopinguo': base + 'images/monsters/criopinguo.webp',
  'diablotto': base + 'images/monsters/diablotto.webp',
  'diavolaccio': base + 'images/monsters/diavolaccio.webp',
  'pescescuro': base + 'images/monsters/pescescuro.webp',
  'piranhondra': base + 'images/monsters/piranhondra.webp',
  'mandragolina': base + 'images/monsters/mandragolina.webp',
  'mandragurlante': base + 'images/monsters/mandragurlante.webp',
  'manoscura': base + 'images/monsters/manoscura.webp',
  'branciossa': base + 'images/monsters/branciossa.webp',
  'zeccarina': base + 'images/monsters/zeccarina.webp',
  'sanguizecca': base + 'images/monsters/sanguizecca.webp',
  'vespirla': base + 'images/monsters/vespirla.webp',
  'calabronero': base + 'images/monsters/calabronero.webp',
  'gargoyleme': base + 'images/monsters/gargoyleme.webp',
  'basilombra': base + 'images/monsters/basilombra.webp',
  'chimeracco': base + 'images/monsters/chimeracco.webp',
  'lichiarore': base + 'images/monsters/lichiarore.webp',
  'minotombro': base + 'images/monsters/minotombro.webp',
  'krakentuscolo': base + 'images/monsters/krakentuscolo.webp',
  'grifospettrale': base + 'images/monsters/grifospettrale.webp',
  'dullaghan': base + 'images/monsters/dullaghan.webp',
  'becchino_eterno': base + 'images/monsters/becchino_eterno.webp',
  'strega_caldera': base + 'images/monsters/strega_caldera.webp',
  'conte_mezzanotte': base + 'images/monsters/conte_mezzanotte.webp',
  'zuccomperatore': base + 'images/monsters/zuccomperatore.webp',
  'samhainrex': base + 'images/monsters/samhainrex.webp',
  'nocturnalis': base + 'images/monsters/nocturnalis.webp',
  'ectoplasmax': base + 'images/monsters/ectoplasmax.webp',
  'abissaleviatano': base + 'images/monsters/abissaleviatano.webp',
  'mascherarca': base + 'images/monsters/mascherarca.png',
  'ombriel': base + 'images/monsters/ombriel.webp',
  'zuccheterna': base + 'images/monsters/zuccheterna.webp',
  'velanima': base + 'images/monsters/velanima.webp',
};

export function getMonsterIconPath(monsterId: string): string | null {
  return monsterPNGIcons[monsterId] || null;
}

export function hasPNGIcon(monsterId: string): boolean {
  return monsterId in monsterPNGIcons;
}

// ---------------------------------------------------------------------------
// Precaricamento icone: evita il ritardo quando un mostro compare per la prima
// volta. Le immagini vengono scaricate e DECODIFICATE in background all'avvio
// e tenute in una cache (riferimenti forti, cosi' il browser non le scarta).
// ---------------------------------------------------------------------------
const iconCache = new Map<string, HTMLImageElement>();

function loadIcon(id: string): Promise<void> {
  const src = monsterPNGIcons[id];
  if (!src || iconCache.has(id) || typeof Image === 'undefined') return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      iconCache.set(id, img);
      // decode() prepara il bitmap: il primo render e' istantaneo
      if (typeof img.decode === 'function') img.decode().catch(() => {}).finally(() => resolve());
      else resolve();
    };
    img.onerror = () => resolve(); // l'errore e' gestito dal fallback in MonsterIcons
    img.src = src;
  });
}

/** Precarica subito un gruppo di mostri (es. quelli del prossimo scontro). */
export function preloadMonsterIcons(ids: string[]): Promise<void> {
  return Promise.all(ids.map(loadIcon)).then(() => undefined);
}

let allPreloadStarted = false;
/**
 * Precarica tutte le icone in background a piccoli gruppi, senza bloccare
 * l'interfaccia. Va chiamata una sola volta all'avvio.
 */
export function preloadAllMonsterIcons(priorityIds: string[] = []): void {
  if (allPreloadStarted) return;
  allPreloadStarted = true;
  const rest = Object.keys(monsterPNGIcons).filter((id) => !priorityIds.includes(id));
  const queue = [...priorityIds, ...rest];
  const BATCH = 4;
  const next = () => {
    const batch = queue.splice(0, BATCH);
    if (batch.length === 0) return;
    Promise.all(batch.map(loadIcon)).then(() => {
      const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void) => void);
      if (ric) ric(next); else setTimeout(next, 30);
    });
  };
  next();
}
