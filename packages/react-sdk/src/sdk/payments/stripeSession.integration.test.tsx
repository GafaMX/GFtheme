import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CheckoutModal } from "../widgets/CheckoutModal";
import { useCartStore, type CartLine } from "../cart/cartStore";
import type { GafaClient, CheckoutConfig } from "../client/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mountGafaPayWidget, waitForWidgetContent, triggerGafaPayConfirm, notifyStripeDiscountAdded,
  type GafaPayWidgetProps, type GafaPayIsland,
} from "./gafaPay";
import { stripeSessionStatus, resetStripeSessionFetchGuardForTests, type StripeCheckoutState } from "./stripeSessionGuard";
import { bindStripeMembershipRecurrence, syncGafaPayMembershipToggles } from "../cart/membershipPayOptions";

// Keep the actual mount, session preparation, callbacks and DOM. Only script loading is replaced.
vi.mock("./gafaPay", async (original) => ({
  ...await original<typeof import("./gafaPay")>(),
  loadGafaPay: async () => ({
    React: { createElement: () => null },
    ReactDOM: { render: () => undefined, unmountComponentAtNode: () => true }, elements: {},
  }),
}));

const API = "https://payments.example.test/api/stripe.";
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const post = async (path: string, body: object, api = API) => {
  const response = await fetch(api + path, {
  method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer fixture" }, body: JSON.stringify(body),
});
  const data = await response.json();
  if (!response.ok) throw data;
  return data;
};

type Payment = { message: string; client_secret: string };
const initStripe = vi.fn();
const confirm = vi.fn();
let formMounts = 0;
let bootstrapDeliveryDelayMs = 0;
let capturedActions: any[] = [];

/**
 * Fixture del contrato del IIFE f7cca745 (vw/hw/L0): key=secret, saveCard local
 * false, update en el efecto de montaje, eventos DOM y complete antes de confirm.
 * Reinicia estado React de verdad; no sustituye el remount por variables.
 */
function IifeForm({ host, props, payment, setPayment, recurring, setRecurring }: {
  host: HTMLElement; props: GafaPayWidgetProps; payment: Payment; setPayment: (data: Payment) => void;
  recurring: boolean; setRecurring: (value: boolean) => void;
}) {
  const [saveCard, setSaveCard] = useState(false);
  const [busy, setBusy] = useState(true);
  const mount = useRef<HTMLDivElement>(null);
  const actions = useRef<any>(undefined);
  useEffect(() => {
    // vw recibe el evento en window y cambia token + key del provider.
    const onDiscount = (event: Event) => {
      const data = (event as CustomEvent).detail;
      setPayment({ message: data.checkout_token, client_secret: data.client_secret });
    };
    window.addEventListener("buq__discount_added", onDiscount);
    return () => window.removeEventListener("buq__discount_added", onDiscount);
  }, []);
  useEffect(() => {
    formMounts += 1;
    const sdk = (window as any).Stripe().initCheckoutElementsSdk({ clientSecret: payment.client_secret });
    const element = sdk.createPaymentElement();
    element.mount(mount.current);
    void sdk.loadActions().then((result: any) => { actions.current = result.actions; capturedActions.push(result.actions); });
    return () => element.destroy();
  }, []);
  useEffect(() => {
    setBusy(true);
    void post("updateinitialpayment", updateBody(props, payment.message, saveCard, recurring), `${props.apiUrl}/api/stripe.`).then((data) => {
      if (data.client_secret) {
        setPayment(data);
        host.dispatchEvent(new CustomEvent("initial-payment-updated", { detail: data }));
      }
      setBusy(false);
    });
  }, [recurring]);
  return <form onSubmit={async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await post("completeinitialpayment", { tokenInput: payment.message, saveCard }, `${props.apiUrl}/api/stripe.`);
      await actions.current.confirm();
    } catch (error) { host.dispatchEvent(new CustomEvent("payment-error", { detail: error })); }
    finally { setBusy(false); }
  }}>
    <div ref={mount} />
    <label>Pago Recurrente<input type="checkbox" checked={recurring} onChange={(event) => {
      if (event.target.checked) setSaveCard(true);
      setRecurring(event.target.checked);
    }} /></label>
    <button type="submit" disabled={busy}>Pagar</button>
  </form>;
}

function updateBody(props: GafaPayWidgetProps, tokenInput: string, saveCard: boolean, recurringPayment: boolean) {
  return {
    customer_name: props.order.customerName, customer_email: props.order.customerEmail || "",
    customer_phone: props.order.customerPhone || "", customer_first_name: props.customerFirstName,
    customer_last_name: props.customerLastName, lineItems: props.order.lineItems,
    saveCard, tokenInput, address: "0", ...props.generalData, recurringPayment,
    paymentFrequency: Number.parseInt(props.paymentFrequency || "30", 10), currency: "mxn",
  };
}

function Iife({ host, props }: { host: HTMLElement; props: GafaPayWidgetProps }) {
  const [payment, setPayment] = useState<Payment>();
  const [recurring, setRecurring] = useState(false);
  useEffect(() => {
    void post("processinitialpayment", {
      customer_name: props.order.customerName, customer_email: props.order.customerEmail || "",
      lineItems: props.order.lineItems,
    }, `${props.apiUrl}/api/stripe.`).then((data) => {
      if (!data.client_secret) return;
      const deliver = () => {
        setPayment(data);
        host.dispatchEvent(new CustomEvent("initial-payment-created", { detail: data }));
      };
      if (bootstrapDeliveryDelayMs) setTimeout(deliver, bootstrapDeliveryDelayMs);
      else deliver();
    }).catch((error) => host.dispatchEvent(new CustomEvent("payment-error", { detail: error })));
  }, []);
  return payment
    ? <IifeForm key={payment.client_secret} host={host} props={props} payment={payment} setPayment={setPayment} recurring={recurring} setRecurring={setRecurring} />
    : <span>Cargando...</span>;
}

let nextProps: GafaPayWidgetProps;
class IifeElement extends HTMLElement {
  root?: Root;
  connectedCallback() {
    this.root = createRoot(this);
    const props = {
      apiUrl: this.getAttribute("api-url")!,
      order: {
        customerName: this.getAttribute("customer-name")!, customerEmail: this.getAttribute("customer-email")!,
        customerPhone: this.getAttribute("customer-phone") || undefined,
        lineItems: JSON.parse(this.getAttribute("line-items")!), currency: "mxn",
      },
      customerFirstName: this.getAttribute("customer-first-name") || undefined,
      customerLastName: this.getAttribute("customer-last-name") || undefined,
      generalData: JSON.parse(this.getAttribute("general-data")!),
      paymentFrequency: this.getAttribute("payment-frequency"),
    } as GafaPayWidgetProps;
    this.root.render(<Iife host={this} props={props} />);
  }
  disconnectedCallback() { this.root?.unmount(); }
}
customElements.define("stripe-payment-element", IifeElement);

const runtime = {
  React: { createElement: () => null },
  ReactDOM: { render: () => undefined, unmountComponentAtNode: () => true }, elements: {},
};

describe("coordinación Stripe con consumidor React y eventos", () => {
  const nativeFetch = globalThis.fetch;
  let island: GafaPayIsland | undefined;
  let box: HTMLDivElement;
  let checkout: StripeCheckoutState;
  let network: ReturnType<typeof vi.fn>;
  let purchase: ReturnType<typeof vi.fn>;
  const calls: { path: string; body: Record<string, any>; authorization?: string | null }[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    initStripe.mockReset(); confirm.mockReset(); formMounts = 0; calls.length = 0;
    checkout = {}; bootstrapDeliveryDelayMs = 0; capturedActions = [];
    box = document.createElement("div"); document.body.appendChild(box);
    purchase = vi.fn(async () => undefined);
    network = vi.fn();
    (window as any).Stripe = () => ({
      initCheckoutElementsSdk({ clientSecret }: { clientSecret: string }) {
        initStripe(clientSecret);
        return {
          async loadActions() { return { type: "success", actions: { confirm: async () => {
            await confirm(clientSecret); return { type: "success" };
          } } }; },
          createPaymentElement() {
            let frame: HTMLIFrameElement | undefined;
            let ready: (() => void) | undefined;
            return {
              on(name: string, callback: () => void) { if (name === "ready") ready = callback; },
              mount(node: Element) {
                frame = document.createElement("iframe"); frame.title = "Payment Element";
                frame.dataset.secret = clientSecret; frame.style.height = "180px";
                node.appendChild(frame); ready?.();
              },
              destroy() { frame?.remove(); },
            };
          },
        };
      },
    });
    window.fetch = (async (input, init) => {
      const path = String(input).split("stripe.")[1];
      const body = JSON.parse(String(init?.body)); calls.push({ path, body, ...(path === "completeinitialpayment" ? {} : { authorization: new Headers(init?.headers).get("Authorization") }) });
      return network(path, body);
    }) as typeof fetch;
  });
  afterEach(async () => {
    cleanup(); useCartStore.setState({ lines: [], reservation: null });
    await act(async () => island?.unmount()); island = undefined;
    box.remove(); resetStripeSessionFetchGuardForTests(); globalThis.fetch = nativeFetch;
    vi.useRealTimers();
  });
  async function mount(quantity: number) {
    nextProps = {
      order: { customerName: "Ana", customerEmail: "ana@example.test", currency: "mxn", lineItems: [{
        name: "Clase", quantity, unitPrice: 100, product_type: "package", product_id: 1,
        height: 1, length: 1, weight: 1, width: 1,
      }] },
      apiUrl: "https://payments.example.test", stripeCheckoutState: checkout,
      hasRecurringPayment: checkout.recurringPayment, paymentFrequency: "30",
      onCheckoutOpenAction: purchase, onInitialPaymentUpdated: purchase,
      onStartPayAction: vi.fn(), onGafaPaySuccessAction: vi.fn(), onGafaPayErrAction: vi.fn(),
    };
    await act(async () => { island = mountGafaPayWidget(runtime, box, "stripe", nextProps); });
  }
  async function advance(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
  const updates = () => calls.filter(({ path }) => path === "updateinitialpayment");

  it("1→2→1: espera la cadena >9 s y solo inicializa el último secret de cada remount", async () => {
    let order = 0;
    const registered = new Set<string>();
    network.mockImplementation(async (path: string, body: any) => {
      await new Promise((resolve) => setTimeout(resolve, 6000));
      if (path === "processinitialpayment") {
        order += 1;
        return json({ message: `token_${order}_process`, client_secret: `secret_${order}_process` });
      }
      expect(registered.has(body.tokenInput)).toBe(true);
      const final = body.tokenInput.endsWith("_update");
      return json({ message: `token_${order}_update`, client_secret: `secret_${order}_${final ? "last" : "update"}` });
    });
    purchase.mockImplementation(async (data: Payment) => {
      await new Promise((resolve) => setTimeout(resolve, 25_000));
      registered.add(data.message);
    });
    for (const quantity of [1, 2, 1]) {
      await mount(quantity);
      const ready = vi.fn(); const failed = vi.fn();
      const pending = waitForWidgetContent(box, 9000, { requireIframe: true, hideIifeLoading: true }).then(ready, failed);
      await advance(9500);
      expect(ready).not.toHaveBeenCalled(); expect(failed).not.toHaveBeenCalled();
      expect(box.querySelector("iframe")).toBeNull();
      expect(initStripe).toHaveBeenCalledTimes(order - 1);
      await advance(85_000);
      await pending;
      expect(failed).not.toHaveBeenCalled(); expect(ready).toHaveBeenCalledOnce();
      expect(box.querySelector("iframe")?.getAttribute("data-secret")).toBe(`secret_${order}_last`);
      await act(async () => island!.unmount()); island = undefined;
    }
    expect(initStripe.mock.calls).toEqual([["secret_1_last"], ["secret_2_last"], ["secret_3_last"]]);
    expect(updates()).toHaveLength(6);
    expect(purchase).toHaveBeenCalledTimes(9);
    expect(confirm).not.toHaveBeenCalled();
    expect(calls.filter(({ path }) => path === "completeinitialpayment")).toHaveLength(0);
  });

  it("permite 30 s de espera pero falla si la cadena deja de avanzar", async () => {
    network.mockImplementation(() => new Promise(() => undefined));
    await mount(1);
    const failed = vi.fn();
    const pending = waitForWidgetContent(box, 9000, { requireIframe: true }).catch(failed);
    await advance(29_999);
    expect(failed).not.toHaveBeenCalled();
    await advance(1); await pending;
    expect(failed).toHaveBeenCalledOnce();
    expect(initStripe).not.toHaveBeenCalled();
  });

  it("un remount durante process descarta el resultado del widget desmontado", async () => {
    const oldProcess = deferred<Response>();
    network.mockImplementation(async () => json({ message: "same_token", client_secret: "first" }));
    await mount(1); await advance(0);
    await act(async () => island!.unmount()); island = undefined;
    network.mockImplementationOnce(() => oldProcess.promise);
    await mount(2);
    await act(async () => island!.unmount()); island = undefined;
    network.mockImplementation(async () => json({ message: "same_token", client_secret: "last" }));
    await mount(1);
    await act(async () => oldProcess.resolve(json({ message: "same_token", client_secret: "obsolete_process" })));
    await advance(0);
    expect(initStripe.mock.calls.flat()).toEqual(["first", "last"]);
    expect(box.querySelector("iframe")?.getAttribute("data-secret")).toBe("last");
    expect(purchase.mock.calls.map(([data]) => data.client_secret)).not.toContain("obsolete_process");
  });

  it("conserva saveCard tras remontar el provider y el carrito, hasta una única confirmación", async () => {
    let version = 0;
    network.mockImplementation(async (path: string) => json(path === "completeinitialpayment" ? {} : {
      message: "same_token", client_secret: `secret_${++version}`,
    }));
    await mount(1); await advance(0);
    expect(box.querySelector("iframe")).toBeTruthy();
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
    await advance(0);
    expect(formMounts).toBe(2);
    expect(checkout.saveCard).toBe(true);
    await act(async () => island!.unmount()); island = undefined;
    await mount(2); await advance(0);
    expect(updates().slice(1).every(({ body }) => body.saveCard === true)).toBe(true);
    await act(async () => { await triggerGafaPayConfirm("stripe", box); });
    await advance(0);
    expect(calls.filter(({ path }) => path === "completeinitialpayment")).toEqual([
      { path: "completeinitialpayment", body: { tokenInput: "same_token", saveCard: true, recurringPayment: false, paymentFrequency: null } },
    ]);
    expect(confirm).toHaveBeenCalledExactlyOnceWith(box.querySelector("iframe")?.getAttribute("data-secret"));
  });

  it.each(["notify", "evento externo"])("BUQMX: %s coordina el token del cupón, conserva opciones y solo remonta el secret final", async (source) => {
    checkout.recurringPayment = true;
    let version = 0;
    network.mockImplementation(async (path: string) => json(path === "completeinitialpayment" ? {} : {
      message: "original", client_secret: `original_${++version}`,
    }));
    await mount(1); await advance(0);
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
    await advance(0);
    expect(checkout.saveCard).toBe(true);
    const initialSecrets = [...initStripe.mock.calls.flat()];
    const old = deferred<Response>();
    await advance(2001);
    network.mockImplementationOnce(() => old.promise);
    await act(async () => { void post("updateinitialpayment", {
      ...updateBody(nextProps, "original", true, true), address: "changed",
    }); });
    const latestUpdate = deferred<Response>();
    network.mockImplementation(async (_path: string, body: any) => {
      expect(body.tokenInput).toBe("discount_token");
      return latestUpdate.promise;
    });
    const detail = { client_secret: "coupon_intermediate", checkout_token: "discount_token" };
    await act(async () => {
      if (source === "notify") notifyStripeDiscountAdded(detail);
      else window.dispatchEvent(new CustomEvent("buq__discount_added", { detail }));
    });
    const ready = vi.fn();
    const waiting = waitForWidgetContent(box, 9000, { requireIframe: true }).then(ready);
    await advance(0);
    expect(initStripe.mock.calls.flat()).toEqual(initialSecrets);
    await act(async () => old.resolve(json({ message: "original", client_secret: "obsolete" })));
    await advance(0);
    expect(ready).not.toHaveBeenCalled();
    expect(initStripe.mock.calls.flat()).toEqual(initialSecrets);
    expect(purchase.mock.calls.map(([data]) => data.client_secret)).not.toContain("obsolete");
    await act(async () => latestUpdate.resolve(json({ message: "discount_token", client_secret: "coupon_final" })));
    await advance(100);
    await waiting;
    expect(box.querySelector("iframe")?.getAttribute("data-secret")).toBe("coupon_final");
    expect(initStripe.mock.calls.flat()).toEqual([...initialSecrets, "coupon_final"]);
    expect(updates().slice(-1)[0]).toMatchObject({
      body: { tokenInput: "discount_token", recurringPayment: true, saveCard: true },
      authorization: "Bearer fixture",
    });
    expect(confirm).not.toHaveBeenCalled();
    network.mockResolvedValue(json({}));
    await act(async () => { await triggerGafaPayConfirm("stripe", box); });
    await advance(0);
    expect(calls.filter(({ path }) => path === "completeinitialpayment")).toEqual([
      { path: "completeinitialpayment", body: { tokenInput: "discount_token", saveCard: true, recurringPayment: true, paymentFrequency: 30 } },
    ]);
    expect(confirm).toHaveBeenCalledExactlyOnceWith("coupon_final");
  });

  it("el cupón con el mismo token invalida el debounce y descarta otro cupón superado", async () => {
    checkout.recurringPayment = false;
    network.mockResolvedValue(json({ message: "same_token", client_secret: "initial" }));
    await mount(1); await advance(0);
    const old = deferred<Response>();
    network.mockImplementationOnce(() => old.promise)
      .mockResolvedValue(json({ message: "same_token", client_secret: "discount_final" }));
    await act(async () => notifyStripeDiscountAdded({ checkout_token: "same_token", client_secret: "discount_old" }));
    await advance(0);
    expect(updates()).toHaveLength(2); // no se suprime aunque body/token sean idénticos.
    await act(async () => notifyStripeDiscountAdded({ checkout_token: "same_token", client_secret: "discount_new" }));
    await act(async () => old.resolve(json({ message: "same_token", client_secret: "obsolete" })));
    await advance(0);
    expect(box.querySelector("iframe")?.getAttribute("data-secret")).toBe("discount_final");
    expect(initStripe.mock.calls.flat()).toEqual(["initial", "discount_final"]);
    expect(updates()).toHaveLength(3);
    expect(updates().every(({ body }) => body.recurringPayment === false)).toBe(true);
    expect(purchase.mock.calls.map(([data]) => data.client_secret)).not.toContain("obsolete");
  });

  it("renovación: espera initial-purchase de 25 s y >30 s totales con progreso antes de permitir Pagar", async () => {
    let version = 0;
    network.mockImplementation(async () => json({ message: "same_token", client_secret: `secret_${++version}` }));
    await mount(1); await advance(0);
    const stop = bindStripeMembershipRecurrence(box, vi.fn());
    network.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      return json({ message: "same_token", client_secret: "renewal_final" });
    });
    purchase.mockImplementation(async () => { await new Promise((resolve) => setTimeout(resolve, 25_000)); });
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
    const settled = vi.fn();
    const paying = syncGafaPayMembershipToggles(box, { saveCard: true, autoRenew: true }).then(settled);
    await advance(16_000);
    expect(settled).not.toHaveBeenCalled();
    await advance(18_999);
    expect(settled).not.toHaveBeenCalled();
    expect(box.querySelector("iframe")?.getAttribute("data-secret")).not.toBe("renewal_final");
    await advance(101); await paying;
    expect(settled).toHaveBeenCalledExactlyOnceWith(true);
    expect(await syncGafaPayMembershipToggles(box, { saveCard: true, autoRenew: true })).toBe(true);
    expect(box.querySelector("iframe")?.getAttribute("data-secret")).toBe("renewal_final");
    expect(confirm).not.toHaveBeenCalled();
    stop();
  });

  it("timeout aborta la revisión y descarta su éxito tardío; reintentar reconcilia con process nuevo", async () => {
    network.mockResolvedValue(json({ message: "same_token", client_secret: "initial" }));
    await mount(1); await advance(0);
    const stop = bindStripeMembershipRecurrence(box, vi.fn());
    const response = deferred<Response>();
    network.mockImplementationOnce(() => response.promise);
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
    const paying = syncGafaPayMembershipToggles(box, { saveCard: true, autoRenew: true });
    await advance(30_001);
    expect(await paying).toBe(false);
    await act(async () => response.resolve(json({ message: "same_token", client_secret: "late_current" })));
    await advance(0);
    expect(await syncGafaPayMembershipToggles(box, { saveCard: true, autoRenew: true })).toBe(false);
    expect(box.querySelector("iframe")?.getAttribute("data-secret")).toBe("initial");
    expect(await triggerGafaPayConfirm("stripe", box)).toBe(false);
    await act(async () => island!.unmount()); island = undefined;
    network.mockResolvedValue(json({ message: "retry_token", client_secret: "reconciled" }));
    await mount(1); await advance(0);
    expect(box.querySelector("iframe")?.getAttribute("data-secret")).toBe("reconciled");
    expect(updates().at(-1)?.body.saveCard).toBe(true);
    stop();
  });

  it("registra un update nuevo aunque conserve tanto token como secret, sin duplicar el evento final", async () => {
    checkout.recurringPayment = true;
    network.mockImplementation(async () => json({ message: "same_token", client_secret: "same_secret", subscriptionId: "sub_test" }));
    await mount(1); await advance(0);
    expect(purchase).toHaveBeenCalledTimes(2); // process + update, sin el eco del IIFE
    expect(purchase.mock.calls[1][0].subscriptionId).toBe("sub_test");
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
    await advance(0);
    expect(purchase).toHaveBeenCalledTimes(3); // es otra petición válida, no un eco
    expect(purchase.mock.calls[2][0].subscriptionId).toBe("sub_test");
    expect(formMounts).toBe(1);
    expect(updates()).toHaveLength(2);
    expect(checkout.saveCard).toBe(true);
  });

  it("descarta la respuesta superada con el mismo token y aborta sin bloquear el siguiente cambio", async () => {
    const old = deferred<Response>();
    network.mockImplementation(async () => json({ message: "same_token", client_secret: "current" }));
    await mount(1); await advance(0);
    network.mockImplementationOnce(() => old.promise)
      .mockImplementationOnce(async () => json({ message: "same_token", client_secret: "newest" }));
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
    const count = updates().length;
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
    expect(updates()).toHaveLength(count + 1); // B aborta A y no espera su respuesta
    await act(async () => { old.resolve(json({ message: "same_token", client_secret: "obsolete" })); });
    await advance(0);
    expect(updates()).toHaveLength(count + 1);
    expect(box.querySelector("iframe")?.getAttribute("data-secret")).toBe("newest");
    expect(purchase.mock.calls.map(([data]) => data.client_secret)).not.toContain("obsolete");
    expect(initStripe.mock.calls.flat()).toEqual(["current", "newest"]);
    expect(updates().slice(-2).map(({ body }) => [body.recurringPayment, body.saveCard]))
      .toEqual([[false, true], [false, true]]);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("la baja del carrito prevalece sobre updates tardíos y el estado local del IIFE hasta confirmar una vez", async () => {
    checkout.recurringPayment = true;
    network.mockImplementation(async () => json({ message: "same_token", client_secret: "recurring" }));
    await mount(1); await advance(0);
    // El IIFE monta con recurring=false; el carrito exige true al preparar y al actualizar.
    expect(updates().map(({ body }) => body.recurringPayment)).toEqual([true]);

    const old = deferred<Response>();
    network.mockImplementationOnce(() => old.promise);
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
    expect(checkout.saveCard).toBe(true);
    await act(async () => island!.unmount()); island = undefined;
    checkout.recurringPayment = false;
    network.mockImplementation(async () => json({ message: "same_token", client_secret: "single" }));
    const beforeOptOut = calls.length;
    await mount(2);
    expect(calls.length).toBeGreaterThan(beforeOptOut); // el nuevo process no espera al update abortado
    await act(async () => old.resolve(json({ message: "same_token", client_secret: "obsolete_recurring" })));
    await advance(0);

    expect(initStripe.mock.calls.flat()).toEqual(["recurring", "single"]);
    expect(purchase.mock.calls.map(([data]) => data.client_secret)).not.toContain("obsolete_recurring");
    for (const quantity of [1, 2, 1]) {
      await act(async () => island!.unmount()); island = undefined;
      await mount(quantity); await advance(0);
      expect(box.querySelector("iframe")?.getAttribute("data-secret")).toBe("single");
    }

    await advance(2_001);
    // Incluso un update con el antiguo estado local true debe enviar false.
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
    await advance(0);
    await act(async () => { await triggerGafaPayConfirm("stripe", box); });
    await advance(0);
    const afterOptOut = calls.slice(beforeOptOut).filter(({ path }) => path !== "processinitialpayment");
    expect(afterOptOut.length).toBeGreaterThan(4);
    expect(afterOptOut.every(({ body }) => body.recurringPayment === false && body.saveCard === true)).toBe(true);
    expect(calls.filter(({ path }) => path === "completeinitialpayment")).toHaveLength(1);
    expect(confirm).toHaveBeenCalledExactlyOnceWith("single");
  });

  it.each(["process", "primer update", "initial-purchase"])("cupón durante %s del bootstrap: IIFE recibe la sesión final y monta exactamente un elemento", async (stage) => {
    const stale = deferred<Response>();
    const registration = deferred<void>();
    network.mockImplementation(async (path: string, body: any) => {
      if (stage === "process" && path === "processinitialpayment") return stale.promise;
      if (stage === "primer update" && path === "updateinitialpayment" && body.tokenInput === "bootstrap") return stale.promise;
      return json({ message: body.tokenInput === "coupon" ? "coupon" : "bootstrap", client_secret: body.tokenInput === "coupon" ? "coupon_final" : "bootstrap_secret" });
    });
    if (stage === "initial-purchase") purchase.mockImplementationOnce(() => registration.promise);
    await mount(1); await advance(0);
    expect(box.querySelectorAll("iframe")).toHaveLength(0);
    await act(async () => notifyStripeDiscountAdded({ checkout_token: "coupon", client_secret: "coupon_seed" }));
    await advance(0);
    expect(stripeSessionStatus(box)?.ready).toBe(true);
    expect(box.querySelectorAll("iframe")).toHaveLength(1);
    expect(box.querySelector("iframe")?.dataset.secret).toBe("coupon_final");
    expect(initStripe.mock.calls.flat()).toEqual(["coupon_final"]);
    await act(async () => {
      stale.resolve(json({ message: "bootstrap", client_secret: "obsolete" })); registration.resolve();
    });
    await advance(0);
    expect(initStripe.mock.calls.flat()).toEqual(["coupon_final"]);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("cupón después de la respuesta inicial y antes del primer formulario, con token idéntico: replay espera al consumidor", async () => {
    bootstrapDeliveryDelayMs = 100;
    network.mockResolvedValue(json({ message: "same_token", client_secret: "initial" }));
    await mount(1); await advance(0);
    expect(box.querySelector("form")).toBeNull();
    network.mockResolvedValue(json({ message: "same_token", client_secret: "final" }));
    await act(async () => notifyStripeDiscountAdded({ checkout_token: "same_token", client_secret: "seed" }));
    await advance(0);
    expect(box.querySelector("iframe")).toBeNull();
    await advance(100);
    expect(box.querySelectorAll("iframe")).toHaveLength(1);
    expect(box.querySelector("iframe")?.dataset.secret).toBe("final");
    expect(stripeSessionStatus(box)?.ready).toBe(true);
  });

  it("errores de una revisión superada no terminan la espera de recurrencia vigente", async () => {
    checkout.recurringPayment = true;
    network.mockResolvedValue(json({ message: "same_token", client_secret: "initial" }));
    await mount(1); await advance(0);
    const stop = bindStripeMembershipRecurrence(box, vi.fn());
    const stale = deferred<Response>(), latest = deferred<Response>();
    network.mockImplementationOnce(() => stale.promise).mockImplementation(() => latest.promise);
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
    const settled = vi.fn();
    const waiting = syncGafaPayMembershipToggles(box, { saveCard: true, autoRenew: true }).then(settled);
    await act(async () => notifyStripeDiscountAdded({ checkout_token: "same_token", client_secret: "new_seed" }));
    const revision = stripeSessionStatus(box)!.revision;
    await act(async () => {
      stale.reject(new Error("old failure"));
      box.querySelector("stripe-payment-element")!.dispatchEvent(new CustomEvent("initial-payment-update-error", {
        detail: { revision: revision - 1, message: "old IIFE error" },
      }));
    });
    await advance(100);
    expect(settled).not.toHaveBeenCalled();
    await act(async () => latest.resolve(json({ message: "same_token", client_secret: "final" })));
    await advance(100); await waiting;
    expect(settled).toHaveBeenCalledExactlyOnceWith(true);
    expect(stripeSessionStatus(box)).toMatchObject({ revision, ready: true });
    stop();
  });

  it("dispose aborta process atascado y el remount llega a red antes de que termine", async () => {
    const stale = deferred<Response>();
    let oldSignal: AbortSignal | undefined;
    network.mockImplementationOnce(() => stale.promise).mockResolvedValue(json({ message: "new", client_secret: "new_secret" }));
    // The installed fetch adapter passes a real AbortSignal to the transport.
    const original = window.fetch;
    window.fetch = (async (input, init) => { oldSignal ??= init?.signal as AbortSignal; return original(input, init); }) as typeof fetch;
    await mount(1); await advance(0);
    await act(async () => island!.unmount()); island = undefined;
    await mount(2); await advance(0);
    expect(oldSignal?.aborted).toBe(true);
    expect(box.querySelector("iframe")?.dataset.secret).toBe("new_secret");
    await act(async () => stale.resolve(json({ message: "new", client_secret: "old_secret" })));
    await advance(0);
    expect(initStripe.mock.calls.flat()).toEqual(["new_secret"]);
  });

  it("un error vigente queda asociado a su revisión y un reintento hace process antes de reconciliar opciones", async () => {
    network.mockResolvedValue(json({ message: "same_token", client_secret: "initial" }));
    await mount(1); await advance(0);
    const errors: any[] = [];
    box.addEventListener("initial-payment-update-error", (event) => errors.push((event as CustomEvent).detail));
    purchase.mockRejectedValueOnce(new Error("registration failed"));
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
    await advance(0);
    expect(stripeSessionStatus(box)).toMatchObject({ phase: "error", ready: false, revision: errors[0].revision });
    expect(await triggerGafaPayConfirm("stripe", box)).toBe(false);
    const before = calls.length;
    network.mockResolvedValue(json({ message: "retry", client_secret: "retry_secret" }));
    await act(async () => { await post("updateinitialpayment", updateBody(nextProps, "same_token", true, true)); });
    await advance(0);
    expect(calls[before].path).toBe("processinitialpayment");
    expect(calls.slice(before).every(({ body }) => body.saveCard === true && body.recurringPayment === false)).toBe(true);
    // The real update response is consumed by the IIFE, or by an explicit retry remount.
    await act(async () => island!.unmount()); island = undefined;
    await mount(1); await advance(0);
    expect(stripeSessionStatus(box)?.ready).toBe(true);
  });

  it("complete pendiente no autoriza confirm después de una mutación, incluso con el mismo token", async () => {
    network.mockResolvedValue(json({ message: "same_token", client_secret: "initial" }));
    await mount(1); await advance(0);
    const complete = deferred<Response>();
    network.mockImplementation((path: string) => path === "completeinitialpayment" ? complete.promise : Promise.resolve(json({ message: "same_token", client_secret: "final" })));
    await act(async () => { expect(await triggerGafaPayConfirm("stripe", box)).toBe(true); });
    expect(stripeSessionStatus(box)?.phase).toBe("confirming");
    await act(async () => notifyStripeDiscountAdded({ checkout_token: "same_token", client_secret: "seed" }));
    await advance(0);
    await act(async () => complete.resolve(json({})));
    await advance(0);
    expect(confirm).not.toHaveBeenCalled();
    expect(box.querySelectorAll("iframe")).toHaveLength(1);
    expect(box.querySelector("iframe")?.dataset.secret).toBe("final");
  });

  it("un provider desmontado no confirma aunque el nuevo conserve token y secret idénticos", async () => {
    network.mockResolvedValue(json({ message: "same_token", client_secret: "same_secret" }));
    await mount(1); await advance(0);
    const oldActions = capturedActions[0];
    await act(async () => island!.unmount()); island = undefined;
    await mount(2); await advance(0);
    await post("completeinitialpayment", { tokenInput: "same_token" });
    await expect(oldActions.confirm()).rejects.toThrow(/sesión/);
    expect(confirm).not.toHaveBeenCalled();
    await capturedActions.at(-1).confirm();
    expect(confirm).toHaveBeenCalledExactlyOnceWith("same_secret");
  });

  it("Stripe.confirm en curso congela mutaciones y rechaza un segundo complete hasta terminar", async () => {
    network.mockResolvedValue(json({ message: "same_token", client_secret: "current" }));
    await mount(1); await advance(0);
    const charge = deferred<void>(); confirm.mockImplementationOnce(() => charge.promise);
    await act(async () => { await triggerGafaPayConfirm("stripe", box); });
    await advance(0);
    expect(confirm).toHaveBeenCalledOnce();
    const before = calls.length;
    await act(async () => notifyStripeDiscountAdded({ checkout_token: "same_token", client_secret: "ignored_during_charge" }));
    await expect(post("completeinitialpayment", { tokenInput: "same_token" })).rejects.toMatchObject({ message: expect.stringMatching(/en curso/) });
    expect(calls).toHaveLength(before);
    await act(async () => charge.resolve()); await advance(0);
    expect(stripeSessionStatus(box)?.phase).toBe("done");
    expect(confirm).toHaveBeenCalledOnce();
  });

  const line: CartLine = {
    key: "fitspin:membership:12", id: 12, type: "membership", name: "MEMBRESÍA", amount: 1,
    price: 100, priceLabel: "$100", brandSlug: "fitspin", locationSlug: "polanco",
    raw: { can_subscribe: true, subscribable: true, expiration_days: 30 },
  };
  function modalClient(overrides: Partial<GafaClient> = {}) {
    const config = {
      brandSlug: "fitspin", locationSlug: "polanco", currency: { prefix: "$", suffix: "MXN", code: "MXN" },
      paymentMethods: [{ id: 3, name: "Stripe", slug: "stripe" }],
      discountCodesEnabled: true, giftCardsEnabled: false, canRedeemStoreCredit: false,
      combos: [], memberships: [], products: [], gafapayClientId: "282", gafapayClientSecret: "fixture",
      companiesId: 1, locationId: 122, userProfileId: 4412, usersId: 99,
      urls: { reservation: "/reservate", initialPurchase: "/initial-purchase", initialPurchaseStatus: "/status" },
    } as CheckoutConfig;
    return {
      listBrands: async () => [{ id: 1, slug: "fitspin", name: "Fitspin" }], listLocations: async () => [],
      listCombos: async () => [], listProducts: async () => [],
      listMemberships: async () => [{ id: 12, type: "membership", name: "MEMBRESÍA", can_subscribe: true, expirationDays: 30 }],
      getProfile: async () => ({ id: 4412, name: "Ana", firstName: "Ana", lastName: "Pérez", email: "ana@example.test" }),
      getCheckoutConfig: async () => config, previewPurchase: vi.fn(async () => undefined),
      initialPurchase: vi.fn(async (payload) => ({ purchaseId: 88, checkoutToken: payload.checkoutToken })),
      pollInitialPurchaseStatus: vi.fn(async () => ({ code: 1 })),
      listUserPurchases: async () => [], listUserMemberships: async () => [], listUserCredits: async () => [],
      listUserReservations: async () => [], ...overrides,
    } as unknown as GafaClient;
  }
  async function renderModal(client: GafaClient, lines = [line]) {
    useCartStore.setState({ lines, reservation: null });
    const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={query}><CheckoutModal client={client} brandSlug="fitspin" locationSlug="polanco" skipCatalog onClose={() => undefined} /></QueryClientProvider>);
    for (let i = 0; i < 12; i++) await advance(25);
  }
  const modalPay = () => screen.getByRole("button", { name: /^Pagar \$/i }) as HTMLButtonElement;
  const modalHost = () => document.querySelector(".gafa-checkout-paymount__island")!;

  it("modal real: bloquea CTA, submit y complete durante el cupón y hasta registrar y montar el último secret", async () => {
    network.mockResolvedValue(json({ message: "original", client_secret: "initial" }));
    const coupon = deferred<any>(), registration = deferred<any>();
    const client = modalClient({ checkDiscountCode: vi.fn(() => coupon.promise) });
    await renderModal(client);
    expect(modalPay().disabled).toBe(false);
    const host = modalHost();
    const oldForm = host.querySelector("form")!;
    fireEvent.click(screen.getByRole("button", { name: /¿tienes un código/i }));
    fireEvent.change(screen.getByPlaceholderText(/código/i), { target: { value: "BUQMX" } });
    fireEvent.click(screen.getByRole("button", { name: /aplicar/i }));
    expect(modalPay().disabled).toBe(true);
    expect(await triggerGafaPayConfirm("stripe", host)).toBe(false);
    await act(async () => { fireEvent.submit(oldForm); });
    const blocked = await post("completeinitialpayment", { tokenInput: "original" }, "https://apipay.buq.partners/api/stripe.").catch((error) => error);
    expect(blocked.message).toMatch(/no está listo/);
    expect(calls.filter(({ path }) => path === "completeinitialpayment")).toHaveLength(0);
    vi.mocked(client.initialPurchase!).mockImplementation(() => registration.promise);
    network.mockResolvedValue(json({ message: "coupon", client_secret: "coupon_final" }));
    await act(async () => coupon.resolve({ valid: true, code: "BUQMX", discountType: "percent", discountNumber: 10,
      clientSecret: "coupon_seed", checkoutToken: "coupon" }));
    await advance(100);
    expect(modalPay().disabled).toBe(true);
    expect(stripeSessionStatus(host)?.ready).toBe(false);
    expect(await triggerGafaPayConfirm("stripe", host)).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    await act(async () => registration.resolve({ purchaseId: 88, checkoutToken: "coupon" }));
    await advance(200);
    expect(modalPay().disabled).toBe(false);
    expect(modalPay().textContent).toContain("$90");
    expect(host.querySelectorAll("iframe")).toHaveLength(1);
    expect(host.querySelector("iframe")?.dataset.secret).toBe("coupon_final");
    expect(client.initialPurchase).toHaveBeenLastCalledWith(expect.objectContaining({ checkoutToken: "coupon", subscribe: true }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    network.mockResolvedValue(json({}));
    await act(async () => { await triggerGafaPayConfirm("stripe", host); });
    await advance(0);
    expect(confirm).toHaveBeenCalledExactlyOnceWith("coupon_final");
  });

  it("modal real: cupón sin secret reconcilia el precio mediante process y no confirma la sesión anterior", async () => {
    let serial = 0;
    network.mockImplementation(async (path: string) => json({ message: "same_token", client_secret: path === "processinitialpayment" ? `price_${++serial}` : `price_${serial}` }));
    const client = modalClient({ checkDiscountCode: vi.fn(async () => ({ valid: true, code: "BUQMX", discountType: "percent", discountNumber: 10 })) });
    await renderModal(client);
    fireEvent.click(screen.getByRole("button", { name: /¿tienes un código/i }));
    fireEvent.change(screen.getByPlaceholderText(/código/i), { target: { value: "BUQMX" } });
    fireEvent.click(screen.getByRole("button", { name: /aplicar/i }));
    for (let i = 0; i < 12; i++) await advance(25);
    expect(client.checkDiscountCode).toHaveBeenCalledTimes(1);
    expect(modalPay().disabled).toBe(false);
    expect(calls.filter(({ path }) => path === "processinitialpayment")).toHaveLength(2);
    expect(calls.filter(({ path }) => path === "processinitialpayment").at(-1)?.body.lineItems[0].unitPrice).toBe(90);
    expect(modalHost().querySelectorAll("iframe")).toHaveLength(1);
    expect(modalHost().querySelector("iframe")?.dataset.secret).toBe("price_2");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("modal real: CART+ y CART− con bajas rápidas remontan un solo formulario conectado con el secret vigente", async () => {
    let revision = 0;
    network.mockImplementation(async (path: string) => json({ message: "same_token", client_secret: path === "processinitialpayment" ? `secret_${++revision}` : `secret_${revision}` }));
    const client = modalClient();
    await renderModal(client);
    expect(modalPay().disabled).toBe(false);
    fireEvent.click(screen.getByRole("checkbox", { name: "Pago recurrente" }));
    await advance(200);
    fireEvent.click(screen.getByRole("button", { name: /ver productos del carrito/i }));
    for (const name of ["Agregar uno", "Quitar uno", "Agregar uno", "Quitar uno"]) {
      const previous = modalHost().querySelector("iframe")!;
      fireEvent.click(screen.getByRole("button", { name }));
      expect(await triggerGafaPayConfirm("stripe", modalHost())).toBe(false);
      for (let i = 0; i < 10; i++) await advance(25);
      const host = modalHost();
      expect(previous.isConnected).toBe(false);
      expect(host.querySelectorAll("iframe")).toHaveLength(1);
      const frame = host.querySelector("iframe")!;
      expect(frame.isConnected).toBe(true);
      expect(frame.dataset.secret).toBe(`secret_${revision}`);
      expect(parseFloat(frame.style.height)).toBeGreaterThan(50);
      expect(host.closest(".gafa-checkout-paymount")?.getAttribute("data-state")).toBe("ready");
      expect(modalPay().disabled).toBe(false);
    }
    expect(updates().slice(1).every(({ body }) => body.recurringPayment === false && body.paymentFrequency === null)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("modal real: clics rápidos de la casilla convergen al último estado sin montar sesiones intermedias", async () => {
    let serial = 0;
    network.mockImplementation(async (path: string) => json({ message: "same_token", client_secret: path === "processinitialpayment" ? `rapid_${++serial}` : `rapid_${serial}` }));
    await renderModal(modalClient());
    for (let click = 0; click < 3; click++) fireEvent.click(screen.getByRole("checkbox", { name: "Pago recurrente" }));
    for (let i = 0; i < 10; i++) await advance(25);
    expect((screen.getByRole("checkbox", { name: "Pago recurrente" }) as HTMLInputElement).checked).toBe(false);
    expect(modalPay().disabled).toBe(false);
    expect(modalHost().querySelectorAll("iframe")).toHaveLength(1);
    expect(modalHost().querySelector("stripe-payment-element")?.getAttribute("has-recurring-payment")).toBe("false");
    expect(updates().at(-1)?.body).toMatchObject({ recurringPayment: false, paymentFrequency: null });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("modal real: carrito aborta un cupón atascado, revalida y descarta su respuesta tardía", async () => {
    let serial = 0;
    network.mockImplementation(async () => json({ message: "same_token", client_secret: `coupon_cart_${++serial}` }));
    const old = deferred<any>();
    const check = vi.fn().mockImplementationOnce(() => old.promise).mockResolvedValue({ valid: true, code: "BUQMX", discountType: "percent", discountNumber: 10, checkoutToken: "same_token", clientSecret: "current_seed" });
    const client = modalClient({ checkDiscountCode: check });
    await renderModal(client);
    fireEvent.click(screen.getByRole("button", { name: /¿tienes un código/i }));
    fireEvent.change(screen.getByPlaceholderText(/código/i), { target: { value: "BUQMX" } });
    fireEvent.click(screen.getByRole("button", { name: /aplicar/i }));
    const firstSignal = check.mock.calls[0][0].signal as AbortSignal;
    await act(async () => useCartStore.getState().setAmount(line.key, 2));
    for (let i = 0; i < 15; i++) await advance(25);
    expect(firstSignal.aborted).toBe(true);
    expect(check).toHaveBeenCalledTimes(2);
    expect(modalPay().disabled).toBe(false);
    expect(modalHost().querySelectorAll("iframe")).toHaveLength(1);
    const secret = modalHost().querySelector("iframe")?.dataset.secret;
    await act(async () => old.resolve({ valid: true, code: "BUQMX", clientSecret: "obsolete_seed", checkoutToken: "same_token" }));
    await advance(100);
    expect(modalHost().querySelector("iframe")?.dataset.secret).toBe(secret);
    expect(initStripe.mock.calls.flat()).not.toContain("obsolete_seed");
    expect(confirm).not.toHaveBeenCalled();
  });

  it.each(["cantidad 2", "dos membresías", "línea con costo", "sin días"])("modal real: %s exige pago único en atributos, estado y todos los payloads", async (kind) => {
    network.mockResolvedValue(json({ message: "single", client_secret: "single_secret" }));
    const lines = kind === "cantidad 2" ? [{ ...line, amount: 2 }]
      : kind === "dos membresías" ? [line, { ...line, key: "second", id: 13 }]
      : kind === "línea con costo" ? [line, { ...line, key: "extra", type: "product" as const, price: 10 }]
      : [{ ...line, raw: { ...line.raw, expiration_days: 0 } }];
    const client = modalClient();
    await renderModal(client, lines);
    expect(modalPay().disabled).toBe(false);
    const element = modalHost().querySelector("stripe-payment-element")!;
    expect(element.getAttribute("has-recurring-payment")).toBe("false");
    expect(element.hasAttribute("payment-frequency")).toBe(false);
    expect(screen.queryByRole("checkbox", { name: "Pago recurrente" })).toBeNull();
    expect(calls.every(({ body }) => body.recurringPayment === false && body.paymentFrequency === null)).toBe(true);
    expect(vi.mocked(client.initialPurchase!).mock.calls.every(([payload]) => payload.subscribe === false)).toBe(true);
  });

});
