# Embed V2 en staging

`index.html` usa el contrato de `docs/v2-sdk/snippet.html`: JSON `data-gf-options`,
login `data-gf-theme="login-register"`, botones `data-gf-buy` y un script clásico.
No usa el cliente mock ni `safeTestMode`. Ese modo separado bloquea todos los
cobros y solo permite lecturas/login de producción; no sirve para probar pagos reales de staging.

Abrir la página mediante HTTP(S), rellenar credenciales de staging y usar
`?membership=ID&package=ID&brand=slug` (ambos productos son opcionales).
La configuración se guarda en localStorage; el secreto solo si se marca la casilla.
La página fija las tres URLs y rechaza queries de otro entorno.

| Entorno | Front | API de pagos | IIFE Stripe |
| --- | --- | --- | --- |
| production (sin cambios) | `https://frontpay.buq.partners/main.js` | `https://apipay.buq.partners` | `https://buq.partners/js/payments/stripe-payment.iife.js` |
| staging | `https://gafapay-front-dev.azurewebsites.net/prodbuild/main.js` | `https://gafapay-api-gafapay-api-test.azurewebsites.net` | `https://buq.com.mx/js/payments/stripe-payment.iife.js` |
| development (histórico) | Igual que production | Igual que production | Igual que production |

Development conserva endpoints históricos porque no se proporcionaron equivalentes de dev.
Staging usa el build de producción de GAFAPayFront #32 (`/prodbuild/main.js`),
configurado para la API de staging; development conserva su ruta `/main.js`.
La guarda bloquea sus pagos hasta sobrescribir **las tres** URLs con destinos seguros.
Las opciones de página son `GAFAPAY_FRONT_URL`, `GAFAPAY_API_URL`,
`STRIPE_PAYMENT_SCRIPT_URL` o `gafaPayFrontUrl`, `gafaPayApiUrl`,
`stripePaymentScriptUrl` en config. Las opciones explícitas ganan al entorno;
si apuntan a producción en staging/dev, se muestra `PAY_FORM_LOAD_ERROR` y se
registra en consola la clave/host bloqueado, sin credenciales.
`?buq-env=staging` selecciona los tres defaults de pago y Laravel de staging.
Con `BUQ_ENV=staging` o `development`, un `GAFA_FIT_URL` explícito de producción
se rechaza al resolver la configuración, antes de crear clientes o hacer peticiones.
La misma validación protege `HUB_URL`. La clasificación compartida usa el hostname
completo, incluyendo `buq.partners`, `gafa.fit`, sus subdominios y los hosts legacy
`gafapay-api.azurewebsites.net` y `gafapay-front.azurewebsites.net`.

En producción, sin los nuevos overrides de página, no se llaman los setters de API
ni de IIFE Stripe: se conserva la precedencia del bridge, incluidos setters manuales,
`window.GAFAPAY_API_URL` y defaults. Los nuevos campos de config quedan opcionales
en producción para no convertir un default en override al volver a parsear el embed.
`GAFA_FIT_URL` conserva su path, también con `?buq-env=production`.
El setter histórico `setGafaPayApiUrl(...)` y el `apiUrl` histórico por llamada
conservan sus efectos anteriores: no publican una API en el global ni en el JSON
de frontpay en producción. Solo la nueva opción de página/config activa ese efecto.

No se amplió `HUB_REMOTE_CONFIG_KEYS`: las opciones nuevas solo vienen de la
página. El Hub ya podía mandar entorno, GAFA_FIT_URL y front; la página de prueba
los fija explícitamente. En otras integraciones, un front de producción heredado
del Hub causa bloqueo en staging/dev; hay que corregirlo o fijarlo en la página.
Un Laravel de producción heredado del Hub también bloquea el arranque de staging/dev.
El entorno no productivo deducido de la página/query se conserva antes del merge:
el Hub no puede convertirlo a producción aunque la página solo declare `GAFA_FIT_URL`.
En staging, el API se entrega a Stripe mediante `api-url` y a frontpay mediante
`window.GAFAPAY_API_URL` y el JSON `data-gafapay-config`, antes de evaluar su JS.
Los proveedores son globales: cambiar endpoints después de cargarlos o reutilizar
un proveedor precargado de origen desconocido en staging/dev requiere una página limpia.
Los overrides seguros por llamada quedan asociados al runtime cargado y se conservan
al montar y actualizar; un cambio posterior de configuración se rechaza antes de renderizar.
Cada proveedor registra su script efectivo por separado y ambos comparten la validación
de API. Cargar Stripe con un script alternativo seguro permite cargar después Recurrente
o frontpay para matrícula; cambiar el script de un proveedor ya cargado sigue bloqueado.

`scripts/publish-v2-embed-staging.sh` prepara artefactos locales con el mismo
`npm run build:embed`: bundle estampado, bundle estable, loader, CSS si existe y
`VERSION.txt`, únicamente bajo `docs/v2-sdk-staging/`. No hace commit/push/deploy.
El loader es una copia aislada del de producción, con rama `staging-live`, rutas
de staging y clave de caché de SHA separada. No tiene fallback a `cdn-live`.
La página depende de que esos artefactos se publiquen en `staging-live` por separado.

Pendiente de validación operativa: disponibilidad/CORS de Azure y del IIFE de staging,
credenciales test de la marca y configuración test de Stripe/PayPal/Recurrente en los
servicios externos. La guarda valida los destinos que configura el SDK; no puede
auditar llamadas internas ni redirecciones de bundles de terceros.
