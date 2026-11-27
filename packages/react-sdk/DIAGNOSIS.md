# Rework de recurrencia y sesión Stripe

Base: `a6d2f0d` (PR #321, consolida #322). Cambios únicamente en `packages/react-sdk`. Sin commit, push, rebase ni publicación.

## Máquina por checkout

`stripeSessionGuard.ts` reemplaza `checkout.tail`, contadores de pendientes y debounce del widget por una máquina explícita. `StripeCheckoutState` pertenece al modal y conserva la elección efectiva, `saveCard` y la revisión entre remontajes. Cada generación tiene un único propietario, operación, `AbortController`, plazo y resultado.

```text
idle
  └─ process ────────────────────────────────> preparing(rev, signal)
ready / preparing / error
  └─ mutación aceptada ── abortar anterior ──> preparing(rev+1, signal)
preparing(rev)
  ├─ process/update + registrar compra + reconciliar updates ──> ready(rev, token, secret)
  └─ fallo vigente / 30 s sin progreso ─────────────────────────> error(rev)
ready + formulario vigente montado y ready + sin validación pendiente
  └─ complete vigente ─────────────────────────────────────────> confirming
confirming
  ├─ complete falla ───────────────────────────────────────────> ready
  └─ Stripe.confirm del provider vigente
       ├─ éxito ───────────────────────────────────────────────> done
       └─ fallo ───────────────────────────────────────────────> ready
cualquier generación ── dispose/invalidate ─────────────────────> disposed
```

`ready` de la máquina acredita que terminó la preparación y el registro; `stripeSessionStatus().ready` exige además el montaje real y el evento `ready` del Payment Element correspondiente. El CTA observa este segundo estado continuamente, también después de la carga inicial.

Invariantes:

- Solo el propietario, operación y revisión actuales, con señal no abortada, pueden aceptar respuestas y pasar a `ready` o `error`. No se deduce vigencia por igualdad de token.
- Cantidad/carrito, casilla, remount y método invalidan la generación anterior. La suscripción al carrito invalida inmediatamente, antes de que React remonte la vista. Los cambios aceptados crean una nueva revisión; un eco idéntico de montaje no es una mutación.
- Validar un cupón bloquea el checkout desde el inicio. La validación que aún no ha cambiado la sesión mantiene una barrera independiente; la sustitución efectiva del cupón crea otra revisión. Si no devuelve secret, se invalida y se hace un process nuevo con el precio descontado.
- No existe una cola persistente de promesas entre generaciones. Una operación atascada no bloquea una revisión ni un montaje nuevos, aunque el transporte ignore `AbortSignal`.
- Un reintento tras error comienza con `processinitialpayment`, conserva opciones actuales y registra/reconcilia la nueva sesión antes de habilitarla. Cada remount también empieza con process.
- El presupuesto es de 30 s sin progreso y se renueva al aceptar respuestas y terminar registros. Su vencimiento aborta de verdad la revisión; una respuesta posterior no la resucita.
- `dispose()` aborta, destruye el Payment Element, desconecta observadores y cierra la generación. Las marcas de tokens cerrados rechazan completes antiguos sin retener árboles DOM desmontados.
- `completeinitialpayment` comprueba sesión lista, token y formulario vigentes; entra en `confirming` antes de ir a red. No se reintenta automáticamente. Su respuesta pierde autorización si cambia la revisión mientras esperaba.
- El adaptador exige también la identidad del provider. Un provider desmontado no puede confirmar aunque el siguiente conserve token **y secret**. Una vez comienza el `Stripe.confirm` real, se congelan mutaciones y segundos completes hasta que termine: esa operación no es abortable. Un fallo libera la barrera; el éxito termina en `done`.

`AbortController` no es un rollback del servidor. Por eso no se restaura una sesión potencialmente modificada al reintentar: se crea y registra otra, y las generaciones anteriores pierden autorización de montaje y confirmación. No se añaden reintentos de cobros ni se supone idempotencia nueva del backend.

## Bootstrap, consumidor y montaje

La preparación y la respuesta al primer `processinitialpayment` son independientes. El bootstrap espera el resultado de la **revisión vigente**, aunque un cupón sustituya su process, primer update o registro de compra. Las peticiones superadas del formulario no entregan secrets ni errores antiguos.

El evento del descuento se intercepta antes del IIFE. Primero se registra/reconcilia la sesión final. El replay solo se emite cuando existe el consumidor: el IIFE instala su listener antes del efecto de update del formulario. Si el descuento termina antes de ese primer formulario, el bootstrap entrega el final; si la respuesta inicial ya se había consumido, el primer efecto de montaje recibe el replay pendiente, incluso con token idéntico. Los eventos inicial/updated del IIFE son ecos y no repiten registros de compra.

`stripeSurface.ts` sigue `initCheckoutElementsSdk`, `createPaymentElement.mount`, `ready`, destrucción y `loadActions().confirm`. Asocia secret, nodo conectado y provider. Rechaza montajes superados/desconectados, sustituye una superficie anterior y evita acreditar un iframe de otra generación. El resto de métodos Stripe y los checkouts ajenos pasan por el adaptador sin cambiar su contrato.

Hay dos detalles del runtime que los anteriores dobles de tests no representaban:

1. **Fábrica conservada por el IIFE.** `@stripe/stripe-js` inicia su carga al evaluar el bundle, conserva la función Stripe y después usa `cached.apply(...)`. Instalar un wrapper solo al montar no cubría esa referencia. Ahora el guard se instala antes de cargar el IIFE y el adaptador cubre también esa invocación de la referencia conservada, incluyendo un IIFE precargado. La restauración conserva Stripe.js y sus propiedades estáticas.
2. **Ciclo del tema antiguo.** `installStripeCardTheme` restaura el descriptor de `window.Stripe` en su cleanup. Instalarlo por PayPanel eliminaba el seguimiento al remontar el carrito: se reproducía un iframe conectado con preparación terminada, pero superficie sin acreditar y panel en `loading`. Ese hook de Card Element ya no se instala en Checkout Elements. El seguimiento vive durante el runtime del SDK, independientemente del PayPanel.

Además, el CSS anterior colapsaba la isla a altura cero mientras cargaba. Stripe mantiene ahora altura de layout y un mínimo de 240 px mientras el skeleton la cubre. La casilla conserva el JSX y DOM de `label.gafa-check-row`, con su input oculto y label visible.

## Cierre de los hallazgos 1–6

| Hallazgo | Cambio y evidencia de regresión |
| --- | --- |
| **1. Confirmación sobre sesión anterior** | El modal real bloquea CTA, submit directo y complete desde la validación del cupón, durante initial-purchase y hasta montar el secret final. Otro test sustituye la sesión mientras complete espera y verifica cero confirmaciones antiguas. Se comprueban identidad del provider, complete único y bloqueo durante Stripe.confirm. |
| **2. Cupón antes del primer iframe** | Casos separados durante process, primer update e initial-purchase; el IIFE recibe el final y monta exactamente un iframe. Otro caso demora el primer formulario después de consumir la respuesta inicial y aplica un cupón con token idéntico: el replay espera a su consumidor y converge al final. |
| **3. Frecuencia null convertida en 30** | La recurrencia exige elección marcada, `can_subscribe` actual estricto y frecuencia positiva válida. Cantidad 2, dos membresías, línea adicional con costo o ausencia de días producen pago único: atributo false, frecuencia ausente, estado/payload false y frecuencia null. El modal real verifica process/update e initial-purchase. No hay fallback a 30 en los payloads coordinados. |
| **4. Petición atascada bloquea remount/reintento** | AbortController en process/update/complete, registro initial-purchase y validación de cupón. La señal llega al cliente HTTP; abortos no se convierten en fallos de red. Los tests remontan sin resolver el process antiguo, cancelan por timeout, descartan su respuesta tardía y reconcilian mediante process. El modal cancela un cupón atascado al cambiar carrito y revalida sin esperar al viejo. |
| **5. Error antiguo termina espera de recurrencia** | Los errores solo se publican para la revisión vigente y llevan `revision`. La espera ignora errores antiguos/sin acreditación. Una regresión rechaza el update viejo y emite su error mientras el cupón actual sigue pendiente: la espera continúa y termina con el éxito vigente. El fallo vigente sí bloquea y permite reintentar. |
| **6. CART−/BUQMX deja superficie vacía u oculta con Pagar habilitado** | Modal real + consumidor React con remount por key=secret, registro real del flujo (servicio simulado), prueba de varios ciclos +/− y cupón BUQMX retenido en registro. Se comprueba un único iframe conectado, secret vigente, panel ready y CTA coherente. Se corrigen el conflicto del descriptor, el bootstrap sin consumidor, los montajes superados y el layout colapsado. Se conserva un harness adicional para medir altura/visibilidad en Chrome con el IIFE original. Su ejecución está pendiente de un entorno que permita arrancar Chrome; ver límites de verificación. |

## Elegibilidad y opciones conservadas

Catálogo OK sin `can_subscribe` estrictamente booleano significa pago único y casilla oculta, aunque el carrito persistido tenga `subscribable=true`. Solo un error del catálogo permite ese respaldo histórico. Una membresía no suscribible nunca activa recurrencia. La frecuencia ya no convierte fracciones inferiores a un día en cero días.

Desmarcar envía `recurringPayment=false` y `paymentFrequency=null`. Los clics rápidos convergen a la última elección. El estado local false del IIFE no reactiva ni desactiva la elección del modal. `saveCard=true` sobrevive a remounts del provider, carrito y cupón. Los secretos tardíos con token idéntico se descartan. Se mantienen las pruebas existentes del catálogo y del fallback.

## Archivos y pruebas

- `payments/stripeSessionGuard.ts`: máquina, revisiones, abortos, plazo, barreras, preparación y coordinación del consumidor.
- `payments/stripeSurface.ts`: adaptador de montaje/ready/confirm y fábrica conservada por el IIFE.
- `payments/gafaPay.ts`: instalación previa a cargar el script, atributos/payload coherentes y confirmación vinculada al estado.
- `widgets/CheckoutModal.tsx`: elegibilidad efectiva, invalidación inmediata, señales del registro/cupón, seguimiento continuo del CTA y remount cuando el cupón no entrega sesión.
- `cart/membershipPayOptions.ts`: espera por revisión y frecuencia válida.
- `client/types.ts`, `client/httpGafaClient.ts`: señales hasta initial-purchase y check-discount, propagación del aborto.
- `widgets/widgets.css`: conservar layout de Stripe durante loading.
- `payments/stripeSession.integration.test.tsx`: 31 pruebas con React real; incluye el modal completo y sus callbacks reales. Solo se sustituye carga del script y servicios externos.
- `payments/stripeSurface.test.ts`: fábrica precargada/tardía, API ajena, restauración y rechazo de montajes.
- `client/httpGafaClient.purchase.test.ts`: propagación de señal y aborto del registro.
- `payments/gafaPay.test.ts`: contrato de atributos y ecos del IIFE. El antiguo caso R3 de `CheckoutModal.pay.test.tsx` que insertaba un iframe manual y sustituía el callback se reemplaza por los casos del modal real.
- `tests/stripe-original.browser.mjs`: harness reproducible en Chrome, IIFE original suministrado por ruta, red y Stripe simulados. Cinco ciclos 1→2→1, BUQMX durante registro y bootstrap, secret final, altura >50, guardar tarjeta y una confirmación.

## Verificación y límites

Desde la raíz:

```sh
npm --prefix packages/react-sdk test -- --configLoader runner --pool threads --maxWorkers 2 --no-cache
npm --prefix packages/react-sdk run typecheck
npm --prefix packages/react-sdk run build -- --configLoader runner
git diff --check
node packages/react-sdk/tests/stripe-original.browser.mjs /tmp/stripe-payment.iife.js
```

Se usan hilos con dos workers, como en la revisión base. La primera suite completa de este rework pasó con 128 archivos y 1176 tests antes de añadir las regresiones de fábrica conservada/provider y las últimas carreras.

La comprobación adicional con el **IIFE original sin modificar** (SHA-256 `f7cca745c72244d27372d68461d0d3047b1fdf2e31ec51b139276063bb252103`), JSDOM y Stripe/red simulados pasa tras cubrir su fábrica conservada: solo se montan los secrets finales, se conserva saveCard en cupón y remounts, y hay un solo complete y una confirmación final. Se ejecutó desde `/tmp/gft-rework-original-iife.mjs`, con el adaptador compilado en `/tmp/gft-rework-stripe-sdk.mjs`. Es evidencia simulada; JSDOM no acredita layout visual.

El harness se intentó con Google Chrome (dos veces) y con Chromium headless shell, también en modo de proceso único. Los navegadores no arrancaron bajo este sandbox: `crashpad ... setsockopt: Operation not permitted` o `sandbox_host_linux ... shutdown: Operation not permitted`, terminando antes de cargar la página. **No se cuenta como E2E aprobado**, ni se afirma haber medido visibilidad real en este entorno. El harness queda en el paquete para ejecutarlo con `CHROME_BIN` si es necesario. No hubo despliegue, acceso a cobros reales ni publicación.

Resultados finales, sobre el código final:

- **129 archivos y 1184 tests correctos** en la suite completa, sin errores no manejados.
- **10 repeticiones de las 34 pruebas de carreras/adaptador: 340 ejecuciones correctas**, sin intermitencias observadas. No fue necesario reintentar ningún fallo intermitente de la suite final.
- **Typecheck correcto** y **build ES/UMD + declaraciones correcto**.
- **`git diff --check` correcto**. HEAD continúa en `a6d2f0d`; todos los cambios están dentro del paquete autorizado.
- **IIFE original + JSDOM con servicios simulados: correcto**, repetido tras los últimos cambios de identidad del provider y confirmación.
- **E2E visual en navegador: no ejecutado por la restricción del sandbox**, con harness conservado para repetirlo fuera de este entorno. Por ese límite no se emite un OK de staging ni se da por acreditada una medición visual de Stripe real.

Logs locales de esta sesión: `/tmp/gft-rework-full-final.log`, `/tmp/gft-rework-repeat-1.log` … `/tmp/gft-rework-repeat-10.log`, `/tmp/gft-rework-build-final.log`, `/tmp/gft-rework-original-iife-final.log`.
