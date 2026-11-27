// Unmodified bytes provided at /tmp/iife-now.js (2026-11-26), served by
// https://buq.com.mx/js/payments/stripe-payment.iife.js. Only Stripe.js/network
// are substituted: the vendor React, form, effects and events execute intact.
import bundle from "./__fixtures__/stripe-payment.iife.js?raw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mountGafaPayWidget, notifyStripeDiscountAdded, setGafaPayEnvironment, type GafaPayIsland } from "./gafaPay";
import { resetStripeSessionFetchGuardForTests } from "./stripeSessionGuard";
import { setStripeMembershipAutoRenew, syncGafaPayMembershipToggles } from "../cart/membershipPayOptions";
import { deferred, json } from "../../../test/stripeHarness";

let island: GafaPayIsland | undefined;
let root: HTMLDivElement;
let serverRecurring = false;
let processSerial = 0;
let serverToken: string;
let loadDelay: Promise<void> | undefined;
let updateResponse: ((body: Record<string, any>) => Promise<Response>) | undefined;
let network: ReturnType<typeof vi.fn>;
const confirm = vi.fn();
const providerMounts = vi.fn();
const correlatedUpdate = vi.fn();

beforeEach(() => {
  setGafaPayEnvironment("production");
  processSerial = 0; serverToken = "tok_1"; serverRecurring = false; updateResponse = undefined; loadDelay = undefined;
  confirm.mockReset().mockResolvedValue({ type: "success", session: { id: "paid", recurring: null } });
  providerMounts.mockReset();
  correlatedUpdate.mockReset();
  const stripe = {
    elements: vi.fn(), createToken: vi.fn(), createPaymentMethod: vi.fn(), confirmCardPayment: vi.fn(),
    initCheckoutElementsSdk: ({ clientSecret }: { clientSecret: string }) => {
      providerMounts(clientSecret);
      return {
        on: vi.fn(),
        createPaymentElement: () => ({
          on: vi.fn(), off: vi.fn(),
          mount: (host: Element) => { host.innerHTML = '<iframe title="Stripe Payment Element"></iframe>'; },
          destroy: vi.fn(),
        }),
        loadActions: async () => {
          if (loadDelay) await loadDelay;
          return { type: "success", actions: {
            getSession: () => ({ canConfirm: true }),
            confirm: (...args: unknown[]) => confirm(clientSecret, ...args),
          } };
        },
      };
    },
  };
  vi.stubGlobal("Stripe", Object.assign(vi.fn(() => stripe), { version: "dahlia" }));
  if (!customElements.get("stripe-payment-element")) window.eval(bundle);
  network = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (String(url).endsWith("/api/oauth/token")) return json([{ access_token: "test-only" }]);
    if (String(url).endsWith("/api/stripe.credentials")) return json({ current_environment: "dev", development: { api_key: "pk_test_only" } });
    if (String(url).endsWith("/api/stripe.processinitialpayment")) return json({ message: `tok_${++processSerial}`, client_secret: `cs_${processSerial}` });
    if (String(url).endsWith("/api/stripe.updateinitialpayment")) {
      // Like getOrderByToken in staging: a rotated token is immediately invalid.
      if (body.tokenInput !== serverToken) return new Response("Checkout Session not created", { status: 404 });
      if (updateResponse) return updateResponse(body);
      serverRecurring = body.recurringPayment;
      return json({ message: body.tokenInput, client_secret: `cs_${processSerial}` });
    }
    if (String(url).endsWith("/api/stripe.completeinitialpayment")) {
      expect(body.recurringPayment).toBe(serverRecurring);
      expect(body.tokenInput).toBe(serverToken);
      return json({ message: "complete" });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", network);
  root = document.createElement("div"); document.body.append(root);
});
afterEach(async () => {
  island?.unmount(); island = undefined;
  await new Promise((resolve) => setTimeout(resolve, 0));
  resetStripeSessionFetchGuardForTests();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});
function mount(eligible: boolean) {
  island = mountGafaPayWidget({} as any, root, "stripe", {
    apiUrl: "https://stripe.test", clientId: "test", clientSecret: "test-only",
    order: { customerName: "Test", customerEmail: "test@example.test", lineItems: [] }, generalData: {},
    termsAndConditions: true, hasRecurringPayment: eligible, paymentFrequency: eligible ? "30" : null,
    onInitialPaymentUpdated: correlatedUpdate,
    onStartPayAction: vi.fn(), onGafaPaySuccessAction: vi.fn(), onGafaPayErrAction: vi.fn(),
  });
  return root.firstElementChild!;
}
async function surface() {
  await vi.waitFor(() => expect(root.querySelector("iframe")).toBeTruthy());
}
async function submit() {
  await vi.waitFor(() => expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false));
  const button = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  button.click();
  await vi.waitFor(() => expect(confirm).toHaveBeenCalledOnce());
}

it.each([true, false])("el IIFE real paga sin casilla y sin remontar con client_secret en update=%s", async (secret) => {
  updateResponse = async (body) => json(secret ? { message: body.tokenInput, client_secret: "cs_1" } : {});
  const element = mount(false);
  const updated = vi.fn(); element.addEventListener("initial-payment-updated", updated);
  await surface();
  expect(await setStripeMembershipAutoRenew(root, false)).toBe(true);
  expect(root.querySelector('input[type="checkbox"]')).toBeNull();
  expect(updated).toHaveBeenCalledTimes(secret ? 1 : 0);
  expect(correlatedUpdate).toHaveBeenCalledWith(expect.objectContaining({ message: "tok_1", client_secret: "cs_1" }));
  expect(providerMounts.mock.calls).toEqual([["cs_1"]]);
  await submit();
  expect(confirm.mock.calls[0][0]).toBe("cs_1");
});

it("el IIFE real desmarca, remarca y vuelve a desmarcar sin perder Payment Element", async () => {
  mount(true); await surface();
  // The vendor starts false even when has-recurring-payment=true.
  expect(root.querySelector<HTMLInputElement>("input")!.checked).toBe(false);
  expect(await setStripeMembershipAutoRenew(root, true)).toBe(true);
  const iframe = root.querySelector("iframe");
  for (const checked of [false, true, false]) expect(await setStripeMembershipAutoRenew(root, checked)).toBe(true);
  expect(serverRecurring).toBe(false);
  expect(root.querySelector("iframe")).toBe(iframe);
  expect(providerMounts).toHaveBeenCalledOnce();
  expect(await syncGafaPayMembershipToggles(root, { saveCard: false, autoRenew: false })).toBe(true);
  await submit();
});

it("un secreto rotado llega a confirm; el update repetido por remount no crea un bucle", async () => {
  mount(true); await surface();
  expect(await setStripeMembershipAutoRenew(root, true)).toBe(true);
  updateResponse = async (body) => { serverRecurring = body.recurringPayment; return json({ message: body.tokenInput, client_secret: "cs_rotated" }); };
  expect(await setStripeMembershipAutoRenew(root, false)).toBe(true);
  await vi.waitFor(() => expect(providerMounts.mock.calls).toEqual([["cs_1"], ["cs_rotated"]]));
  await submit();
  expect(confirm.mock.calls[0][0]).toBe("cs_rotated");
  expect(network.mock.calls.filter(([url]) => String(url).includes("updateinitialpayment"))).toHaveLength(4);
});

it("una respuesta de processinitialpayment del montaje retirado no crea otro Payment Element", async () => {
  const oldProcess = deferred<Response>();
  const native = network.getMockImplementation()!;
  network.mockImplementationOnce(native); // OAuth
  network.mockImplementation(async (url, init) => String(url).includes("processinitialpayment") ? oldProcess.promise : native(url, init));
  mount(true);
  await vi.waitFor(() => expect(network.mock.calls.some(([url]) => String(url).includes("processinitialpayment"))).toBe(true));
  island!.unmount();
  network.mockImplementation(native);
  mount(true); await surface();
  expect(await setStripeMembershipAutoRenew(root, false)).toBe(true);
  const iframe = root.querySelector("iframe");
  oldProcess.resolve(json({ message: "tok_old", client_secret: "cs_old" }));
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(providerMounts.mock.calls).toEqual([["cs_1"]]);
  expect(root.querySelector("iframe")).toBe(iframe);
  expect(await syncGafaPayMembershipToggles(root, { saveCard: false, autoRenew: false })).toBe(true);
});

it.each([true, false])("una versión antigua no se aplica aunque la ráfaga vuelva al mismo valor (%s)", async (choice) => {
  const element = mount(true); await surface();
  if (!choice) expect(await setStripeMembershipAutoRenew(root, true)).toBe(true);
  const held = deferred<Response>();
  let calls = 0;
  updateResponse = async (body) => {
    calls++;
    if (calls === 1) return held.promise;
    serverRecurring = body.recurringPayment;
    serverToken = "tok_latest";
    return json({ message: serverToken, client_secret: "cs_latest" });
  };
  const updated = vi.fn(); element.addEventListener("initial-payment-updated", updated);
  const first = setStripeMembershipAutoRenew(root, choice);
  await vi.waitFor(() => expect(calls).toBe(1));
  const middle = setStripeMembershipAutoRenew(root, !choice);
  const latest = setStripeMembershipAutoRenew(root, choice);
  serverToken = "tok_outdated";
  held.resolve(json({ message: serverToken, client_secret: "cs_outdated" }));
  expect(await latest).toBe(true);
  expect(await middle).toBe(false);
  await first;
  expect(updated.mock.calls.every(([event]) => event.detail.client_secret !== "cs_outdated")).toBe(true);
  await vi.waitFor(() => expect(providerMounts.mock.calls.at(-1)).toEqual(["cs_latest"]));
  expect(providerMounts.mock.calls.flat()).not.toContain("cs_outdated");
  await submit();
  expect(confirm.mock.calls[0][0]).toBe("cs_latest");
  expect(serverRecurring).toBe(choice);
});

it("conserva el último cambio mientras la casilla interna desaparece al sustituir la sesión", async () => {
  mount(true); await surface();
  expect(await setStripeMembershipAutoRenew(root, true)).toBe(true);
  const loaded = deferred<void>();
  loadDelay = loaded.promise;
  updateResponse = async (body) => {
    serverRecurring = body.recurringPayment;
    return json({ message: body.tokenInput, client_secret: "cs_rotated" });
  };
  const first = setStripeMembershipAutoRenew(root, false);
  await vi.waitFor(() => expect(root.querySelector("input")).toBeNull());
  const latest = setStripeMembershipAutoRenew(root, true);
  loaded.resolve();
  expect(await latest).toBe(true);
  await first;
  expect(root.querySelector<HTMLInputElement>("input")!.checked).toBe(true);
  expect(root.querySelector("iframe")).toBeTruthy();
  await submit();
  expect(confirm.mock.calls[0][0]).toBe("cs_rotated");
  expect(serverRecurring).toBe(true);
});

it("cada update del IIFE usa el último token al rotar token y secreto en ambos sentidos", async () => {
  let updates = 0;
  updateResponse = async (body) => {
    if (updates >= 12) return new Response("Unexpected remount loop", { status: 500 });
    serverRecurring = body.recurringPayment;
    serverToken = `tok_rotated_${++updates}`;
    return json({ message: serverToken, client_secret: `cs_rotated_${updates}` });
  };
  mount(true); await surface();
  for (const checked of [true, false, true, false]) {
    expect(await setStripeMembershipAutoRenew(root, checked)).toBe(true);
    await vi.waitFor(() => expect(root.querySelector("iframe")).toBeTruthy());
  }
  expect(await syncGafaPayMembershipToggles(root, { saveCard: false, autoRenew: false })).toBe(true);
  await submit();
  // Opt-in also changes the vendor's local saveCard, reset on form remount.
  expect(updates).toBeLessThanOrEqual(9);
  expect(confirm.mock.calls[0][0]).toBe(`cs_rotated_${updates}`);
});

it.each([
  { choice: true, secret: "cs_discount" }, { choice: false, secret: "cs_discount" },
  { choice: true, secret: "cs_1" }, { choice: false, secret: "cs_1" },
])("un descuento con otro token revalida la recurrencia y paga ($choice, $secret)", async ({ choice, secret }) => {
  mount(true); await surface();
  expect(await setStripeMembershipAutoRenew(root, choice)).toBe(true);
  serverToken = "tok_discount";
  updateResponse = async (body) => {
    serverRecurring = body.recurringPayment;
    return json({ message: serverToken, client_secret: secret });
  };
  expect(await notifyStripeDiscountAdded({ client_secret: secret, checkout_token: serverToken }, "tok_1")).toBe(true);
  expect(await syncGafaPayMembershipToggles(root, { saveCard: false, autoRenew: choice })).toBe(true);
  await submit();
  expect(confirm.mock.calls[0][0]).toBe(secret);
  expect(serverRecurring).toBe(choice);
});
