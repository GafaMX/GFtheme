# Instalar el SDK V2

Sigue siendo **un script**. El Hub no cambia el markup.

```html
<script src="https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@sdk-live/docs/v2-sdk/gafa-sdk.js"></script>
<script data-gf-options type="application/json">
  {
    "GAFA_FIT_URL": "https://buq.partners",
    "COMPANY_ID": 80,
    "API_CLIENT": "…",
    "API_SECRET": "…"
  }
</script>
<section data-gf-theme="meetings-calendar" filter-bq-location></section>
```

`GAFA_FIT_URL` es Laravel. El tracker usa solo `HUB_URL` (default `https://hub.buq.partners`).

| Opción | Para qué |
| --- | --- |
| `HUB_URL` | Origen del Hub. Local: `http://127.0.0.1:8787` |
| `ANALYTICS` | `false` apaga heartbeats y eventos |
| `?hub-url=` | Pisa `HUB_URL` en páginas de prueba |

## Widgets

El shortcode es `data-gf-theme` (o `data-gafa-v2`). Concierge, cuando exista:

```html
<section data-gf-theme="concierge" data-bq-brand="fitspin"></section>
```

Lista: [widgets.md](widgets.md). Receta de hosts: [v2-embed](../v2-embed/README.md).
