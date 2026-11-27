import { vi } from "vitest";
import { installStripeSessionFetchGuard, registerStripeSession } from "../src/sdk/payments/stripeSessionGuard";
import type { GafaPayWidgetProps } from "../src/sdk/payments/gafaPay";

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export function json(data: unknown) { return new Response(JSON.stringify(data), { status: 200 }); }

/** Simulates the IIFE HTTP/DOM contract; emits updated ONLY with client_secret. */
export function stripeHarness() {
  const server = new Map<string, boolean>();
  let serial = 0;
  let respond: ((url: string, body: Record<string, any>) => Promise<Response>) | undefined;
  const network = vi.fn(async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (respond) return respond(String(url), body);
    if (String(url).includes("processinitialpayment")) return json({ message: `tok_${++serial}`, client_secret: `cs_${serial}` });
    server.set(body.tokenInput, body.recurringPayment);
    return json({ message: body.tokenInput, client_secret: `cs_${body.tokenInput.slice(4)}` });
  });
  vi.stubGlobal("fetch", network);
  installStripeSessionFetchGuard();
  return {
    network, server,
    respondWith(fn: typeof respond) { respond = fn; },
    mount(root: Element, eligible = true, props?: GafaPayWidgetProps) {
      const element = document.createElement("stripe-payment-element");
      element.setAttribute("has-recurring-payment", String(eligible));
      const unregister = registerStripeSession(element);
      root.replaceChildren(element);
      let active = true;
      let token = "";
      let secret = "";
      let mounts = 0;
      let input: HTMLInputElement | null = null;
      const update = async (checked: boolean, emitUpdating = true, extra: Record<string, unknown> = {}) => {
        if (emitUpdating) element.dispatchEvent(new Event("initial-payment-updating"));
        try {
          const response = await fetch("https://stripe.test/api/stripe.updateinitialpayment", {
            method: "POST", body: JSON.stringify({ tokenInput: token, recurringPayment: checked, ...extra }),
          });
          if (!response.ok) throw new Error("update failed");
          const data = await response.json();
          if (data.client_secret) {
            secret = data.client_secret;
            element.dispatchEvent(new CustomEvent("initial-payment-updated", { detail: data }));
            props?.onInitialPaymentUpdated?.(data);
          }
          return data;
        } catch (error) {
          element.dispatchEvent(new Event("initial-payment-update-error"));
          return null;
        }
      };
      const ready = (async () => {
        const response = await fetch("https://stripe.test/api/stripe.processinitialpayment", { method: "POST", body: "{}" });
        const data = await response.json();
        if (!data.client_secret || !active) return;
        token = data.message; secret = data.client_secret;
        element.dispatchEvent(new CustomEvent("initial-payment-created", { detail: data }));
        props?.onCheckoutOpenAction?.(data);
        element.innerHTML = `<iframe title="Payment Element"></iframe>${eligible ? '<label><input type="checkbox">Pago Recurrente</label>' : ""}`;
        mounts++;
        input = element.querySelector("input");
        input?.addEventListener("click", () => { void update(input!.checked); });
        // The real IIFE initializes recurringPayment=false, regardless of eligibility.
        await update(false, false);
      })();
      return {
        element, ready, update,
        get input() { return input; }, get secret() { return secret; }, get token() { return token; }, get mounts() { return mounts; },
        unmount() { active = false; unregister(); element.remove(); },
      };
    },
  };
}
