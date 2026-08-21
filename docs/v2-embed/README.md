# Cómo montar el SDK v2 en cualquier web

Receta para **cualquier agente** (Cursor, Replit, WP, HTML estático, Webflow, etc.).
El SDK no se copia ni se transpila en el sitio del socio. Se carga con **un script**.

El artefacto estable es `docs/v2-sdk/gafa-sdk.js` (React y CSS van adentro).

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
La URL pública actual es `@cdn-live` (arriba). Azure cuando exista:
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

**WordPress / Elementor:** una línea en el header o un HTML widget. No se toca
el theme PHP en cada deploy v2: se reemplaza `gafa-sdk.js` en git.

**Replit (app multi-sitio):** no copies a `lib/gafa-react-sdk` y **no pulses
Republish**. El secreto `VITE_GAFA_SDK_V2_URL` ya apunta a `@cdn-live`. Para
un cambio del SDK: publica el JS en la rama `cdn-live`, purge jsDelivr, hard
refresh. Receta: [`docs/v2-lanzamiento.md`](../v2-lanzamiento.md).

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
5. No pulses Republish en Buq-Webs por un cambio del SDK. Publica en cdn-live.
```
