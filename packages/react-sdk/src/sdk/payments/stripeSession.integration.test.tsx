import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mountGafaPayWidget, waitForWidgetContent, triggerGafaPayConfirm, notifyStripeDiscountAdded,
  type GafaPayWidgetProps, type GafaPayIsland,
} from "./gafaPay";
import { resetStripeSessionFetchGuardForTests, type StripeCheckoutState } from "./stripeSessionGuard";
import { bindStripeMembershipRecurrence, syncGafaPayMembershipToggles } from "../cart/membershipPayOptions";

const API = "https://payments.example.test/api/stripe.";
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
const post = async (path: string, body: object) => (await fetch(API + path, {
  method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer fixture" }, body: JSON.stringify(body),
})).json();

type Payment = { message: string; client_secret: string };
const initStripe = vi.fn();
const confirm = vi.fn();
let formMounts = 0;

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
    initStripe(payment.client_secret);
  }, []);
  useEffect(() => {
    setBusy(true);
    void post("updateinitialpayment", updateBody(props, payment.message, saveCard, recurring)).then((data) => {
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
    await post("completeinitialpayment", { tokenInput: payment.message, saveCard });
    await confirm(payment.client_secret);
  }}>
    <iframe title="Payment Element" data-secret={payment.client_secret} />
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
    }).then((data) => {
      if (!data.client_secret) return;
      setPayment(data);
      host.dispatchEvent(new CustomEvent("initial-payment-created", { detail: data }));
    });
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
    this.root.render(<Iife host={this} props={nextProps} />);
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
    checkout = {};
    box = document.createElement("div"); document.body.appendChild(box);
    purchase = vi.fn(async () => undefined);
    network = vi.fn();
    window.fetch = (async (input, init) => {
      const path = String(input).split("stripe.")[1];
      const body = JSON.parse(String(init?.body)); calls.push({ path, body, ...(path === "completeinitialpayment" ? {} : { authorization: new Headers(init?.headers).get("Authorization") }) });
      return network(path, body);
    }) as typeof fetch;
  });
  afterEach(async () => {
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
      hasRecurringPayment: checkout.recurringPayment,
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
      { path: "completeinitialpayment", body: { tokenInput: "same_token", saveCard: true } },
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
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
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
      { path: "completeinitialpayment", body: { tokenInput: "discount_token", saveCard: true, recurringPayment: true } },
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

  it("acepta el éxito tardío de la revisión vigente después de un timeout de inactividad", async () => {
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
    expect(await syncGafaPayMembershipToggles(box, { saveCard: true, autoRenew: true })).toBe(true);
    expect(box.querySelector("iframe")?.getAttribute("data-secret")).toBe("late_current");
    stop();
  });

  it("registra un update nuevo aunque conserve tanto token como secret, sin duplicar el evento final", async () => {
    network.mockImplementation(async () => json({ message: "same_token", client_secret: "same_secret", subscriptionId: "sub_test" }));
    await mount(1); await advance(0);
    expect(purchase).toHaveBeenCalledTimes(2); // process + update, sin el eco del IIFE
    expect(purchase.mock.calls[1][0].subscriptionId).toBeNull();
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
    await advance(0);
    expect(purchase).toHaveBeenCalledTimes(3); // es otra petición válida, no un eco
    expect(purchase.mock.calls[2][0].subscriptionId).toBe("sub_test");
    expect(formMounts).toBe(1);
    expect(updates()).toHaveLength(2);
    expect(checkout.saveCard).toBe(true);
  });

  it("descarta la respuesta superada con el mismo token y serializa los cambios del checkout", async () => {
    const old = deferred<Response>();
    network.mockImplementation(async () => json({ message: "same_token", client_secret: "current" }));
    await mount(1); await advance(0);
    network.mockImplementationOnce(() => old.promise)
      .mockImplementationOnce(async () => json({ message: "same_token", client_secret: "newest" }));
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
    const count = updates().length;
    await act(async () => (box.querySelector("input") as HTMLInputElement).click());
    expect(updates()).toHaveLength(count); // B espera la respuesta de A
    await act(async () => { old.resolve(json({ message: "same_token", client_secret: "obsolete" })); });
    await advance(0);
    expect(updates()).toHaveLength(count + 1);
    expect(box.querySelector("iframe")?.getAttribute("data-secret")).toBe("newest");
    expect(purchase.mock.calls.map(([data]) => data.client_secret)).not.toContain("obsolete");
    expect(initStripe.mock.calls.flat()).toEqual(["current", "newest"]);
    expect(updates().slice(-2).map(({ body }) => [body.recurringPayment, body.saveCard]))
      .toEqual([[true, true], [false, true]]);
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
    expect(calls).toHaveLength(beforeOptOut); // el nuevo process espera al update anterior
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
});
