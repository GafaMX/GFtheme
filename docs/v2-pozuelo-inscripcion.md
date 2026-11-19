# The Base Pozuelo — inscripción (fee de alta)

Hallazgo: **ya está implementada y mergeada**. No hay que “traerla” de otra rama. Lo que falta para lanzar es **encender el Hub** (company 204) y, antes, publicar este PR para que el copy sea **Inscripción** (nunca Matrícula).

No se publicó nada en este trabajo. `cdn-live` no se tocó.

## Dónde está

| Qué | Dónde |
| --- | --- |
| PR original | [#302](https://github.com/GafaMX/GFtheme/pull/302) `feat(v2): matrícula opt-in en la primera compra de membresía` |
| Rama | `ga/v2-matricula-membresias-70d4` |
| Merge a `v2/main` | `1184c22` (2026-11-11) |
| Código vivo | `packages/react-sdk/src/sdk/cart/membershipEnrollment.ts` + `enrollmentCheckout.ts` + checkout |
| Hub | `packages/sdk-hub/public/configModel.js` → Tienda › Membresías › `MEMBERSHIP_ENROLLMENT.*` |

`v2/main` y `cdn-live` apuntan al **mismo SHA** (`97a02f3` al momento de este reporte). El **código ya está en jsDelivr**. The Base no lo cobra porque el partial del Hub de la compañía **204 está vacío** (flag off).

## Qué no es

[#303](https://github.com/GafaMX/GFtheme/pull/303) (`fix(v2): Stripe monta de inmediato…`, draft, SHA `fd75fef`) **no** es la inscripción. Es un follow-up de UX de Stripe (quitar el hold de 8 s). El propio PR dice **No mergear**. No hace falta para lanzar la inscripción. No se mergeó aquí.

## Cómo se enciende The Base (Hub, no código)

Compañía **204**, marca `the-base`, sede `pozuelo-de-alarcon`.

```json
"MEMBERSHIP_ENROLLMENT": {
  "comboId": 3491,
  "label": "Inscripción",
  "membershipIds": [1272, 1271, 1204],
  "firstTimeScope": "any_membership",
  "mode": "first_purchase"
}
```

| ID | Plan |
| --- | --- |
| 1272 | Bronze |
| 1271 | Silver |
| 1204 | Gold |
| 1203 | Socio Fundador — **nunca** lleva inscripción |
| 3491 | Combo de la fee (se oculta del catálogo; no se vende suelta) |

Regla: un solo cargo de inscripción la **primera** vez que el socio compra **cualquier** membresía de esa lista. Descuentos no aplican a esa línea. Un botón, dos cargos (membresía recurrente + inscripción única).

Poner `label: "Inscripción"` en el Hub **aunque** el combo en Buq se llame Matrícula: el carrito usa el label, no el nombre del combo.

## Copy

Este PR cambia el default del SDK y los strings del checkout/Hub a **Inscripción**. En `cdn-live` actual, si enciendes el Hub **sin** publicar esto, la línea del carrito puede decir Inscripción (si el Hub manda `label`) pero toasts y “Cobrando…” siguen diciendo matrícula. **Publicar este PR antes de encender 204.**

## Cómo publicar (cuando haya GO)

1. Mergear este PR a `v2/main`.
2. `cd packages/react-sdk && npm run publish:embed`
3. Commit `docs/v2-sdk`, push `v2/main` **y** `git push origin v2/main:refs/heads/cdn-live` (fast-forward, nunca force).
4. **No** purgar CDN.
5. Hub compañía 204: pegar el JSON de arriba (`label` = Inscripción).
6. Probar Silver 115 € (85 + 30) en una cuenta nueva, sin Socio Fundador.

Hasta el GO: no encender 204, no `publish:embed`.

## Qué se probó aquí (sin cobrar)

- Unit tests de parser, carrito, descuentos, Socio Fundador, dos cargos, fallo del segundo cobro.
- Preview local `?matricula=1` / `#guest=1` / `#returning=1` (mock pay; `/reservate` bloqueado en `safeTestMode`).
- Lecturas reales a `buq.partners` solo si pegas el `API_SECRET` en el panel; este agente no lo hizo y no completó pagos.
