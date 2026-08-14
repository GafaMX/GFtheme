# Embed v2 (WordPress / Elementor)

Un `<script>` con React adentro. No hay que tocar el theme Hello.

```bash
cd packages/react-sdk && npm run build:embed
```

Salida: `gafa-embed.js` + `gafa-embed.css`.

## Entornos

| `BUQ_ENV` | API | Para qué |
|---|---|---|
| `production` (default) | `https://buq.partners/` | Lanzamiento |
| `staging` | `https://buq.com.mx/` | Stripe nuevo + Laravel |
| `development` | `https://buq.technology/` | Dev |

También vale `GAFA_FIT_URL` o `?buq-env=staging`. `GAFAPAY_FRONT_URL` pisa el script de Stripe/PayPal.

Los contenedores son `data-gafa-v2`, no `data-gf-theme`, para no pelear con el SDK v1 del header.

Credenciales (`COMPANY_ID`, `API_CLIENT`, `API_SECRET`) salen del `data-gf-options` que el sitio ya tiene, o de la compañía de prueba del entorno. No las hardcodees en este repo.
