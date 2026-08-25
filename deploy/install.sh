#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/home/charlie/pulse
WEB_ROOT=/var/www/pulse
CADDYFILE=/etc/caddy/Caddyfile
SITE_BLOCK_SOURCE="$APP_DIR/deploy/Caddyfile.pulse"
SERVICE_SOURCE="$APP_DIR/deploy/pulse-collector.service"
BACKUP_SERVICE_SOURCE="$APP_DIR/deploy/pulse-backup.service"
BACKUP_TIMER_SOURCE="$APP_DIR/deploy/pulse-backup.timer"
HEALTHCHECK_SERVICE_SOURCE="$APP_DIR/deploy/pulse-healthcheck.service"
HEALTHCHECK_TIMER_SOURCE="$APP_DIR/deploy/pulse-healthcheck.timer"
SITE_DOMAIN="pulse.continental-hub.com"
APP_USER=charlie
APP_GROUP=charlie
WEB_USER=caddy
WEB_GROUP=caddy
SYSTEMD_SERVICE_PATH=/etc/systemd/system/pulse-collector.service
BACKUP_SERVICE_PATH=/etc/systemd/system/pulse-backup.service
BACKUP_TIMER_PATH=/etc/systemd/system/pulse-backup.timer
HEALTHCHECK_SERVICE_PATH=/etc/systemd/system/pulse-healthcheck.service
HEALTHCHECK_TIMER_PATH=/etc/systemd/system/pulse-healthcheck.timer
ENV_DIR=/etc/pulse
ENV_FILE="$ENV_DIR/pulse-collector.env"
DATA_DIR=/var/lib/pulse
EXPORT_DIR="$DATA_DIR/exports"
BACKUP_DIR=/var/backups/pulse
PULSE_HOST_DEFAULT=127.0.0.1
PULSE_PORT_DEFAULT=8789
PULSE_CORS_ORIGIN_DEFAULT="https://$SITE_DOMAIN"
PULSE_DB_PATH_DEFAULT="$DATA_DIR/pulse.sqlite"
PULSE_EXPORT_DIR_DEFAULT="$EXPORT_DIR"
PULSE_COLLECTOR_CORS_ORIGINS_DEFAULT="*"
PULSE_BACKUP_DIR_DEFAULT="$BACKUP_DIR"
PULSE_HEALTH_URL_DEFAULT="http://127.0.0.1:8789/api/health"

if [[ $EUID -ne 0 ]]; then
  echo "Run this script as root."
  exit 1
fi

if [[ ! -f "$APP_DIR/package.json" ]]; then
  echo "Missing $APP_DIR/package.json"
  exit 1
fi

runuser -u "$APP_USER" -- npm --prefix "$APP_DIR" ci
runuser -u "$APP_USER" -- npm --prefix "$APP_DIR" run build
runuser -u "$APP_USER" -- npm --prefix "$APP_DIR" run build:server

if [[ ! -f "$APP_DIR/dist/index.html" ]]; then
  echo "Build output missing at $APP_DIR/dist/index.html"
  exit 1
fi

if [[ ! -f "$APP_DIR/server/dist/server.js" ]]; then
  echo "Server build output missing at $APP_DIR/server/dist/server.js"
  exit 1
fi

install -d -o "$WEB_USER" -g "$WEB_GROUP" -m 0755 "$WEB_ROOT"
install -d -o "$APP_USER" -g "$APP_GROUP" -m 0750 "$DATA_DIR" "$EXPORT_DIR" "$BACKUP_DIR"
rsync -a --delete "$APP_DIR/dist/" "$WEB_ROOT/"
chown -R "$WEB_USER:$WEB_GROUP" "$WEB_ROOT"

TMP_CADDYFILE=$(mktemp)
trap 'rm -f "$TMP_CADDYFILE"' EXIT
cp "$CADDYFILE" "$TMP_CADDYFILE"
awk -v domain="$SITE_DOMAIN" -v source="$SITE_BLOCK_SOURCE" '
BEGIN {
  while ((getline line < source) > 0) {
    replacement = replacement line ORS
  }
  close(source)
}
$0 ~ "^" domain " \\{" {
  if (!replaced) {
    printf "%s", replacement
    replaced = 1
  }
  inblock = 1
  depth = 1
  next
}
inblock {
  opens = gsub(/\{/, "{")
  closes = gsub(/\}/, "}")
  depth += opens - closes
  if (depth <= 0) {
    inblock = 0
  }
  next
}
{
  print
}
END {
  if (!replaced) {
    printf ORS "%s", replacement
  }
}
' "$TMP_CADDYFILE" > "$TMP_CADDYFILE.next"
mv "$TMP_CADDYFILE.next" "$TMP_CADDYFILE"

caddy validate --config "$TMP_CADDYFILE" --adapter caddyfile
install -m 0644 "$TMP_CADDYFILE" "$CADDYFILE"

install -d -m 0755 "$ENV_DIR"
if [[ ! -f "$ENV_FILE" ]]; then
  printf '%s\n' \
    "PULSE_HOST=$PULSE_HOST_DEFAULT" \
    "PULSE_PORT=$PULSE_PORT_DEFAULT" \
    "PULSE_CORS_ORIGIN=$PULSE_CORS_ORIGIN_DEFAULT" \
    "PULSE_CORS_ORIGINS=$PULSE_CORS_ORIGIN_DEFAULT" \
    "PULSE_COLLECTOR_CORS_ORIGINS=$PULSE_COLLECTOR_CORS_ORIGINS_DEFAULT" \
    "PULSE_DB_PATH=$PULSE_DB_PATH_DEFAULT" \
    "PULSE_EXPORT_DIR=$PULSE_EXPORT_DIR_DEFAULT" \
    "PULSE_BACKUP_DIR=$PULSE_BACKUP_DIR_DEFAULT" \
    "PULSE_HEALTH_URL=$PULSE_HEALTH_URL_DEFAULT" > "$ENV_FILE"
else
  if ! grep -q '^PULSE_HOST=' "$ENV_FILE"; then
    printf 'PULSE_HOST=%s\n' "$PULSE_HOST_DEFAULT" >> "$ENV_FILE"
  fi

  if ! grep -q '^PULSE_PORT=' "$ENV_FILE"; then
    printf 'PULSE_PORT=%s\n' "$PULSE_PORT_DEFAULT" >> "$ENV_FILE"
  elif grep -q '^PULSE_PORT=8787$' "$ENV_FILE"; then
    sed -i "s/^PULSE_PORT=8787$/PULSE_PORT=$PULSE_PORT_DEFAULT/" "$ENV_FILE"
  fi

  if ! grep -q '^PULSE_CORS_ORIGIN=' "$ENV_FILE"; then
    printf 'PULSE_CORS_ORIGIN=%s\n' "$PULSE_CORS_ORIGIN_DEFAULT" >> "$ENV_FILE"
  fi

  if ! grep -q '^PULSE_CORS_ORIGINS=' "$ENV_FILE"; then
    printf 'PULSE_CORS_ORIGINS=%s\n' "$PULSE_CORS_ORIGIN_DEFAULT" >> "$ENV_FILE"
  fi

  if ! grep -q '^PULSE_COLLECTOR_CORS_ORIGINS=' "$ENV_FILE"; then
    printf 'PULSE_COLLECTOR_CORS_ORIGINS=%s\n' "$PULSE_COLLECTOR_CORS_ORIGINS_DEFAULT" >> "$ENV_FILE"
  fi

  if ! grep -q '^PULSE_DB_PATH=' "$ENV_FILE"; then
    printf 'PULSE_DB_PATH=%s\n' "$PULSE_DB_PATH_DEFAULT" >> "$ENV_FILE"
  fi

  if ! grep -q '^PULSE_EXPORT_DIR=' "$ENV_FILE"; then
    printf 'PULSE_EXPORT_DIR=%s\n' "$PULSE_EXPORT_DIR_DEFAULT" >> "$ENV_FILE"
  fi

  if ! grep -q '^PULSE_BACKUP_DIR=' "$ENV_FILE"; then
    printf 'PULSE_BACKUP_DIR=%s\n' "$PULSE_BACKUP_DIR_DEFAULT" >> "$ENV_FILE"
  fi

  if ! grep -q '^PULSE_HEALTH_URL=' "$ENV_FILE"; then
    printf 'PULSE_HEALTH_URL=%s\n' "$PULSE_HEALTH_URL_DEFAULT" >> "$ENV_FILE"
  fi
fi
chown "$APP_USER:$APP_GROUP" "$ENV_FILE"
chmod 0640 "$ENV_FILE"

install -m 0644 "$SERVICE_SOURCE" "$SYSTEMD_SERVICE_PATH"
install -m 0644 "$BACKUP_SERVICE_SOURCE" "$BACKUP_SERVICE_PATH"
install -m 0644 "$BACKUP_TIMER_SOURCE" "$BACKUP_TIMER_PATH"
install -m 0644 "$HEALTHCHECK_SERVICE_SOURCE" "$HEALTHCHECK_SERVICE_PATH"
install -m 0644 "$HEALTHCHECK_TIMER_SOURCE" "$HEALTHCHECK_TIMER_PATH"
systemctl daemon-reload
systemctl enable --now pulse-collector.service
systemctl enable --now pulse-backup.timer
systemctl enable --now pulse-healthcheck.timer
systemctl restart pulse-collector.service
systemctl is-active --quiet pulse-collector.service
systemctl reload caddy

echo "Pulse site installed."
