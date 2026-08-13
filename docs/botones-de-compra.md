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

`enablePurchaseButtons()` devuelve una función para desactivarlo.

Usa delegación de eventos, así que también funciona con botones que aparezcan
después (sliders, filtros, contenido cargado por AJAX).

## Atributos

| Atributo | Para qué sirve |
| --- | --- |
| `data-gf-buy` | Marca el elemento como botón de compra (obligatorio) |
| `data-gf-combo-id` | ID del paquete |
| `data-gf-membership-id` | ID de la membresía |
| `data-gf-product-id` | ID del producto |
| `data-gf-brand` | Slug de marca (opcional) |
| `data-gf-location` | Slug de sede (opcional) |
| `data-gf-cart` | Abre el carrito guardado, sin preseleccionar nada |
| `data-gf-cart-count` | Se rellena solo con el número de artículos |
| `data-gf-account` | Abre el popup de cuenta (login o perfil) |

Marca y sede son opcionales: sin ellas se usa la primera de la compañía, que es
lo normal en un sitio de un solo estudio. En sitios multi-marca conviene
declararlas.

## Ejemplos

```html
<button data-gf-buy data-gf-combo-id="971">Comprar paquete</button>

<button data-gf-buy data-gf-membership-id="358">Suscribirme</button>

<a href="#" data-gf-buy data-gf-product-id="12" data-gf-brand="fitspin" data-gf-location="fitspin-lomas">
  Comprar toalla
</a>

<a href="#" data-gf-cart>
  Carrito (<span data-gf-cart-count>0</span>)
</a>

<button type="button" data-gf-account>Mi cuenta</button>
```

El contador se actualiza solo cuando cambia el carrito. Para ocultar el badge
vacío:

```css
[data-gf-cart-count][data-gf-cart-empty="true"] { display: none; }
```

## Qué pasa al hacer clic

1. Se abre el checkout con ese producto ya en el carrito.
2. El socio puede agregar más productos o cambiar cantidades.
3. Al pagar, si no hay sesión se pide login **dentro** del checkout, sin perder
   el carrito.
4. El carrito se guarda en `localStorage`: se puede cerrar, seguir navegando y
   volver más tarde.

Solo se necesita el **ID**. El nombre, precio y vigencia salen del catálogo que
ya carga el checkout, así que no hay que duplicar precios en el HTML (ni se
quedan desactualizados cuando cambian en el admin).
