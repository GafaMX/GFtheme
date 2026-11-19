# Inventario SDK V2 + Hub (para SDK Next)

Fuente: `v2/main` + Hub `packages/sdk-hub`. El IIFE publicado es `docs/v2-sdk/gafa-sdk.js` → `gafa-sdk.bundle.<stamp>.js` en `@cdn-live`.

Calificaciones de clase/coach **no** están en `v2/main` todavía: PR [#305](https://github.com/GafaMX/GFtheme/pull/305). El resto de esta lista sí.

## Widgets (`data-gf-theme` / shortcodes)

Catálogo: `packages/react-sdk/src/sdk/widgets/registry.ts`. Alias `[data-gafa-v2]`.

| Shortcode | Qué pinta | API JS |
| --- | --- | --- |
| `meetings-calendar` | Calendario día/semana, filtros, reserva | `mountCalendar` |
| `combo-list` | Paquetes de créditos | `mountCatalog` type packages |
| `membership-list` | Membresías | `mountCatalog` type memberships |
| `staff-list` | Coaches | `mountCatalog` type staff |
| `service-list` | Servicios | `mountCatalog` type services |
| `login` / `register` / `password-recovery` | Auth inline | `mountAuth` |
| `login-register` | Header: Entrar / Mi cuenta + carrito | `mountHeaderControls` |
| `login-register-pages` | Auth en página | `mountAuth` |
| `profile-info` | Perfil: reservas, créditos, compras, datos | `mountProfile` |
| `purchase-button` | Abre checkout nativo | `mountPurchaseButton` / `enablePurchaseButtons` |
| `fancy` | Host legacy; V2 no lo necesita | — |
| `concierge` | Barra + chat (off salvo `CONCIERGE`) | `mountConcierge` |
| `cross-sell` | No se monta solo; vive en checkout | Hub `CROSS_SELL` |

Overlays (no shortcode): `openAccount`, `openCheckout`, `openReservation` / `openReservationCheckout`.

Atributos frecuentes: `data-bq-waitlist`, `data-bq-show-week-notes`, `data-bq-combine-waitlist`, `data-bq-calendar-view`, `data-bq-allow-view-change`, `data-gf-combo-id` / `membership-id` / `product-id`, `data-gf-concierge="off"`.

## Hub — partial por compañía

Merge: **defaults SDK → Hub → `data-gf-options` → query**. Secretos (`API_SECRET`, captcha secret) **prohibidos** en el Hub.

### Marca (`THEME`)

- `colorScheme`: light / dark / system / host
- `allowUserColorScheme`: sol/luna
- Logo: `logoUrl`, `logoUrlDark`, `logoMaxWidth`, `logoMaxHeight`
- Colores: brand/primary, botones, fondos (`background`, `surface`, `surfaceRaised`), texto (`text`, `mutedText`), bordes, inputs, avisos (success/warning/danger)
- Tipografía, radios, `headerControls` (Entrar / Mi cuenta)
- `IMAGES.provider`: cloudflare \| none

### Concierge (`CONCIERGE`)

Off salvo el bloque. Flota en todo el sitio; el nodo solo manda dónde va.

- Encendido, nombre, saludo, copy, WhatsApp
- Capabilities: schedule, packages, memberships, account, directReservation, whatsapp
- `experience.locationSwitcher`
- Theme del chat (mode, accent, foreground)
- `catalog.live` + `products: []` hidrata el catálogo de la compañía

### Tienda

| Clave | Default | Notas |
| --- | --- | --- |
| `SHOW_WEEK_MEETING_NOTES` | off (Casa Onze 146 on) | Texto de la nota bajo el nombre en vista **semana**; quita la `i` |
| `SHOW_MEMBERSHIP_OPTIONS` | off | Link “Opciones de la membresía” (pausar/tarjeta). Guardar tarjeta + renovar siguen on y ocultos |
| `MEMBERSHIP_ENROLLMENT` | off | Inscripción 1ª compra. Ver [`v2-pozuelo-inscripcion.md`](v2-pozuelo-inscripcion.md) |
| `CROSS_SELL` | off | Hasta 3 ítems en pie de “Tu pedido” y thank you; títulos libres |
| `BRAND_ID` | — | Marca por defecto |
| `language` | es | **No cambia copy** hoy |

### Conexión (avanzado)

`BUQ_ENV`, `GAFA_FIT_URL`, `GAFAPAY_FRONT_URL`, `HUB_URL`, `ANALYTICS`, `TOKENMOVIL`, `API_CLIENT`, `CAPTCHA_PUBLIC_KEY`. Query de prueba: `?buq-env=`, `?hub-url=`.

## Checkout y cuenta (siempre en el IIFE)

- Login / registro / reset (popup o página), captcha
- Calendario: waitlist, sobrecupo, mapa de asientos, QR, cancelar
- Perfil: próximas, historial, créditos (nombre de **paquete**, no tipo interno), compras, datos, contraseña, stats
- Carrito: combos, membresías, productos; `reservations_max` = tope de unidades; descuentos; gift cards
- Pago: Stripe / PayPal / recurrente; total 0 = sin GafaPay (“Confirmar pedido”); `previewPurchase` (`/reservate?test=true`) bloquea tope/membresía ya activa
- Inscripción: dos cargos (membresía recurrente + fee única) si el Hub lo pide
- Cross-sell en pay + thanks
- Toasts arriba a la derecha

## Auth / API

OAuth password-grant a `buq.partners` / gafa.fit. Header `GAFAFIT-COMPANY`. Tokens por entorno en `localStorage`. Cliente HTTP: `httpGafaClient.ts`.

## Lo que SDK Next tiene que replicar

1. Todos los shortcodes de la tabla.
2. Todos los campos Hub de las tres pestañas (Marca, Concierge, Tienda) + Conexión.
3. Overlays de cuenta, reserva y checkout (portal a `body`, tokens `--gafa-color-*` en el primer frame).
4. Opt-ins apagados: Concierge, week notes, membership options, enrollment, cross-sell, (próximamente calificaciones).
5. Contrato de embed: `gafa-sdk.js` en jsDelivr `@cdn-live` no se renombra.

Detalle de options: [`v2-options.md`](v2-options.md). Guía: [`v2-agente.md`](v2-agente.md).
