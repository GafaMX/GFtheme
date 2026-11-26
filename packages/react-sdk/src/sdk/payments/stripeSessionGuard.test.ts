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
});
