import { afterEach, describe, expect, it, vi } from "vitest";
import { installStripeSurfaceTracking } from "./stripeSurface";

describe("Stripe Checkout Elements surface adapter", () => {
  const globals = window as unknown as Record<string, any>;
  const originalDescriptor = Object.getOwnPropertyDescriptor(window, "Stripe");
  let restore: (() => void) | undefined;
  afterEach(() => {
    restore?.(); restore = undefined;
    delete globals.Stripe;
    if (originalDescriptor) Object.defineProperty(window, "Stripe", originalDescriptor);
    document.body.replaceChildren();
  });
  function fixture() {
    let ready: (() => void) | undefined;
    const payment = { on: vi.fn((event, callback) => { if (event === "ready") ready = callback; }),
      mount: vi.fn(), destroy: vi.fn(), update: vi.fn() };
    const confirm = vi.fn(async () => ({ type: "success" }));
    const checkout = { createPaymentElement: vi.fn(() => payment),
      loadActions: vi.fn(async () => ({ type: "success", actions: { confirm } })) };
    const instance = { initCheckoutElementsSdk: vi.fn(() => checkout), other: vi.fn(function (this: unknown) { return this; }) };
    const factory = Object.assign(vi.fn(() => instance), { version: "dahlia" });
    const lifecycle = { owns: (secret: string) => secret === "current", mount: vi.fn(() => true),
      ready: vi.fn(), unmount: vi.fn(), canConfirm: vi.fn(() => false), confirmed: vi.fn() };
    return { payment, confirm, checkout, instance, factory, lifecycle, ready: () => ready?.() };
  }

  it("intercepts the factory cached eagerly by the IIFE, and confirms only through the current session gate", async () => {
    const f = fixture();
    globals.Stripe = f.factory;
    const cachedByIife = globals.Stripe; // @stripe/stripe-js caches this before SDK mount.
    restore = installStripeSurfaceTracking(f.lifecycle);
    const stripe = cachedByIife.apply(undefined, ["pk_test_fixture"]);
    const checkout = stripe.initCheckoutElementsSdk({ clientSecret: "current" });
    const payment = checkout.createPaymentElement();
    const node = document.createElement("div"); document.body.appendChild(node);
    payment.mount(node); f.ready();
    expect(f.lifecycle.mount).toHaveBeenCalledWith("current", node, expect.any(Function), expect.any(Object));
    expect(f.lifecycle.ready).toHaveBeenCalledWith("current", node);
    expect(f.payment.mount).toHaveBeenCalledExactlyOnceWith(node);
    const result = await checkout.loadActions();
    await expect(result.actions.confirm()).rejects.toThrow(/sesión/);
    expect(f.confirm).not.toHaveBeenCalled();
    f.lifecycle.canConfirm.mockReturnValue(true);
    await result.actions.confirm();
    expect(f.confirm).toHaveBeenCalledOnce();
    expect(f.lifecycle.confirmed).toHaveBeenCalledExactlyOnceWith("current", true, expect.any(Object));
    payment.destroy();
    expect(f.lifecycle.unmount).toHaveBeenCalledExactlyOnceWith("current", node);
    restore(); restore = undefined;
    expect(Object.hasOwn(cachedByIife, "apply")).toBe(false);
  });

  it("tracks Stripe.js arriving later and preserves its factory and unrelated Stripe checkouts", () => {
    const f = fixture(); delete globals.Stripe;
    restore = installStripeSurfaceTracking(f.lifecycle);
    globals.Stripe = f.factory;
    expect(globals.Stripe.version).toBe("dahlia");
    const stripe = globals.Stripe("pk_test_fixture");
    expect(stripe.other()).toBe(f.instance);
    const external = stripe.initCheckoutElementsSdk({ clientSecret: "external_checkout" });
    expect(external).toBe(f.checkout);
    external.createPaymentElement().mount(document.createElement("div"));
    expect(f.lifecycle.mount).not.toHaveBeenCalled();
    restore(); restore = undefined;
    expect(globals.Stripe).toBe(f.factory);
    expect(Object.hasOwn(f.factory, "apply")).toBe(false);
  });

  it("never mounts a stale or detached surface rejected by the checkout machine", () => {
    const f = fixture(); globals.Stripe = f.factory;
    f.lifecycle.mount.mockReturnValue(false);
    restore = installStripeSurfaceTracking(f.lifecycle);
    const payment = globals.Stripe().initCheckoutElementsSdk({ clientSecret: "current" }).createPaymentElement();
    payment.mount(document.createElement("div"));
    expect(f.payment.mount).not.toHaveBeenCalled();
    f.ready();
    expect(f.lifecycle.ready).not.toHaveBeenCalled();
  });
});
