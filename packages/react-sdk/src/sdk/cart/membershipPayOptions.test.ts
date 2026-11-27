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

describe("syncGafaPayMembershipToggles (Stripe tarjeta nueva)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function stripeForm(checked = false) {
    const root = document.createElement("div");
    root.innerHTML = `<stripe-payment-element>
      <label><input type="checkbox">Guardar tarjeta</label>
      <label><input type="checkbox" ${checked ? "checked" : ""}>Pago Recurrente (cada 30 días)</label>
    </stripe-payment-element>`;
    document.body.append(root);
    const element = root.querySelector("stripe-payment-element")!;
    const input = findStripeRecurringCheckbox(root)!;
    const stop = bindStripeMembershipRecurrence(root, vi.fn());
    element.dispatchEvent(new Event("initial-payment-updating"));
    element.dispatchEvent(new Event("initial-payment-updated"));
    stop();
    return { root, element, input };
  }

  it("propaga una activación explícita del modal al IIFE", async () => {
    const { root, element, input } = stripeForm();
    // También cubre un resultado síncrono disparado desde el click del IIFE.
    input.addEventListener("click", () => element.dispatchEvent(new Event("initial-payment-updated")));
    expect(await setStripeMembershipAutoRenew(root, true)).toBe(true);
    expect(input.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>("input")?.checked).toBe(false);
  });

  it("espera initial-payment-updated antes de resolver true", async () => {
    vi.useFakeTimers();
    const { root, element, input } = stripeForm();
    const settled = vi.fn();
    const pending = setStripeMembershipAutoRenew(root, true);
    void pending.then(settled);
    await Promise.resolve();
    expect(input.checked).toBe(true);
    await vi.advanceTimersByTimeAsync(100);
    expect(settled).not.toHaveBeenCalled();
    element.dispatchEvent(new Event("initial-payment-updated"));
    await vi.advanceTimersByTimeAsync(40);
    expect(await pending).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resuelve false ante initial-payment-update-error y limpia listeners", async () => {
    vi.useFakeTimers();
    const { root, element } = stripeForm();
    const remove = vi.spyOn(element, "removeEventListener");
    const pending = setStripeMembershipAutoRenew(root, true);
    await Promise.resolve();
    element.dispatchEvent(new Event("initial-payment-update-error"));
    expect(await pending).toBe(false);
    expect(remove).toHaveBeenCalledWith("initial-payment-updated", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("initial-payment-update-error", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resuelve false tras 15 segundos sin evento y limpia listeners", async () => {
    vi.useFakeTimers();
    const { root, element } = stripeForm();
    const remove = vi.spyOn(element, "removeEventListener");
    const pending = setStripeMembershipAutoRenew(root, true);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await pending).toBe(false);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("si ya está marcada no hace click ni espera eventos", async () => {
    vi.useFakeTimers();
    const { root, input } = stripeForm(true);
    const click = vi.spyOn(input, "click");
    expect(await syncGafaPayMembershipToggles(root, { saveCard: true, autoRenew: true })).toBe(true);
    expect(click).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["click", "change"])("bloquea una baja interna mediante %s si contradice la elección del SDK", async (kind) => {
    const { root, element, input } = stripeForm();
    input.checked = true;
    let autoRenew = true;
    const stop = bindStripeMembershipRecurrence(root, (value) => { autoRenew = value; });
    const click = vi.spyOn(input, "click");
    if (kind === "click") input.click();
    else {
      input.checked = false;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    expect(autoRenew).toBe(false);
    const pending = syncGafaPayMembershipToggles(root, { saveCard: true, autoRenew: true });
    element.dispatchEvent(new Event("initial-payment-updated"));
    expect(await pending).toBe(false);
    expect(input.checked).toBe(false);
    expect(click).toHaveBeenCalledTimes(kind === "click" ? 1 : 0);
    stop();
  });

  it("la baja del modal espera la sesión y no solapa clics con pagar", async () => {
    const { root, element, input } = stripeForm();
    input.checked = true;
    const changed = vi.fn();
    const stop = bindStripeMembershipRecurrence(root, changed);
    const click = vi.spyOn(input, "click");
    const update = setStripeMembershipAutoRenew(root, false);
    const settled = vi.fn();
    const pay = syncGafaPayMembershipToggles(root, { saveCard: true, autoRenew: false });
    void pay.then(settled);
    await Promise.resolve();
    expect(input.checked).toBe(false);
    expect(settled).not.toHaveBeenCalled();
    element.dispatchEvent(new Event("initial-payment-updated"));
    expect(await update).toBe(true);
    expect(await pay).toBe(true);
    expect(click).toHaveBeenCalledTimes(1);
    expect(changed).not.toHaveBeenCalled();
    stop();
  });

  it("serializa cambios rápidos del modal", async () => {
    const { root, element, input } = stripeForm();
    input.checked = true;
    const click = vi.spyOn(input, "click");
    const first = setStripeMembershipAutoRenew(root, false);
    const second = setStripeMembershipAutoRenew(root, true);
    await Promise.resolve();
    expect(click).toHaveBeenCalledTimes(1);
    element.dispatchEvent(new Event("initial-payment-updated"));
    expect(await first).toBe(true);
    await Promise.resolve();
    expect(click).toHaveBeenCalledTimes(2);
    element.dispatchEvent(new Event("initial-payment-updated"));
    expect(await second).toBe(true);
  });

  it("una respuesta inicial recurrente no confirma la baja pendiente ni su preflight", async () => {
    const { root, element, input } = stripeForm();
    input.checked = true;
    const stop = bindStripeMembershipRecurrence(root, vi.fn());
    let providerRecurring = true;
    let resolveInitial!: () => void;
    let resolveDisable!: () => void;
    const initial = new Promise<void>((resolve) => { resolveInitial = resolve; });
    const disable = new Promise<void>((resolve) => { resolveDisable = resolve; });
    const request = (checked: boolean, response: Promise<void>) => {
      element.dispatchEvent(new Event("initial-payment-updating"));
      return response.then(() => {
        providerRecurring = checked;
        element.dispatchEvent(new Event("initial-payment-updated"));
      });
    };
    const initialRequest = request(true, initial);
    input.addEventListener("click", () => { void request(input.checked, disable); });
    const updated = vi.fn();
    const preflight = vi.fn();
    const update = setStripeMembershipAutoRenew(root, false);
    void update.then(updated);
    const pay = syncGafaPayMembershipToggles(root, { saveCard: false, autoRenew: false });
    void pay.then(preflight);

    resolveInitial();
    await initialRequest;
    // Drain promise continuations as well as the SDK's serialized queue.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(input.checked).toBe(false);
    expect(providerRecurring).toBe(true);
    expect(updated).not.toHaveBeenCalled();
    expect(preflight).not.toHaveBeenCalled();

    resolveDisable();
    expect(await update).toBe(true);
    expect(await pay).toBe(true);
    expect(providerRecurring).toBe(false);
    stop();
  });

  it("no confunde checked con la elección confirmada por el proveedor", async () => {
    const { root, input } = stripeForm(true);
    // A DOM-only edit has not disabled recurrence in the provider's session.
    input.checked = false;
    expect(await setStripeMembershipAutoRenew(root, false)).toBe(false);
    expect(await syncGafaPayMembershipToggles(root, { saveCard: false, autoRenew: false })).toBe(false);
  });

  it.each([true, false])("una isla sin confirmación no permite pagar aunque exista la casilla: %s", async (withCheckbox) => {
    const root = document.createElement("div");
    root.innerHTML = `<stripe-payment-element>${withCheckbox ? '<label><input type="checkbox">Pago Recurrente</label>' : ""}</stripe-payment-element>`;
    expect(await syncGafaPayMembershipToggles(root, { saveCard: false, autoRenew: false })).toBe(false);
  });

  it("registra la petición inicial antes de que exista la casilla", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const stop = bindStripeMembershipRecurrence(root, vi.fn());
    root.innerHTML = '<stripe-payment-element has-recurring-payment="true"></stripe-payment-element>';
    const element = root.firstElementChild!;
    element.dispatchEvent(new Event("initial-payment-updating"));
    element.innerHTML = '<label><input type="checkbox" checked>Pago Recurrente</label>';
    const input = findStripeRecurringCheckbox(root)!;
    const update = setStripeMembershipAutoRenew(root, false);
    await Promise.resolve();
    expect(input.checked).toBe(true);
    element.dispatchEvent(new Event("initial-payment-updated"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(input.checked).toBe(false);
    element.dispatchEvent(new Event("initial-payment-updated"));
    expect(await update).toBe(true);
    stop();
  });

  it.each(["inicial", "baja"])("bloquea respuestas solapadas sin identidad aunque responda primero %s", async (first) => {
    const { root, element, input } = stripeForm(true);
    const stop = bindStripeMembershipRecurrence(root, vi.fn());
    let resolveInitial!: () => void;
    let resolveDisable!: () => void;
    const initial = new Promise<void>((resolve) => { resolveInitial = resolve; });
    const disable = new Promise<void>((resolve) => { resolveDisable = resolve; });
    let providerRecurring = true;
    const request = (checked: boolean, response: Promise<void>) => {
      element.dispatchEvent(new Event("initial-payment-updating"));
      return response.then(() => {
        providerRecurring = checked;
        element.dispatchEvent(new Event("initial-payment-updated"));
      });
    };
    const initialRequest = request(true, initial);
    // An external provider change bypasses the SDK's serialized click queue.
    input.checked = false;
    const disableRequest = request(false, disable);
    const pay = syncGafaPayMembershipToggles(root, { saveCard: false, autoRenew: false });
    if (first === "inicial") {
      resolveInitial();
      await initialRequest;
      expect(providerRecurring).toBe(true);
      expect(await pay).toBe(false);
      resolveDisable();
    } else {
      resolveDisable();
      await disableRequest;
      expect(providerRecurring).toBe(false);
      expect(await pay).toBe(false);
      resolveInitial();
    }
    await Promise.all([initialRequest, disableRequest]);
    expect(await setStripeMembershipAutoRenew(root, false)).toBe(false);
    expect(await syncGafaPayMembershipToggles(root, { saveCard: false, autoRenew: false })).toBe(false);
    stop();
  });

  it.each(["error", "timeout"])("bloquea pagar tras una baja directa sin sesión confirmada: %s", async (kind) => {
    vi.useFakeTimers();
    const { root, element, input } = stripeForm();
    input.checked = true;
    const stop = bindStripeMembershipRecurrence(root, vi.fn());
    input.click();
    if (kind === "error") element.dispatchEvent(new Event("initial-payment-update-error"));
    else await vi.advanceTimersByTimeAsync(15_000);
    expect(await syncGafaPayMembershipToggles(root, { saveCard: true, autoRenew: false })).toBe(false);
    stop();
  });

  it("encuentra la recurrencia por un label asociado mediante for", () => {
    const root = document.createElement("div");
    root.innerHTML = `<stripe-payment-element>
      <input type="checkbox" id="stripe-renew"><label for="stripe-renew">Pago Recurrente</label>
    </stripe-payment-element>`;
    expect(findStripeRecurringCheckbox(root)).toBe(root.querySelector("input"));
  });

  it("no usa otra casilla si ninguna etiqueta dice Pago Recurrente", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const root = document.createElement("div");
    root.innerHTML = `<stripe-payment-element>
      <label><input type="checkbox">Guardar tarjeta</label><input type="checkbox">
    </stripe-payment-element>`;
    expect(findStripeRecurringCheckbox(root)).toBeNull();
    const pending = syncGafaPayMembershipToggles(root, { saveCard: true, autoRenew: true });
    await vi.advanceTimersByTimeAsync(120);
    expect(await pending).toBe(false);
    expect([...root.querySelectorAll<HTMLInputElement>("input")].every((input) => !input.checked)).toBe(true);
  });

  it("acepta que no exista #saveCard si Pago Recurrente queda activo", async () => {
    const root = document.createElement("div");
    root.innerHTML = '<input id="recurringPayment" type="checkbox">';
    expect(await syncGafaPayMembershipToggles(root, { saveCard: true, autoRenew: true })).toBe(true);
    expect(root.querySelector<HTMLInputElement>("#recurringPayment")?.checked).toBe(true);
  });

  it("bloquea si se pide renovación y no existe el check", async () => {
    const root = document.createElement("div");
    expect(await syncGafaPayMembershipToggles(root, { saveCard: true, autoRenew: true })).toBe(false);
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
