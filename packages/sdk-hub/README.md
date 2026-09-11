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
- Remote config: `GET /v1/config?company_id=` (público, sin secretos) · `PUT /v1/admin/config`
- Health: `GET /v1/health`

La pantalla **Config** del admin es un formulario, no un editor de JSON. El catálogo de opciones vive en [`public/configModel.js`](public/configModel.js): cada entrada declara etiqueta, tooltip y control, y de ahí salen la UI, el resumen y el guardado. Contrato: [`docs/v2-hub/remote-config.md`](../../docs/v2-hub/remote-config.md).

El SDK apunta aquí con `HUB_URL` / `hubUrl` (no uses `GAFA_FIT_URL`).

## Deploy

Cuenta Cloudflare **BUQ** (la que ya tiene `hub.buq.partners`). **No** pongas el password de admin en `wrangler.jsonc` de production: van por `wrangler secret`.

```sh
cd packages/sdk-hub
npm run deploy:production
```

### Si Cloudflare caduca (`wrangler whoami` → not authenticated)

Mismo flujo que el 2026-09-09. Desde un Cloud Agent **no** sirve `wrangler login` con callback a localhost: hay que usar **device**.

```sh
cd packages/sdk-hub
npx wrangler login --device --browser=false
```

Wrangler imprime una URL y un código, por ejemplo:

1. Abre https://dash.cloudflare.com/oauth2/device/verify
2. Pega el código de 8 caracteres
3. Confirma con `i@gafa.mx` / cuenta BUQ

Cuando el log diga `Successfully logged in.`, corre `npm run deploy:production`. La sesión queda en `~/.config/.wrangler` de esa máquina (un snapshot del environment la puede heredar el siguiente agente).

Alternativa: un `CLOUDFLARE_API_TOKEN` con *Edit Cloudflare Workers* + *D1 Edit*, en los secrets del environment. El script acepta token **o** sesión OAuth.

Eso crea D1 `sdk-hub` si no existe, aplica migraciones, sube secrets solo si faltan, y hace `wrangler deploy --env production`.

Live:

- Admin / ingest: `https://hub.buq.partners`
- Fallback: `https://sdk-hub.i-f47.workers.dev`

Kill switch en Fitspin (cuando el tracker esté publicado): `"ANALYTICS": false` en `[data-gf-options]`. El Hub no toca Laravel.
