import type { GafaClient } from "../client/types";
import { WidgetShell } from "./WidgetShell";

export type PurchaseButtonWidgetProps = {
  client?: GafaClient;
  hostElement?: Element;
  brandSlug?: string;
  comboId?: string | null;
  membershipId?: string | null;
  productId?: string | null;
  reservationId?: string | null;
  locationId?: string | number | null;
  defaultStoreTab?: string | null;
  noLoading?: boolean;
  /** Abre el checkout nativo (ya no el Fancy v1). */
  onOpenCheckout?: () => void;
};

export function PurchaseButtonWidget({
  comboId,
  membershipId,
  productId,
  onOpenCheckout,
}: PurchaseButtonWidgetProps) {
  const label = comboId
    ? `paquete ${comboId}`
    : membershipId
      ? `membresia ${membershipId}`
      : productId
        ? `producto ${productId}`
        : "la tienda";

  const canBuy = Boolean(onOpenCheckout);

  return (
    <WidgetShell
      eyebrow="Compra"
      title="Boton de compra"
      description="Abre el checkout para un paquete, membresia, producto o la tienda general."
    >
      <button className="gafa-sdk-button" type="button" disabled={!canBuy} onClick={() => onOpenCheckout?.()}>
        Comprar {label}
      </button>
    </WidgetShell>
  );
}
