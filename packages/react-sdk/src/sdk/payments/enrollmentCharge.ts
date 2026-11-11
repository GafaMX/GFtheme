import {
  loadGafaPay,
  mountGafaPayWidget,
  triggerGafaPayConfirm,
  waitForWidgetContent,
  widgetContentTimeoutMs,
  type GafaPayCredentials,
  type GafaPayGeneralData,
  type GafaPayLineItem,
  type GafaPayOrder,
  type GafaPaySuccess,
} from "./gafaPay";

export type EnrollmentChargeRequest = {
  order: GafaPayOrder;
  generalData: GafaPayGeneralData;
  credentials: GafaPayCredentials;
  gafaPayFrontUrl?: string;
  slug?: string;
  timeoutMs?: number;
};

/**
 * Segundo cobro (matrícula): usa la tarjeta que GafaPay acaba de guardar
 * en el primer cargo. No pinta formulario; si no hay tarjeta guardada o
 * el proveedor no confirma, falla para que el checkout avise en español.
 */
export async function chargeEnrollmentWithSavedCard(
  input: EnrollmentChargeRequest,
): Promise<GafaPaySuccess> {
  if (typeof document === "undefined") {
    throw new Error("GafaPay solo funciona en navegador.");
  }
  const slug = input.slug ?? "stripe";
  const host = document.createElement("div");
  host.setAttribute("data-gafa-enrollment-charge", "true");
  host.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;";
  document.body.appendChild(host);

  const islandRef: { unmount?: () => void } = {};
  try {
    const runtime = await loadGafaPay({
      ...input.credentials,
      scriptUrl: input.gafaPayFrontUrl,
    });
    const result = await new Promise<GafaPaySuccess>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error("No pudimos cobrar la matrícula con la tarjeta guardada."));
      }, input.timeoutMs ?? Math.max(widgetContentTimeoutMs() + 4000, 16000));

      const finish = (fn: () => void) => {
        window.clearTimeout(timeout);
        fn();
      };

      const island = mountGafaPayWidget(runtime, host, slug, {
        order: input.order,
        generalData: input.generalData,
        termsAndConditions: true,
        hasRecurringPayment: false,
        paymentFrequency: null,
        onStartPayAction: () => undefined,
        onGafaPaySuccessAction: (payment) => finish(() => resolve(payment)),
        onGafaPayErrAction: ({ message }) =>
          finish(() => reject(new Error(message ?? "No pudimos cobrar la matrícula."))),
      });
      islandRef.unmount = island.unmount;

      void waitForWidgetContent(host, widgetContentTimeoutMs())
        .then(async () => {
          clickSavedCard(host);
          const triggered = await triggerGafaPayConfirm(slug, host);
          if (!triggered) {
            finish(() => reject(new Error("No pudimos cobrar la matrícula con la tarjeta guardada.")));
          }
        })
        .catch((error: unknown) =>
          finish(() =>
            reject(error instanceof Error ? error : new Error("No pudimos cobrar la matrícula.")),
          ),
        );
    });
    return result;
  } finally {
    try {
      islandRef.unmount?.();
    } catch {
      /* isla ya fuera */
    }
    host.remove();
  }
}

function clickSavedCard(root: ParentNode): void {
  const saved =
    root.querySelector<HTMLElement>(".gafapay-elements__container.is-cardList [data-card], .gafapay-elements .is-cardList button, .gafapay-elements__cards button") ??
    root.querySelector<HTMLElement>("[data-saved-card], .gafapay-saved-card");
  saved?.click();
}

export function enrollmentLineItems(
  name: string,
  unitPrice: number,
  productId: number,
): GafaPayLineItem[] {
  return [
    {
      name,
      unitPrice,
      quantity: 1,
      product_type: "App\\Models\\Combos\\Combos",
      product_id: productId,
      height: 1,
      length: 1,
      weight: 1,
      width: 1,
    },
  ];
}
