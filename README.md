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
- sync the built files to `/var/www/pulse`
- append the Caddy site block for `pulse.continental-hub.com` if it is missing
- validate and reload Caddy
