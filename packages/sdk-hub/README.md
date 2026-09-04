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

Hace falta un `CLOUDFLARE_API_TOKEN` con Workers + D1 (y zona `buq.partners` en la misma cuenta para el custom domain). **No** pongas el password de admin en `wrangler.jsonc` de production: van por `wrangler secret`.

```sh
cd packages/sdk-hub
CLOUDFLARE_API_TOKEN=… npm run deploy:production
```

Eso crea D1 `sdk-hub` si no existe, aplica migraciones, sube secrets y hace `wrangler deploy --env production`.

Live:

- Admin / ingest: `https://hub.buq.partners`
- Fallback: `https://sdk-hub.i-f47.workers.dev`

Kill switch en Fitspin (cuando el tracker esté publicado): `"ANALYTICS": false` en `[data-gf-options]`. El Hub no toca Laravel.
