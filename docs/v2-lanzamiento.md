# Cómo lanzar el SDK V2 sin Replit

Replit no es el canal de V2. Relanzar Replit reinicia **toda** la app multi-sitio
(Fitspin y el resto). V2 se publica como **un JS**, igual que el theme v1
(`dist/main.min.js` → `buq-sdk.azurewebsites.net`).

Los sitios WordPress **no cambian de markup**: siguen `data-gf-options` +
`data-gf-theme`. Solo cambia el `src` del script.

## Modelo

```
packages/react-sdk/src  →  npm run publish:embed  →  docs/v2-sdk/gafa-sdk.js
                                                      ↓
                         jsDelivr / GitHub Pages / Azure /v2/
                                                      ↓
                         Fitspin WP (un <script src>, una vez)
```

| Qué | V1 (producción hoy) | V2 |
| --- | --- | --- |
| Artefacto | `dist/main.min.js` (commiteado) | `docs/v2-sdk/gafa-sdk.js` (commiteado) |
| React | Va **dentro** del bundle | Va **dentro** del IIFE (`vite.embed.config.ts`). El build de librería (`vite.config.ts`) sigue dejando React como peer; **ese no se pega en WP**. |
| Host | Azure `buq-sdk*.azurewebsites.net` | jsDelivr desde este repo (inmediato) o el mismo Azure en `/v2/` |
| Replit | No aplica | **No aplica.** No copiar `packages/react-sdk/src` a `lib/gafa-react-sdk`. |

Replit **sí** puede seguir teniendo Fitspin (y otros) en V2, pero **sin** copiar
`packages/react-sdk/src`. El preview V2 de Replit carga un `<script src>` remoto.
Receta para el agente de Replit: `docs/v2-replit.md`.

- **En vivo (sin publicar):** Vite de este repo + túnel → Replit pone
  `GAFA_SDK_V2_URL=https://<host>/src/sdk/embed.ts` (`type="module"`). Recargar
  Fitspin. No relanzar Replit.
- **Snapshot:** `publish:embed` + IIFE en jsDelivr / Azure (WordPress, o Replit
  cuando quieras congelar).

## Receta para el agente de Cursor (cada cambio V2)

En `packages/react-sdk`:

```sh
npm test && npm run typecheck && npm run publish:embed
```

Commit de `docs/v2-sdk/` (el JS + `VERSION.txt`) en la rama V2. **No mergear a
`master`**: `master` es el theme legacy de producción.

jsDelivr sirve el archivo público en cuanto está en GitHub:

```
https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@<rama-o-sha>/docs/v2-sdk/gafa-sdk.js
```

La rama durable es `v2/main`:

```
https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@v2/main/docs/v2-sdk/gafa-sdk.js
```

Caché de jsDelivr: una rama se cachea ~12 h en el CDN (7 días en el navegador).
Después de cada `publish:embed` + push, purgar:

```
https://purge.jsdelivr.net/gh/GafaMX/GFtheme@v2/main/docs/v2-sdk/gafa-sdk.js
```

Para saltarte la caché (preview puntual) usa el SHA del commit que tiene el JS:

```
https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@<sha>/docs/v2-sdk/gafa-sdk.js
```

## Cambio de una vez en WordPress (Fitspin y cualquier socio V2)

En el theme / header:

1. **Quita** el script del theme v1 (`main.min.js` / `main.js` de Azure o `gafa.fit/sdk`).
2. **No quites** `[data-gf-options]` ni los `data-gf-theme`.
3. **Agrega** el script de `docs/v2-sdk/snippet.html`.
4. Opcional: deja `https://buq.partners/sdk/dist/main.js` (`window.GafaFitSDK`, el
   cliente API) solo si hace falta el fancy legacy. El checkout nativo V2 **no**
   lo necesita. **No** cargues el theme v1 y el IIFE V2 a la vez: montarían los
   mismos nodos dos veces.

Eso es un cambio de una línea. Los siguientes deploys V2 **no tocan WP** ni Replit:
se reemplaza `gafa-sdk.js` en git.

## GitHub Action (sin el agente)

`Actions` → **Publish V2 embed SDK** → `Run workflow` en la rama V2.
Hace test + typecheck + `publish:embed` y commitea `docs/v2-sdk/` si cambió.

No corre en push a `master`. No hay deploy automático del legacy.

## Azure (mismo CDN que v1)

Cuando haya credenciales del app `buq-sdk` / `buq-sdk-dev`, copiar
`docs/v2-sdk/gafa-sdk.js` a `/v2/gafa-sdk.js`. URL de producción entonces:

```
https://buq-sdk.azurewebsites.net/v2/gafa-sdk.js
```

Hasta entonces jsDelivr es suficiente: el repo es público.

## Qué no hacer

- Pedir a Replit que copie `packages/react-sdk/src` y transpila ahí.
- Relanzar la app Replit “porque cambió V2”.
- Publicar V2 con el `vite.config.ts` de librería (React queda externo; WP no
  tiene React 19).
- Mergear el IIFE a `master` junto con el theme v1 sin revisión: conviven por URL,
  no por el mismo `dist/main.min.js`.
