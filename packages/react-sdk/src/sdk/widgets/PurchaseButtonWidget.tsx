import type { GafaClient } from "../client/types";
import { WidgetShell } from "./WidgetShell";

export type PurchaseButtonWidgetProps = {
  client?: GafaClient;
  hostElement?: Element;
  comboId?: string | null;
  membershipId?: string | null;
  productId?: string | null;
  reservationId?: string | null;
  locationId?: string | null;
  defaultStoreTab?: string | null;
  noLoading?: boolean;
};

export function PurchaseButtonWidget({
  comboId,
  membershipId,
  productId,
  reservationId,
  locationId,
  defaultStoreTab,
  noLoading = false,
}: PurchaseButtonWidgetProps) {
  const target =
    comboId ??
    membershipId ??
    productId ??
    "producto pendiente de configurar";

  return (
    <WidgetShell
      eyebrow="Compra"
      title="Boton de compra"
      description="Este widget conectara botones externos con el checkout del nuevo SDK o con el flujo fancy legacy."
    >
      <button className="gafa-button" type="button">
        Comprar {target}
      </button>
      {locationId ? (
        <p className="gafa-muted">Ubicacion configurada: {locationId}</p>
      ) : null}
      {reservationId || defaultStoreTab || noLoading ? (
        <p className="gafa-muted">
          Opciones legacy detectadas: {reservationId ? `reserva ${reservationId}` : "sin reserva"}
          {defaultStoreTab ? `, tab ${defaultStoreTab}` : ""}
          {noLoading ? ", sin loader externo" : ""}
        </p>
      ) : null}
    </WidgetShell>
  );
}
