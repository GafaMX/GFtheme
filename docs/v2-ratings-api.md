# Calificaciones de clase y coach — Hub

El SDK V2 pinta la UI detrás del flag Hub `CLASS_RATINGS` (default **apagado**).
Las estrellas **no van a gafa.fit**. Las guarda el mismo Hub que la config de las marcas: `packages/sdk-hub`, `https://hub.buq.partners`.

El socio se identifica con `/me` de gafa.fit (sesión). El POST de la calificación es JSON al Hub.

Hasta que un estudio encienda el flag:

- El SDK **no** pide estrellas ni llama al API.
- Preview (`ratings.html` / `?ratings=1`) usa un cliente en memoria, no pega a producción.
- Demo estático (rama `#305`, no `cdn-live`): `docs/v2-preview/ratings-standalone.html`.

No aplicar la migración D1 en production ni desplegar el Hub hasta un GO.

## Recurso

Una calificación **por reserva** (`reservations.id` del socio). Unique `(company_id, reservation_id)` en D1.

## Autenticación

Los endpoints públicos del Hub **no** usan OAuth (igual que `/v1/events` y `/v1/loyalty/balance`). El SDK manda `company_id` + `user_id` del perfil logueado. CORS + rate limit por IP y por `company+user`.

El listado con comentarios de todos los socios es **admin** (cookie de sesión del Hub).

## `POST /v1/ratings`

JSON. Primera fila gana; un segundo POST a la misma reserva responde **409**.

### Payload

| Campo | Tipo | Obligatorio | Notas |
| --- | --- | --- | --- |
| `company_id` | integer | sí | Estudio Hub |
| `brand_slug` | string | sí | Marca |
| `reservation_id` | integer | sí | Anti-duplicado |
| `user_id` | integer | sí | Cliente |
| `class_stars` | integer 1–5 | al menos uno de clase/coach | `null` si la marca solo pide coach |
| `staff_stars` | integer 1–5 | al menos uno | `null` si solo clase |
| `comment` | string | no | Trim; máximo **500**; `""` = null |
| `meeting_id` / `meeting_name` | | no | Denormalizado para el admin |
| `staff_id` / `staff_name` | | no | Coach de esa reserva |
| `customer_name` / `customer_email` | | no | Del `/me` |
| `brand_id` | integer | no | |

### Respuestas

| Status | Cuándo |
| --- | --- |
| **201** | Creada. `{ ok: true, rating }` |
| **403** | `CLASS_RATINGS` apagado (`ratings_disabled`) |
| **409** | Ya existe fila para esa reserva (`already_rated`) |
| **422** | Validación |
| **429** | Rate limit |
| **503** | Tabla D1 todavía no aplicada (`ratings_unavailable`) |

## `GET /v1/ratings/mine?company_id=&reservation_id=&user_id=`

**200** `{ ok: true, rating }` o `rating: null` si el socio aún no califica.

## `GET /v1/ratings?company_id=&user_id=`

Listado del **propio** cliente (hace falta `user_id`). Filtros: `reservation_id`, `from`, `to`.

## `GET /v1/admin/ratings?company_id=`

Cookie admin. Filtros: `from`, `to`, `q`, `staff_id`, `meeting_id`, `brand_slug`, `page`.

Respuesta: `enabled`, `summary` (promedio clase/coach + ranking) e `items` (comentarios).

## Almacenamiento

Migración [`packages/sdk-hub/migrations/0008_class_ratings.sql`](../packages/sdk-hub/migrations/0008_class_ratings.sql).

Reutiliza el binding D1 `DB` que ya tiene el Worker. **No hay KV/R2 nuevo.**

```sh
# local
cd packages/sdk-hub && npx wrangler d1 migrations apply sdk-hub --local

# production — SOLO con GO
wrangler d1 migrations apply sdk-hub --env production --remote
```

Sin esa migración el API responde **503**. El deploy de production del Hub aplica migraciones: no correr `deploy:production` hasta el GO.

## Hub (flag)

```json
"CLASS_RATINGS": {
  "enabled": true,
  "rateClass": true,
  "rateCoach": true,
  "promptAfterClass": false
}
```

Sin el bloque (o `enabled: false`) el SDK **no cambia nada**. No hace GET/POST de ratings.
