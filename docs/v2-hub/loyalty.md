# Lealtad (puntos en el Hub)

Los puntos viven **solo en el Hub**. No hay canje a crédito de tienda todavía (eso tocaría Laravel en `buq.partners`).

## Qué se puntúa

Sin `user_id` no hay puntos. Heartbeats y vistas de calendario **no** suman.

| Evento | Default | Tope | Notas |
| --- | --- | --- | --- |
| `auth.registered` | +50 | una vez | hace falta sesión / perfil |
| `auth.login_succeeded` | +5 | 1/día | |
| `reservation.confirmed` | +20 | 10/día | idempotente por `reservation_id` |
| `reservation.waitlisted` | +5 | 10/día | |
| `reservation.cancelled` | −10 | 20/día | el saldo no baja de 0 |
| `checkout.paid` | +50 | 10/día | idempotente por `purchase_id` |

`company_id = 0` son las reglas globales. Una compañía puede pisarlas (`PUT /v1/admin/loyalty/rules`).

Niveles: Bronze 0 · Silver 200 · Gold 800.

## APIs

- `GET /v1/loyalty/balance?company_id=&user_id=` — público, sin PII, CORS `*`
- `GET /v1/admin/loyalty/rules?company_id=`
- `PUT /v1/admin/loyalty/rules` `{ company_id, rules: [{ event_name, points, daily_cap, once_per_user, label }] }`
- `GET /v1/admin/loyalty/ranking`
- `GET /v1/admin/loyalty/ledger`
- `POST /v1/admin/loyalty/grant` `{ company_id, user_id, points, reason }`

El ingest (`POST /v1/events`) aplica puntos después de guardar el evento. Si las tablas de lealtad fallan, el ingest **igual acepta** el evento.

El ProfileWidget pide el saldo al Hub (`hubUrl` + `companyId` del SDK) y muestra puntos + nivel. El canje no está en el perfil.
