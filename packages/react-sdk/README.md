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
- Opt-in `buqNextClient` (F0', rama `v2/buq-next`) that reads local Buq Next fixtures. Default remains gafa.fit.

## Calendar scope

The first calendar implementation already loads brands, locations, services, staff, and meetings through the `GafaClient` contract. It supports the legacy filter attributes, groups meetings by day, displays availability, and keeps the mobile layout as the default experience.

Preselect a service with `?service=123` (id) or the v1 query `?filter_service=Pilates+Reformer` (name). The HTML default is `filter-bq-service-default` with the same id-or-name value. Location already works the same way via `?location=200`.

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
    logoUrlDark: "https://example.com/logo-dark.svg",
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
npm run publish:embed   # → ../../docs/v2-sdk/gafa-sdk.js (loader) + bundle stampado
```

```html
<script src="https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.js"></script>
<script data-gf-options type="application/json">
  { "GAFA_FIT_URL": "...", "COMPANY_ID": 1, "API_CLIENT": "...", "API_SECRET": "..." }
</script>
<section data-gf-theme="meetings-calendar"></section>
```

No copies `src/` a Buq-Webs. Guía: [`docs/v2-lanzamiento.md`](../../docs/v2-lanzamiento.md).

El uso (heartbeats, login, reserva, checkout) se manda al **SDK Hub** (`https://hub.buq.partners`), no a `GAFA_FIT_URL`. Local: `HUB_URL` / `?hub-url=http://127.0.0.1:8787`. Docs: [`docs/v2-hub`](../../docs/v2-hub/README.md).

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
```

`npm run publish:embed` publica el IIFE a `docs/v2-sdk/` y **no se corre** en el trabajo de Buq Next. Un merge a `v2/main` llega a `cdn-live` y a los sitios de clientes.

Local:

| URL | Cliente | Para qué |
| --- | --- | --- |
| `/` o `/playground.html` | mock (`useMockClient`) | Diseño sin API |
| `/preview.html` | fixtures de cuenta | Overlay de perfil / checkout |
| `/live.html` | `httpGafaClient` → gafa.fit | Compañía de prueba real |
| **`/next.html`** | **`buqNextClient` (fixtures Buq Next)** | F0' — calendario y catálogo de Next Studio |

```sh
cd packages/react-sdk
npm install
npm run dev
# abrir http://localhost:5173/next.html
# o http://localhost:5173/playground.html?backend=buq-next
```

`?backend=buq-next`, `data-backend="buq-next"` o `{ "BACKEND": "buq-next" }` en `data-gf-options` son el único interruptor. `BUQ_ENV: "next-dev"` solo apunta la URL a `https://dev-new.buq.partners`; **no** cambia el cliente. El Hub no puede mandar `BACKEND`.

### `buqNextClient` — cubierto vs pendiente (F0')

Lee fixtures con la forma del contrato público de Buq Next (sede `next-studio-e0f9`): calendario por sede, catálogo (paquetes / membresías / productos), coaches y salones. Mapea `CartLine` ↔ `lineaSolicitudVenta` (`combo→paquete`, `membership→membresia`, `product→producto`; id numérico ↔ uuid).

| Método `GafaClient` | F0' |
| --- | --- |
| `listBrands` / `listLocations` / `listServices` / `listStaff` | fixtures |
| `listMeetings` / `getMeeting` | fixtures (por sede, filtros servicio/coach/salón) |
| `listCombos` / `listMemberships` / `listProducts` | fixtures |
| `login` / `register` / password / `getProfile` / `updateProfile` / `listRegistrationFields` | error tipado |
| `listUserCredits` / `Memberships` / `Reservations` / `Purchases` / `getUserActivityTotals` | error tipado |
| `getReservationContext` / `createReservation` / `cancelReservation` / `cancelWaitlist` | error tipado |
| `getCheckoutConfig` / descuentos / gift / `reservatePurchase` / `previewPurchase` / Recurrente | error tipado |
| Store credit / puntos | no hay método nativo; `getProfile` (donde vive el saldo) tira el mismo error |

El error es `BuqNextUnavailableError` (`code: BUQ_NEXT_UNAVAILABLE`, mensaje `no disponible en Buq Next aún`). Los widgets lo muestran; no tumba calendario ni catálogo. `logout` es no-op.

This package still defaults to the real gafa.fit HTTP client (`createHttpGafaClient`) unless a host injects a mock or opts into `buq-next`.
