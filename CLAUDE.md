# CLAUDE.md — GFtheme

Contexto para el agente de IA. **Convención del equipo:** la IA debe leer este archivo (y el `CLAUDE.md` raíz del workspace) al inicio de cada conversación. Es **documentación viva: actualízalo POR TU CUENTA, sin que te lo pidan** — agrega lo que descubras (convenciones, detalles a cuidar, endpoints, esquema, infra), **corrige lo que ya no sea cierto** y borra lo obsoleto, en el momento, dejando el cambio listo para commitear y avisándole al usuario. Nunca escribas secretos (solo nombres de variables).

## Ecosistema Buq
GFtheme es la **capa visual embebible** del producto Buq (ver mapa en el `CLAUDE.md` raíz del entorno). Es un SDK React que se inyecta en sitios de partners y **consume la API de gafa.fit** (el núcleo) para mostrar reservas, catálogos, login y compras. No tiene backend propio ni BD: todo dato viene de gafa.fit; los pagos front se hacen contra Conekta (externo) y el flujo de compra vía el SDK de gafa.fit.

## ⚡ Rewrite en curso: GFTheme React SDK moderno (ago-2026)
Hay una iniciativa activa para reemplazar el theme legacy (Webpack4/Babel6/React16, un solo bundle) por un SDK moderno mobile-first, **en paralelo dentro de este mismo repo** (no en un repo nuevo) — se descubrió y confirmó esto el 2026-08-05 tras revisar exploración previa ya hecha vía Cursor Cloud agent.

- **Dónde vive:** `packages/react-sdk/` (monorepo simple, no afecta `src/`/`dist/` del theme legacy).
- **Rama de trabajo activa:** `v2/main`. Es la rama durable del SDK v2. Las `cursor/*` (account-mobile-nav, checkout, cdn, environments, etc.) son históricas: se trabaja encima de `v2/main`. **`master` no se toca** — sigue siendo el theme legacy de producción.
- **Historial de la exploración previa (referencia, no borrar):**
  - PR [#189](https://github.com/GafaMX/GFtheme/pull/189) `cursor/react-sdk-analysis-6468` — doc `docs/react-sdk-modernization.md` con el plan de arquitectura completo (bootstrap compatible con `data-gf-theme`, cliente API tipado, theming por tokens/CSS vars, templates editables, TanStack Query + Zustand + Zod, orden de construcción: calendario → catálogo → auth/perfil → checkout).
  - PR [#190](https://github.com/GafaMX/GFtheme/pull/190) `cursor/react-sdk-foundation-6468` — primer código real (ver estado abajo).
  - PR [#191](https://github.com/GafaMX/GFtheme/pull/191) `cursor/setup-dev-environment-3f37` — confirma que el entorno corre limpio en Node 22 (`npm install` + `npm run dev`/`build` del paquete `react-sdk`, sin workarounds).
  - Las 3 son drafts abiertos desde abril/jul-2026, nunca mergeados. Cerrarlos cuando `feature/react-sdk-v2` los reemplace formalmente.
- **Stack del SDK nuevo:** Vite + TypeScript + React 19 + TanStack Query (data) + Zustand (estado UI) + Zod (validación de `data-gf-options`).
- **Dos builds Vite, no mezclarlos:**
  - `vite.config.ts` — librería ES+UMD con `react`/`react-dom` **externos** (para apps que ya tienen React). **No** se pega en WordPress.
  - `vite.embed.config.ts` — IIFE `gafa-sdk.js` con React **dentro**, drop-in como el theme v1. Es el artefacto que se lanza a socios. Receta: `docs/v2-lanzamiento.md`.
- **No copiar `packages/react-sdk/src` a Replit** (`lib/gafa-react-sdk`). Relanzar Replit reinicia toda la app multi-sitio; V2 se actualiza reemplazando `docs/v2-sdk/gafa-sdk.js`. Replit se queda para sitios que no son V2.
- **Cómo correr el preview local:**
  ```bash
  cd packages/react-sdk
  npm install
  npm run dev            # Vite en :5173 (o el puerto libre), demo en index.html con useMockClient:true
  npm test && npm run typecheck
  npm run publish:embed  # IIFE → ../../docs/v2-sdk/gafa-sdk.js (lo que se pega en WP)
  ```
  El `index.html`/`main.tsx` del paquete montan los 4 widgets con datos mock (`createGafaSdk(..., { useMockClient: true })`) — útil para iterar diseño sin depender de gafa.fit. Para conectar a datos reales hay que resolver el punto de "cliente real" de abajo.
- **Estado real por widget (verificado corriendo el preview, no solo leyendo código):**
  | Widget | Estado | Notas |
  |---|---|---|
  | `CalendarWidget.tsx` (655 líneas) | ✅ Funcional | Filtros brand/location/service/staff, agrupación por día, estados sold-out, modal `ReservationPreviewModal` de 3 pasos (confirmar → login → crédito/compra). "Continuar reserva" abre `FancyOverlay` real. |
  | `FancyOverlay.tsx` | ✅ Funcional (2026-08-05) | Contenedor moderno del checkout `[data-gf-theme="fancy"]`, usado por `CalendarWidget` y `PurchaseButtonWidget`. Ver detalle abajo. |
  | `PurchaseButtonWidget.tsx` | ✅ Funcional (2026-08-05) | "Comprar" llama a `client.openCheckout` con el payload real (combo/membership/product/store) y abre `FancyOverlay`. Requiere `brandSlug` explícito como prop (a diferencia del legacy, que lo resolvía de un `GlobalStorage` global). |
  | `AuthWidget.tsx` | ✅ Funcional (2026-08-05) | Login/Registro/Password con forms controlados, submit real y errores del server tal cual (no genéricos). Login guarda el token (ver `tokenStorage.ts`). Aún no intercepta `NotAuthenticatedError` de `FancyOverlay` para mostrarse inline (queda pendiente, es una mejora de UX, no bloquea nada). |
  | `CatalogWidget.tsx` | 🚧 Cascarón | Tarjeta de paquete estática, botón "Comprar" sin lógica. |
  | `ProfileWidget.tsx` | ✅ Funcional (2026-08-10) | Tabs de próximas reservas / créditos y membresías / compras, cancelar reserva, cerrar sesión. Ver detalle abajo. El bug de CSS de "creditos"/"reservas" pegados desapareció: venía de `.gafa-profile-stats`, una clase que se usaba en el JSX pero **nunca existió en `widgets.css`**; el rewrite la eliminó. |
- **Perfil — RESUELTO (2026-08-10):** `ProfileWidget.tsx` consume datos reales vía `httpGafaClient`. Endpoints (sacados del bundle real de `GafaFitSDK`, no adivinados): `GET /api/me`, `/api/me/brand/{slug}/credits`, `/api/me/brand/{slug}/memberships`, `/api/me/brand/{slug}/reservation-future` (y `-past`), `/api/me/brand/{slug}/purchases`, `POST /api/me/brand/{slug}/reservation-future/{id}/cancel`. Todos exigen `Authorization: Bearer`.
  - **Detalle no obvio de la API:** `reservation-future` **no devuelve una lista plana** de reservas, sino grupos `{reservations: [], waitlists: []}` que hay que aplanar. Y la diferencia entre "pagado con crédito" y "pagado con membresía" no es un campo propio: el legacy la deduce de `credit === null`. Ambas cosas ya las maneja `httpGafaClient.ts`.
  - **Widgets en roots separados:** cada `mount*` crea su propio React root, así que el login del `AuthWidget` no llegaba al `ProfileWidget` por contexto. Se resolvió con un evento de ventana (`gafa-sdk:auth-changed`) que `tokenStorage.ts` emite al guardar/borrar el token, y al que `ProfileWidget` se suscribe para invalidar sus queries. También escucha `storage` para cubrir otra pestaña.
  - **Falta probarlo con sesión real:** verificado el estado sin sesión contra producción y todos los tabs con el cliente mock; los endpoints responden 401 (no 404), lo que confirma las rutas. Falta una cuenta de prueba con reservas/créditos para validar los shapes en vivo.
- **Fancy/checkout — RESUELTO (2026-08-05):** `FancyOverlay.tsx` reemplaza el overlay legacy (`PurchaseButton.js`), que tenía polling infinito (`setTimeout(getFancy, 1000)` sin límite si el SDK externo nunca inyectaba contenido) y delays de 400ms hardcodeados. La versión nueva espera con `MutationObserver` + timeout explícito de 8s, y solo controla el contenedor/estados — el formulario de pago real lo sigue inyectando el SDK externo de gafa.fit/GAFApay (fuera del control de este repo, confirmado con el equipo/código de gafa.fit).
  - **Gotcha de React StrictMode + efectos async (dejar documentado, se va a repetir):** un patrón común de cancelación es `let cancelled = false; useEffect(() => { ...; return () => { cancelled = true } }, [])` y chequear `cancelled` dentro de los `.then()`. Esto **se rompe bajo StrictMode** cuando el efecto dispara un side effect real no-idempotente: React hace mount→cleanup→mount **sincrónicamente** en dev, así que el cleanup (que pone `cancelled = true`) corre *antes* de que la promesa real se resuelva — el resultado (éxito o error) se descarta en silencio y la UI se queda pegada en el estado de "cargando" para siempre. Fix aplicado en `FancyOverlay.tsx`: un `startedRef` (no un flag `cancelled`) evita la segunda llamada real al side effect; no hace falta más porque React ya ignora `setState` en un unmount de verdad.
  - `legacyGafaFitAdapter.ts`: `GafaFitSDK.GetMe` (del script externo) **nunca invoca su callback si no hay sesión** — se queda colgado en vez de fallar. Se agregó un guard con `sdk.isAuthentified()` (síncrono) antes de tocar `GetMe`/`GetCreateReservationForm`: si no hay sesión, lanza `NotAuthenticatedError` (clase exportada) de inmediato. Es el gancho para que `AuthWidget` lo intercepte y muestre login inline en vez de un error genérico.
- **Cliente de datos — RESUELTO (2026-08-05):** `httpGafaClient.ts` pega directo a `routes/api.php` de gafa.fit con `fetch()`, sin pasar por `window.GafaFitSDK`. Cubre `listBrands/listLocations/listStaff/listServices/listCombos/listMemberships/listMeetings` — todos son endpoints **públicos** (solo requieren el header `GAFAFIT-COMPANY: <companyId>`, sin OAuth) bajo el prefijo `brand/{slug}/...`. Solo `openCheckout`/`openReservationCheckout` (el "fancy") siguen sin implementar directo: si `window.GafaFitSDK` está cargado, se delega ahí (`legacyGafaFitAdapter.ts`); si no, lanzan error explícito. `runtime.tsx#createClient` ya usa este cliente por default (antes usaba mocks o el adaptador legacy).
- **Auth (login/registro/password) — RESUELTO (2026-08-05):** `httpGafaClient.ts` implementa `login/register/requestPasswordReset/resetPassword/getProfile/logout` directo, **ya no delega a `window.GafaFitSDK` para nada de esto** (a diferencia del gap original). Contrato exacto (no adivinado, sacado del código fuente real del SDK legacy que vive en `gafa.fit/resources/assets/js/sdk/{GafaFitSDK,GafaFitRequests}.js`, `1413`+`153` líneas):
  - Login: `POST /oauth/token` (form-urlencoded, `Accept: application/json`) con `{grant_type: 'password', client_id, client_secret, username, password, scope: '*'}` → `{access_token}`.
  - Registro: `POST /api/register` con `{username(email), password, password_confirmation, first_name, last_name?, birth_date?, gender?, 'g-recaptcha-response', captcha_secret_key, remote_addr}` → `{url}` (no da token; el usuario debe verificar su correo antes de poder loguearse).
  - Password: `POST /api/password/email` (`{email, return_url}`) y `POST /api/password/reset` (`{email, password, password_confirmation, token}`).
  - Perfil: `GET /api/me` con header `Authorization: Bearer <token>`.
  - Los errores 422 del server se propagan tal cual a la UI (`GafaApiError`), no un mensaje genérico.
  - **Detalle de seguridad heredado de gafa.fit (no es de este SDK, ya lo hace el legacy):** el registro manda `captcha_secret_key` — la SECRET key real de reCAPTCHA — desde el navegador, porque `App\Rules\Captcha` la usa para verificar contra Google en el server en lugar de tenerla ya guardada del lado del servidor. Es un patrón inseguro preexistente en gafa.fit (cualquiera que inspeccione el tráfico puede verla); no se solucionó aquí porque implica cambiar `Brand\BrandApiController`/`App\Rules\Captcha` en el repo de gafa.fit, fuera de scope de GFtheme.
  - **Token compartido con el resto del ecosistema:** el `access_token` se guarda en `localStorage['gafafitSDKAutorization']`, cifrado con AES usando la misma key hardcodeada (`z9kFLKUk@5SF8FD*J*Lz`) que ya usa `GafaFitRequests.js` — así una sesión iniciada con el SDK nuevo la reconoce el theme legacy y el WebView SSO de `buq-app` en la misma página/sesión, y viceversa. Ver `tokenStorage.ts`.
  - **CaptchaProvider** (`src/sdk/captcha/CaptchaProvider.ts`): reCAPTCHA v3 default (el único que gafa.fit valida hoy) + Turnstile detrás del mismo contrato (`execute(action): Promise<string>`) — cambiar de proveedor en config **no basta solo**, gafa.fit también necesitaría agregar verificación de Turnstile en el backend.
  - **No probado en vivo con credenciales reales:** no hay una reCAPTCHA site key para la compañía de prueba (no vive en la BD — se configura fuera de gafa.fit, hay que pedirla/crearla en la consola de Google). Sí se verificó login/password-recovery con datos deliberadamente inválidos (errores reales del server, sin efectos secundarios) y que el registro se bloquea en el cliente sin captcha configurado, sin llegar a crear ninguna cuenta.
  - **Detalle no obvio de la API:** las rutas de `location`/`meetings` van anidadas bajo `brand/{slug}/...` aunque el router de `api.php` no lo deje claro a primera vista por el nesting de `Route::group`. Y `location/{id}/meetings` **tira 500 si faltan `only_actives=true` y `reducePopulation=true`** en el query string (parámetros opcionales que el controller no valida con default antes de pasarlos a `LibCalendar` — bug menor de gafa.fit, no del SDK nuevo). Ya lo maneja `httpGafaClient.ts`.
  - **Hallazgo de seguridad (fuera de scope, no tocado):** `GET /api/brand` y `/api/brand/{slug}` devuelven `gafapay_client_secret` y `webhook_password` en texto plano dentro del JSON público, sin auth. Es un problema de `gafa.fit` (`Brand\BrandApiController`), no de GFtheme — reportar aparte.
- **reCAPTCHA:** se decidió una abstracción `CaptchaProvider` (interfaz común) con reCAPTCHA v3 como default y Cloudflare Turnstile como alternativa detrás del mismo contrato — así cambiar de proveedor es config, no migración de código. Aún no implementado (llega con `AuthWidget`).
- **Orden de construcción acordado:** 1) ~~Calendario~~ → 2) ~~Fancy/checkout~~ → 3) ~~Login/Registro (+ reCAPTCHA)~~ (los tres con flujo real) → 4) Perfil → 5) Paquetes/membresías (lo que menos se usa hoy; construir y solo registrar su ID).
- **Sitio de prueba local conectado a producción — LISTO:** `packages/react-sdk/live.html` + `src/main.live.tsx`, credenciales en `packages/react-sdk/.env.local` (gitignored, nunca commitear). Compañía de prueba real: `COMPANY_ID=143` (brand "Buq", slug `buq-1`, location "CDMX" id `235`), `GAFA_FIT_URL=https://buq.partners`. Pagos de esa marca en Stripe test mode. Correr con `npm run dev -- --port <libre>` y abrir `/live.html`.
- **Tres backends de Buq (ago-2026):** production `buq.partners` (default, lanzamiento), staging `buq.com.mx` (Stripe nuevo + Laravel listo para subir), development `buq.technology`. Se cambian con `BUQ_ENV` / `environment` / `GAFA_FIT_URL` / `?buq-env=staging`. GafaPayFront se deduce del entorno; se pisa con `GAFAPAY_FRONT_URL`. Tokens de staging/dev van a otra key de localStorage para no desloguear producción en el mismo dominio. Embed WordPress: `npm run publish:embed` → `docs/v2-sdk/gafa-sdk.js`. `[data-gafa-v2]` es alias de `[data-gf-theme]` para páginas que aún cargan el v1.

## Correr localmente (theme legacy) ✅ (verificado jul-2026, Node v25)
Solo necesita Node + npm. **Build probado OK con Node v25** (Webpack 4 no dio problemas de OpenSSL).
```bash
npm install          # ⚠️ reporta ~64 vulnerabilidades (deps viejas de webpack4/react16); NO correr `audit fix --force` (rompe el build)
npm start            # webpack-dev-server con hot-reload en http://localhost:8080 (abre src/index.html de prueba)
npm run build        # producción → dist/main.min.js (~1.3 MiB)
```
**Detalle a cuidar:** `dist/main.min.js` está **commiteado en git** (así se sirve por CDN), así que cada `build` lo modifica → revisa/commitea ese cambio conscientemente. Para probar componentes, edita `src/index.html` con distintos `data-gf-theme` / `data-gf-options`.

> ⚠️ **`src/index.html` está en `.gitignore`** (es el archivo de pruebas local de cada dev) → **no existe en un clon fresco ni en este snapshot**, y `webpack.config.js` lo usa como `template` de `HtmlWebPackPlugin`. Sin él, **tanto `npm start` como `npm run build` truenan** con `Entry module not found: ... can't resolve '.../src/index.html'`. Hay que crearlo a mano antes del primer build (contenido mínimo: un `<script data-gf-options>` con `GAFA_FIT_URL/COMPANY_ID/API_CLIENT/API_SECRET` + secciones `<section data-gf-theme="...">` de los componentes a probar).

## 1. Descripción / propósito
SDK visual (~34k LOC) que renderiza componentes React pre-construidos dentro de contenedores HTML marcados con `data-gf-theme`. Permite a terceros integrar la funcionalidad de gafa.fit (reservas, perfiles, membresías, calendario de clases) en cualquier sitio sin desarrollarla desde cero. Se distribuye como un único bundle JS servido por CDN.

## 2. Stack y build (theme legacy)
- **Bundler:** Webpack 4 (`webpack.config.js`) · **Transpilador:** Babel 6 (preset-env, preset-react, transform-runtime)
- **UI:** React 16.8 + ReactDOM · react-bootstrap 0.32 · react-select · react-calendar · react-slick · react-spring
- **Estilos:** SCSS (Sass 1.82) + Bootstrap 4.1 (remasterizado en `thirdParties/`)
- **Utils:** moment, cleave.js, popper.js
- **Output:** `dist/main.min.js` (bundle único). Conekta se externaliza (`window.Conekta`).
- **Sin CI/CD** en el repo: deploy por push a `master` + refresh de CDN (`dev.gafa.codes/GFtheme/dist/` / `gafa.fit/sdk/dist/`).

## 3. Estructura de carpetas
```
src/
├── app.js                     Entry point: initValues() del wrapper + render de componentes por data-gf-theme
├── components/
│   ├── GafaThemeSDK.js        Clase central: expone renderLogin(), renderComboList(), renderCalendar(), ...
│   ├── auth/                  Login, Register, PasswordRecovery/Change/Forgot
│   ├── calendar/               Calendar (horizontal/vertical, filtrable por brand/location/staff/service/room)
│   ├── combo/  membership/    Listas de paquetes de créditos y membresías
│   ├── service/  staff/       Listas de servicios y staff
│   ├── profile/               Perfil con tabs (clases futuras, compras, créditos, datos) + Payment/
│   ├── menu/                  LoginRegister (modal combinado) — variantes default/ y prowess/
│   ├── purchase_button/       PurchaseButton → dispara overlay "fancy" (checkout)
│   ├── store/GlobalStorage.js State management custom (NO Redux)
│   └── utils/                 GafaFitSDKWrapper (API), FormatUtils, Strings/ (ES/EN i18n), Icons/, Pagination
└── styles/
    ├── default/               Sistema ANTIGUO (Bootstrap vanilla + overrides) — legacy/fallback
    └── newlook/               Sistema ACTUAL. base/variables.scss = punto único de config (mixins, prefijo)
        ├── elements/          GFSDK-e-*.scss (buttons, forms, meetings, modals, ...)
        ├── components/        GFSDK-c-*.scss (Calendar, Login, Profile, Payment, ...)
        └── thirdParties/      Bootstrap 4 remasterizado

packages/
└── react-sdk/                 SDK nuevo (ver sección "Rewrite en curso" arriba) — Vite + TS + React 19
```

## 4. Cómo se consume / integra (theme legacy)
El sitio host incluye el bundle y declara opciones + contenedores:
```html
<script src="https://gafa.fit/sdk/dist/main.js"></script>
<script data-gf-options type="application/json">
  { "GAFA_FIT_URL": "...", "COMPANY_ID": 1, "API_CLIENT": "...", "API_SECRET": "..." }
</script>
<section data-gf-theme="login-register"></section>
<section data-gf-theme="combo-list"></section>
<section data-gf-theme="meetings-calendar"></section>
```
`app.js` lee `data-gf-options` (→ `window.GFThemeOptions`), corre `GafaFitSDKWrapper.initValues()` (carga brands/locations/rooms desde la API de gafa.fit autenticándose con `API_CLIENT/API_SECRET`) y hace `React.render()` en cada contenedor según su `data-gf-theme`.

## 5. Convenciones
- **CSS:** ITCSS + BEM con prefijo global `GFSDK` (definido en `newlook/base/variables.scss`). Formato: `.GFSDK-[c|e]-Componente__elemento--modificador` (`c`=components, `e`=elements). Parciales SCSS con prefijo `_`.
- **Dos temas visuales:** `default` (estándar gafa.fit) y `prowess` (brand alterno) — hay componentes/estilos paralelos.
- **JS:** componentes React como clases ES6; store propio `GlobalStorage`; API vía `GafaFitSDKWrapper` (métodos estáticos); i18n con `Strings_ES.js`/`Strings_EN.js`. Sin TypeScript.
- **Atributos HTML:** `data-gf-theme` (selector de componente), `data-gf-options` (config JSON), `data-gf-*`/`data-bq-*` (opciones por componente).

## 6. Comandos útiles
```bash
npm install
npm start        # webpack-dev-server con hot-reload (localhost:8080), usa src/index.html de prueba
npm run watch    # compila en watch sin servidor
npm run dev      # build development
npm run build    # build production minificado → dist/main.min.js
```
Pruebas manuales: editar `src/index.html` con distintos `data-gf-theme` y `data-gf-options`.

## 7. Config / variables SCSS
`src/styles/newlook/base/variables.scss` centraliza: prefijo `$pre: GFSDK`, mixins (`transition`, `cleanStyles`, `titleFont`, `subtitleFont`, `paragraphFont`), keyframes. Tipografía: **DM Sans** (Google Fonts, pesos 400/500/700). Breakpoints Bootstrap 4 (sm576/md768/lg992/xl1200). Acento amarillo `#F2C545` + escala de grises.

## 8. Componentes principales (por `data-gf-theme`)
`login` · `register` · `password-recovery` · `login-register` (modal) · `combo-list` · `membership-list` · `staff-list` · `service-list` · `meetings-calendar` · `profile-info` · `purchase-button` · `fancy` (overlay de checkout). Extras: i18n ES/EN, responsive, paginación, filtros dinámicos en el calendario.

## 9. CI/CD
- **Theme legacy:** sigue sin pipeline. Deploy: push a `master` + el `dist/main.min.js` commiteado / CDN Azure (`buq-sdk.azurewebsites.net`).
- **SDK V2:** workflow manual `.github/workflows/publish-v2-sdk.yml` (`workflow_dispatch`) y el mismo comando en el agente: `npm run publish:embed`. Publica `docs/v2-sdk/gafa-sdk.js`. Detalle operativo: `docs/v2-lanzamiento.md`. **No** dispara un relanzamiento de Replit.

## Reglas especiales para la IA
- **Nunca** hardcodear `API_CLIENT/API_SECRET`, keys de reCAPTCHA ni de Conekta: vienen de `data-gf-options` en el host (legacy) o de config inyectada (SDK nuevo).
- **Nunca** mostrarle al socio el *tipo* de crédito (`credit.name`, ej. `CDMXnew`): es gestión interna del estudio. Lo que se enseña es el **paquete** comprado o la **membresía** — ver `docs/creditos-vs-paquetes.md`.
- Legacy: preferir el sistema **`newlook/`**; `default/` es legacy del legacy (no ampliar salvo mantenimiento). El SDK nuevo (`packages/react-sdk/`) no usa SCSS con prefijo GFSDK — usa CSS variables por theme tokens (ver sección "Rewrite en curso").
- Cualquier campo/endpoint nuevo que se consuma debe existir en la API de gafa.fit (coordinar con ese repo).
- **`master` es producción** — todo el trabajo del rewrite va en `feature/react-sdk-v2` (o ramas hijas), PR + review humano antes de mergear.
- **No relanzar Replit para publicar V2.** El artefacto es `docs/v2-sdk/gafa-sdk.js` (`npm run publish:embed`). Pedir a Replit que copie el source reinicia todos los sitios, no solo V2.
