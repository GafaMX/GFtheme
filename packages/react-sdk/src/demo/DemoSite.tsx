import React, { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createGafaSdk, type GafaSdk } from "../sdk";
import { installPixelDebugMocks, readPixelDebugLog } from "../sdk/analytics/pixels";
import { createHttpGafaClient } from "../sdk/client/httpGafaClient";
import { createLegacyGafaFitAdapter } from "../sdk/client/legacyGafaFitAdapter";
import { createCaptchaProvider } from "../sdk/captcha/CaptchaProvider";
import { parseSdkConfig } from "../sdk/config";
import { BUQ_ENVIRONMENTS, readBuqEnvironmentFromLocation, type BuqEnvironmentId } from "../sdk/config/buqEnvironments";
import { subscribeToAuthChanges, configureTokenStorage } from "../sdk/client/tokenStorage";
import { setGafaPayFrontUrl } from "../sdk/payments/gafaPay";
import { ColorSchemeToggle, ThemeProvider, useGafaTheme, type GafaBrandTheme } from "../sdk/theme/theme";
import { CalendarWidget } from "../sdk/widgets/CalendarWidget";
import { CatalogWidget } from "../sdk/widgets/CatalogWidget";
import { AccountModal } from "../sdk/widgets/AccountModal";
import { CheckoutModal } from "../sdk/widgets/CheckoutModal";
import { useCartStore } from "../sdk/cart/cartStore";
import { prefetchCheckoutCatalog } from "../sdk/cart/checkoutCatalog";
import type { CartLineType, CatalogItem, CheckoutConfig, GafaClient } from "../sdk/client/types";
import { createLiveConciergeConfig, FITSPIN_CONCIERGE_CONFIG, type ConciergePartnerConfig } from "../sdk/concierge";
import { fitspinWordmarkDataUri } from "./fitspinWordmark";
import { hasPasswordResetLink } from "../sdk/auth/passwordResetLink";
import "../sdk/theme/theme.css";
import "../sdk/widgets/widgets.css";
import "./demo.css";

type Page = "calendario" | "paquetes";

/**
 * Sitio de prueba de la v2. No es parte del SDK: existe para poder probar los
 * widgets como los va a ver un socio (varias paginas, cuenta en el header,
 * cambio de tema) en vez de todos apilados en una sola pagina.
 */
type BrandConfig = {
  label: string;
  companyId: number;
  /** Cada compañía tiene su propio OAuth client en gafa.fit: con el de otra,
      el login devuelve "La información del cliente es incorrecta". */
  apiClient: string;
  apiSecret: string;
  theme: GafaBrandTheme;
  /** La misma config que un socio pondria en su pagina: vista inicial, filtros, etc. */
  calendar: React.ComponentProps<typeof CalendarWidget>;
};

/** Tienda de prueba: el endpoint público de productos 404 en Fitspin. */
const FITSPIN_STORE_PRODUCTS: CatalogItem[] = [
  { id: 9101, name: "Agua", type: "product", price: 40, priceFinal: 40 },
  { id: 9102, name: "Proteína", type: "product", price: 85, priceFinal: 85 },
  { id: 9103, name: "Toalla", type: "product", price: 150, priceFinal: 150 },
];

/** Fitspin activo: productos de tienda, no paquetes. */
const FITSPIN_CROSS_SELL = {
  enabled: true,
  payTitle: "¿Quieres agregar algo más?",
  thanksTitle: "¿Algo más para después de tu clase?",
  items: FITSPIN_STORE_PRODUCTS.map((item) => ({ type: "product" as const, id: item.id })),
};

const BRANDS: Record<string, BrandConfig> = {
  bunker: {
    label: "Bunker Indoor Golf",
    companyId: 190,
    apiClient: (import.meta.env.VITE_GAFA_API_CLIENT as string) ?? "345",
    apiSecret: import.meta.env.VITE_GAFA_API_SECRET as string,
    theme: { colors: { brand: "#111111", accent: "#c8ff2e" }, colorScheme: "dark" },
    calendar: { view: "day", filters: { location: true, service: true, staff: true } },
  },
  fitspin: {
    label: "Fitspin",
    companyId: 80,
    // Mismas credenciales publicas que fitspin.mx expone en GFThemeOptions.
    apiClient: "74",
    apiSecret: "hI8M3iAEVlWIIfxBLesaxhtEIVpEEPwRyHyxw523",
    theme: {
      colors: { brand: "#f2b705", accent: "#111827" },
      colorScheme: "light",
      logoUrl: fitspinWordmarkDataUri("#111827"),
      logoUrlDark: fitspinWordmarkDataUri("#fffaf4", "#d1d5db"),
    },
    // Fitspin abre en semana a proposito: demuestra que la vista inicial es
    // configuracion por socio, no un comportamiento fijo del SDK.
    calendar: { view: "week", filters: { location: true, service: true, staff: true } },
  },
  oasis: {
    label: "Oasis",
    companyId: 235,
    // Credenciales públicas que web.buq.mx/oasis expone en data-gf-options.
    apiClient: "3491",
    apiSecret: "4PtoTfnqhsS9jGowCkx7IXFbznJFjUUOzQtcCUwh",
    theme: {
      colors: { brand: "#293c8b", accent: "#293c8b" },
      colorScheme: "light",
      logoUrl: "https://web.buq.mx/oasis/logo-dark.png",
      logoUrlDark: "https://web.buq.mx/oasis/logo-light.png",
    },
    calendar: { view: "week", filters: { location: true, service: true, staff: true } },
  },
};

export function DemoSite() {
  const [brandKey, setBrandKey] = useState<keyof typeof BRANDS>(() => {
    const q = new URLSearchParams(window.location.search).get("brand");
    return q && q in BRANDS ? (q as keyof typeof BRANDS) : "fitspin";
  });
  const brand = BRANDS[brandKey];

  return (
    <ThemeProvider
      key={brandKey}
      theme={brand.theme}
      storageScope={`${brand.companyId}:${brand.apiClient}`}
    >
      <DemoShell brandKey={brandKey} onBrandChange={setBrandKey} />
    </ThemeProvider>
  );
}

function DemoShell({
  brandKey,
  onBrandChange,
}: {
  brandKey: keyof typeof BRANDS;
  onBrandChange(key: keyof typeof BRANDS): void;
}) {
  const brand = BRANDS[brandKey];
  const [environment, setEnvironment] = useState<BuqEnvironmentId>(
    () => readBuqEnvironmentFromLocation() ?? "production",
  );
  const [page, setPage] = useState<Page>("calendario");
  // El link del correo de restablecer contraseña llega con ?token=&email=:
  // hay que abrir la cuenta de una vez, no dejar al socio en el calendario.
  const [accountOpen, setAccountOpen] = useState(hasPasswordResetLink);
  const [signedIn, setSignedIn] = useState(false);
  // Compra suelta (sin reserva): el catalogo abre el checkout con el item ya
  // puesto, y el boton del header lo reabre con lo que quedo guardado.
  const [checkout, setCheckout] = useState<{
    preselect?: { type: CartLineType; id: number };
    skipCatalog?: boolean;
  } | null>(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("cross-sell") === "1") {
      return { preselect: { type: "combo", id: 973 }, skipCatalog: true };
    }
    return null;
  });
  const cartCount = useCartStore((s) => s.lines.reduce((sum, line) => sum + line.amount, 0));
  const { scheme } = useGafaTheme();

  const { client: rawClient, captcha, queryClient, config } = useDemoClient(brand, environment);
  const pixelsConsentMode = new URLSearchParams(window.location.search).get("pixels-consent") === "required"
    ? "required"
    : "implied";
  const sdkRef = useRef<GafaSdk | null>(null);
  const [, setSdkTick] = useState(0);
  const sdk = sdkRef.current;
  const client = sdk?.client ?? rawClient;

  useEffect(() => {
    installPixelDebugMocks();
    const next = createGafaSdk(
      {
        environment,
        companyId: brand.companyId,
        publicClientId: brand.apiClient,
        clientSecret: brand.apiSecret,
        analyticsEnabled: true,
        pixelsEnabled: true,
        pixelsConsentMode,
        metaPixelId: "DEMO_META",
        tiktokPixelId: "DEMO_TT",
        ga4MeasurementId: "G-DEMO",
        googleAdsId: "AW-DEMO",
        googleAdsPurchaseLabel: "demo_purchase",
        theme: {
          colorScheme: brand.theme.colorScheme,
          logoUrl: brand.theme.logoUrl,
          logoUrlDark: brand.theme.logoUrlDark,
          colors: brand.theme.colors as Record<string, string> | undefined,
        },
      },
      { client: rawClient },
    );
    sdkRef.current = next;
    setSdkTick((value) => value + 1);
    window.BuqSDK = next;
    window.GafaThemeSDK = next;
    const handle = next.concierge.mount({
      config: conciergeConfigFor(brandKey),
      hydrateFromClient: true,
      navigate(path) {
        setPage(path.includes("paquete") || path.includes("package") ? "paquetes" : "calendario");
      },
    });
    return () => {
      handle.destroy();
      next.unmountAll();
      if (sdkRef.current === next) sdkRef.current = null;
    };
  }, [brand.apiClient, brand.apiSecret, brand.companyId, brandKey, rawClient, environment, pixelsConsentMode]);

  useEffect(() => {
    // Mismo criterio que AccountModal/CalendarWidget: un hipo de red no debe
    // verse igual que estar deslogueado.
    const sync = async () => {
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const profile = await client.getProfile();
          setSignedIn(Boolean(profile));
          return;
        } catch {
          if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
        }
      }
    };
    sync();
    return subscribeToAuthChanges(() => {
      sync();
      // Toda la cache depende de la sesion (perfil, creditos, reservas...).
      // removeQueries del session evita reutilizar un success+null pre-login.
      queryClient.removeQueries({ queryKey: ["calendar", "session"] });
      queryClient.invalidateQueries();
    });
  }, [client, queryClient]);

  useEffect(() => {
    prefetchCheckoutCatalog(queryClient, client);
  }, [client, queryClient, cartCount]);

  const lastTrackedView = useRef<Page | null>(null);
  useEffect(() => {
    if (lastTrackedView.current === null) {
      lastTrackedView.current = page;
      return;
    }
    if (lastTrackedView.current === page) return;
    lastTrackedView.current = page;
    sdkRef.current?.track({ event: "page_view", widget: "demo", props: { view: page } });
  }, [page]);

  // El fondo de la pagina lo pone el demo, no el SDK: en un sitio real es el
  // propio sitio el que lo define.
  useEffect(() => {
    document.body.dataset.demoScheme = scheme;
  }, [scheme]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="demo-root">
        <header className="demo-header">
          <div className="demo-header__inner">
            <button className="demo-logo" type="button" onClick={() => setPage("calendario")}>
              {brand.label}
            </button>

            <nav className="demo-nav">
              <button type="button" aria-current={page === "calendario"} onClick={() => setPage("calendario")}>
                Calendario
              </button>
              <button type="button" aria-current={page === "paquetes"} onClick={() => setPage("paquetes")}>
                Paquetes
              </button>
            </nav>

            <div className="demo-header__actions">
              <select
                aria-label="Entorno Buq"
                className="demo-brand-select"
                value={environment}
                onChange={(event) => {
                  const next = event.target.value as BuqEnvironmentId;
                  setEnvironment(next);
                  const url = new URL(window.location.href);
                  url.searchParams.set("buq-env", next);
                  window.history.replaceState({}, "", url);
                }}
              >
                {Object.values(BUQ_ENVIRONMENTS).map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.label}
                  </option>
                ))}
              </select>

              <select
                aria-label="Socio de prueba"
                className="demo-brand-select"
                value={brandKey}
                onChange={(event) => onBrandChange(event.target.value as keyof typeof BRANDS)}
              >
                {Object.entries(BRANDS).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>

              <ColorSchemeToggle />

              {pixelsConsentMode === "required" ? (
                <button
                  type="button"
                  className="demo-consent"
                  data-demo-consent=""
                  onClick={() => {
                    sdkRef.current?.setConsent({ marketing: true });
                    window.BuqSDK?.setConsent?.({ marketing: true });
                  }}
                >
                  Dar consentimiento de marketing
                </button>
              ) : null}

              {cartCount > 0 ? (
                <button
                  className="demo-cart"
                  type="button"
                  title="Tu carrito"
                  onClick={() => {
                    sdkRef.current?.openCheckout({
                      skipCatalog: true,
                      crossSell: brandKey === "fitspin" ? FITSPIN_CROSS_SELL : undefined,
                    });
                  }}
                >
                  <CartIcon />
                  <span className="demo-cart__count">{cartCount}</span>
                </button>
              ) : null}

              <button
                className="demo-account"
                type="button"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen(true)}
                title={signedIn ? "Tu cuenta" : "Iniciar sesión"}
              >
                <AccountIcon />
                <span className="demo-account__label">{signedIn ? "Mi cuenta" : "Entrar"}</span>
                {signedIn ? <span className="demo-account__dot" aria-hidden="true" /> : null}
              </button>
            </div>
          </div>
        </header>

        <main className="demo-main" data-page={page}>
          {page === "calendario" ? (
            <CalendarWidget
              client={client}
              captcha={captcha}
              {...brand.calendar}
              crossSell={brandKey === "fitspin" ? FITSPIN_CROSS_SELL : undefined}
            />
          ) : null}

          {page === "paquetes" ? (
            <div className="demo-stack">
              <CatalogWidget
                client={client}
                type="packages"
                onBuy={(item) => {
                  sdkRef.current?.openCheckout({
                    preselect: { type: "combo", id: item.id },
                    skipCatalog: true,
                    crossSell: brandKey === "fitspin" ? FITSPIN_CROSS_SELL : undefined,
                  });
                }}
              />
              <CatalogWidget
                client={client}
                type="memberships"
                onBuy={(item) => {
                  sdkRef.current?.openCheckout({
                    preselect: { type: "membership", id: item.id },
                    skipCatalog: true,
                    crossSell: brandKey === "fitspin" ? FITSPIN_CROSS_SELL : undefined,
                  });
                }}
              />
            </div>
          ) : null}
        </main>

        {/* La cuenta no es una pagina: se abre encima de lo que el socio estaba
            viendo, igual que el checkout. */}
        <AccountModal
          client={client}
          captcha={captcha}
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
          title={brand.label}
          onExploreClasses={() => setPage("calendario")}
          onExplorePackages={() => setPage("paquetes")}
        />

        {checkout ? (
          <CheckoutModal
            client={client}
            captcha={captcha}
            preselect={checkout.preselect ?? null}
            skipCatalog={checkout.skipCatalog ?? Boolean(checkout.preselect)}
            gafaPayFrontUrl={config.gafaPayFrontUrl}
            crossSell={brandKey === "fitspin" ? FITSPIN_CROSS_SELL : undefined}
            onClose={() => setCheckout(null)}
          />
        ) : null}

        <footer className="demo-footer">
          Sitio de prueba del SDK v2 · {brand.label} · {config.environment} · {config.apiBaseUrl}
        </footer>
        <PixelDebugPanel />

        {/* OJO: sin contenedor fancy global. FancyOverlay crea el suyo, y el
            inyector legacy exige EXACTAMENTE UN [data-gf-theme="fancy"] en el
            DOM: con dos, no inyecta nada y el checkout "no responde". */}
      </div>
    </QueryClientProvider>
  );
}

function useDemoClient(brand: BrandConfig, environment: BuqEnvironmentId) {
  // Una sola instancia por marca+entorno: el effect anterior recreaba client+QueryClient
  // en CADA mount (mismo brand), y el login podia escribir el token en una
  // instancia mientras el calendario ya usaba otra con el Bearer en null.
  const [current, setCurrent] = useState(() => createDemoClient(brand, environment));
  const identity = `${brand.companyId}:${brand.apiClient}:${environment}`;
  const prevIdentityRef = useRef(identity);

  useEffect(() => {
    if (prevIdentityRef.current === identity) return;
    prevIdentityRef.current = identity;
    setCurrent(createDemoClient(brand, environment));
  }, [brand, environment, identity]);

  return current;
}

function conciergeConfigFor(brandKey: keyof typeof BRANDS): ConciergePartnerConfig {
  if (brandKey === "fitspin") {
    return { ...FITSPIN_CONCIERGE_CONFIG, catalog: { ...FITSPIN_CONCIERGE_CONFIG.catalog, live: true } };
  }
  const brand = BRANDS[brandKey];
  const accent = brand.theme.colors?.accent ?? "#111111";
  return createLiveConciergeConfig({
    id: brandKey,
    displayName: brand.label,
    companyId: brand.companyId,
    theme: {
      mode: brand.theme.colorScheme === "dark" ? "dark" : "light",
      accent,
      foreground: "#111111",
    },
  });
}

function createDemoClient(brand: BrandConfig, environment: BuqEnvironmentId) {
  const config = parseSdkConfig({
    environment,
    apiBaseUrl:
      environment === "production" ? (import.meta.env.VITE_GAFA_FIT_URL as string) || undefined : undefined,
    companyId: brand.companyId,
    publicClientId: brand.apiClient,
    clientSecret: brand.apiSecret,
  });
  configureTokenStorage(config.apiBaseUrl);
  setGafaPayFrontUrl(config.gafaPayFrontUrl);

  const legacy =
    typeof window !== "undefined" && window.GafaFitSDK
      ? createLegacyGafaFitAdapter(config, window.GafaFitSDK)
      : undefined;

  const http = createHttpGafaClient(config, legacy);
  return {
    config,
    client: brand.companyId === 80 ? withFitspinStoreProducts(http) : http,
    captcha: createCaptchaProvider(config.captchaProvider, config.captchaPublicKey),
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 60_000 } } }),
  };
}

/** El /product de Fitspin no es público: sin esto la oferta de tienda no resuelve. */
function withFitspinStoreProducts(client: GafaClient): GafaClient {
  const merge = (live: CatalogItem[] | undefined) => {
    const have = new Set((live ?? []).map((item) => item.id));
    return [...(live ?? []), ...FITSPIN_STORE_PRODUCTS.filter((item) => !have.has(item.id))];
  };
  return {
    ...client,
    async listProducts(brandSlug) {
      const live = client.listProducts ? await client.listProducts(brandSlug) : [];
      return merge(live);
    },
    async getCheckoutConfig(payload) {
      if (!client.getCheckoutConfig) return undefined as unknown as CheckoutConfig;
      const config = await client.getCheckoutConfig(payload);
      if (!config) return config;
      return { ...config, products: merge(config.products) };
    },
  };
}

function PixelDebugPanel() {
  const [entries, setEntries] = useState(() => readPixelDebugLog());
  useEffect(() => {
    const timer = window.setInterval(() => setEntries([...readPixelDebugLog()]), 500);
    return () => window.clearInterval(timer);
  }, []);
  if (!entries.length) return null;
  return (
    <aside className="demo-pixel-log" aria-label="Pixel debug log">
      <strong>Píxeles (mock)</strong>
      <ol>
        {entries.slice(-12).map((entry, index) => (
          <li key={`${entry.at}-${index}`}>
            <code>{entry.provider}</code> {entry.args.map((arg) => stringifyArg(arg)).join(" · ")}
          </li>
        ))}
      </ol>
    </aside>
  );
}

function stringifyArg(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 5h2l2.1 9.6a1.5 1.5 0 0 0 1.47 1.18h7.1a1.5 1.5 0 0 0 1.47-1.17L19.5 8.2H7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.6" cy="19" r="1.3" fill="currentColor" />
      <circle cx="16" cy="19" r="1.3" fill="currentColor" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
