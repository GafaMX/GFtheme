# SDK Hub

Control plane del SDK V2. **No es Laravel.**

| Host | Qué es |
| --- | --- |
| `buq.partners` | API de reservas, pagos, catálogo (gafa.fit). No se toca. |
| **`hub.buq.partners`** | Hub: admin, ingest, catálogo, versiones. |
| `hub.buq.com.mx` | Staging del Hub. |

Código: [`packages/sdk-hub`](../../packages/sdk-hub). El SDK emite a `HUB_URL` (default del entorno), **nunca** a `GAFA_FIT_URL`.

## Qué controlas desde el Hub

- Dónde está instalado el V2 (host, compañía, marca, salón, versión, widgets)
- Cómo se usa (calendario, login, reserva, compra)
- Catálogo de widgets y snippets
- Más adelante: remote config y lealtad

## Local

```sh
cd packages/sdk-hub
npm install
cp .dev.vars.example .dev.vars
npx wrangler d1 migrations apply sdk-hub --local
npm run dev
```

Admin: http://127.0.0.1:8787 — password `buq-hub-dev`.

En el sitio / demo del SDK:

```json
{
  "GAFA_FIT_URL": "https://buq.partners",
  "COMPANY_ID": 80,
  "HUB_URL": "http://127.0.0.1:8787"
}
```

O `?hub-url=http://127.0.0.1:8787`. `ANALYTICS: false` apaga el tracker.

## Docs

- [Instalación del embed](install.md) — el contrato de un script no cambia
- [Catálogo de widgets](widgets.md)
- [Contrato de eventos](events.md)
- [Cómo se publica el JS](../v2-lanzamiento.md)
