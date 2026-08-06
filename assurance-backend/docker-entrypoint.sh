#!/bin/sh
set -eu

storage_dir="${APP_STORAGE_ROOT_DIR:-/data/assurance}"

mkdir -p "$storage_dir"
chown -R app:app "$storage_dir"
chmod 750 "$storage_dir"

exec su-exec app:app sh -c 'exec java $JAVA_OPTS -jar /app/app.jar'
