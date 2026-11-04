# Bot di test per Halloween Monsters

Strumenti usati per provare il gioco sul sito vero di Playgama e per bilanciarlo.

| File | A cosa serve |
|---|---|
| `bot.cjs` | Bot che gioca sul sito vero (playgama.com/game/halloween-monsters) con Playwright |
| `run.sh` | Avvia 6 partite di prova e poi 1 partita con tutte le pubblicità |
| `sim.ts` | Simulatore veloce: centinaia di partite in pochi secondi, senza browser |
| `mock-bridge.js` | Finto Playgama Bridge (pubblicità, banner, salvataggi) per provare il gioco in locale |

## Cosa serve

- Node.js 18 o più recente
- Playwright con Chromium: `npm i -D playwright` e poi `npx playwright install chromium`
  (nelle sessioni cloud di Claude Code è già installato)
- Per il simulatore: le dipendenze del gioco (`npm install` dentro `halloween-monsters-playgama`)

## Bot sul sito vero

```bash
cd tools/playtest-bot
node bot.cjs <cartella-profilo> <nome> <partite> <ondata-obiettivo> <pubblicità>
```

- `cartella-profilo`: il salvataggio del browser. Usando sempre la stessa, monete e potenziamenti del Meta Shop restano da una partita all'altra.
- `nome`: nome della prova. I risultati vanno in `out_<nome>/`.
- `partite`: quante partite giocare una dopo l'altra.
- `ondata-obiettivo`: dopo quale ondata fermarsi (30 = fino alla fine del gioco).
- `pubblicità`:
  - `0` = non tocca mai le pubblicità
  - `2` = usa ogni tanto la rianimazione e la cura completa della squadra
  - `1` = come `2`, più 3 pubblicità "Monete gratis" all'inizio

Esempio, una partita fino all'ondata 30 senza pubblicità:

```bash
node bot.cjs "$PWD/profiles/test" prova 1 30 0
```

Oppure tutto il giro di prove (6 partite + 1 con le pubblicità):

```bash
./run.sh
```

Variabile opzionale `NEED=<id archivio>`: il bot aspetta che il sito serva quella versione (utile subito dopo una pubblicazione, per la cache). L'id si legge nell'URL del gioco, per esempio `cmvyeg720`.

### Cosa fa il bot

- Apre la pagina di Playgama, preme "Play Now" e chiude la pubblicità iniziale.
- Attiva le battaglie veloci e compra potenziamenti nel Meta Shop in ordine di priorità.
- In battaglia:
  - cura sotto il 35% di PS;
  - cattura i selvatici indeboliti finché la squadra non è piena;
  - sceglie la mossa superefficace o la più forte.
- Nei negozi compra pozioni e Caramelle Stregate.
- Chiude le pubblicità a schermo intero di Playgama con "Close", come farebbe un giocatore.
- Se la pagina di Playgama va in crash, la riapre e preme "Continua partita".

### Dove guardare i risultati

- `out_<nome>/log.jsonl`: una riga per evento. I principali:
  - `wave`: ondata, minuti, caramelle, catture, pozioni usate, memoria del gioco (`heapMB`);
  - `RUN_END` / `GAME_COMPLETED`: fine della partita;
  - `STUCK`: il bot è fermo da troppo tempo;
  - `coin_ad`, `heal_ad`, `revive_ad`: pubblicità usate e se hanno dato la ricompensa.
- `out_<nome>/live.png` e `live.txt`: schermata e testo del gioco, aggiornati ogni minuto.
- `out_<nome>/r<partita>_w<ondata>.png`: schermata a ogni nuova ondata.

Per vedere solo i passaggi importanti:

```bash
grep -E '"wave"|RUN_END|GAME_COMPLETED|STUCK' out_<nome>/log.jsonl
```

### Avvertenze

- **Un bot alla volta.** La pagina di Playgama è pesante (pubblicità). Con più bot insieme la memoria finisce e le pagine vanno in crash.
- **Pubblicità vere.** Con `1` o `2` il bot guarda pubblicità vere sul tuo gioco: conta come traffico non valido. Usalo poco.
- **Traduzioni.** Il bot riconosce i pulsanti dal testo in inglese, la lingua che Playgama dà al browser di prova. Se cambi i testi in inglese del gioco, aggiorna i testi cercati in `bot.cjs`, per esempio "Start Game", "Continue run", "Heal Team".

## Simulatore di bilanciamento

Gioca centinaia di partite con il motore di battaglia vero, senza browser, e mostra fino a quale ondata si arriva.

```bash
cd tools/playtest-bot
npx --prefix ../../halloween-monsters-playgama esbuild sim.ts --bundle --platform=node --outfile=sim.cjs
N=300 SHARE=0.15 node sim.cjs
```

- `N`: numero di partite.
- `SHARE`: EXP alla panchina (0.15 è il valore base del gioco).
- `SLOPE`: crescita del livello dei nemici, per provare valori diversi senza toccare il gioco.
- `TRACE=1`: stampa ogni lotta (con `N=1`).

Il risultato ha questa forma:

```
median wave 6 p25 5 p75 8
hist {"1":4,"2":1, ...}
```

La prima riga dice a che ondata arriva la partita tipica, quella sfortunata (`p25`) e quella fortunata (`p75`). `hist` conta quante partite finiscono a ogni ondata.

Il giocatore del simulatore è semplice: cattura poco e non usa il Meta Shop. Un giocatore vero arriva più lontano.

## Prova in locale con il finto Bridge

1. Compila il gioco con `npm run build`.
2. Avvialo con `npx vite preview --port 4173`.
3. Nello script Playwright, sostituisci il Bridge con `mock-bridge.js`:

```js
await page.route('**/playgama-bridge.js', r => r.fulfill({ path: 'mock-bridge.js', contentType: 'application/javascript' }));
```

Il finto Bridge simula: pubblicità premiate (sempre con ricompensa), banner in basso (con `window.__dev = 'mobile'` prima del caricamento simula un cellulare) e salvataggi in memoria.

## Risultati principali delle prove (1 novembre 2026)

- **2.2.x:** troppo difficile. Le partite finivano all'ondata 1-2.
- **2.3.0:** troppo facile. All'ondata 15 il mostro principale era al livello 75 contro nemici al 28-34.
- **2.3.3** (prime 3 ondate facili, difficoltà che sale a ogni ondata, EXP in base al livello, salvataggio della partita):
  - l'ondata 24 è arrivata in circa un'ora, contando i crash della pagina ripresi con "Continua partita";
  - da completare: arrivare all'ondata 30 e controllare l'accumulo di caramelle (15.000 all'ondata 24, perché il bot non compra Caramelle Rare).
