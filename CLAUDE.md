# CLAUDE.md — GFtheme

Contexto para el agente de IA. **Convención del equipo:** la IA debe leer este archivo (y el `CLAUDE.md` raíz del workspace) al inicio de cada conversación. Es **documentación viva: actualízalo POR TU CUENTA, sin que te lo pidan** — agrega lo que descubras (convenciones, detalles a cuidar, endpoints, esquema, infra), **corrige lo que ya no sea cierto** y borra lo obsoleto, en el momento, dejando el cambio listo para commitear y avisándole al usuario. Nunca escribas secretos (solo nombres de variables).

## Ecosistema Buq
GFtheme es la **capa visual embebible** del producto Buq (ver mapa en el `CLAUDE.md` raíz del entorno). Es un SDK React que se inyecta en sitios de partners y **consume la API de gafa.fit** (el núcleo) para mostrar reservas, catálogos, login y compras. No tiene backend propio ni BD: todo dato viene de gafa.fit; los pagos front se hacen contra Conekta (externo) y el flujo de compra vía el SDK de gafa.fit.

## ⚡ Rewrite en curso: GFTheme React SDK moderno (ago-2026)
Hay una iniciativa activa para reemplazar el theme legacy (Webpack4/Babel6/React16, un solo bundle) por un SDK moderno mobile-first, **en paralelo dentro de este mismo repo** (no en un repo nuevo) — se descubrió y confirmó esto el 2026-08-05 tras revisar exploración previa ya hecha vía Cursor Cloud agent.

- **Dónde vive:** `packages/react-sdk/` (monorepo simple, no afecta `src/`/`dist/` del theme legacy).
- **Rama de trabajo activa:** `feature/react-sdk-v2` (partió de `cursor/react-sdk-foundation-6468`). **`master` no se toca** hasta que haya revisión humana.
- **Historial de la exploración previa (referencia, no borrar):**
  - PR [#189](https://github.com/GafaMX/GFtheme/pull/189) `cursor/react-sdk-analysis-6468` — doc `docs/react-sdk-modernization.md` con el plan de arquitectura completo (bootstrap compatible con `data-gf-theme`, cliente API tipado, theming por tokens/CSS vars, templates editables, TanStack Query + Zustand + Zod, orden de construcción: calendario → catálogo → auth/perfil → checkout).
  - PR [#190](https://github.com/GafaMX/GFtheme/pull/190) `cursor/react-sdk-foundation-6468` — primer código real (ver estado abajo).
  - PR [#191](https://github.com/GafaMX/GFtheme/pull/191) `cursor/setup-dev-environment-3f37` — confirma que el entorno corre limpio en Node 22 (`npm install` + `npm run dev`/`build` del paquete `react-sdk`, sin workarounds).
  - Las 3 son drafts abiertos desde abril/jul-2026, nunca mergeados. Cerrarlos cuando `feature/react-sdk-v2` los reemplace formalmente.
- **Stack del SDK nuevo:** Vite + TypeScript + React 19 + TanStack Query (data) + Zustand (estado UI) + Zod (validación de `data-gf-options`). Build: `packages/react-sdk/vite.config.ts` (lib mode, exporta ES+UMD, `react`/`react-dom` como peer externos).
- **Cómo correr el preview local:**
  ```bash
  cd packages/react-sdk
  npm install
  npm run dev     # Vite en :5173 (o el puerto libre), demo en index.html con useMockClient:true
  ```
  El `index.html`/`main.tsx` del paquete montan los 4 widgets con datos mock (`createGafaSdk(..., { useMockClient: true })`) — útil para iterar diseño sin depender de gafa.fit. Para conectar a datos reales hay que resolver el punto de "cliente real" de abajo.
- **Estado real por widget (verificado corriendo el preview, no solo leyendo código):**
  | Widget | Estado | Notas |
  |---|---|---|
  | `CalendarWidget.tsx` (655 líneas) | ✅ Funcional | Filtros brand/location/service/staff, agrupación por día, estados sold-out, modal `ReservationPreviewModal` con flujo de 3 pasos (confirmar → login → crédito/compra) conectado al contrato de checkout. Es la prioridad #1 del negocio y ya es la más avanzada. |
  | `AuthWidget.tsx` | 🚧 Cascarón | Tabs Login/Registro/Password cambian bien de vista y campos, pero sin submit, sin validación, sin reCAPTCHA. |
  | `CatalogWidget.tsx` | 🚧 Cascarón | Tarjeta de paquete estática, botón "Comprar" sin lógica. |
  | `ProfileWidget.tsx` | 🚧 Cascarón | Estático. Bug de CSS conocido: "creditos" y "reservas" se renderizan sin espacio entre sí (falta gap en `widgets.css`). |
- **Gap importante de arquitectura — cliente de datos:** `gafaClient.ts` (el "cliente moderno") **solo devuelve mocks**, no pega a ninguna API real. El único camino a datos reales hoy es `legacyGafaFitAdapter.ts`, que envuelve `window.GafaFitSDK` (callbacks → promesas) — o sea, sigue dependiendo del script legacy externo, no es un cliente HTTP directo a `routes/api.php` de gafa.fit. **Pendiente decidir:** construir un cliente HTTP tipado directo (OAuth Passport, sin pasar por `window.GafaFitSDK`) vs. seguir envolviendo el SDK legacy mientras se migra. El plan (#189) recomienda cliente propio.
- **reCAPTCHA:** se decidió una abstracción `CaptchaProvider` (interfaz común) con reCAPTCHA v3 como default y Cloudflare Turnstile como alternativa detrás del mismo contrato — así cambiar de proveedor es config, no migración de código. Aún no implementado (llega con `AuthWidget`).
- **Orden de construcción acordado:** 1) Calendario (ya avanzado) → 2) Fancy/checkout → 3) Login/Registro (+ reCAPTCHA) → 4) Perfil → 5) Paquetes/membresías (lo que menos se usa hoy; construir y solo registrar su ID).
- **Sitio de prueba local conectado a producción:** pendiente de credenciales (Company ID + `API_CLIENT`/`API_SECRET` de una marca/compañía de prueba, en `GAFA_FIT_URL` de producción `https://buq.partners`). Los pagos de esa marca usan Stripe en modo test, así que probar el flujo de compra no genera cargos reales.

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
No hay `.github/workflows/`. Deploy presumiblemente: push a `master` → build → subida del `dist/` al CDN (`gafa.fit/sdk/dist/`). *(Confirmar el mecanismo real del servidor/CDN al montar el pipeline.)*

## Reglas especiales para la IA
- **Nunca** hardcodear `API_CLIENT/API_SECRET`, keys de reCAPTCHA ni de Conekta: vienen de `data-gf-options` en el host (legacy) o de config inyectada (SDK nuevo).
- Legacy: preferir el sistema **`newlook/`**; `default/` es legacy del legacy (no ampliar salvo mantenimiento). El SDK nuevo (`packages/react-sdk/`) no usa SCSS con prefijo GFSDK — usa CSS variables por theme tokens (ver sección "Rewrite en curso").
- Cualquier campo/endpoint nuevo que se consuma debe existir en la API de gafa.fit (coordinar con ese repo).
- **`master` es producción** — todo el trabajo del rewrite va en `feature/react-sdk-v2` (o ramas hijas), PR + review humano antes de mergear.
