import { useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./sdk/theme/theme";
import { CheckoutModal } from "./sdk/widgets/CheckoutModal";
import { HeaderControls } from "./sdk/widgets/HeaderControls";
import { CatalogWidget } from "./sdk/widgets/CatalogWidget";
import { useCartStore } from "./sdk/cart/cartStore";
import type { CatalogItem, GafaClient } from "./sdk/client/types";
import { ENROLLMENT_CHARGE_FAILED_MESSAGE } from "./sdk/cart/membershipEnrollment";
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

function ensurePreviewOptions() {
  if (typeof document === "undefined") return;
  if (document.querySelector("[data-gf-options], [data-gafa-options]")) return;
  const script = document.createElement("script");
  script.type = "application/json";
  script.setAttribute("data-gf-options", "");
  script.textContent = JSON.stringify({
    COMPANY_ID: 204,
    API_CLIENT: 1621,
    MEMBERSHIP_ENROLLMENT: ENROLLMENT,
    MOCK_PAY: true,
  });
  (document.head || document.body).appendChild(script);
}

export function TheBaseMatriculaPreview() {
  ensurePreviewOptions();
  const params = new URLSearchParams(window.location.search);
  const isGuest = params.get("guest") === "1";
  const isReturning = params.get("returning") === "1";
  const failEnrollment = params.get("fail-enrollment") === "1";
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const queryClient = useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: 0 } } }), []);

  const client = useMemo<GafaClient>(() => {
    return {
      listBrands: async () => [
        { id: 225, name: "The Base Pozuelo", slug: "the-base", currency: { prefix: "€", suffix: "EUR", code: "EUR" } },
      ],
      listLocations: async () => [{ id: 332, name: "Pozuelo", slug: "pozuelo", brandSlug: "the-base" }],
      listCombos: async () => combos,
      listMemberships: async () => memberships,
      listProducts: async () => [],
      getProfile: async () => {
        if (isGuest) throw new Error("Sin sesión");
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
        gafapayClientId: "mock",
        gafapayClientSecret: "mock",
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
        isReturning ? [{ id: 9, membershipId: 1272, name: "Bronze", expiresAt: new Date().toISOString() }] : [],
      listUserPurchases: async () => [],
      listUserCredits: async () => [],
      listUserReservations: async () => [],
      listRegistrationFields: async () => [],
      login: async () => ({ access_token: "preview" }),
      logout: () => undefined,
      register: async () => ({}),
      requestPasswordReset: async () => undefined,
      resetPassword: async () => undefined,
      openCheckout: async () => undefined,
      openReservationCheckout: async () => undefined,
      listServices: async () => [],
      listStaff: async () => [],
      listMeetings: async () => [],
      cancelReservation: async () => undefined,
    } as GafaClient;
  }, [failEnrollment, isGuest, isReturning]);

  useEffect(() => {
    useCartStore.setState({ lines: [], reservation: null });
  }, []);

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
      <QueryClientProvider client={queryClient}>
        <div className="demo-root" data-matricula-preview="true">
          <header className="demo-header">
            <div className="demo-header__inner">
              <span className="demo-logo">The Base Pozuelo</span>
              <HeaderControls client={client} onOpenAccount={() => undefined} onOpenCart={() => setCheckoutOpen(true)} />
            </div>
          </header>
          <main className="demo-main" style={{ padding: "1.5rem" }}>
            <p style={{ maxWidth: 640, color: "#B9B0A2", lineHeight: 1.5 }}>
              Preview de matrícula (SDK V2). <strong>No cobra tarjetas reales</strong>: el botón Pagar simula
              dos cargos (membresía + matrícula). Agrega Silver para ver la línea atada de 30 €.
              {isReturning ? " Esta cuenta ya tuvo una membresía: no debe aparecer matrícula." : ""}
              {failEnrollment ? " Esta URL fuerza el fallo del segundo cobro." : ""}
            </p>
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
                  brandSlug: "the-base",
                  locationSlug: "pozuelo",
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
                  brandSlug: "the-base",
                  locationSlug: "pozuelo",
                  raw: item.raw,
                });
                setCheckoutOpen(true);
              }}
            />
          </main>
          {checkoutOpen ? (
            <CheckoutModal
              client={client}
              brandSlug="the-base"
              locationSlug="pozuelo"
              locationName="Pozuelo"
              skipCatalog={false}
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
          {failEnrollment ? (
            <p className="gafa-sr-only">{ENROLLMENT_CHARGE_FAILED_MESSAGE}</p>
          ) : null}
        </div>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
