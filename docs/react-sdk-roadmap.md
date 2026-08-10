# GFTheme React SDK v2 — estado y roadmap

Tablero único de qué está listo y qué sigue en el SDK nuevo (`packages/react-sdk/`).
El theme legacy (`src/`) sigue vivo y en producción; esto corre **en paralelo**, sin tocarlo.

- **Rama de trabajo:** `feature/react-sdk-v2` (y ramas `cursor/*` que salen de ahí).
- **`master` es producción del legacy** — nada del SDK nuevo entra ahí hasta que haya revisión humana.
- **Contexto técnico completo:** `CLAUDE.md` (raíz) → sección "Rewrite en curso".
- **Plan de arquitectura original:** `docs/react-sdk-modernization.md` (PR #189).

## 1. Por qué el SDK nuevo y no seguir puliendo el legacy

Las optimizaciones del calendario legacy (PRs #195, #196, #197, ya en producción) quitaron el
tiempo muerto evidente: delay artificial de 5s, carga de los 21 días de golpe, remounts por
`key` aleatoria y filtros recalculados en cada render. Lo medido después de eso en Bunker:

| Concepto | Medición (2026-08-10) |
| --- | --- |
| Primera semana, una sede | ~1.5–2.3 s |
| Primera semana, dos sedes en paralelo | ~1.5 s de reloj |
| Rango completo de 21 días, una sede | ~5.5 s |
| Bundle del theme legacy | 1.37 MB sin comprimir |

Es decir: lo que queda de lentitud ya **no vive en el render**, vive en el costo de la API y en
el peso del bundle único. Seguir micro-optimizando el legacy da rendimientos decrecientes; el
SDK nuevo ataca las dos cosas de raíz (code splitting real, cache con TanStack Query,
prefetch por semana) y además desbloquea lo que el legacy no puede dar: mobile-first,
theming por marca y templates editables.

## 2. Estado por widget

| Widget | Estado | Qué falta |
| --- | --- | --- |
| `CalendarWidget.tsx` | Funcional | Paginación por semana con prefetch; estados vacíos por sede |
| `FancyOverlay.tsx` | Funcional | — |
| `PurchaseButtonWidget.tsx` | Funcional | — |
| `AuthWidget.tsx` | Funcional | Interceptar `NotAuthenticatedError` para mostrar login inline |
| `CatalogWidget.tsx` | Parcial | El botón "Comprar" no hace nada: falta cablearlo a `FancyOverlay` |
| `ProfileWidget.tsx` | Funcional | Validar los shapes con una cuenta de prueba real; editar datos personales |

Infra ya resuelta: cliente HTTP directo a gafa.fit (`httpGafaClient.ts`), token compartido con
el legacy y el WebView de `buq-app` (`tokenStorage.ts`), captcha abstraído
(`captcha/CaptchaProvider.ts`), theming por CSS variables (`theme/theme.tsx`).

## 3. Backlog priorizado

Cada punto es un PR chico e independiente, revisable y cancelable por separado.

1. **Catalog conectado al checkout.** `CatalogWidget` ya trae paquetes, membresías, servicios y
   staff reales; solo falta que "Comprar" llame a `client.openCheckout` y abra `FancyOverlay`,
   igual que ya lo hace `PurchaseButtonWidget`.
2. **Validar el perfil con una cuenta real.** Ya está construido (reservas próximas, créditos,
   membresías, compras, cancelar reserva y cerrar sesión) y verificado con el cliente mock y en
   estado sin sesión contra producción. Falta una cuenta de prueba con movimientos para
   confirmar los shapes en vivo y, después, la edición de datos personales (`POST /api/me`).
3. **Login inline cuando falla el checkout.** `legacyGafaFitAdapter.ts` ya lanza
   `NotAuthenticatedError`; falta que `FancyOverlay` lo intercepte y muestre `AuthWidget` en vez
   de un error genérico.
4. **Paginación real por semana en el calendario.** Semana visible + prefetch de la siguiente en
   segundo plano, en lugar de pedir todo el rango. Es el equivalente moderno (y correcto) de lo
   que en el legacy se parcheó con carga progresiva.
5. **Preview en vivo comparable.** `live.html` ya apunta a producción; falta dejar una página que
   monte calendario nuevo y legacy lado a lado con la misma compañía, para comparar velocidad
   percibida sin discutirlo en abstracto.
6. **Cerrar los drafts viejos.** PRs #189, #190 y #191 quedaron como referencia histórica; se
   cierran cuando `feature/react-sdk-v2` los reemplace formalmente.

## 4. Cómo verlo corriendo

```sh
cd packages/react-sdk
npm install
npm run dev     # index.html, datos mock, para iterar diseño
```

Para datos reales, `live.html` se conecta a producción usando variables de entorno
(`VITE_GAFA_FIT_URL`, `VITE_GAFA_COMPANY_ID`, `VITE_GAFA_API_CLIENT`, `VITE_GAFA_API_SECRET`,
`VITE_GAFA_CAPTCHA_PUBLIC_KEY`). Nunca se commitean esos valores.

## 5. Cosas que dependen de gafa.fit, no de este repo

Se documentan aquí porque bloquean o condicionan el SDK, pero se arreglan en el otro repo:

- `location/{id}/meetings` responde 500 si faltan `only_actives=true` y `reducePopulation=true`
  en el query string. El SDK ya los manda siempre, pero el default del controller está mal.
- El costo de la API por semana (~1.5–2.3 s por sede) es el techo real de velocidad. Bajarlo
  requiere trabajo de queries/cache en gafa.fit; ningún cambio de front lo compensa.
- `GET /api/brand` devuelve `gafapay_client_secret` y `webhook_password` en texto plano sin auth.
- El registro manda la secret key de reCAPTCHA desde el navegador porque `App\Rules\Captcha` la
  espera en el request.
