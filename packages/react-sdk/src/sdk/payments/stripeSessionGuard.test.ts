import { afterEach, describe, expect, it, vi } from "vitest";
import {
  STRIPE_UPDATE_DEBOUNCE_MS,
  afterStrictModePass,
  installStripeSessionFetchGuard,
  resetStripeSessionFetchGuardForTests,
} from "./stripeSessionGuard";

describe("afterStrictModePass", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("StrictMode mount→cleanup→mount solo deja correr el segundo", async () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const first = afterStrictModePass(run);
    first();
    const second = afterStrictModePass(run);
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    second();
  });
});

describe("installStripeSessionFetchGuard", () => {
  const nativeFetch = globalThis.fetch;

  afterEach(() => {
    resetStripeSessionFetchGuardForTests();
    globalThis.fetch = nativeFetch;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function jsonResponse(data: unknown) {
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  it.each([
    { name: "distinto al tokenInput conserva client_secret", tokenInput: "tok_1", message: "tok_2", keepsSecret: true },
    { name: "igual al tokenInput borra client_secret", tokenInput: "tok_1", message: "tok_1", keepsSecret: false },
    { name: "sin tokenInput borra client_secret", tokenInput: undefined, message: "tok_2", keepsSecret: false },
  ])("update con message $name", async ({ tokenInput, message, keepsSecret }) => {
    const network = vi.fn(async () => jsonResponse({ client_secret: "cs_2", message }));
    window.fetch = network as typeof fetch;
    installStripeSessionFetchGuard();

    const response = await fetch("https://apipay.buq.partners/api/stripe.updateinitialpayment", {
      method: "POST",
      body: JSON.stringify({ tokenInput }),
    });

    expect(await response.json()).toEqual(keepsSecret ? { client_secret: "cs_2", message } : { message });
    expect(network).toHaveBeenCalledTimes(1);
  });

  it("un harness con 12 updates del IIFE solo pega una vez a la red y sin client_secret", async () => {
    const network = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("processinitialpayment")) {
        return jsonResponse({ client_secret: "cs_1", message: "tok_1" });
      }
      if (url.includes("updateinitialpayment")) {
        return jsonResponse({ client_secret: "cs_2", message: "tok_1" });
      }
      return jsonResponse({});
    });
    window.fetch = network as typeof fetch;
    installStripeSessionFetchGuard();

    await fetch("https://apipay.buq.partners/api/stripe.processinitialpayment", {
      method: "POST",
      body: "{}",
    });

    let updates = 0;
    for (let i = 0; i < 12; i += 1) {
      updates += 1;
      const res = await fetch("https://apipay.buq.partners/api/stripe.updateinitialpayment", {
        method: "POST",
        body: JSON.stringify({ tokenInput: "tok_1" }),
      });
      const data = (await res.json()) as { client_secret?: string };
      if (!data.client_secret) break;
    }

    expect(updates).toBe(1);
    const updateCalls = network.mock.calls.filter(([url]) => String(url).includes("updateinitialpayment"));
    expect(updateCalls).toHaveLength(1);
    expect(network.mock.calls.filter(([url]) => String(url).includes("processinitialpayment"))).toHaveLength(1);
  });

  it("debouncea POSTs idénticos dentro de la ventana", async () => {
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const network = vi.fn(async () => jsonResponse({ client_secret: "cs_x", message: "tok_1" }));
    window.fetch = network as typeof fetch;
    installStripeSessionFetchGuard();

    const body = JSON.stringify({ tokenInput: "tok_1", lineItems: [] });
    await fetch("https://apipay.buq.partners/api/stripe.updateinitialpayment", { method: "POST", body });
    await fetch("https://apipay.buq.partners/api/stripe.updateinitialpayment", { method: "POST", body });
    expect(network).toHaveBeenCalledTimes(1);

    now += STRIPE_UPDATE_DEBOUNCE_MS + 1;
    await fetch("https://apipay.buq.partners/api/stripe.updateinitialpayment", { method: "POST", body });
    expect(network).toHaveBeenCalledTimes(2);
  });

  it("nunca deduplica actualizaciones con recurringPayment, ni siquiera consecutivas", async () => {
    const network = vi.fn(async () => jsonResponse({ message: "tok_1", client_secret: "cs_x" }));
    window.fetch = network as typeof fetch;
    installStripeSessionFetchGuard();
    for (const recurringPayment of [true, false, false, true, false]) {
      const response = await fetch("https://apipay.example/api/stripe.updateinitialpayment", {
        method: "POST", body: JSON.stringify({ tokenInput: "tok_1", recurringPayment }),
      });
      expect(await response.json()).toEqual({ message: "tok_1" });
    }
    expect(network).toHaveBeenCalledTimes(5);
  });

  it("invalida la respuesta previa si cambia el cuerpo de la misma sesión", async () => {
    const network = vi.fn(async () => jsonResponse({ message: "tok_1" }));
    window.fetch = network as typeof fetch;
    installStripeSessionFetchGuard();
    for (const discountAmount of [0, 10, 0]) {
      await fetch("https://apipay.example/api/stripe.updateinitialpayment", {
        method: "POST", body: JSON.stringify({ tokenInput: "tok_1", discountAmount }),
      });
    }
    expect(network).toHaveBeenCalledTimes(3);
  });

  it("no convierte un fallo de red en éxito sintético al reintentar", async () => {
    const network = vi.fn(async () => new Response("error", { status: 500 }));
    window.fetch = network as typeof fetch;
    installStripeSessionFetchGuard();
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch("https://apipay.example/api/stripe.updateinitialpayment", {
        method: "POST", body: JSON.stringify({ tokenInput: "tok_1" }),
      });
      expect(response.status).toBe(500);
    }
    expect(network).toHaveBeenCalledTimes(2);
  });
});

import { stripeHarness, deferred, json } from "../../../test/stripeHarness";
import { chooseStripeRecurrence, replaceStripeSession, stripeRecurrenceConfirmed, waitForStripeSession } from "./stripeSessionGuard";
import { setStripeMembershipAutoRenew } from "../cart/membershipPayOptions";

describe("sesiones Stripe del SDK", () => {
  afterEach(() => { resetStripeSessionFetchGuardForTests(); vi.unstubAllGlobals(); document.body.innerHTML = ""; });
  async function setup() {
    const harness = stripeHarness();
    const root = document.createElement("div"); document.body.append(root);
    const mount = harness.mount(root);
    await mount.ready;
    return { ...harness, createMount: harness.mount, root, mount };
  }
  const update = (tokenInput: string, recurringPayment: boolean, extra = {}) => fetch("https://stripe.test/api/stripe.updateinitialpayment", {
    method: "POST", body: JSON.stringify({ tokenInput, recurringPayment, ...extra }),
  });

  it("serializa peticiones reales solapadas y la respuesta anterior no confirma ni aporta secret", async () => {
    const { mount, respondWith, network } = await setup();
    const first = deferred<Response>(); const last = deferred<Response>();
    respondWith(async (_url, body) => body.recurringPayment ? first.promise : last.promise);
    chooseStripeRecurrence(mount.element, true);
    const a = update(mount.token, true);
    await vi.waitFor(() => expect(network).toHaveBeenCalledTimes(3));
    chooseStripeRecurrence(mount.element, false);
    const b = update(mount.token, false);
    expect(network).toHaveBeenCalledTimes(3); // only one update is on the wire
    first.resolve(json({ message: mount.token, client_secret: "cs_stale" }));
    expect(await (await a).json()).toEqual({});
    expect(stripeRecurrenceConfirmed(mount.element, false)).toBe(false);
    await vi.waitFor(() => expect(network).toHaveBeenCalledTimes(4));
    last.resolve(json({ message: mount.token, client_secret: "cs_current" }));
    expect(await (await b).json()).toEqual({ message: mount.token, client_secret: "cs_current" });
    expect(stripeRecurrenceConfirmed(mount.element, false)).toBe(true);
  });

  it.each([true, false])("envía el token rotado de una respuesta obsoleta en la elección encolada (%s)", async (choice) => {
    const { mount, respondWith, network } = await setup();
    const held = deferred<Response>();
    let calls = 0;
    respondWith(async (_url, body) => {
      if (++calls === 1) return held.promise;
      if (body.tokenInput !== "tok_continuation") return new Response("Checkout Session not created", { status: 404 });
      return json({ message: "tok_final", client_secret: "cs_final" });
    });
    chooseStripeRecurrence(mount.element, choice);
    const first = update(mount.token, choice, { saveCard: true });
    await vi.waitFor(() => expect(calls).toBe(1));
    chooseStripeRecurrence(mount.element, !choice);
    const latest = update(mount.token, !choice);
    held.resolve(json({ message: "tok_continuation", client_secret: "cs_obsolete" }));
    expect(await (await first).json()).toEqual({});
    expect(await (await latest).json()).toEqual({ message: "tok_final", client_secret: "cs_final" });
    expect(JSON.parse(String(network.mock.calls.at(-1)![1]?.body)).tokenInput).toBe("tok_continuation");
    expect(stripeRecurrenceConfirmed(mount.element, !choice)).toBe(true);
  });

  it("conserva el token si la elección cambia entre fetch y json", async () => {
    const { mount, respondWith } = await setup();
    respondWith(async () => json({ message: "tok_unconsumed", client_secret: "cs_unconsumed" }));
    chooseStripeRecurrence(mount.element, true);
    const response = await update(mount.token, true);
    chooseStripeRecurrence(mount.element, false);
    expect(await response.json()).toEqual({});
    respondWith(async (_url, body) => body.tokenInput === "tok_unconsumed"
      ? json({ message: "tok_final", client_secret: "cs_final" })
      : new Response("Checkout Session not created", { status: 404 }));
    expect(await (await update(mount.token, false)).json()).toEqual({ message: "tok_final", client_secret: "cs_final" });
    expect(stripeRecurrenceConfirmed(mount.element, false)).toBe(true);
  });

  it("un descuento invalida antes de publicar y no acepta la continuación de su sesión anterior", async () => {
    const { mount, respondWith } = await setup();
    const held = deferred<Response>();
    let calls = 0;
    respondWith(async (_url, body) => {
      if (++calls === 1) return held.promise;
      expect(body.tokenInput).toBe("tok_discount");
      return json({ message: "tok_discount", client_secret: "cs_discount" });
    });
    const oldUpdate = update(mount.token, false, { saveCard: true });
    await vi.waitFor(() => expect(calls).toBe(1));
    const published = vi.fn(() => {
      expect(stripeRecurrenceConfirmed(mount.element, false)).toBe(false);
    });
    const replacement = replaceStripeSession(mount.token, { checkout_token: "tok_discount", client_secret: "cs_discount" }, published);
    expect(published).toHaveBeenCalledOnce();
    held.resolve(json({ message: "tok_old_continuation", client_secret: "cs_old" }));
    expect(await (await oldUpdate).json()).toEqual({});
    expect(await replacement).toBe(true);
    expect(stripeRecurrenceConfirmed(mount.element, false)).toBe(true);
    const count = calls;
    expect(await (await update(mount.token, false)).json()).toEqual({});
    expect(calls).toBe(count);
  });

  it("rechaza descuentos atrasados de un montaje retirado o de un token sustituido", async () => {
    const { root, mount, createMount } = await setup();
    const previousToken = mount.token;
    mount.unmount();
    const fresh = createMount(root);
    await fresh.ready;
    const publish = vi.fn();
    expect(await replaceStripeSession(previousToken, { checkout_token: "tok_late", client_secret: "cs_late" }, publish)).toBe(false);
    expect(publish).not.toHaveBeenCalled();
    expect(stripeRecurrenceConfirmed(fresh.element, false)).toBe(true);
    const first = replaceStripeSession(fresh.token, { checkout_token: "tok_discount", client_secret: "cs_discount" }, publish);
    expect(await replaceStripeSession(fresh.token, { checkout_token: "tok_late", client_secret: "cs_late" }, publish)).toBe(false);
    expect(publish).toHaveBeenCalledOnce();
    expect(await first).toBe(true);
  });

  it("descarta un update retirado aunque el siguiente montaje esté esperando el mismo valor", async () => {
    const { root, mount: old, respondWith, network, createMount } = await setup();
    const late = deferred<Response>(); const latest = deferred<Response>();
    respondWith(async (url, body) => url.includes("processinitialpayment")
      ? json({ message: "tok_new", client_secret: "cs_new" })
      : body.tokenInput === old.token ? late.promise : latest.promise);
    const previous = update(old.token, false, { saveCard: false });
    await Promise.resolve();
    old.unmount();
    const fresh = createMount(root, false);
    await vi.waitFor(() => expect(network.mock.calls.some(([, init]) => String(init?.body).includes("tok_new"))).toBe(true));
    const ready = vi.fn(); void waitForStripeSession(fresh.element).then(ready);
    late.resolve(json({ message: "tok_retired_continuation", client_secret: "cs_old" }));
    expect(await (await previous).json()).toEqual({});
    const count = network.mock.calls.length;
    expect(await (await update("tok_retired_continuation", false)).json()).toEqual({});
    expect(network).toHaveBeenCalledTimes(count);
    expect(ready).not.toHaveBeenCalled();
    expect(stripeRecurrenceConfirmed(fresh.element, false)).toBe(false);
    latest.resolve(json({ message: "tok_new" }));
    await fresh.ready;
    expect(stripeRecurrenceConfirmed(fresh.element, false)).toBe(true);
  });

  it("vuelve a comprobar la versión al consumir json(), no sólo al terminar fetch", async () => {
    const { mount } = await setup();
    chooseStripeRecurrence(mount.element, true);
    const response = await update(mount.token, true);
    chooseStripeRecurrence(mount.element, false);
    expect(await response.json()).toEqual({});
    expect(stripeRecurrenceConfirmed(mount.element, false)).toBe(false);
  });

  it("bloquea completeinitialpayment cuando cambió la casilla o el montaje", async () => {
    const { root, mount, network } = await setup();
    expect(await setStripeMembershipAutoRenew(root, true)).toBe(true);
    const complete = () => fetch("https://stripe.test/api/stripe.completeinitialpayment", {
      method: "POST", body: JSON.stringify({ tokenInput: mount.token, recurringPayment: true }),
    });
    chooseStripeRecurrence(mount.element, false);
    await expect(complete()).rejects.toThrow("elección recurrente");
    mount.unmount();
    await expect(complete()).rejects.toThrow("vigente");
    expect(network.mock.calls.some(([url]) => String(url).includes("completeinitialpayment"))).toBe(false);
  });

  it("no confirma cambios recurrentes si la respuesta no trae el secret correspondiente", async () => {
    const { root, mount, respondWith } = await setup();
    await setStripeMembershipAutoRenew(root, true);
    respondWith(async () => json({ message: mount.token }));
    expect(await setStripeMembershipAutoRenew(root, false)).toBe(false);
    expect(stripeRecurrenceConfirmed(mount.element, false)).toBe(false);
  });
});

it("completeinitialpayment atrasado no permite confirmar si cambió la elección mientras viajaba", async () => {
  const harness = stripeHarness();
  const root = document.createElement("div"); document.body.append(root);
  const mount = harness.mount(root);
  try {
    await mount.ready;
    expect(await setStripeMembershipAutoRenew(root, true)).toBe(true);
    const held = deferred<Response>(); harness.respondWith(async () => held.promise);
    const pending = fetch("https://stripe.test/api/stripe.completeinitialpayment", {
      method: "POST", body: JSON.stringify({ tokenInput: mount.token, recurringPayment: true }),
    });
    chooseStripeRecurrence(mount.element, false);
    held.resolve(json({ message: "complete" }));
    const response = await pending;
    await expect(response.json()).rejects.toThrow("durante la confirmación");
  } finally {
    mount.unmount(); resetStripeSessionFetchGuardForTests(); vi.unstubAllGlobals(); root.remove();
  }
});
