import type { CartLineType } from "../client/types";
import { useCartStore } from "./cartStore";

/**
 * Botones de compra en HTML plano.
 *
 * Cualquier elemento de la pagina del socio puede abrir el checkout con un
 * producto ya cargado, solo con atributos:
 *
 *   <button data-gf-buy data-gf-combo-id="971">Comprar paquete</button>
 *   <button data-gf-buy data-gf-membership-id="358">Suscribirme</button>
 *   <button data-gf-buy data-gf-product-id="12" data-gf-brand="fitspin">Comprar</button>
 *   <a href="#" data-gf-cart>Ver carrito (<span data-gf-cart-count>0</span>)</a>
 *   <button data-gf-account>Mi cuenta</button>
 *
 * Marca y sede son opcionales: sin ellas el checkout resuelve la primera de la
 * compañia, que es lo normal en un sitio de un solo estudio.
 */

export type PurchaseIntent = {
  type: CartLineType;
  id: number;
  brandSlug?: string;
  locationSlug?: string;
};

export type PurchaseButtonsOptions = {
  /** Abre el checkout con el producto ya seleccionado. */
  onPurchase: (intent: PurchaseIntent) => void;
  /** Abre el checkout sin preseleccion (icono/boton de carrito). */
  onOpenCart: () => void;
  /** Abre el popup de cuenta (login / perfil). */
  onOpenAccount?: () => void;
  root?: Document | Element;
};

const BUY_SELECTOR = "[data-gf-buy]";
const CART_SELECTOR = "[data-gf-cart]";
const ACCOUNT_SELECTOR = "[data-gf-account]";
const COUNT_SELECTOR = "[data-gf-cart-count]";

function readIntent(element: Element): PurchaseIntent | null {
  const el = element as HTMLElement;
  const pairs: Array<[CartLineType, string | undefined]> = [
    ["combo", el.dataset.gfComboId],
    ["membership", el.dataset.gfMembershipId],
    ["product", el.dataset.gfProductId],
  ];

  for (const [type, raw] of pairs) {
    if (!raw) continue;
    const id = Number(raw);
    if (!Number.isFinite(id)) continue;
    return {
      type,
      id,
      brandSlug: el.dataset.gfBrand || undefined,
      locationSlug: el.dataset.gfLocation || undefined,
    };
  }

  return null;
}

/** Mantiene los contadores [data-gf-cart-count] al dia con el carrito. */
function renderCartCount(root: Document | Element) {
  const total = useCartStore.getState().lines.reduce((sum, line) => sum + line.amount, 0);
  root.querySelectorAll<HTMLElement>(COUNT_SELECTOR).forEach((node) => {
    node.textContent = String(total);
    // Permite ocultar el badge con CSS cuando el carrito esta vacio.
    node.dataset.gfCartEmpty = total === 0 ? "true" : "false";
  });
}

/**
 * Escucha en delegacion: sirve para botones que el socio pinta despues
 * (sliders, filtros, contenido cargado por AJAX) sin re-inicializar nada.
 */
export function bootstrapPurchaseButtons(options: PurchaseButtonsOptions): () => void {
  if (typeof document === "undefined") return () => undefined;

  const root = options.root ?? document;
  const host = root instanceof Document ? root : root.ownerDocument ?? document;

  const handleClick = (event: Event) => {
    const target = event.target as Element | null;
    if (!target) return;

    const buyButton = target.closest(BUY_SELECTOR);
    if (buyButton && (root === host || root.contains(buyButton))) {
      const intent = readIntent(buyButton);
      if (intent) {
        event.preventDefault();
        options.onPurchase(intent);
        return;
      }
    }

    const cartButton = target.closest(CART_SELECTOR);
    if (cartButton && (root === host || root.contains(cartButton))) {
      event.preventDefault();
      options.onOpenCart();
      return;
    }

    const accountButton = target.closest(ACCOUNT_SELECTOR);
    if (accountButton && options.onOpenAccount && (root === host || root.contains(accountButton))) {
      event.preventDefault();
      options.onOpenAccount();
    }
  };

  host.addEventListener("click", handleClick);
  renderCartCount(root);
  const unsubscribe = useCartStore.subscribe(() => renderCartCount(root));

  return () => {
    host.removeEventListener("click", handleClick);
    unsubscribe();
  };
}
