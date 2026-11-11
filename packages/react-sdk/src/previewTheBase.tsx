import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./sdk/theme/theme";
import { CheckoutModal } from "./sdk/widgets/CheckoutModal";
import { HeaderControls } from "./sdk/widgets/HeaderControls";
import { CatalogWidget } from "./sdk/widgets/CatalogWidget";
import { useCartStore } from "./sdk/cart/cartStore";
import { inspectEnrollmentNeed, parseMembershipEnrollment } from "./sdk/cart/membershipEnrollment";
import { formatMoney } from "./sdk/cart/money";
import type { CatalogItem, GafaClient } from "./sdk/client/types";
import { createHttpGafaClient } from "./sdk/client/httpGafaClient";
import { SAFE_TEST_BLOCKED_MESSAGE, subscribeSafeTestBlocked } from "./sdk/client/safeTestGuard";
import { configureTokenStorage } from "./sdk/client/tokenStorage";
import { parseGafaSdkConfig } from "./sdk/config";
import "./sdk/theme/theme.css";
import "./sdk/widgets/widgets.css";
import "./demo/demo.css";

const ENROLLMENT = {
  comboId: 3491,
  label: "Matrícula",
  membershipIds: [1272, 1271, 1204],
  firstTimeScope: "any_membership" as const,
  mode: "first_purchase" as const,
};

const LIVE_BRAND = "the-base";
const LIVE_LOCATION = "pozuelo-de-alarcon";
const LIVE_LOCATION_NAME = "Pozuelo de Alarcón";
const API_SECRET_SESSION_KEY = "gafa-matricula-test:api-secret";
const RESERVATE_PROBE =
  "https://buq.partners/api/brand/the-base/location/pozuelo-de-alarcon/reservation/reservate";

const memberships: CatalogItem[] = [
  {
    id: 1272,
    name: "Bronze",
    type: "membership",
    price: 70,
    priceFinal: 70,
    expirationDays: 30,
    subscribable: true,
    raw: { id: 1272, expiration_days: 30, currency: { prefijo: "€", code3: "EUR" } },
  },
  {
    id: 1271,
    name: "Silver",
    type: "membership",
    price: 85,
    priceFinal: 85,
    expirationDays: 30,
    subscribable: true,
    raw: { id: 1271, expiration_days: 30, currency: { prefijo: "€", code3: "EUR" } },
  },
  {
    id: 1204,
    name: "Gold",
    type: "membership",
    price: 100,
    priceFinal: 100,
    expirationDays: 30,
    subscribable: true,
    raw: { id: 1204, expiration_days: 30, currency: { prefijo: "€", code3: "EUR" } },
  },
  {
    id: 1203,
    name: "Socio Fundador",
    type: "membership",
    price: 85,
    priceFinal: 85,
    expirationDays: 30,
    subscribable: true,
    raw: { id: 1203, expiration_days: 30, currency: { prefijo: "€", code3: "EUR" } },
  },
];

const combos: CatalogItem[] = [
  {
    id: 3491,
    name: "Matrícula",
    type: "combo",
    price: 30,
    priceFinal: 30,
    expirationDays: 365,
    raw: { id: 3491, credits: 0, currency: { prefijo: "€", code3: "EUR" } },
  },
  {
    id: 4101,
    name: "Bono 10 clases",
    type: "combo",
    price: 65,
    priceFinal: 65,
    expirationDays: 90,
    raw: { id: 4101, currency: { prefijo: "€", code3: "EUR" } },
  },
  {
    id: 4102,
    name: "Pase de prueba",
    type: "combo",
    price: 0,
    priceFinal: 0,
    expirationDays: 7,
    raw: { id: 4102, currency: { prefijo: "€", code3: "EUR" } },
  },
  {
    id: 4103,
    name: "Pase de día",
    type: "combo",
    price: 25,
    priceFinal: 25,
    expirationDays: 1,
    raw: { id: 4103, currency: { prefijo: "€", code3: "EUR" } },
  },
];

function subscribePreviewLocation(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  window.addEventListener("popstate", onStoreChange);
  return () => {
    window.removeEventListener("hashchange", onStoreChange);
    window.removeEventListener("popstate", onStoreChange);
  };
}

function previewLocationKey() {
  return `${window.location.search}\n${window.location.hash}`;
}

function previewFlag(name: string): boolean {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, "").replace(/^\?/, ""));
  if (hash.get(name) === "1") return true;
  const search = new URLSearchParams(window.location.search);
  if (search.get(name) === "1") return true;
  // htmlpreview.github.io keeps the GitHub URL in `search`; flags go in the hash.
  return new URLSearchParams(window.location.href.split("#")[1] ?? "").get(name) === "1";
}

function readPreviewApiSecret(): string {
  try {
    return sessionStorage.getItem(API_SECRET_SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

function writePreviewApiSecret(value: string) {
  try {
    if (value) sessionStorage.setItem(API_SECRET_SESSION_KEY, value);
    else sessionStorage.removeItem(API_SECRET_SESSION_KEY);
  } catch {
    /* private mode */
  }
}

function ensurePreviewOptions() {
  if (typeof document === "undefined") return;
  const existing = document.querySelector("[data-gf-options], [data-gafa-options]");
  const payload = {
    COMPANY_ID: 204,
    API_CLIENT: 1621,
    MEMBERSHIP_ENROLLMENT: ENROLLMENT,
    MOCK_PAY: true,
    SAFE_TEST_MODE: true,
  };
  if (existing) {
    existing.textContent = JSON.stringify(payload);
    return;
  }
  const script = document.createElement("script");
  script.type = "application/json";
  script.setAttribute("data-gf-options", "");
  script.textContent = JSON.stringify(payload);
  (document.head || document.body).appendChild(script);
}

function euro(amount: number) {
  return formatMoney(amount, "€", "EUR", "EUR");
}

function createMockPreviewClient(input: {
  isReturning: boolean;
  signedIn: { current: boolean };
}): GafaClient {
  return {
    listBrands: async () => [
      { id: 225, name: "The Base Pozuelo", slug: "the-base", currency: { prefix: "€", suffix: "EUR", code: "EUR" } },
    ],
    listLocations: async () => [{ id: 332, name: "Pozuelo", slug: "pozuelo", brandSlug: "the-base" }],
    listCombos: async () => combos,
    listMemberships: async () => memberships,
    listProducts: async () => [],
    getProfile: async () => {
      if (!input.signedIn.current) throw new Error("Sin sesión");
      return {
        id: 4412,
        name: "Gabriel Test",
        email: "gabriel+base@buq.mx",
        firstName: "Gabriel",
        lastName: "Test",
      };
    },
    getCheckoutConfig: async () => ({
      brandSlug: "the-base",
      locationSlug: "pozuelo",
      currency: { prefix: "€", suffix: "EUR", code: "EUR" },
      paymentMethods: [{ id: 3, name: "Tarjeta", slug: "stripe" }],
      giftCardsEnabled: false,
      discountCodesEnabled: true,
      canRedeemStoreCredit: false,
      combos,
      memberships,
      products: [],
      gafapayClientId: null,
      gafapayClientSecret: null,
      companiesId: 204,
      locationId: 332,
      userProfileId: 4412,
      urls: {
        reservation: "https://example.test/reservate",
        initialPurchase: "https://example.test/purchase",
        initialPurchaseStatus: "https://example.test/status",
        checkDiscountCode: "https://example.test/check-discount",
      },
    }),
    checkDiscountCode: async ({ code }) => {
      const normalized = code.trim().toUpperCase();
      if (normalized === "FAMILIA10") {
        return { valid: true, code, discountType: "percent", discountNumber: 10, label: "Familia10 · 10%" };
      }
      return { valid: false, code, message: "Código no válido" };
    },
    previewPurchase: async () => undefined,
    reservatePurchase: async () => ({ purchaseId: Math.floor(Math.random() * 9000) + 1000 }),
    listUserMemberships: async () =>
      input.isReturning ? [{ id: 9, membershipId: 1272, name: "Bronze", expiresAt: new Date().toISOString() }] : [],
    listUserPurchases: async () => [],
    listUserCredits: async () => [],
    listUserReservations: async () => [],
    listRegistrationFields: async () => [],
    login: async () => {
      input.signedIn.current = true;
      return { access_token: "preview" };
    },
    logout: () => {
      input.signedIn.current = false;
    },
    register: async () => {
      input.signedIn.current = true;
      return {};
    },
    requestPasswordReset: async () => undefined,
    resetPassword: async () => undefined,
    openCheckout: async () => undefined,
    openReservationCheckout: async () => undefined,
    listServices: async () => [],
    listStaff: async () => [],
    listMeetings: async () => [],
    cancelReservation: async () => undefined,
  } as GafaClient;
}

function createLivePreviewClient(apiSecret: string): { client: GafaClient; http: GafaClient } {
  const config = parseGafaSdkConfig({
    apiBaseUrl: "https://buq.partners",
    companyId: 204,
    publicClientId: 1621,
    clientSecret: apiSecret || undefined,
    safeTestMode: true,
    mockPay: true,
    membershipEnrollment: ENROLLMENT,
    analyticsEnabled: false,
  });
  configureTokenStorage(config.apiBaseUrl);
  const http = createHttpGafaClient(config);
  const mockCharge = () => ({ purchaseId: Math.floor(Math.random() * 9000) + 1000 });
  const eur = { prefix: "€", suffix: "EUR", code: "EUR" };
  const withEuro = (item: CatalogItem): CatalogItem => ({
    ...item,
    currency: item.currency ?? "EUR",
    priceLabel: item.priceLabel ?? (item.priceFinal != null || item.price != null ? euro(item.priceFinal ?? item.price ?? 0) : item.priceLabel),
    raw: { currency: { prefijo: "€", code3: "EUR" }, ...(item.raw ?? {}) },
  });
  const client: GafaClient = {
    ...http,
    listBrands: async () => (await http.listBrands()).map((brand) => ({ ...brand, currency: brand.currency ?? eur })),
    listMemberships: async (slug) => (await http.listMemberships(slug)).map(withEuro),
    listCombos: async (slug) => (await http.listCombos(slug)).map(withEuro),
    previewPurchase: async () => undefined,
    reservatePurchase: async () => mockCharge(),
    initialPurchase: async () => mockCharge(),
    createReservation: async () => {
      throw new Error(SAFE_TEST_BLOCKED_MESSAGE);
    },
    generateGiftCode: async () => {
      throw new Error(SAFE_TEST_BLOCKED_MESSAGE);
    },
    register: async () => {
      throw new Error(SAFE_TEST_BLOCKED_MESSAGE);
    },
    requestPasswordReset: async () => {
      throw new Error(SAFE_TEST_BLOCKED_MESSAGE);
    },
    resetPassword: async () => {
      throw new Error(SAFE_TEST_BLOCKED_MESSAGE);
    },
    cancelReservation: async () => {
      throw new Error(SAFE_TEST_BLOCKED_MESSAGE);
    },
    getCheckoutConfig: async (payload) => {
      try {
        const raw = await http.getCheckoutConfig!(payload);
        return { ...raw, gafapayClientId: null, gafapayClientSecret: null };
      } catch {
        const [liveMemberships, liveCombos, profile, locations] = await Promise.all([
          http.listMemberships(LIVE_BRAND),
          http.listCombos(LIVE_BRAND),
          http.getProfile(),
          http.listLocations(LIVE_BRAND),
        ]);
        const location = locations[0];
        return {
          brandSlug: LIVE_BRAND,
          locationSlug: location?.slug ?? payload.locationSlug,
          currency: { prefix: "€", suffix: "EUR", code: "EUR" },
          paymentMethods: [{ id: 3, name: "Tarjeta (simulada)", slug: "stripe" }],
          giftCardsEnabled: false,
          discountCodesEnabled: false,
          canRedeemStoreCredit: false,
          combos: liveCombos,
          memberships: liveMemberships,
          products: [],
          gafapayClientId: null,
          gafapayClientSecret: null,
          companiesId: 204,
          locationId: location?.id,
          userProfileId: profile?.id,
          urls: {
            reservation: RESERVATE_PROBE,
            initialPurchase: "",
            initialPurchaseStatus: "",
          },
        };
      }
    },
  };
  return { client, http };
}

function TheBaseTheme({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      theme={{
        colorScheme: "dark",
        allowUserColorScheme: false,
        colors: {
          brand: "#E8D5B5",
          accent: "#E8D5B5",
          background: "#141414",
          surface: "#1C1C1C",
          surfaceRaised: "#242424",
          text: "#F6F1E8",
          mutedText: "#B9B0A2",
          border: "#3A3A3A",
        },
      }}
    >
      {children}
    </ThemeProvider>
  );
}

export function TheBaseMatriculaPreview() {
  ensurePreviewOptions();
  useSyncExternalStore(subscribePreviewLocation, previewLocationKey, () => "");
  const isGuest = previewFlag("guest");
  const isReturning = previewFlag("returning");
  const failEnrollment = previewFlag("fail-enrollment");
  // Cuentas reales = default. Las variantes de hash siguen mock (como antes):
  // guest, returning y fail-enrollment no piden API_SECRET ni login OAuth.
  const isLive = !isGuest && !isReturning && !failEnrollment;
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [apiSecret, setApiSecret] = useState(readPreviewApiSecret);
  const [secretDraft, setSecretDraft] = useState("");
  const [blocked, setBlocked] = useState<Array<{ method: string; url: string; reason: string }>>([]);
  const [probeResult, setProbeResult] = useState<string>("");
  const [detection, setDetection] = useState<string>("sin sesión");
  const [charges, setCharges] = useState<string>("—");
  const [locationSlug, setLocationSlug] = useState(isLive ? LIVE_LOCATION : "pozuelo");
  const [locationName, setLocationName] = useState(isLive ? LIVE_LOCATION_NAME : "Pozuelo");
  const cartHasItems = useCartStore((s) => s.lines.length > 0);
  const cartLines = useCartStore((s) => s.lines);
  const queryClient = useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: 0 } } }), []);
  const sessionKey = `${isGuest ? "g" : "u"}-${isReturning ? "r" : "n"}-${isLive ? "live" : "mock"}`;
  const prevSessionKey = useRef(sessionKey);
  const previewSignedIn = useRef(!isGuest && !isLive);
  const liveHttpRef = useRef<GafaClient | null>(null);

  useEffect(() => {
    if (prevSessionKey.current === sessionKey) return;
    prevSessionKey.current = sessionKey;
    previewSignedIn.current = !isGuest && !isLive;
    queryClient.clear();
    useCartStore.getState().resetAfterPurchase();
  }, [sessionKey, isGuest, isLive, queryClient]);

  const mockClient = useMemo(
    () => createMockPreviewClient({ isReturning, signedIn: previewSignedIn }),
    [isReturning],
  );
  const liveBundle = useMemo(() => (isLive ? createLivePreviewClient(apiSecret) : null), [isLive, apiSecret]);
  const client = liveBundle?.client ?? mockClient;
  liveHttpRef.current = liveBundle?.http ?? null;

  useEffect(() => {
    useCartStore.getState().resetAfterPurchase();
  }, []);

  useEffect(() => {
    return subscribeSafeTestBlocked((detail) => {
      setBlocked((prev) => [{ ...detail }, ...prev].slice(0, 8));
    });
  }, []);

  useEffect(() => {
    if (isLive) return;
    setLocationSlug("pozuelo");
    setLocationName("Pozuelo");
  }, [isLive]);

  useEffect(() => {
    if (!isLive || !liveBundle) return;
    let cancelled = false;
    void (async () => {
      try {
        await liveBundle.http.reservatePurchase?.({
          brandSlug: LIVE_BRAND,
          locationSlug: LIVE_LOCATION,
          userId: 1,
          lines: [{ id: 1271, type: "membership", amount: 1, name: "Silver", price: 85 }],
          paymentTypeId: 3,
        });
        if (!cancelled) setProbeResult("FALLO DE GUARD: el POST /reservate no se bloqueó");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!cancelled) {
          setProbeResult(
            message === SAFE_TEST_BLOCKED_MESSAGE
              ? "OK: POST /reservate bloqueado en modo prueba"
              : message,
          );
        }
      }
    })();
    void liveBundle.http.listLocations(LIVE_BRAND).then((locations) => {
      if (cancelled) return;
      const location = locations[0];
      if (location?.slug) {
        setLocationSlug(location.slug);
        setLocationName(location.name);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isLive, liveBundle]);

  useEffect(() => {
    if (!isLive) return;
    const enrollment = parseMembershipEnrollment(ENROLLMENT);
    if (!enrollment) return;
    let cancelled = false;
    void (async () => {
      const profile = await client.getProfile().catch(() => null);
      if (cancelled) return;
      if (!profile) {
        setDetection("sin sesión — entra con una cuenta real de The Base");
        setCharges("—");
        return;
      }
      const membershipLine = cartLines.find((line) => line.type === "membership");
      if (!membershipLine) {
        setDetection("sesión real; elige una membresía para detectar primera vez");
        setCharges("—");
        return;
      }
      const result = await inspectEnrollmentNeed({
        config: enrollment,
        client,
        brandSlug: LIVE_BRAND,
        membershipId: membershipLine.id,
      });
      if (cancelled) return;
      setDetection(
        `${result.needed ? "primera vez (se cobra matrícula)" : "recurrente (sin matrícula)"} · ${result.sourceLabel} · membresías=${result.membershipsCount} compras=${result.purchasesCount}`,
      );
      const membershipCharge = `${membershipLine.name} ${euro(membershipLine.price)} (suscripción)`;
      const fee = cartLines.find((line) => line.id === ENROLLMENT.comboId || line.role === "enrollment");
      setCharges(
        result.needed
          ? `1) ${membershipCharge}  2) ${fee?.name ?? "Matrícula"} ${euro(fee?.price ?? 30)} (único)`
          : `1) ${membershipCharge}  — no hay segundo cargo`,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, client, cartLines]);

  function saveApiSecret(event: FormEvent) {
    event.preventDefault();
    const next = secretDraft.trim();
    writePreviewApiSecret(next);
    setApiSecret(next);
    setSecretDraft("");
  }

  async function probeReservateBlock() {
    setProbeResult("probando…");
    const http = liveHttpRef.current;
    if (!http?.reservatePurchase) {
      setProbeResult("sin cliente HTTP");
      return;
    }
    try {
      await http.reservatePurchase({
        brandSlug: LIVE_BRAND,
        locationSlug,
        userId: 1,
        lines: [{ id: 1271, type: "membership", amount: 1, name: "Silver", price: 85 }],
        paymentTypeId: 3,
      });
      setProbeResult("FALLO DE GUARD: el POST /reservate no se bloqueó");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setProbeResult(message === SAFE_TEST_BLOCKED_MESSAGE ? "OK: POST /reservate bloqueado en modo prueba" : message);
    }
  }

  return (
    <TheBaseTheme>
      <QueryClientProvider client={queryClient}>
        <div className="demo-root" data-matricula-preview="true">
          <div className="matricula-test-banner" role="status">
            MODO PRUEBA: no se cobra nada
          </div>
          <header className="demo-header">
            <div className="demo-header__inner">
              <span className="demo-logo">The Base Pozuelo</span>
              <HeaderControls client={client} onOpenAccount={() => undefined} onOpenCart={() => setCheckoutOpen(true)} />
            </div>
          </header>
          <main className="demo-main" style={{ padding: "1.5rem" }}>
            <p style={{ maxWidth: 720, color: "#B9B0A2", lineHeight: 1.5 }}>
              Preview de matrícula (SDK V2). Lecturas reales contra <code>buq.partners</code> de The Base
              (login, perfil, historial, catálogo). Cobros y altas siguen mockeados: GafaPay, Stripe,{" "}
              <code>/reservate</code> y cualquier POST de compra se cortan en el cliente HTTP. Variantes
              mock: <code>#returning=1</code>, <code>#fail-enrollment=1</code>, <code>#guest=1</code>.
              {isReturning ? " Esta cuenta mock ya tuvo una membresía: no debe aparecer matrícula." : ""}
              {failEnrollment ? " Esta URL fuerza el fallo del segundo cobro (mock)." : ""}
              {isGuest
                ? " Sin sesión mock: el plan ya elegido no vuelve al catálogo. Entra o crea cuenta (cualquier email y contraseña) y caes en Pagar."
                : ""}
            </p>
            {isLive ? (
              <section className="matricula-debug" aria-label="Panel de prueba">
                <form onSubmit={saveApiSecret} className="matricula-debug__secret">
                  <label>
                    API_SECRET del embed de The Base (OAuth, no GafaPay). Solo sessionStorage de este
                    navegador; no viaja al repo.
                    <input
                      type="password"
                      autoComplete="off"
                      value={secretDraft}
                      onChange={(event) => setSecretDraft(event.target.value)}
                      placeholder={apiSecret ? "ya hay una clave en esta sesión" : "pegar API_SECRET"}
                    />
                  </label>
                  <button type="submit">{apiSecret ? "Actualizar clave" : "Guardar clave"}</button>
                </form>
                <dl>
                  <div>
                    <dt>Detección</dt>
                    <dd>{detection}</dd>
                  </div>
                  <div>
                    <dt>Cargos simulados</dt>
                    <dd>{charges}</dd>
                  </div>
                  <div>
                    <dt>Guard de escrituras</dt>
                    <dd>
                      {probeResult || (blocked[0] ? `${blocked[0].method} ${blocked[0].url} → ${blocked[0].reason}` : "sin intentos")}
                      <button type="button" onClick={() => void probeReservateBlock()}>
                        Probar POST /reservate
                      </button>
                    </dd>
                  </div>
                </dl>
                {blocked.length > 0 ? (
                  <ul className="matricula-debug__blocked">
                    {blocked.map((item, index) => (
                      <li key={`${item.url}-${index}`}>
                        {item.method} {item.url} — {SAFE_TEST_BLOCKED_MESSAGE} ({item.reason})
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}
            <CatalogWidget
              client={client}
              type="memberships"
              title="Membresías"
              onBuy={(item) => {
                useCartStore.getState().addItem({
                  id: item.id,
                  type: "membership",
                  name: item.name,
                  price: item.priceFinal ?? item.price ?? 0,
                  priceLabel: item.priceLabel ?? `${item.priceFinal ?? item.price}€`,
                  brandSlug: LIVE_BRAND,
                  locationSlug,
                  expirationLabel: item.expirationDays ? `Expira en ${item.expirationDays} días` : undefined,
                  raw: item.raw,
                });
                setCheckoutOpen(true);
              }}
            />
            <CatalogWidget
              client={client}
              type="packages"
              title="Paquetes"
              onBuy={(item) => {
                useCartStore.getState().addItem({
                  id: item.id,
                  type: "combo",
                  name: item.name,
                  price: item.priceFinal ?? item.price ?? 0,
                  priceLabel: item.priceLabel ?? `${item.priceFinal ?? item.price}€`,
                  brandSlug: LIVE_BRAND,
                  locationSlug,
                  raw: item.raw,
                });
                setCheckoutOpen(true);
              }}
            />
          </main>
          {checkoutOpen ? (
            <CheckoutModal
              key={sessionKey}
              client={client}
              brandSlug={LIVE_BRAND}
              locationSlug={locationSlug}
              locationName={locationName}
              skipCatalog={cartHasItems}
              captcha={{ execute: async () => "preview-captcha" }}
              membershipEnrollment={ENROLLMENT}
              mockPay
              chargeEnrollmentFee={
                failEnrollment
                  ? async () => {
                      throw new Error("card declined");
                    }
                  : async () => ({ message: { mock: true, kind: "enrollment" } })
              }
              onClose={() => setCheckoutOpen(false)}
            />
          ) : null}
        </div>
      </QueryClientProvider>
    </TheBaseTheme>
  );
}
