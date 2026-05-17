#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/home/charlie/pulse
WEB_ROOT=/var/www/pulse
CADDYFILE=/etc/caddy/Caddyfile
SITE_BLOCK_SOURCE="$APP_DIR/deploy/Caddyfile.pulse"
SERVICE_SOURCE="$APP_DIR/deploy/pulse-collector.service"
SITE_DOMAIN="pulse.continental-hub.com"
APP_USER=charlie
APP_GROUP=charlie
WEB_USER=caddy
WEB_GROUP=caddy
SYSTEMD_SERVICE_PATH=/etc/systemd/system/pulse-collector.service
ENV_DIR=/etc/pulse
ENV_FILE="$ENV_DIR/pulse-collector.env"

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
rsync -a --delete "$APP_DIR/dist/" "$WEB_ROOT/"
chown -R "$WEB_USER:$WEB_GROUP" "$WEB_ROOT"

TMP_CADDYFILE=$(mktemp)
trap 'rm -f "$TMP_CADDYFILE"' EXIT
cp "$CADDYFILE" "$TMP_CADDYFILE"

if ! grep -Fq "$SITE_DOMAIN" "$TMP_CADDYFILE"; then
  printf '\n' >> "$TMP_CADDYFILE"
  cat "$SITE_BLOCK_SOURCE" >> "$TMP_CADDYFILE"
  printf '\n' >> "$TMP_CADDYFILE"
fi

caddy validate --config "$TMP_CADDYFILE" --adapter caddyfile
install -m 0644 "$TMP_CADDYFILE" "$CADDYFILE"

install -d -m 0755 "$ENV_DIR"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<EOF
PULSE_HOST=127.0.0.1
PULSE_PORT=8787
PULSE_CORS_ORIGIN=https://$SITE_DOMAIN
EOF
  chmod 0644 "$ENV_FILE"
fi

install -m 0644 "$SERVICE_SOURCE" "$SYSTEMD_SERVICE_PATH"
systemctl daemon-reload
systemctl enable --now pulse-collector.service
systemctl restart pulse-collector.service
systemctl is-active --quiet pulse-collector.service
systemctl reload caddy

echo "Pulse site installed."
