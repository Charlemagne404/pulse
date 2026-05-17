# Continental Pulse

Pulse is a mock frontend for a privacy-friendly analytics product in the Continental ecosystem.

## Stack

- React 19
- TypeScript
- Vite
- React Router

## Routes

- `/` landing page
- `/dashboard` analytics overview
- `/projects/aegis` example project detail
- `/docs` tracking script documentation

## Development

```sh
npm install
npm run dev
```

## Checks

```sh
npm run lint
npm run build
npm run build:server
npm run test:server
```

## Deployment

The device hosts public sites with Caddy. This app is deployed as a static SPA at
`pulse.continental-hub.com`.

```sh
sudo ./deploy/install.sh
```

The installer will:

- install this project's dependencies
- build the Vite app
- build the Node analytics backend
- sync the built files to `/var/www/pulse`
- install and restart the `pulse-collector` systemd service
- append the Caddy site block for `pulse.continental-hub.com` if it is missing
- validate and reload Caddy

The public site expects Caddy to reverse-proxy `/api/*` and `/v1/*` to the local collector on
`127.0.0.1:8787`. Override backend settings with `/etc/pulse/pulse-collector.env`.

## License

This project is licensed under the Apache License 2.0. See [LICENSE](/Users/charliearnerstal/Documents/GitHub/pulse/LICENSE).
