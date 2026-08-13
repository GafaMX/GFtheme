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
sdk.enablePurchaseButtons();
```

This maps current containers such as:

```html
<section data-gf-theme="meetings-calendar" filter-bq-location="true"></section>
<section data-gf-theme="combo-list" data-gf-filterbyname="starter"></section>
<div data-gf-theme="login-register"></div>
```

`login-register` is the header control from v1: a **Mi cuenta** button (plus cart when there are items). Clicking it opens the full login/profile popup. The dedicated page `login-register-pages` still mounts the full form inline.

## Development

```sh
npm run dev
npm run typecheck
npm run build
```

The current API client intentionally returns mock data unless a host injects the legacy `window.GafaFitSDK`. The next implementation step is to replace the mock client with real gafa.fit/gafa.pay HTTP adapters.
