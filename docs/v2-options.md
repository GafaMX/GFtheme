# `data-gf-options` — catálogo

Fuente de verdad: Zod del SDK (`packages/react-sdk/src/sdk/config.ts` y Concierge). Este doc es el índice para humanos y para el Hub.

Merge: **defaults SDK → Hub → este JSON → query**. Contrato: [`v2-hub/remote-config.md`](v2-hub/remote-config.md).

Query de prueba (no uses en producción): `?buq-env=` y `?hub-url=`. Nada más.

---

## HTML mínimo de producción

```html
<script src="https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.js"></script>
<script data-gf-options type="application/json">
  {
    "COMPANY_ID": 171,
    "API_CLIENT": "203",
    "API_SECRET": "…"
  }
</script>
```

`API_SECRET` **nunca** se guarda en el Hub. El resto (THEME, CONCIERGE, …) puede vivir allá.

---

## Claves

| Clave HTML | En el SDK | Obligatoria | Hub | Qué es |
| --- | --- | --- | --- | --- |
| `COMPANY_ID` | `companyId` | sí | no hace falta (es la fila) | Compañía gafa.fit. Sirve para pedir el partial. |
| `API_CLIENT` | `publicClientId` | sí para login/pago | no | OAuth client id. |
| `API_SECRET` | `clientSecret` | sí para login/pago | **prohibido** | OAuth secret. Viaja en el browser (contrato de gafa.fit). |
| `GAFA_FIT_URL` | `apiBaseUrl` | no | sí | API. Default del entorno. |
| `BRAND_ID` | `brandId` | no | sí | Marca por defecto. |
| `THEME` | `theme` | no | sí | Paleta, logo, lock. Ver [`v2-theme-colors.md`](v2-theme-colors.md). |
| `CONCIERGE` / `concierge` | `concierge` | no | sí | `true` \| `{}` \| partial \| objeto completo. Ver abajo. |
| `SHOW_MEMBERSHIP_OPTIONS` | `showMembershipOptions` | no | sí | `true` muestra el link de membresía. |
| `BUQ_ENV` | `environment` | no | sí | `production` · `staging` · `development`. Query `?buq-env=` gana. |
| `GAFAPAY_FRONT_URL` | `gafaPayFrontUrl` | no | sí | Pisa el script de Stripe/PayPal. |
| `HUB_URL` | `hubUrl` | no | sí | Analytics + remote config. Default `https://hub.buq.partners`. Query `?hub-url=` gana. |
| `ANALYTICS` | `analyticsEnabled` | no | sí | `false` apaga heartbeats. |
| `CAPTCHA_PUBLIC_KEY` | `captchaPublicKey` | no | sí | Default: par compartido de Buq. |
| `CAPTCHA_SECRET_KEY` | `captchaSecretKey` | no | **prohibido** | Default compartido. gafa.fit la pide desde el browser. |
| `TOKENMOVIL` | `tokenMovil` | no | sí | SSO app. |
| `IMAGES` | `images` | no | sí | `{ "provider": "cloudflare" \| "none" }`. |
| `language` | `language` | no | sí | `es` / `en`. Hoy **no cambia copy**. No lo prometas. |

Alias del script: `[data-gafa-options]`.

Campos camelCase del `parseSdkConfig` (`companyId`, `theme`, …) también entran si alguien monta el SDK desde JS.

---

## Secretos (nunca al Hub)

El Worker strippea estas claves en GET y PUT:

- `API_SECRET`
- `clientSecret`
- `CAPTCHA_SECRET_KEY`
- `captchaSecretKey`

Si el admin las pega, se tiran. El embed no las pide al Hub.

---

## `THEME`

Partial. Lo que no pongas se deriva (`packages/react-sdk/src/sdk/theme/`).

| Campo | Default | Notas |
| --- | --- | --- |
| `colorScheme` | hereda / light | `light` \| `dark` \| `system` \| `host`. |
| `allowUserColorScheme` | true salvo lock | `false` fija el scheme. |
| `logoUrl` / `logoUrlDark` | — | Wordmark. |
| `logoMaxWidth` / `logoMaxHeight` | — | Si el logo se estira, es esto, no CSS del kit. |
| `colors.brand` | `#111827` | Primario. |
| `colors.accent` | `#f97316` | Si se omite, = brand. |
| `colors.background` `surface` `surfaceRaised` `text` `mutedText` `border` | derivados | |
| `colors.inputBackground` `inputText` `inputBorder` | = surface / text / border | |
| `colors.primary` | alias viejo de `brand` | |
| `typography.fontFamily` / `headingFontFamily` | hereda el sitio | |
| `radius.sm\|md\|lg\|pill` | tokens del SDK | |
| `assets.heroBackgroundUrl` / `loginBackgroundUrl` | — | |

`""` o espacios en un color → default. Nunca transparente.

---

## `CONCIERGE`

Sin esto (y sin script/fixture), el nodo **no monta**. El Hub puede mandar `true` y aun así hace falta `<section data-gf-theme="concierge">` en **esa** página.

| Valor | Resultado |
| --- | --- |
| `true` o `{}` | Defaults live (`createLiveConciergeConfig`). Catálogo de toda la compañía. |
| `{ "contact": { "whatsapp": "521…" } }` | Defaults + ese override. |
| objeto completo | Como hoy. Compat. |

Prioridad al resolver la config del widget:

1. `data-gafa-concierge-fixture` / `data-gf-concierge-fixture` (solo demos)
2. `<script data-gafa-concierge-config>`
3. `CONCIERGE` ya mergeado (Hub + HTML)

Campos que suele tocar un socio (el resto lo arma el default live):

| Campo | Default live | Notas |
| --- | --- | --- |
| `id` | `company-<COMPANY_ID>` | Slug `^[a-z0-9][a-z0-9-]{1,62}$`. |
| `displayName` | `tu estudio` → nombre de la marca al hidratar | |
| `locale` | `es-MX` | |
| `timezone` | `America/Mexico_City` | |
| `contact.whatsapp` | omitido | Dígitos con lada, sin `+`. Vacío = sin botón. |
| `copy.*` | saludo/título con el displayName | |
| `capabilities.*` | todo on; WhatsApp solo si hay número | |
| `theme.mode` / `accent` / `foreground` | de `THEME` o light / `#f97316` / `#111111` | |
| `catalog` | `{ version: "live", products: [], live: true }` | |
| `experience.openingActions` / `groups` | Reservar, Comprar, Cuenta, Horarios | |

Detalle y ejemplo largo: [`v2-agente.md`](v2-agente.md) §11.

---

## Reservado (se ignora hoy)

```json
"CROSS_SELL": {
  "enabled": true,
  "placements": ["cart", "thanks", "page"],
  "types": ["combo", "membership", "product"],
  "limit": 3
}
```

No lo uses para lógica del sitio. El shortcode `cross-sell` no monta.

---

## Atributos que no van en este JSON

Filtros del calendario, `data-gf-buy`, `data-gf-reserve`, etc. van **en el nodo**, no en options. Ver [`v2-agente.md`](v2-agente.md) §7–§9.
