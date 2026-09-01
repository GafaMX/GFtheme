# SDK Hub

Control plane del SDK V2. **No es Laravel.**

| Host | Qué es |
| --- | --- |
| `buq.partners` | API de reservas, pagos, catálogo (gafa.fit). No se toca. |
| **`hub.buq.partners`** | Hub live: admin, ingest, catálogo. |
| `hub.buq.com.mx` | Staging del Hub. |

Código: [`packages/sdk-hub`](../../packages/sdk-hub). El SDK emite a `HUB_URL` (default del entorno), **nunca** a `GAFA_FIT_URL`.

## Qué controlas desde el Hub

- Dónde está instalado el V2 (host, compañía, marca, salón, versión, widgets)
- Cómo se usa (calendario, login, reserva, compra)
- Catálogo de widgets y snippets
- Más adelante: remote config
- **Lealtad (puntos y niveles en D1).** Canje a crédito de tienda: después.
- El socio **no** ve puntos todavía (`SHOW_LOYALTY_POINTS` apagado). El admin del Hub sí.

## Production

Token de Cloudflare (Workers + D1) en `CLOUDFLARE_API_TOKEN`:

```sh
cd packages/sdk-hub
CLOUDFLARE_API_TOKEN=… npm run deploy:production
```

No toca Laravel ni WordPress. El JS de Fitspin se publica en un segundo paso (tracker, sin card de puntos).

## Local

```sh
cd packages/sdk-hub
npm install
cp .dev.vars.example .dev.vars
npx wrangler d1 migrations apply sdk-hub --local
npm run dev
```

Admin: http://127.0.0.1:8787 — password `buq-hub-dev`.

En el sitio / demo del SDK:

```json
{
  "GAFA_FIT_URL": "https://buq.partners",
  "COMPANY_ID": 80,
  "HUB_URL": "http://127.0.0.1:8787"
}
```

O `?hub-url=http://127.0.0.1:8787`. `ANALYTICS: false` apaga el tracker.

## Escala

- **Eventos crudos** en D1 (`events`). El admin pagina de 25 en 25; nunca se baja la tabla entera.
- **Totales diarios** en `daily_rollups`: funnel y capacidad leen esto, no la bitácora.
- **Directorio** (`studios`, `people`): nombres de estudio y alias de cuenta. El admin no muestra `company_id` / `user_id`.
- **Retención:** un cron diario borra eventos crudos de más de 90 días. Los rollups se quedan.
- D1 = 10 GB. Un evento ≈ 400 bytes → 1 millón ≈ 400 MB. Hoy estamos en cientos, no en millones.
- Si todos los socios disparan a la vez: acortar retención a 30 días o dejar de persistir cada heartbeat. El admin no es el cuello.

## Docs

- [Instalación del embed](install.md) — el contrato de un script no cambia
- [Catálogo de widgets](widgets.md)
- [Contrato de eventos](events.md)
- [Lealtad](loyalty.md)
- [Cómo se publica el JS](../v2-lanzamiento.md)
