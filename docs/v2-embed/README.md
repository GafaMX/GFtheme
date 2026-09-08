# Cómo montar el SDK v2 en cualquier web

**Guía completa para agentes (Buq-Webs + WordPress):**
[`docs/v2-agente.md`](../v2-agente.md). Options, THEME, filtros, botones,
Concierge y cross-sell.

Receta corta: el SDK no se copia ni se transpila en el sitio del socio. Se
carga con **un script**.

La URL pública es siempre `docs/v2-sdk/gafa-sdk.js` (loader). El IIFE con React
y CSS va en `gafa-sdk.bundle.<stamp>.js`. **No cambies el `src` de los sitios.**

```bash
cd packages/react-sdk && npm run publish:embed
```

Publicar el JS: `docs/v2-lanzamiento.md`. Este archivo es **cómo se pega en una página**.

## Markup (igual en todos los hosts)

1. **Deja** `[data-gf-options]` / `[data-gafa-options]` y los contenedores
   (`data-gf-theme` o `data-gafa-v2`).
2. **Un** script de v2. No copies `packages/react-sdk/src`.
3. **No** cargues el theme v1 (`main.min.js`) y el v2 a la vez, salvo que los
   nodos v2 usen `data-gafa-v2` (el header viejo puede seguir en v1).

```html
<script src="https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.js"></script>
<script data-gf-options type="application/json">
  { "GAFA_FIT_URL": "https://buq.partners", "COMPANY_ID": 1, "API_CLIENT": "...", "API_SECRET": "..." }
</script>
<section data-gf-theme="meetings-calendar" filter-bq-location></section>
```

`data-gafa-v2` es el mismo shortcode que `data-gf-theme`, para no pelear con el v1.

jsDelivr con `@v2/main` **404** (el `/` de la rama se parte). `@v2` lo trata
como versión `2` y la **congela**. Tags `v2.0.0-rc.N` también son inmutables.
**No** uses `cdn-live-2` ni pines un SHA en producción: el loader en `@cdn-live`
trae solo el bundle nuevo. Azure cuando exista:
`https://buq-sdk.azurewebsites.net/v2/gafa-sdk.js`.

## Dos URLs

| URL | Qué es | Cuándo |
| --- | --- | --- |
| `…/gafa-sdk.js` (IIFE, **sin** `type="module"`) | Snapshot publicado | WP, preview estable, cualquier host en serio |
| `https://<vite>/src/sdk/embed.ts` (`type="module"`) | Vite de este repo, en vivo | Iterar: recargas la página, no publicas |

Vite en GFtheme: `cd packages/react-sdk && npm run dev` (hace falta un túnel
público si el sitio no corre en la misma máquina). Sin túnel, `localhost` no
lo alcanza WordPress ni Replit.

## Por tipo de host

**WordPress / Elementor:** una línea en el header o un HTML widget, **una vez**.
No se toca el `src` ni el theme PHP en cada deploy v2: se reemplaza el bundle
en git y el loader lo recoge. El CSS de Hello/Elementor lo bloquea el propio
SDK (muralla en `theme.css`). No hace falta CSS extra por marca.

Las “Opciones de la membresía” van **ocultas** (guardar tarjeta + renovar
siguen ON). Para mostrarlas, en `data-gf-options`:
`{ "SHOW_MEMBERSHIP_OPTIONS": true }` o el atributo
`show-membership-options="true"` en el shortcode. Por CSS:
`.gafa-checkout-membership[hidden] { display: grid !important; }`.

**Buq-Webs (Replit, todas las marcas en `web.buq.mx/<marca>`):** no copies a
`lib/gafa-react-sdk` y **no pulses Republish**. Un secreto
`VITE_GAFA_SDK_V2_URL` ya apunta a `@cdn-live` para **toda** la app. Fitspin
es el piloto; el publish llega a todas las páginas v2. Receta:
[`docs/v2-lanzamiento.md`](../v2-lanzamiento.md).

Colores de marca: `THEME.colors` en `data-gf-options` (fondos, superficies,
inputs). Contrato: [`docs/v2-theme-colors.md`](../v2-theme-colors.md). No CSS
de overlays ni `MutationObserver`.

**HTML / Webflow / otro:** el mismo `<script src>` + `data-gf-options` + contenedores.

## Entornos de API

| `BUQ_ENV` | API | Para qué |
| --- | --- | --- |
| `production` (default) | `https://buq.partners/` | Lanzamiento |
| `staging` | `https://buq.com.mx/` | Stripe nuevo + Laravel |
| `development` | `https://buq.technology/` | Dev |

También vale `GAFA_FIT_URL` o `?buq-env=staging`. `GAFAPAY_FRONT_URL` pisa el script de Stripe/PayPal.

## Prompt corto para otro agente

```
El SDK v2 de Buq se monta con UN script remoto. No copies packages/react-sdk.

1. Deja data-gf-options y los contenedores (data-gf-theme o data-gafa-v2).
2. Quita main.min.js del theme v1 en esas páginas (o usa data-gafa-v2 si el header sigue en v1).
3. Agrega:
   <script src="https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.js"></script>
   No uses @v2/main (404), @v2 (jsDelivr lo congela), ni tags rc.* (inmutables).
4. No cargues v1 y v2 sobre los mismos nodos.
5. No pulses Republish en Buq-Webs (cae todas las marcas). Publica en cdn-live.
```
