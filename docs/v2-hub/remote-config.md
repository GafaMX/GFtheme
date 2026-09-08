# Remote config + admin SDK (plan)

Plan acordado con Gabriel (2026-09-08). **Todo se construye en este repo**
(SDK + Hub). Buq-Webs (Replit) **después**, mismo contrato, sin Republish.

Este archivo es el handoff. Si llegas en un chat nuevo: léelo entero, luego
`docs/v2-agente.md` y `CLAUDE.md`. No improvises otro diseño.

Estado: **plan, no implementado.** Arrancar por la fase 1 cuando lo pidan.

---

## Mensaje para un chat nuevo

Copia esto tal cual:

```
Continúa el plan de remote config del SDK. Todo en este repo (GFtheme): Hub + embed. No toques Buq-Webs / no Republish.

Lee primero:
- docs/v2-hub/remote-config.md  ← el plan (fuente de esta tarea)
- docs/v2-agente.md
- CLAUDE.md

Usuario: Gabriel. Español informal. No menciones PRs salvo que yo lo pida.
Rama durable: v2/main. Embed live: cdn-live.
URL pública que NUNCA cambia:
https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.js
Publish: packages/react-sdk → npm test && npm run typecheck && npm run publish:embed
→ commit docs/v2-sdk/ → git push origin HEAD y git push origin HEAD:refs/heads/cdn-live (sin --force).
No publiques v2/main crudo a cdn-live.

Acuerdo:
- Fuente de verdad = Zod del SDK. Hub guarda un partial (overrides).
- Merge: defaults SDK → Hub → [data-gf-options] → query (?buq-env, ?hub-url).
- HTML mínimo de prod: COMPANY_ID + API_CLIENT + API_SECRET. El secret NUNCA va al Hub.
- CONCIERGE: true | {} | partial. Defaults vía createLiveConciergeConfig() (ya existe, no está cableado).
- El nodo HTML data-gf-theme="concierge" sigue siendo opt-in POR PÁGINA. Hub no enciende la barra en todo el sitio.
- Admin primero en Hub (hub.buq.partners). Buq-Webs más tarde, mismo PUT.

Orden: fase 1 (Concierge true/{}) → 0 en paralelo (catálogo docs/v2-options.md) → 2/3/4 (schema + D1 + fetch) → 5 (admin Hub). No saltes a Hub UI sin el contrato.

Empieza por la fase 1 y el catálogo. Si algo del plan choca con código actual, actualiza remote-config.md; no cambies el contrato en silencio.
```

---

## Contexto (qué ya está live)

- Concierge nativo en el embed. Opt-in: nodo HTML **y** `CONCIERGE` en options.
  Nodo vacío solo `console.warn`. WhatsApp opcional. `products: []` + `live: true`
  = catálogo de esa `COMPANY_ID`. Guía: `docs/v2-agente.md` §11.
- `THEME.headerControls` oficial para `Entrar` / `Mi cuenta`.
- Captcha: keys vacías caen al par compartido Buq (`stringWithBlankDefault`).
- Toggles ☀/☾ (header + barra Concierge) cambian **toda** la página.
  DemoSite usa `data-demo-scheme` (no `data-scheme`). Dos `ThemeProvider`
  (DemoSite + root Concierge) comparten `storageScope` `${companyId}:${apiClient}`
  y el evento `gafa-sdk:color-scheme`.
- Hub (`packages/sdk-hub`): Worker + D1 + admin (sitios, actividad, lealtad,
  catálogo de widgets). El embed solo le habla para heartbeats y puntos.
  Remote config en `docs/v2-hub/README.md` sigue diciendo “más adelante”.
- `docs/v2-hub/widgets.md` está **viejo**: dice que Concierge “aún no monta UI”.

### Piezas internas a reutilizar

| Pieza | Path |
| --- | --- |
| Options Zod (HTML) | `packages/react-sdk/src/sdk/config.ts` |
| Concierge Zod (blob grande, casi todo required) | `packages/react-sdk/src/sdk/concierge/contracts.ts` |
| Defaults listos, **no cableados** a options | `packages/react-sdk/src/sdk/concierge/liveConfig.ts` → `createLiveConciergeConfig()` |
| Lectura DOM (exige objeto completo) | `packages/react-sdk/src/sdk/concierge/domConfig.ts` |
| Registry / mount | `packages/react-sdk/src/sdk/widgets/registry.ts` |
| Heartbeats | `packages/react-sdk/src/sdk/analytics/tracker.ts` → `POST {hubUrl}/v1/events` |
| Admin Hub (vanilla) | `packages/sdk-hub/public/app.js` — nav: Sitios, Actividad, Bitácora, Lealtad, Widgets |
| Directorio estudios | D1 `installations` + `studios` |

---

## Contrato (no negociar)

**Fuente de verdad:** Zod del SDK (`sdkConfigSchema` + Concierge). El Hub **no**
inventa campos. Guarda un **partial** (solo overrides). El SDK resuelve.

**Merge, de menos a más peso:**

1. Defaults del SDK (`createLiveConciergeConfig`, paleta, captcha, `ANALYTICS` on).
2. Config remota del Hub (por `COMPANY_ID`).
3. `[data-gf-options]` de la página (emergencia, demo, WP suelto).
4. Query (`?buq-env`, `?hub-url`) para local.

Si el Hub no responde: HTML + defaults. El calendario **no** se bloquea.

**HTML de producción (mínimo):**

```json
{
  "COMPANY_ID": 171,
  "API_CLIENT": "…",
  "API_SECRET": "…"
}
```

`API_SECRET` se queda en el HTML. gafa.fit lo exige en el browser.
**Nunca** se guarda en el Hub.

`CONCIERGE: true` o `{}` = encender con defaults. Un partial = solo lo que el
socio quiere cambiar (WhatsApp, saludo, accent).

**El nodo HTML sigue mandando.** `concierge.enabled: true` en Hub **no** pinta
barra en todo el sitio. Sin `<section data-gf-theme="concierge">` en esa URL,
no hay Concierge. El nodo **nunca** va en header/layout global.

---

## Compañía vs página

**Compañía (Hub + admin):** `THEME` (colores, logo, lock, `headerControls`),
Concierge (on/off, WhatsApp, copy, capabilities), `SHOW_MEMBERSHIP_OPTIONS`,
`ANALYTICS`, `IMAGES`, defaults de calendario (vista semana, filtro de sede)
si el nodo no trae atributos.

**Página (HTML, no Hub):** qué widgets hay, filtros de *este* calendario,
`data-gf-buy` + id de paquete, el nodo Concierge. Eso es contenido.

---

## Fases

### 0 — Catálogo maestro

Un doc `docs/v2-options.md` y un objeto en código (`optionsCatalog`) con cada
knob: clave, default, override, scope (compañía / página / secreto), origen.
Alimenta el admin. Deja de estar partido en §4 / §5 / §7 / §11 de
`v2-agente.md`. Actualizar `docs/v2-hub/widgets.md` (Concierge ya no es hueco).

### 1 — Concierge `true` / `{}` (embed → `cdn-live`)

`readConciergeConfigFromDom` acepta `true`, `{}` o partial. Resuelve con
`createLiveConciergeConfig` + `COMPANY_ID` + `THEME`.

`displayName` / `id`: override, o nombre del directorio Hub, o
`Compañía ${id}`. WhatsApp opcional, mismos dígitos (hoy: tira si el string
es raro; vacío no).

Tests + `docs/v2-agente.md` §11. Esto ya deja de pedir el JSON de 80 líneas.

### 2 — Schema remoto compartido

`sdkRemoteConfigSchema`: el blob que guarda el Hub (partial `THEME`, partial
`CONCIERGE`, flags). El SDK lo parsea al fetchear. El Hub lo valida al guardar.
Un contrato, dos lados. No duplicar campos a mano.

### 3 — Hub: tabla + API

D1 `company_sdk_config` (`company_id`, `config_json`, `updated_at`, `updated_by`).

- `GET /v1/config/:companyId` — público, cacheable. Sin secretos. CORS.
- `GET/PUT /v1/admin/config/:companyId` — admin, Zod, 401 sin sesión.

Deploy del Worker. El embed `@cdn-live` no cambia en este paso.

### 4 — El embed pide al Hub

Tras leer el HTML, `GET {hubUrl}/v1/config/{companyId}` (timeout corto, ~800 ms).
Merge y monta. Theme/Concierge esperan esa ronda; el calendario puede arrancar
en paralelo. Si Hub falla: HTML + defaults.

`ANALYTICS: false` **no** apaga este GET (es config, no tracker).

### 5 — Admin en Hub

Nav **SDK** / **Config**, por estudio (directorio que ya existe). Formulario,
no JSON crudo:

- Theme: scheme, lock, brand/fondo/texto, logos, `headerControls` básico.
- Concierge: enable, WhatsApp, saludo, capabilities.
- Flags: analytics, opciones de membresía.
- Avanzado: JSON del partial, validado.

Guardar = `PUT` admin. El embed lo ve en el siguiente load (cache corta).

### 6 — Buq-Webs (después, **otro repo**)

La misma forma, `PUT` al mismo contrato. Aquí no se toca Replit. No Republish.

---

## Fuera de v1

- Mover `API_SECRET` al Hub.
- Encender Concierge en todo el sitio desde el Hub.
- Configurar cada `data-gf-buy` o cada filtro de una landing.
- Cross-sell.
- Que el socio vea este admin (sigue interno en `hub.buq.partners`).

---

## Cómo se prueba (cuando se implemente)

1. `CONCIERGE: true` + nodo + `THEME` → barra y chat, catálogo live, sin WhatsApp.
2. Partial `{ "contact": { "whatsapp": "521…" } }` → mismo + icono.
3. Blob viejo completo → sigue igual.
4. Hub down → calendario y checkout vivos; Concierge con HTML/defaults.
5. Hub `enabled: true` sin nodo → sin barra.
6. Admin guarda color/WA → hard refresh en demo con `HUB_URL` local.

---

## Orden de ataque

**1 → 0 en paralelo → 2/3/4 → 5.**

La fase 1 se publica sola a `cdn-live` y ya deja de doler el JSON. El admin
llega cuando el contrato remoto está firme.
