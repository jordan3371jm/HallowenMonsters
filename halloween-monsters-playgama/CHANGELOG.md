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
