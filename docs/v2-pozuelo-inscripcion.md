# The Base Pozuelo — matrícula (fee de alta)

Hallazgo: **ya está implementada y mergeada**. No hay que “traerla” de otra rama. Lo que falta para lanzar es **encender el Hub** (company 204) **después** del GO del dueño. Este PR no publica, no toca `cdn-live` y **no escribe el partial de 204**.

## Dónde está

| Qué | Dónde |
| --- | --- |
| PR original | [#302](https://github.com/GafaMX/GFtheme/pull/302) `feat(v2): matrícula opt-in en la primera compra de membresía` |
| Rama | `ga/v2-matricula-membresias-70d4` |
| Merge a `v2/main` | `1184c22` (2026-11-11) |
| Código | `packages/react-sdk/src/sdk/cart/membershipEnrollment.ts` + checkout |
| Hub | Tienda › Membresías › `MEMBERSHIP_ENROLLMENT.*` |

`v2/main` y `cdn-live` apuntan al **mismo SHA**. El código ya está en jsDelivr. The Base no cobra porque el partial de la compañía **204 está vacío**.

[#303](https://github.com/GafaMX/GFtheme/pull/303) es un follow-up de Stripe (draft, **No mergear**). No es la fee. No se trajo aquí.

## Copy: el label manda

`DEFAULT_ENROLLMENT_LABEL = "Inscripción"` (otras marcas).

**The Base Pozuelo (compañía 204) debe poner en el Hub `label: "Matrícula"`.** Todo lo que ve el socio (línea del carrito, toasts, “Cobrando…”, errores, preview) sale de `MEMBERSHIP_ENROLLMENT.label` vía `enrollmentCopy()`. No hay “matrícula” / “inscripción” fijos en el checkout.

## Cómo se enciende (Hub, no en este PR)

Compañía **204**, marca `the-base`, sede `pozuelo-de-alarcon`:

```json
"MEMBERSHIP_ENROLLMENT": {
  "comboId": 3491,
  "label": "Matrícula",
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
| 1203 | Socio Fundador — **nunca** lleva la fee |
| 3491 | Combo de la fee (oculto del catálogo) |

Un cargo la **primera** vez que compra cualquier membresía de esa lista. Descuentos no aplican a esa línea.

## Cómo publicar (cuando haya GO)

1. Mergear este PR a `v2/main`.
2. `cd packages/react-sdk && npm run publish:embed`
3. Commit `docs/v2-sdk`, push `v2/main` **y** `git push origin v2/main:refs/heads/cdn-live` (fast-forward).
4. **No** purgar CDN.
5. Hub 204: pegar el JSON de arriba (`label` = **Matrícula**).

Hasta el GO: no encender 204, no `publish:embed`.
