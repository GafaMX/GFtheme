# Catálogo de widgets

Cada elemento se instala igual: un `<section data-gf-theme="SHORTCODE">`. El registry vive en `packages/react-sdk/src/sdk/widgets/registry.ts`. El Hub lee la misma lista (tabla `widgets`). En el admin, cada tarjeta abre la guía que ya existe (`docs/v2-agente.md`) en otra pestaña.

| Shortcode | Estado | Qué es |
| --- | --- | --- |
| `meetings-calendar` | stable | Calendario |
| `combo-list` | stable | Paquetes |
| `membership-list` | stable | Membresías |
| `staff-list` | stable | Coaches |
| `service-list` | stable | Servicios |
| `login` / `register` / `password-recovery` | stable | Auth inline |
| `login-register` | stable | Header (Mi cuenta + carrito) |
| `login-register-pages` | stable | Auth en página |
| `profile-info` | stable | Perfil |
| `purchase-button` | stable | Botón de compra |
| `fancy` | stable | Host legacy de checkout |
| `concierge` | stable | Barra + chat. La enciende `CONCIERGE` (`true` / `{}` / partial) desde el Hub o el HTML; sin nodo se cuelga del `body`. `data-gf-concierge="off"` excluye una página. |

Un widget nuevo (Concierge, un template, un tipo de elemento) es **una entrada en el registry**, no un bundle aparte.
