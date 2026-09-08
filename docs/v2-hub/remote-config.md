# Remote config del SDK

Plan vivo. Si el código choca con este contrato, **se actualiza este archivo** — no se cambia el merge en silencio.

Última revisión: 2026-09-08. En `v2/main` este doc **no existía**; se escribió aquí a partir del acuerdo (Zod del SDK = fuente de verdad, Hub = partial).

## Acuerdo

| Regla | Detalle |
| --- | --- |
| Fuente de verdad | Zod del SDK (`packages/react-sdk/src/sdk/config.ts` + Concierge). |
| Hub | Guarda un **partial** (overrides). Nunca el objeto completo resuelto. |
| Merge | defaults SDK → Hub → `[data-gf-options]` → query (`?buq-env`, `?hub-url`). |
| HTML mínimo de prod | `COMPANY_ID` + `API_CLIENT` + `API_SECRET`. |
| Secret | `API_SECRET` / `clientSecret` / `CAPTCHA_SECRET_KEY` **nunca** van al Hub (ni GET ni PUT). |
| Concierge en HTML | `CONCIERGE: true \| {} \| partial`. Defaults: `createLiveConciergeConfig()`. |
| Nodo HTML | `data-gf-theme="concierge"` (o `data-gafa-v2`) sigue siendo **opt-in por página**. El Hub no pinta la barra en todo el sitio. |
| Admin | Primero en Hub (`hub.buq.partners`). Buq-Webs más tarde, **mismo PUT**. |

Catálogo de claves: [`docs/v2-options.md`](../v2-options.md). Guía de instalación: [`docs/v2-agente.md`](../v2-agente.md).

## Qué había en el código (choques)

Antes de este trabajo, en `v2/main`:

1. **Este archivo no existía.** El merge y el partial no estaban documentados.
2. `CONCIERGE` exigía el objeto **completo** (`ConciergePartnerConfig.parse`). `true` / `{}` tiraban.
3. `createLiveConciergeConfig()` ya existía (`packages/react-sdk/src/sdk/concierge/liveConfig.ts`) y **no estaba cableado** al bootstrap.
4. El embed leía solo DOM + query. **No había capa Hub.**
5. `legacyOptionsToConfig()` **tiraba `CONCIERGE`**: el widget lo volvía a leer del script HTML. Un override del Hub no habría llegado al mount.
6. El Hub no tenía tabla ni `GET/PUT /v1/config`.
7. `docs/v2-hub/widgets.md` aún decía que Concierge era preview y no montaba (desactualizado vs §11 de `v2-agente.md`).
8. `docs/v2-hub/install.md` citaba `@sdk-live` — la URL pública es `@cdn-live`.

Esos choques se resuelven en este plan; no se cambia el contrato de merge.

## Merge (contrato)

```
defaults del SDK          captcha compartido, env URLs, analytics on
        ↓
partial del Hub           GET /v1/config?company_id= — sin secretos
        ↓
[data-gf-options]         HTML de la página (puede traer API_SECRET)
        ↓
query                     ?buq-env=  ?hub-url=   (solo esas dos)
```

Después del merge, Zod parsea. Si Hub está caído o tarda de más, se sigue con la página (fail-open).

`COMPANY_ID` tiene que estar en el HTML para saber qué fila pedir. El secret se queda en el HTML.

## CONCIERGE — fase 1

| Valor | Efecto |
| --- | --- |
| ausente / `false` | No hay config. El nodo, si existe, tira: `Concierge config was not found`. |
| `true` o `{}` | `createLiveConciergeConfig()` con `COMPANY_ID` + `THEME` (si hay). Catálogo `live` + `products: []`. |
| partial | Defaults live + deep-merge del partial (`contact.whatsapp`, `copy`, `id`, …). |
| objeto completo | Sigue igual: se parsea tal cual (compat). |

Identidad si no mandas `id` / `displayName`: `id = company-<COMPANY_ID>`, `displayName = "tu estudio"`. Al hidratar marcas de BUQ, si el id sigue siendo `company-*` (o el nombre es el placeholder), se pinta el nombre de la primera marca.

**El Hub no enciende la barra.** Hace falta el nodo en esa página. `CONCIERGE: true` en Hub solo deja la config lista para las páginas que ya lo pidieron.

WhatsApp: sin número, no hay botón. Un string raro sigue tirando.

## Fases

| Fase | Qué | Estado |
| --- | --- | --- |
| 1 | `CONCIERGE: true \| {} \| partial` + cablear `createLiveConciergeConfig()` | hecho |
| 0 | Catálogo [`docs/v2-options.md`](../v2-options.md) | hecho |
| 2 | Schema Hub-safe (allowlist + strip de secretos). Zod del SDK manda. | hecho |
| 3 | D1 `company_configs` + `GET /v1/config` + `PUT /v1/admin/config` | hecho |
| 4 | Embed: fetch Hub → merge → boot (timeout corto, fail-open) | hecho |
| 5 | Admin en Hub (form del partial, mismo PUT) | hecho |
| luego | Buq-Webs (mismo PUT). **No** Republish. | fuera de este repo |

No se salta a UI del Hub sin el contrato (fases 0–4).

## HTTP

Público (CORS de embed, como eventos):

```
GET /v1/config?company_id=190
→ { ok, company_id, config, updated_at }
```

`config` es el partial ya sin secretos. Sin fila: `config: {}`.

Admin (sesión del Hub):

```
GET /v1/admin/config?company_id=190
PUT /v1/admin/config
{ "company_id": 190, "config": { "THEME": {…}, "CONCIERGE": true } }
```

El PUT vuelve a strippear secretos. Si mandas `API_SECRET`, se descarta.

## Qué no es este plan

- No cambia la URL pública del embed (`@cdn-live/.../gafa-sdk.js`).
- No toca Buq-Webs ni pide Republish.
- No mueve OAuth a un backend: el secret sigue en el HTML (contrato de gafa.fit).
- No enciende Concierge en todas las páginas desde el Hub.
