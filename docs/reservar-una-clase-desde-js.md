# Abrir la reserva de una clase desde el JS del sitio

El SDK v2 expone la reserva de **una clase concreta** sin que el calendario esté
montado en la página. Es el mismo flujo que un clic en el calendario: login si
hace falta, detalle con mapa y créditos, y checkout cuando no hay con qué pagarla.

## `openReservation`

```js
// window.GafaThemeSDK (o window.GafaSdk) lo deja el bundle IIFE al arrancar.
const modal = GafaThemeSDK.openReservation({
  meetingId: 84213,
  brandSlug: "fitspin",      // opcional
  locationSlug: "lomas",     // opcional
});

// modal.close() lo cierra desde el sitio.
```

| Opción | Para qué sirve |
| --- | --- |
| `meetingId` | Id de la clase en gafa.fit (el mismo que usa el calendario). Obligatorio |
| `brandSlug` | Acota la búsqueda de la clase a esa marca |
| `locationSlug` / `locationId` | Acota la búsqueda a esa sede |
| `meeting` | Si el sitio ya tiene el objeto de la clase, se abre sin volver a pedirla |
| `onClose`, `onReserved`, `onPurchased` | Callbacks del sitio |

Sin `brandSlug` / `locationSlug` la clase se busca en las sedes publicadas de la
compañía (una petición por sede). Con ellos es una sola. En compañías con varias
marcas o sedes conviene pasarlos.

Solo se resuelven clases **dentro del horizonte publicado** de la sede
(`calendar_days`): son las mismas que el calendario podría mostrar. Si la clase
ya pasó o no está publicada, el modal dice «No encontramos esa clase».

## Desde HTML, sin escribir JS

```html
<button data-gf-reserve data-gf-meeting-id="84213">Reservar esta clase</button>

<a href="#" data-gf-reserve="84213" data-gf-brand="fitspin" data-gf-location="lomas">
  Reservar
</a>
```

Necesita `enablePurchaseButtons()` (el bundle IIFE lo llama solo al arrancar).
Funciona por delegación de eventos, así que también sirve para botones pintados
después (sliders, filtros, contenido cargado por AJAX). Alias aceptados:
`data-bq-meeting-id`, `data-bq-brand`, `data-bq-location`.

## `client.openReservationCheckout` (contrato viejo)

```js
await GafaThemeSDK.client.openReservationCheckout({
  meetingId: 84213,
  brandSlug: "fitspin",
  locationSlug: "lomas",
});
```

Era el puente al *fancy* del theme v1 y **tiraba error** si `window.GafaFitSDK`
no estaba cargado en la página («El checkout de reserva aun no esta implementado
en el cliente HTTP nuevo»). Hoy abre el flujo nativo de v2, así que las
integraciones que ya lo llaman siguen funcionando; para código nuevo usa
`openReservation`, que además devuelve el handle para cerrarlo.

Lo mismo aplica a `client.openCheckout({ brandSlug, payload: { combos_id } })`:
traduce el payload viejo (`combos_id`, `memberships_id`, `products_id`,
`meetings_id`) y abre el checkout nativo.

## Qué NO es esto

- No hay un evento de ventana para abrir la reserva: se llama al método.
- El SDK no simula el clic en la tarjeta del calendario, monta el flujo directo;
  no hace falta que el calendario esté en la página.
- El id tiene que ser el de gafa.fit, no un id interno del sitio.
