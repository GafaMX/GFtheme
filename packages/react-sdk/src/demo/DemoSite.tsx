import React, { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHttpGafaClient } from "../sdk/client/httpGafaClient";
import { createLegacyGafaFitAdapter } from "../sdk/client/legacyGafaFitAdapter";
import { createCaptchaProvider } from "../sdk/captcha/CaptchaProvider";
import { parseSdkConfig } from "../sdk/config";
import { subscribeToAuthChanges } from "../sdk/client/tokenStorage";
import { ColorSchemeToggle, ThemeProvider, useGafaTheme, type GafaBrandTheme } from "../sdk/theme/theme";
import { CalendarWidget } from "../sdk/widgets/CalendarWidget";
import { CatalogWidget } from "../sdk/widgets/CatalogWidget";
import { AccountModal } from "../sdk/widgets/AccountModal";
import { CheckoutModal } from "../sdk/widgets/CheckoutModal";
import { useCartStore } from "../sdk/cart/cartStore";
import { prefetchCheckoutCatalog } from "../sdk/cart/checkoutCatalog";
import type { CartLineType } from "../sdk/client/types";
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
    theme: { colors: { brand: "#f2b705", accent: "#111827" }, colorScheme: "light" },
    // Fitspin abre en semana a proposito: demuestra que la vista inicial es
    // configuracion por socio, no un comportamiento fijo del SDK.
    calendar: { view: "week", filters: { location: true, service: true, staff: true } },
  },
};

export function DemoSite() {
  const [brandKey, setBrandKey] = useState<keyof typeof BRANDS>("bunker");
  const brand = BRANDS[brandKey];

  return (
    <ThemeProvider key={brandKey} theme={brand.theme}>
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
  const [page, setPage] = useState<Page>("calendario");
  // El link del correo de restablecer contraseña llega con ?token=&email=:
  // hay que abrir la cuenta de una vez, no dejar al socio en el calendario.
  const [accountOpen, setAccountOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get("token") && params.get("email"));
  });
  const [signedIn, setSignedIn] = useState(false);
  // Compra suelta (sin reserva): el catalogo abre el checkout con el item ya
  // puesto, y el boton del header lo reabre con lo que quedo guardado.
  const [checkout, setCheckout] = useState<{
    preselect?: { type: CartLineType; id: number };
    skipCatalog?: boolean;
  } | null>(null);
  const cartCount = useCartStore((s) => s.lines.reduce((sum, line) => sum + line.amount, 0));
  const { scheme } = useGafaTheme();

  const { client, captcha, queryClient } = useDemoClient(brand);

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

  // El fondo de la pagina lo pone el demo, no el SDK: en un sitio real es el
  // propio sitio el que lo define.
  useEffect(() => {
    document.body.dataset.scheme = scheme;
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

              {cartCount > 0 ? (
                <button
                  className="demo-cart"
                  type="button"
                  title="Tu carrito"
                  onClick={() => setCheckout({ skipCatalog: true })}
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
            <CalendarWidget client={client} captcha={captcha} {...brand.calendar} />
          ) : null}

          {page === "paquetes" ? (
            <div className="demo-stack">
              <CatalogWidget
                client={client}
                type="packages"
                onBuy={(item) => setCheckout({ preselect: { type: "combo", id: item.id } })}

              />
              <CatalogWidget
                client={client}
                type="memberships"
                onBuy={(item) => setCheckout({ preselect: { type: "membership", id: item.id } })}
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
            preselect={checkout.preselect ?? null}
            skipCatalog={checkout.skipCatalog ?? Boolean(checkout.preselect)}
            onClose={() => setCheckout(null)}
          />
        ) : null}

        <footer className="demo-footer">
          Sitio de prueba del SDK v2 · datos reales de {brand.label} · tema {scheme === "dark" ? "oscuro" : "claro"}
        </footer>

        {/* OJO: sin contenedor fancy global. FancyOverlay crea el suyo, y el
            inyector legacy exige EXACTAMENTE UN [data-gf-theme="fancy"] en el
            DOM: con dos, no inyecta nada y el checkout "no responde". */}
      </div>
    </QueryClientProvider>
  );
}

function useDemoClient(brand: BrandConfig) {
  // Una sola instancia por marca: el effect anterior recreaba client+QueryClient
  // en CADA mount (mismo brand), y el login podia escribir el token en una
  // instancia mientras el calendario ya usaba otra con el Bearer en null.
  const [current, setCurrent] = useState(() => createDemoClient(brand));
  const brandIdentity = `${brand.companyId}:${brand.apiClient}`;
  const prevIdentityRef = useRef(brandIdentity);

  useEffect(() => {
    if (prevIdentityRef.current === brandIdentity) return;
    prevIdentityRef.current = brandIdentity;
    setCurrent(createDemoClient(brand));
  }, [brand, brandIdentity]);

  return current;
}

function createDemoClient(brand: BrandConfig) {
  const config = parseSdkConfig({
    // Fallback a producción Buq: sin VITE_GAFA_FIT_URL el build queda en blanco
    // (Zod rechaza undefined y React no monta #app).
    apiBaseUrl: (import.meta.env.VITE_GAFA_FIT_URL as string) || "https://buq.partners/",
    companyId: brand.companyId,
    publicClientId: brand.apiClient,
    clientSecret: brand.apiSecret,
    // Sin captchaPublicKey/SecretKey: el SDK usa el par compartido de Buq por
    // default. Asi el registro funciona sin configurar captcha en cada sitio.
  });

  const legacy =
    typeof window !== "undefined" && window.GafaFitSDK
      ? createLegacyGafaFitAdapter(config, window.GafaFitSDK)
      : undefined;

  return {
    client: createHttpGafaClient(config, legacy),
    captcha: createCaptchaProvider(config.captchaProvider, config.captchaPublicKey),
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 60_000 } } }),
  };
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
