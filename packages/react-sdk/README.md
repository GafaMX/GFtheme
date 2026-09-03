# @gafa/theme-react-sdk

Foundation for the next GFTheme SDK: a modern, embeddable React package that can run beside the legacy SDK while new widgets are migrated view by view.

## What is included

- Vite + React + TypeScript library build.
- `createGafaSdk(...)` runtime API.
- Legacy-compatible bootstrap for current `data-gf-theme` containers.
- Typed config parser for both modern config and current `data-gf-options`.
- Brand theme tokens mapped to scoped CSS variables.
- Initial mobile-first widgets for calendar, catalog, auth, profile, and purchase buttons.
- Mock client for local development and a legacy `window.GafaFitSDK` adapter seam.

## Calendar scope

The first calendar implementation already loads brands, locations, services, staff, and meetings through the `GafaClient` contract. It supports the legacy filter attributes, groups meetings by day, displays availability, and keeps the mobile layout as the default experience.

## Programmatic usage

```ts
import { createGafaSdk } from "@gafa/theme-react-sdk";

const sdk = createGafaSdk({
  apiBaseUrl: "https://example.gafa.fit",
  companyId: 1,
  publicClientId: "public-client",
  theme: {
    preset: "boutique",
    logoUrl: "https://example.com/logo.svg",
    colors: {
      primary: "#111827",
      accent: "#f97316",
    },
  },
});

sdk.mountCalendar("#calendar");
sdk.mountCatalog("#packages", { type: "packages" });
sdk.mountAuth("#auth", { initialView: "login" });
sdk.mountProfile("#profile");
sdk.concierge.mount({ config: partnerConfig });
```

## Concierge

Capability nativa, no una app cliente. El socio activa con config declarativa. Fitspin es solo un fixture de prueba.

```ts
sdk.concierge.mount({
  partnerId: "mi-estudio",
  config,
  apiBaseUrl: "https://api.example.com", // opcional; el proveedor de IA no se expone
});
```

En HTML, igual que calendario y perfil:

```html
<script data-gf-options type="application/json">
  {
    "COMPANY_ID": 80,
    "API_CLIENT": "...",
    "CONCIERGE": { }
  }
</script>
<section data-gafa-v2="concierge" data-gafa-concierge-live="true"></section>
```

`CONCIERGE` es el contrato Zod del socio. `catalog.live` (o `data-gafa-concierge-live`) completa paquetes y sedes desde el cliente BUQ, filtrados por las marcas/locationIds declarados. El checkout y el mapa de asientos siguen siendo del SDK.

## WordPress / CDN (sin Replit)

El build de librería deja React como peer. Para un sitio WP hace falta el IIFE
con React dentro, el mismo patrón que `dist/main.min.js` de v1:

```sh
npm run publish:embed   # → ../../docs/v2-sdk/gafa-sdk.js
```

```html
<script src="https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@v2.0.0-rc.11/docs/v2-sdk/gafa-sdk.js"></script>
<script data-gf-options type="application/json">
  { "GAFA_FIT_URL": "...", "COMPANY_ID": 1, "API_CLIENT": "...", "API_SECRET": "..." }
</script>
<section data-gf-theme="meetings-calendar"></section>
```

No copies `src/` a Replit. Guía: [`docs/v2-lanzamiento.md`](../../docs/v2-lanzamiento.md).

## Legacy-compatible usage

```ts
import { bootstrapLegacyWidgets, createGafaSdk, readLegacyOptionsFromDom } from "@gafa/theme-react-sdk";

const sdk = createGafaSdk(readLegacyOptionsFromDom());
bootstrapLegacyWidgets(sdk);
sdk.enablePurchaseButtons();
```

This maps current containers such as:

```html
<section data-gf-theme="meetings-calendar" filter-bq-location="true"></section>
<section data-gf-theme="combo-list" data-gf-filterbyname="starter"></section>
<div data-gf-theme="login-register"></div>
```

`login-register` is the header control from v1: a **Mi cuenta** button (plus cart when there are items). Clicking it opens the full login/profile popup. The dedicated page `login-register-pages` still mounts the full form inline.

## Imágenes de marca (fotos de coach, perfil, mapa de salón)

La API de gafa.fit devuelve la imagen **original tal cual la subió la marca**. Las cinco
variantes que expone (`picture_web`, `picture_web_list`, etc.) son copias byte a byte del
mismo archivo. Hay fotos de 15 MB que el calendario pintaba en un círculo de 36 px.

El SDK pide miniaturas a las Transformations de Cloudflare de la zona de `apiBaseUrl`
(`https://buq.partners`). Ya está activado en esa zona (2026-08-11), con origen
`buqstorage.blob.core.windows.net`. URLs:

`https://buq.partners/cdn-cgi/image/<params>/<url original>`

Si `/cdn-cgi/image/...` responde `404` o `403`, el SDK apaga las transformaciones por la
sesión y no baja originales de 15 MB: las fotos de coach simplemente no se pintan.
Logo, avatar de cuenta y mapa de salón sí caen al original.

```ts
createGafaSdk({
  apiBaseUrl: "https://buq.partners",
  companyId: 80,
  // Opcional. Pintar originales pesados si no hay miniatura:
  // images: { allowUnoptimizedOriginals: true },
});
```

## Development

```sh
npm run dev
npm run typecheck
npm test
npm run build
npm run build:embed
npm run publish:embed
```

The current API client intentionally returns mock data unless a host injects the legacy `window.GafaFitSDK`. The next implementation step is to replace the mock client with real gafa.fit/gafa.pay HTTP adapters.
