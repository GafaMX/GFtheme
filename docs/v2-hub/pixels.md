# Píxeles de marketing

El SDK v2 reenvía los eventos del tracker del Hub a Meta Pixel, TikTok y Google (GA4 + conversión de Ads). **Un solo punto de verdad:** los widgets no hablan con `fbq`/`ttq`/`gtag`. Escuchan `tracker.track`.

CAPI server-side **no** va en este PR. El cliente deja el mismo `event_id` en `props` del evento al Hub para que un worker futuro lo reutilice.

## Encendido

Apagado por default. Hace falta **las dos**:

| Condición | Efecto |
| --- | --- |
| `ANALYTICS: false` | No hay tracker ni píxeles. |
| `PIXELS_ENABLED: false` (default) | Tracker sí, píxeles no. |
| Sin ID del proveedor | No se inyecta ese script. |
| `PIXELS_CONSENT_MODE: required` (default) | No carga scripts hasta consentimiento. |

Si el sitio host ya cargó `fbq`, `ttq` o `gtag`, el SDK los **reutiliza** y no vuelve a bajar el script.

## Keys (públicas)

Remote config y `data-gf-options` / init JS. Tokens de CAPI **nunca** en el cliente (se strippean si alguien los pega).

| HTML / Hub | Init JS | Default |
| --- | --- | --- |
| `PIXELS_ENABLED` | `pixelsEnabled` | `false` |
| `PIXELS_CONSENT_MODE` | `pixelsConsentMode` | `required` |
| `META_PIXEL_ID` | `metaPixelId` | — |
| `TIKTOK_PIXEL_ID` | `tiktokPixelId` | — |
| `GA4_MEASUREMENT_ID` | `ga4MeasurementId` | — |
| `GOOGLE_ADS_ID` | `googleAdsId` | — |
| `GOOGLE_ADS_PURCHASE_LABEL` | `googleAdsPurchaseLabel` | — |

`required` | `implied`. En `required` no hay script hasta:

```js
window.BuqSDK.setConsent({ marketing: true });
// o
window.dispatchEvent(new CustomEvent("buq:consent:granted"));
```

Google Consent Mode v2 arranca en `denied` (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`).

Cero PII en claro. Advanced matching (email/teléfono) solo con consentimiento, normalizado + SHA-256 (WebCrypto).

## Mapa Buq → proveedores

| Buq | Disparador | Meta | TikTok | GA4 / Ads |
| --- | --- | --- | --- | --- |
| `page_view` | init del SDK / cambio de vista | PageView | `page()` | `page_view` |
| `view_content` | `catalog.item_opened`, `calendar.meeting_opened` | ViewContent | ViewContent | `view_item` |
| `add_to_cart` | `cart.item_added` (alta en carrito) | AddToCart | AddToCart | `add_to_cart` |
| `initiate_checkout` | `checkout.opened` | InitiateCheckout | InitiateCheckout | `begin_checkout` |
| `purchase` | `checkout.paid` (`code === 1`, una vez por `purchase_id`) | Purchase | CompletePayment | `purchase` + `conversion` Ads |
| `schedule` | `reservation.confirmed` | Schedule | Schedule (custom) | `generate_lead` + `schedule` |
| `complete_registration` | `auth.registered` | CompleteRegistration | CompleteRegistration | `sign_up` |

No se dispara en `reservation.waitlisted` ni `checkout.failed`. Un error de un proveedor no tumba el SDK.

### Params

`value` (número), `currency` (la de la marca: `MXN` o `EUR`, nunca fija), `content_ids`, `content_type` (`product` \| `class`), `num_items`, `transaction_id` = `purchase_id`.

### Dedup / CAPI

`event_id = buq_<evento>_<id estable>`:

- purchase → `buq_purchase_<purchase_id>`
- schedule → `buq_schedule_<reservation_id>`
- demás → `buq_<evento>_<uuid>`

Viaja como `eventID` (Meta), `event_id` (TikTok), `transaction_id` (GA4). Purchase y schedule se guardan en `sessionStorage` para no repetir al recargar el thank-you. El mismo `event_id` va en `props` del batch al Hub.

## Cómo probar en staging

URL fija (nunca `cdn-live`):

`https://gftheme-staging.i-f47.workers.dev/demo.html?brand=fitspin`

Publicar solo ese Worker (desde `docs/v2-demo`):

```sh
cd docs/v2-demo
npx wrangler deploy
```

Eso actualiza `gftheme-staging`. No toca `cdn-live` ni Laravel.

El demo de staging enciende píxeles con IDs `DEMO_*` e instala mocks de `fbq` / `ttq` / `gtag`. El log aparece abajo (`window.__BUQ_PIXEL_LOG`) y en la consola del panel.

| Evento | Cómo dispararlo en Fitspin (MXN) |
| --- | --- |
| `page_view` | Cargar la página. Cambiar Calendario ↔ Paquetes. |
| `view_content` | Clic en una clase, o “Comprar” en un paquete. |
| `add_to_cart` | El paquete entra al carrito (preselect o catálogo del checkout). |
| `initiate_checkout` | Se abre el checkout (carrito o compra). |
| `complete_registration` | Registrarse en Mi cuenta. |
| `schedule` | Reservar una clase con crédito (no waitlist). |
| `purchase` | Pagar un paquete hasta `checkout.paid` (`code === 1`). Recargar el thank-you no debe repetir Purchase. |

Consentimiento obligatorio: `?brand=fitspin&pixels-consent=required`. Sin el botón “Dar consentimiento de marketing” no debe haber PageView.

También vale Meta Test Events / Tag Assistant si pones IDs reales en el Hub (`PIXELS_ENABLED: true` + IDs). Fitspin es MXN.

## Spec para Buq Next

Buq Next debe **emitir los mismos nombres del tracker** (`catalog.item_opened`, `cart.item_added`, `checkout.opened`, `checkout.paid` con `code === 1`, `reservation.confirmed`, `auth.registered`, `page_view`). No llamar a `fbq`/`ttq`/`gtag` por su cuenta.

1. Reutilizar `createPixelRuntime` + `pixels.wrap(tracker)`.
2. Incluir `event_id` en el POST `/v1/events`.
3. CAPI (fuera de este PR): `POST /v1/capi` con `{ event_id, event_name, event_time, custom_data, user_data: { em, ph } }` — mismos hashes SHA-256. Contrato: `CapiEventHook` en `packages/react-sdk/src/sdk/analytics/pixels/types.ts`.
4. Nunca mandar el token de CAPI al browser.

Código: `packages/react-sdk/src/sdk/analytics/pixels/`.
