import { stripeHarness, deferred, json } from "../../../test/stripeHarness";
import { resetStripeSessionFetchGuardForTests } from "../payments/stripeSessionGuard";
import { createElement, useState } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cartHasMembership,
  cartHasSubscribableMembership,
  bindStripeMembershipRecurrence,
  setStripeMembershipAutoRenew,
  coerceFlag,
  findStripeRecurringCheckbox,
  paymentMethodsForCart,
  readShowMembershipOptions,
  syncGafaPayMembershipToggles,
} from "./membershipPayOptions";

describe("cartHasMembership", () => {
  it("solo las membresías activan renovación / guardar tarjeta", () => {
    expect(cartHasMembership([{ type: "combo" }])).toBe(false);
    expect(cartHasMembership([{ type: "membership" }])).toBe(true);
    expect(cartHasMembership([{ type: "combo" }, { type: "membership" }])).toBe(true);
  });
});

describe("cartHasSubscribableMembership", () => {
  it("requiere una membresía con subscribable explícitamente verdadero", () => {
    for (const subscribable of [true, 1, "1", "true"]) {
      expect(cartHasSubscribableMembership([{ type: "membership", raw: { subscribable } }])).toBe(true);
    }
    for (const subscribable of [false, 0, "0", "false", null, undefined]) {
      expect(cartHasSubscribableMembership([{ type: "membership", raw: { subscribable } }])).toBe(false);
    }
    expect(cartHasSubscribableMembership([{ type: "combo", raw: { subscribable: true } }])).toBe(false);
  });
});

describe("paymentMethodsForCart", () => {
  const methods = [
    { id: 6, slug: "stripe" },
    { id: 3, slug: "paypal" },
  ];

  it("deja PayPal en paquetes / productos", () => {
    expect(paymentMethodsForCart(methods, false).map((method) => method.slug)).toEqual([
      "stripe",
      "paypal",
    ]);
  });

  it("oculta PayPal si hay membresía: no hay cobro recurrente", () => {
    expect(paymentMethodsForCart(methods, true).map((method) => method.slug)).toEqual(["stripe"]);
    expect(
      paymentMethodsForCart(
        [
          { id: 3, slug: "PayPal" },
          { id: 6, slug: "stripe" },
        ],
        true,
      ).map((method) => method.slug),
    ).toEqual(["stripe"]);
  });
});

describe("syncGafaPayMembershipToggles", () => {
  it("una sincronización antigua no revierte la última elección", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    root.innerHTML = '<input id="recurringPayment" type="checkbox" checked>';
    const input = root.querySelector<HTMLInputElement>("input")!;
    const first = syncGafaPayMembershipToggles(root, { saveCard: false, autoRenew: false });
    const second = syncGafaPayMembershipToggles(root, { saveCard: false, autoRenew: true });
    await vi.advanceTimersByTimeAsync(200);
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(input.checked).toBe(true);
    vi.useRealTimers();
  });

  it("actualiza el estado de checkboxes controlados por React", async () => {
    const changed = vi.fn();
    function Controlled() {
      const [save, setSave] = useState(false);
      const [renew, setRenew] = useState(false);
      return createElement("div", {},
        createElement("input", { id: "saveCard", type: "checkbox", checked: save, onChange: (event) => { setSave(event.currentTarget.checked); changed("save", event.currentTarget.checked); } }),
        createElement("input", { id: "recurringPayment", type: "checkbox", checked: renew, onChange: (event) => { setRenew(event.currentTarget.checked); changed("renew", event.currentTarget.checked); } }),
      );
    }
    const { container } = render(createElement(Controlled));
    await act(async () => { expect(await syncGafaPayMembershipToggles(container, { saveCard: true, autoRenew: true })).toBe(true); });
    expect(changed).toHaveBeenCalledWith("save", true);
    expect(changed).toHaveBeenCalledWith("renew", true);
    cleanup();
  });

  it("notifica al onChange de React mediante click y no repite clicks verificados", async () => {
    const root = document.createElement("div");
    root.innerHTML = '<input id="saveCard" type="checkbox"><input id="recurringPayment" type="checkbox">';
    document.body.append(root);
    const changed = vi.fn();
    root.addEventListener("change", changed);
    expect(await syncGafaPayMembershipToggles(root, { saveCard: true, autoRenew: true })).toBe(true);
    expect(changed).toHaveBeenCalledTimes(2);
    await syncGafaPayMembershipToggles(root, { saveCard: true, autoRenew: true });
    expect(changed).toHaveBeenCalledTimes(2);
    root.remove();
  });

  it("reintenta y avisa si el proveedor rechaza el estado", async () => {
    const root = document.createElement("div");
    root.innerHTML = '<input id="saveCard" type="checkbox" disabled><input id="recurringPayment" type="checkbox">';
    const click = vi.spyOn(root.querySelector<HTMLInputElement>("#saveCard")!, "click");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await syncGafaPayMembershipToggles(root, { saveCard: true, autoRenew: true })).toBe(false);
    expect(click).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("marca saveCard y recurringPayment como en el fancy v1", async () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <input id="saveCard" type="checkbox" />
      <input id="recurringPayment" type="checkbox" />
    `;
    await syncGafaPayMembershipToggles(root, { saveCard: true, autoRenew: true });
    expect(root.querySelector<HTMLInputElement>("#saveCard")?.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>("#recurringPayment")?.checked).toBe(true);

    await syncGafaPayMembershipToggles(root, { saveCard: false, autoRenew: true });
    expect(root.querySelector<HTMLInputElement>("#saveCard")?.checked).toBe(false);
    expect(root.querySelector<HTMLInputElement>("#recurringPayment")?.checked).toBe(true);
  });
});

describe("readShowMembershipOptions", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("va oculto por defecto", () => {
    expect(readShowMembershipOptions(document)).toBe(false);
    expect(coerceFlag(undefined)).toBeUndefined();
  });

  it("el prop explícito gana", () => {
    expect(readShowMembershipOptions(document, true)).toBe(true);
    expect(readShowMembershipOptions(document, false)).toBe(false);
  });

  it("se enciende desde data-gf-options", () => {
    document.body.innerHTML = `<script data-gf-options type="application/json">${JSON.stringify({
      SHOW_MEMBERSHIP_OPTIONS: true,
    })}</script>`;
    expect(readShowMembershipOptions(document)).toBe(true);
  });

  it("se enciende con el atributo del shortcode", () => {
    document.body.innerHTML = `<section data-gf-theme="purchase-button" show-membership-options="true"></section>`;
    expect(readShowMembershipOptions(document)).toBe(true);
  });
});

describe("Stripe: confirmación HTTP correlacionada", () => {
  afterEach(() => {
    resetStripeSessionFetchGuardForTests();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  async function mounted(eligible = true) {
    const harness = stripeHarness();
    const root = document.createElement("div");
    document.body.append(root);
    const mount = harness.mount(root, eligible);
    await mount.ready;
    return { ...harness, root, mount };
  }

  it("el IIFE inicia false; el SDK activa por defecto sólo si es suscribible", async () => {
    const { root, mount, server } = await mounted();
    expect(mount.input!.checked).toBe(false);
    expect(await setStripeMembershipAutoRenew(root, true)).toBe(true);
    expect(server.get(mount.token)).toBe(true);
    expect(await syncGafaPayMembershipToggles(root, { saveCard: true, autoRenew: true })).toBe(true);
    expect(await setStripeMembershipAutoRenew(root, false)).toBe(true);
    expect(server.get(mount.token)).toBe(false);
    expect(await syncGafaPayMembershipToggles(root, { saveCard: false, autoRenew: false })).toBe(true);
  });

  it("la respuesta inicial sin updating no confirma la baja; ignora updated sin ID", async () => {
    const { root, mount, respondWith } = await mounted();
    await setStripeMembershipAutoRenew(root, true);
    const initial = deferred<Response>();
    const disable = deferred<Response>();
    respondWith(async (_url, body) => body.recurringPayment ? initial.promise : disable.promise);
    const old = mount.update(true, false, { saveCard: false });
    const update = setStripeMembershipAutoRenew(root, false);
    const settled = vi.fn();
    const pay = syncGafaPayMembershipToggles(root, { saveCard: false, autoRenew: false });
    void pay.then(settled);
    mount.element.dispatchEvent(new Event("initial-payment-updated"));
    await Promise.resolve();
    expect(mount.input!.checked).toBe(true);
    initial.resolve(json({ message: mount.token, client_secret: mount.secret }));
    await old;
    await vi.waitFor(() => expect(mount.input!.checked).toBe(false));
    expect(settled).not.toHaveBeenCalled();
    disable.resolve(json({ message: mount.token, client_secret: mount.secret }));
    expect(await update).toBe(true);
    expect(await pay).toBe(true);
  });

  it("coalesce ráfagas a la última elección sin solapar solicitudes ni perder el iframe", async () => {
    const { root, mount, network } = await mounted();
    await setStripeMembershipAutoRenew(root, true);
    const iframe = root.querySelector("iframe");
    const updates = [false, true, false, true, false].map((value) => setStripeMembershipAutoRenew(root, value));
    await Promise.all(updates);
    expect(mount.input!.checked).toBe(false);
    expect(network.mock.calls.filter(([url]) => String(url).includes("updateinitialpayment")).map(([, init]) => JSON.parse(String(init!.body)).recurringPayment)).toEqual([false, true, false]);
    expect(root.querySelector("iframe")).toBe(iframe);
  });

  it.each([true, false])("pago único sin casilla y respuesta con client_secret=%s", async (withSecret) => {
    const { root, mount, respondWith } = await mounted(false);
    respondWith(async () => json({ message: mount.token, ...(withSecret ? { client_secret: mount.secret } : {}) }));
    await mount.update(false);
    expect(await setStripeMembershipAutoRenew(root, false)).toBe(true);
    expect(await syncGafaPayMembershipToggles(root, { saveCard: false, autoRenew: false })).toBe(true);
    expect(findStripeRecurringCheckbox(root)).toBeNull();
  });

  it("limpia una casilla residual en un pago único ya confirmado sin esperar un update redundante", async () => {
    const { root, mount, network, server } = await mounted(false);
    mount.element.insertAdjacentHTML("beforeend", '<label><input type="checkbox" checked>Pago Recurrente</label>');
    const input = findStripeRecurringCheckbox(root)!;
    input.addEventListener("click", () => { void mount.update(input.checked); });
    expect(await setStripeMembershipAutoRenew(root, false)).toBe(true);
    expect(input.checked).toBe(false);
    expect(server.get(mount.token)).toBe(false);
    expect(await syncGafaPayMembershipToggles(root, { saveCard: false, autoRenew: false })).toBe(true);
    expect(network).toHaveBeenCalledTimes(2); // process + initial false; identical update is confirmed already
  });

  it.each(["error", "timeout"])("bloquea el pago si la petición de baja falla: %s", async (failure) => {
    const { root, respondWith } = await mounted();
    await setStripeMembershipAutoRenew(root, true);
    respondWith(async () => failure === "error" ? new Response("failure", { status: 500 }) : new Promise(() => undefined));
    if (failure === "timeout") vi.useFakeTimers();
    const pending = setStripeMembershipAutoRenew(root, false);
    if (failure === "timeout") await vi.advanceTimersByTimeAsync(15_010);
    expect(await pending).toBe(false);
    expect(await syncGafaPayMembershipToggles(root, { saveCard: false, autoRenew: false })).toBe(false);
  });

  it("un montaje sin guarda no se confirma mediante eventos anónimos", async () => {
    const root = document.createElement("div");
    root.innerHTML = '<stripe-payment-element><label><input type="checkbox" checked>Pago recurrente</label></stripe-payment-element>';
    const stop = bindStripeMembershipRecurrence(root, vi.fn());
    root.firstElementChild!.dispatchEvent(new Event("initial-payment-created"));
    const update = setStripeMembershipAutoRenew(root, false);
    root.firstElementChild!.dispatchEvent(new Event("initial-payment-updated"));
    expect(await update).toBe(false);
    expect(await syncGafaPayMembershipToggles(root, { saveCard: false, autoRenew: false })).toBe(false);
    stop();
  });

  it("encuentra etiquetas asociadas mediante for sin confundir otras casillas", () => {
    const root = document.createElement("div");
    root.innerHTML = '<stripe-payment-element><input type="checkbox"><input id="renew" type="checkbox"><label for="renew">Pago recurrente</label></stripe-payment-element>';
    expect(findStripeRecurringCheckbox(root)?.id).toBe("renew");
  });
});

import { membershipPaymentFrequency } from "./membershipPayOptions";
describe("membershipPaymentFrequency", () => {
  const m = { type: "membership", amount: 1, price: 10, raw: { expiration_days: 30 } };
  it("manda los días de la membresía", () => expect(membershipPaymentFrequency([m])).toBe("30"));
  it("null si hay otra línea con costo", () =>
    expect(membershipPaymentFrequency([m, { type: "product", amount: 1, price: 5 }])).toBeNull());
  it("sigue recurrente si la otra línea es la matrícula", () =>
    expect(
      membershipPaymentFrequency([
        m,
        { type: "combo", amount: 1, price: 30, role: "enrollment", raw: { enrollment_fee: true } },
      ]),
    ).toBe("30"));
  it("null sin expiration_days", () => expect(membershipPaymentFrequency([{ ...m, raw: {} }])).toBeNull());
});
