# Propuesta para GFTheme React SDK

Este documento resume el analisis del SDK actual y define una base tecnica para construir una nueva version moderna, mobile-first y configurable por marca para gafa.fit, gafa.pay y otros sistemas Laravel conectados.

## 1. Lectura del SDK actual

GFTheme ya usa React, pero funciona como un script embebible legado:

- Punto de entrada: `src/app.js`.
- Build: Webpack 4 + Babel 6 + React 16 en un unico bundle `dist/main.min.js`.
- Integracion publica: el cliente inserta contenedores HTML con `data-gf-theme`.
- Configuracion: un bloque JSON en `<script data-gf-options type="application/json">`.
- API: llamadas a un objeto global `GafaFitSDK` cargado por otro script.
- Checkout/reserva: se delega a `GafaFitSDK.GetCreateReservationForm(...)` y se inyecta en `[data-gf-theme="fancy"]`.
- Estado: singletons mutables (`GlobalStorage`, `CalendarStorage`) con listeners manuales.
- Estilos: SCSS global con prefijos `GFSDK-*`, Bootstrap 4 parcial y resets que pueden afectar al sitio host.

### Shortcodes publicos detectados

| `data-gf-theme` | Funcion actual |
| --- | --- |
| `login` | Login |
| `register` | Registro |
| `password-recovery` | Recuperacion de password |
| `profile-info` | Perfil del usuario |
| `login-register` | Menu/modal de login, registro y perfil |
| `login-register-pages` | Flujo de auth por paginas |
| `staff-list` | Lista de staff |
| `service-list` | Lista de servicios |
| `combo-list` | Lista de paquetes |
| `membership-list` | Lista de membresias |
| `meetings-calendar` | Calendario de clases/servicios |
| `purchase-button` | Boton externo que abre compra |
| `fancy` | Contenedor del checkout/reserva generado por el SDK externo |

Tambien hay atributos relevantes como `data-gf-filterbyname`, `data-buq-brand`, `filter-bq-service`, `filter-bq-location`, `filter-bq-staff`, `filter-bq-room`, `data-bq-calendar-visualization`, `data-bq-partial-loading`, `data-bq-show-description`, `data-gf-initial`, `data-bq-preloading` y `data-bq-combine-waitlist`.

## 2. Problemas principales a resolver

1. **Contrato implicito con APIs globales.** El SDK depende de `window.GafaFitSDK`, `window.GFtheme`, `window.GFThemeOptions`, `Conekta` y reCAPTCHA sin tipado ni validacion formal.
2. **Configuracion insegura para secretos.** El README pide `API_SECRET` en el navegador. La nueva version deberia usar tokens publicos o un backend proxy cuando haya secretos reales.
3. **Estado global fragil.** `GlobalStorage` y `CalendarStorage` mezclan cache, estado de UI y datos de usuario; esto complica invalidaciones, multi-marca y multiples widgets en una pagina.
4. **Estilos globales.** Reset global, Bootstrap y clases compartidas aumentan el riesgo de romper el sitio donde se embebe el SDK.
5. **Bundle antiguo.** React 16, Babel 6 y Webpack 4 dificultan performance, tree-shaking, DX y pruebas.
6. **Compatibilidad incompleta.** `locations-filter` esta documentado pero no montado; `renderProfileUserInfo` usa una variable `domContainer` fuera de scope; `renderPurchaseBtton` tiene typo en el nombre interno.

## 3. Objetivo del nuevo SDK

Construir un SDK React moderno que permita:

- Mostrar calendario de reservas de servicios/clases.
- Comprar paquetes, productos y membresias.
- Login, registro, recuperacion y cambio de password.
- Perfil, creditos, membresias, proximas clases, historial y metodos de pago.
- Templates editables por vista.
- Branding simple por cliente: colores, tipografias, logos, fondos, radios, sombras y tono visual.
- Mobile-first real, con experiencia optimizada para pantallas pequenas.
- Integracion limpia con gafa.fit, gafa.pay y sitios Laravel.
- Compatibilidad progresiva con los `data-gf-theme` actuales para migrar clientes existentes sin big bang.

## 4. Arquitectura propuesta

### 4.1 Paquetes internos

```text
src/
  sdk/
    bootstrap/        # detecta contenedores, parsea config y monta React
    client/           # cliente HTTP tipado para gafa.fit/gafa.pay
    auth/             # sesion, token storage, guards
    theme/            # tokens, CSS variables, presets de marca
    templates/        # registro de templates por vista
    widgets/          # widgets embebibles publicos
    features/
      calendar/
      catalog/
      checkout/
      profile/
      auth/
    shared/
      ui/
      hooks/
      utils/
```

### 4.2 Bootstrap embebible

El nuevo SDK debe soportar dos modos:

1. **Modo compatible:** escanea `data-gf-theme` y monta cada widget como hoy.
2. **Modo programatico:** expone una API moderna.

```ts
import { createGafaSdk } from "@gafa/theme-sdk";

const sdk = createGafaSdk({
  apiBaseUrl: "https://...",
  companyId: 1,
  publicClientId: "...",
  brand: {
    id: 10,
    logoUrl: "https://...",
    colors: {
      primary: "#111827",
      accent: "#f97316",
      background: "#ffffff"
    }
  }
});

sdk.mountCalendar("#calendar", { template: "premium" });
sdk.mountAuth("#auth", { initialView: "login" });
```

### 4.3 Capa de datos

Recomendacion:

- **TanStack Query** para cache, loading/error states, refetch e invalidacion.
- **Zustand** o React Context pequeno para estado local de UI compartido, como filtros activos o checkout drawer.
- Cliente HTTP propio con tipos para:
  - marcas
  - ubicaciones
  - salones/rooms
  - staff
  - servicios
  - reuniones/clases
  - paquetes/combos
  - membresias
  - usuario/perfil
  - pagos
  - reservas

La capa `client/` debe poder trabajar contra APIs actuales o adaptadores Laravel futuros sin filtrar detalles al UI.

### 4.4 Theming y branding

Usar design tokens convertidos a CSS variables dentro de un scope controlado:

```ts
type GafaBrandTheme = {
  logoUrl?: string;
  colors: {
    primary: string;
    primaryText: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    mutedText: string;
    border: string;
    success: string;
    danger: string;
  };
  typography?: {
    fontFamily: string;
    headingFontFamily?: string;
  };
  radius?: {
    sm: string;
    md: string;
    lg: string;
    pill: string;
  };
  assets?: {
    heroBackgroundUrl?: string;
    loginBackgroundUrl?: string;
  };
};
```

Cada widget se renderizaria dentro de un contenedor scopeado:

```html
<section
  data-gf-theme="meetings-calendar"
  data-gf-brand-preset="studio-dark"
></section>
```

Con salida similar a:

```css
.gafa-sdk {
  --gafa-color-primary: #111827;
  --gafa-color-accent: #f97316;
  --gafa-radius-md: 14px;
}
```

Esto evita que cada cliente requiera CSS custom complejo para cambiar identidad visual.

### 4.5 Templates editables

El SDK deberia separar datos, comportamiento y presentacion mediante un registro de templates:

```ts
type TemplateRegistry = {
  calendar?: {
    meetingCard?: React.ComponentType<MeetingCardProps>;
    dayHeader?: React.ComponentType<DayHeaderProps>;
    emptyState?: React.ComponentType<EmptyStateProps>;
  };
  catalog?: {
    packageCard?: React.ComponentType<PackageCardProps>;
    membershipCard?: React.ComponentType<MembershipCardProps>;
  };
  profile?: {
    header?: React.ComponentType<ProfileHeaderProps>;
    creditCard?: React.ComponentType<UserCreditProps>;
  };
};
```

Niveles de personalizacion:

1. **Tokens:** colores, logo, fuentes, fondos, radios.
2. **Presets:** `default`, `boutique`, `fitness-dark`, `wellness-light`, etc.
3. **Slots:** reemplazar partes pequenas como cards, headers o empty states.
4. **Templates completos:** reemplazar vistas completas manteniendo hooks y contratos de datos.

## 5. Vistas iniciales recomendadas

### Calendario de reservas

- Mobile-first: lista vertical por dia como base.
- Desktop: opcion agenda, columnas por dia o grid semanal.
- Filtros: marca, ubicacion, staff, servicio, room, hora del dia.
- Estados claros: skeleton, vacio, error recuperable.
- Acciones: reservar, unirse a waitlist, cancelar, comprar antes de reservar si falta credito.

### Catalogo de paquetes y membresias

- Cards responsivas.
- Filtros por marca/nombre/categoria.
- Precio, vigencia, creditos, terminos y CTA visibles.
- Soporte para compra directa y checkout embebido.

### Auth

- Login.
- Registro.
- Recuperacion de password.
- Cambio de password.
- Validaciones accesibles.
- reCAPTCHA o proveedor anti-abuso encapsulado en adaptador.

### Perfil

- Datos personales.
- Creditos y membresias activas.
- Proximas reservas.
- Historial.
- Waitlist.
- Metodos de pago.
- Direcciones/contacto cuando aplique.

### Checkout/pagos

- Abstraccion para gafa.pay.
- Adaptadores para Conekta u otros proveedores.
- UI propia cuando sea posible; fallback compatible a `GetCreateReservationForm` si se necesita mantener flujo actual.

## 6. Compatibilidad de migracion

Mantener una capa `legacy-compat` que traduzca:

- `data-gf-theme` -> widget React moderno.
- atributos HTML -> props tipadas.
- `data-gf-options` -> configuracion validada.
- `fancy` -> checkout/reservation host.

Ejemplo:

```html
<script type="application/json" data-gf-options>
{
  "GAFA_FIT_URL": "https://example.com",
  "COMPANY_ID": 1,
  "API_CLIENT": "public-client",
  "BRAND_ID": 10,
  "THEME": {
    "preset": "boutique",
    "colors": {
      "primary": "#0f172a",
      "accent": "#ec4899"
    },
    "logoUrl": "https://example.com/logo.svg"
  }
}
</script>

<section
  data-gf-theme="meetings-calendar"
  filter-bq-location="true"
  filter-bq-service="true"
  data-bq-calendar-visualization="agenda"
></section>
```

## 7. Stack sugerido

- React 18+.
- TypeScript.
- Vite o tsup para library build.
- TanStack Query para datos.
- Zustand para estado UI compartido si hace falta.
- CSS variables + CSS Modules, Vanilla Extract o Tailwind con prefijo estricto.
- Vitest + Testing Library para componentes.
- Playwright para flujos embebidos criticos.
- Storybook para documentar templates y presets de marca.

## 8. Primeros entregables tecnicos

1. Crear el nuevo bootstrap compatible con `data-gf-theme`.
2. Definir `GafaSdkConfig` y validador de `data-gf-options`.
3. Crear cliente API tipado y adaptador temporal para `window.GafaFitSDK`.
4. Implementar sistema de theme tokens y presets.
5. Montar widgets base:
   - `AuthWidget`
   - `CalendarWidget`
   - `CatalogWidget`
   - `ProfileWidget`
   - `PurchaseButtonWidget`
6. Agregar Storybook con ejemplos de branding.
7. Agregar pruebas del mapeo legacy: atributos HTML -> props.

## 9. Decisiones abiertas

- Si el checkout debe seguir usando el `fancy` actual o moverse a una UI React propia.
- Como se autenticara el SDK sin exponer secretos de cliente en navegador.
- Si gafa.pay sera el proveedor unico de pagos o un adaptador entre varios proveedores.
- Que nivel de compatibilidad exacta se requiere para sitios ya integrados.
- Si conviene publicar como paquete npm, CDN bundle, o ambos.

## 10. Recomendacion de ruta

La ruta mas segura es construir el SDK nuevo como una libreria paralela con compatibilidad de montaje legado. Asi se puede migrar vista por vista:

1. Bootstrap + theme + cliente API.
2. Calendario nuevo, porque es la vista mas visible y mobile-first tiene mayor impacto.
3. Catalogo de paquetes/membresias.
4. Auth y perfil.
5. Checkout/pagos y cierre de compatibilidad con `fancy`.

Esta estrategia permite mejorar diseno, performance y configuracion sin romper de golpe los sitios actuales que ya usan GFTheme.
