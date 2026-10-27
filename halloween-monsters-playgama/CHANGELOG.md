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
