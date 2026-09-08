# Lanzar GFtheme v2 en Buq-Webs

**Buq-Webs** es la app Replit (Autoscale) que sirve **todas** las marcas en `https://web.buq.mx/<marca>`. Un solo secreto, un solo JS. Publicar el SDK no es “lanzar Fitspin”: es actualizar el bundle que carga **cualquier página v2** de esa app.

El JS vive en **jsDelivr**, no dentro de Replit. Fitspin (`/fitspin`) es el piloto actual para QA; el mismo `src` lo reciben las demás marcas que ya estén en v2, y los WordPress (Voltio, etc.).

## URL canónica (todas las marcas v2) — no se cambia

```
https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.js
```

Ese `src` es **el mismo para siempre**. Hay decenas de sitios (Buq-Webs + Elementor). **No** se crea `cdn-live-2` ni se pide a nadie que edite el HTML.

`gafa-sdk.js` es un **loader chico y estable**. En cada publish el IIFE sale como `gafa-sdk.bundle.<stamp>.js` (path nuevo). El loader lee `VERSION.txt` desde GitHub raw (no pasa por el cache de jsDelivr) y pide ese stamp. Por eso un `git push` a `cdn-live` basta: los sitios no se tocan.

- Secreto de Buq-Webs: `VITE_GAFA_SDK_V2_URL` → esa URL. Es **uno** para toda la app. **No lo cambies.**
- El HTML público sale de `index-*.html` generado. No se edita a mano por marca.
- **No** copies `packages/react-sdk/src` a Buq-Webs. El runtime es este bundle.

Sitios que siguen en v1 (`main.min.js`) no cargan esta URL y no se enteran del publish.

## Qué **no** hacer (lecciones de 2026-08)

1. **No pulses Republish en Buq-Webs** para un cambio del SDK. Republish reinicia **toda** la app: Fitspin, el resto de marcas y el editor. A menudo hay varios minutos de caída. El JS ya se carga desde jsDelivr: un hard refresh en el sitio que estés viendo basta.
2. **No uses tags `v2.0.0-rc.N`.** jsDelivr las trata como inmutables. Buq-Webs se quedó pegado en `rc.2` (Fitspin lo mostró primero) hasta un Republish.
3. **No uses `@v2/main`.** La barra se interpreta mal (`@v2` + path `/main/...`) → 404.
4. **No uses `@v2`.** jsDelivr lo trata como versión npm-style `2` (snapshot viejo).
5. **No uses `sdk-live` para producción.** Tras force-push, jsDelivr siguió sirviendo un snapshot git viejo. El puntero vivo es **`cdn-live`**.
6. **No hagas Stop + Run** “por si acaso”. El secreto ya apunta a `cdn-live`; no hace falta tocar Replit.
7. **No crees `cdn-live-2`, `cdn-live-3`, etc.** jsDelivr cachea ramas (hasta 12 h en el edge, 7 días en el browser). Rotar el nombre obliga a editar **todos** los sitios. El loader + bundle stampado existe precisamente para no hacer eso. La rama `cdn-live-2` que quedó de un apuro se puede ignorar.

## Receta de cada lanzamiento

Desde `packages/react-sdk`:

```bash
npm test
npm run typecheck
npm run publish:embed
```

Luego, en la raíz del repo:

```bash
git add docs/v2-sdk/gafa-sdk.js docs/v2-sdk/gafa-sdk.bundle.js docs/v2-sdk/gafa-sdk.bundle.*.js docs/v2-sdk/VERSION.txt
git commit -m "chore(v2): republicar gafa-sdk.js"
git push origin HEAD          # tu rama de trabajo / PR
git push origin HEAD:refs/heads/cdn-live
```

No hace falta purge de jsDelivr sobre `gafa-sdk.js` (el loader no cambia). Tampoco hace falta cambiar el secreto ni el `src` de WordPress.

Comprueba que el puntero y el stamp coinciden:

```bash
curl -s https://raw.githubusercontent.com/GafaMX/GFtheme/cdn-live/docs/v2-sdk/VERSION.txt
# bundle=gafa-sdk.bundle.<stamp>.js  ← ese path es el IIFE nuevo
curl -sI "https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/$(curl -s https://raw.githubusercontent.com/GafaMX/GFtheme/cdn-live/docs/v2-sdk/VERSION.txt | awk -F= '/^bundle=/{print $2}')" | grep -iE 'content-length|x-jsd-version'
```

En el navegador, en **cualquier** marca v2 de Buq-Webs (piloto: `https://web.buq.mx/fitspin`):

1. Hard refresh: Ctrl+Shift+R (por si el browser cacheó un IIFE viejo **antes** del loader).
2. Network → `gafa-sdk.js` (loader, pocos KB) y luego `gafa-sdk.bundle.<stamp>.js`.
3. Si ves un tag `v2.0.0-rc.*` o `sdk-live`, el HTML cacheado está viejo: otro hard refresh, o espera al Service Worker.

No hace falta Republish para que el resto de marcas v2 lo tomen: el próximo load ya pide `@cdn-live` y el loader trae el stamp nuevo.

## Rama `cdn-live`

- Puntero **mutable** a “lo que sirve Buq-Webs y los WP ahora” (todas las marcas v2).
- Fast-forward desde el commit que acaba de publicar el embed.
- No es la rama de producto (`v2/main`). Los PRs siguen yendo a `v2/main`.
- No uses `--force` contra `cdn-live`.
- No la renombres. El `src` de los sitios apunta a `@cdn-live`.

## Checkout: dos POSTs distintos

| Pasarela | Tras pagar, el SDK llama |
|---|---|
| **GafaPay (Stripe / Openpay / Conekta)** | `POST .../reservation/reservate` (`client.reservatePurchase`) |
| **Recurrente** | `POST .../gafapay/initial-purchase` (`client.initialPurchase`) |

No mezclar. `initial-purchase` + Stripe viejo de producción = cargo sin créditos.

El CTA amarillo **Pagar** dispara Recurrente (abre la otra ventana). No uses el botón negro de GafaPay. Tras pagar, el SDK POSTea `initial-purchase` y consulta `initial-purchase-status` hasta que Buq confirma.

## Moneda (Q, €, $)

Los precios salen del `prefijo` / `code3` de la marca (`Q`+`GTQ`, `€`+`EUR`, `$`+`MXN`). El catálogo no asume dólares mexicanos.

## Perfil: cada paquete es una fila

`listUserCredits` identifica cada compra por `purchase_items_id`, no por tipo de crédito. “Mi actividad” muestra el **total** y un slider por paquete.

## Calendario: filtros Servicio y Staff

Van **encendidos por defecto**. En el HTML de Buq-Webs no hace falta `filter-bq-service` / `filter-bq-staff`. Para apagarlos: `="false"`.

Para preseleccionar un servicio (el `?filter_service=Pilates+Reformer` de v1):

```
https://stanzapilates.com/reservar?service=123
https://stanzapilates.com/reservar?filter_service=Pilates+Reformer
```

- URL por **id** (canónico v2, igual que `?location=200`): `?service=123`. También `service_id`, `serviceId` o `filter_service=123`.
- URL por **nombre** (compat v1): `?filter_service=Pilates+Reformer` o `?service=Pilates+Reformer`.
- HTML: `filter-bq-service-default="123"` o `filter-bq-service-default="Pilates Reformer"`.

La URL gana sobre el atributo. El usuario puede cambiar a “Todos”.

## WordPress / Elementor (no Buq-Webs)

El JS es el mismo `@cdn-live` de siempre. **No cambies el `src` en Elementor.**
La muralla CSS contra Hello/Elementor vive **en el SDK** (`theme.css` + widgets),
no en un overlay por sitio. Hard refresh. No hace falta Republish.

## Tags `v2.0.0-rc.N`

Siguen existiendo como **archivo** (rollback humano, no URL de producción). No las pongas en `VITE_GAFA_SDK_V2_URL`.
