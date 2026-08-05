import { useState } from "react";
import type { GafaClient } from "../client/types";
import { WidgetShell } from "./WidgetShell";
import { FancyOverlay } from "./FancyOverlay";

export type PurchaseButtonWidgetProps = {
  client?: GafaClient;
  hostElement?: Element;
  brandSlug?: string;
  comboId?: string | null;
  membershipId?: string | null;
  productId?: string | null;
  reservationId?: string | null;
  locationId?: string | null;
  defaultStoreTab?: string | null;
  noLoading?: boolean;
};

export function PurchaseButtonWidget({
  client,
  brandSlug,
  comboId,
  membershipId,
  productId,
  reservationId,
  locationId,
  defaultStoreTab,
  noLoading = false,
}: PurchaseButtonWidgetProps) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const label = comboId
    ? `paquete ${comboId}`
    : membershipId
      ? `membresia ${membershipId}`
      : productId
        ? `producto ${productId}`
        : "la tienda";

  const canBuy = Boolean(client && brandSlug);

  return (
    <WidgetShell
      eyebrow="Compra"
      title="Boton de compra"
      description="Abre el checkout para un paquete, membresia, producto o la tienda general."
    >
      <button className="gafa-sdk-button" type="button" disabled={!canBuy} onClick={() => setCheckoutOpen(true)}>
        Comprar {label}
      </button>

      {!brandSlug ? (
        <p className="gafa-sdk-state gafa-sdk-state--error">Falta configurar brandSlug para poder comprar.</p>
      ) : null}

      {checkoutOpen && client && brandSlug ? (
        <FancyOverlay
          title={`Comprar ${label}`}
          description="Termina tu compra: inicia sesion si falta y elige tu metodo de pago."
          run={() =>
            client.openCheckout({
              brandSlug,
              locationId: locationId ?? undefined,
              targetSelector: '[data-gf-theme="fancy"]',
              payload: {
                combo_id: comboId ?? undefined,
                membership_id: membershipId ?? undefined,
                product_id: productId ?? undefined,
                reservation_id: reservationId ?? undefined,
                default_store_tab: defaultStoreTab ?? undefined,
                no_loading: noLoading,
              },
            })
          }
          onClose={() => setCheckoutOpen(false)}
        />
      ) : null}
    </WidgetShell>
  );
}
