# Halloween Monsters — versione 2.6.2

## L'autopilota continua anche in background
- Con l'autopilota attivo il gioco continua a giocare anche se si apre un'altra finestra, un'altra scheda, un file o un'altra applicazione sopra il browser. Prima si fermava subito.
- Due cause risolte:
  - Playgama mette il gioco in "pausa" quando la pagina non è in primo piano, e l'autopilota la rispettava sempre. Ora si ferma solo per le pubblicità a schermo intero (regola 2.1.6); la pausa dovuta al cambio di finestra non lo blocca.
  - I browser rallentano i timer delle pagine nascoste (uno al secondo, dopo 5 minuti uno al minuto). I timer del gioco ora li conta un piccolo Web Worker, che il browser non rallenta (`src/bgTimers.ts`). Se il worker non si può creare, il gioco usa i timer normali come prima.
- Il suono resta spento quando la pagina è nascosta (regola 3.3.5), come prima.
- Senza autopilota non cambia nulla.
- Limiti del browser: sui telefoni, quando si passa a un'altra app, il sistema sospende del tutto la pagina e l'autopilota riparte al ritorno. Su computer alcune modalità di risparmio energetico (es. "Risparmio energetico" di Chrome) possono congelare le schede in background dopo un po'.

# Halloween Monsters — versione 2.6.1

## Prestazioni
Misure su un cellulare simulato (processore rallentato 4 volte), lavoro del thread principale del browser:

| | 2.6.0 | 2.6.1 |
|---|---|---|
| Menu principale fermo | ~290 ms al secondo | ~60 ms al secondo (−79%) |
| Lotte (autopilota) | ~560 ms al secondo | ~480 ms al secondo (−14%), impaginazione −55% |
| Motore di battaglia (200 partite simulate) | ~78 s | ~21 s (3,7 volte più veloce) |

- **Motore di battaglia.** Le copie dello stato usavano `JSON.parse(JSON.stringify(...))` e a ogni messaggio della lotta si copiavano per intero le due squadre per le animazioni (86% del tempo del motore). Ora c'è una copia diretta (`src/clone.ts`) e si ricopiano solo i mostri cambiati dall'istantanea precedente. Le regole non cambiano: il simulatore dà gli stessi risultati.
- **Animazioni CSS.** Il bagliore del titolo, la luce della luna, l'anello dei nodi della mappa e il pulsante "Ferma" animavano `filter` e `box-shadow`, che costringono a ridisegnare a ogni frame. Ora animano solo trasformazione e opacità, che calcola la scheda grafica. L'aspetto è lo stesso.
- **Barre PS ed EXP** si accorciano con `scaleX` invece di cambiare larghezza (prima l'impaginazione veniva ricalcolata a ogni frame).
- **Testo della lotta** che si scrive lettera per lettera: ora aggiorna solo il riquadro del messaggio, non tutta la schermata di battaglia, e con metà degli aggiornamenti (stessa velocità di lettura).
- **Effetti su canvas:** i bagliori sfumati sono disegnati una volta per colore e poi solo scalati (prima un gradiente nuovo per ogni particella a ogni frame), e le dimensioni del canvas non vengono più lette a ogni frame.
- **Telemetria `performance_sample`:** misura i frame 6 secondi ogni 30 invece che sempre. Il suo ciclo `requestAnimationFrame` costringeva il browser ad aggiornare tutte le animazioni a ogni frame durante le lotte. L'evento resta uguale e ogni ~30 secondi.
- **Salvataggio della partita durante le lotte:** i salvataggi di turni ravvicinati diventano una sola scrittura (dopo 300 ms, o subito se la pagina viene nascosta o chiusa). La protezione contro le ricariche resta: il turno è salvato prima che finiscano le sue animazioni.
- Tolta la sfocatura dello sfondo (`backdrop-blur`) dai pannelli di menu e mappa, che stanno sopra particelle animate: sfondo un po' più scuro al suo posto.
- Rimossi il CSS e un componente di animazioni della vecchia schermata di battaglia non più usati (foglio di stile compilato da 114 a 106 KB).

# Halloween Monsters — versione 2.6.0

## Niente più lotte ripetute ricaricando la pagina
- La partita si salva a ogni turno di lotta, non solo sulla mappa. Chi ricarica a metà lotta la ritrova com'era, con lo stesso nemico, gli stessi PS e gli stessi strumenti.
- Prima ricaricando si poteva sfuggire a una lotta persa (anche contro un capopalestra) e cambiare il selvatico finché non usciva un leggendario o uno shiny.
- Una lotta già persa porta al game over (con le solite possibilità di rianimazione); una lotta già vinta assegna i premi e torna alla mappa.

## Mappa con due strade
- Dalla seconda tappa al falò quasi ogni tappa offre una scelta: selvatico (catture) o allenatore (più monete), negozio o lotta, evento o lotta, negozio o allenatore.
- Le tappe restano 10 (le ultime due sono sempre falò e capopalestra). La prima ondata inizia sempre con due selvatici e un allenatore.
- Le partite salvate con la versione precedente continuano con la loro mappa.
- L'autopilota con la squadra ferita preferisce negozi ed eventi alle lotte.

## Mostri con un'identità
- Ogni specie cresce in modo diverso: chi ha tanta difesa di base guadagna più difesa a ogni livello, chi è veloce più velocità. In media la crescita è quella di prima; rari, leggendari e mitici crescono un po' di più.
- Le mosse nuove vengono dal tipo del mostro e da un tipo secondario della sua famiglia (es. Tizzonetto → Tuono, Fanghiglia → Veleno), in ordine di potenza. Prima ogni mostro poteva imparare mosse di qualunque tipo.

## Squadra che cresce insieme
- I mostri in panchina ricevono il 35% dell'EXP (prima 15%), e il 50% in più se sono 5 o più livelli sotto il più forte della squadra.
- Condividi EXP Base ora dà il 50% (prima 25%), Condividi EXP Totale il 75% (prima 50%).

## Difficoltà in una tabella sola
- Tutti gli aumenti per ondata delle statistiche nemiche sono in un'unica tabella (`WAVE_SCALING` in `src/battle/encounters.ts`) invece di cinque moltiplicatori uno sopra l'altro.
- Prime ondate un po' più morbide, aumenti dopo l'ondata 10 un po' più forti per compensare la squadra più forte.
- Simulazione (200 partite dell'autopilota senza Meta Negozio): ondata media 20 (prima 18), sconfitte nelle ondate 1-5 dal 9% al 6%.

## Schermo
- Menu principale più compatto: "Inizia Gioco", "Monete Gratis" e tutte le schede restano sopra il banner anche su cellulari piccoli (360×640) e su computer a 1280×720. "Monete Gratis" è subito sotto "Inizia Gioco".
- Le notifiche (risultati sbloccati, accessi giornalieri…) compaiono una alla volta, più in basso: non coprono più il titolo dell'ondata né il pulsante "Ferma" dell'autopilota.

## Codice
- Rimosse 10 librerie non usate e il codice dei vecchi generatori di nemici.
- Dati permanenti e bonus del Meta Negozio spostati da `App.tsx` a `src/progress.ts`, mappa in `src/map.ts`, crescita in `src/battle/growth.ts`, mosse per specie in `src/battle/learnsets.ts`.
- Meta Negozio, Statistiche, Impostazioni e coriandoli si caricano solo quando servono; React sta in un file a parte che resta in cache tra una versione e l'altra. Codice caricato all'avvio: da 571 KB a 530 KB.
- Rimosso `halloween-monsters-playgama.zip` (copia dei sorgenti ferma alla 2.3.3, i sorgenti sono già nel repository). `halloween-monsters-playgama-build.zip` è ricostruito con la 2.6.0.

# Halloween Monsters — versione 2.5.0

## Difficoltà progressiva dopo l'ondata 5
- Le ondate 1-5 restano come prima.
- Dall'ondata 6 alla 10 i nemici diventano più forti del 3% a ogni ondata (PS, attacco e difesa; velocità a metà): +15% all'ondata 10.
- Dall'ondata 11 in poi l'aumento è più ripido, +5% a ogni ondata: +40% all'ondata 15, +65% alla 20, +115% alla 30.
- Si somma alla crescita di livello e al +1% per ondata già presenti.
- Simulazione (150 partite dell'autopilota senza potenziamenti del Meta Negozio): l'ondata media raggiunta passa da 28 a 17; tra la 6 e la 10 quasi nessuno perde, la selezione vera parte dalla 11. Con i potenziamenti farmati si va più avanti.

## Pozione Totale (cura totale)
- Nuova pozione: ripristina 200 PS e cura tutti gli stati alterati.
- Nel negozio delle caramelle a 200 🍬.
- Nel Meta Negozio: "Pozione Totale Extra Iniziale", 300 monete, fino a 3 livelli (+1 pozione a inizio partita per livello, e +1 di capienza).
- L'autopilota la usa per curarsi, la compra nei negozi dall'ondata 12 e prende il potenziamento nel Meta Negozio.

# Halloween Monsters — versione 2.4.1

## Autopilota: niente elementi sovrapposti
- In battaglia il pulsante "🤖 Ferma" sta dentro l'etichetta della lotta in alto (prima il riquadro dell'autopilota copriva in parte l'etichetta "Selvatico").
- Sulla mappa, con l'autopilota attivo, il titolo dell'ondata scende sotto il riquadro invece di finirci sotto.
- Controllato a 320 px, 420 px e in una finestra quadrata 700×700.

# Halloween Monsters — versione 2.4.0

## Autopilota (Impostazioni → 🤖 Autopilota)
- Nuova opzione che gioca al posto del giocatore per farmare monete e potenziarsi per le partite successive.
- In battaglia: sceglie la mossa migliore (superefficace, colpo di grazia più preciso), cura con la pozione giusta quando i PS sono bassi, toglie sonno/paralisi/putrefazione con l'Elisir, cambia mostro quando lo scontro è sfavorevole, rianima i compagni con le Lacrime di Banshee, usa Cristalli PP, Caramelle Rare, Nettare e la Pozione della Non-Morte contro i capipalestra.
- Cattura i selvatici finché la squadra non è piena: indebolisce il mostro senza mandarlo KO e lancia lo strumento più economico con buone probabilità (la Sfera del Re delle Zucche solo per mostri rari, shiny o leggendari).
- Sulla mappa sceglie il percorso (falò se la squadra è stanca, selvatici per catturare, allenatori per le monete), mette in testa il mostro più in forma, compra pozioni e strumenti di cattura nei negozi, impara le mosse nuove solo se migliori.
- Tra una partita e l'altra riscuote sfide e trofei completati e, con "Potenziamenti automatici", spende le monete nel Meta Negozio; con "Continua a farmare" ricomincia da solo dopo la sconfitta. Usa l'Amuleto del Becchino se c'è.
- Battaglie accelerate mentre è attivo. Riquadro in alto con partite giocate, monete guadagnate e pulsante "Ferma".
- Non guarda mai pubblicità e non fa acquisti: aspetta se la piattaforma mette in pausa il gioco. Si spegne a ogni riavvio del gioco.
- Simulazione (200 partite, senza potenziamenti): l'autopilota arriva in media all'ondata 27 (il vecchio bot di prova all'ondata 6).

# Halloween Monsters — versione 2.1.0

## Evoluzioni come in Pokémon
- Ogni evoluzione si incontra solo dal livello in cui la forma precedente si evolve (es. Aracnoscuro dal 14, Vedovamantis dal 32, le evoluzioni degli starter dal 16). Vale per selvatici, incontri doppi, allenatori e aiutanti dei capipalestra.
- Le forme base spariscono 8 livelli dopo la loro evoluzione; i mostri rari compaiono dal loro livello, i leggendari dal 25 e i mitici dal 30.
- Un mostro catturato oltre il suo livello di evoluzione si evolve al primo aumento di livello (prima non si evolveva più).

## Banner
- Banner pubblicitario in basso (Advanced Banners del Bridge) su computer, tablet e cellulari, anche in battaglia. Lo spazio viene riservato: il banner non copre mai pulsanti o comandi. Più basso sui cellulari (7% in verticale), nascosto automaticamente durante le pubblicità a schermo intero.

## Bilanciamento
- Primo capopalestra più equo (un livello in meno, niente PS extra); capipalestra successivi con PS boss ×1,2 invece di ×1,3.
- Allenatori e capipalestra leggermente meno aggressivi; i mostri rari sono un po' meno frequenti (12%).

# Halloween Monsters — versione 2.0.0

## Playgama Bridge v2 e pubblicità
- Eventi corretti della v2: `PAUSE_STATE_CHANGED` e `AUDIO_STATE_CHANGED` (prima si ascoltavano eventi inesistenti), `isAudioEnabled` letto come proprietà.
- Pubblicità premiate: una sola pubblicità per ricompensa (prima la cura ne chiedeva 2–3 di fila, e la seconda veniva scartata in silenzio dal Bridge mentre la prima risultava ancora in corso: era la causa principale degli errori).
- Attesa che nessun annuncio sia in corso prima di richiederne uno, un nuovo tentativo automatico se la richiesta viene ignorata, gestione delle piattaforme che non inviano `closed` dopo `rewarded`.
- La ricompensa arriva solo dopo lo stato `rewarded`: rimossa la "pubblicità simulata" che regalava il premio quando l'annuncio falliva (non ammesso da Playgama).
- Interstitial solo nelle pause naturali (fine ondata, uscita dal game over), non più sopra il pulsante "Rianima".
- Rianimazione con pubblicità limitata a una volta per run.
- Storage: lettura e scrittura di tutte le chiavi con una sola chiamata, niente `localStorage` diretto sulle piattaforme.
- Lingua presa da `platform.language` (prima partiva sempre in inglese), `game_ready` inviato una sola volta a gioco pronto.
- Analytics con `analytics.send`, messaggi `level_started/completed/failed`, `performance_sample` ogni 30 s durante le lotte, classifica `best_wave`.
- Rimosse risorse esterne (Font Awesome da CDN) e gli script della sandbox; niente barra di scorrimento della pagina.

## Battaglia (motore riscritto)
- Tabella dei tipi in stile Pokémon con superefficace, poco efficace e **nessun effetto** (Tuono→Osso, Veleno→Osso).
- STAB ×1,5, brutti colpi, variazione del danno, modificatori di statistica per le mosse di stato (prima Riflesso, Terrore, Scudo d'Osso, Fotosintesi ecc. non facevano nulla).
- Stati alterati ribilanciati: un solo stato maggiore alla volta, durata limitata (3–4 turni, sonno 1–3), immunità di tipo (es. i mostri Fuoco non si scottano), probabilità secondarie ridotte di circa il 60%.
- IA nemica che sceglie la mossa migliore (più furba per allenatori e capipalestra).
- Cattura con probabilità mostrata in percentuale, più facile con PS bassi e stati alterati; i mostri catturati si allineano al livello della squadra.
- EXP a tutti i mostri scesi in campo, curva di livello rivista, nodo **Falò** prima del capopalestra, +10% PS dopo ogni vittoria.
- Corretti vari bug: sconfitta conteggiata come fine run quando restavano mostri vivi, danni da stato sommati male, modale "nuova mossa" sul mostro sbagliato, mostri esausti che restavano "attivi", nodi negozio/evento ripetibili.

## Grafica e audio
- Nuova schermata di battaglia in stile Pokémon: arena notturna con piattaforme, riquadri PS animati, box dialoghi con testo progressivo, menu Lotta/Borsa/Mostri/Fuga.
- Effetti visivi su canvas per ogni tipo di mossa, cure, stati, aumenti/cali, cattura con scosse, evoluzione, numeri di danno, scuotimento.
- Effetti sonori per ogni tipo di mossa, colpi, KO, cattura, menu, level up; musica per menu e battaglie (tutto CC0, crediti nelle Impostazioni).
- Icone dei tipi vettoriali, indicatore di efficacia sulle mosse.
- Nuovo artwork di **Mascherarca** (PNG con trasparenza).

## Meta Negozio, missioni, impostazioni
- Impostazioni collegate davvero al gioco (prima effetti/scuotimento/animazioni non avevano effetto) + musica, effetti sonori, battaglie veloci.
- Elisir Infinito, Palestra del Becchino, Borsa del Guaritore e Incantatore di Mostri corretti e con descrizioni aggiornate; gli strumenti tenuti si applicano anche ai mostri catturati.
- Nettare di Zucca e Pozione della Non-Morte acquistabili nel negozio (prima irraggiungibili); capienza base delle cure portata a 5.
- Missioni giornaliere, settimanali e mensili ampliate (4 per periodo, nuovi tipi) e 12 nuovi obiettivi.
