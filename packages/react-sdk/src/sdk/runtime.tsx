import React, { type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parseSdkConfig, type GafaSdkConfigInput, type GafaSdkConfig } from "./config";
import { createGafaClient } from "./client/gafaClient";
import type { GafaClient } from "./client/types";
import { createLegacyGafaFitAdapter } from "./client/legacyGafaFitAdapter";
import { createHttpGafaClient } from "./client/httpGafaClient";
import { createCaptchaProvider } from "./captcha/CaptchaProvider";
import { subscribeToAuthChanges } from "./client/tokenStorage";
import { ThemeProvider } from "./theme/theme";
import { AuthWidget, type AuthWidgetProps } from "./widgets/AuthWidget";
import { CalendarWidget, type CalendarWidgetProps } from "./widgets/CalendarWidget";
import { CatalogWidget, type CatalogWidgetProps } from "./widgets/CatalogWidget";
import { ProfileWidget, type ProfileWidgetProps } from "./widgets/ProfileWidget";
import { AccountModal, type AccountModalProps } from "./widgets/AccountModal";
import { PurchaseButtonWidget, type PurchaseButtonWidgetProps } from "./widgets/PurchaseButtonWidget";
import "./theme/theme.css";
import "./widgets/widgets.css";

export type GafaSdk = {
  config: GafaSdkConfig;
  client: GafaClient;
  mountCalendar(target: string | Element, props?: CalendarWidgetProps): MountedWidget;
  mountAuth(target: string | Element, props?: AuthWidgetProps): MountedWidget;
  mountCatalog(target: string | Element, props?: CatalogWidgetProps): MountedWidget;
  mountProfile(target: string | Element, props?: ProfileWidgetProps): MountedWidget;
  mountPurchaseButton(target: Element, props?: PurchaseButtonWidgetProps): MountedWidget;
  /** Abre la cuenta (login o perfil) en un popup sobre la pagina actual. */
  openAccount(props?: AccountModalOptions): { close(): void };
  unmountAll(): void;
};

export type AccountModalOptions = Omit<AccountModalProps, "client" | "captcha" | "open" | "onClose">;

export type MountedWidget = {
  root: Root;
  element: Element;
  unmount(): void;
};

type RuntimeOptions = {
  client?: GafaClient;
  useMockClient?: boolean;
};

export function createGafaSdk(input: GafaSdkConfigInput, options: RuntimeOptions = {}): GafaSdk {
  const config = parseSdkConfig(input);
  const client = options.client ?? createClient(config, options);
  const captcha = createCaptchaProvider(config.captchaProvider, config.captchaPublicKey);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 1
      }
    }
  });
  // Login/logout invalidan toda la cache: perfil, creditos y reservas cambian
  // con la sesion, y pueden haberse cacheado antes de autenticar.
  subscribeToAuthChanges(() => queryClient.invalidateQueries());
  const mounts = new Set<MountedWidget>();

  function mount(target: string | Element, node: ReactNode): MountedWidget {
    const element = resolveTarget(target);
    const root = createRoot(element);
    const mounted: MountedWidget = {
      root,
      element,
      unmount() {
        root.unmount();
        mounts.delete(mounted);
      }
    };

    root.render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={config.theme}>
            {node}
          </ThemeProvider>
        </QueryClientProvider>
      </React.StrictMode>
    );

    mounts.add(mounted);
    return mounted;
  }

  return {
    config,
    client,
    mountCalendar(target, props = {}) {
      return mount(target, <CalendarWidget client={client} captcha={captcha} {...props} />);
    },
    mountAuth(target, props = {}) {
      return mount(target, <AuthWidget client={client} captcha={captcha} {...props} />);
    },
    mountCatalog(target, props = {}) {
      return mount(target, <CatalogWidget client={client} {...props} />);
    },
    mountProfile(target, props = {}) {
      return mount(target, <ProfileWidget client={client} {...props} />);
    },
    mountPurchaseButton(target, props = {}) {
      return mount(target, <PurchaseButtonWidget client={client} hostElement={target} {...props} />);
    },
    openAccount(props = {}) {
      const host = document.createElement("div");
      document.body.appendChild(host);

      const close = () => {
        // El cierre viene de un handler de React: desmontar la raiz en el mismo
        // tick tira "synchronously unmount a root while React was rendering".
        queueMicrotask(() => {
          mounted.unmount();
          host.remove();
        });
      };

      const mounted = mount(
        host,
        <AccountModal client={client} captcha={captcha} open onClose={close} {...props} />,
      );

      return { close };
    },
    unmountAll() {
      Array.from(mounts).forEach((mounted) => mounted.unmount());
      queryClient.clear();
    }
  };
}

function createClient(config: GafaSdkConfig, options: RuntimeOptions): GafaClient {
  if (options.useMockClient) {
    return createGafaClient(config);
  }

  // El cliente HTTP nuevo cubre catalogo/calendario/login/registro/password en directo
  // contra la API de gafa.fit. Solo openCheckout/openReservationCheckout (el "fancy") siguen
  // sin reconstruir: si el script legacy window.GafaFitSDK esta presente, se usa como
  // fallback unicamente para esos dos.
  const legacy =
    typeof window !== "undefined" && window.GafaFitSDK
      ? createLegacyGafaFitAdapter(config, window.GafaFitSDK)
      : undefined;

  return createHttpGafaClient(config, legacy);
}

function resolveTarget(target: string | Element): Element {
  if (typeof target !== "string") {
    return target;
  }

  const element = document.querySelector(target);

  if (!element) {
    throw new Error(`Gafa SDK target not found: ${target}`);
  }

  return element;
}

