# Contrato de eventos

`POST https://hub.buq.partners/v1/events`

El SDK manda un batch. Si el Hub no responde, **la reserva no se rompe**.

```json
{
  "events": [
    {
      "event": "sdk.heartbeat",
      "ts": "2026-08-25T23:00:00.000Z",
      "session_id": "uuid-de-tab",
      "company_id": 80,
      "brand_id": null,
      "location_id": null,
      "user_id": null,
      "widget": "meetings-calendar",
      "sdk_version": "0.1.0",
      "host": "fitspin.mx",
      "path": "/",
      "props": { "widgets": ["meetings-calendar", "login-register"] }
    }
  ]
}
```

Sin email ni nombre. `user_id` solo si hay sesión (id numérico de gafa).

## Nombres

| Evento | Capa |
| --- | --- |
| `sdk.heartbeat` | instalado / activo |
| `widget.mounted` / `widget.error` | instalado |
| `calendar.viewed` · `calendar.filter_changed` · `calendar.meeting_opened` | uso |
| `auth.login_succeeded` · `auth.login_failed` · `auth.registered` · `auth.logged_out` | negocio |
| `reservation.previewed` · `reservation.confirmed` · `reservation.waitlisted` · `reservation.cancelled` | negocio |
| `checkout.opened` · `checkout.paid` · `checkout.failed` | negocio |
| `catalog.item_opened` · `purchase_button.clicked` | uso |
| `concierge.opened` · `concierge.message_sent` | futuro |

CORS abierto. Rate limit por IP y `company_id`. El Hub guarda el *camino*; la caja sigue en Laravel.

CORS: `POST /v1/events`. Admin: cookie en `hub.buq.partners` (`POST /v1/admin/login`).
