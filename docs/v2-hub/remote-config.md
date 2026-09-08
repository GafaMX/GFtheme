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
| Nodo HTML | Widgets con lugar en el layout (`login-register`, calendario, catálogo) siguen pidiendo su `data-gf-theme`. El Concierge **no**: flota, así que encenderlo en el Hub lo pinta en todo el sitio. |
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
9. `docs/v2-agente.md` §5 documenta `THEME.logoUrlDark`, `logoMaxWidth`, `logoMaxHeight`, `colors.primary` y `colors.inputBackground|inputText|inputBorder`. **El SDK no los lee**: no existen en `legacyThemeSchema` ni en `theme/palette.ts`. El formulario del Hub no los ofrece; queda anotado en [`v2-options.md`](../v2-options.md#theme).

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
| ausente / `false` | No hay config ni barra. El nodo puesto a mano, si existe, tira: `Concierge config was not found`. |
| `true` o `{}` | `createLiveConciergeConfig()` con `COMPANY_ID` + `THEME` (si hay). Catálogo `live` + `products: []`. |
| partial | Defaults live + deep-merge del partial (`contact.whatsapp`, `copy`, `id`, …). |
| objeto completo | Sigue igual: se parsea tal cual (compat). |

Identidad si no mandas `id` / `displayName`: `id = company-<COMPANY_ID>`, `displayName = "tu estudio"`. Al hidratar marcas de BUQ, si el id sigue siendo `company-*` (o el nombre es el placeholder), se pinta el nombre de la primera marca.

**El Hub sí enciende la barra.** La barra flota sobre la página, no ocupa un lugar en el layout: si la config resuelta la trae encendida y la página no puso su nodo, el bootstrap cuelga uno del `body`. Instalar el script y prenderla en el Hub alcanza — no hay que tocar el HTML del sitio.

Excepciones, por si alguna página no la quiere: `<body data-gf-concierge="off">` la excluye. Un nodo puesto a mano sigue mandando dónde va y evita el automático (no salen dos barras).

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
| 5.1 | Form 100% humano: pestañas, controles, tooltips, cero JSON | hecho |
| 5.2 | Concierge sin HTML: encendido en el Hub, la barra se monta sola | hecho |
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

## Admin (pantalla Config)

Nadie escribe JSON. El formulario se genera desde `packages/sdk-hub/public/configModel.js`: cada opción declara etiqueta, explicación (tooltip) y tipo de control. Cuatro pestañas: **Marca**, **Concierge**, **Tienda**, **Conexión**.

- Cada opción arranca en “sin cambio”: vacío = no se guarda esa clave, manda el default del SDK o el HTML.
- Sí/no son tres estados (`Sin cambio` · `Sí` · `No`) para poder distinguir “apagado” de “no configurado”.
- Al guardar se parte del partial guardado, así que **lo que el formulario no pinta se conserva** (por ejemplo `CONCIERGE.experience.groups` puesto a mano). La pantalla lo avisa.
- Validación en español antes del PUT: hex de 6, ligas con `https://`, WhatsApp solo dígitos.
- Concierge encendido sin ajustes se guarda como `CONCIERGE: true`; con un ajuste, como partial.

Agregar una opción nueva = agregar un objeto en `configModel.js` (y su clave en la allowlist de `src/remoteConfig.ts` si es raíz nueva). La UI, el resumen y el guardado salen solos. `test/configModel.test.ts` verifica que toda clave del catálogo pase la allowlist del Worker y que ningún campo se quede sin explicación.

## Qué no es este plan

- No cambia la URL pública del embed (`@cdn-live/.../gafa-sdk.js`).
- No toca Buq-Webs ni pide Republish.
- No mueve OAuth a un backend: el secret sigue en el HTML (contrato de gafa.fit).
- No monta desde el Hub los widgets que ocupan un lugar en la página (login, calendario, catálogo): esos siguen necesitando su nodo, porque el Hub no sabe dónde van.
