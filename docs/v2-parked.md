# Tareas aparcadas

Trabajo acordado que **no se arranca** hasta que lo pidas. El agente no lo implementa de paso.

## Concierge conversacional (reservar / comprar en el chat)

Aparcado 2026-09-11. Plan revisado, **sin código**.

**Pedido:** poder decir “quiero reservar mañana martes en Lomas a las 9 am”, que el chat confirme, saque mapa si existe, y si hay que comprar lleve al checkout. Todo el proceso en el hilo, no solo chips.

**Hoy:** el chat es reglas/regex (`ask.ts`). Horarios de **hoy** sí van a `listMeetings`. Reservar/comprar **salen** al calendario o a `ReservationFlow` / `CheckoutModal`. Ya existe el gancho `POST /concierge/v1/{partner}` sin servidor en este repo.

**Camino acordado (cuando se retome):**

1. Parser + slots (no solo hoy) + card de confirmación → sigue abriendo el modal nativo.
2. No cerrar el chat al abrir login/checkout.
3. Worker con tools fijos (`resolve_studio`, `list_slots`, `get_reservation_context`, `check_credits`, `create_reservation`, `open_checkout`) para hacerlo de verdad en el hilo.
4. Hold/revalidar cupo, timezone de la sede, mapa solo si `getReservationContext` lo trae.

Detalle: conversación del 2026-09-09. Piezas: `packages/react-sdk/src/sdk/concierge/`, `ReservationFlow`, `CheckoutModal`.

No empezar esto si el pedido activo es otra cosa (Hub, checkout, cross-sell).
