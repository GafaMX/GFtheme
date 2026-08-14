# Embed v2 (WordPress / Elementor)

El artefacto canónico es `docs/v2-sdk/gafa-sdk.js` (IIFE con React y CSS adentro).

```bash
cd packages/react-sdk && npm run publish:embed
```

Receta completa: `docs/v2-lanzamiento.md`.

Los contenedores pueden ser `data-gf-theme` (drop-in, reemplaza v1) o `data-gafa-v2`
(mismo shortcode, para no pelear con el SDK v1 si todavía está en el header).

## Entornos

| `BUQ_ENV` | API | Para qué |
|---|---|---|
| `production` (default) | `https://buq.partners/` | Lanzamiento |
| `staging` | `https://buq.com.mx/` | Stripe nuevo + Laravel |
| `development` | `https://buq.technology/` | Dev |

También vale `GAFA_FIT_URL` o `?buq-env=staging`. `GAFAPAY_FRONT_URL` pisa el script de Stripe/PayPal.
