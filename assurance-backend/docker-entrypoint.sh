#!/bin/sh
set -eu

storage_dir="${APP_STORAGE_PIECES_JOINTES_DIR:-/data/assurance/pieces-jointes}"

mkdir -p "$storage_dir"
chown -R app:app "$storage_dir"
chmod 750 "$storage_dir"

exec su-exec app:app sh -c 'exec java $JAVA_OPTS -jar /app/app.jar'
