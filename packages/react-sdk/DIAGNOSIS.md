# Stripe — iteración 2 sobre bd8124b

Cambios limitados a `packages/react-sdk`. Sin commit, push, rebase ni publicación.

## A1 — cupón antes del primer formulario

La validación de compra podía terminar correctamente sin guardar `purchaseClearKey` cuando ya había descuento o regalo. El modal permanecía en `reviewingPurchase`, mostrando el skeleton sin llegar a montar PayPanel ni pedir el IIFE. Ahora una validación correcta acredita la clave de carrito revisada también con extras. La validación explícita al pulsar Pagar sigue revisando los extras.

El descuento anterior al primer formulario se incorpora al precio del primer process; no necesita un consumidor ni un replay para cargar el script. Si existe una sesión, el descuento entra como una revisión de esa sesión. El bootstrap sigue la revisión vigente; nunca exige que el IIFE haya montado para entregar el resultado. Los replays posteriores esperan al listener del consumidor, sin bloquear el loader.

Regresiones: modal real con reservate y script pendientes, cupón BUQMX aplicado antes de ambos, loader invocado, primer process con precio 90, initial-purchase y montaje del secret final. Se mantienen los casos de cupón durante process, update, registro y entrega diferida del bootstrap.

## A2 — cadena lenta, montaje tardío y Stripe compartido

Los plazos de preparación y montaje se renuevan con el progreso de la revisión vigente: respuesta process/update, inicio de la escritura siguiente y fin de cada registro. Los eventos de DOM sin un nuevo `progressAt`/revisión no renuevan el plazo visual. Cada escritura tiene además su propio límite de 30 s.

Un vencimiento exclusivamente visual conserva la generación y el nodo actuales. PayPanel observa continuamente la sesión: un Payment Element vigente que emite `ready` tarde recupera `data-state=ready`, elimina el error y habilita el CTA. Un error de preparación sí aborta la revisión y exige reconciliación; un resultado de escritura tardío no la resucita.

El CSS de error de Stripe conserva un nodo medible, con opacidad cero y sin interacción, en lugar de `display:none`. Al llegar el ready vigente, el cambio de estado restaura su visibilidad. Las reglas del label `gafa-check-row` permanecen intactas.

El adaptador conserva una instancia `Stripe()` por publishable key, tanto por la fábrica global como por la referencia `.apply` almacenada por el IIFE. Cada provider sigue perteneciendo a su secret, nodo y generación. Los elementos rechazados o sustituidos se destruyen; la destrucción es idempotente aunque el guard y React limpien el mismo elemento. Ready/unmount también comprueban la identidad del provider.

Regresiones: CART+ / CART− con process, update y registros de 6 s cada uno; montaje 120 s después, error visual, recuperación en el mismo contenedor y un único Stripe. El CTA permanece bloqueado hasta el iframe vigente y su evento ready.

## B1 — barrera de escrituras y reconciliación

Cada `StripeCheckoutState` conserva una cola de transporte entre revisiones y generaciones DOM. Process, update, initial-purchase y complete comparten esa barrera.

- Invalidar una revisión cancela su espera visual y autorización de montaje/confirmación. No aborta el transporte en curso ni libera su barrera.
- La revisión siguiente espera a que la escritura anterior responda, falle o agote su propio plazo de 30 s. Las tareas todavía encoladas comprueban su vigencia antes de escribir.
- Una escritura fallida o indeterminada marca la sesión para reconciliación. La revisión vigente debe comenzar con process y registrar/reconciliar la nueva sesión antes de habilitar Pagar.
- Los tokens conocidos de escrituras indeterminadas quedan en cuarentena. Si process devuelve uno de esos tokens, se falla cerrado aunque cambie el secret: hace falta una orden nueva.
- El contexto del registro ofrece una señal de transporte con plazo y `isCurrent()`. El modal no publica el pending de un registro que ya perdió su revisión.

**Requisito de backend pendiente (GAFApay): validación atómica de revisión por checkout e idempotencia de las mutaciones.** El cliente no puede cancelar ni revertir una escritura que el servidor ya aceptó. Tras un timeout, GAFApay debe crear una orden/sesión nueva, aislada de la anterior; una escritura antigua no debe poder modificarla. Se rechaza reutilizar un token conocido indeterminado, pero el navegador no puede acreditar la unicidad o aislamiento internos del servidor, ni resolver concurrencia entre pestañas/clientes. No se implementó backend dentro de este alcance.

Las pruebas mantienen una escritura antigua pendiente, verifican que no empieza la nueva, liberan la antigua y comprueban que el estado final simulado del servidor coincide con el iframe listo. También cubren cola entre desmontajes, timeout, process nuevo y rechazo de tokens en cuarentena.

## B2 — pestaña activa

Pulsar el método ya seleccionado retorna antes de invalidar la sesión. La regresión del modal con varios métodos comprueba que se conservan revisión, iframe, número de peticiones y CTA habilitado.

## B3 — complete con plazo propio y resultado ambiguo de confirm

`completeinitialpayment` pasa a confirming antes de escribir y tiene un AbortController y plazo propios de 30 s, independientes del temporizador de preparación ya cancelado. La espera incluye consumir el cuerpo de la respuesta. Timeout/error lleva a error recuperable mediante process nuevo; no hay retry automático de complete ni de cobro. Una respuesta tardía no autoriza `Stripe.confirm`.

Esta espera es anterior a `Stripe.confirm`. Una vez comienza confirm, se bloquean nuevas mutaciones y completes. Un resultado explícito de Stripe permite terminar en done o volver a ready según el resultado. Una excepción de transporte tiene resultado indeterminado: conserva la barrera incluso entre remontajes, a la espera de reconciliar la compra mediante las consultas del host. No permite otro intento suponiendo que no hubo cobro.

Regresiones: complete sin respuesta, cuerpo sin terminar, cero confirmaciones tras 30 s, recuperación mediante process y excepción de confirm con segundo complete rechazado.

## B4 — saveCard explícito y coordinado

Para una membresía, el estado compartido parte del mismo `true` que muestra el modal. Sin membresía, conserva `false`, igual que `setPayment` del registro. El handler de guardar tarjeta escribe la preferencia explícita (incluido false) e inicia la revisión de manera síncrona; el estado local del IIFE no puede restablecer un opt-out. El payload del registro consulta esa preferencia compartida.

Los registros por preferencias y regalos recorren prepare y la misma barrera, con señal, plazo y CTA bloqueado. Se eliminó el initial-purchase directo sin contexto del efecto de sincronización. Los cupones mantienen su propia revisión y no generan una segunda escritura desde ese efecto.

Regresiones: valor inicial true en update/registro, opt-out false hasta complete, registro atascado con señal abortada por plazo, retry con sesión nueva, y cambios rápidos false→true mientras la escritura anterior sigue pendiente. Los registros se serializan y converge la última preferencia.

El fixture antiguo de `CheckoutModal.pay.test.tsx`, que reemplaza por completo el adaptador, modela ahora explícitamente el callback de registro de revisión tras el cupón. La coordinación real se prueba sin sustituir guard, montaje ni callbacks en `stripeSession.integration.test.tsx`.

## B5 — evidencia visual y sus límites

Se conserva la aserción estructural de altura del fixture de integración; no acredita visibilidad CSS. `tests/stripe-original.browser.mjs` carga el IIFE original desde la ruta suministrada a través del loader real, prueba un precio con cupón antes de cargarlo, cinco ciclos 1→2→1, revisiones serializadas, cadena lenta y recuperación del montaje tardío. Mide `getBoundingClientRect()` y estilos calculados del iframe y de **todos sus ancestros**, comprueba una sola instancia Stripe y una única confirmación simulada final.

El harness ejecuta Chrome real pero simula OAuth, GAFApay, initial-purchase y Stripe: no efectúa cobros ni valida staging. El modal completo tiene regresiones de integración separadas; el harness visual prueba el adaptador con el contenedor y CSS reales.

**Navegador bloqueado en este entorno:** Chrome termina antes de abrir la página con `crashpad ... setsockopt: Operation not permitted`. No se acredita B5 en navegador ni se emite un OK de staging. Queda pendiente ejecutar el harness en un entorno que permita arrancar Chrome y repetir el E2E con Stripe/staging reales.

La comprobación adicional en JSDOM con el IIFE original sin modificar (SHA-256 `f7cca745c72244d27372d68461d0d3047b1fdf2e31ec51b139276063bb252103`) y servicios simulados pasa sobre esta implementación: secret final, saveCard conservado y una sola confirmación. Es evidencia del contrato, sin medición visual.

## Verificación

Comandos (el loader nativo evita escribir la configuración compilada en node_modules, que es de solo lectura en este entorno):

```sh
npm --prefix packages/react-sdk test -- --configLoader native --pool threads --maxWorkers 2 --no-cache
npm --prefix packages/react-sdk run typecheck
npm --prefix packages/react-sdk run build -- --configLoader native
git diff --check
node packages/react-sdk/tests/stripe-original.browser.mjs /tmp/stripe-payment.iife.js
```

Resultados sobre el árbol final:

- Suite completa: **129 archivos y 1198 tests correctos**, sin errores no manejados. Log: `/tmp/stripe-suite-final.log`.
- Typecheck correcto: `/tmp/stripe-typecheck-final.log`.
- Build ES/UMD y declaraciones correcto: `/tmp/stripe-build-final.log`.
- `git diff --check` correcto. HEAD sigue en `bd8124b`; los archivos modificados pertenecen solo a `packages/react-sdk`.
- IIFE original + JSDOM: contrato correcto, una confirmación simulada. Log: `/tmp/stripe-original-dom-final.log`.
- También se comprobó el flujo del harness ampliado en JSDOM, omitiendo explícitamente las aserciones visuales y reduciendo los tiempos de sus servicios simulados: cinco ciclos de carrito, una instancia Stripe, recuperación tardía y un complete/confirm final. Esta comprobación temporal de contrato no cuenta como navegador ni como medición de dimensiones. Log: `/tmp/stripe-harness-contract.log`.
- Chrome: **bloqueado antes de abrir la página** por `setsockopt: Operation not permitted`; no es un E2E aprobado. Log: `/tmp/stripe-browser-final.log`.

No se efectuaron cobros, llamadas de pago a producción ni despliegues.

Se mantienen: sin can_subscribe booleano → pago único; opt-out → recurringPayment=false; convergencia de clics rápidos; cantidad 2, varias membresías o falta de elegibilidad/frecuencia → pago único; label.gafa-check-row; coherencia saveCard; Pagar solo con sesión preparada y formulario vigente montado y ready.
