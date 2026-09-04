# THEME.colors — paleta oficial del SDK v2

Instalación completa (Buq-Webs / WordPress): [`v2-agente.md`](v2-agente.md).

El SDK es la única fuente de color de calendario, login, cuenta, reserva,
carrito y checkout. **No** hace falta CSS de overlays, `MutationObserver`,
selectores internos ni pelear especificidad.

El botón `Entrar` / `Mi cuenta` se personaliza con `THEME.headerControls`
(tipografía, alto, padding, fondo, borde). Contrato: [`v2-agente.md`](v2-agente.md) §5.1.

## Contrato

```json
{
  "THEME": {
    "colorScheme": "dark",
    "allowUserColorScheme": false,
    "logoUrl": "https://…/wordmark.png",
    "logoUrlDark": "https://…/wordmark-light.png",
    "logoMaxWidth": 220,
    "logoMaxHeight": 110,
    "colors": {
      "brand": "#F3D15E",
      "accent": "#F3D15E",
      "background": "#171C35",
      "surface": "#1E2444",
      "surfaceRaised": "#252C50",
      "text": "#FFFFFF",
      "mutedText": "#AEB4CB",
      "border": "#394165",
      "inputBackground": "#171C35",
      "inputText": "#FFFFFF",
      "inputBorder": "#394165"
    }
  }
}
```

Eso vive en `data-gf-options`. Tokens omitidos caen al default del `colorScheme`.
Vacío (`""`) también. Nunca quedan `undefined` ni transparentes.

## Tokens CSS

| `THEME.colors` | Variable | Uso |
| --- | --- | --- |
| `brand` | `--gafa-color-primary` y alias `--gafa-color-brand` | CTA, tabs activos |
| `accent` | `--gafa-color-accent` | Focus, detalles |
| `background` | `--gafa-color-background` | Lienzo |
| `surface` | `--gafa-color-surface` | Tarjetas, paneles, modal |
| `surfaceRaised` | `--gafa-color-surface-raised` | Capas elevadas, carrito |
| `text` | `--gafa-color-text` | Texto principal |
| `mutedText` | `--gafa-color-muted-text` | Secundario |
| `border` | `--gafa-color-border` | Bordes |
| `inputBackground` | `--gafa-color-input-background` | Campos (default: surface) |
| `inputText` | `--gafa-color-input-text` | Texto de campos (default: text) |
| `inputBorder` | `--gafa-color-input-border` | Borde de campos (default: border) |
| `success` / `warning` / `danger` | `--gafa-color-success` etc. | Estados (si no van, se derivan) |

`--gafa-color-primary` **no se renombra**. `brand` es el valor de config y el alias CSS.
`colors.primary` (nombre viejo del demo) se acepta si no viene `brand`.

## Lock vs Fitspin

- **The Base / ATLIC:** `colorScheme: "dark"|"light"` + `allowUserColorScheme: false`.
  Se ignora `html.fitspin-dark`, `document.documentElement.dataset.theme`,
  `prefers-color-scheme` y `--sdk-*`.
- **Fitspin:** no bloquees. THEME light + `logoUrl` / `logoUrlDark`. El host
  sigue pintando `--sdk-*`.

## Qué no pinta esto

- Tipografía, radios, spacing, layout.
- El iframe de Stripe / GafaPay (el Card Element no hereda CSS).
- Contraste: un dorado sobre navy puede quedar bajo; el SDK no rechaza el THEME.

## Compatibilidad

- Solo `brand` + `accent`: como hoy, el resto se deriva.
- Sin `colors`: theme predeterminado actual.
- IDs, prefiltros, carrito y checkout no cambian.
