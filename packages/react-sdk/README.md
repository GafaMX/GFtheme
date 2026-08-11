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
```

## Legacy-compatible usage

```ts
import { bootstrapLegacyWidgets, createGafaSdk, readLegacyOptionsFromDom } from "@gafa/theme-react-sdk";

const sdk = createGafaSdk(readLegacyOptionsFromDom());
bootstrapLegacyWidgets(sdk);
```

This maps current containers such as:

```html
<section data-gf-theme="meetings-calendar" filter-bq-location="true"></section>
<section data-gf-theme="combo-list" data-gf-filterbyname="starter"></section>
```

## Imágenes de marca (fotos de coach, perfil, mapa de salón)

La API de gafa.fit devuelve la imagen **original tal cual la subió la marca**. Las cinco
variantes que expone (`picture_web`, `picture_web_list`, `picture_web_over`, `picture_movil`,
`picture_movil_list`) son copias byte a byte del mismo archivo: se comparó el `Content-MD5` de
los 103 coaches con foto de Fitspin y coincide en las cinco. Hay fotos de 15 MB (4000x6000 px)
que el calendario pinta en un círculo de 36 px, así que una semana de calendario llegaba a
descargar ~110 MB solo en avatares.

El SDK pide esas imágenes en miniatura a través de las
[Transformations de Cloudflare](https://developers.cloudflare.com/images/transform-images/transform-via-url/),
que resuelven el problema sin tocar gafa.fit. La misma foto de 15 MB sale en ~1 KB a 72 px.

Por default la zona de transformaciones es el origen de `apiBaseUrl` (`https://buq.partners`),
que ya es una zona de Cloudflare. No hay que configurar nada en el SDK:

```ts
createGafaSdk({
  apiBaseUrl: "https://buq.partners",
  companyId: 80,
  // Opcional. Solo si las miniaturas se sirven desde otra zona:
  images: { transformBaseUrl: "https://img.buq.partners" },
});
```

### Setup en Cloudflare (una sola vez, por zona)

1. Dashboard de Cloudflare → **Images > Transformations** → seleccionar la zona (`buq.partners`)
   y activar las transformaciones.
2. En **Sources**, agregar `*.blob.core.windows.net` como origen permitido: las imágenes viven
   en el storage de Azure, no en la zona, y Cloudflare rechaza los orígenes que no estén en la
   lista.
3. Listo. Las URLs quedan `https://buq.partners/cdn-cgi/image/<params>/<url original>`.

Costo: las primeras 5,000 transformaciones **únicas** al mes son gratis y después son $0.50 por
cada 1,000. Una transformación única es la combinación de imagen + parámetros, y se cuenta una
vez al mes sin importar cuántas visitas la pidan; el SDK pide un solo tamaño por lugar de uso
(densidad fija de 2x) justamente para no multiplicar variantes.

### Mientras el setup no esté hecho

El SDK no asume que la zona ya está lista: si la primera miniatura falla, apaga las
transformaciones para toda la sesión y cada imagen cae a su respaldo.

| Imagen | Sin transformaciones |
| --- | --- |
| Foto de coach en el calendario (decorativa) | no se pinta — no vale bajar 15 MB para 36 px |
| Logo / foto de perfil, imágenes del mapa de salón | se usa el original |

Para volver al comportamiento anterior (pintar siempre el original, aunque pese) se puede pasar
`images: { allowUnoptimizedOriginals: true }`.

## Development

```sh
npm run dev
npm run typecheck
npm run test
npm run build
```

The current API client intentionally returns mock data unless a host injects the legacy `window.GafaFitSDK`. The next implementation step is to replace the mock client with real gafa.fit/gafa.pay HTTP adapters.
