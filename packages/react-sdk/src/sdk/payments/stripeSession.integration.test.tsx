import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CheckoutModal, type CheckoutModalProps } from "../widgets/CheckoutModal";
import { useCartStore, type CartLine } from "../cart/cartStore";
import { checkoutCatalogQueryKey } from "../cart/checkoutCatalog";
import { parseDiscountCheckResponse } from "../cart/discountCode";
import { instrumentClient } from "../analytics/instrumentClient";
import { createSdkTracker } from "../analytics/tracker";
import { createHttpGafaClient } from "../client/httpGafaClient";
import type { GafaClient, CheckoutConfig } from "../client/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadGafaPay, mountGafaPayWidget, waitForWidgetContent, triggerGafaPayConfirm, notifyStripeDiscountAdded,
  type GafaPayWidgetProps, type GafaPayIsland,
} from "./gafaPay";
import { STRIPE_SESSION_PROGRESS_EVENT, refreshStripeCheckout, stripeSessionStatus, resetStripeSessionFetchGuardForTests, type StripeCheckoutState } from "./stripeSessionGuard";
import { bindStripeMembershipRecurrence, syncGafaPayMembershipToggles } from "../cart/membershipPayOptions";

// Keep the actual mount, session preparation, callbacks and DOM. Only script loading is replaced.
vi.mock("./gafaPay", async (original) => ({
  ...await original<typeof import("./gafaPay")>(),
  loadGafaPay: vi.fn(async () => ({
    React: { createElement: () => null },
    ReactDOM: { render: () => undefined, unmountComponentAtNode: () => true }, elements: {},
  })),
}));

const API = "https://payments.example.test/api/stripe.";
const completeSuccess = { success: true, message: "done" };
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
let bootstrapRequestDelayMs = 0;
let bootstrapDeliveryDelayMs = 0;
let surfaceDelayMs = 0;
let emitPaymentEvents = false;
const stripeFactory = vi.fn();
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
    }).catch((error) => host.dispatchEvent(new CustomEvent("payment-error", { detail: error })));
  }, [recurring]);
  return <form onSubmit={async (event) => {
    event.preventDefault();
    setBusy(true);
    if (emitPaymentEvents) host.dispatchEvent(new CustomEvent("payment-start"));
    try {
      await post("completeinitialpayment", { tokenInput: payment.message, saveCard }, `${props.apiUrl}/api/stripe.`);
      const result = await actions.current.confirm();
      if (emitPaymentEvents && result?.type === "success") host.dispatchEvent(new CustomEvent("payment-success"));
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
    const request = () => void post("processinitialpayment", {
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
    if (bootstrapRequestDelayMs) setTimeout(request, bootstrapRequestDelayMs);
    else request();
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
  disconnectedCallback() {
    const root = this.root;
    queueMicrotask(() => root?.unmount());
  }
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
  let hostTransport: ((url: string, init?: RequestInit) => Promise<Response>) | undefined;
  const calls: { path: string; body: Record<string, any>; authorization?: string | null }[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    initStripe.mockReset(); confirm.mockReset(); formMounts = 0; calls.length = 0;
    checkout = {}; bootstrapRequestDelayMs = 0; bootstrapDeliveryDelayMs = 0; surfaceDelayMs = 0;
    emitPaymentEvents = false; hostTransport = undefined; stripeFactory.mockClear(); capturedActions = [];
    box = document.createElement("div"); document.body.appendChild(box);
    purchase = vi.fn(async () => undefined);
    network = vi.fn();
    (window as any).Stripe = (...args: unknown[]) => { stripeFactory(...args); return ({
      initCheckoutElementsSdk({ clientSecret }: { clientSecret: string }) {
        initStripe(clientSecret);
        return {
          async loadActions() { return { type: "success", actions: { confirm: async () => {
            return await confirm(clientSecret) ?? { type: "success" };
          } } }; },
          createPaymentElement() {
            let frame: HTMLIFrameElement | undefined;
            let ready: (() => void) | undefined;
            let timer: ReturnType<typeof setTimeout> | undefined;
            return {
              on(name: string, callback: () => void) { if (name === "ready") ready = callback; },
              mount(node: Element) {
                const attach = () => {
                  frame = document.createElement("iframe"); frame.title = "Payment Element";
                  frame.dataset.secret = clientSecret; frame.style.height = "180px";
                  node.appendChild(frame); ready?.();
                };
                if (surfaceDelayMs) timer = setTimeout(attach, surfaceDelayMs); else attach();
              },
              destroy() { clearTimeout(timer); frame?.remove(); },
            };
          },
        };
      },
    }); };
    window.fetch = (async (input, init) => {
      expect(String(input)).not.toContain("/.gafa-checkout-widget-");
      if (hostTransport && String(input).startsWith("https://host.example.test/")) return hostTransport(String(input), init);
      const path = String(input).split("stripe.")[1];
      const body = JSON.parse(String(init?.body)); calls.push({ path, body, ...(path === "completeinitialpayment" ? {} : { authorization: new Headers(init?.headers).get("Authorization") }) });
      return network(path, body, init?.signal);
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
        name: "Clase", quantity, unitPrice: 100, type: "membership", product_type: "membership", product_id: 1,
        height: 1, length: 1, weight: 1, width: 1,
      }] },
      apiUrl: "https://payments.example.test", stripeCheckoutState: checkout,
      hasRecurringPayment: checkout.recurringPayment, paymentFrequency: "30", stripeCanSubscribe: true, generalData: {},
      onCheckoutOpenAction: purchase, onInitialPaymentUpdated: purchase,
      onStartPayAction: vi.fn(), onGafaPaySuccessAction: vi.fn(), onGafaPayErrAction: vi.fn(),
    };
    await act(async () => { island = mountGafaPayWidget(runtime, box, "stripe", nextProps); });
  }
  async function advance(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
  const updates = () => calls.filter(({ path }) => path === "updateinitialpayment");

  it("un update del IIFE con otro token e importes descontados sigue sujeto a la sesión del widget", async () => {
    network.mockResolvedValue(json({ message: "current", client_secret: "current_secret" }));
    await mount(1); await advance(0);
    const before = calls.length;
    const body = updateBody(nextProps, "unknown", false, false);
    const response = await post("updateinitialpayment", { ...body, lineItems: [{ ...body.lineItems[0], unitPrice: 90 }] });
    expect(response).toEqual({ message: "unknown" });
    expect(calls).toHaveLength(before);
    expect(stripeSessionStatus(box)?.ready).toBe(true);
  });

  it("la pérdida de elegibilidad en island.update prevalece sobre flags obsoletos del IIFE y del checkout", async () => {
    checkout.recurringPayment = true;
    network.mockResolvedValue(json({ message: "current", client_secret: "current_secret" }));
    await mount(1); await advance(0);
    expect(updates().at(-1)?.body.recurringPayment).toBe(true);
    await act(async () => island!.update({ ...nextProps, stripeCanSubscribe: undefined }));
    expect(box.querySelector("stripe-payment-element")?.getAttribute("has-recurring-payment")).toBe("false");
    expect(stripeSessionStatus(box)?.ready).toBe(false);
    checkout.recurringPayment = true;
    await act(async () => { await post("updateinitialpayment", updateBody(nextProps, "current", false, true)); });
    expect(updates().at(-1)?.body).toMatchObject({ recurringPayment: false, paymentFrequency: null });
    expect(stripeSessionStatus(box)?.ready).toBe(true);
  });

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
      return json({ message: `token_${order}_update`, client_secret: `secret_${order}_last` });
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
      for (let i = 0; i < 5; i++) await advance(15_000);
      await pending;
      expect(failed).not.toHaveBeenCalled(); expect(ready).toHaveBeenCalledOnce();
      expect(box.querySelector("iframe")?.getAttribute("data-secret")).toBe(`secret_${order}_last`);
      await act(async () => island!.unmount()); island = undefined;
    }
    expect(initStripe.mock.calls).toEqual([["secret_1_last"], ["secret_2_last"], ["secret_3_last"]]);
    expect(updates()).toHaveLength(3);
    expect(purchase).toHaveBeenCalledTimes(6);
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

  it("A2: eventos DOM sin respuesta no renuevan el plazo; un ready tardío vigente sigue recuperable", async () => {
    surfaceDelayMs = 65_000;
    network.mockResolvedValue(json({ message: "current", client_secret: "current_secret" }));
    await mount(1); await advance(0);
    const failed = vi.fn();
    const waiting = waitForWidgetContent(box, 9000, { requireIframe: true }).catch(failed);
    for (let tick = 0; tick < 5; tick++) {
      await advance(5000);
      box.dispatchEvent(new CustomEvent(STRIPE_SESSION_PROGRESS_EVENT));
    }
    await advance(5001); await waiting;
    expect(failed).toHaveBeenCalledOnce();
    expect(stripeSessionStatus(box)).toMatchObject({ phase: "ready", ready: false });
    await advance(35_000);
    expect(stripeSessionStatus(box)?.ready).toBe(true);
    expect(box.querySelectorAll("iframe")).toHaveLength(1);
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
    network.mockImplementation(async (path: string) => json(path === "completeinitialpayment" ? completeSuccess : {
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
      { path: "completeinitialpayment", body: expect.objectContaining({ tokenInput: "same_token", saveCard: true, recurringPayment: false, paymentFrequency: null }) },
    ]);
    expect(confirm).toHaveBeenCalledExactlyOnceWith(box.querySelector("iframe")?.getAttribute("data-secret"));
  });

  it.each(["notify", "evento externo"])("BUQMX: %s coordina el token del cupón, conserva opciones y solo remonta el secret final", async (source) => {
    checkout.recurringPayment = true;
    let version = 0;
    network.mockImplementation(async (path: string) => json(path === "completeinitialpayment" ? completeSuccess : {
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
    await act(async () => { refreshStripeCheckout(checkout); });
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
    network.mockResolvedValue(json(completeSuccess));
    await act(async () => { await triggerGafaPayConfirm("stripe", box); });
    await advance(0);
    expect(calls.filter(({ path }) => path === "completeinitialpayment")).toEqual([
      { path: "completeinitialpayment", body: expect.objectContaining({ tokenInput: "discount_token", saveCard: true, recurringPayment: true, paymentFrequency: 30 }) },
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

  it("serializa escrituras: el servidor termina en la revisión final aunque se cancele la espera anterior", async () => {
    const old = deferred<Response>();
    let server = "current";
    network.mockImplementation(async () => json({ message: "same_token", client_secret: server }));
    await mount(1); await advance(0);
    network.mockImplementationOnce(async () => { await old.promise; server = "obsolete"; return json({ message: "same_token", client_secret: server }); })
      .mockImplementationOnce(async () => { server = "newest"; return json({ message: "same_token", client_secret: server }); });
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
    const count = updates().length;
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
    expect(updates()).toHaveLength(count); // B cancela la espera visual y conserva la barrera de A
    await act(async () => { old.resolve(json({ message: "same_token", client_secret: "obsolete" })); });
    await advance(0);
    expect(updates()).toHaveLength(count + 1);
    expect(server).toBe("newest");
    expect(stripeSessionStatus(box)?.ready).toBe(true);
    expect(box.querySelector("iframe")?.getAttribute("data-secret")).toBe(server);
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
    network.mockImplementation(async (path, body) => json(path === "completeinitialpayment" ? completeSuccess : { message: "new_token", client_secret: `single_${body.lineItems[0].quantity}` }));
    const beforeOptOut = calls.length;
    await mount(2);
    expect(calls[beforeOptOut].path).toBe("processinitialpayment");
    await act(async () => old.resolve(json({ message: "same_token", client_secret: "obsolete_recurring" })));
    await advance(0);

    expect(initStripe.mock.calls.flat()).toEqual(["recurring", "single_2"]);
    expect(purchase.mock.calls.map(([data]) => data.client_secret)).not.toContain("obsolete_recurring");
    for (const quantity of [1, 2, 1]) {
      await act(async () => island!.unmount()); island = undefined;
      await mount(quantity); await advance(0);
      expect(box.querySelector("iframe")?.getAttribute("data-secret")).toBe(`single_${quantity}`);
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
    expect(confirm).toHaveBeenCalledExactlyOnceWith("single_1");
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
    expect(stripeSessionStatus(box)?.ready).toBe(false);
    expect(box.querySelectorAll("iframe")).toHaveLength(0);
    await act(async () => {
      stale.resolve(json({ message: "bootstrap", client_secret: "obsolete" })); registration.resolve();
    });
    await advance(0);
    expect(stripeSessionStatus(box)?.ready).toBe(true);
    expect(box.querySelectorAll("iframe")).toHaveLength(1);
    expect(box.querySelector("iframe")?.dataset.secret).toBe("coupon_final");
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
    await act(async () => latest.resolve(json({ message: "reconciled_token", client_secret: "final" })));
    await advance(100); await waiting;
    expect(settled).toHaveBeenCalledExactlyOnceWith(true);
    expect(stripeSessionStatus(box)).toMatchObject({ revision, ready: true });
    stop();
  });

  it.each([
    { processToken: "new", updateToken: "new", phase: "ready" },
    { processToken: "old", updateToken: "old", phase: "error" },
    { processToken: "new", updateToken: "old", phase: "error" },
  ])("remount aborta un update colgado y hace process enseguida (tokens $processToken/$updateToken)", async ({ processToken, updateToken, phase }) => {
    network.mockResolvedValue(json({ message: "old", client_secret: "initial" }));
    await mount(1); await advance(0);
    const stale = deferred<Response>();
    network.mockImplementationOnce(() => stale.promise).mockImplementation(async (path) => json({
      message: path === "processinitialpayment" ? processToken : updateToken, client_secret: "new_secret",
    }));
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
    const oldSignal = network.mock.calls.at(-1)?.[2] as AbortSignal;
    expect(oldSignal.aborted).toBe(false);
    const firstNewCall = calls.length;
    await act(async () => island!.unmount()); island = undefined;
    await mount(2); await advance(0);
    expect(oldSignal.aborted).toBe(true);
    expect(calls[firstNewCall]).toMatchObject({ path: "processinitialpayment", body: { lineItems: [{ quantity: 2 }] } });
    expect(stripeSessionStatus(box)?.phase).toBe(phase);
    await act(async () => stale.resolve(json({ message: "old", client_secret: "old_secret" })));
    await advance(0);
    expect(initStripe.mock.calls.flat()).toEqual(phase === "ready" ? ["initial", "new_secret"] : ["initial"]);
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
    await act(async () => complete.resolve(json(completeSuccess)));
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
    await mount(1); await advance(0);
    network.mockResolvedValueOnce(json(completeSuccess));
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
    network.mockResolvedValueOnce(json(completeSuccess));
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

  it.each(["respuesta", "cuerpo"])("B3: complete con %s atascado vence, no confirma y exige process nuevo", async kind => {
    network.mockResolvedValue(json({ message: "old_token", client_secret: "old_secret" }));
    await mount(1); await advance(0);
    const old = deferred<Response>();
    network.mockImplementationOnce(() => kind === "respuesta" ? old.promise : new Response(new ReadableStream()));
    await act(async () => { await triggerGafaPayConfirm("stripe", box); });
    await advance(0);
    expect(stripeSessionStatus(box)?.phase).toBe("confirming");
    await expect(capturedActions.at(-1).confirm()).rejects.toThrow(/sesión/);
    await advance(30_001);
    expect(stripeSessionStatus(box)).toMatchObject({ phase: "error", ready: false });
    expect(confirm).not.toHaveBeenCalled();
    expect(await triggerGafaPayConfirm("stripe", box)).toBe(false);
    await act(async () => old.resolve(json({ message: "late" })));
    await advance(0);
    expect(confirm).not.toHaveBeenCalled();
    const before = calls.length;
    network.mockResolvedValue(json({ message: "new_token", client_secret: "new_secret" }));
    await act(async () => { await post("updateinitialpayment", updateBody(nextProps, "old_token", false, false)); });
    expect(calls[before].path).toBe("processinitialpayment");
  });

  it.each(["{", "{}", '{"message":""}', '{"message":true}', '{"message":"ambiguous"}',
    '{"success":false,"message":"No se pudo completar"}', '{"success":true,"message":"ok","error":"Fallo"}',
  ])("complete HTTP 200 con cuerpo %s falla cerrado", async (body) => {
    network.mockResolvedValue(json({ message: "old_token", client_secret: "old_secret" }));
    await mount(1); await advance(0);
    network.mockResolvedValueOnce(new Response(body));
    await act(async () => { expect(await triggerGafaPayConfirm("stripe", box)).toBe(true); });
    expect(stripeSessionStatus(box)).toMatchObject({ phase: "error", ready: false });
    await expect(capturedActions.at(-1).confirm()).rejects.toThrow(/sesión/);
    expect(confirm).not.toHaveBeenCalled();
    const before = calls.length;
    network.mockResolvedValue(json({ message: "new_token", client_secret: "new_secret" }));
    await act(async () => { refreshStripeCheckout(checkout); });
    await advance(0);
    expect(calls[before].path).toBe("processinitialpayment");
    expect(stripeSessionStatus(box)?.ready).toBe(true);
  });

  it("B1: timeout indeterminado fuerza process nuevo antes de habilitar una revisión encolada", async () => {
    network.mockResolvedValue(json({ message: "old_token", client_secret: "old_secret" }));
    await mount(1); await advance(0);
    const old = deferred<Response>();
    network.mockImplementationOnce(() => old.promise).mockResolvedValue(json({ message: "fresh_token", client_secret: "fresh_secret" }));
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
    await advance(1000);
    const before = calls.length;
    await act(async () => notifyStripeDiscountAdded({ checkout_token: "old_token", client_secret: "seed" }));
    expect(calls).toHaveLength(before);
    await advance(29_001);
    expect(calls[before].path).toBe("processinitialpayment");
    expect(stripeSessionStatus(box)?.ready).toBe(true);
    expect(box.querySelector("iframe")?.dataset.secret).toBe("fresh_secret");
    await act(async () => old.resolve(json({ message: "old_token", client_secret: "late_obsolete" })));
    await advance(0);
    expect(box.querySelector("iframe")?.dataset.secret).toBe("fresh_secret");
  });

  it("B1: reconciliar nunca rehabilita un token cuya escritura quedó indeterminada", async () => {
    network.mockResolvedValue(json({ message: "unsafe", client_secret: "original" }));
    await mount(1); await advance(0);
    network.mockImplementationOnce(() => new Promise(() => undefined));
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
    await advance(30_001);
    network.mockResolvedValue(json({ message: "unsafe", client_secret: "another_secret_same_order" }));
    await act(async () => { await post("updateinitialpayment", updateBody(nextProps, "unsafe", false, false)); });
    expect(stripeSessionStatus(box)).toMatchObject({ phase: "error", ready: false });
    expect(await triggerGafaPayConfirm("stripe", box)).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("B3: un error de transporte de Stripe.confirm conserva la barrera hasta reconciliar la compra", async () => {
    network.mockResolvedValue(json({ message: "current", client_secret: "current_secret" }));
    confirm.mockRejectedValueOnce(new Error("connection lost after confirm"));
    await mount(1); await advance(0);
    network.mockResolvedValueOnce(json(completeSuccess));
    await act(async () => { await triggerGafaPayConfirm("stripe", box); });
    await advance(0);
    expect(stripeSessionStatus(box)).toMatchObject({ phase: "error", ready: false });
    const before = calls.length;
    await expect(post("completeinitialpayment", { tokenInput: "current" })).rejects.toMatchObject({ message: expect.stringMatching(/en curso/) });
    expect(calls).toHaveLength(before);
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
  async function renderModal(client: GafaClient, lines = [line], props: Partial<CheckoutModalProps> = {},
    query = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
    useCartStore.setState({ lines, reservation: null });
    const view = render(<QueryClientProvider client={query}><CheckoutModal client={client} brandSlug="fitspin" locationSlug="polanco" skipCatalog showMembershipOptions onClose={() => undefined} {...props} /></QueryClientProvider>);
    for (let i = 0; i < 12; i++) await advance(25);
    return view;
  }
  const modalPay = () => screen.getByRole("button", { name: /^Pagar \$/i }) as HTMLButtonElement;
  const modalHost = () => document.querySelector(".gafa-checkout-paymount__island")!;
  const discountStatus = () => document.querySelector('[data-kind="discount"]')?.getAttribute("data-status");
  function startCoupon() {
    fireEvent.click(screen.getByRole("button", { name: /¿tienes un código/i }));
    fireEvent.change(screen.getByPlaceholderText(/código/i), { target: { value: "BUQMX" } });
    fireEvent.click(screen.getByRole("button", { name: /aplicar/i }));
  }

  it("A1: cupón antes de validar el carrito y de cargar el IIFE no bloquea el loader ni el primer process", async () => {
    const preview = deferred<void>(), script = deferred<typeof runtime>();
    const loads = vi.mocked(loadGafaPay).mock.calls.length;
    vi.mocked(loadGafaPay).mockImplementationOnce(() => script.promise);
    const client = modalClient({
      previewPurchase: vi.fn(() => preview.promise),
      checkDiscountCode: vi.fn(async () => ({ valid: true, code: "BUQMX", discountType: "percent", discountNumber: 10 })),
    });
    network.mockResolvedValue(json({ message: "coupon_order", client_secret: "coupon_final" }));
    await renderModal(client);
    expect(document.querySelector("iframe")).toBeNull();
    startCoupon();
    await advance(100);
    await act(async () => preview.resolve());
    await advance(100);
    expect(vi.mocked(loadGafaPay).mock.calls.length).toBe(loads + 1);
    expect(modalPay().disabled).toBe(true);
    await act(async () => script.resolve(runtime));
    await advance(100);
    expect(calls.find(({ path }) => path === "processinitialpayment")?.body.lineItems[0].unitPrice).toBe(90);
    expect(calls.at(-1)?.body.lineItems[0].unitPrice).toBe(90);
    expect(discountStatus()).toBe("ok");
    expect(modalPay().textContent).toContain("$90");
    expect(client.initialPurchase).toHaveBeenCalled();
    expect(modalHost().querySelector("iframe")?.dataset.secret).toBe("coupon_final");
    expect(modalPay().disabled).toBe(false);
  });

  it.each(["entre process e initial-purchase", "después de initial-purchase"])("cupón iniciado sin token y resuelto %s converge al precio validado", async (stage) => {
    const process = deferred<Response>(), registration = deferred<{ purchaseId: number; checkoutToken: string }>();
    const coupon = deferred<{ valid: boolean; code: string; discountType: "percent"; discountNumber: number; checkoutToken: string; clientSecret: string }>();
    const client = modalClient({ checkDiscountCode: vi.fn(() => coupon.promise) });
    vi.mocked(client.initialPurchase!).mockImplementation(async ({ checkoutToken }) => checkoutToken === "bootstrap"
      ? registration.promise : { purchaseId: 89, checkoutToken });
    network.mockImplementationOnce(() => process.promise).mockImplementation(async (_path, body) =>
      body.lineItems[0].unitPrice === 90
        ? json({ message: "discounted", client_secret: "discounted_secret" })
        : json({ message: "bootstrap", client_secret: "initial_secret" }));
    await renderModal(client);
    startCoupon();
    expect(client.checkDiscountCode).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      checkoutToken: undefined, pendingPurchaseId: undefined,
    }));
    await act(async () => process.resolve(json({ message: "bootstrap", client_secret: "initial_secret" })));
    expect(client.initialPurchase).toHaveBeenCalled();
    if (stage === "después de initial-purchase") {
      await act(async () => registration.resolve({ purchaseId: 88, checkoutToken: "bootstrap" }));
      await advance(0);
      expect(modalHost().querySelector("iframe")?.dataset.secret).toBe("initial_secret");
    }
    expect(discountStatus()).toBe("checking");
    expect(modalPay().disabled).toBe(true);
    await expect(post("completeinitialpayment", { tokenInput: "bootstrap" }, "https://apipay.buq.partners/api/stripe."))
      .rejects.toMatchObject({ message: expect.stringMatching(/no está listo/) });
    const before = calls.length;
    await act(async () => coupon.resolve({ valid: true, code: "BUQMX", discountType: "percent", discountNumber: 10,
      checkoutToken: "unbound_token", clientSecret: "unbound_secret" }));
    await advance(100);
    expect(discountStatus()).toBe("ok");
    expect(modalPay().textContent).toContain("$90");
    expect(modalPay().disabled).toBe(false);
    expect(calls.at(-1)?.body.lineItems[0].unitPrice).toBe(90);
    expect(calls.slice(before).map(({ body }) => body.lineItems[0].unitPrice)).toEqual([90, 90]);
    expect(client.initialPurchase).toHaveBeenLastCalledWith(
      expect.objectContaining({ checkoutToken: "discounted", discountCode: "BUQMX" }), expect.anything(),
    );
    expect(modalHost().querySelector("iframe")?.dataset.secret).toBe("discounted_secret");
    expect(calls.some(({ path }) => path === "completeinitialpayment")).toBe(false);
  });

  it("A2: CART+ y CART− renuevan el plazo con progreso y el montaje vigente recupera el panel tras un error visual", async () => {
    network.mockResolvedValue(json({ message: "original", client_secret: "initial" }));
    const client = modalClient();
    await renderModal(client);
    let serial = 0;
    network.mockImplementation(async (path: string) => {
      await new Promise(resolve => setTimeout(resolve, 6000));
      if (path === "processinitialpayment") serial++;
      return json({ message: `token_${serial}`, client_secret: `late_${serial}` });
    });
    vi.mocked(client.initialPurchase!).mockImplementation(async payload => {
      await new Promise(resolve => setTimeout(resolve, 6000));
      return { purchaseId: 88, checkoutToken: payload.checkoutToken };
    });
    surfaceDelayMs = 120_000;
    for (const amount of [2, 1]) {
      await act(async () => useCartStore.getState().setAmount(line.key, amount));
      for (let second = 0; second < 25; second++) await advance(1000);
      const host = modalHost();
      expect(host.closest(".gafa-checkout-paymount")?.getAttribute("data-state")).toBe("loading");
      expect(modalPay().disabled).toBe(true);
      await advance(91_000);
      expect(host.closest(".gafa-checkout-paymount")?.getAttribute("data-state")).toBe("error");
      expect(modalPay().disabled).toBe(true);
      await advance(35_000);
      expect(host.querySelectorAll("iframe")).toHaveLength(1);
      expect(host.querySelector("iframe")?.dataset.secret).toBe(`late_${serial}`);
      expect(host.closest(".gafa-checkout-paymount")?.getAttribute("data-state")).toBe("ready");
      expect(screen.queryByText(/No se pudo cargar el formulario/)).toBeNull();
      expect(modalPay().disabled).toBe(false);
    }
    expect(stripeFactory).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("B2: pulsar la pestaña Tarjeta seleccionada conserva la sesión, el iframe y el CTA", async () => {
    network.mockResolvedValue(json({ message: "current", client_secret: "current_secret" }));
    const client = modalClient();
    const config = await client.getCheckoutConfig!("fitspin", "polanco");
    config.paymentMethods.push({ id: 4, name: "Efectivo", slug: "cash" });
    await renderModal(client);
    const frame = modalHost().querySelector("iframe");
    const revision = stripeSessionStatus(modalHost())!.revision;
    const before = calls.length;
    fireEvent.click(screen.getByRole("tab", { name: "Tarjeta" }));
    await advance(100);
    expect(modalHost().querySelector("iframe")).toBe(frame);
    expect(stripeSessionStatus(modalHost())).toMatchObject({ phase: "ready", ready: true, revision });
    expect(calls).toHaveLength(before);
    expect(modalPay().disabled).toBe(false);
  });

  it("B4: saveCard inicial y opt-out se registran con plazo, señal y barrera de confirmación", async () => {
    network.mockResolvedValue(json({ message: "current", client_secret: "current_secret" }));
    const client = modalClient();
    await renderModal(client);
    expect(vi.mocked(client.initialPurchase!).mock.calls.every(([payload]) => payload.setPayment === true)).toBe(true);
    expect(updates().at(-1)?.body.saveCard).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /opciones de la membresía/i }));
    const save = screen.getByRole("checkbox", { name: /guardar mi tarjeta/i }) as HTMLInputElement;
    expect(save.checked).toBe(true);
    const write = deferred<any>();
    vi.mocked(client.initialPurchase!).mockImplementationOnce(() => write.promise);
    fireEvent.click(save);
    await advance(0);
    expect(save.checked).toBe(false);
    expect(modalPay().disabled).toBe(true);
    expect(await triggerGafaPayConfirm("stripe", modalHost())).toBe(false);
    const last = vi.mocked(client.initialPurchase!).mock.calls.at(-1)!;
    expect(last[0].setPayment).toBe(false);
    expect(last[1]?.signal).toBeInstanceOf(AbortSignal);
    await advance(30_001);
    expect(last[1]?.signal?.aborted).toBe(true);
    expect(stripeSessionStatus(modalHost())?.phase).toBe("error");
    expect(modalPay().disabled).toBe(true);
    await act(async () => write.resolve({ purchaseId: 88, checkoutToken: "obsolete" }));
    await advance(0);
    network.mockResolvedValue(json({ message: "reconciled_token", client_secret: "reconciled_secret" }));
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await advance(100);
    expect(modalPay().disabled).toBe(false);
    expect(updates().at(-1)?.body.saveCard).toBe(false);
    network.mockResolvedValueOnce(json(completeSuccess));
    await act(async () => { await triggerGafaPayConfirm("stripe", modalHost()); });
    await advance(0);
    expect(calls.filter(({ path }) => path === "completeinitialpayment").at(-1)?.body.saveCard).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("B4: una compra sin membresía conserva saveCard=false en registro, update y complete", async () => {
    network.mockResolvedValue(json({ message: "combo", client_secret: "combo_secret" }));
    const client = modalClient();
    await renderModal(client, [{ ...line, key: "combo", type: "combo", raw: {} }]);
    expect(vi.mocked(client.initialPurchase!).mock.calls.every(([payload]) => payload.setPayment === false)).toBe(true);
    expect(updates().at(-1)?.body.saveCard).toBe(false);
    expect(modalPay().disabled).toBe(false);
    network.mockResolvedValueOnce(json(completeSuccess));
    await act(async () => { await triggerGafaPayConfirm("stripe", modalHost()); });
    await advance(0);
    expect(calls.filter(({ path }) => path === "completeinitialpayment").at(-1)?.body.saveCard).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("B4: cambios rápidos de saveCard serializan registros y convergen a la preferencia explícita final", async () => {
    network.mockResolvedValue(json({ message: "current", client_secret: "current_secret" }));
    const client = modalClient();
    await renderModal(client);
    fireEvent.click(screen.getByRole("button", { name: /opciones de la membresía/i }));
    const save = screen.getByRole("checkbox", { name: /guardar mi tarjeta/i }) as HTMLInputElement;
    const first = deferred<any>();
    vi.mocked(client.initialPurchase!).mockImplementationOnce(() => first.promise);
    fireEvent.click(save); await advance(0);
    const count = vi.mocked(client.initialPurchase!).mock.calls.length;
    fireEvent.click(save); await advance(0);
    expect(save.checked).toBe(true);
    expect(client.initialPurchase).toHaveBeenCalledTimes(count);
    expect(modalPay().disabled).toBe(true);
    await act(async () => first.resolve({ purchaseId: 88, checkoutToken: "current" }));
    await advance(100);
    expect(client.initialPurchase).toHaveBeenLastCalledWith(expect.objectContaining({ setPayment: true }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(updates().at(-1)?.body.saveCard).toBe(true);
    expect(modalPay().disabled).toBe(false);
    network.mockResolvedValueOnce(json(completeSuccess));
    await act(async () => { await triggerGafaPayConfirm("stripe", modalHost()); });
    await advance(0);
    expect(calls.filter(({ path }) => path === "completeinitialpayment").at(-1)?.body.saveCard).toBe(true);
    expect(confirm).toHaveBeenCalledOnce();
  });

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
    expect(discountStatus()).toBe("ok");
    expect(updates().at(-1)?.body.lineItems[0]).toMatchObject({ unitPrice: 90, totalPrice: 90 });
    expect(host.querySelectorAll("iframe")).toHaveLength(1);
    expect(host.querySelector("iframe")?.dataset.secret).toBe("coupon_final");
    expect(client.initialPurchase).toHaveBeenLastCalledWith(expect.objectContaining({ checkoutToken: "coupon", subscribe: true }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    const beforeRefresh = updates().length;
    fireEvent.click(screen.getByRole("button", { name: /opciones de la membresía/i }));
    await act(async () => fireEvent.click(screen.getByRole("checkbox", { name: /guardar mi tarjeta/i })));
    await advance(0);
    expect(updates()).toHaveLength(beforeRefresh + 1);
    expect(updates().at(-1)?.body.lineItems[0]).toMatchObject({ unitPrice: 90, totalPrice: 90 });
    expect(updates().at(-1)?.body.saveCard).toBe(false);
    network.mockResolvedValue(json(completeSuccess));
    await act(async () => { await triggerGafaPayConfirm("stripe", host); });
    await advance(0);
    expect(confirm).toHaveBeenCalledExactlyOnceWith("coupon_final");
  });

  it("modal real: cupón sin secret reconcilia el precio mediante process y no confirma la sesión anterior", async () => {
    let serial = 0;
    network.mockImplementation(async (path: string) => {
      if (path === "processinitialpayment") serial += 1;
      return json({ message: `order_${serial}`, client_secret: `price_${serial}` });
    });
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
    network.mockImplementation(async (path, body) => json({
      message: path === "processinitialpayment" ? `cart_${++serial}` : body.tokenInput,
      client_secret: `coupon_cart_${body.lineItems[0].quantity}_${body.lineItems[0].unitPrice}`,
    }));
    const old = deferred<any>();
    const check = vi.fn().mockImplementationOnce(() => old.promise).mockResolvedValue({ valid: true, code: "BUQMX", discountType: "percent", discountNumber: 10, checkoutToken: "coupon_cart", clientSecret: "current_seed" });
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
    expect(discountStatus()).toBe("ok");
    expect(modalPay().disabled).toBe(false);
    expect(modalHost().querySelectorAll("iframe")).toHaveLength(1);
    const secret = modalHost().querySelector("iframe")?.dataset.secret;
    await act(async () => old.resolve({ valid: true, code: "BUQMX", clientSecret: "obsolete_seed", checkoutToken: "same_token" }));
    await advance(100);
    expect(modalHost().querySelector("iframe")?.dataset.secret).toBe(secret);
    expect(initStripe.mock.calls.flat()).not.toContain("obsolete_seed");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("un cupón que agota el plazo sale de checking y permite reintentar", async () => {
    const check = vi.fn().mockImplementationOnce(() => new Promise(() => undefined))
      .mockResolvedValue({ valid: true, code: "BUQMX", discountType: "percent", discountNumber: 10 });
    const client = modalClient({ checkDiscountCode: check });
    network.mockImplementation(async (_path, body) => json({
      message: body.lineItems[0].unitPrice === 90 ? "discounted" : "fresh", client_secret: `price_${body.lineItems[0].unitPrice}`,
    }));
    await renderModal(client);
    startCoupon();
    expect(modalPay().disabled).toBe(true);
    await advance(30_001);
    expect(discountStatus()).toBe("error");
    expect(check.mock.calls[0][0].signal.aborted).toBe(true);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /aplicar/i })));
    for (let i = 0; i < 4; i++) await advance(25);
    expect(discountStatus()).toBe("ok");
    expect(modalPay().textContent).toContain("$90");
    expect(calls.at(-1)?.body.lineItems[0].unitPrice).toBe(90);
  });

  it.each(["precio sin secret", "precio con secret anterior", "saveCard sin secret", "process sin secret"])(
    "una preparación HTTP 200 rechazada (%s) no deja confirmar la sesión anterior", async (scenario) => {
      network.mockResolvedValue(json({ message: "original", client_secret: "original_secret" }));
      const client = modalClient({ checkDiscountCode: vi.fn(async () => ({
        valid: true, code: "BUQMX", discountType: "percent", discountNumber: 10,
        ...(scenario.startsWith("process") ? {} : { checkoutToken: "coupon_order", clientSecret: "coupon_seed" }),
      })) });
      await renderModal(client);
      expect(modalPay().disabled).toBe(false);
      const previousActions = capturedActions.at(-1);
      network.mockResolvedValueOnce(json(scenario === "precio con secret anterior"
        ? { message: "coupon_order", client_secret: "original_secret" }
        : { success: false, message: "No se pudo actualizar" }));

      if (!scenario.startsWith("saveCard")) startCoupon();
      else {
        fireEvent.click(screen.getByRole("button", { name: /opciones de la membresía/i }));
        fireEvent.click(screen.getByRole("checkbox", { name: /guardar mi tarjeta/i }));
      }
      for (let i = 0; i < 4; i++) await advance(25);
      const writes = scenario.startsWith("process") ? calls.filter(({ path }) => path === "processinitialpayment") : updates();
      expect(writes.at(-1)?.body).toMatchObject(!scenario.startsWith("saveCard")
        ? { lineItems: [expect.objectContaining({ unitPrice: 90 })] } : { saveCard: false });
      expect(stripeSessionStatus(modalHost())).toMatchObject({ phase: "error", ready: false });
      expect(modalPay().disabled).toBe(true);
      expect(await triggerGafaPayConfirm("stripe", modalHost())).toBe(false);
      await expect(previousActions.confirm()).rejects.toThrow(/sesión/);
      expect(calls.some(({ path }) => path === "completeinitialpayment")).toBe(false);
      expect(confirm).not.toHaveBeenCalled();
    },
  );

  it.each(["rechazo explícito", "respuesta perdida"])("cerrar con Stripe.confirm en vuelo reserva el mismo carrito (%s)", async (result) => {
    emitPaymentEvents = true;
    const charge = deferred<{ type: "error"; error: { message: string } }>();
    confirm.mockImplementationOnce(() => charge.promise);
    network.mockResolvedValue(json({ message: "first_order", client_secret: "first_secret" }));
    const client = modalClient();
    const onClose = vi.fn();
    const first = await renderModal(client, [line], { onClose });
    network.mockResolvedValueOnce(json(completeSuccess));
    fireEvent.click(modalPay());
    await advance(0);
    expect(confirm).toHaveBeenCalledExactlyOnceWith("first_secret");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar", exact: true }));
    expect(onClose).toHaveBeenCalledOnce();
    first.unmount();

    const beforeReopen = calls.length;
    await renderModal(client);
    expect(screen.queryByRole("button", { name: /^Pagar/ })).toBeNull();
    expect(calls).toHaveLength(beforeReopen);
    if (result === "rechazo explícito") {
      network.mockResolvedValue(json({ message: "fresh_order", client_secret: "fresh_secret" }));
      await act(async () => charge.resolve({ type: "error", error: { message: "Tarjeta rechazada" } }));
      for (let i = 0; i < 4; i++) await advance(25);
      expect(modalPay().disabled).toBe(false);
      expect(modalHost().querySelector("iframe")?.dataset.secret).toBe("fresh_secret");
      expect(confirm).toHaveBeenCalledOnce();
      expect(calls.filter(({ path }) => path === "completeinitialpayment")).toHaveLength(1);
      return;
    }
    await act(async () => charge.reject(new Error("Respuesta de Stripe perdida")));
    fireEvent.click(screen.getByRole("button", { name: "Revisar pago" }));
    await advance(0);
    expect(client.pollInitialPurchaseStatus).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ checkoutToken: "first_order", pendingPurchaseId: 88 }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByText(/gracias por tu compra/i)).toBeTruthy();
    expect(confirm).toHaveBeenCalledOnce();
    expect(calls.filter(({ path }) => path === "completeinitialpayment")).toHaveLength(1);
  });

  it("un process disparado después de dispose nunca llega a la red, aunque se reabra el mismo carrito", async () => {
    bootstrapRequestDelayMs = 1000;
    network.mockResolvedValue(json({ message: "current", client_secret: "current_secret" }));
    const client = modalClient();
    const first = await renderModal(client);
    const oldApi = modalHost().querySelector("stripe-payment-element")!.getAttribute("api-url")!;
    expect(calls).toHaveLength(0);
    first.unmount();
    bootstrapRequestDelayMs = 0;
    await renderModal(client);
    expect(modalPay().disabled).toBe(false);
    const before = calls.length;
    const oauth = await fetch(`${oldApi}/oauth/token`, { method: "POST" });
    expect(oauth.status).toBe(409);
    await advance(1000);
    expect(calls).toHaveLength(before);
    expect(calls.filter(({ path }) => path === "processinitialpayment")).toHaveLength(1);
  });

  it("el primer cupón que vence pone su token en cuarentena incluso tras cerrar y reabrir", async () => {
    network.mockResolvedValue(json({ message: "unsafe_coupon_order", client_secret: "original_secret" }));
    const check = vi.fn(() => new Promise<never>(() => undefined));
    const client = modalClient({ checkDiscountCode: check });
    const first = await renderModal(client);
    startCoupon();
    expect(check).toHaveBeenCalledWith(expect.objectContaining({ checkoutToken: "unsafe_coupon_order", pendingPurchaseId: 88 }));
    network.mockResolvedValue(json({ message: "unsafe_coupon_order", client_secret: "replacement_same_order" }));
    await advance(30_001);
    for (let i = 0; i < 5; i++) await advance(25);
    expect(discountStatus()).toBe("error");
    expect(calls.filter(({ path }) => path === "processinitialpayment")).toHaveLength(2);
    expect(modalPay().disabled).toBe(true);
    first.unmount();

    await renderModal(client);
    expect(stripeSessionStatus(modalHost())).toMatchObject({ phase: "error", ready: false });
    expect(calls.filter(({ path }) => path === "processinitialpayment")).toHaveLength(3);
    expect(modalPay().disabled).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    network.mockResolvedValue(json({ message: "fresh_coupon_order", client_secret: "fresh_coupon_secret" }));
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await advance(100);
    expect(modalPay().disabled).toBe(false);
    expect(modalHost().querySelector("iframe")?.dataset.secret).toBe("fresh_coupon_secret");
  });

  it("la cancelación real atraviesa el decorador de analítica y llega al POST y GET del cliente HTTP", async () => {
    emitPaymentEvents = true;
    const writes: AbortSignal[] = [];
    const polls: AbortSignal[] = [];
    let hangWrite = true;
    hostTransport = vi.fn(async (url, init) => {
      const signal = init!.signal!;
      const hang = () => new Promise<never>((_, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
      if (url.includes("initial-purchase-status")) {
        polls.push(signal);
        return hang();
      }
      writes.push(signal);
      if (hangWrite) return hang();
      return json({ purchase_id: 88, checkout_token: "fresh_order" });
    });
    const http = createHttpGafaClient({ apiBaseUrl: "https://host.example.test", companyId: 1 });
    const client = instrumentClient(modalClient({
      initialPurchase: http.initialPurchase, pollInitialPurchaseStatus: http.pollInitialPurchaseStatus,
    }), createSdkTracker({ hubUrl: "", companyId: 1, enabled: false }));
    network.mockResolvedValue(json({ message: "original_order", client_secret: "original_secret" }));
    const first = await renderModal(client);
    expect(writes).toHaveLength(1);
    expect(writes[0].aborted).toBe(false);
    first.unmount();
    expect(writes[0].aborted).toBe(true);
    hangWrite = false;
    network.mockResolvedValue(json({ message: "fresh_order", client_secret: "fresh_secret" }));
    const second = await renderModal(client);
    expect(modalPay().disabled).toBe(false);
    network.mockResolvedValueOnce(json(completeSuccess));
    fireEvent.click(modalPay());
    await advance(0);
    expect(polls).toHaveLength(1);
    expect(polls[0].aborted).toBe(false);
    second.unmount();
    expect(polls[0].aborted).toBe(true);
  });

  it("un cupón iniciado sin método se publica aunque Stripe se seleccione antes de recibir el resultado", async () => {
    const config = deferred<CheckoutConfig>();
    const coupon = deferred<{ valid: boolean; code: string; discountType: string; discountNumber: number }>();
    let serial = 0;
    network.mockImplementation(async (path) => {
      if (path === "processinitialpayment") serial += 1;
      return json({ message: `session_${serial}`, client_secret: `secret_${serial}` });
    });
    const client = modalClient({ getCheckoutConfig: () => config.promise, checkDiscountCode: vi.fn(() => coupon.promise) });
    await renderModal(client);
    startCoupon();
    expect(calls).toHaveLength(0);
    const stripeConfig = await modalClient().getCheckoutConfig({ brandSlug: "fitspin", locationSlug: "polanco" });
    await act(async () => config.resolve(stripeConfig));
    for (let i = 0; i < 8; i++) await advance(25);
    expect(calls.find(({ path }) => path === "processinitialpayment")?.body.lineItems[0].unitPrice).toBe(100);
    expect(modalPay().disabled).toBe(true);
    await act(async () => coupon.resolve({ valid: true, code: "BUQMX", discountType: "percent", discountNumber: 10 }));
    for (let i = 0; i < 8; i++) await advance(25);
    expect(modalPay().textContent).toBe("Pagar $90");
    expect(modalPay().disabled).toBe(false);
    expect(updates().at(-1)?.body.lineItems[0].unitPrice).toBe(90);
    expect(modalHost().querySelector("iframe")?.dataset.secret).toBe("secret_2");
  });

  it.each(["respuesta HTTP", "cliente personalizado"])("un cupón sin importe computable (%s) jamás aparece aplicado", async (source) => {
    const invalid = { id: 1, code: "BUQMX", discount_type: "percent" };
    const client = modalClient({ checkDiscountCode: vi.fn(async () => source === "respuesta HTTP"
      ? parseDiscountCheckResponse("BUQMX", true, invalid)
      : { valid: true, code: "BUQMX", discountType: "percent" }) });
    let serial = 0;
    network.mockImplementation(async (path) => {
      if (path === "processinitialpayment") serial += 1;
      return json({ message: `session_${serial}`, client_secret: `secret_${serial}` });
    });
    await renderModal(client);
    startCoupon();
    await advance(100);
    expect(discountStatus()).toBe("error");
    expect(screen.queryByText(/descuento aplicado/i)).toBeNull();
    expect(modalPay().textContent).toBe("Pagar $100");
    expect(client.initialPurchase).toHaveBeenLastCalledWith(expect.objectContaining({ discountCode: null }), expect.anything());
  });

  it("Aceptar y pagar no registra el pedido gratuito con un cupón pendiente", async () => {
    const coupon = deferred<never>();
    const check = vi.fn(() => coupon.promise);
    const config = await modalClient().getCheckoutConfig({ brandSlug: "fitspin", locationSlug: "polanco" });
    network.mockResolvedValue(json({ message: "current_order", client_secret: "current_secret" }));
    const register = vi.fn(async () => ({ purchaseId: 89 }));
    const client = modalClient({ getCheckoutConfig: async () => ({ ...config, termsConditionsLink: "https://example.test/terms" }),
      checkDiscountCode: check, reservatePurchase: register });
    await renderModal(client, [{ ...line, price: 0, priceLabel: "$0" }]);
    const pay = screen.getByRole("button", { name: "Confirmar pedido" }) as HTMLButtonElement;
    fireEvent.click(pay);
    const accept = screen.getByRole("button", { name: "Aceptar y pagar" });
    startCoupon();
    expect(discountStatus()).toBe("checking");
    expect(pay.disabled).toBe(true);
    fireEvent.click(accept);
    await advance(0);
    expect(register).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("usa los 60 días de la respuesta vigente en vez de los 30 guardados en el carrito", async () => {
    network.mockResolvedValue(json({ message: "current_order", client_secret: "current_secret" }));
    const client = modalClient({ listMemberships: async () => [{
      id: 12, type: "membership", name: line.name, can_subscribe: true, expirationDays: 60,
    }] });
    await renderModal(client);
    expect(calls.every(({ body }) => body.paymentFrequency === 60 && body.recurringPayment === true)).toBe(true);
    expect(modalHost().querySelector("stripe-payment-element")?.getAttribute("payment-frequency")).toBe("60");
    expect(client.initialPurchase).toHaveBeenLastCalledWith(expect.objectContaining({
      subscribe: true, lines: [expect.objectContaining({ raw: expect.objectContaining({ expiration_days: 60 }) })],
    }), expect.anything());
  });

  it("un catálogo anterior en caché y el respaldo no autorizan recurrencia si falla la consulta actual", async () => {
    network.mockResolvedValue(json({ message: "single_order", client_secret: "single_secret" }));
    const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const saved = { id: 12, type: "membership" as const, name: line.name, can_subscribe: true, expirationDays: 30 };
    query.setQueryData(checkoutCatalogQueryKey("fitspin"), { memberships: [saved], combos: [], products: [] });
    const catalog = deferred<never>();
    const config = await modalClient().getCheckoutConfig({ brandSlug: "fitspin", locationSlug: "polanco" });
    const client = modalClient({ listMemberships: () => catalog.promise, getCheckoutConfig: async () => ({ ...config, memberships: [saved] }) });
    await renderModal(client, [line], {}, query);
    expect(calls).toHaveLength(0);
    await act(async () => catalog.reject(new Error("Catálogo no disponible")));
    for (let i = 0; i < 8; i++) await advance(25);
    expect(modalPay().disabled).toBe(false);
    expect(calls.every(({ body }) => body.recurringPayment === false && body.paymentFrequency === null)).toBe(true);
    expect(client.initialPurchase).toHaveBeenLastCalledWith(expect.objectContaining({ subscribe: false }), expect.anything());
  });

  it("Stripe cobra y registra 106,50 € por la membresía descontada y la matrícula íntegra", async () => {
    emitPaymentEvents = true;
    const config = await modalClient().getCheckoutConfig({ brandSlug: "fitspin", locationSlug: "polanco" });
    const fee = { id: 13, type: "combo" as const, name: "Matrícula", price: 30 };
    const splitCharge = vi.fn();
    const client = modalClient({
      listCombos: async () => [fee],
      getCheckoutConfig: async () => ({ ...config, combos: [fee], currency: { prefix: "€", suffix: "EUR", code: "EUR" } }),
      checkDiscountCode: vi.fn(async () => ({ valid: true, code: "BUQMX", discountType: "percent", discountNumber: 10 })),
    });
    let serial = 0;
    network.mockImplementation(async (path) => {
      if (path === "completeinitialpayment") return json({ message: "Pago completado", webToken: "" });
      if (path === "processinitialpayment") serial += 1;
      return json({ message: `enrollment_${serial}`, client_secret: `enrollment_secret_${serial}` });
    });
    await renderModal(client, [{ ...line, price: 85, priceLabel: "85€" }], {
      membershipEnrollment: { comboId: fee.id, membershipIds: [line.id] }, chargeEnrollmentFee: splitCharge,
    });
    const before = calls.length;
    startCoupon();
    for (let i = 0; i < 8; i++) await advance(25);
    const pay = screen.getByRole("button", { name: /Pagar 106[.,]50€/ }) as HTMLButtonElement;
    expect(pay.disabled).toBe(false);
    fireEvent.click(pay);
    await advance(0);
    expect(calls.slice(before).map(({ path }) => path)).toEqual(["processinitialpayment", "updateinitialpayment", "completeinitialpayment"]);
    for (const { body } of calls.slice(before)) {
      expect(body.currency).toBe("eur");
      expect(body.lineItems).toEqual([
        expect.objectContaining({ type: "combo", unitPrice: 30, quantity: 1 }),
        expect.objectContaining({ type: "membership", unitPrice: 76.5, quantity: 1 }),
      ]);
    }
    expect(client.initialPurchase).toHaveBeenLastCalledWith(expect.objectContaining({ subscribe: true, lines: [
      expect.objectContaining({ id: line.id, price: 85 }), expect.objectContaining({ id: fee.id, price: 30 }),
    ] }), expect.anything());
    expect(confirm).toHaveBeenCalledOnce();
    expect(splitCharge).not.toHaveBeenCalled();
    expect(screen.getByText(/106[.,]50€/)).toBeTruthy();
  });

  it("un error obsoleto de complete no apaga Procesando de la revisión vigente", async () => {
    emitPaymentEvents = true;
    const complete = deferred<Response>(), nextComplete = deferred<Response>();
    const history = vi.fn(async () => []);
    const client = modalClient({ listUserPurchases: history });
    network.mockResolvedValue(json({ message: "original", client_secret: "original_secret" }));
    await renderModal(client);
    network.mockImplementationOnce(() => complete.promise).mockImplementation(async (path) => path === "completeinitialpayment"
      ? nextComplete.promise : json({ message: "replacement", client_secret: "replacement_secret" }));
    fireEvent.click(modalPay());
    await advance(0);
    expect(screen.getByRole("button", { name: "Procesando…" })).toBeTruthy();
    const previousRevision = stripeSessionStatus(modalHost())?.revision;
    await act(async () => notifyStripeDiscountAdded({
      previous_checkout_token: "original", checkout_token: "replacement", client_secret: "replacement_seed",
    }));
    await act(async () => complete.resolve(json({ success: false, message: "Error obsoleto" })));
    await advance(0);
    expect(stripeSessionStatus(modalHost())?.ready).toBe(true);
    expect(stripeSessionStatus(modalHost())?.revision).not.toBe(previousRevision);
    await act(async () => { expect(await triggerGafaPayConfirm("stripe", modalHost())).toBe(true); });
    await advance(0);
    expect(screen.getByRole("button", { name: "Procesando…" })).toBeTruthy();
    expect(history).toHaveBeenCalledOnce();
    expect(screen.queryByText(/error obsoleto/i)).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });

  it.each([undefined, false, true])("sin catálogo, can_subscribe=%s de config nunca habilita la renovación", async (canSubscribe) => {
    network.mockResolvedValue(json({ message: "current", client_secret: "current_secret" }));
    const config = await modalClient().getCheckoutConfig({ brandSlug: "fitspin", locationSlug: "polanco" });
    const memberships = deferred<never>();
    const client = modalClient({
      listMemberships: () => memberships.promise,
      getCheckoutConfig: async () => ({ ...config, memberships: [{
        id: 12, name: line.name, type: "membership", subscribable: true, can_subscribe: canSubscribe,
      }] }),
    });
    await renderModal(client);
    expect(calls).toHaveLength(0);
    expect(modalPay().disabled).toBe(true);
    await act(async () => memberships.reject(new Error("Catálogo no disponible")));
    for (let i = 0; i < 4; i++) await advance(25);
    const recurring = false;
    expect(modalPay().disabled).toBe(false);
    expect(Boolean(screen.queryByRole("checkbox", { name: "Pago recurrente" }))).toBe(recurring);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(({ body }) => body.recurringPayment === recurring && body.paymentFrequency === (recurring ? 30 : null))).toBe(true);
    expect(client.initialPurchase).toHaveBeenLastCalledWith(expect.objectContaining({ subscribe: recurring }), expect.anything());
  });

  it.each(["cantidad 2", "dos membresías", "línea con costo", "sin días", "días fraccionarios"])("modal real: %s exige pago único en atributos, estado y todos los payloads", async (kind) => {
    network.mockResolvedValue(json({ message: "single", client_secret: "single_secret" }));
    const lines = kind === "cantidad 2" ? [{ ...line, amount: 2 }]
      : kind === "dos membresías" ? [line, { ...line, key: "second", id: 13 }]
      : kind === "línea con costo" ? [line, { ...line, key: "extra", type: "product" as const, price: 10 }]
      : [{ ...line, raw: { ...line.raw, expiration_days: kind === "sin días" ? 0 : 1.5 } }];
    const client = modalClient(kind === "sin días" || kind === "días fraccionarios" ? {
      listMemberships: async () => [{
        id: 12, type: "membership", name: line.name, can_subscribe: true,
        expirationDays: kind === "sin días" ? undefined : 1.5,
      }],
    } : {});
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
