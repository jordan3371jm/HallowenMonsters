#!/bin/bash
# Gioca le partite sul sito vero di Playgama, una alla volta.
#   ./run.sh            -> 6 partite (rianimazione e cura con pubblicità ogni tanto), poi 1 con tutte le pubblicità
# Variabile opzionale: NEED=<id archivio> per aspettare che il sito serva quella versione.
cd "$(dirname "$0")"
mkdir -p logs profiles
node bot.cjs "$PWD/profiles/B" B 6 30 2 > logs/B.out 2>&1
node bot.cjs "$PWD/profiles/A" A 1 30 1 > logs/A.out 2>&1
