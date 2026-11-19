# Calificaciones de clase y coach — contrato para gafa.fit

El SDK V2 pinta la UI detrás del flag Hub `CLASS_RATINGS` (default **apagado**).
**Hoy gafa.fit no expone estos endpoints.** Se revisó:

- `GafaMX/gafa.fit` `routes/api.php` (auth `/me`, reservas past/future/cancel, créditos, membresías, payments, waitlist, giftcards): **no hay** `rating`, `review` ni `feedback`.
- Cliente HTTP del SDK (`httpGafaClient.ts`) y docs de este repo: **ninguna** llamada de calificación.
- Búsqueda en `GafaMX/GafaSDK`, `GafaMX/My-BUQ`, `GafaMX/buq-next`: sin rutas de review/rating.

Hasta que Laravel implemente el contrato de abajo, el SDK:

- GET 404 → “aún no calificada” (la UI se muestra).
- POST 404 → error visible: *El estudio aún no puede guardar calificaciones.*
- El preview (`?ratings=1`) usa un cliente en memoria, no pega a producción.

No inventar que el backend ya existe. No escribir a BD de producción desde el SDK.

## Recurso

Una calificación **por reserva** (`reservations.id` del socio). No por meeting suelto ni por coach suelto: así no se duplica si el socio tomó la misma clase otro día.

## Autenticación

Igual que el resto de `/api/me/*`:

- Header `Authorization: Bearer <oauth access_token>`
- Header `GAFAFIT-COMPANY: <companyId>`
- Middleware `auth:api` + `apiUser` + `authCompany` + `api.brand`

El socio solo lee/escribe **sus** reservas. 403 si la reserva es de otro usuario.

## `GET /api/me/brand/{brand}/reservations/{reservation}/rating`

`{brand}` = slug. `{reservation}` = id de la reserva (el mismo de `reservation-past`).

**200** — ya calificó:

```json
{
  "id": 881,
  "reservation_id": 44,
  "meeting_id": 900,
  "staff_id": 12,
  "class_stars": 5,
  "staff_stars": 4,
  "comment": "Excelente ritmo",
  "created_at": "2026-11-19T18:04:00.000Z",
  "updated_at": "2026-11-19T18:04:00.000Z"
}
```

`class_stars` / `staff_stars` pueden ser `null` si esa marca solo pide uno de los dos.

**404** — no hay fila (el socio todavía no califica) **o** la reserva no existe / no es suya. El SDK trata 404 como “vacío”. Si la reserva no es del usuario, preferir **403**.

## `POST /api/me/brand/{brand}/reservations/{reservation}/rating`

Idempotente en el sentido de **una sola fila**: el primer POST crea; un segundo POST del mismo socio a la misma reserva debe fallar.

Content-Type que el SDK manda hoy: `application/x-www-form-urlencoded` (mismo patrón que `/reservate`). Aceptar también JSON es bienvenido.

### Payload

| Campo | Tipo | Obligatorio | Notas |
| --- | --- | --- | --- |
| `class_stars` | integer 1–5 | si el Hub pide calificar la clase | Omitir o `null` si la marca solo califica coach |
| `staff_stars` | integer 1–5 | si el Hub pide calificar el coach | Omitir o `null` si solo clase |
| `comment` | string | no | Trim; máximo **500** caracteres; `""` = null |
| `meeting_id` | integer | no | Hint; la fuente de verdad es la reserva |
| `staff_id` | integer | no | Hint del coach (o suplente) de esa meeting |

Validar que `meeting_id` / `staff_id`, si vienen, coincidan con la reserva. No confiar en el cliente para autorizar.

### Respuestas

| Status | Cuándo |
| --- | --- |
| **201** (o 200) | Creada. Mismo JSON que el GET. |
| **401** | Sin token |
| **403** | Reserva de otro / clase aún no termina |
| **404** | Reserva inexistente **o** ruta no desplegada |
| **409** | Ya existe calificación para esa reserva |
| **422** | Estrellas fuera de 1–5, comentario > 500, faltan las estrellas que la marca exige |

Cuerpo 422 al estilo Laravel: `{ "message": "…", "errors": { "class_stars": ["…"] } }`.

**No** permitir editar ni borrar desde el socio (v1 del feature = una vez). Admin/estudio puede ver el listado en un endpoint interno aparte (fuera de este SDK).

## Reglas de negocio sugeridas (backend)

1. Solo reservas **pasadas** (`meeting_start` ≤ now) y **no canceladas**. Waitlist que no se convirtió: 403.
2. Unique `(users_id, reservations_id)`.
3. Guardar `companies_id`, `brands_id`, `meetings_id`, `staff_id` denormalizados para reportes.
4. No exponer calificaciones en el catálogo público de staff hasta que producto lo pida.

## Qué ya manda el historial

`GET /api/me/brand/{brand}/reservation-past` debería incluir, por reserva (hoy el SDK ya intenta leerlos):

- `id`
- `meetings_id` / `meetings.id`
- `staff_id` / `meetings.staff.id`
- `cancelled`, `is_waitlist`, `meeting_start`

Si faltan los ids, el POST igual funciona: el backend los saca de la reserva.

## Hub (este repo)

```json
"CLASS_RATINGS": {
  "enabled": true,
  "rateClass": true,
  "rateCoach": true,
  "promptAfterClass": false
}
```

Sin el bloque (o `enabled: false`) el SDK **no cambia nada**. No hace GET/POST de ratings.
