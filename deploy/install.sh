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
PULSE_HOST_DEFAULT=127.0.0.1
PULSE_PORT_DEFAULT=8789
PULSE_CORS_ORIGIN_DEFAULT="https://$SITE_DOMAIN"

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
  cat > "$ENV_FILE" <<EOF
PULSE_HOST=$PULSE_HOST_DEFAULT
PULSE_PORT=$PULSE_PORT_DEFAULT
PULSE_CORS_ORIGIN=$PULSE_CORS_ORIGIN_DEFAULT
EOF
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
fi
chmod 0644 "$ENV_FILE"

install -m 0644 "$SERVICE_SOURCE" "$SYSTEMD_SERVICE_PATH"
systemctl daemon-reload
systemctl enable --now pulse-collector.service
systemctl restart pulse-collector.service
systemctl is-active --quiet pulse-collector.service
systemctl reload caddy

echo "Pulse site installed."
