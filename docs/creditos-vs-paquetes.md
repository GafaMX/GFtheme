# Créditos, paquetes y membresías: qué se le enseña al socio

Este archivo existe porque el nombre que devuelve la API para una reserva pagada con
créditos **no es el que el socio reconoce**, y ya nos costó una pantalla mal hecha
(el perfil v2 mostraba "CDMXnew" como si fuera el paquete comprado).

## Los tres conceptos

| Concepto | Qué es | De dónde sale | ¿Se muestra al socio? |
|---|---|---|---|
| **Tipo de crédito** | Etiqueta interna con la que el estudio separa su inventario por ciudad, campaña o convenio (`CDMXnew`, `Corporativo`, `Reto21`). | `credit.name` (`credits.name` en gafa.fit) | **No.** Es gestión interna. |
| **Paquete** | Lo que el socio compró y pagó: "Paquete 10 clases", "Clase suelta". | `purchase_item.item_name` / `purchase_item.buyed.name` | Sí. |
| **Membresía** | Plan recurrente; no consume créditos. | `membership.name` | Sí. |

Un mismo paquete de 10 clases puede otorgar créditos de tipo `CDMXnew`. El socio compró
"Paquete 10 clases"; `CDMXnew` es una etiqueta para el estudio.

## Cómo lo resuelve el SDK

- `listUserCredits()` ya devuelve el nombre bueno: `purchase_item.item_name || credit.name`.
- `listUserReservations()` **solo** trae el tipo (`credit.name`) y su id. Por eso
  `UserReservation` expone `creditId` + `creditTypeName`, y quien pinta la reserva
  resuelve el nombre del paquete cruzando `creditId` contra los créditos del usuario
  (`ProfileWidget` lo hace así). Si no hay cruce, se pinta "Paquete", nunca el tipo.
- El checkout del calendario ya seguía esta regla al listar formas de pago
  (`httpGafaClient.ts`, armado de `paymentOptions`).

## Regla para lo que venga

Nunca pintes `credit.name` / `creditTypeName` en una interfaz de socio. Si el nombre
comercial no se puede resolver, es preferible una etiqueta genérica ("Paquete") o no
mostrar nada.
