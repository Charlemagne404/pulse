#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/home/charlie/pulse
WEB_ROOT=/var/www/pulse
CADDYFILE=/etc/caddy/Caddyfile
SITE_BLOCK_SOURCE="$APP_DIR/deploy/Caddyfile.pulse"
SITE_DOMAIN="pulse.continental-hub.com"
APP_USER=charlie
APP_GROUP=charlie
WEB_USER=caddy
WEB_GROUP=caddy

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

if [[ ! -f "$APP_DIR/dist/index.html" ]]; then
  echo "Build output missing at $APP_DIR/dist/index.html"
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
systemctl reload caddy

echo "Pulse site installed."
