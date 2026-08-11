import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHttpGafaClient } from "../sdk/client/httpGafaClient";
import { createLegacyGafaFitAdapter } from "../sdk/client/legacyGafaFitAdapter";
import { createCaptchaProvider } from "../sdk/captcha/CaptchaProvider";
import { parseSdkConfig } from "../sdk/config";
import { subscribeToAuthChanges } from "../sdk/client/tokenStorage";
import { ColorSchemeToggle, ThemeProvider, useGafaTheme, type GafaBrandTheme } from "../sdk/theme/theme";
import { CalendarWidget } from "../sdk/widgets/CalendarWidget";
import { CatalogWidget } from "../sdk/widgets/CatalogWidget";
import { AuthWidget } from "../sdk/widgets/AuthWidget";
import { ProfileWidget } from "../sdk/widgets/ProfileWidget";
import "../sdk/theme/theme.css";
import "../sdk/widgets/widgets.css";
import "./demo.css";

type Page = "calendario" | "paquetes" | "cuenta";

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
  // El link del correo de restablecer contraseña llega con ?token=&email=:
  // hay que aterrizar en Cuenta, no en el calendario.
  const [page, setPage] = useState<Page>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") && params.get("email") ? "cuenta" : "calendario";
  });
  const [signedIn, setSignedIn] = useState(false);
  const { scheme } = useGafaTheme();

  const { client, captcha, queryClient } = useDemoClient(brand);

  useEffect(() => {
    const sync = () => client.getProfile().then((profile) => setSignedIn(Boolean(profile)));
    sync();
    return subscribeToAuthChanges(() => {
      sync();
      // Toda la cache depende de la sesion (perfil, creditos, reservas...):
      // si el login pasa en un widget con el resto desmontado, sus queries
      // cacheadas quedarian con el "null" de antes del login.
      queryClient.invalidateQueries();
    });
  }, [client, queryClient]);

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

              <button
                className="demo-account"
                type="button"
                aria-current={page === "cuenta"}
                onClick={() => setPage("cuenta")}
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
              <CatalogWidget client={client} type="packages" />
              <CatalogWidget client={client} type="memberships" />
            </div>
          ) : null}

          {page === "cuenta" ? (
            <div className="demo-stack">
              {!signedIn ? <AuthWidget client={client} captcha={captcha} initialView="login" /> : null}
              <ProfileWidget client={client} />
            </div>
          ) : null}
        </main>

        <footer className="demo-footer">
          Sitio de prueba del SDK v2 · datos reales de {brand.label} · tema {scheme === "dark" ? "oscuro" : "claro"}
        </footer>

        {/* Contenedor que el checkout externo necesita para inyectarse. */}
        <section data-gf-theme="fancy" />
      </div>
    </QueryClientProvider>
  );
}

function useDemoClient(brand: BrandConfig) {
  const [state] = useState(() => createDemoClient(brand));
  const [current, setCurrent] = useState(state);

  useEffect(() => {
    setCurrent(createDemoClient(brand));
  }, [brand]);

  return current;
}

function createDemoClient(brand: BrandConfig) {
  const config = parseSdkConfig({
    apiBaseUrl: import.meta.env.VITE_GAFA_FIT_URL as string,
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

function AccountIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
