# Lanzar GFtheme v2 a Fitspin (proceso real)

El sitio de producción es **https://web.buq.mx/fitspin** (Replit **Buq-Webs**). El JS del SDK vive en **jsDelivr**, no en Replit.

## URL canónica de producción

```
https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.js
```

- Secreto de Replit: `VITE_GAFA_SDK_V2_URL` → esa URL.
- El HTML público sale de `index-*.html` generado. No se edita a mano.
- **No** copies `packages/react-sdk/src` a Buq-Webs. El runtime es este bundle.

## Qué **no** hacer (lecciones de 2026-08)

1. **No pulses Republish en Buq-Webs** para un cambio del SDK. Republish reinicia toda la app multi-sitio y a menudo tumba Fitspin (y otros clientes) varios minutos. El JS ya se carga desde jsDelivr: un hard refresh basta.
2. **No uses tags `v2.0.0-rc.N`.** jsDelivr las trata como inmutables. Fitspin se quedó pegado en `rc.2` hasta un Republish.
3. **No uses `@v2/main`.** La barra se interpreta mal (`@v2` + path `/main/...`) → 404.
4. **No uses `@v2`.** jsDelivr lo trata como versión npm-style `2` (snapshot viejo).
5. **No uses `sdk-live` para producción.** Tras force-push, jsDelivr siguió sirviendo un snapshot git viejo. El puntero vivo es **`cdn-live`**.
6. **No hagas Stop + Run** “por si acaso”. El secreto ya apunta a `cdn-live`; no hace falta tocar Replit.

## Receta de cada lanzamiento

Desde `packages/react-sdk`:

```bash
npm test
npm run typecheck
npm run publish:embed
```

Luego, en la raíz del repo:

```bash
git add docs/v2-sdk/gafa-sdk.js docs/v2-sdk/VERSION.txt
git commit -m "chore(v2): republicar gafa-sdk.js"
git push origin HEAD          # tu rama de trabajo / PR
git push origin HEAD:refs/heads/cdn-live
curl -s https://purge.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.js
```

Comprueba que GitHub raw y jsDelivr coinciden:

```bash
curl -sI https://raw.githubusercontent.com/GafaMX/GFtheme/cdn-live/docs/v2-sdk/gafa-sdk.js | grep content-length
curl -sI https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.js | grep -iE 'content-length|x-jsd-version'
```

`x-jsd-version-type` debe ser `branch`. Los `Content-Length` deben coincidir (o jsDelivr un poco mayor por el banner). Si jsDelivr se queda corto, **no force-pushees `cdn-live`**: crea otra rama nueva (`cdn-live-2`, etc.) y cambia el secreto **solo si** hace falta. Un cambio de secreto **sí** exige Republish (evítalo).

En el navegador (Fitspin, login hecho):

1. Hard refresh: Ctrl+Shift+R.
2. Network → `gafa-sdk.js` → URL con `@cdn-live`.
3. Si ves un tag `v2.0.0-rc.*` o `sdk-live`, el HTML cacheado está viejo: otro hard refresh, o espera al Service Worker.

## Rama `cdn-live`

- Puntero **mutable** a “lo que corre Fitspin ahora”.
- Fast-forward desde el commit que acaba de publicar el embed.
- No es la rama de producto (`v2/main`). Los PRs siguen yendo a `v2/main`.
- No uses `--force` contra `cdn-live` si jsDelivr ya cacheó ese nombre.

## Checkout: dos POSTs distintos

| Pasarela | Tras pagar, el SDK llama |
|---|---|
| **GafaPay (Stripe / Openpay / Conekta)** | `POST .../reservation/reservate` (`client.reservatePurchase`) |
| **Recurrente** | `POST .../gafapay/initial-purchase` (`client.initialPurchase`) |

No mezclar. `initial-purchase` + Stripe viejo de producción = cargo sin créditos.

## Perfil: cada paquete es una fila

`listUserCredits` identifica cada compra por `purchase_items_id`, no por tipo de crédito. “Mi actividad” muestra el **total** y un slider por paquete.

## Calendario: filtros Servicio y Staff

Van **encendidos por defecto**. En el HTML de Replit no hace falta `filter-bq-service` / `filter-bq-staff`. Para apagarlos: `="false"`.

## Tags `v2.0.0-rc.N`

Siguen existiendo como **archivo** (rollback humano, no URL de producción). No las pongas en `VITE_GAFA_SDK_V2_URL`.
