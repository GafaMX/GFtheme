# Stripe Payment Element: coordinación de sesión al cambiar cantidad

## Alcance y resultado

PR #322, rama `pablo/stripe-remount-frame`, HEAD `9d34da3`, base `0040e78`. Esta corrección está en el working tree, sin commit ni despliegue.

El defecto original está confirmado: el guard de la base borraba `client_secret` cuando no cambiaba el token de compra. HEAD conservaba el secret, pero dejaba dos problemas de la revisión NO-OK: una respuesta superada podía reemplazar la sesión vigente y el remount del provider reiniciaba `saveCard=false`. Tampoco esperaba la cadena completa antes de inicializar Stripe.

La coordinación ahora prepara `process → initial-purchase → update(s)` antes de entregar al IIFE la respuesta de process. El provider recibe directamente el último secret. Los updates se serializan por checkout y se descartan las respuestas cuya revisión ya fue superada, incluso con el mismo token. `saveCard` vive fuera de los componentes que se remontan y se restaura en update y complete.

Referencia externa inspeccionada **sin modificar**: `/tmp/stripe-payment.iife.js`, SHA-256 `f7cca745c72244d27372d68461d0d3047b1fdf2e31ec51b139276063bb252103`. Los símbolos indicados a continuación están en su línea 261.

## Cadena causal confirmada

1. `CheckoutModal.tsx` incluye `line.amount` en `cartPurchaseKey`. Al cambiar cantidad, invalida la validación, sustituye `PayPanel` por `PaySkeleton` y desmonta la isla. Después de `previewPurchase` vuelve a montarla. Las dependencias del efecto de montaje no evitan ese desmontaje del panel completo.
2. `gafaPay.ts` elimina el custom element al desmontar. El IIFE ejecuta `mw.disconnectedCallback → root.unmount()`; `Ko` destruye el Payment Element. No faltaba añadir otro `destroy()` en el SDK. Las peticiones ya enviadas pueden seguir pendientes.
3. El IIFE `hw` autentica, obtiene credenciales y hace `processInitialPayment`; entrega `message` y `client_secret` mediante `initial-payment-created`. El SDK registra la compra con `client.initialPurchase`.
4. `hw` usa el secret como key de `L0`. Al montar, `vw` dispara `updateInitialPayment`, incluso mientras carga `useCheckout()`. Si cambia el secret, remonta el provider y vuelve a ejecutar ese efecto.
5. El token de compra puede permanecer igual mientras cambia el secret. En la base, ese secret se borraba. En HEAD se aceptaba, pero sin revisión por petición: una respuesta anterior podía ganar a otra posterior con el mismo token.
6. `vw` guarda `saveCard` en estado local inicialmente false. Activar su opción establece true, pero el siguiente cambio de key recrea ese estado. Eso producía un update adicional con false y terminaba enviando false en `completeinitialpayment`.
7. `waitForWidgetContent` tenía 9 s en desktop, contados desde el montaje. Podía fallar antes de completar las solicitudes previas al init de Stripe.

## Corrección acotada al SDK

### Preparar antes de montar

`stripeSessionGuard.ts` registra cada widget SDK con su endpoint, cliente/carrito, callbacks y estado de checkout. Retiene la respuesta de process, espera el callback asíncrono de initial-purchase y ejecuta el update con el mismo contrato de body/headers del IIFE. Si cambia el token, registra la nueva compra y continúa. Cuando se repite el body/token, corta el update de montaje sin otra petición de red y devuelve la última respuesta con secret.

La detección de repetición dentro de esa cadena no depende de que initial-purchase tarde menos de 2 s. Se omite el eco del token/secret que el IIFE emite al final: no vuelve a registrar la misma respuesta. Una petición nueva válida sí ejecuta su callback aunque conserve token y secret, con el mismo payload de evento del IIFE. La cadena solo prepara sesiones; no llama a complete ni a confirm.

### Revisiones, serialización y debounce

El estado de coordinación pertenece a `CheckoutModal` y se comparte con los nuevos `PayPanel`. Cada petición recibe una revisión **al solicitarse**, antes de esperar su turno. Solo la revisión vigente puede entregar un secret o continuar la cadena. Un widget desmontado tampoco puede aplicar su resultado. La cola incluye process y updates y mantiene el orden de las mutaciones del backend.

La supresión conserva una sola actualización exitosa consecutiva durante 2 s. Una petición con body distinto invalida esa supresión inmediatamente: A→B→A debe volver a enviar A, aunque la respuesta de B quede descartada. Los errores HTTP no activan el debounce ni impiden reintentar.

### saveCard y espera del formulario

El SDK retiene la elección de `saveCard` fuera del provider y del panel. En este IIFE `vw` solo lo activa explícitamente a true; su false posterior es el valor inicial del componente recreado, no una nueva elección del usuario. El guard restaura el valor conservado al enviar update y complete. La lógica de la casilla recurrente y sus eventos no se modifica (#321).

Para un widget Stripe coordinado, `waitForWidgetContent` concede al menos **30 s sin progreso** y renueva ese presupuesto con las respuestas de sesión y al terminar initial-purchase. No acepta un iframe mientras la preparación tenga solicitudes pendientes. Después del último secret sigue exigiendo iframe y ausencia de Loading/Cargando. Una cadena que se detiene acaba en el error habitual; los demás proveedores conservan sus timeouts.

## Verificación reproducible

Suite versionada: `stripeSession.integration.test.tsx` usa una fixture React del contrato `hw/vw/L0`, con custom element, eventos DOM, provider con key=secret, estado local recreado, promesas diferidas y reloj simulado. Complementa los tests del fetch guard; no sustituye el remount por asignaciones de variables.

- Cantidad **1→2→1**, con **93 s simulados por montaje**: 6 s por respuesta de pago y 25 s por initial-purchase. Verifica el orden de registro antes de cada update, ningún error a los 9 s ni al cruzar 30 s totales, solo el último secret en init/provider, dos updates reales por montaje y ningún complete/confirm automático.
- Una cadena sin progreso falla a los 30 s, no a los 9 s.
- Un process pendiente que termina después de desmontar su widget no monta su secret ni registra su compra.
- `saveCard=true` sobrevive al remount real del provider y al cambio del carrito. Los updates posteriores y el único complete conservan true; una acción de pago produce una confirmación.
- Activar/desactivar rápidamente con token idéntico deja la primera respuesta pendiente. La segunda petición espera su turno; el resultado anterior se descarta y el provider solo inicializa el secret más reciente. El update correctivo no queda suprimido por el debounce.
- Una petición nueva que conserva tanto token como secret sí registra su actualización; el evento final repetido no la duplica. También conserva el payload de subscriptionId del IIFE.
- Los tests existentes siguen cubriendo tokens iguales/distintos/ausentes, vencimiento del debounce, StrictMode y reintento tras HTTP 503.

Comandos ejecutados desde la raíz:

- `npm --prefix packages/react-sdk test -- --configLoader runner --no-cache`: **128 archivos, 1117 tests correctos**.
- `npm --prefix packages/react-sdk run typecheck`: correcto.
- `npm --prefix packages/react-sdk run build -- --configLoader runner`: correcto; salida ES/UMD y declaraciones en dist (ignorado).

`--configLoader runner` evita los temporales del loader bundle en el node_modules de solo lectura del entorno. No se cambió configuración ni se omitieron tests.

Comprobación adicional con el **IIFE original íntegro**, JSDOM y Stripe/fetch simulados: `/tmp/gft-frame-stripe-session-check.mjs`. En cantidad 1→2→1 solo se inicializaron los secrets finales; activar la opción conservó `saveCard=true` hasta complete, sin update correctivo con false; se observó **un complete y una confirmación**. Es evidencia complementaria con servicios simulados, no un cobro real ni un E2E de staging.

## Límite de la evidencia

La atribución al incidente concreto de staging sigue siendo probable: los HTTP 200 y el error CORS aportados no revelan los tokens/secrets de cada respuesta. Falta repetir contra Stripe real y comparar mediante etiquetas/hash el último secret recibido con el usado por init. No se atribuye al SDK la latencia interna de Stripe.

Sin cambios al IIFE, a la lógica de la casilla recurrente ni a `docs/v2-sdk-staging`. Sin cobros reales, commit ni despliegue.
