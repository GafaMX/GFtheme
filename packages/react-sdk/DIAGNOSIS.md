# Ronda final de pagos: elegibilidad, cupones y espera de Stripe

Base de trabajo: `241b63e` (#321 + #322). Cambios limitados a `packages/react-sdk`, sin commit, push ni publicación.

## 1. Catálogo OK sin `can_subscribe` booleano: pago único

El catálogo de esta sesión decide la elegibilidad. Mientras está pendiente, no se monta Stripe ni se permite Pagar, aunque el carrito persistido o la configuración tengan un valor anterior.

Si el catálogo responde OK y la membresía no trae `can_subscribe` estrictamente booleano (campo ausente, `null`, números, cadenas, objetos o arrays), se considera **NO suscribible**. El checkout normaliza `raw.can_subscribe=false`, envía `subscribe=false`, conserva `recurringPayment=false`, oculta los controles de renovación y monta Stripe en modo **pago único**, con `hasRecurringPayment=false` y `paymentFrequency=null`. Se permite Pagar ese cobro único: nunca renueva. `subscribable=true` o `can_subscribe=true` persistidos no habilitan una suscripción en este caso. Una respuesta OK sin la membresía tampoco acredita elegibilidad.

Solo un **error del catálogo** permite la lógica de respaldo: booleano actual de la configuración, si existe; de lo contrario, `subscribable` del carrito o de la configuración según su precedencia anterior. Sin ninguno de esos datos, pago único. Un `can_subscribe` persistido nunca acredita la elegibilidad. El comentario en `CheckoutModal.tsx` deja explícito este criterio. También se evita enviar `subscribe=true` en la comprobación de un producto ausente del catálogo.

Las fixtures que prueban renovación válida declaran ahora `can_subscribe=true` actual, incluida la prueba de membresía más matrícula. El antiguo caso que esperaba renovación con campo ausente exige ahora pago único y comprueba los payloads de preview e initial-purchase y la confirmación al pulsar Pagar.

## 2. Cupón BUQMX y sustituciones de token

`stripeSessionGuard` captura `buq__discount_added` antes de los listeners del IIFE. Asocia el token nuevo al widget y le asigna inmediatamente una revisión en la misma cola que process y update. El aviso emitido por el modal incluye el token de origen para identificar el checkout.

La cadena registra initial-purchase y espera sus actualizaciones antes de volver a entregar el evento al IIFE con el último `client_secret`. Así el provider no monta el secret intermedio del cupón. Se reutilizan los datos y las cabeceras de la petición del IIFE, incluida Authorization, y las elecciones de `saveCard` y recurrencia del checkout. El cupón invalida el debounce incluso si conserva token y body: sustituir la sesión es una mutación externa. Una revisión superada no entrega su secret, aunque conserve el token. Los updates con un token nuevo también pueden localizar el widget por cliente y carrito.

Regresiones con custom element y consumidor React que remonta de verdad por key=secret:

- Descuento por helper del SDK y evento externo, después de activar guardar tarjeta y con un update anterior pendiente: solo se inicializa el secret final, aparece iframe y update/complete conservan `saveCard=true` y la recurrencia elegida.
- Dos cupones con el mismo token dentro del debounce: se ejecuta la actualización vigente y no se monta el secret tardío ni los secrets intermedios.
- La preparación no dispara complete ni confirm. Una acción de pago produce exactamente un complete y una confirmación.

## 3. Renovación lenta y recuperación

`waitForStripeRecurrence` usa un presupuesto renovable de **30 s sin progreso**, coherente con la carga del formulario. Observa el estado de la revisión del guard y sus eventos de progreso, no solo un evento temprano del IIFE. Incluye toda la cola y initial-purchase; un éxito de una revisión superada no termina la espera. Una revisión que ya estaba lista antes del click tampoco confirma el cambio nuevo.

La regresión integrada tarda 10 s en update y **25 s en initial-purchase**: sigue pendiente al pasar 15 s y 30 s totales y permite continuar al completar la revisión vigente. También se verifica que un timeout por inactividad bloquea temporalmente y que el éxito posterior de la revisión vigente limpia el fallo para el siguiente intento. Los listeners y timers se limpian al resolver o cancelar.

## Conservación y verificación

Se mantienen las regresiones de opt-out a pago único, clics rápidos, cantidad 1→2→1, iframe de la sesión vigente, membresía no suscribible, secret tardío con token idéntico y elección de guardar tarjeta. No se modifica el JSX ni la estructura DOM de `label.gafa-check-row`.

Comandos desde la raíz:

- Suite completa: `npm --prefix packages/react-sdk test -- --configLoader runner --pool threads --maxWorkers 2 --no-cache`.
- Typecheck: `npm --prefix packages/react-sdk run typecheck`.
- Build: `npm --prefix packages/react-sdk run build -- --configLoader runner`.
- Formato del diff: `git diff --check`.

El pool predeterminado terminó sin ejecutar casos en este entorno; se usaron hilos. La primera ejecución completa con hilos detectó una fixture de matrícula que esperaba renovación sin booleano actual; se corrigió incorporando el dato actual a esa fixture.

Comprobación adicional, fuera del repositorio: `/tmp/gft-final-original-iife-check.mjs` ejecuta el IIFE original `/tmp/stripe-payment.iife.js` con JSDOM y Stripe/fetch simulados. Tras guardar tarjeta y aplicar un cupón con token nuevo, el provider recibe solo el secret final, conserva iframe y `saveCard=true`, y no monta el secret intermedio. El recorrido posterior por cantidad conserva la opción y termina con un complete y una confirmación. Es evidencia local simulada, sin cobros reales ni despliegue.

Resultados finales:

- **128 archivos, 1162 tests correctos** en la suite completa tras corregir la fixture. No se observaron tests intermitentes.
- **Typecheck correcto**.
- **Build correcto**, con salidas ES/UMD y declaraciones en `dist` ignorado.
- **`git diff --check` correcto**.
- **IIFE original con servicios simulados: correcto**, incluidas las aserciones de Authorization, iframe, secret final, recurrencia, guardar tarjeta y confirmación única.
