# Stripe Payment Element tras cambiar cantidad

## Resultado y alcance de la evidencia

Revisado en `pablo/stripe-remount-frame`, HEAD/base `0040e7879fe65502029fd960008e1c8a91ae6e8c`.

**Defecto confirmado en el SDK:** el fetch guard elimina un `client_secret` real cuando el token de compra no cambia. Esa condición no comprueba si cambió el secret de Stripe. Si `updateinitialpayment` reemplaza la sesión conservando el token, el IIFE mantiene el secret anterior. El defecto se reproduce con el guard original y desaparece con el cambio local.

**Atribución al incidente de staging: probable, pendiente de confirmar con los cuerpos de respuesta.** Los HTTP 200 y el error CORS aportados no muestran qué secretos/tokens devolvió cada update ni prueban por sí solos que Stripe expirara una sesión. No se ha repetido el E2E contra staging ni se ha ejecutado un cobro. No se atribuyen al SDK los ~10 segundos de latencia interna de Stripe.

Referencia externa inspeccionada, sin modificar: `/tmp/stripe-payment.iife.js`, SHA-256 `f7cca745c72244d27372d68461d0d3047b1fdf2e31ec51b139276063bb252103`. Toda la implementación relevante está minificada en la **línea 261**; se indican los símbolos para localizarla sin reformatear el archivo.

## Cadena causal y referencias

1. `CheckoutModal.tsx:230` (`packages/react-sdk/src/sdk/widgets/`) incluye `line.amount` en `cartPurchaseKey`. Cambiar cantidad invalida `purchaseAlreadyClear` (`:815`), activa `holdPayForm`/`reviewingPurchase` (`:816`) y sustituye `PayPanel` por `PaySkeleton` (`:2194`). Es un desmontaje completo, aunque las dependencias del efecto interno de montaje no incluyan las líneas del carrito.
2. El cleanup del panel desmonta la isla (`CheckoutModal.tsx:3086`). `packages/react-sdk/src/sdk/payments/gafaPay.ts:913` elimina el custom element. El IIFE `/tmp/stripe-payment.iife.js:261`, clase `mw.disconnectedCallback`, llama a `this.root.unmount()`. El componente Stripe `Ko` también tiene cleanup con `T.current.destroy()`. Por tanto, **sí existe limpieza de React y del Payment Element**; no hay evidencia que justifique añadir otro `destroy()` desde el SDK. Esto no garantiza cancelar requests ya enviadas: los fetch del IIFE no tienen AbortController.
3. La validación vuelve a llamar `previewPurchase` (`CheckoutModal.tsx:1716` y `:1738`). `packages/react-sdk/src/sdk/client/httpGafaClient.ts:2013` lo traduce a `/reservation/reservate` con `dryRun: true`, sin datos de pago. Al terminar la validación se vuelve a mostrar `PayPanel`, y el efecto de `CheckoutModal.tsx:2998` carga y monta una nueva isla (`:3052`).
4. `gafaPay.ts:890` instala el guard antes de insertar `<stripe-payment-element>`. `mw.connectedCallback` del IIFE crea el mount point y llama a `render()`. `hw` autentica, obtiene credenciales y ejecuta `pd.processInitialPayment`. Guarda `L.message` como token y `L.client_secret` como secret, y emite `initial-payment-created`.
5. Los eventos se enlazan en `gafaPay.ts:841`. `CheckoutModal.tsx:2959` y `:2961` conectan tanto created como updated a `handleHostedCheckout` (`:1439`), que llama `client.initialPurchase` (`:1484`). Esto explica por qué puede haber más de un `initial-purchase` sin dos custom elements vivos.
6. En `/tmp/stripe-payment.iife.js:261`, `hw` renderiza `ha.jsx(L0, ..., De)`: **la key del provider es el secret `De`**. `L0` llama `at.initCheckoutElementsSdk(M)` y `be.loadActions()`. Simultáneamente, su hijo `vw` ejecuta `sr.useEffect(()=>{Y()},[de])` al montar, incluso mientras `useCheckout()` está en loading. `Y()` llama `pd.updateInitialPayment`, y solo si la respuesta contiene `client_secret` ejecuta `fe(ae.message)`, `I(ae.client_secret)` y `onPaymentUpdated`. Un secret distinto remonta el provider y vuelve a ejecutar ese update inicial. Un secret idéntico no cambia la key.
7. **Punto defectuoso en la base:** `packages/react-sdk/src/sdk/payments/stripeSessionGuard.ts:88`–`:92` de `0040e78` calcula `sessionChanged` comparando únicamente `next.message` con `tokenInput`. Si son iguales (o falta `tokenInput`), borra `next.client_secret`. No compara el secret recibido con el que usa el provider. Así impide tanto la adopción de una sesión Stripe nueva como su evento updated.
8. `gafaPay.ts:755` exige iframe y ausencia del texto Loading/Cargando para dar el formulario por listo. `waitForWidgetContent` (`:766`) agota el timeout y rechaza con `PAY_FORM_LOAD_ERROR`. El timeout desktop es 9000 ms (`:144`); el panel espera 400 ms y observa otra vez **la misma isla** antes del error final (`CheckoutModal.tsx:3067`). Ampliar el timeout no corrige un secret descartado.

## Secuencia que explica los dos updates y dos initial-purchase observados

Esta es una secuencia compatible con la evidencia, no una lectura de los payloads reales de staging. `T` representa el token de compra; `S` representa el secret de una sesión Stripe.

| Paso | Evento | Estado en el bundle base |
| --- | --- | --- |
| 1 | Primer montaje y pago sin editar carrito | Si la sesión sigue vigente, el Payment Element carga. |
| 2 | Cantidad `1 → 2` | Cambia purchaseKey, se desmonta el panel, corre `/reservate` de validación. |
| 3 | Nuevo montaje, process devuelve `(T0, S0)` | `initial-payment-created` provoca initial-purchase #1; se monta provider con S0 y comienza update #1. |
| 4 | Update #1 devuelve `(T1, S1)`, con `T1 != T0` y `S1 != S0` | El guard permite S1; se emite updated → initial-purchase #2; la key nueva remonta el provider y dispara update #2. |
| 5 | Update #2 devuelve `(T1, S2)`, con `S2 != S1` y reemplazo de S1 | El guard elimina S2 porque el token sigue siendo T1. El provider conserva S1, que ya no es la sesión vigente. |
| 6 | Stripe intenta inicializar S1 | Puede fallar o permanecer cargando; la evidencia aportada muestra init fallidos y luego timeout del observador. |

También basta que el **primer** update cambie el secret conservando el token para producir el fallo; esta variante es la reproducida en el test de regresión. Si las respuestas reales conservan también el secret, o todos los updates cambian el token, esta causa concreta no explica el incidente y habrá que investigar las peticiones concurrentes/estado del backend.

El cupón sigue además un camino distinto: `CheckoutModal.tsx:861` recibe un secret/token explícitos y llama `notifyStripeDiscountAdded`; `gafaPay.ts:963` emite `buq__discount_added`, que `vw` consume directamente. Ese par no pasa por el borrado del fetch guard. La diferencia explica por qué cantidad y cupón no son equivalentes; no demuestra que todos los fallos de cupón tengan esta causa.

## Corrección local aplicada

`packages/react-sdk/src/sdk/payments/stripeSessionGuard.ts:81` devuelve intacta la respuesta de red de update, incluido su `client_secret`. Mantiene la supresión existente de POSTs idénticos durante 2000 ms (`:70`): cuando la key nueva remonta `vw` y repite el mismo body/token, se devuelve el no-op sin secret y se corta el bucle sin crear otra sesión de red.

Solo se registra un update en esa ventana si su respuesta fue exitosa. Antes también se registraban los HTTP fallidos, y un reintento inmediato podía convertirse en un falso 200 sin secret. Se incluye regresión de 503 seguido de éxito.

La supresión conserva sus límites previos: no agrupa solicitudes simultáneas aún pendientes ni serializa bodies distintos; tampoco es una barrera para esperar todas las actualizaciones antes del primer init de Stripe. Si el E2E sigue fallando después de conservar el último secret, coordinar/cancelar esos flujos requiere un diagnóstico adicional; no se incluye una reescritura del ciclo del IIFE.

## Verificación

- Con la implementación base: los nuevos contratos daban **5 fallos y 3 éxitos**, incluyendo `cs_2_process` retenido cuando el backend simulado ya exigía `cs_2_update`.
- Después: **127 archivos, 1111 tests, todos correctos**. Los 8 tests del guard cubren conservación del secret con token igual/distinto/ausente, remount por cantidad, corte de updates idénticos, vencimiento de la ventana y reintento HTTP.
- `npm run typecheck`: correcto.
- `npm run build -- --configLoader runner`: correcto; genera ES y UMD en `packages/react-sdk/dist` (ignorado por Git).
- Suite completa: `npm test -- --configLoader runner --no-cache`. Se usa runner porque `node_modules` es un symlink de solo lectura y el loader bundle intenta escribir en `.vite-temp`. El primer intento con `npm test` no llegó a ejecutar tests por EROFS. No se cambió configuración del proyecto.
- Comprobación adicional ejecutando el **IIFE íntegro original** en JSDOM, con fetch y Stripe simulados (`/tmp/gft-frame-iife-repro.mjs`): con guard base, `firstReady=true`, `secondReady=false`, providers `[cs_1_process, cs_2_process]`; con guard corregido, `firstReady=true`, `secondReady=true`, providers `[cs_1_process, cs_2_process, cs_2_update]`. En ambos casos se destruye el Payment Element del primer montaje y solo hay dos updates reales en total. Esta comprobación valida el contrato del IIFE; no simula el CORS ni la latencia de Stripe real. El harness temporal no forma parte de la suite versionada.

Para cerrar la atribución en staging: repetir cantidad `1 → 2`, comparar mediante etiquetas/hash (sin publicar secretos) el secret de process, el de cada update y la sesión utilizada por payment_pages/init; comprobar que el último secret recibido llega al provider y que reaparece el iframe. Repetir también cantidad rápida, cupón y renovación, verificando que no reaparece un bucle de updates. El arreglo queda preparado para esa validación, sin despliegue ni commit y sin cambios en `docs/v2-sdk-staging`.
