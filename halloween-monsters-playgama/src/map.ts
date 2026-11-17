// Mappa di un'ondata: 10 tappe dalla prima lotta al capopalestra.
// Dalla seconda tappa al falò quasi ogni tappa offre due strade: per esempio un
// selvatico (catture) o un allenatore (più monete e dolcetti, ma più rischio),
// un negozio o una lotta, un evento o una lotta. Da ogni nodo si può andare su
// entrambi i nodi della tappa successiva.
import type { MapNode, MapNodeType } from './types';

export const MAP_STEPS = 10;
const REST_STEP = 8;
const GYM_STEP = 9;

function shuffle<T>(pair: T[]): T[] {
  return Math.random() < 0.5 ? pair : [...pair].reverse();
}

/** Tipi dei nodi per ogni tappa (1 o 2 nodi). */
function stepTypes(wave: number, step: number): MapNodeType[] {
  if (step === GYM_STEP) return ['gym_leader'];
  if (step === REST_STEP) return ['rest'];
  // Inizio fisso della prima ondata: due selvatici da catturare, poi un allenatore
  if (wave === 1 && step <= 2) return [step === 2 ? 'trainer' : 'wild'];
  if (step === 0) return ['wild'];
  const battle = (): MapNodeType => (Math.random() < Math.min(0.6, 0.25 + wave * 0.01) ? 'trainer' : 'wild');
  switch (step) {
    case 3: return shuffle(['shop', battle()]);
    case 5: return shuffle(['event', battle()]);
    case 7: return shuffle(['shop', 'trainer']);
    default: return shuffle(['wild', 'trainer']);
  }
}

export function generateMap(wave: number): MapNode[] {
  const nodes: MapNode[] = [];
  const byStep: number[][] = [];
  for (let step = 0; step < MAP_STEPS; step++) {
    const types = stepTypes(wave, step);
    byStep[step] = types.map((type, lane) => {
      const id = nodes.length;
      nodes.push({ id, type, completed: false, connections: [], col: step, lane: types.length === 1 ? undefined : lane });
      return id;
    });
  }
  for (let step = 0; step < MAP_STEPS - 1; step++) {
    byStep[step].forEach(id => { nodes[id].connections = [...byStep[step + 1]]; });
  }
  return nodes;
}

/** Tappa del nodo (le mappe salvate con le versioni precedenti non hanno `col`: lì la tappa è l'id). */
export function stepOf(node: MapNode): number {
  return node.col ?? node.id;
}

/** Quante tappe dell'ondata sono state completate. */
export function stepsCompleted(map: MapNode[]): number {
  return new Set(map.filter(n => n.completed).map(stepOf)).size;
}
