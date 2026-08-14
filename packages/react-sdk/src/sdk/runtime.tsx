import React, { type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parseSdkConfig, type GafaSdkConfigInput, type GafaSdkConfig } from "./config";
import { createGafaClient } from "./client/gafaClient";
import type { GafaClient } from "./client/types";
import { createLegacyGafaFitAdapter } from "./client/legacyGafaFitAdapter";
import { createHttpGafaClient } from "./client/httpGafaClient";
import { createCaptchaProvider } from "./captcha/CaptchaProvider";
import { subscribeToAuthChanges, configureTokenStorage } from "./client/tokenStorage";
import { ThemeProvider } from "./theme/theme";
import { AuthWidget, type AuthWidgetProps } from "./widgets/AuthWidget";
import { CalendarWidget, type CalendarWidgetProps } from "./widgets/CalendarWidget";
import { CatalogWidget, type CatalogWidgetProps } from "./widgets/CatalogWidget";
import { ProfileWidget, type ProfileWidgetProps } from "./widgets/ProfileWidget";
import { AccountModal, type AccountModalProps } from "./widgets/AccountModal";
import { CheckoutModal, type CheckoutModalProps } from "./widgets/CheckoutModal";
import { PurchaseButtonWidget, type PurchaseButtonWidgetProps } from "./widgets/PurchaseButtonWidget";
import { HeaderControls, type HeaderControlsProps } from "./widgets/HeaderControls";
import { bootstrapPurchaseButtons } from "./cart/purchaseButtons";
import { useCartStore } from "./cart/cartStore";
import { prefetchCheckoutCatalog } from "./cart/checkoutCatalog";
import { setGafaPayFrontUrl } from "./payments/gafaPay";
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
  /**
   * Iconos de header (Mi cuenta + carrito). Es lo que va en el
   * `[data-gf-theme="login-register"]` de los sitios viejos: el login entero
   * se abre en popup, no se pinta el formulario en la barra.
   */
  mountHeaderControls(target: string | Element, props?: HeaderControlsMountProps): MountedWidget;
  /** Abre la cuenta (login o perfil) en un popup sobre la pagina actual. */
  openAccount(props?: AccountModalOptions): { close(): void };
  /** Abre el checkout (carrito + pago) sobre la pagina actual. */
  openCheckout(props?: CheckoutOptions): { close(): void };
  /**
   * Activa los botones de compra en HTML plano ([data-gf-buy] con
   * data-gf-combo-id / data-gf-membership-id / data-gf-product-id).
   */
  enablePurchaseButtons(root?: Document | Element): () => void;
  unmountAll(): void;
};

export type AccountModalOptions = Omit<AccountModalProps, "client" | "captcha" | "open" | "onClose">;
export type CheckoutOptions = Omit<CheckoutModalProps, "client" | "onClose">;
export type HeaderControlsMountProps = Pick<HeaderControlsProps, "showCart"> & AccountModalOptions;

export type MountedWidget = {
  root: Root;
  element: Element;
  unmount(): void;
};

type RuntimeOptions = {
  client?: GafaClient;
  useMockClient?: boolean;
};

/** Un solo fancy a la vez: dos instancias del SDK (React StrictMode, cambio
 *  de tema) no deben apilar overlays oscuros. */
let activeCheckout: { close(): void } | null = null;
let activeAccount: { close(): void } | null = null;
let purchaseButtonsStop: (() => void) | null = null;

function checkoutFromCart(): CheckoutOptions {
  const { lines } = useCartStore.getState();
  const first = lines[0];
  return {
    skipCatalog: lines.length > 0,
    brandSlug: first?.brandSlug,
    locationSlug: lines.find((line) => line.locationSlug)?.locationSlug,
  };
}

function silenceLegacyFancy() {
  if (typeof document === "undefined") return;
  document.querySelectorAll<HTMLElement>('[data-gf-theme="fancy"]').forEach((node) => {
    node.classList.remove("active", "show");
  });
}

export function createGafaSdk(input: GafaSdkConfigInput, options: RuntimeOptions = {}): GafaSdk {
  const config = parseSdkConfig(input);
  configureTokenStorage(config.apiBaseUrl);
  setGafaPayFrontUrl(config.gafaPayFrontUrl);
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
  prefetchCheckoutCatalog(queryClient, client);
  const unsubCartWarm = useCartStore.subscribe(() => {
    prefetchCheckoutCatalog(queryClient, client);
  });

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

  const sdk: GafaSdk = {
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
      const { comboId, membershipId, productId, locationId, ...rest } = props;
      const preselect = comboId
        ? { type: "combo" as const, id: Number(comboId) }
        : membershipId
          ? { type: "membership" as const, id: Number(membershipId) }
          : productId
            ? { type: "product" as const, id: Number(productId) }
            : null;
      return mount(
        target,
        <PurchaseButtonWidget
          client={client}
          hostElement={target}
          comboId={comboId}
          membershipId={membershipId}
          productId={productId}
          locationId={locationId}
          {...rest}
          onOpenCheckout={() =>
            sdk.openCheckout({
              brandSlug: rest.brandSlug,
              locationId: locationId != null ? Number(locationId) : undefined,
              preselect,
              skipCatalog: Boolean(preselect),
            })
          }
        />,
      );
    },
    mountHeaderControls(target, props = {}) {
      let account: { close(): void } | null = null;
      let checkout: { close(): void } | null = null;
      const { showCart, ...accountProps } = props;

      return mount(
        target,
        <HeaderControls
          client={client}
          showCart={showCart}
          onOpenAccount={() => {
            account?.close();
            account = sdk.openAccount(accountProps);
          }}
          onOpenCart={() => {
            checkout?.close();
            checkout = sdk.openCheckout(checkoutFromCart());
          }}
        />,
      );
    },
    openAccount(props = {}) {
      const host = document.createElement("div");
      document.body.appendChild(host);

      const close = () => {
        if (activeAccount === handle) activeAccount = null;
        // El cierre viene de un handler de React: desmontar la raiz en el mismo
        // tick tira "synchronously unmount a root while React was rendering".
        queueMicrotask(() => {
          mounted.unmount();
          host.remove();
        });
      };

      activeAccount?.close();
      const handle = { close };
      activeAccount = handle;

      const mounted = mount(
        host,
        <AccountModal client={client} captcha={captcha} open onClose={close} {...props} />,
      );

      return handle;
    },
    openCheckout(props = {}) {
      silenceLegacyFancy();
      prefetchCheckoutCatalog(queryClient, client, props.brandSlug);
      const host = document.createElement("div");
      document.body.appendChild(host);

      const close = () => {
        if (activeCheckout === handle) activeCheckout = null;
        // Igual que openAccount: desmontar en el mismo tick del handler de
        // React revienta con "synchronously unmount a root while rendering".
        queueMicrotask(() => {
          mounted.unmount();
          host.remove();
        });
      };

      activeCheckout?.close();
      const handle = { close };
      activeCheckout = handle;

      const mounted = mount(
        host,
        <CheckoutModal
          client={client}
          {...props}
          onClose={close}
          gafaPayFrontUrl={props.gafaPayFrontUrl ?? config.gafaPayFrontUrl}
        />,
      );

      return handle;
    },
    enablePurchaseButtons(root) {
      purchaseButtonsStop?.();

      const stop = bootstrapPurchaseButtons({
        root,
        onPurchase: (intent) =>
          sdk.openCheckout({
            brandSlug: intent.brandSlug,
            locationSlug: intent.locationSlug,
            locationId: intent.locationId,
            preselect: { type: intent.type, id: intent.id },
            skipCatalog: true,
          }),
        onOpenCart: () => sdk.openCheckout(checkoutFromCart()),
        onOpenAccount: () => {
          sdk.openAccount();
        },
      });

      purchaseButtonsStop = stop;
      return () => {
        stop();
        if (purchaseButtonsStop === stop) purchaseButtonsStop = null;
      };
    },
    unmountAll() {
      purchaseButtonsStop?.();
      purchaseButtonsStop = null;
      unsubCartWarm();
      activeCheckout = null;
      activeAccount = null;
      Array.from(mounts).forEach((mounted) => mounted.unmount());
      queryClient.clear();
    }
  };

  return sdk;
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

