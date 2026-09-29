# SDK v2 — plan de trabajo (feedback 2026-08-10)

Plan acordado a partir del feedback de Gabriel probando el demo. Cada fase es un
PR chico y probable en el demo. Referencias visuales: Mariana Teck / Commando
Studio (carga por día, filtros en botones), Fitspin (semana completa), A Pilates
(como ejemplo de lo que NO: demasiado plano).

## Decisiones tomadas

- **La vista de DÍA es la default** y abre en hoy. Es la carga más rápida
  posible (una petición de un solo día) y es el patrón de Mariana Teck que
  gustó. Semana queda a un toque, y cada socio puede configurar otra default.
- **El filtro de franja (mañana/tarde/noche) no afecta la carga** — la API
  solo filtra por rango de días, no por hora — así que deja de ocupar una fila
  entera: vive dentro del panel de filtros, compacto.
- **Nada debe sacarte del flujo de reserva.** Login, registro y compra ocurren
  en popup encima del calendario, y al terminar el flujo continúa solo donde se
  quedó (la clase que elegiste sigue elegida).

## Fase A — pulido visual del calendario (en curso)

1. Calendario a ancho completo en el demo.
2. Columnas sin huecos: el primer meeting arriba, sin importar la hora.
   (Era un bug de CSS: `align-content: stretch` repartía el alto sobrante
   entre las filas de la columna.)
3. Filtros compactos: un botón "Filtros" con contador de activos que abre el
   panel (servicio, staff, sede, franja); nada de cuatro selects a lo ancho.
4. Header del calendario más claro: navegación con flechas + "Hoy" + etiqueta
   del rango, más jerarquía visual.
5. Tarjeta de meeting con más datos sin atascar: hora + duración, servicio,
   staff, sede y lugares; iconos discretos donde ayuden a escanear.

## Fase B — flujo de reserva completo (casos de uso)

El corazón del SDK. Al pulsar "Reservar":

| Estado | Qué pasa |
| --- | --- |
| Sin sesión | Popup de login/registro (con campos especiales). Al autenticarse NO se pierde nada: continúa con la misma clase. |
| Con sesión y créditos válidos | Confirmación con detalle de la clase y qué crédito se usa → reservar → éxito. |
| Con sesión, sin créditos | Se muestran los paquetes/membresías que aplican a esa clase → compra → al pagar se completa la reserva. |
| Clase llena | Ofrecer lista de espera con posición. |
| Ya reservada | Mostrar estado y permitir cancelar. |

Trabajo técnico que implica:

- `AuthOverlay`: el AuthWidget dentro de un popup reutilizable, con evento de
  "autenticado" para reanudar el flujo pendiente.
- Averiguar los endpoints de reserva directa (hoy el checkout se delega al
  fancy legacy): `combos/userPosibilities`, crear reserva con crédito, y
  waitlist. Si algún caso no se puede directo contra la API, ese caso concreto
  cae al fancy legacy dentro del popup, pero el flujo de decisión ya es nuestro.
- Estados de post-reserva: éxito con detalle, error con causa real.

## Fase C — perfil completo (paridad con el actual, mejor diseño)

Tabs: **Mis clases** (próximas / lista de espera / historial), **Mi perfil**
(datos, dirección, foto), **Compras**, **Actividad** (reservadas, asistidas,
no-show, canceladas, minutos — `GET /api/me/totals`), **Cambiar contraseña**.

Ya construido y conectado: próximas reservas, créditos/membresías, compras,
cancelar reserva, cerrar sesión. Falta: edición de datos (`POST /api/me`),
foto, dirección (países/estados), historial pasado, actividad y cambio de
contraseña.

## Fase D — catálogo → checkout

"Comprar" del catálogo abre el mismo popup de compra de la fase B (incluye el
caso sin sesión → login popup → continúa la compra).

## Notas para no olvidar

- El `end` de la API es exclusivo (verificado): siempre pedir un día extra.
- Horas en la zona horaria de la sede (ya resuelto).
- El demo es el banco de pruebas: header con cuenta, socios intercambiables,
  claro/oscuro. Cualquier feature nueva se prueba ahí primero.
