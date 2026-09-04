# SDK v2 — guía para agentes (Buq-Webs y WordPress)

Documento único para **instalar y configurar** el SDK visual de Buq en
cualquier sitio. Si eres un agente (Cursor, Replit, WP), lee esto entero
antes de tocar HTML o CSS.

El SDK **no se copia**. Se carga con un `<script>`. Pinta calendario, login,
cuenta, reserva, carrito y checkout. Concierge solo si el socio lo activa
(§11). Los datos salen de gafa.fit. Los colores salen de `THEME`. No tiene
backend propio.

**Contratos cortos:** colores → [`v2-theme-colors.md`](v2-theme-colors.md) ·
botones HTML → [`botones-de-compra.md`](botones-de-compra.md) · reservar por
id → [`reservar-una-clase-desde-js.md`](reservar-una-clase-desde-js.md) ·
publicar bundle → [`v2-lanzamiento.md`](v2-lanzamiento.md).

---

## 0. Reglas que no se negocian

1. **URL del script (siempre la misma):**
   `https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.js`
2. **No cambies ese `src`.** No uses `@v2`, `@v2/main`, tags `rc.*`,
   `cdn-live-2` ni un SHA.
3. **No copies** `packages/react-sdk/src` al sitio (ni a Replit `lib/`).
4. **No pulses Republish / Stop+Run en Buq-Webs** para un cambio del SDK.
   Eso reinicia **todas** las marcas. El JS ya viene de jsDelivr.
5. **No pelees el CSS del SDK.** Nada de `MutationObserver`, selectores
   internos (`.gafa-sdk.gafa-sdk…`), estilos post-mount ni reordenar
   stylesheets. Si un color no pinta, falta `THEME.colors`.
6. **No muestres tipos de crédito internos** (`CDMXnew`, etc.). Al socio se
   le enseña el **paquete** o la **membresía**. Ver [`creditos-vs-paquetes.md`](creditos-vs-paquetes.md).
7. **No pidas otro `src` al socio.** Un publish actualiza el loader; hard
   refresh basta.
8. **Concierge está apagado por default.** No monta solo por cargar el script.
   Hace falta el nodo `data-gf-theme="concierge"` (o `data-gafa-v2`) **y**
   una config `CONCIERGE`. Ver §11. No inventes un chat paralelo.
   **Cross-sell** sigue reservado: hoy no pinta.

---

## 1. Anatomía de una página

Tres piezas. En este orden:

```html
<script src="https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.js"></script>

<script data-gf-options type="application/json">
  {
    "GAFA_FIT_URL": "https://buq.partners",
    "COMPANY_ID": 171,
    "API_CLIENT": "203",
    "API_SECRET": "…",
    "THEME": {
      "colorScheme": "dark",
      "allowUserColorScheme": false,
      "colors": { "brand": "#F3D15E", "background": "#171C35" }
    }
  }
</script>

<section data-gf-theme="login-register"></section>
<section data-gf-theme="meetings-calendar" filter-bq-location></section>
```

| Pieza | Qué hace |
| --- | --- |
| `<script src=…gafa-sdk.js>` | Loader. Trae el IIFE (`gafa-sdk.bundle.<stamp>.js`). Una vez por página. |
| `[data-gf-options]` | Compañía, llaves, `THEME`. Alias: `[data-gafa-options]`. |
| `[data-gf-theme="…"]` | Un widget. Alias: `[data-gafa-v2="…"]` si el theme v1 sigue en la página. |

Al cargar, el bundle:

1. Lee las options.
2. Monta cada shortcode que tenga `mount`.
3. Activa botones `[data-gf-buy]`, `[data-gf-reserve]`, `[data-gf-cart]`, `[data-gf-account]`.
4. Deja `window.GafaThemeSDK` (y `window.GafaSdk`).

Si llega `?token=` + `?email=` (mail de reset), abre la cuenta solo.

---

## 2. Instalar en Buq-Webs

Buq-Webs (Replit) sirve **todas** las marcas en `https://web.buq.mx/<marca>`.
Un secreto para toda la app:

```
VITE_GAFA_SDK_V2_URL=https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.js
```

**No lo cambies.** El HTML de cada marca (builder / `index-*.html`) debe:

1. Cargar **ese** script (o el que ya inyecta el layout).
2. Tener **un** `[data-gf-options]` con `COMPANY_ID`, `API_CLIENT`, `API_SECRET`
   y `THEME` de **esa** marca.
3. Poner los contenedores `data-gf-theme` donde va cada bloque.
4. Quitar CSS de overlays, observers y `localStorage` de theme si existían.

### Mapa típico de un sitio

| Página / zona | Shortcode o atributo |
| --- | --- |
| Header (todas) | `login-register` — Mi cuenta + carrito |
| Clases / home | `meetings-calendar` + filtros |
| Paquetes | `combo-list` **o** botones `data-gf-buy` + `data-gf-combo-id` |
| Membresías | `membership-list` **o** `data-gf-membership-id` |
| Tienda | `data-gf-buy` + `data-gf-product-id` |
| “Reservar esta clase” en una landing | `data-gf-reserve` + `data-gf-meeting-id` |
| Perfil | lo abre el header; `profile-info` solo si quieres la página entera |
| Concierge (barra + chat) | `concierge` — **opt-in**. Nodo + `CONCIERGE`. Ver §11 |

Checkout, login popup y detalle de reserva **no se pegan a mano**: el SDK
los abre en `document.body`.

### Checklist Buq-Webs

- [ ] El `src` es `@cdn-live/.../gafa-sdk.js`
- [ ] Un solo `[data-gf-options]` por página
- [ ] `COMPANY_ID` / `API_CLIENT` / `API_SECRET` de **esta** marca (no los de Fitspin)
- [ ] `THEME` completo si la marca tiene paleta propia (The Base, ATLIC)
- [ ] Fitspin **sin** lock (ver §5)
- [ ] Cero CSS contra `.gafa-checkout-overlay` / `.gafa-account-overlay`
- [ ] Hard refresh. **No** Republish

---

## 3. Instalar en WordPress / Elementor

Mismo contrato. El shortcode PHP del theme v1, si existe, termina siendo
los mismos `data-gf-*`.

1. **Header / HTML widget, una vez:** el `<script src>` de `@cdn-live`.
2. **Mismo header:** `<script data-gf-options type="application/json">…</script>`.
3. **Por sección:** un HTML widget vacío con `data-gf-theme="…"`.
4. Si la página **aún carga** `main.min.js` (v1): usa `data-gafa-v2="meetings-calendar"`
   en los nodos v2. No montes v1 y v2 en el **mismo** nodo.
5. Elementor pinta `button` / `img` / `input`. El SDK ya se defiende. **No**
   bajes `!important` ni triples `.gafa-sdk`. Si el logo se estira, es
   `THEME.logoMaxWidth` / `logoMaxHeight`, no CSS del kit.

Atributos del calendario (`filter-bq-location`, etc.) van **en el mismo
elemento** del shortcode, no en un wrapper del kit.

```html
<section
  data-gf-theme="meetings-calendar"
  filter-bq-location
  filter-bq-location-default="235"
  data-bq-calendar-view="week"
></section>
```

---

## 4. `data-gf-options` — todo lo que se puede meter

JSON. Claves legacy (mayúsculas). No pongas secretos en el chat; sí en el HTML
del socio (así lo exige gafa.fit hoy, igual que v1).

| Clave | Obligatoria | Qué es |
| --- | --- | --- |
| `COMPANY_ID` | sí | Id de compañía en gafa.fit |
| `API_CLIENT` | sí para login/pago | OAuth client id |
| `API_SECRET` | sí para login/pago | OAuth secret (viaja en el browser; contrato heredado) |
| `GAFA_FIT_URL` | no | API. Default `https://buq.partners/` |
| `BRAND_ID` | no | Marca por defecto |
| `THEME` | no | Paleta, logo, lock. Ver §5 |
| `SHOW_MEMBERSHIP_OPTIONS` | no | `true` muestra el link “Opciones de la membresía”. Default oculto. Guardar tarjeta + renovar siguen ON |
| `BUQ_ENV` | no | `production` · `staging` · `development` |
| `GAFAPAY_FRONT_URL` | no | Pisa el script de Stripe/PayPal |
| `HUB_URL` | no | Analytics. Default `https://hub.buq.partners` |
| `ANALYTICS` | no | `false` apaga heartbeats |
| `CAPTCHA_PUBLIC_KEY` / `CAPTCHA_SECRET_KEY` | no | Default: par compartido de Buq |
| `TOKENMOVIL` | no | SSO app |
| `IMAGES` | no | `{ "provider": "cloudflare" \| "none" }` |
| `CONCIERGE` | no | Config del asistente. **Sin esto el Concierge no existe**, aunque pongas el HTML. Alias: `concierge`. Ver §11 |

Query string de prueba (no uses en producción):

- `?buq-env=staging` pisa el backend
- `?hub-url=http://127.0.0.1:8787` pisa el Hub

`language` existe en el schema (`es`/`en`) pero **hoy no cambia copy**. No
lo prometas.

---

## 5. `THEME` — colores, logo, lock

Fuente de verdad visual del SDK. Detalle: [`v2-theme-colors.md`](v2-theme-colors.md).

### Marca con paleta fija (The Base, ATLIC)

```json
"THEME": {
  "colorScheme": "dark",
  "allowUserColorScheme": false,
  "logoUrl": "https://…/wordmark.png",
  "logoUrlDark": "https://…/wordmark-claro.png",
  "logoMaxWidth": 220,
  "logoMaxHeight": 110,
  "colors": {
    "brand": "#F3D15E",
    "accent": "#F3D15E",
    "background": "#171C35",
    "surface": "#1E2444",
    "surfaceRaised": "#252C50",
    "text": "#FFFFFF",
    "mutedText": "#AEB4CB",
    "border": "#394165",
    "inputBackground": "#171C35",
    "inputText": "#FFFFFF",
    "inputBorder": "#394165"
  }
}
```

Con lock, se ignora `html.fitspin-dark`, `document.documentElement.dataset.theme`,
`prefers-color-scheme` y `--sdk-*`.

### Fitspin (sigue al sitio)

```json
"THEME": {
  "colorScheme": "light",
  "logoUrl": "https://…/wordmark-negro.png",
  "logoUrlDark": "https://…/wordmark-blanco.png"
}
```

**No** pongas `allowUserColorScheme: false` ni `colorScheme: "dark"` en Fitspin.
El host pinta `--sdk-*` / `html.fitspin-dark`.

### Tokens

| `colors.*` | CSS | Default si se omite |
| --- | --- | --- |
| `brand` | `--gafa-color-primary` + alias `--gafa-color-brand` | paleta del scheme |
| `accent` | `--gafa-color-accent` | = brand |
| `background` `surface` `surfaceRaised` | `--gafa-color-*` | derivados del scheme |
| `text` `mutedText` `border` | `--gafa-color-*` | derivados |
| `inputBackground` `inputText` `inputBorder` | `--gafa-color-input-*` | = surface / text / border |
| `success` `warning` `danger` | `--gafa-color-*` | se derivan (si mandas hex, colorean el tono) |

`colors.primary` (nombre viejo) = `brand` si este no viene.
`""` o espacios → default. Nunca transparente.

Opcional, no mezclar en un ticket solo de color:

- `typography.fontFamily` / `headingFontFamily` (default: hereda el sitio)
- `radius.sm|md|lg|pill`
- `assets.heroBackgroundUrl` / `loginBackgroundUrl`

### Qué no pinta THEME

- Iframe de Stripe / GafaPay (el Card Element es de ellos).
- Tipografía ni layout, salvo que los declares.
- El sitio alrededor del SDK (hero del host, footer, Elementor).

---

## 6. Widgets (`data-gf-theme`)

Un shortcode = un contenedor. El registry está en
`packages/react-sdk/src/sdk/widgets/registry.ts`.

| Shortcode | Estado | Qué monta |
| --- | --- | --- |
| `meetings-calendar` | stable | Calendario + reserva |
| `combo-list` | stable | Paquetes. Clic → checkout |
| `membership-list` | stable | Membresías. Clic → checkout |
| `staff-list` | stable | Coaches |
| `service-list` | stable | Servicios |
| `login` | stable | Login inline |
| `register` | stable | Registro inline |
| `password-recovery` | stable | Reset inline |
| `login-register` | stable | Header: cuenta + carrito (popup, no form en la barra) |
| `login-register-pages` | stable | Auth a página completa |
| `profile-info` | stable | Perfil (reservas, créditos, compras) |
| `purchase-button` | stable | Botón / ancla de compra |
| `fancy` | stable | Host legacy. V2 **no lo necesita** |
| `concierge` | **opt-in** | Barra + chat. **Off** si no hay nodo **y** `CONCIERGE`. Ver §11 |
| `cross-sell` | **preview** | Reservado. Hoy **no pinta nada** |

`data-gafa-v2="meetings-calendar"` es el mismo shortcode.

---

## 7. Calendario — filtros y vista

Van en el `<section data-gf-theme="meetings-calendar">`.

| Atributo | Default | Efecto |
| --- | --- | --- |
| `filter-bq-location` | off | Muestra el select de sede |
| `filter-bq-brand` | off | Select de marca (multi-marca) |
| `filter-bq-service` | **on** | Select de servicio. `="false"` lo apaga |
| `filter-bq-staff` | **on** | Select de coach. `="false"` lo apaga |
| `filter-bq-room` | off | Reservado (sala). Hoy no pinta UI |
| `filter-bq-location-default="235"` | — | Sede inicial (id gafa.fit) |
| `filter-bq-brand-default` | — | Marca inicial (id) |
| `filter-bq-service-default` | — | Servicio inicial (id) |
| `filter-bq-staff-default` | — | Coach inicial (id) |
| `data-bq-calendar-view="day"\|"week"` | `day` | Vista inicial |
| `data-bq-calendar-visualization="vertical"\|"horizontal"` | — | Alias legacy: vertical=día, horizontal=semana |
| `data-bq-allow-view-change="false"` | true | Quita el toggle día/semana |
| `data-gf-limit` | — | Tope de clases (número) |
| `data-bq-show-description` | — | Se acepta; la nota de clase se pinta si la API la manda |

La URL también arranca la sede: `?location=235` (o `location_id` / `locationId`).
Si el usuario elige “Todos”, no se vuelve a aplicar.

Los ids son los de **gafa.fit**, no ids del builder.

---

## 8. Catálogo, header, auth — atributos

### Paquetes / membresías

| Atributo | Dónde | Efecto |
| --- | --- | --- |
| `data-gf-filterbyname` | `combo-list` / `membership-list` | Filtra por nombre |
| `data-buq-brand` | esos + purchase | Slug de marca |

### Header `login-register`

| Atributo | Efecto |
| --- | --- |
| `data-bq-combine-waitlist="true"` | Junta lista de espera en la cuenta |

### Auth en página `login-register-pages`

| Atributo | Efecto |
| --- | --- |
| `data-gf-initial="login"\|"register"\|"password-recovery"\|"profile"` | Vista inicial |
| `data-gf-base-url` | Base para links del form |

### Membresía en checkout

| Cómo | Efecto |
| --- | --- |
| `SHOW_MEMBERSHIP_OPTIONS: true` en options | Muestra el link |
| `show-membership-options` en el shortcode de compra | Igual |
| Default | Link oculto; guardar tarjeta + renovar ON |

---

## 9. HTML plano — comprar, reservar, carrito, cuenta

El IIFE ya llama `enablePurchaseButtons()`. Sirve para nodos que el builder
pinta después (sliders, AJAX).

| Atributo | Qué abre |
| --- | --- |
| `data-gf-buy` + `data-gf-combo-id` | Checkout con ese paquete (salta catálogo) |
| `data-gf-buy` + `data-gf-membership-id` | Checkout membresía |
| `data-gf-buy` + `data-gf-product-id` | Checkout producto |
| `data-gf-brand` / `data-gf-location` / `data-gf-location-id` | Acotan marca/sede |
| `data-gf-cart` | Carrito (catálogo + pedido) |
| `data-gf-cart-count` | Número; `data-gf-cart-empty="true"` si va vacío |
| `data-gf-account` | Popup de cuenta |
| `data-gf-reserve` + `data-gf-meeting-id` | Reserva de esa clase |

Alias legacy: `data-bq-combo-id`, `data-bq-membership-id`, `data-bq-product-id`,
`data-bq-meeting-id`, `data-buq-brand`.

```html
<button data-gf-buy data-gf-combo-id="971" data-gf-brand="the-base">Comprar</button>
<button data-gf-reserve data-gf-meeting-id="84213" data-gf-location="cdmx">Reservar</button>
<a href="#" data-gf-cart>Carrito (<span data-gf-cart-count>0</span>)</a>
<button type="button" data-gf-account>Mi cuenta</button>
```

Ids = gafa.fit. El nombre y el precio los pone el catálogo, no el HTML.

---

## 10. JavaScript (`window.GafaThemeSDK`)

El bundle lo crea solo. No llames `createGafaSdk` otra vez en Buq-Webs/WP
salvo que sepas que no hay embed.

```js
const sdk = window.GafaThemeSDK; // o window.GafaSdk

sdk.openReservation({
  meetingId: 84213,
  brandSlug: "the-base",
  locationSlug: "cdmx",
});

sdk.openCheckout({
  brandSlug: "the-base",
  preselect: { type: "combo", id: 971 },
  skipCatalog: true,
});

sdk.openAccount();
sdk.enablePurchaseButtons(); // el IIFE ya lo hizo
```

| Método | Para qué |
| --- | --- |
| `openReservation({ meetingId, brandSlug?, locationSlug?, locationId? })` | Misma reserva que el calendario, sin calendario |
| `openCheckout({ brandSlug?, preselect?, skipCatalog?, locationSlug? })` | Carrito / pago |
| `openAccount()` | Login o perfil |
| `mountCalendar` / `mountAuth` / `mountCatalog` / `mountProfile` | Solo si montas a mano (apps React) |
| `track` / `heartbeat` | Hub. No tires si falla |

`client.openCheckout` / `client.openReservationCheckout` (contrato viejo) hoy
abren los modales nativos. Código nuevo: los métodos del `sdk`.

---

## 11. Concierge — opt-in (apagado por default)

Mismo script, mismas options, mismo `THEME`. No es un bundle aparte ni un
iframe. **Cargar `gafa-sdk.js` no lo enciende.**

Hacen falta **las dos** piezas. Si pones el nodo y olvidas la config, el
bootstrap **tira**: `Concierge config was not found`.

### 11.1 Cómo se activa

**1. Nodo HTML** (una vez por página, donde quieras la barra):

```html
<section data-gf-theme="concierge"></section>
```

Si el theme v1 sigue cargado, usa el alias para no pelear el shortcode viejo:

```html
<section data-gafa-v2="concierge"></section>
```

**2. Config declarativa.** El SDK busca, en este orden:

| Prioridad | Fuente | Cuándo |
| --- | --- | --- |
| 1 | `data-gafa-concierge-fixture` / `data-gf-concierge-fixture` en el nodo | Solo demos. Valores: `fitspin`, `demo-studio`. **Nunca** se asume solo. |
| 2 | `<script data-gafa-concierge-config type="application/json">` (en el nodo o global) | Config suelta, fuera de options |
| 3 | `CONCIERGE` (o `concierge`) dentro de `[data-gf-options]` | **Camino de producción** |

Sin esas tres: no hay Concierge. Fitspin **no** es el default del registry.

Opcional en el nodo: `data-gafa-concierge-live` / `data-gf-concierge-live`
fuerza hidratar sedes/paquetes desde el cliente BUQ (equivalente a
`catalog.live: true`). `="false"` lo apaga aunque el JSON traiga `live`.

Apps React: `sdk.concierge.mount({ partnerId, config, container })`.
Mismo objeto `CONCIERGE`, no un fixture implícito.

### 11.2 WhatsApp — opcional

**No se lee de gafa.fit.** Si no pones teléfono, **no sale el botón**. El resto
del Concierge monta igual.

| Qué pones | Qué pasa |
| --- | --- |
| Omites `contact.whatsapp` o lo dejas `""` | Sin icono, sin chip. Listo. |
| `"5215512345678"` (dígitos, con lada, sin `+`) | Icono en la barra. Clic → `https://wa.me/5215512345678` |

México (móvil): `52` + `1` + 10 dígitos. USA: `1` + 10 dígitos.
Un `+52 55 …` o un string raro **sí** tira la config. Vacío no.

`capabilities.whatsapp: false` oculta el botón aunque haya número.

### 11.3 Catálogo — `products: []` + `live: true`

Sí: en producción **siempre** deja `products` vacío y `live: true`. El SDK
pide a BUQ **todos** los paquetes y membresías de **esta** `COMPANY_ID`
(según `capabilities.packages` / `memberships`). No hay que listarlos.

| `catalog` | Qué pasa |
| --- | --- |
| `{ "live": true, "products": [] }` | **Default de socio.** Trae todo lo de la compañía. |
| `{ "live": true, "products": [ { "type": "combo", "id": "680", … } ] }` | Allowlist: si esos IDs existen en BUQ, solo esos. Si no matchean, cae a todo lo live. Casi nunca lo necesitas. |
| `{ "live": false, "products": [ … ] }` | Catálogo fijo a mano. Fixtures / demos. |

`experience` (chips, grupos, switcher de sede) solo **presenta**. No trae
precios ni IDs.

### 11.4 Ejemplo mínimo de producción

Mismo `[data-gf-options]` de siempre. Añade `CONCIERGE` y el nodo.

```html
<script data-gf-options type="application/json">
  {
    "GAFA_FIT_URL": "https://buq.partners",
    "COMPANY_ID": 190,
    "API_CLIENT": "…",
    "API_SECRET": "…",
    "THEME": { "colorScheme": "dark", "allowUserColorScheme": false },
    "CONCIERGE": {
      "id": "bunker",
      "displayName": "Bunker Indoor Golf",
      "locale": "es-MX",
      "timezone": "America/Mexico_City",
      "buq": {
        "companyId": 190,
        "brands": [{ "slug": "bunker", "name": "Bunker Indoor Golf", "locationIds": ["pending"] }]
      },
      "studios": [],
      "catalog": { "version": "live", "products": [], "live": true },
      "routes": {
        "web": { "home": "/", "calendar": "/", "packages": "/paquetes" },
        "webview": { "home": "/", "calendar": "/", "packages": "/paquetes" }
      },
      "contact": { "whatsapp": "5215512345678" },
      "copy": {
        "assistantName": "Concierge",
        "greeting": "¡Hola! Soy el concierge de Bunker. ¿Reservamos o vemos paquetes?",
        "title": "Bunker Concierge",
        "subtitle": "Tu asistente personal",
        "fallback": "Puedo ayudarte con horarios, paquetes, sedes y reservas.",
        "scope": "Solo puedo ayudar con Bunker Indoor Golf."
      },
      "capabilities": {
        "schedule": true,
        "packages": true,
        "memberships": true,
        "account": true,
        "directReservation": true,
        "whatsapp": true
      },
      "theme": { "mode": "dark", "accent": "#F3D15E", "foreground": "#111111", "icon": "sparkles" },
      "fallbacks": { "calendar": true, "packages": true, "account": true, "whatsapp": true },
      "security": { "allowedOrigins": ["https://web.buq.mx"] },
      "experience": {
        "locationSwitcher": true,
        "openingActions": [
          { "label": "Reservar", "action": { "kind": "reservar" } },
          { "label": "Comprar paquetes", "action": { "kind": "comprar" } },
          { "label": "Mi cuenta", "action": { "kind": "cuenta" } },
          { "label": "Horarios de hoy", "action": { "kind": "horarios_hoy" } }
        ],
        "groups": [
          { "id": "paquetes", "label": "Paquetes", "match": { "types": ["combo"] } },
          { "id": "membresias", "label": "Membresías", "match": { "types": ["membership"] } }
        ]
      }
    }
  }
</script>

<section data-gafa-v2="concierge"></section>
```

`security.allowedOrigins`: orígenes extra del socio. Vacío `[]` no bloquea.
`localhost` y `*.trycloudflare.com` ya son de confianza (previews).

`id` = slug corto (`^[a-z0-9][a-z0-9-]{1,62}$`). Una config por marca /
página. Si no hay WhatsApp, quita `contact.whatsapp` (o déjalo `""`):
el botón no sale. `products: []` + `live: true` trae todo el catálogo.

**Agente: no implementes Concierge con chat custom, Intercom ni CSS encima
del calendario.** Si la marca no lo pidió, **no pongas el nodo**.

---

## 12. Cross-sell — por desarrollar, contrato reservado

**Estado:** shortcode `cross-sell` en el registry, **sin `mount`**. No hay UI.

Objetivo (cuando se construya): sugerir paquetes / membresías / productos
**dentro del SDK**, con la misma paleta y el mismo checkout. Tres sitios:

1. **Carrito** — “También te puede interesar” debajo de las líneas.
2. **Gracias** — al terminar una compra o reserva.
3. **Página** — bloque en landings de paquetes.

Markup reservado (hoy no monta; el bootstrap lo ignora):

```html
<section
  data-gf-theme="cross-sell"
  data-gf-limit="3"
  data-buq-brand="the-base"
></section>
```

Options reservadas (hoy se ignoran; no las uses para lógica del sitio):

```json
"CROSS_SELL": {
  "enabled": true,
  "placements": ["cart", "thanks", "page"],
  "types": ["combo", "membership", "product"],
  "limit": 3
}
```

Reglas para el agente **hasta que exista mount**:

- No armes un carrusel “recomendados” que abra otro checkout.
- No clones nodos del SDK ni copies precios a mano.
- Los botones `data-gf-buy` de la página **sí** son válidos: eso no es
  cross-sell, es compra directa.
- El checkout actual ya deja “Agregar otro paquete o membresía”: no lo
  sustituyas.

Cuando se implemente: mismo `THEME`, mismos ids de gafa.fit, mismo
`openCheckout({ preselect })`. Un publish a `cdn-live` basta. Este
documento se actualizará y el shortcode pasará a `stable`.

---

## 13. Entornos

| `BUQ_ENV` | API | Uso |
| --- | --- | --- |
| `production` (default) | `https://buq.partners/` | Socios |
| `staging` | `https://buq.com.mx/` | Stripe nuevo |
| `development` | `https://buq.technology/` | Dev |

En staging el checkout avisa: GafaPay puede cobrar en Stripe de producción.
No uses tarjeta real.

---

## 14. Qué no es trabajo del sitio

| Lo hace el SDK | No lo hagas en Buq-Webs / WP |
| --- | --- |
| Overlays de login / cuenta / reserva / checkout | CSS o JS sobre `.gafa-*-overlay` |
| Paleta y logo | `!important` del kit, observers, pelear especificidad |
| Carrito en `localStorage` | Otro carrito paralelo |
| Login OAuth + token AES (compatible con v1 y la app) | Otro auth |
| Toasts de error de login/pago | Banners custom con “runtime” / ERROR-05 |
| PayPal hold / Stripe dark | Parches al iframe |
| Heartbeats al Hub | POST a `GAFA_FIT_URL` “para analytics” |

---

## 15. Prompt para pegarle a otro agente

Copia esto tal cual:

```
Instala el SDK v2 de Buq. Guía: docs/v2-agente.md del repo GafaMX/GFtheme.

1. UN script:
   https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.js
   No cambies el src. No copies packages/react-sdk. No pulses Republish en Buq-Webs.

2. UN <script data-gf-options type="application/json"> con COMPANY_ID, API_CLIENT,
   API_SECRET de ESTA marca y THEME (colores + logo). Contrato de colores:
   docs/v2-theme-colors.md.

   Marca locked (The Base/ATLIC): colorScheme dark|light + allowUserColorScheme false
   + colors.background/surface/text/….
   Fitspin: THEME light, logoUrl + logoUrlDark, SIN lock.

3. Contenedores data-gf-theme (o data-gafa-v2 si el v1 sigue cargado):
   login-register en header, meetings-calendar en clases, combo-list / membership-list
   o botones data-gf-buy. Filtros del calendario: filter-bq-location, etc.

4. Compras/reservas sueltas: data-gf-buy + data-gf-combo-id | membership-id | product-id.
   Reservar clase: data-gf-reserve + data-gf-meeting-id. Ids de gafa.fit.

5. No CSS de overlays, no MutationObserver, no selectores internos del SDK.
   Concierge está APAGADO salvo nodo data-gf-theme=concierge (o data-gafa-v2)
   + CONCIERGE en options. WhatsApp es opcional: sin teléfono no hay botón.
   catalog.live true + products [] = todos los paquetes de ESTA compañía.
   No inventes un chat. Cross-sell sigue reservado: no pinta.
   No implementes un carrusel paralelo.

6. Nunca muestres credit.name interno. Hard refresh para ver el bundle nuevo.
```

---

## 16. Verificación

Después de pegar options + widgets:

1. Hard refresh. Network: `gafa-sdk.js` y luego `gafa-sdk.bundle.<stamp>.js`.
2. Calendario pinta clases de **esta** compañía.
3. Header abre cuenta y carrito (overlay a pantalla, no un cajón del tema).
4. Un `data-gf-buy` abre checkout con el producto correcto.
5. Si hay `THEME.colors`, overlays y calendario son **la misma** paleta
   desde el primer frame. Sin flash blanco.
6. Fitspin (si aplica) sigue el toggle del sitio.
7. Consola: cero 401 por `COMPANY_ID` / llaves ajenas.
8. Si hay Concierge: barra visible. Sin `contact.whatsapp`, no hay icono WA.
   Con número, abre `wa.me/<dígitos de ESTA marca>`. “Comprar” hidrata **toda**
   la compañía (`products: []` + `live`), no Demo Studio / Fitspin.
   Sin nodo o sin `CONCIERGE`: no hay barra. Eso es correcto.

Si el color no cambia: el `THEME` no está llegando al JSON, o hay CSS del
sitio encima. Quita el CSS. No subas especificidad.
