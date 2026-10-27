#!/usr/bin/env bash
# Rejoue toutes les migrations sur un PostgreSQL local vide, deux fois de suite
# (elles doivent être réexécutables), puis vérifie les règles d'accès.
# Usage : npm run test:base   (PostgreSQL 16 installé localement, aucun accès réseau)
set -euo pipefail

ICI="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS="$ICI/../migrations"
BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$BIN/initdb" ] || { echo "PostgreSQL introuvable (initdb). Indiquer son dossier dans PG_BIN."; exit 1; }

DOSSIER="$(mktemp -d)"
PORT="${PG_PORT:-54339}"
# initdb refuse de tourner en root : on passe par l'utilisateur postgres
if [ "$(id -u)" = 0 ]; then chown postgres "$DOSSIER"; EN=(runuser -u postgres --); else EN=(); fi
arreter() { "${EN[@]}" "$BIN/pg_ctl" -D "$DOSSIER/donnees" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DOSSIER"; }
trap arreter EXIT

"${EN[@]}" "$BIN/initdb" -D "$DOSSIER/donnees" -U postgres -A trust >/dev/null
"${EN[@]}" "$BIN/pg_ctl" -D "$DOSSIER/donnees" -o "-p $PORT -k $DOSSIER -c listen_addresses=''" -l "$DOSSIER/journal" start -w >/dev/null

psql_() { PGOPTIONS="-c client_min_messages=warning" psql -h "$DOSSIER" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

# Base partagée : ce que Supabase et l'app réseau ont déjà posé
psql_ -f "$ICI/supabase_minimal.sql" >/dev/null
psql_ -f "$ICI/dependances_reseau.sql" >/dev/null

for passage in 1 2; do
  for f in "$MIGRATIONS"/[0-9][0-9][0-9][0-9]_*.sql; do
    psql_ -f "$f" >/dev/null || { echo "Échec au passage $passage : $(basename "$f")"; exit 1; }
  done
  echo "Passage $passage des migrations : OK"
done

# Chaque migration rejouée seule, dans le désordre, ne doit rien rouvrir
for f in $(ls "$MIGRATIONS"/[0-9][0-9][0-9][0-9]_*.sql | sort -r); do psql_ -f "$f" >/dev/null; done
echo "Migrations rejouées dans l'ordre inverse : OK"

# Une migration ancienne rejouée seule peut remettre ses règles d'origine, plus strictes, sur une table qu'une migration
# plus récente a ouverte (ex. 0001 sur reel_mensuel) : la base en ligne suit l'ordre normal, on y revient avant les contrôles
for f in "$MIGRATIONS"/[0-9][0-9][0-9][0-9]_*.sql; do psql_ -f "$f" >/dev/null; done

psql_ -f "$ICI/regles_acces.sql" >/dev/null
echo "Règles d'accès : OK"
