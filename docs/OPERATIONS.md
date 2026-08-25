# Pulse operations

This is the minimum operating procedure for the self-hosted Pulse collector.

## Runtime and service

Pulse requires Node.js 22.5 or newer because the collector uses the built-in `node:sqlite` module.
The deployment installer builds the frontend and server, then manages these units:

- `pulse-collector.service` — the HTTP collector and analytics API
- `pulse-backup.timer` — a daily SQLite backup
- `pulse-healthcheck.timer` — a local health check every five minutes

Useful checks:

```sh
curl --fail http://127.0.0.1:8789/api/health
systemctl status pulse-collector.service
systemctl list-timers 'pulse-*.timer'
journalctl -u pulse-collector.service -n 100 --no-pager
```

The public endpoint is `/api/health`. A healthy response is local process and storage evidence; it
does not prove DNS, TLS, Caddy routing, Continental ID, or a browser can install the SDK.

## Configuration

The installer creates `/etc/pulse/pulse-collector.env` with mode `0640`. Important settings are:

- `PULSE_DB_PATH` — SQLite database path, default `/var/lib/pulse/pulse.sqlite`
- `PULSE_EXPORT_DIR` — persisted export artifacts, default `/var/lib/pulse/exports`
- `PULSE_CORS_ORIGINS` — authenticated dashboard origins
- `PULSE_COLLECTOR_CORS_ORIGINS` — origins allowed to send browser collection requests; `*` is the default because collection is anonymous and unauthenticated
- `PULSE_BACKUP_DIR` — backup destination, default `/var/backups/pulse`
- `PULSE_HEALTH_URL` — local health endpoint used by the timer, default `http://127.0.0.1:8789/api/health`

After changing the environment file:

```sh
systemctl restart pulse-collector.service
systemctl start pulse-healthcheck.service
```

## Backups and restore

Run an on-demand backup:

```sh
systemctl start pulse-backup.service
ls -lh /var/backups/pulse
```

The backup job uses SQLite `VACUUM INTO`, so the resulting file is a consistent database snapshot.
Files older than `PULSE_BACKUP_RETENTION_DAYS` (14 by default) are pruned from the explicit backup
directory only.

To restore a known backup, stop the collector, replace the configured database file, remove only
that database's transient `-wal` and `-shm` files if present, then start the service and check
health:

```sh
systemctl stop pulse-collector.service
cp --preserve=mode,ownership /var/backups/pulse/pulse-YYYYMMDDTHHMMSSZ.sqlite /var/lib/pulse/pulse.sqlite
rm -f /var/lib/pulse/pulse.sqlite-wal /var/lib/pulse/pulse.sqlite-shm
systemctl start pulse-collector.service
curl --fail http://127.0.0.1:8789/api/health
```

Keep the original database file until the restored instance has been validated. A restore proves
local SQLite recovery only; it does not restore external authentication, DNS, certificates, or
provider configuration.

## Rollout

From the deployed checkout:

```sh
npm ci
npm run lint
npm test
npm audit --omit=dev --audit-level=high
sudo ./deploy/install.sh
```

The installer validates Caddy before replacing its configuration and does not overwrite an existing
environment value. Review the resulting service and timer state after each rollout.
