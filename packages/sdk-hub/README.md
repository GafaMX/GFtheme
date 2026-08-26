# SDK Hub

Control plane del SDK V2. Vive en **`https://hub.buq.partners`** (staging: `hub.buq.com.mx`).

No es Laravel. El apex `buq.partners` sigue siendo solo reservas y pagos.

## Local

```sh
cd packages/sdk-hub
npm install
cp .dev.vars.example .dev.vars
npx wrangler d1 migrations apply sdk-hub --local
npm run dev
```

- Admin: http://127.0.0.1:8787 — password `buq-hub-dev`
- Ingest: `POST /v1/events`
- Health: `GET /v1/health`

El SDK apunta aquí con `HUB_URL` / `hubUrl` (no uses `GAFA_FIT_URL`).

## Deploy

Hace falta una D1 real (`wrangler d1 create sdk-hub`) y poner el `database_id` en `wrangler.jsonc`. Secrets:

```sh
npx wrangler secret put ADMIN_PASSWORD --env production
npx wrangler secret put ADMIN_SESSION_SECRET --env production
npx wrangler deploy --env production
```

Luego el hostname `hub.buq.partners` en la zona Cloudflare de `buq.partners` (no un path de Laravel).
