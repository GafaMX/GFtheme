# Calificaciones de clase y coach — Hub

El SDK V2 pinta la UI detrás del flag Hub `CLASS_RATINGS` (default **apagado**).
Las estrellas **no van a gafa.fit**. Las guarda el Hub (`packages/sdk-hub`, `https://hub.buq.partners`).

Hasta que un estudio encienda el flag, el SDK **no** pide estrellas. Preview (`ratings.html`) usa un cliente en memoria.

No aplicar las migraciones D1 en production ni desplegar el Hub hasta un GO.

## Modelo de seguridad

No hay firma propia del Hub. El contrato viable es el **OAuth Bearer de gafa.fit** que ya usa el SDK V2 (`Authorization: Bearer` + `GAFAFIT-COMPANY`).

1. El SDK manda ese token al Hub (`POST /v1/ratings`, `GET /v1/ratings/mine`).
2. El Hub llama a gafa.fit **en el servidor**: `GET /api/me` y `GET /api/me/brand/{slug}/reservation-past` (y `-future` si no está en past).
3. De ahí salen `user_id`, nombre del socio, `meeting_id` / `meeting_name`, `staff_id` / `staff_name` y si la clase ya pasó. **Cualquier campo de identidad en el body se ignora** (`user_id`, `customer_name`, `customer_email`, `staff_name`, `meeting_name`, ids de clase/coach).
4. **No se guarda `customer_email`.**
5. Sin token → **401**. Reserva que no es del socio / waitlist / cancelada / marca ajena al estudio → **403**. Clase futura o fecha inválida → **422**. gafa.fit caído o timeout → **503** `gafa_unavailable` (no se guarda nada). `CLASS_RATINGS` apagado → **403** `ratings_disabled` también en los GET.
6. El 409 `already_rated` solo después de verificar que la reserva es de ese socio.
7. `brand_slug` se cruza con las marcas de `GET /api/brand` de ese `GAFAFIT-COMPANY`. «Ya pasó» se mide contra el **fin** de la clase (`ends_at` o `starts_at` + duración). `GAFA_FIT_URL` solo acepta `gafa.fit` / `buq.partners` / `buq.com.mx` / `buq.technology` (y subdominios, https). Rate limit por `cf-connecting-ip`, sin `x-forwarded-for`.
8. `GET /v1/ratings` **no es público**. El listado con filtros es `GET /v1/admin/ratings` (cookie admin). `/mine` solo devuelve la fila del socio autenticado (sin email ni `user_id`).
9. Rate limit persistente en D1 `rate_limits` (migración `0009`), por IP y por socio. Si la tabla no existe, cae al Map en memoria.
10. Promedios del admin agrupados por `meeting_id` y `staff_id` verificados. Los nombres son etiqueta.
11. Filtro de fechas del admin: días de **America/Mexico_City**.

## `POST /v1/ratings`

Headers: `Authorization: Bearer <access_token>`, `GAFAFIT-COMPANY: <companyId>`, `Content-Type: application/json`.

Body aceptado:

| Campo | Obligatorio |
| --- | --- |
| `brand_slug` | sí (para buscar la reserva en gafa.fit) |
| `reservation_id` | sí |
| `class_stars` / `staff_stars` | al menos uno, 1–5 |
| `comment` | no, máx. 500 |

## `GET /v1/ratings/mine?company_id=&reservation_id=`

Mismos headers. Query `user_id` se ignora.

## `GET /v1/admin/ratings?company_id=`

Cookie admin. Filtros `from` / `to` (YYYY-MM-DD en CDMX), `q`, `staff_id`, `meeting_id`, `page`.

## Almacenamiento

- [`0008_class_ratings.sql`](../packages/sdk-hub/migrations/0008_class_ratings.sql) — unique `(company_id, reservation_id)`
- [`0009_rate_limits.sql`](../packages/sdk-hub/migrations/0009_rate_limits.sql)

Reutiliza el binding D1 `DB`. **No hay KV/R2/DO nuevo.** No aplicar en production.

```json
"CLASS_RATINGS": {
  "enabled": true,
  "rateClass": true,
  "rateCoach": true,
  "promptAfterClass": false
}
```
