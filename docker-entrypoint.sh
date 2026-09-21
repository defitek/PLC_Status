#!/bin/sh
set -eu

database_path="${DB_PATH:-/app/data/plc-status.db}"
data_directory="$(dirname "$database_path")"

# Railway montuje Volume dopiero przy starcie kontenera. Nowy punkt
# montowania może należeć do roota, dlatego ustawiamy prawa po montażu.
mkdir -p "$data_directory"
chown -R node:node "$data_directory"

# Sama aplikacja nadal działa jako nieuprzywilejowany użytkownik.
exec su-exec node "$@"
