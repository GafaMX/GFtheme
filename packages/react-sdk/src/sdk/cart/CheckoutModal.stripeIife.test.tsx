import bundle from "../payments/__fixtures__/stripe-payment.iife.js?raw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CheckoutModal } from "../widgets/CheckoutModal";
import { useCartStore, type CartLine } from "./cartStore";
import type { GafaClient, InitialPurchasePayload } from "../client/types";
import { resetStripeSessionFetchGuardForTests } from "../payments/stripeSessionGuard";
import { deferred, json } from "../../../test/stripeHarness";

vi.mock("../payments/gafaPay", async (original) => ({
  ...await original<typeof import("../payments/gafaPay")>(),
  loadGafaPay: async () => ({}),
}));

const line: CartLine = {
  key: "fitspin:membership:1", id: 1, type: "membership", name: "Membresía",
  price: 500, priceLabel: "$500", amount: 1, brandSlug: "fitspin", locationSlug: "polanco",
  raw: { subscribable: true, expiration_days: 30 },
};
let token: string;
let secret: string;
let serial: number;
let recurring: boolean;
let rotateOnRevalidate: boolean;
let network: ReturnType<typeof vi.fn>;
const confirm = vi.fn();

beforeEach(() => {
  token = ""; secret = ""; serial = 0; recurring = false; rotateOnRevalidate = false;
  confirm.mockReset().mockResolvedValue({ type: "success", session: { id: "paid", recurring: null } });
  const stripe = {
    elements: vi.fn(), createToken: vi.fn(), createPaymentMethod: vi.fn(), confirmCardPayment: vi.fn(),
    initCheckoutElementsSdk: ({ clientSecret }: { clientSecret: string }) => ({
      on: vi.fn(),
      createPaymentElement: () => ({
        on: vi.fn(), off: vi.fn(), destroy: vi.fn(),
        mount: (host: Element) => { host.innerHTML = '<iframe title="Stripe Payment Element"></iframe>'; },
      }),
      loadActions: async () => ({ type: "success", actions: {
        getSession: () => ({ canConfirm: true }),
        confirm: () => confirm(clientSecret),
      } }),
    }),
  };
  vi.stubGlobal("Stripe", Object.assign(vi.fn(() => stripe), { version: "dahlia" }));
  if (!customElements.get("stripe-payment-element")) window.eval(bundle);
  network = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (String(url).endsWith("/api/oauth/token")) return json([{ access_token: "test" }]);
    if (String(url).endsWith("/api/stripe.credentials")) return json({ current_environment: "dev", development: { api_key: "pk_test" } });
    if (String(url).endsWith("/api/stripe.processinitialpayment")) {
      token = `tok_${++serial}`; secret = `cs_${serial}`;
      return json({ message: token, client_secret: secret });
    }
    if (String(url).endsWith("/api/stripe.updateinitialpayment")) {
      expect(body.tokenInput).toBe(token);
      recurring = body.recurringPayment;
      if (rotateOnRevalidate) {
        rotateOnRevalidate = false; token = "tok_revalidated"; secret = "cs_revalidated";
      }
      return json({ message: token, client_secret: secret });
    }
    if (String(url).endsWith("/api/stripe.completeinitialpayment")) {
      expect(body.tokenInput).toBe(token);
      expect(body.recurringPayment).toBe(false);
      return json({ message: "paid" });
    }
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", network);
  useCartStore.setState({ lines: [line], reservation: null, membershipRecurrence: null });
});
afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 0));
  resetStripeSessionFetchGuardForTests();
  vi.unstubAllGlobals();
  useCartStore.setState({ lines: [], reservation: null });
});

function client() {
  const charged = deferred<void>();
  confirm.mockImplementation(async () => {
    charged.resolve();
    return { type: "success", session: { id: "paid", recurring: null } };
  });
  return {
    listBrands: async () => [], listLocations: async () => [], listCombos: async () => [],
    listMemberships: async () => [], listProducts: async () => [], listUserPurchases: async () => [],
    getProfile: async () => ({ id: 2, email: "ana@example.test", firstName: "Ana" }),
    getCheckoutConfig: async () => ({
      currency: { code: "MXN", prefix: "$", suffix: "MXN" },
      paymentMethods: [{ id: 3, name: "Stripe", slug: "stripe" }],
      gafapayClientId: "test", gafapayClientSecret: "test", urls: {}, discountCodesEnabled: true,
      combos: [], memberships: [], products: [],
    }),
    previewPurchase: vi.fn(async () => undefined),
    initialPurchase: vi.fn(async (payload: InitialPurchasePayload) => ({ purchaseId: 88, checkoutToken: payload.checkoutToken })),
    pollInitialPurchaseStatus: vi.fn(async () => { await charged.promise; return { code: 1 }; }),
    checkDiscountCode: vi.fn(async () => {
      token = "tok_discount"; secret = "cs_discount";
      return { valid: true, code: "BUQMX", discountType: "percent", discountNumber: 10, clientSecret: secret, checkoutToken: token };
    }),
  };
}
function mount(c: ReturnType<typeof client>) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <CheckoutModal client={c as unknown as GafaClient} brandSlug="fitspin" locationSlug="polanco" skipCatalog onClose={() => undefined} />
  </QueryClientProvider>);
}
const pay = () => document.querySelector<HTMLButtonElement>(".gafa-checkout__cta")!;
const checkbox = () => screen.getByLabelText(/pago recurrente \(se renueva/i) as HTMLInputElement;
const ready = () => waitFor(() => expect(pay().disabled).toBe(false));
async function optOut() {
  await ready(); fireEvent.click(checkbox()); await ready();
  expect(recurring).toBe(false);
}
async function coupon() {
  fireEvent.click(screen.getByRole("button", { name: /¿tienes un código de descuento/i }));
  fireEvent.change(screen.getByPlaceholderText(/código/i), { target: { value: "BUQMX" } });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
}

it.each([false, true])("R3: conserva el opt-out por cantidad, con remount del modal=%s", async (remount) => {
  const c = client(); const view = mount(c); await optOut();
  const start = network.mock.calls.length;
  if (remount) act(() => view.unmount());
  act(() => useCartStore.getState().setAmount(line.key, 2));
  if (remount) mount(c);
  await waitFor(() => expect(serial).toBe(2));
  await ready();
  expect(checkbox().checked).toBe(false);
  expect(document.querySelector("iframe")).toBeTruthy();
  const requests = network.mock.calls.slice(start).map(([, init]) => JSON.parse(String(init?.body ?? "{}")));
  expect(requests.some((body) => body.recurringPayment === true)).toBe(false);
  fireEvent.click(pay());
  await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
  expect(c.pollInitialPurchaseStatus).toHaveBeenCalledWith(expect.objectContaining({ checkoutToken: token }));
});

it("R2: una ráfaga acaba en pago único con el iframe disponible", async () => {
  const c = client(); mount(c); await ready();
  const iframe = document.querySelector("iframe");
  fireEvent.click(checkbox()); fireEvent.click(checkbox()); fireEvent.click(checkbox());
  await ready();
  expect(checkbox().checked).toBe(false);
  expect(recurring).toBe(false);
  expect(document.querySelector("iframe")).toBe(iframe);
  fireEvent.click(pay());
  await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
});

it.each(["membership", "combo"] as const)("R4: %s no suscribible paga sin recurrencia", async (type) => {
  useCartStore.setState({ lines: [{ ...line, type, raw: { subscribable: false } }] });
  const c = client(); mount(c); await ready();
  expect(screen.queryByLabelText(/pago recurrente \(se renueva/i)).toBeNull();
  fireEvent.click(pay());
  await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
  expect(recurring).toBe(false);
});

it("un registro anterior al remount no habilita Pagar ni sustituye el token actual", async () => {
  const c = client(); mount(c); await optOut();
  const old = deferred<{ purchaseId: number; checkoutToken: string }>();
  const fresh = deferred<{ purchaseId: number; checkoutToken: string }>();
  c.initialPurchase.mockImplementation(async (p) => p.checkoutToken === "tok_1" ? old.promise : fresh.promise);
  // Start a registration for the old session, then retire its entire form.
  fireEvent.click(checkbox());
  await waitFor(() => expect(recurring).toBe(true));
  fireEvent.click(checkbox());
  await waitFor(() => expect(recurring).toBe(false));
  act(() => useCartStore.getState().setAmount(line.key, 2));
  await waitFor(() => expect(serial).toBe(2));
  await waitFor(() => expect(document.querySelector("iframe")).toBeTruthy());
  await act(async () => old.resolve({ purchaseId: 77, checkoutToken: "tok_1" }));
  expect(pay().disabled).toBe(true);
  await act(async () => fresh.resolve({ purchaseId: 99, checkoutToken: token }));
  await ready(); fireEvent.click(pay());
  await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
  expect(c.pollInitialPurchaseStatus).toHaveBeenCalledWith(expect.objectContaining({ checkoutToken: token, pendingPurchaseId: 99 }));
});

it.each([false, true])("BUQMX espera el registro del token final con revalidación rotada=%s", async (rotate) => {
  const c = client(); mount(c); await optOut();
  const registration = deferred<{ purchaseId: number; checkoutToken: string }>();
  const intermediate = deferred<{ purchaseId: number; checkoutToken: string }>();
  c.initialPurchase.mockImplementation(async (payload) => payload.discountCode === "BUQMX" ? registration.promise
    : intermediate.promise);
  rotateOnRevalidate = rotate;
  await coupon();
  await waitFor(() => expect(c.initialPurchase.mock.calls.some(([p]) => p.discountCode === "BUQMX")).toBe(true));
  const latest = c.initialPurchase.mock.calls.at(-1)![0];
  expect(latest.checkoutToken).toBe(token);
  expect(latest.paymentData).toEqual(expect.objectContaining({ message: token }));
  expect(document.querySelector("iframe")).toBeTruthy();
  expect(pay().disabled).toBe(true);
  // An older registration must not unlock pay or overwrite the new session.
  await act(async () => intermediate.resolve({ purchaseId: 77, checkoutToken: "tok_1" }));
  expect(pay().disabled).toBe(true);
  fireEvent.click(pay()); expect(confirm).not.toHaveBeenCalled();
  await act(async () => registration.resolve({ purchaseId: 99, checkoutToken: token }));
  await ready(); fireEvent.click(pay());
  await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
  expect(confirm).toHaveBeenCalledWith(secret);
  expect(c.pollInitialPurchaseStatus).toHaveBeenCalledWith(expect.objectContaining({ checkoutToken: token, pendingPurchaseId: 99 }));
});
