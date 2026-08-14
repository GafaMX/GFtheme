# Botones de compra en HTML

Cualquier botón, link o tarjeta de la página del socio puede abrir el checkout
del SDK v2 con un producto ya cargado. No hace falta React ni montar un widget:
basta con atributos `data-*`.

## Activarlo

```html
<script type="module">
  const sdk = GafaSdk.createGafaSdk(window.GFThemeOptions);
  sdk.enablePurchaseButtons(); // escucha toda la página
</script>
```

`enablePurchaseButtons()` devuelve una función para desactivarlo. Llamarlo
más de una vez (React StrictMode, cambio de tema) **reemplaza** el listener
anterior: no se apilan overlays.

Usa delegación de eventos, así que también funciona con botones que aparezcan
después (sliders, filtros, contenido cargado por AJAX).

## Atributos

| Atributo | Para qué sirve |
| --- | --- |
| `data-gf-buy` | Marca el elemento como botón de compra (obligatorio) |
| `data-gf-combo-id` | ID del paquete en gafa.fit |
| `data-gf-membership-id` | ID de la membresía en gafa.fit |
| `data-gf-product-id` | ID del producto en gafa.fit |
| `data-gf-brand` | Slug de marca (opcional; si no, se busca el ID en todas las marcas) |
| `data-gf-location` | Slug de sede (opcional) |
| `data-gf-location-id` | ID numérico de sede (opcional; alternativa al slug) |
| `data-gf-cart` | Abre el carrito guardado, sin preseleccionar nada |
| `data-gf-cart-count` | Se rellena solo con el número de artículos |
| `data-gf-account` | Abre el popup de cuenta (login o perfil) |

También se leen los alias legacy `data-bq-combo-id`, `data-bq-membership-id`,
`data-bq-product-id` y `data-gf-theme="purchase-button"`.

El **ID tiene que ser el de gafa.fit** (el mismo que sale en el admin /
`/brand/{slug}/combos`), no un id interno del sitio. En compañías con más de
una marca (Fitspin: `fitspin` y `fitspin-cancun`) el checkout busca el ID en
todas; igual conviene poner `data-gf-brand` y `data-gf-location` en cada
tarjeta para cobrar en la sede correcta.

## Ejemplos

```html
<button data-gf-buy data-gf-combo-id="971">Comprar paquete</button>

<button data-gf-buy data-gf-membership-id="358">Suscribirme</button>

<a href="#" data-gf-buy data-gf-product-id="12" data-gf-brand="fitspin" data-gf-location="fitspin-lomas">
  Comprar toalla
</a>

<a href="#" data-gf-cart>
  Carrito (<span data-gf-cart-count>0</span>)</a>

<button type="button" data-gf-account>Mi cuenta</button>
```

React:

```jsx
<button
  type="button"
  data-gf-buy
  data-gf-combo-id={pkg.comboId}
  data-gf-membership-id={pkg.membershipId}
  data-gf-brand="fitspin"
  data-gf-location-id={122}
>
  Comprar
</button>
```

El contador se actualiza solo cuando cambia el carrito. Para ocultar el badge
vacío:

```css
[data-gf-cart-count][data-gf-cart-empty="true"] { display: none; }
```

## Qué pasa al hacer clic

1. Se abre el checkout **directo al paso de pagar**, con ese producto ya en el
   carrito. No se muestra la lista de paquetes.
2. Si el socio quiere agregar más, usa **«Agregar otro paquete o membresía»**
   (vuelve al catálogo) o compra otro desde la página de productos.
3. Al pagar, si no hay sesión se pide login **dentro** del checkout, sin perder
   el carrito.
4. El carrito se guarda en `localStorage`: se puede cerrar, seguir navegando y
   volver más tarde.

El icono de carrito del header (`data-gf-cart` / `mountHeaderControls`) sí
abre el catálogo + pedido, porque ahí no hay un producto recién elegido.

Solo se necesita el **ID**. El nombre, precio y vigencia salen del catálogo
de gafa.fit, así que no hay que duplicar precios en el HTML.
