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
    { name: "distinto al tokenInput", tokenInput: "tok_1", message: "tok_2" },
    { name: "igual al tokenInput", tokenInput: "tok_1", message: "tok_1" },
    { name: "sin tokenInput", tokenInput: undefined, message: "tok_2" },
  ])("conserva client_secret del servidor con message $name", async ({ tokenInput, message }) => {
    const network = vi.fn(async () => jsonResponse({ client_secret: "cs_2", message }));
    window.fetch = network as typeof fetch;
    installStripeSessionFetchGuard();

    const response = await fetch("https://apipay.buq.partners/api/stripe.updateinitialpayment", {
      method: "POST",
      body: JSON.stringify({ tokenInput }),
    });

    expect(await response.json()).toEqual({ client_secret: "cs_2", message });
    expect(network).toHaveBeenCalledTimes(1);
  });

  it("el update con secret nuevo remonta el provider y su update idéntico no vuelve a la red", async () => {
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

    expect(updates).toBe(2);
    const updateCalls = network.mock.calls.filter(([url]) => String(url).includes("updateinitialpayment"));
    expect(updateCalls).toHaveLength(1);
    expect(network.mock.calls.filter(([url]) => String(url).includes("processinitialpayment"))).toHaveLength(1);
  });

  it("tras remount por cantidad el consumidor acaba con el secret vigente aunque no cambie el token", async () => {
    const api = "https://apipay.buq.partners/api/stripe.";
    let activeSecret = "";
    const network = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { quantity } = JSON.parse(String(init?.body));
      const message = `tok_${quantity}`;
      if (String(input).endsWith("processinitialpayment")) {
        activeSecret = `cs_${quantity}_process`;
      } else if (quantity === 2) {
        // El backend reemplaza la sesión Stripe conservando el token de compra.
        activeSecret = "cs_2_update";
      }
      return jsonResponse({ client_secret: activeSecret, message });
    });
    window.fetch = network as typeof fetch;
    installStripeSessionFetchGuard();

    async function mount(quantity: number) {
      const initial = await (await fetch(`${api}processinitialpayment`, {
        method: "POST", body: JSON.stringify({ quantity }),
      })).json();
      let secret = initial.client_secret;
      let token = initial.message;
      const providerSecrets = [secret];
      // Contrato de vw/hw: actualizar al montar y volver a montar solo si cambia la key (secret).
      for (let i = 0; i < 12; i += 1) {
        const update = await (await fetch(`${api}updateinitialpayment`, {
          method: "POST", body: JSON.stringify({ quantity, tokenInput: token }),
        })).json();
        if (!update.client_secret || update.client_secret === secret) break;
        secret = update.client_secret;
        token = update.message;
        providerSecrets.push(secret);
      }
      return { secret, providerSecrets };
    }

    expect((await mount(1)).secret).toBe(activeSecret);
    const remount = await mount(2);
    expect(remount.secret).toBe(activeSecret);
    expect(remount.providerSecrets).toEqual(["cs_2_process", "cs_2_update"]);
    expect(network.mock.calls.filter(([url]) => String(url).endsWith("updateinitialpayment"))).toHaveLength(2);
  });

  it("no convierte un fallo HTTP en éxito al reintentar el mismo update", async () => {
    const network = vi.fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ client_secret: "cs_retry", message: "tok_1" }));
    window.fetch = network as typeof fetch;
    installStripeSessionFetchGuard();
    const url = "https://apipay.buq.partners/api/stripe.updateinitialpayment";
    const init = { method: "POST", body: JSON.stringify({ tokenInput: "tok_1" }) };

    expect((await fetch(url, init)).status).toBe(503);
    expect(await (await fetch(url, init)).json()).toEqual({ client_secret: "cs_retry", message: "tok_1" });
    expect(network).toHaveBeenCalledTimes(2);
  });

  it("debouncea POSTs idénticos y conserva el último secret real al vencer la ventana aunque el token no cambie", async () => {
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const network = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ client_secret: "cs_x", message: "tok_1" }))
      .mockResolvedValueOnce(jsonResponse({ client_secret: "cs_latest", message: "tok_1" }));
    window.fetch = network as typeof fetch;
    installStripeSessionFetchGuard();

    const body = JSON.stringify({ tokenInput: "tok_1", lineItems: [] });
    const first = await fetch("https://apipay.buq.partners/api/stripe.updateinitialpayment", { method: "POST", body });
    expect(await first.json()).toEqual({ client_secret: "cs_x", message: "tok_1" });
    const suppressed = await fetch("https://apipay.buq.partners/api/stripe.updateinitialpayment", { method: "POST", body });
    expect(await suppressed.json()).toEqual({ message: "tok_1" });
    expect(network).toHaveBeenCalledTimes(1);

    now += STRIPE_UPDATE_DEBOUNCE_MS + 1;
    const repeated = await fetch("https://apipay.buq.partners/api/stripe.updateinitialpayment", { method: "POST", body });
    expect(await repeated.json()).toEqual({ client_secret: "cs_latest", message: "tok_1" });
    expect(network).toHaveBeenCalledTimes(2);
  });
});
