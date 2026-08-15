# Replit: montar el SDK v2 en vivo (sin copiar source)

Las páginas V2 en Replit (Fitspin, etc.) **no llevan el TypeScript del SDK**.
Cargan un `<script>` remoto. Los sitios que siguen en v1 no se tocan.

Hay dos URLs. Replit elige con una env var, **sin relanzar toda la app**:

| `GAFA_SDK_V2_URL` | Qué es | Cuándo |
| --- | --- | --- |
| `https://<vite-publico>/src/sdk/embed.ts` | Vite de este repo (`npm run dev`). Cambios en GFtheme se ven al recargar Fitspin. **No hay que publicar.** | Mientras alguien corre Vite en GFtheme (Cursor Cloud / tu máquina) con un túnel público |
| IIFE publicado (`gafa-sdk.js`) | Snapshot. Hay que `publish:embed` + push | Preview estable / WP |

## Qué tiene que hacer Replit (copiar tal cual)

1. **Borrar / dejar de usar** `lib/gafa-react-sdk` (y cualquier copy-paste de `packages/react-sdk/src`). No transpilar el SDK en el build de Replit.
2. **No relanzar** la app multi-sitio. Solo las páginas V2 cambian el script.
3. **Dejar** `[data-gf-options]` / `[data-gafa-options]` y los contenedores (`data-gf-theme` o `data-gafa-v2`).
4. **Quitar** el theme v1 (`main.min.js`) **solo** en esas páginas V2, o usar `data-gafa-v2` si el header todavía carga v1.
5. Inyectar **un** script, leyendo `GAFA_SDK_V2_URL`:

```html
<!-- VIVO (Vite, type=module): -->
<script type="module" src="GAFA_SDK_V2_URL"></script>

<!-- PUBLICADO (IIFE, SIN type=module): -->
<script src="GAFA_SDK_V2_URL"></script>
```

Regla: si la URL termina en `embed.ts` o contiene `:5173` / `vite` → `type="module"`. Si termina en `gafa-sdk.js` → script clásico.

6. Los sitios no-V2 siguen igual.

## Prompt para pegarle al agente de Replit

```
PARA. No copies GFtheme. No transpiles lib/gafa-react-sdk. No relances toda la app.

El SDK v2 ya no vive en este repo. Las páginas V2 (Fitspin y las que ya lo tenían montado local) deben cargarlo con UN script remoto.

1. Quita el montaje local: imports, copies y el folder lib/gafa-react-sdk (o equivalente). El build de Replit no debe incluir packages/react-sdk.

2. Deja data-gf-options y los contenedores (data-gf-theme o data-gafa-v2). No reescribas el HTML de calendario/cuenta/combos.

3. Agrega env GAFA_SDK_V2_URL. En las páginas V2, si la URL termina en .ts o va a un Vite, inyecta:
   <script type="module" src="{GAFA_SDK_V2_URL}"></script>
   Si termina en gafa-sdk.js:
   <script src="{GAFA_SDK_V2_URL}"></script>

4. No cargues el theme v1 (main.min.js) y el v2 a la vez en la misma página, salvo que los nodos v2 usen data-gafa-v2.

5. No toques los sitios que siguen en v1.

6. No hagas redeploy global. Un cambio de env / una línea de script basta. Recargar Fitspin en el navegador.

URL inicial de desarrollo (te la pasa Gabriel cuando el Vite de GFtheme esté en un túnel):
  https://HOST/src/sdk/embed.ts
```

## Qué corre en GFtheme (este repo)

```sh
cd packages/react-sdk
npm run dev          # :5173, CORS abierto
# Túnel público (cloudflared / ngrok) → esa HTTPS es GAFA_SDK_V2_URL + /src/sdk/embed.ts
```

Sin túnel, Replit no alcanza `localhost` de Cursor. Publicar a jsDelivr **no** es en vivo: es un snapshot.
