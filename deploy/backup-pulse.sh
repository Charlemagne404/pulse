#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/home/charlie/pulse
BACKUP_DIR=${PULSE_BACKUP_DIR:-/var/backups/pulse}
RETENTION_DAYS=${PULSE_BACKUP_RETENTION_DAYS:-14}

/usr/bin/node "$APP_DIR/deploy/backup-pulse.mjs"
find "$BACKUP_DIR" -type f -name 'pulse-*.sqlite' -mtime "+$RETENTION_DAYS" -delete
